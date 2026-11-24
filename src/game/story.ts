import type { EnemyKind } from './types';

export interface ChapterStory {
  chapterNumber: number;
  roman: string;
  title: string;
  subtitle: string;
  arena: string;
  bossKind: Extract<EnemyKind, 'boss' | 'warden' | 'dreadnought'>;
  bossTitle: string;
  regularPool: Extract<EnemyKind, 'boar' | 'scout' | 'golem' | 'hound'>[];
  introQuote: string;
  bossIntro: string;
  chronicleEntry: string;
}

export interface BestiaryEntry {
  kind: EnemyKind;
  name: string;
  role: string;
  portrait: string;
  isBoss: boolean;
  description: string;
  tacticTip: string;
}

export const PROLOGUE_STORY = {
  eyebrow: 'Prologue · Hearthstone Valley',
  title: 'The Quiet Anvil',
  paragraphs: [
    'For three winters, the great waterwheels of Hearthstone Valley stood still. Without smiths to tend the mountain roads, old brass-forged sentinels and iron-plated beasts wandered down from the high quarries, blocking every caravan between the valley and Emberpeak.',
    'One stubborn Forge Knight remains at the gate, and your grandfather’s leather pack still holds the last tempered steel. Merge matching gear, arrange boosters beside your blades, and wake the valley’s anvils one honest wave at a time.',
  ],
};

export const CHAPTERS: ChapterStory[] = [
  {
    chapterNumber: 1,
    roman: 'I',
    title: 'Sunlit Forge Valley',
    subtitle: 'The Meadow Road',
    arena: '/art/sunlit-forge-valley.webp',
    bossKind: 'boss',
    bossTitle: 'Forge Colossus',
    regularPool: ['boar', 'scout'],
    introQuote: 'Caravan lanterns are dark along the river road. Clear the meadow gate and relight the first hearth.',
    bossIntro: 'The Forge Colossus steps onto the bridge—solid brass plates, twin furnace vents, and an anvil-sized hammer.',
    chronicleEntry:
      'With the Forge Colossus felled at the river bridge, the valley smithy drew its first steady breath in years. Merchants rolled their carts back down to the square, bringing fresh ore from the foothills.',
  },
  {
    chapterNumber: 2,
    roman: 'II',
    title: 'Ashen Quarry',
    subtitle: 'Terraced Iron Seams',
    arena: '/art/ashen-quarry-arena.webp',
    bossKind: 'warden',
    bossTitle: 'Obsidian Warden',
    regularPool: ['boar', 'scout', 'golem'],
    introQuote: 'Beyond the meadow, terraced iron cliffs echo with heavy footsteps. Stone sentinels guard the mine archway.',
    bossIntro: 'The Obsidian Warden plants its riveted tower shield in the quarry dust and ignites its furnace halberd.',
    chronicleEntry:
      'Breaking through the Ashen Quarry reopened the deep iron seams. Miners salvaged crates of clean basalt and raw ore, letting your knight carry heavier armor into the mountain pass.',
  },
  {
    chapterNumber: 3,
    roman: 'III',
    title: 'Ironbridge Foundry',
    subtitle: 'The Viaduct Aqueduct',
    arena: '/art/ironbridge-foundry-arena.webp',
    bossKind: 'dreadnought',
    bossTitle: 'Molten Dreadnought',
    regularPool: ['scout', 'hound', 'golem'],
    introQuote: 'Steam rises from the great stone viaduct. Swift clockwork hounds patrol the bridge deck ahead.',
    bossIntro: 'Twin chimneys roar as the Molten Dreadnought lumbers across the cobblestones, hoisting its anvil-gauntlets.',
    chronicleEntry:
      'Once the Molten Dreadnought’s boilers cooled, the Ironbridge waterwheels turned freely again. Clean water and steady bellows air doubled the valley’s daily output.',
  },
  {
    chapterNumber: 4,
    roman: 'IV',
    title: 'Emberpeak Citadel',
    subtitle: 'High Terrace Braziers',
    arena: '/art/emberpeak-citadel-arena.webp',
    bossKind: 'warden',
    bossTitle: 'Citadel Warden',
    regularPool: ['boar', 'hound', 'golem'],
    introQuote: 'Golden light crowns the mountain fortress. Only seasoned steel and smart pack placement endure here.',
    bossIntro: 'At the summit terrace, the Citadel Warden lowers its visor—unyielding plate and sweeping halberd arcs.',
    chronicleEntry:
      'Lighting the four summit braziers of Emberpeak signaled peace across every mountain pass. Yet deeper mechanical vaults still hum beneath the snowline.',
  },
  {
    chapterNumber: 5,
    roman: 'V',
    title: 'Rekindled Valley',
    subtitle: 'Masterwork Proving Grounds',
    arena: '/art/sunlit-forge-valley.webp',
    bossKind: 'boss',
    bossTitle: 'Forge Colossus Prime',
    regularPool: ['hound', 'scout', 'golem'],
    introQuote: 'Reinforced clockwork patrols test the valley’s new defenses. Masterwork Ascension unlocks here.',
    bossIntro: 'A newly tempered Forge Colossus Prime marches across the meadow—heavier, faster, and armored in gilded brass.',
    chronicleEntry:
      'The valley’s proving grounds proved your craft beyond doubt. Smiths from distant ridges now seek your Forge Marks to temper their own blades.',
  },
  {
    chapterNumber: 6,
    roman: 'VI',
    title: 'Deep Ashen Seams',
    subtitle: 'Lower Quarry Vaults',
    arena: '/art/ashen-quarry-arena.webp',
    bossKind: 'warden',
    bossTitle: 'Obsidian Warden Prime',
    regularPool: ['boar', 'hound', 'golem'],
    introQuote: 'In the lower canyon, quarry machines run at full pressure. Keep Frost and Ember close to your main blades.',
    bossIntro: 'Obsidian Warden Prime locks shields with booming precision—only sustained strikes or Anvil Overdrive can stagger it.',
    chronicleEntry:
      'Even the deepest quarry vaults yielded their finest ingots. Every strike of your knight’s hammer now carries the weight of six chapters.',
  },
  {
    chapterNumber: 7,
    roman: 'VII',
    title: 'The Great Aqueduct',
    subtitle: 'High Pressure Span',
    arena: '/art/ironbridge-foundry-arena.webp',
    bossKind: 'dreadnought',
    bossTitle: 'Molten Dreadnought Prime',
    regularPool: ['scout', 'hound', 'golem'],
    introQuote: 'Across the upper aqueduct, rapid clockwork packs close the distance in heartbeats.',
    bossIntro: 'Molten Dreadnought Prime vents white-hot steam across the stone span—brace your shields and unleash Overdrive!',
    chronicleEntry:
      'With the Great Aqueduct secured, every foundry from the river to the high ridges beats in steady, peaceful rhythm.',
  },
  {
    chapterNumber: 8,
    roman: 'VIII',
    title: 'Crown of Steel',
    subtitle: 'Summit of the Grand Forge',
    arena: '/art/emberpeak-citadel-arena.webp',
    bossKind: 'dreadnought',
    bossTitle: 'Sovereign Dreadnought',
    regularPool: ['boar', 'scout', 'hound', 'golem'],
    introQuote: 'The highest courtyard awaits. Every forged bond, talent, and timing choice converges on the Crown of Steel.',
    bossIntro: 'The Sovereign Dreadnought—pinnacle of the old foundry—steps forward to test the finest pack in the realm.',
    chronicleEntry:
      'At the Crown of Steel, the Grand Forge roared back to life. Your name stands beside the master smiths of Hearthstone Valley, and endless Masterwork trials await beyond.',
  },
];

export function chapterForStage(stage: number): ChapterStory {
  const safeStage = Math.max(1, Math.floor(stage));
  if (safeStage <= CHAPTERS.length) return CHAPTERS[safeStage - 1];
  const base = CHAPTERS[(safeStage - 1) % CHAPTERS.length];
  const cycle = Math.floor((safeStage - 1) / CHAPTERS.length) + 1;
  return {
    ...base,
    chapterNumber: safeStage,
    roman: `S${safeStage}`,
    title: `${base.title} · Trial ${cycle}`,
    subtitle: 'Endless Masterwork Frontier',
    bossTitle: `${base.bossTitle} Mk.${cycle}`,
  };
}

export const ENEMY_BESTIARY: BestiaryEntry[] = [
  {
    kind: 'boar',
    name: 'Ironbound Boar',
    role: 'Armored Charger',
    portrait: '/art/ironbound-boar.webp',
    isBoss: false,
    description: 'A thick-hided mountain boar fitted with riveted brass shoulder plates. Charges swiftly down the road.',
    tacticTip: 'Frost Crystals slow its charge, giving ranged bows and crossbows extra volleys.',
  },
  {
    kind: 'scout',
    name: 'Rust Scout',
    role: 'Clockwork Skirmisher',
    portrait: '/art/rust-scout.webp',
    isBoss: false,
    description: 'A nimble brass automaton wound by old quarry springs, swinging a heavy maintenance wrench.',
    tacticTip: 'Fast Twin Daggers and Repeating Crossbows cut scouts down before they chain hits.',
  },
  {
    kind: 'golem',
    name: 'Cinder Sentinel',
    role: 'Basalt Heavy',
    portrait: '/art/cinder-sentinel.webp',
    isBoss: false,
    description: 'A faceted stone-and-iron construct powered by an internal coal grate. Slow to march, hard to crack.',
    tacticTip: 'Ember Cores burn steadily through its thick basalt hide while War Hammers stun its wind-up.',
  },
  {
    kind: 'hound',
    name: 'Brass Stalker',
    role: 'Piston Interceptor',
    portrait: '/art/brass-stalker.webp',
    isBoss: false,
    description: 'A sleek mechanical hound built with piston legs and brass ribs to close distance in seconds.',
    tacticTip: 'Buckler Shields and Riveted Cuirasses blunt its rapid pounce; Forge Halberd cleaves packs.',
  },
  {
    kind: 'boss',
    name: 'Forge Colossus',
    role: 'Valley Boss',
    portrait: '/art/forge-colossus-boss.webp',
    isBoss: true,
    description: 'A towering steam-driven guardian wielding a massive forge maul. Protects the main valley approaches.',
    tacticTip: 'Save Anvil Strike Overdrive to interrupt its slam and stack Burn + Whetstone boosts.',
  },
  {
    kind: 'warden',
    name: 'Obsidian Warden',
    role: 'Quarry & Citadel Boss',
    portrait: '/art/obsidian-warden.webp',
    isBoss: true,
    description: 'An armored bastion carrying a riveted tower shield and a white-hot furnace halberd.',
    tacticTip: 'High Armor and Herbal Vials sustain your knight through its sweeping halberd cleaves.',
  },
  {
    kind: 'dreadnought',
    name: 'Molten Dreadnought',
    role: 'Foundry Juggernaut Boss',
    portrait: '/art/molten-dreadnought.webp',
    isBoss: true,
    description: 'The heaviest foundry juggernaut ever assembled, venting steam from twin chimneys before crushing slams.',
    tacticTip: 'Combine Siege Breaker or Blademaster bonds with Bellows Crit boosts to melt its massive HP.',
  },
];
