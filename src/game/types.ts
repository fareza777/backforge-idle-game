export type Theme = 'light' | 'dark' | 'warm';

export type ItemKind =
  | 'sword'
  | 'daggers'
  | 'axe'
  | 'bow'
  | 'hammer'
  | 'spear'
  | 'crossbow'
  | 'shield'
  | 'plate'
  | 'vial'
  | 'whetstone'
  | 'ember'
  | 'frost'
  | 'gear'
  | 'bellows';

export type ItemCategory = 'weapon' | 'defense' | 'support' | 'booster';

export type EnemyKind = 'boar' | 'scout' | 'golem' | 'hound' | 'boss' | 'warden' | 'dreadnought';

export interface Item {
  id: string;
  kind: ItemKind;
  tier: number;
}

export interface ShopEntry {
  id: string;
  kind: ItemKind;
  tier: number;
  price: number;
}

export interface Talents {
  attack: number;
  health: number;
  gold: number;
  slots: number;
  crit: number;
  overdrive: number;
}

export interface GameSettings {
  theme: Theme;
  sfx: boolean;
  ambience: boolean;
  sfxVolume: number;
  ambienceVolume: number;
  haptics: boolean;
}

export interface BountyProgress {
  id: string;
  kind: 'merge' | 'waves' | 'enemies' | 'overdrive' | 'salvage';
  title: string;
  target: number;
  progress: number;
  tier: number;
  rewardGold: number;
  rewardOre: number;
  rewardGems: number;
}

export interface GameState {
  schema: 2;
  gold: number;
  ore: number;
  gems: number;
  stage: number;
  wave: number;
  highestStage: number;
  ascensions: number;
  forgeMarks: number;
  inventory: (Item | null)[];
  talents: Talents;
  settings: GameSettings;
  shop: ShopEntry[];
  refreshCount: number;
  autoWave: boolean;
  speed: 1 | 2;
  prologueSeen: boolean;
  onboardingStep: number;
  onboardingDone: boolean;
  seenChapters: number[];
  highestTierForged: Partial<Record<ItemKind, number>>;
  achievements: string[];
  bounties: BountyProgress[];
  dailyLastClaim: string;
  dailyStreak: number;
  stats: {
    merges: number;
    waves: number;
    bosses: number;
    enemies: number;
    overdrives: number;
    salvages: number;
    bountiesClaimed: number;
    playSeconds: number;
    defeatedByKind: Partial<Record<EnemyKind, number>>;
  };
  removeAds: boolean;
  tempExtraSlot: boolean;
  lastSeen: number;
}

export interface ItemDefinition {
  name: string;
  shortName: string;
  category: ItemCategory;
  description: string;
  baseDamage?: number;
  cooldown?: number;
  range?: number;
  cleave?: number;
  baseArmor?: number;
  baseHp?: number;
  baseHeal?: number;
  accent: string;
}

export interface WeaponLoadout {
  item: Item;
  slotIndex: number;
  damage: number;
  cooldown: number;
  range: number;
  cleave: number;
  burnDps: number;
  slow: number;
  stunChance: number;
  critBonus: number;
  boostLabels: string[];
}

export interface SynergyLink {
  from: number;
  to: number;
  kind: ItemKind;
}

export interface ActiveSynergyBond {
  id: string;
  name: string;
  bonusText: string;
  active: boolean;
}

export interface HeroLoadout {
  weapons: WeaponLoadout[];
  maxHp: number;
  armor: number;
  healPerSecond: number;
  attackBonus: number;
  critChance: number;
  critMultiplier: number;
  overdriveRate: number;
  thornsDamage: number;
  synergyLinks: SynergyLink[];
  bonds: ActiveSynergyBond[];
}

export interface OfflineReward {
  seconds: number;
  gold: number;
  ore: number;
}

export type RewardedAction = 'offline-double' | 'free-refresh' | 'extra-slot' | 'revive';

export type ModalName =
  | 'prologue'
  | 'guide'
  | 'bounties'
  | 'ascension'
  | 'settings'
  | 'talents'
  | 'codex'
  | 'shop'
  | 'achievements'
  | 'daily'
  | 'about'
  | 'offline'
  | 'stage-clear'
  | 'defeat'
  | 'menu'
  | null;
