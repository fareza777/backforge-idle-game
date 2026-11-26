# Backpack Forge store assets

English launch creative for Backpack Forge: Idle Merge RPG.

## Google Play listing

- Upload `icon-512.png` as the listing icon. `icon-1024.png` is the high-resolution master.
- Upload `feature-graphic-1024x500.png` as the feature graphic.
- Upload the eight files in `screenshots/` in filename order. Each is a 1080 × 1920 RGB PNG.
- Use the 1920 × 1080 trailer for a public or unlisted YouTube preview and add its YouTube URL in Play Console. The 1080 × 1920 trailer is formatted for vertical sharing.
- The app UI and gameplay footage come from the local web build at phone dimensions. The knight, Colossus, gear, and arena art inside the screenshot compositions are original project assets. The new backpack icon and cinematic key art are promotional illustrations.

[Google Play preview asset specifications](https://support.google.com/googleplay/android-developer/answer/9866151)

| Image | Suggested English alt text |
| --- | --- |
| 01 | Forge Knight beside the battle screen and tactical backpack. |
| 02 | Two Tier 1 swords merge into a Tier 2 sword in the backpack. |
| 03 | A whetstone boosts the neighboring sword in a backpack with active Set Bonds. |
| 04 | Forge Knight faces the Forge Colossus during an automatic boss battle. |
| 05 | The Forge Codex lists weapons and gear that can be forged through seven tiers. |
| 06 | Valley, quarry, and foundry artwork surround the eight-chapter campaign log. |
| 07 | The Forge Talents screen shows permanent upgrades bought with ore. |
| 08 | The idle reward screen shows earned gold and ore and the twelve-hour cap. |

## Edit and render the trailers

From `video/`, run:

```powershell
npm.cmd ci
npm.cmd run studio
npm.cmd run render:wide
npm.cmd run render:vertical
```

Open the URL printed by Studio. Both 37-second compositions use local assets in `video/public/`, with no project repo required for video rendering. The MP4 presets export H.264 video with AAC audio. The footage is recorded from the game and trimmed around actual interactions. The soundtrack and metal hits were composed for the trailer in `make-score.py`.

To rebuild the stills, place this folder at `store/premium/` inside the original game repo and run `python build-assets.py` with Pillow and NumPy available. The still builder reads the game's sprites and terrain from `public/art/` and uses Windows Georgia and Arial for supporting type. Barlow Condensed is bundled with its license.

## Artwork prompts

Generated with the built-in ImageGen tool.

**Icon.** Square 1:1 premium Google Play store icon for the original game Backpack Forge, a painterly cozy medieval RPG backpack merge game. Single instantly readable silhouette of a handsome rich oxblood and tobacco brown adventurer's backpack, heavy double straps with golden brass buckles, an ivory-gold sword thrust diagonally behind it and a small battered round golden buckler mounted to its lower front right. Icon reads BACKPACK first, sword second. Low camera angle and a 3/4 turn, tactile painted leather, glorious forge-gold rimlight on every contour, hot orange hearth bloom immediately behind the bag, very dark verdigris-black forge around the corners and softly blurred in back. A few ember points, thick solid forms, uncluttered. Center subject with generous 12% safety margin on all sides. Artwork fills square into every corner, no corner rounding or preset app tile treatment. Strong boutique fantasy game item illustration, crisp enough to read at 48px. No text, letters, numbers, border, watermark, extra subjects or interface.

**Key art.** Wide 2:1 store key art for original cozy fantasy videogame Backpack Forge, text will be composited separately. Rich medieval painterly game illustration with carved dark timber forge and ember light. Hand-painted storybook videogame style, warm physical materials, strong silhouettes. Create a single dynamic narrative across image. Far right, a heroic forge knight in bronze and iron full helmet with single gold stripe, maroon cape, round buckler and golden steel short sword, holding his sword up on an exciting diagonal against a towering squat black iron clockwork colossus with brass rivets, glowing amber furnace in the chest and huge square hammer fist. Show silhouettes and action clearly, characters' heads and impact safely inside frame. Bottom center-right fiery ember slash and stone floor, forge courtyard and distant green Alpine fantasy valley glimpse behind. Entire left 48 percent is softly shaded dark forest-green / near-black forge mist with subtle surface grain, almost empty, reserved for very large two-line text. Premium art-directed golden yellow and ember-coral against dark forest teal, no purple. Avoid visually busy detail under text area. No letters, no text, no logos, no game UI, no watermark or frame.
