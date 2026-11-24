import {
  buildBounty,
  createDefaultState,
  createInitialBounties,
  ITEM_DEFS,
  MAX_TIER,
  SHOP_POOL,
} from './data';
import type { BountyProgress, EnemyKind, GameState, Item, ItemKind, ShopEntry } from './types';

export const SAVE_KEY = 'backpack-forge.save.v2';
export const BACKUP_KEY = 'backpack-forge.save.v2.backup';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  state: GameState;
  recovered: boolean;
  corrupted: boolean;
}

function validItem(value: unknown): value is Item {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Item>;
  return typeof item.id === 'string'
    && typeof item.kind === 'string'
    && item.kind in ITEM_DEFS
    && Number.isInteger(item.tier)
    && (item.tier ?? 0) >= 1
    && (item.tier ?? 0) <= MAX_TIER;
}

function validShopEntry(value: unknown): value is ShopEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ShopEntry>;
  return typeof entry.id === 'string'
    && typeof entry.kind === 'string'
    && SHOP_POOL.includes(entry.kind)
    && Number.isInteger(entry.tier)
    && (entry.tier ?? 0) >= 1
    && (entry.tier ?? 0) <= 4
    && Number.isFinite(entry.price)
    && (entry.price ?? 0) > 0;
}

function validBounty(value: unknown, stage: number): BountyProgress | null {
  if (!value || typeof value !== 'object') return null;
  const b = value as Partial<BountyProgress>;
  if (
    b.kind !== 'merge'
    && b.kind !== 'waves'
    && b.kind !== 'enemies'
    && b.kind !== 'overdrive'
    && b.kind !== 'salvage'
  ) {
    return null;
  }
  const tier = typeof b.tier === 'number' && Number.isFinite(b.tier) ? Math.max(1, Math.floor(b.tier)) : 1;
  const built = buildBounty(b.kind, tier, stage);
  const target = typeof b.target === 'number' && Number.isFinite(b.target) ? Math.max(1, Math.floor(b.target)) : built.target;
  const progress = typeof b.progress === 'number' && Number.isFinite(b.progress) ? Math.max(0, Math.min(target, Math.floor(b.progress))) : 0;
  return {
    ...built,
    id: typeof b.id === 'string' ? b.id : built.id,
    target,
    progress,
  };
}

export function normalizeState(raw: unknown): GameState {
  const defaults = createDefaultState();
  if (!raw || typeof raw !== 'object') return defaults;
  const value = raw as Partial<GameState>;
  const finite = (input: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    typeof input === 'number' && Number.isFinite(input) ? Math.min(max, Math.max(min, Math.floor(input))) : fallback;
  const inventory = Array.isArray(value.inventory)
    ? value.inventory.slice(0, 26).map((item) => (validItem(item) ? item : null))
    : defaults.inventory;
  const shop = Array.isArray(value.shop)
    ? value.shop.filter(validShopEntry).slice(0, 3)
    : [];
  const talents = value.talents ?? defaults.talents;
  const settings = value.settings ?? defaults.settings;
  const stats = value.stats ?? defaults.stats;
  const stage = finite(value.stage, 1, 1, 9999);
  const highestStage = Math.max(stage, finite(value.highestStage, 1, 1, 9999));

  const highestTierForged: Partial<Record<ItemKind, number>> = { ...defaults.highestTierForged };
  if (value.highestTierForged && typeof value.highestTierForged === 'object') {
    for (const [k, v] of Object.entries(value.highestTierForged)) {
      if (k in ITEM_DEFS && typeof v === 'number' && Number.isFinite(v)) {
        highestTierForged[k as ItemKind] = Math.min(MAX_TIER, Math.max(1, Math.floor(v)));
      }
    }
  }
  inventory.forEach((item) => {
    if (!item) return;
    highestTierForged[item.kind] = Math.max(highestTierForged[item.kind] ?? 0, item.tier);
  });

  const defeatedByKind: Partial<Record<EnemyKind, number>> = {};
  if (stats.defeatedByKind && typeof stats.defeatedByKind === 'object') {
    for (const [k, v] of Object.entries(stats.defeatedByKind)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        defeatedByKind[k as EnemyKind] = Math.floor(v);
      }
    }
  }

  const parsedBounties = Array.isArray(value.bounties)
    ? value.bounties.map((b) => validBounty(b, stage)).filter((b): b is BountyProgress => b !== null).slice(0, 3)
    : [];
  const bounties = parsedBounties.length === 3 ? parsedBounties : createInitialBounties(stage);

  const onboardingDone = value.onboardingDone === true;
  const prologueSeen = value.prologueSeen === true || onboardingDone || (value.stats?.waves ?? 0) > 0;

  return {
    schema: 2,
    gold: finite(value.gold, defaults.gold),
    ore: finite(value.ore, defaults.ore),
    gems: finite(value.gems, defaults.gems),
    stage,
    wave: finite(value.wave, 1, 1, 10),
    highestStage,
    ascensions: finite(value.ascensions, 0),
    forgeMarks: finite(value.forgeMarks, 0),
    inventory,
    talents: {
      attack: finite(talents.attack, 0, 0, 50),
      health: finite(talents.health, 0, 0, 50),
      gold: finite(talents.gold, 0, 0, 30),
      slots: finite(talents.slots, 0, 0, 3),
      crit: finite(talents.crit, 0, 0, 20),
      overdrive: finite(talents.overdrive, 0, 0, 20),
    },
    settings: {
      theme: settings.theme === 'dark' || settings.theme === 'warm' ? settings.theme : 'light',
      sfx: settings.sfx !== false,
      ambience: settings.ambience === true,
      sfxVolume: typeof settings.sfxVolume === 'number' ? Math.min(1, Math.max(0, settings.sfxVolume)) : 0.7,
      ambienceVolume: typeof settings.ambienceVolume === 'number' ? Math.min(1, Math.max(0, settings.ambienceVolume)) : 0.25,
      haptics: settings.haptics !== false,
    },
    shop,
    refreshCount: finite(value.refreshCount, 0),
    autoWave: value.autoWave !== false,
    speed: value.speed === 2 ? 2 : 1,
    prologueSeen,
    onboardingStep: finite(value.onboardingStep, 0, 0, 3),
    onboardingDone,
    seenChapters: Array.isArray(value.seenChapters)
      ? value.seenChapters.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1)
      : [1],
    highestTierForged,
    achievements: Array.isArray(value.achievements)
      ? value.achievements.filter((id): id is string => typeof id === 'string')
      : [],
    bounties,
    dailyLastClaim: typeof value.dailyLastClaim === 'string' ? value.dailyLastClaim : '',
    dailyStreak: finite(value.dailyStreak, 0, 0, 7),
    stats: {
      merges: finite(stats.merges, 0),
      waves: finite(stats.waves, 0),
      bosses: finite(stats.bosses, 0),
      enemies: finite(stats.enemies, 0),
      overdrives: finite(stats.overdrives, 0),
      salvages: finite(stats.salvages, 0),
      bountiesClaimed: finite(stats.bountiesClaimed, 0),
      playSeconds: finite(stats.playSeconds, 0),
      defeatedByKind,
    },
    removeAds: value.removeAds === true,
    tempExtraSlot: value.tempExtraSlot === true,
    lastSeen: finite(value.lastSeen, Date.now()),
  };
}

export function loadState(storage: StorageLike | null, now = Date.now()): LoadResult {
  if (!storage) return { state: createDefaultState(now), recovered: false, corrupted: false };
  let corrupted = false;
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    const text = storage.getItem(key);
    if (!text) continue;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !('inventory' in parsed)) throw new Error('Invalid save');
      return { state: normalizeState(parsed), recovered: key === BACKUP_KEY, corrupted: key === BACKUP_KEY };
    } catch {
      corrupted = true;
    }
  }
  return { state: createDefaultState(now), recovered: false, corrupted };
}

export function saveState(storage: StorageLike | null, state: GameState): boolean {
  if (!storage) return false;
  try {
    const current = storage.getItem(SAVE_KEY);
    const next = JSON.stringify(state);
    if (current && current !== next) storage.setItem(BACKUP_KEY, current);
    if (!current) storage.setItem(BACKUP_KEY, next);
    storage.setItem(SAVE_KEY, next);
    return true;
  } catch {
    return false;
  }
}
