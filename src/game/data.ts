import type {
  ActiveSynergyBond,
  BountyProgress,
  GameState,
  HeroLoadout,
  Item,
  ItemDefinition,
  ItemKind,
  SynergyLink,
  Talents,
  WeaponLoadout,
} from './types';

export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Masterwork'] as const;
export const RARITY_COLORS = ['#9a8976', '#4b9b62', '#438ac4', '#9562ca', '#d7952f', '#e05267', '#f0b83d'] as const;
export const MAX_TIER = 7;
export const STAGE_WAVES = 10;
export const BASE_COLUMNS = 4;
export const BASE_ROWS = 3;

export const ITEM_DEFS: Record<ItemKind, ItemDefinition> = {
  sword: {
    name: 'Iron Sword',
    shortName: 'Sword',
    category: 'weapon',
    description: 'A wanderer’s first blade: clean cuts, quick recovery, and a temper that holds through the longest watch.',
    baseDamage: 13,
    cooldown: 1.05,
    range: 112,
    accent: '#b9c8d4',
  },
  daggers: {
    name: 'Twin Daggers',
    shortName: 'Daggers',
    category: 'weapon',
    description: 'Twin edges made for close duels. A flurry of small cuts can undo a much larger foe.',
    baseDamage: 7,
    cooldown: 0.46,
    range: 92,
    accent: '#d7e3e8',
  },
  axe: {
    name: 'Heavy Axe',
    shortName: 'Axe',
    category: 'weapon',
    description: 'One deliberate swing, one terrible wound. Slow to raise, impossible to shrug off.',
    baseDamage: 22,
    cooldown: 1.62,
    range: 108,
    accent: '#b6c0c6',
  },
  bow: {
    name: 'Longbow',
    shortName: 'Bow',
    category: 'weapon',
    description: 'Amber wood, taut string, and a steady hand. Lets your knight strike before the valley strikes back.',
    baseDamage: 10,
    cooldown: 0.86,
    range: 330,
    accent: '#c99a61',
  },
  hammer: {
    name: 'War Hammer',
    shortName: 'Hammer',
    category: 'weapon',
    description: 'A forge-made answer to plated horrors. Each landing can rattle an enemy out of its next attack.',
    baseDamage: 28,
    cooldown: 1.92,
    range: 118,
    accent: '#b5aaa0',
  },
  spear: {
    name: 'Forge Halberd',
    shortName: 'Halberd',
    category: 'weapon',
    description: 'A long-hafted poleaxe forged for crowded roads. Sweeps cleanly through up to two foes at once.',
    baseDamage: 17,
    cooldown: 1.28,
    range: 142,
    cleave: 2,
    accent: '#9eb2c2',
  },
  crossbow: {
    name: 'Repeating Crossbow',
    shortName: 'Crossbow',
    category: 'weapon',
    description: 'Walnut stock and brass repeater gears. Fires crisp steel bolts with natural critical precision.',
    baseDamage: 12,
    cooldown: 0.72,
    range: 345,
    accent: '#b98952',
  },
  shield: {
    name: 'Buckler Shield',
    shortName: 'Shield',
    category: 'defense',
    description: 'A compact rim of stubborn steel. Every hit lands softer behind its brass-studded face.',
    baseArmor: 4,
    accent: '#b99a64',
  },
  plate: {
    name: 'Riveted Cuirass',
    shortName: 'Cuirass',
    category: 'defense',
    description: 'Hammered steel chest plate strapped with oak-tanned leather. Adds both Armor and sturdy Max HP.',
    baseArmor: 3,
    baseHp: 24,
    accent: '#9ba6b0',
  },
  vial: {
    name: 'Herbal Vial',
    shortName: 'Vial',
    category: 'support',
    description: 'Valley herbs, sealed while the dew is still on them. Mends the knight a little at a time.',
    baseHeal: 2.4,
    accent: '#69a66e',
  },
  whetstone: {
    name: 'Whetstone',
    shortName: 'Whetstone',
    category: 'booster',
    description: 'Set beside a blade, its worn edge lends a keen one. Orthogonal neighbors gain +20% Attack per tier.',
    accent: '#8d9aa3',
  },
  ember: {
    name: 'Ember Core',
    shortName: 'Ember',
    category: 'booster',
    description: 'A coal that never quite goes out. Neighboring hits leave a Burn that keeps eating at armor and hide.',
    accent: '#d16c3b',
  },
  frost: {
    name: 'Frost Crystal',
    shortName: 'Frost',
    category: 'booster',
    description: 'Cold enough to still a swinging weapon. Nearby hits slow both enemy footsteps and attacks.',
    accent: '#65a8bf',
  },
  gear: {
    name: 'Gear Mechanism',
    shortName: 'Gear',
    category: 'booster',
    description: 'Tiny brass teeth keep a weapon eager for the next strike. Orthogonal neighbors gain +12% attack speed per tier.',
    accent: '#b69555',
  },
  bellows: {
    name: 'Brass Bellows',
    shortName: 'Bellows',
    category: 'booster',
    description: 'Stokes the hearth beside your blades. Orthogonal weapons gain +8% Crit Chance per tier and faster Overdrive.',
    accent: '#d07d3a',
  },
};

export const SHOP_POOL: ItemKind[] = [
  'sword',
  'daggers',
  'axe',
  'bow',
  'hammer',
  'spear',
  'crossbow',
  'shield',
  'plate',
  'vial',
  'whetstone',
  'ember',
  'frost',
  'gear',
  'bellows',
];

export const TALENT_INFO: Record<keyof Talents, { name: string; description: string; max: number }> = {
  attack: { name: 'Forge Strength', description: 'Temper every blade you carry. +6% weapon damage per level.', max: 50 },
  health: { name: 'Knight Training', description: 'Teach your knight to endure the next blow. +10% maximum HP per level.', max: 50 },
  gold: { name: 'Merchant Contacts', description: 'Know which caravans pay fairly. +2 Gold from every wave per level.', max: 30 },
  slots: { name: 'Backpack Expansion', description: 'Unlock the next backpack row and column.', max: 3 },
  crit: { name: 'Tempered Edge', description: 'Sharpen critical strikes. +2.5% Crit Chance and +8% Crit Damage per level.', max: 20 },
  overdrive: { name: 'Hearth Resonance', description: 'Charge Anvil Strike faster and hit harder. +12% Overdrive power per level.', max: 20 },
};

export const ACHIEVEMENTS = [
  { id: 'first-merge', name: 'Better Together', description: 'Merge your first item.', gems: 5 },
  { id: 'first-wave', name: 'First Watch', description: 'Complete your first wave.', gems: 3 },
  { id: 'boss-one', name: 'Forge Warden', description: 'Defeat the first Boss.', gems: 10 },
  { id: 'stage-two', name: 'Seasoned Smith', description: 'Reach Stage 2.', gems: 10 },
  { id: 'rare-gear', name: 'Rare Craft', description: 'Create a Tier 3 item.', gems: 8 },
  { id: 'epic-gear', name: 'Masterwork', description: 'Create a Tier 4 item.', gems: 15 },
  { id: 'merge-twenty', name: 'Assembly Line', description: 'Complete 20 merges.', gems: 12 },
  { id: 'stage-five', name: 'Legend of the Forge', description: 'Reach Stage 5.', gems: 30 },
  { id: 'legendary-gear', name: 'Gilded Smithing', description: 'Forge a Tier 5 Legendary item.', gems: 20 },
  { id: 'stage-four', name: 'Summit Brazier', description: 'Reach Stage 4 (Emberpeak Citadel).', gems: 18 },
  { id: 'stage-eight', name: 'Crown of Steel', description: 'Reach Stage 8.', gems: 45 },
  { id: 'enemy-hundred', name: 'Roadkeeper', description: 'Defeat 100 valley foes.', gems: 14 },
  { id: 'overdrive-ten', name: 'Anvil Tempest', description: 'Unleash Anvil Strike 10 times.', gems: 12 },
  { id: 'bounty-five', name: 'Guild Regular', description: 'Claim 5 Forge Bounties.', gems: 15 },
  { id: 'smelt-five', name: 'Clean Crucible', description: 'Smelt 5 unneeded items into Ore.', gems: 10 },
  { id: 'first-ascension', name: 'Masterwork Reforge', description: 'Complete your first Masterwork Ascension.', gems: 50 },
] as const;

export const GEM_SHOP_OFFERS = [
  {
    id: 'ore-pack' as const,
    name: 'Iron Ore Ingots',
    description: 'A hefty crate of smelted Ore for permanent Forge Talents.',
    gems: 15,
    rewardText: '+35 Ore',
  },
  {
    id: 'gold-vault' as const,
    name: 'Caravan Gold Vault',
    description: 'Immediate Gold scaled to your current chapter for Shop merges.',
    gems: 12,
    rewardText: 'Gold Cache',
  },
  {
    id: 'temper-gear' as const,
    name: 'Tier 3 Rare Blade',
    description: 'Places a guaranteed Tier 3 Iron Sword or Halberd directly into your pack.',
    gems: 25,
    rewardText: 'Guaranteed T3 Weapon',
  },
] as const;

export function scaleForTier(tier: number): number {
  return Math.pow(2.2, Math.max(0, tier - 1));
}

export function inventoryCapacity(talents: Talents, tempExtraSlot = false): number {
  const base = BASE_COLUMNS * BASE_ROWS;
  const expansion = [0, 4, 8, 13][Math.min(3, Math.max(0, talents.slots))] ?? 0;
  return base + expansion + (tempExtraSlot ? 1 : 0);
}

export function backpackDimensions(talents: Talents, tempExtraSlot = false): { columns: number; rows: number } {
  const columns = talents.slots >= 2 ? 5 : 4;
  return { columns, rows: Math.ceil(inventoryCapacity(talents, tempExtraSlot) / columns) };
}

export function orthogonalNeighbors(index: number, columns: number, capacity: number): number[] {
  const row = Math.floor(index / columns);
  const col = index % columns;
  const result: number[] = [];
  if (col > 0) result.push(index - 1);
  if (col < columns - 1 && index + 1 < capacity) result.push(index + 1);
  if (row > 0) result.push(index - columns);
  if (index + columns < capacity) result.push(index + columns);
  return result;
}

export function calculateLoadout(inventory: (Item | null)[], talents: Talents, forgeMarks = 0): HeroLoadout {
  const weapons: WeaponLoadout[] = [];
  let armor = 0;
  let bonusHp = 0;
  let healPerSecond = 0;
  let attackMultiplier = 1;
  let bellowsCritTotal = 0;
  let bellowsCount = 0;
  const columns = talents.slots >= 2 ? 5 : 4;
  const synergyLinks: SynergyLink[] = [];
  const boostersByWeapon = new Map<
    number,
    { attack: number; burn: number; slow: number; haste: number; crit: number; labels: string[] }
  >();

  // Evaluate Set Bonds from backpack composition
  const counts = new Map<ItemKind, number>();
  inventory.forEach((item) => {
    if (!item) return;
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  });
  const totalWeapons = (counts.get('sword') ?? 0)
    + (counts.get('daggers') ?? 0)
    + (counts.get('axe') ?? 0)
    + (counts.get('bow') ?? 0)
    + (counts.get('hammer') ?? 0)
    + (counts.get('spear') ?? 0)
    + (counts.get('crossbow') ?? 0);
  const totalDefense = (counts.get('shield') ?? 0) + (counts.get('plate') ?? 0);
  const hasRangedPair = (counts.get('bow') ?? 0) + (counts.get('crossbow') ?? 0) >= 2;
  const hasQuickBlades = (counts.get('sword') ?? 0) + (counts.get('daggers') ?? 0) >= 2;
  const hasHeavySmash = (counts.get('axe') ?? 0) + (counts.get('hammer') ?? 0) + (counts.get('spear') ?? 0) >= 2;
  const vanguardActive = totalDefense >= 2;
  const herbalTemperActive = (counts.get('vial') ?? 0) >= 1 && totalDefense >= 1;

  const bonds: ActiveSynergyBond[] = [
    { id: 'vanguard', name: 'Vanguard Wall', bonusText: '2+ Defense: +15% Armor & Thorns', active: vanguardActive },
    { id: 'blademaster', name: 'Blademaster Flurry', bonusText: '2+ Swords/Daggers: +12% Attack Speed', active: hasQuickBlades },
    { id: 'marksman', name: 'Marksman Volley', bonusText: '2+ Bows/Crossbows: +10% Crit', active: hasRangedPair },
    { id: 'siege', name: 'Siege Breaker', bonusText: '2+ Heavy/Halberd: +14% ATK', active: hasHeavySmash },
    { id: 'herbal', name: 'Field Apothecary', bonusText: 'Vial + Defense: +25% Healing', active: herbalTemperActive },
  ];

  inventory.forEach((item, index) => {
    if (!item || ITEM_DEFS[item.kind].category !== 'booster') return;
    if (item.kind === 'bellows') bellowsCount += item.tier;
    for (const neighbor of orthogonalNeighbors(index, columns, inventory.length)) {
      const target = inventory[neighbor];
      if (!target || ITEM_DEFS[target.kind].category !== 'weapon') continue;
      synergyLinks.push({ from: index, to: neighbor, kind: item.kind });
      const current = boostersByWeapon.get(neighbor) ?? {
        attack: 0,
        burn: 0,
        slow: 0,
        haste: 0,
        crit: 0,
        labels: [],
      };
      if (item.kind === 'whetstone') {
        current.attack += 0.2 * item.tier;
        current.labels.push(`+${20 * item.tier}% ATK`);
      }
      if (item.kind === 'ember') {
        current.burn += 0.09 * item.tier;
        current.labels.push(`Burn T${item.tier}`);
      }
      if (item.kind === 'frost') {
        current.slow += 0.12 * item.tier;
        current.labels.push(`Frost ${Math.min(62, 12 * item.tier)}%`);
      }
      if (item.kind === 'gear') {
        current.haste += 0.12 * item.tier;
        current.labels.push(`+${12 * item.tier}% SPD`);
      }
      if (item.kind === 'bellows') {
        current.crit += 0.08 * item.tier;
        current.labels.push(`+${8 * item.tier}% CRIT`);
      }
      boostersByWeapon.set(neighbor, current);
    }
  });

  const markMultiplier = 1 + forgeMarks * 0.15;
  const bondAtkBonus = hasHeavySmash ? 0.14 : 0;
  const bondHasteBonus = hasQuickBlades ? 0.12 : 0;

  inventory.forEach((item, index) => {
    if (!item) return;
    const def = ITEM_DEFS[item.kind];
    const tierScale = scaleForTier(item.tier);
    if (def.category === 'defense') {
      armor += (def.baseArmor ?? 0) * tierScale;
      bonusHp += (def.baseHp ?? 0) * tierScale;
    }
    if (def.category === 'support') healPerSecond += (def.baseHeal ?? 0) * tierScale;
    if (def.category !== 'weapon') return;
    const buffs = boostersByWeapon.get(index);
    attackMultiplier += buffs?.attack ?? 0;
    bellowsCritTotal += buffs?.crit ?? 0;
    weapons.push({
      item,
      slotIndex: index,
      damage:
        (def.baseDamage ?? 1)
        * tierScale
        * (1 + talents.attack * 0.06)
        * (1 + (buffs?.attack ?? 0) + bondAtkBonus)
        * markMultiplier,
      cooldown: Math.max(0.16, (def.cooldown ?? 1) / (1 + (buffs?.haste ?? 0) + bondHasteBonus)),
      range: def.range ?? 100,
      cleave: def.cleave ?? 1,
      burnDps: (def.baseDamage ?? 1) * tierScale * (buffs?.burn ?? 0) * markMultiplier,
      slow: Math.min(0.62, buffs?.slow ?? 0),
      stunChance: item.kind === 'hammer' ? 0.2 + item.tier * 0.04 : 0,
      critBonus: (item.kind === 'crossbow' ? 0.12 : 0) + (buffs?.crit ?? 0),
      boostLabels: buffs?.labels ?? [],
    });
  });

  if (vanguardActive) armor *= 1.15;
  if (herbalTemperActive) healPerSecond *= 1.25;

  const avgBellowsCrit = totalWeapons > 0 ? bellowsCritTotal / totalWeapons : 0;
  const critChance = Math.min(0.65, 0.05 + talents.crit * 0.025 + (hasRangedPair ? 0.1 : 0) + avgBellowsCrit);
  const critMultiplier = 1.65 + talents.crit * 0.08;
  const overdriveRate = 1 + talents.overdrive * 0.08 + bellowsCount * 0.12;
  const roundedArmor = Math.round(armor);

  return {
    weapons,
    maxHp: Math.round((100 * (1 + talents.health * 0.1) + bonusHp) * markMultiplier),
    armor: roundedArmor,
    healPerSecond,
    attackBonus: attackMultiplier,
    critChance,
    critMultiplier,
    overdriveRate,
    thornsDamage: vanguardActive ? Math.max(3, Math.round(roundedArmor * 0.65)) : 0,
    synergyLinks,
    bonds,
  };
}

export function monsterHp(stage: number, wave: number, boss = false): number {
  const stageScale = 1 + (stage - 1) * 0.18 + Math.max(0, stage - 3) * 0.08;
  const waveScale = 1 + (wave - 1) * 0.12;
  return Math.round(28 * stageScale * waveScale * (boss ? 5.2 : 1));
}

export function monsterDamage(stage: number, wave: number, boss = false): number {
  return Math.round((4 + stage * 1.1 + wave * 0.45) * (boss ? 2.2 : 1));
}

export function waveReward(stage: number, wave: number, goldTalent = 0, forgeMarks = 0): { gold: number; ore: number } {
  const boss = wave % 5 === 0;
  const markScale = 1 + forgeMarks * 0.1;
  return {
    gold: Math.round((24 + wave * 5 + stage * 7 + goldTalent * 2) * (boss ? 3 : 1) * markScale),
    ore: Math.round((3 + stage * 0.7 + (boss ? 7 : 0)) * markScale),
  };
}

export function shopPrice(tier: number, stage: number): number {
  return Math.round((42 + stage * 4) * Math.pow(1.85, tier - 1));
}

export function shopTierForStage(stage: number): number {
  return Math.min(4, 1 + Math.floor((stage - 1) / 3));
}

export function salvageValue(item: Item, stage: number): { gold: number; ore: number } {
  const basePrice = shopPrice(item.tier, Math.max(1, stage));
  return {
    gold: Math.max(12, Math.round(basePrice * 0.45)),
    ore: Math.max(1, item.tier * 2),
  };
}

export function talentCost(talent: keyof Talents, level: number): number {
  if (talent === 'slots') return [35, 80, 150][level] ?? 0;
  const base = talent === 'attack' ? 8 : talent === 'health' ? 9 : talent === 'gold' ? 12 : 14;
  return base + level * 7;
}

export function offlineRewardFor(seconds: number, stage: number, wave: number, forgeMarks = 0): { gold: number; ore: number } {
  const capped = Math.min(12 * 60 * 60, Math.max(0, seconds));
  const power = (1 + (stage - 1) * 0.22 + (wave - 1) * 0.025) * (1 + forgeMarks * 0.1);
  return {
    gold: Math.floor(capped * 0.7 * power + 1e-6),
    ore: Math.floor(capped * 0.035 * power),
  };
}

export function makeItem(kind: ItemKind, tier = 1, id?: string): Item {
  return {
    id: id ?? globalThis.crypto?.randomUUID?.() ?? `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    tier,
  };
}

export function createStarterInventory(): (Item | null)[] {
  const items: (Item | null)[] = Array.from({ length: BASE_COLUMNS * BASE_ROWS }, () => null);
  items[0] = makeItem('sword');
  items[1] = makeItem('sword');
  items[2] = makeItem('whetstone');
  items[3] = makeItem('shield');
  items[7] = makeItem('vial');
  return items;
}

const BOUNTY_TEMPLATES: {
  kind: BountyProgress['kind'];
  title: (target: number) => string;
  baseTarget: number;
  step: number;
  gold: number;
  ore: number;
  gems: number;
}[] = [
  {
    kind: 'merge',
    title: (t) => `Forge ${t} item merges`,
    baseTarget: 3,
    step: 3,
    gold: 65,
    ore: 6,
    gems: 2,
  },
  {
    kind: 'enemies',
    title: (t) => `Defeat ${t} valley foes`,
    baseTarget: 12,
    step: 10,
    gold: 75,
    ore: 7,
    gems: 2,
  },
  {
    kind: 'waves',
    title: (t) => `Clear ${t} battle waves`,
    baseTarget: 4,
    step: 3,
    gold: 90,
    ore: 8,
    gems: 3,
  },
  {
    kind: 'overdrive',
    title: (t) => `Unleash Anvil Strike ${t}×`,
    baseTarget: 2,
    step: 2,
    gold: 80,
    ore: 9,
    gems: 3,
  },
  {
    kind: 'salvage',
    title: (t) => `Smelt ${t} spare pieces`,
    baseTarget: 2,
    step: 2,
    gold: 55,
    ore: 8,
    gems: 2,
  },
];

export function buildBounty(kind: BountyProgress['kind'], tier: number, stage: number): BountyProgress {
  const tpl = BOUNTY_TEMPLATES.find((entry) => entry.kind === kind) ?? BOUNTY_TEMPLATES[0];
  const target = tpl.baseTarget + (tier - 1) * tpl.step;
  const scale = 1 + (stage - 1) * 0.2 + (tier - 1) * 0.35;
  return {
    id: `${kind}-t${tier}-${Math.random().toString(16).slice(2, 7)}`,
    kind,
    title: tpl.title(target),
    target,
    progress: 0,
    tier,
    rewardGold: Math.round(tpl.gold * scale),
    rewardOre: Math.round(tpl.ore * (1 + (tier - 1) * 0.3)),
    rewardGems: tpl.gems + Math.floor((tier - 1) / 2),
  };
}

export function createInitialBounties(stage = 1): BountyProgress[] {
  return [
    buildBounty('merge', 1, stage),
    buildBounty('enemies', 1, stage),
    buildBounty('waves', 1, stage),
  ];
}

export function nextBountyAfter(completed: BountyProgress, activeKinds: BountyProgress['kind'][], stage: number): BountyProgress {
  const candidates = BOUNTY_TEMPLATES.map((t) => t.kind).filter((k) => !activeKinds.includes(k));
  const nextKind = candidates[0] ?? completed.kind;
  return buildBounty(nextKind, completed.tier + 1, stage);
}

export function createDefaultState(now = Date.now()): GameState {
  return {
    schema: 2,
    nickname: 'Forge Smith',
    gold: 150,
    ore: 15,
    gems: 0,
    stage: 1,
    wave: 1,
    highestStage: 1,
    ascensions: 0,
    forgeMarks: 0,
    inventory: createStarterInventory(),
    talents: { attack: 0, health: 0, gold: 0, slots: 0, crit: 0, overdrive: 0 },
    settings: {
      theme: 'light',
      sfx: true,
      ambience: false,
      sfxVolume: 0.7,
      ambienceVolume: 0.25,
      haptics: true,
    },
    shop: [],
    refreshCount: 0,
    autoWave: true,
    speed: 1,
    prologueSeen: false,
    onboardingStep: 0,
    onboardingDone: false,
    seenChapters: [1],
    highestTierForged: { sword: 1, whetstone: 1, shield: 1, vial: 1 },
    achievements: [],
    bounties: createInitialBounties(1),
    dailyLastClaim: '',
    dailyStreak: 0,
    stats: {
      merges: 0,
      waves: 0,
      bosses: 0,
      enemies: 0,
      overdrives: 0,
      salvages: 0,
      bountiesClaimed: 0,
      playSeconds: 0,
      defeatedByKind: {},
    },
    removeAds: false,
    tempExtraSlot: false,
    lastSeen: now,
  };
}
