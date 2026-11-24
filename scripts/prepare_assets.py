import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "vibe_images"
ART = ROOT / "public" / "art"
UI_ART = ART / "ui"
ITEM_ART = ART / "items"
ANIMATIONS = ART / "animations"
BRAND = ROOT / "public" / "brand"
ICONS = ROOT / "public" / "icons"
QA = ROOT / "qa"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
F7_BRAND_DIR = Path(r"G:\My Drive\F7 Developer - Content\F7 Brand\Splash Screen Video")

for folder in [ART, UI_ART, ITEM_ART, ANIMATIONS, BRAND, ICONS, QA]:
    folder.mkdir(parents=True, exist_ok=True)


def chroma_key_green(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGBA")).astype(np.float32)
    red, green, blue, alpha = pixels[..., 0], pixels[..., 1], pixels[..., 2], pixels[..., 3]
    dominance = np.minimum(green - red, green - blue)
    mask = np.clip((dominance - 18) / 55, 0, 1)
    mask = np.where(green > 105, mask, 0)
    pixels[..., 3] = alpha * (1 - mask)
    pixels[..., 1] = np.minimum(pixels[..., 1], np.maximum(red, blue) + 12)
    return Image.fromarray(np.uint8(np.clip(pixels, 0, 255)), "RGBA")


def chroma_key_magenta(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGBA")).astype(np.float32)
    red, green, blue, alpha = pixels[..., 0], pixels[..., 1], pixels[..., 2], pixels[..., 3]
    dominance = np.minimum(red - green, blue - green)
    mask = np.clip((dominance - 22) / 58, 0, 1)
    mask = np.where((red > 110) & (blue > 110), mask, 0)
    pixels[..., 3] = alpha * (1 - mask)
    # Despill magenta fringes on semi-transparent edges
    spill = (mask > 0.05) & (mask < 0.98)
    limit = green + 18
    pixels[..., 0] = np.where(spill, np.minimum(red, limit), red)
    pixels[..., 2] = np.where(spill, np.minimum(blue, limit), blue)
    return Image.fromarray(np.uint8(np.clip(pixels, 0, 255)), "RGBA")


def trim_alpha(image: Image.Image, threshold: int = 12) -> Image.Image:
    arr = np.asarray(image)
    mask = arr[..., 3] > threshold
    if not np.any(mask):
        return image
    ys, xs = np.where(mask)
    return image.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def center_com_x(image: Image.Image) -> float:
    arr = np.asarray(image)
    weights = (arr[..., 3] > 20).astype(np.float32)
    total = float(weights.sum())
    if total <= 0:
        return image.width / 2
    xs = np.arange(image.width, dtype=np.float32)[None, :]
    return float((weights * xs).sum() / total)


# 1. Static character portraits (existing)
sprites = {
    "forge-knight-hero": SOURCE / "forge-knight-hero_1795484524752_96b7b77a.png",
    "ironbound-boar": SOURCE / "ironbound-boar_1795484544544_c99917f3.png",
    "rust-scout": SOURCE / "rust-scout_1795484563970_107e516c.png",
    "forge-colossus-boss": SOURCE / "forge-colossus-boss_1795484588986_91441bc2.png",
}

for name, path in sprites.items():
    if path.exists():
        result = trim_alpha(chroma_key_green(Image.open(path)))
        result.thumbnail((700, 900), Image.Resampling.LANCZOS)
        result.save(ART / f"{name}.webp", "WEBP", quality=92, method=6)

# 2. Animation sheets (hero + enemies, normalized baseline & center-of-mass)
# tuple: (path, cols, rows, fps, mirror_left, cell_inset_px, portrait_name_or_None)
sheets = {
    "hero-idle": (SOURCE / "forge-knight-idle-sheet_1795484905649_6891250e.png", 2, 2, 8, False, 0, None),
    "hero-run": (SOURCE / "forge-knight-run-sheet_1795485094277_fcfe5b76.png", 2, 2, 14, False, 0, None),
    "hero-sword": (SOURCE / "forge-knight-sword-attack-sheet_1795484927186_dc19ec3c.png", 4, 2, 18, False, 0, None),
    "hero-daggers": (SOURCE / "forge-knight-daggers-attack-sheet_1795485117279_a17dac20.png", 4, 2, 20, False, 0, None),
    "hero-heavy": (SOURCE / "forge-knight-heavy-attack-sheet_1795484953065_9b19249e.png", 4, 2, 16, False, 0, None),
    "hero-bow": (SOURCE / "forge-knight-bow-attack-sheet_1795484974413_9011a6f7.png", 3, 2, 16, False, 0, None),
    "boar-run": (SOURCE / "ironbound-boar-run-sheet_1795484996289_1fb4e1bb.png", 2, 2, 14, False, 0, None),
    "boar-attack": (SOURCE / "boar-attack-sheet.jpg", 2, 2, 14, True, 4, None),
    "scout-run": (SOURCE / "rust-scout-run-sheet_1795485016295_c34b30b1.png", 2, 2, 14, False, 0, None),
    "golem-walk": (SOURCE / "golem-walk-sheet.jpg", 2, 2, 10, True, 14, "cinder-sentinel"),
    "hound-run": (SOURCE / "hound-run-sheet.jpg", 2, 2, 14, True, 4, "brass-stalker"),
    "boss-walk": (SOURCE / "forge-colossus-walk-sheet_1795485408656_bf1d037b.png", 2, 2, 10, False, 0, None),
    "boss-attack": (SOURCE / "forge-colossus-attack-sheet_1795485038854_1256ce0e.png", 2, 2, 12, False, 0, None),
    "warden-walk": (SOURCE / "warden-walk-sheet.jpg", 2, 2, 10, True, 4, "obsidian-warden"),
    "dreadnought-walk": (SOURCE / "dreadnought-walk-sheet.jpg", 2, 2, 10, True, 4, "molten-dreadnought"),
}

metadata = {}
preview_frames = []
hero_idle_median_h = None

for name, (path, columns, rows, fps, mirror_left, inset, portrait_name) in sheets.items():
    if not path.exists():
        print(f"WARN missing sheet: {path}")
        continue
    raw_sheet = Image.open(path)
    cell_width = raw_sheet.width // columns
    cell_height = raw_sheet.height // rows
    cropped_frames = []
    coms = []
    for row in range(rows):
        for column in range(columns):
            left = column * cell_width + inset
            top = row * cell_height + inset
            right = (column + 1) * cell_width - inset
            bottom = (row + 1) * cell_height - inset
            cell = chroma_key_green(raw_sheet.crop((left, top, right, bottom)))
            if mirror_left:
                cell = ImageOps.mirror(cell)
            trimmed = trim_alpha(cell)
            cropped_frames.append(trimmed)
            coms.append(center_com_x(trimmed))

    if portrait_name and cropped_frames:
        portrait = cropped_frames[0].copy()
        portrait.thumbnail((700, 900), Image.Resampling.LANCZOS)
        portrait.save(ART / f"{portrait_name}.webp", "WEBP", quality=92, method=6)

    max_left_span = max(int(round(com)) for com in coms)
    max_right_span = max(int(round(frame.width - com)) for frame, com in zip(cropped_frames, coms))
    max_h = max(frame.height for frame in cropped_frames)
    pad_x = 8
    pad_top = 8
    pad_bottom = 4
    canvas_w = max_left_span + max_right_span + pad_x * 2
    canvas_h = max_h + pad_top + pad_bottom
    center_x = max_left_span + pad_x

    scale = min(1.0, 420 / max(1, canvas_w), 560 / max(1, canvas_h))
    out_w = max(1, int(round(canvas_w * scale)))
    out_h = max(1, int(round(canvas_h * scale)))

    median_h = float(np.median([f.height for f in cropped_frames]))
    if name == "hero-idle":
        hero_idle_median_h = median_h
    body_height_ratio = round(canvas_h / hero_idle_median_h, 3) if (name.startswith("hero-") and hero_idle_median_h) else 1.0

    for index, (frame, com) in enumerate(zip(cropped_frames, coms)):
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        paste_x = int(round(center_x - com))
        paste_y = canvas_h - pad_bottom - frame.height
        canvas.alpha_composite(frame, (paste_x, paste_y))
        if scale < 1.0:
            canvas = canvas.resize((out_w, out_h), Image.Resampling.LANCZOS)
        canvas.save(ANIMATIONS / f"{name}-{index:02d}.webp", "WEBP", quality=91, method=6)
        preview_frames.append((name, index, canvas.copy()))

    metadata[name] = {
        "frames": len(cropped_frames),
        "fps": fps,
        "width": out_w,
        "height": out_h,
        "bodyHeightRatio": body_height_ratio,
    }

(ANIMATIONS / "animations.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

# Contact sheet for animations
preview_width = 180 * 4
row_height = 240
preview_height = row_height * ((len(preview_frames) + 3) // 4)
preview = Image.new("RGBA", (preview_width, preview_height), "#f7eedc")
draw = ImageDraw.Draw(preview)
for index, (name, frame_index, frame) in enumerate(preview_frames):
    x = (index % 4) * 180
    y = (index // 4) * row_height
    frame.thumbnail((170, 205), Image.Resampling.LANCZOS)
    preview.alpha_composite(frame, (x + (180 - frame.width) // 2, y + 22))
    draw.text((x + 8, y + 4), f"{name} {frame_index}", fill="#3b2a1d")
preview.save(QA / "animation-contact-sheet.png")

# 3. Arena backdrops (1 original + 3 new)
arenas = {
    "sunlit-forge-valley": SOURCE / "sunlit-forge-valley-arena_1795484610324_5ad0839a.png",
    "ashen-quarry-arena": SOURCE / "ashen-quarry-arena.jpg",
    "ironbridge-foundry-arena": SOURCE / "ironbridge-foundry-arena.jpg",
    "emberpeak-citadel-arena": SOURCE / "emberpeak-citadel-arena.jpg",
}
for name, path in arenas.items():
    if path.exists():
        arena = Image.open(path).convert("RGB")
        arena.thumbnail((1440, 960), Image.Resampling.LANCZOS)
        arena.save(ART / f"{name}.webp", "WEBP", quality=88, method=6)

# 4. Backpack items (11 original + 4 new + fixed vial)
item_names = [
    "sword", "daggers", "axe", "bow",
    "hammer", "shield", "vial", "whetstone",
    "ember", "frost", "gear",
]
item_atlas = Image.open(SOURCE / "backpack-item-atlas-v1_1795486185392_355c2e8f.png")
cw = item_atlas.width // 4
ch = item_atlas.height // 3
processed_items: list[tuple[str, Image.Image]] = []

for index, name in enumerate(item_names):
    if name == "vial" and (SOURCE / "vial-fixed.jpg").exists():
        item = trim_alpha(chroma_key_magenta(Image.open(SOURCE / "vial-fixed.jpg")))
    else:
        left = (index % 4) * cw
        top = (index // 4) * ch
        item = trim_alpha(chroma_key_green(item_atlas.crop((left, top, left + cw, top + ch))))
    processed_items.append((name, item))

new_items_path = SOURCE / "new-items-atlas.jpg"
if new_items_path.exists():
    new_atlas = Image.open(new_items_path)
    ncw = new_atlas.width // 2
    nch = new_atlas.height // 2
    for index, name in enumerate(["spear", "crossbow", "plate", "bellows"]):
        left = (index % 2) * ncw
        top = (index // 2) * nch
        item = trim_alpha(chroma_key_magenta(new_atlas.crop((left, top, left + ncw, top + nch))))
        processed_items.append((name, item))

item_preview = Image.new("RGBA", (160 * 4, 180 * 4), "#f7eedc")
item_draw = ImageDraw.Draw(item_preview)
for index, (name, item) in enumerate(processed_items):
    item.thumbnail((204, 204), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (224, 224), (0, 0, 0, 0))
    canvas.alpha_composite(item, ((224 - item.width) // 2, (224 - item.height) // 2))
    canvas.save(ITEM_ART / f"{name}.webp", "WEBP", quality=92, method=6)
    thumb = item.copy()
    thumb.thumbnail((142, 142), Image.Resampling.LANCZOS)
    x = (index % 4) * 160
    y = (index // 4) * 180
    item_preview.alpha_composite(thumb, (x + (160 - thumb.width) // 2, y + 10))
    item_draw.text((x + 8, y + 158), name, fill="#3b2a1d")
item_preview.save(QA / "item-contact-sheet.png")

# 5. UI Art Icons (32 icons from 2 atlases on #FF00FF)
ui_atlas_a_names = [
    "sword", "backpack", "anvil", "book",
    "shop", "coin", "ore", "gem",
    "heart", "shield", "trophy", "calendar",
    "settings", "about", "gift", "sparkle",
]
ui_atlas_b_names = [
    "play", "pause", "refresh", "star",
    "share", "sun", "moon", "flame",
    "volume", "volumeOff", "hand", "ad",
    "check", "restore", "menu", "smelt",
]

ui_preview = Image.new("RGBA", (130 * 8, 150 * 4), "#f7eedc")
ui_draw = ImageDraw.Draw(ui_preview)
ui_index = 0
for atlas_path, names in [
    (SOURCE / "ui-icons-atlas-a.jpg", ui_atlas_a_names),
    (SOURCE / "ui-icons-atlas-b.jpg", ui_atlas_b_names),
]:
    if not atlas_path.exists():
        continue
    atlas = Image.open(atlas_path)
    ucw = atlas.width // 4
    uch = atlas.height // 4
    for idx, name in enumerate(names):
        left = (idx % 4) * ucw
        top = (idx // 4) * uch
        icon = trim_alpha(chroma_key_magenta(atlas.crop((left, top, left + ucw, top + uch))))
        icon.thumbnail((116, 116), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        canvas.alpha_composite(icon, ((128 - icon.width) // 2, (128 - icon.height) // 2))
        canvas.save(UI_ART / f"{name}.webp", "WEBP", quality=92, method=6)
        thumb = icon.copy()
        thumb.thumbnail((104, 104), Image.Resampling.LANCZOS)
        px = (ui_index % 8) * 130
        py = (ui_index // 8) * 150
        ui_preview.alpha_composite(thumb, (px + (130 - thumb.width) // 2, py + 8))
        ui_draw.text((px + 8, py + 124), name, fill="#3b2a1d")
        ui_index += 1
ui_preview.save(QA / "ui-icons-contact-sheet.png")

# 6. Brand assets (MechaLegion + F7 Developer official assets)
emblem = Image.open(SOURCE / "mech-legion-emblem-v1_1795486205728_127f3564.png").convert("RGB")
emblem.thumbnail((640, 640), Image.Resampling.LANCZOS)
emblem.save(BRAND / "mech-legion-emblem.webp", "WEBP", quality=91, method=6)

if F7_BRAND_DIR.exists():
    for src_rel, dst_name in [
        (F7_BRAND_DIR / "App-Ready" / "f7_splash_portrait_720x1280_silent.webm", "f7-splash-portrait-silent.webm"),
        (F7_BRAND_DIR / "App-Ready" / "f7_splash_portrait_720x1280_silent.mp4", "f7-splash-portrait-silent.mp4"),
        (F7_BRAND_DIR / "Extras & Source" / "f7_mark.svg", "f7-mark.svg"),
    ]:
        if src_rel.exists():
            shutil.copy2(src_rel, BRAND / dst_name)
    poster_src = F7_BRAND_DIR / "Extras & Source" / "f7_splash_final_frame_portrait_1080x1920.png"
    if poster_src.exists():
        poster = Image.open(poster_src).convert("RGB")
        poster.thumbnail((720, 1280), Image.Resampling.LANCZOS)
        poster.save(BRAND / "f7-splash-poster.webp", "WEBP", quality=88, method=6)

# 7. App & Android icons
icon = Image.open(SOURCE / "backpack-forge-icon_1795484326967_38317a99.png").convert("RGBA")
icon.resize((512, 512), Image.Resampling.LANCZOS).save(ICONS / "icon-512.png", "PNG", optimize=True)
icon.resize((192, 192), Image.Resampling.LANCZOS).save(ICONS / "icon-192.png", "PNG", optimize=True)
icon.resize((48, 48), Image.Resampling.LANCZOS).save(ICONS / "icon-48.png", "PNG", optimize=True)

for density, size, fg_size in [
    ("mdpi", 48, 108),
    ("hdpi", 72, 162),
    ("xhdpi", 96, 216),
    ("xxhdpi", 144, 324),
    ("xxxhdpi", 192, 432),
]:
    resized = icon.resize((size, size), Image.Resampling.LANCZOS)
    rounded = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=size * 0.22, fill=255)
    rounded.paste(resized, (0, 0), mask)
    rounded.save(ICONS / f"launcher-{density}.png", "PNG", optimize=True)

    # Sync directly to Android mipmap-*
    mipmap_dir = ANDROID_RES / f"mipmap-{density}"
    if mipmap_dir.exists():
        rounded.save(mipmap_dir / "ic_launcher.png", "PNG", optimize=True)
        circle = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        cmask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(cmask).ellipse((0, 0, size - 1, size - 1), fill=255)
        circle.paste(resized, (0, 0), cmask)
        circle.save(mipmap_dir / "ic_launcher_round.png", "PNG", optimize=True)

        fg_canvas = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
        safe_dim = int(round(fg_size * 0.68))
        fg_icon = icon.resize((safe_dim, safe_dim), Image.Resampling.LANCZOS)
        fg_canvas.alpha_composite(fg_icon, ((fg_size - safe_dim) // 2, (fg_size - safe_dim) // 2))
        fg_canvas.save(mipmap_dir / "ic_launcher_foreground.png", "PNG", optimize=True)

foreground = icon.resize((432, 432), Image.Resampling.LANCZOS)
foreground.save(ICONS / "adaptive-foreground.png", "PNG", optimize=True)
background = Image.new("RGBA", (432, 432), "#2a170d")
background.save(ICONS / "adaptive-background.png", "PNG", optimize=True)

print(f"Processed {len(processed_items)} items, {ui_index} UI icons, {len(metadata)} animation clips.")
