# Backpack Forge: Idle Merge RPG (BackForge Idle)

A one-handed, cozy fantasy-craft backpack merge & auto-battler RPG built with React, TypeScript, Vite, HTML5 Canvas, and Capacitor for Android.

**MechaLegion × F7 Developer**

---

## Features

- **15 Craftable Gear Pieces & 7 Tiers**: Swords, Twin Daggers, Heavy Axes, Longbows, War Hammers, Forge Halberds (cleave), Repeating Crossbows, Buckler Shields, Riveted Cuirasses, Herbal Vials, plus 5 orthogonal Boosters (Whetstone, Ember Core, Frost Crystal, Gear Mechanism, Brass Bellows).
- **Tactical Backpack & Set Bonds**: Drag-and-drop merging, orthogonal booster synergies, 5 category Set Bonds (*Vanguard Wall*, *Blademaster Flurry*, *Marksman Volley*, *Siege Breaker*, *Field Apothecary*), live stat inspector, item **Smelting**, and **Direct-Merge** from the Forge Shop.
- **8-Chapter Story Campaign & Endless Masterwork**: *Prologue: The Quiet Anvil* plus 8 chapters across 4 illustrated biome arenas (*Sunlit Forge Valley*, *Ashen Quarry*, *Ironbridge Foundry*, *Emberpeak Citadel*), with **Masterwork Ascension** (Forge Marks) unlocking at Stage 5.
- **7 Animated Foes & Bosses**: *Ironbound Boar*, *Rust Scout*, *Cinder Sentinel*, *Brass Stalker*, *Forge Colossus*, *Obsidian Warden*, and *Molten Dreadnought* — with smooth sprite/motion animations, attack telegraphs, knockback, hit-stop, critical strikes, and **Anvil Strike Overdrive**.
- **Complete RPG Progression**: 6 permanent Forge Talents, cycling Valley Bounties, 16 Achievements, 7-Day Daily Watch, 12-hour Offline Progression, transparent Gem Forge Exchange (zero lootboxes/gacha), dual-keyed LocalStorage save with JSON export/import, and Light/Dark/Warm themes.
- **Audio**: Procedural forge & combat SFX plus optional workshop/nature ambience (zero instrumental music).
- **Android & F7 Developer Standard**: Sequential **MechaLegion → F7 Developer** dual splash screen, `@capacitor-community/safe-area` layout & AdMob banner margin compliance, UMP consent, Banner/Interstitial/Rewarded AdMob integration, and **USD $4.99 Remove Ads** IAP with Restore Purchase.

---

## Development & Build

```bash
# Install dependencies
npm install

# Run unit tests (Vitest)
npm run test

# Type-check and build web bundle
npm run build

# Sync web assets & plugins to Android
npx cap sync android

# Build Android Debug APK / Release AAB (requires JDK 21 & Android SDK)
cd android
./gradlew assembleDebug bundleRelease
```

> **Windows PowerShell note:** Use `npm.cmd` / `npx.cmd` if PowerShell script execution policy blocks `npm.ps1`.
