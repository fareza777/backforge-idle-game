from pathlib import Path
from functools import lru_cache
import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent.parent
ART = PROJECT / "public/art"
W, H = 1080, 1920
PAPER = "#fff0c8"
GOLD = "#ffd178"
MINT = "#aaf3cb"
EMBER = "#ff9b60"
INK = "#102820"
FONT = ROOT / "artwork/BarlowCondensed-Black.ttf"
SERIF = "C:/Windows/Fonts/georgiab.ttf"
BODY = "C:/Windows/Fonts/arialbd.ttf"
RESAMPLE = Image.Resampling.LANCZOS
OUT = ROOT / "screenshots"
MEDIA = ROOT / "video/public"


@lru_cache(maxsize=128)
def load(path):
    return Image.open(path).convert("RGBA")


@lru_cache(maxsize=128)
def font(path, size):
    return ImageFont.truetype(str(path), size)


def cover(im, size, centering=(.5, .5)):
    return ImageOps.fit(im, size, RESAMPLE, centering=centering)


def type_line(im, value, xy, size, color=PAPER, width=None, face=FONT, anchor="lt", shadow=True):
    f = font(face, size)
    if width and f.getlength(value) > width:
        f = font(face, int(size * width / f.getlength(value)))
    x, y = xy
    d = ImageDraw.Draw(im)
    if shadow:
        d.text((x + 3, y + 6), value, fill="#0c1713", font=f, anchor=anchor, stroke_width=2)
    d.text(xy, value, fill=color, font=f, anchor=anchor)


def kicker(im, value, xy, color=GOLD):
    type_line(im, value, xy, 32, color, face=BODY, shadow=False)


def caption(im, value, xy, color=PAPER, width=930, anchor="lt"):
    type_line(im, value, xy, 39, color, width, BODY, anchor)


def gradient(top, bottom, glow, at, seed, size=(W, H)):
    import PIL.ImageColor as colors
    w, h = size
    y, x = np.ogrid[:h, :w]
    a, b, c = (np.array(colors.getrgb(v)) for v in (top, bottom, glow))
    mix = y / max(1, h - 1)
    r = ((x / w - at[0]) / .8) ** 2 + ((y / h - at[1]) / .58) ** 2
    light = np.maximum(0, 1 - r)[:, :, None] ** 2
    grain = np.random.default_rng(seed).normal(0, 1.7, (h, w, 1))
    base = a + mix[:, :, None] * (b - a)
    return Image.fromarray(np.uint8(np.clip(base * (1 - light * .68) + c * light * .68 + grain, 0, 255))).convert("RGBA")


def shade(im, top=0, bottom=0, rgb=(8, 21, 17), stop=.6):
    w, h = im.size
    y = np.arange(h) / max(1, h - 1)
    alpha = top * np.maximum(0, (stop - y) / stop) ** 1.4 + bottom * np.maximum(0, (y - (1-stop)) / stop) ** 1.3
    tint = Image.new("RGBA", (w, h), (*rgb, 0))
    tint.putalpha(Image.fromarray(np.uint8(alpha)).resize((w, h)))
    return Image.alpha_composite(im, tint)


def place(im, src, x, y, width, height=None, angle=0):
    height = round(src.height * width / src.width) if height is None else height
    src = src.resize((width, height), RESAMPLE)
    if angle:
        src = src.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    im.alpha_composite(src, (round(x + (width - src.width) / 2), round(y + (height - src.height) / 2)))


def sprite(im, name, x, y, width, angle=0):
    src = load(ART / (name + ".webp"))
    place(im, src.crop(src.getbbox()), x, y, width, angle=angle)


def shot(name, region=None):
    src = load(ROOT / "captures" / (name + ".png"))
    # Browser tool reserved 15 CSS pixels at the right of these captures.
    src = src.crop((0, 0, round(src.width * 415 / 430), src.height))
    if region:
        src = src.crop(tuple(round(t * dim) for t, dim in zip(region, (src.width, src.height) * 2)))
    return src


def window(im, src, x, y, width, height=None, angle=0, border=GOLD, rounding=27):
    h = round(width * src.height / src.width) if height is None else height
    edge = 6
    canvas = Image.new("RGBA", (width + edge * 2, h + edge * 2))
    ImageDraw.Draw(canvas).rounded_rectangle((0, 0, canvas.width - 1, canvas.height - 1), rounding, fill=border)
    inside = cover(src, (width, h))
    mask = Image.new("L", inside.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, h - 1), rounding - edge // 2, fill=255)
    canvas.paste(inside, (edge, edge), mask)
    padded = Image.new("RGBA", (canvas.width + 104, canvas.height + 104))
    shadow = Image.new("RGBA", padded.size)
    solid = Image.new("RGBA", canvas.size, (3, 8, 5, 200))
    solid.putalpha(canvas.getchannel("A").point(lambda a: a * .78))
    shadow.paste(solid, (52, 67))
    padded.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(23)))
    padded.alpha_composite(canvas, (52, 52))
    place(im, padded, x - 58, y - 58, padded.width, angle=angle)


def marks(im, seed, color=(255, 166, 72), count=100, area=(0, 350, W, 1860)):
    layer = Image.new("RGBA", im.size)
    d = ImageDraw.Draw(layer)
    rng = random.Random(seed)
    for _ in range(count):
        x, y = rng.uniform(area[0], area[2]), rng.uniform(area[1], area[3])
        r = rng.choices((1, 2, 3, 5), (4, 5, 2, 1))[0]
        d.ellipse((x-r, y-r, x+r, y+r), fill=(*color, rng.randrange(54, 205)))
    im.alpha_composite(layer)


def engrave(im, center, radii, color=(251, 210, 137, 64)):
    layer = Image.new("RGBA", im.size)
    d = ImageDraw.Draw(layer)
    cx, cy = center
    for r in radii:
        d.ellipse((cx-r, cy-r, cx+r, cy+r), outline=color, width=2)
    for i in range(48):
        t = math.tau * i / 48
        r = radii[-1]
        d.line((cx+math.cos(t)*(r-12), cy+math.sin(t)*(r-12),
                cx+math.cos(t)*(r+9), cy+math.sin(t)*(r+9)), fill=color, width=2)
    im.alpha_composite(layer)


def terrain(name, size=(W, H), center=(.5, .5)):
    return cover(load(ART / (name + ".webp")), size, center)


def save(im, file):
    im.convert("RGB").save(file, optimize=True)


# The playable merge-and-battle loop. The knight breaks out of the tilted capture.
im = shade(terrain("sunlit-forge-valley", center=(.47, .5)), 255, 253)
im.alpha_composite(Image.new("RGBA", im.size, (10, 26, 18, 74)))
engrave(im, (746, 1038), (345, 375, 416))
marks(im, 1)
window(im, shot("build"), 80, 550, 545, angle=7)
sprite(im, "forge-knight-hero", 459, 662, 681, -4)
kicker(im, "BACKPACK FORGE", (66, 71))
type_line(im, "YOUR BAG.", (58, 138), 202, PAPER, 961)
type_line(im, "YOUR BUILD.", (58, 314), 196, GOLD, 960)
caption(im, "Merge gear. Pack smart. Fight automatically.", (69, 1794))
save(im, OUT / "01-your-bag-your-build.png")

# Two smaller original sword sprites lead into the actual Tier 2 result.
im = gradient("#2b140e", "#170e0b", "#b85325", (.5,.40), 2)
engrave(im, (540, 660), (214, 336, 432))
marks(im, 2, count=155)
type_line(im, "MERGE", (59, 81), 264, PAPER, 963)
type_line(im, "TO FORGE.", (61, 292), 210, EMBER, 956)
for x, angle in [(107, -25), (390, 14)]:
    sprite(im, "items/sword", x, 596, 232, angle)
sprite(im, "items/sword", 721, 522, 301, -8)
type_line(im, "+", (352, 686), 90, PAPER, anchor="mt")
type_line(im, "=", (693, 686), 90, GOLD, anchor="mt")
for x, t in [(212, "TIER 1"), (499, "TIER 1"), (872, "TIER 2")]:
    type_line(im,t,(x,925),43,PAPER,anchor="mt")
window(im, shot("merge", (0,.333,1,.77)), 140, 1010, 800, angle=-3, border=EMBER)
caption(im, "Match two pieces to make stronger gear.", (540, 1835), anchor="mt")
save(im, OUT / "02-merge-to-forge.png")

# Top-down inventory plate and a real adjacency example, with the caption below it.
im = gradient("#102c29", "#081b20", "#347770", (.6,.5), 3)
d = ImageDraw.Draw(im)
for x in range(28, W, 64):
    d.line((x, 0, x, H), fill="#21443e", width=1)
for y in range(28, H, 64):
    d.line((0, y, W, y), fill="#21443e", width=1)
kicker(im, "THE TACTICAL BACKPACK", (59, 79), MINT)
type_line(im, "EVERY SLOT", (56, 138), 180, PAPER, 974)
type_line(im, "COUNTS.", (56, 287), 207, MINT, 974)
window(im, shot("build", (0,.33,1,.754)), 56, 550, 960, border=MINT)
engrave(im, (536, 1635), (155, 228), (163, 242, 207, 70))
sprite(im, "items/whetstone", 176, 1540, 181, -10)
sprite(im, "items/ember", 477, 1501, 122, 10)
sprite(im, "items/frost", 740, 1504, 144, -6)
caption(im, "Boost neighboring gear and unlock Set Bonds.", (540, 1784), anchor="mt")
save(im, OUT / "03-every-slot-counts.png")

# Full-bleed boss matchup with an untouched fight capture in the lower third.
im = shade(terrain("emberpeak-citadel-arena", center=(.52,.5)), 254, 247, (24, 12, 7))
im.alpha_composite(Image.new("RGBA", im.size, (34, 11, 3, 76)))
marks(im, 4, count=150)
sprite(im, "forge-colossus-boss", 263, 422, 825, 0)
sprite(im, "forge-knight-hero", 35, 784, 400, 6)
type_line(im, "CRUSH", (58, 72), 222, PAPER, 964)
type_line(im, "THE COLOSSUS.", (57, 260), 166, EMBER, 975)
window(im, shot("boss", (0,0,1,.333)), 96, 1118, 885, angle=4, border=EMBER)
caption(im, "Your knight fights. You build the loadout.", (540, 1830), anchor="mt")
save(im, OUT / "04-crush-the-colossus.png")

# Armory spread: huge numeral, real Codex and a foreground collection of weapons.
im = gradient("#e9c591", "#ce9760", "#ffe6b2", (.38,.37), 5)
engrave(im, (250, 1050), (319, 382, 423), (62, 34, 17, 47))
type_line(im, "GEAR UP", (61, 73), 220, "#282118", 965, shadow=False)
type_line(im, "YOUR WAY.", (62, 258), 196, "#83351f", 959, shadow=False)
window(im, shot("gear"), 503, 525, 489, angle=-5, border="#593a25")
type_line(im, "15", (50, 511), 387, "#2f251a", shadow=False)
kicker(im, "GEAR TYPES", (76, 852), "#5c321e")
sprite(im, "items/axe", 55, 958, 322, -16)
sprite(im, "items/crossbow", 173, 1200, 300, -14)
sprite(im, "items/shield", 28, 1453, 290, 10)
ImageDraw.Draw(im).line((62, 1735, 1018, 1735), fill="#664323", width=3)
type_line(im, "7 TIERS TO FORGE", (62, 1775), 91, "#292119", 959, shadow=False)
save(im, OUT / "05-gear-up-your-way.png")

# Expedition cover: three illustrated locations form the backdrop for the chapter log.
im = gradient("#152b2a", "#0b1c18", "#3a5752", (.49,.66), 6)
type_line(im, "FOLLOW", (59, 76), 188, PAPER, 960)
type_line(im, "THE FIRE.", (56, 230), 210, GOLD, 970)
for name, x, y, width, ang in [
    ("sunlit-forge-valley", -40, 521, 689, 10),
    ("ashen-quarry-arena", 292, 795, 820, -9),
    ("ironbridge-foundry-arena", -35, 1160, 754, 8),
]:
    window(im, terrain(name,(850,510)), x, y, width, angle=ang, border="#d1a771", rounding=16)
window(im, shot("chronicle", (0,0,1,.93)), 572, 667, 457, angle=-6, border=GOLD)
marks(im, 6, count=65)
kicker(im, "FROM SUNLIT VALLEY TO EMBERPEAK", (67, 1718))
type_line(im, "8 STORY CHAPTERS", (64, 1775), 101, PAPER, 945)
save(im, OUT / "06-follow-the-fire.png")

# A smithing dossier with an offset real talents panel and a forge-mark emblem.
im = gradient("#111a20", "#121e1e", "#51462c", (.67,.49), 7)
engrave(im, (775, 1000), (293, 372, 450))
marks(im, 7)
window(im, shot("talents"), 63, 132, 567, angle=6, border="#b79468")
sprite(im, "ui/anvil", 621, 262, 328, -9)
sprite(im, "items/hammer", 652, 663, 328, 16)
type_line(im, "FORGE", (56, 1471), 198, PAPER, 968)
type_line(im, "YOUR FUTURE.", (56, 1637), 150, GOLD, 970)
caption(im, "Spend ore on permanent upgrades.", (65, 1828))
save(im, OUT / "07-forge-your-future.png")

# Night watch: dark virtual arena behind an authentic idle reward readout.
im = shade(terrain("ironbridge-foundry-arena", center=(.49,.5)), 252, 239, (6,19,26))
im.alpha_composite(Image.new("RGBA", im.size, (10, 29, 43, 106)))
engrave(im, (540, 1010), (324, 371, 433), (157, 225, 229, 67))
marks(im, 8, (173, 234, 230), 110)
type_line(im, "THE FORGE", (60, 80), 183, PAPER, 958)
type_line(im, "STAYS LIT.", (57, 239), 201, MINT, 963)
sprite(im, "ui/anvil", 410, 491, 265, 0)
window(im, shot("offline", (.025,.222,.975,.650)), 130, 750, 820, border=MINT)
type_line(im, "UP TO 12 HOURS", (540, 1638), 101, GOLD, 952, anchor="mt")
caption(im, "Return to claim gold and ore.", (540, 1776), anchor="mt")
save(im, OUT / "08-the-forge-stays-lit.png")

# Icon (Google Play RGBA with no corner mask) and banner.
icon = load(ROOT / "artwork/backpack.png")
for size in (512, 1024):
    cover(icon, (size, size)).save(ROOT / f"icon-{size}.png", optimize=True)
hero = load(ROOT / "artwork/forge-clash.png")
feature = cover(hero, (1024, 500))
type_line(feature, "BACKPACK", (53, 124), 98, PAPER, 446, SERIF)
type_line(feature, "FORGE", (48, 205), 129, GOLD, 426, SERIF)
type_line(feature, "IDLE MERGE RPG", (58, 324), 40, PAPER, 415)
save(feature, ROOT / "feature-graphic-1024x500.png")

preview = Image.new("RGB", (1406, 1248), "#18201b")
for i, file in enumerate(sorted(OUT.glob("*.png"))):
    x, y = 23 + (i % 4) * 345, 20 + (i // 4) * 614
    preview.paste(cover(load(file), (324,576)).convert("RGB"), (x,y))
preview.save(ROOT / "preview-screenshots.jpg", quality=93, subsampling=0)

# Compact motion assets for the editable trailer.
save(cover(hero, (1774,887)), MEDIA / "key-art.jpg")
save(cover(icon, (880,880)), MEDIA / "pack.jpg")
for name in ("sunlit-forge-valley","emberpeak-citadel-arena","ironbridge-foundry-arena"):
    save(terrain(name, (1280,720)), MEDIA / f"{name}.jpg")
for name in ("forge-knight-hero","forge-colossus-boss","items/sword","items/axe","items/whetstone","items/ember"):
    asset = load(ART / (name + ".webp"))
    asset.crop(asset.getbbox()).save(MEDIA / (name.split("/")[-1] + ".webp"), quality=91)
for name in ("merge","build","gear","talents","chronicle","offline","boss"):
    save(shot(name), MEDIA / (name + ".jpg"))



