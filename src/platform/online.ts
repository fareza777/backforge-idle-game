import { calculateLoadout } from '../game/data';
import type { GameState, HeroLoadout, ItemKind } from '../game/types';
import {
  F7RankClient,
  type PvpOpponent,
  type RankScoreEntry,
  type WorldBossInfo,
  type WorldBossStatusResponse,
} from './f7RankSdk';

export const RANK_API_URL = 'https://f7-rank-api.fajar-mreza.workers.dev';
export const RANK_GAME_ID = 'backforge_idle';

export const RANK_BOARDS = [
  { id: 'power', label: 'Power', desc: 'Overall Forge Combat Power' },
  { id: 'stage', label: 'Stage', desc: 'Highest Valley Stage Reached' },
  { id: 'merges', label: 'Merges', desc: 'Total Gear Merges Forged' },
  { id: 'ascension', label: 'Marks', desc: 'Masterwork Forge Marks' },
  { id: 'weekly_forge', label: 'Weekly', desc: 'Weekly Competitive Forge Score' },
] as const;

export type RankBoardId = (typeof RANK_BOARDS)[number]['id'];

export interface PvpWeaponSnap {
  kind: ItemKind;
  tier: number;
  damage: number;
  cooldown: number;
  range: number;
  cleave: number;
  burnDps: number;
  slow: number;
  stunChance: number;
}

export interface PvpHeroSnapshot extends Record<string, unknown> {
  v: 1;
  stage: number;
  maxHp: number;
  armor: number;
  healPerSecond: number;
  critChance: number;
  critMultiplier: number;
  thornsDamage: number;
  weapons: PvpWeaponSnap[];
}

export interface WorldBossTheme {
  bossId: string;
  title: string;
  subtitle: string;
  element: 'iron' | 'fire' | 'ice';
  arena: string;
  portrait: string;
  walkClip: 'dreadnought-walk' | 'boss-walk' | 'warden-walk';
  attackClip: 'boss-attack' | null;
  auraColor: string;
  lore: string;
}

export const rankClient = new F7RankClient({
  baseUrl: RANK_API_URL,
  gameId: RANK_GAME_ID,
});

export function computeForgePower(state: GameState): number {
  const loadout = calculateLoadout(state.inventory, state.talents, state.forgeMarks);
  const dps = loadout.weapons.reduce((sum, w) => sum + w.damage / Math.max(0.2, w.cooldown), 0);
  const effectiveDps = dps * (1 + loadout.critChance * (loadout.critMultiplier - 1));
  const raw = effectiveDps * 4.5
    + loadout.maxHp * 0.45
    + loadout.armor * 3.5
    + loadout.healPerSecond * 6
    + state.highestStage * 22
    + state.forgeMarks * 85;
  return Math.max(20, Math.round(raw));
}

export function buildRankPayload(state: GameState): RankScoreEntry[] {
  const power = computeForgePower(state);
  const weeklyScore = Math.round(
    power + state.highestStage * 120 + state.stats.waves * 18 + state.stats.bosses * 90 + state.stats.merges * 6,
  );
  const meta = {
    stage: state.highestStage,
    asc: state.ascensions,
    merges: state.stats.merges,
    marks: state.forgeMarks,
    power,
  };
  return [
    { boardId: 'power', score: power, meta },
    { boardId: 'stage', score: Math.max(1, state.highestStage), meta },
    { boardId: 'merges', score: Math.max(0, state.stats.merges), meta },
    { boardId: 'ascension', score: Math.max(0, state.forgeMarks), meta },
    { boardId: 'weekly_forge', score: Math.max(20, weeklyScore), meta },
  ];
}

export function buildPvpSnapshot(state: GameState): PvpHeroSnapshot {
  const loadout = calculateLoadout(state.inventory, state.talents, state.forgeMarks);
  const weapons: PvpWeaponSnap[] = loadout.weapons.slice(0, 8).map((w) => ({
    kind: w.item.kind,
    tier: w.item.tier,
    damage: Math.round(w.damage * 10) / 10,
    cooldown: Math.round(w.cooldown * 100) / 100,
    range: w.range,
    cleave: w.cleave,
    burnDps: Math.round(w.burnDps * 10) / 10,
    slow: Math.round(w.slow * 100) / 100,
    stunChance: Math.round(w.stunChance * 100) / 100,
  }));
  return {
    v: 1,
    stage: state.highestStage,
    maxHp: loadout.maxHp,
    armor: loadout.armor,
    healPerSecond: Math.round(loadout.healPerSecond * 10) / 10,
    critChance: Math.round(loadout.critChance * 1000) / 1000,
    critMultiplier: Math.round(loadout.critMultiplier * 100) / 100,
    thornsDamage: loadout.thornsDamage,
    weapons,
  };
}

export function loadoutFromSnapshot(snapshot: Record<string, unknown>, fallbackPower: number): HeroLoadout {
  const s = snapshot as Partial<PvpHeroSnapshot>;
  const rawWeapons = Array.isArray(s.weapons) ? s.weapons : [];
  if (rawWeapons.length > 0 && typeof s.maxHp === 'number') {
    return {
      weapons: rawWeapons.map((w, idx) => ({
        item: { id: `pvp-w-${idx}`, kind: w.kind ?? 'sword', tier: w.tier ?? 1 },
        slotIndex: idx,
        damage: Math.max(4, Number(w.damage ?? 12)),
        cooldown: Math.max(0.22, Number(w.cooldown ?? 1)),
        range: Number(w.range ?? 112),
        cleave: Number(w.cleave ?? 1),
        burnDps: Number(w.burnDps ?? 0),
        slow: Number(w.slow ?? 0),
        stunChance: Number(w.stunChance ?? 0),
        critBonus: 0,
        boostLabels: [],
      })),
      maxHp: Math.max(80, Math.round(Number(s.maxHp))),
      armor: Math.max(0, Math.round(Number(s.armor ?? 2))),
      healPerSecond: Math.max(0, Number(s.healPerSecond ?? 0)),
      attackBonus: 1,
      critChance: Math.min(0.65, Math.max(0.05, Number(s.critChance ?? 0.08))),
      critMultiplier: Math.max(1.5, Number(s.critMultiplier ?? 1.65)),
      overdriveRate: 1,
      thornsDamage: Math.max(0, Number(s.thornsDamage ?? 0)),
      synergyLinks: [],
      bonds: [],
    };
  }
  const scale = Math.max(0.6, fallbackPower / 180);
  return {
    weapons: [
      {
        item: { id: 'bot-sword', kind: 'sword', tier: 2 },
        slotIndex: 0,
        damage: Math.round(16 * scale),
        cooldown: 1.0,
        range: 112,
        cleave: 1,
        burnDps: 0,
        slow: 0,
        stunChance: 0,
        critBonus: 0,
        boostLabels: [],
      },
    ],
    maxHp: Math.round(115 * scale),
    armor: Math.round(4 * scale),
    healPerSecond: 1.5 * scale,
    attackBonus: 1,
    critChance: 0.08,
    critMultiplier: 1.65,
    overdriveRate: 1,
    thornsDamage: 0,
    synergyLinks: [],
    bonds: [],
  };
}

export function resolveWorldBossTheme(boss?: Partial<WorldBossInfo> | null): WorldBossTheme {
  const id = String(boss?.bossId || 'anvil_titan');
  if (id === 'furnace_behemoth' || id === 'ignis_colossus') {
    return {
      bossId: 'furnace_behemoth',
      title: id === 'furnace_behemoth' && boss?.title ? boss.title : 'Grand Furnace Behemoth',
      subtitle: 'Foundry Crucible Titan',
      element: 'fire',
      arena: '/art/ironbridge-foundry-arena.webp',
      portrait: '/art/forge-colossus-boss.webp',
      walkClip: 'boss-walk',
      attackClip: 'boss-attack',
      auraColor: '#f07b36',
      lore: 'A towering twin-boiler colossus forged beneath Ironbridge. Every hammer blow vents white-hot cinders across the viaduct.',
    };
  }
  if (id === 'frostforge_automaton' || id === 'aether_leviathan') {
    return {
      bossId: 'frostforge_automaton',
      title: id === 'frostforge_automaton' && boss?.title ? boss.title : 'Frostforge Automaton',
      subtitle: 'Glacial Quarry Sentinel',
      element: 'ice',
      arena: '/art/ashen-quarry-arena.webp',
      portrait: '/art/obsidian-warden.webp',
      walkClip: 'warden-walk',
      attackClip: null,
      auraColor: '#5db9d8',
      lore: 'Clad in quenched mountain steel and frost-tempered plate, it guards the high passes with sweeping halberd arcs.',
    };
  }
  return {
    bossId: 'anvil_titan',
    title: id === 'anvil_titan' && boss?.title ? boss.title : 'Ironcrown Anvil Titan',
    subtitle: 'Summit Citadel Juggernaut',
    element: 'iron',
    arena: '/art/emberpeak-citadel-arena.webp',
    portrait: '/art/molten-dreadnought.webp',
    walkClip: 'dreadnought-walk',
    attackClip: null,
    auraColor: '#f0b84b',
    lore: 'The sovereign juggernaut of Emberpeak Citadel. Twin steam chimneys roar as its anvil-gauntlets shake the mountain terrace.',
  };
}

export function offlineWorldBossFallback(): WorldBossStatusResponse {
  const now = Date.now();
  return {
    boss: {
      bossKey: 'offline',
      bossId: 'anvil_titan',
      title: 'Ironcrown Anvil Titan',
      element: 'iron',
      totalHp: 5000000,
      currentDamage: 0,
      hitsCount: 0,
      startsAt: now - 3600000,
      endsAt: now + 5 * 86400000,
      participants: 1,
    },
    top: [],
    me: { totalDamage: 0, bestHit: 0, runsCount: 0, runsToday: 0, rank: null },
    fromCache: true,
  };
}

export function generateBotOpponents(myPower: number, myRating: number): PvpOpponent[] {
  const base = Math.max(40, myPower);
  const specs: {
    id: string;
    name: string;
    factor: number;
    ratingOffset: number;
    weapons: { kind: ItemKind; tier: number; dmgMul: number; cd: number; range: number; cleave?: number }[];
  }[] = [
    {
      id: 'bot_hal',
      name: 'Ironwright Hal',
      factor: 0.84,
      ratingOffset: -45,
      weapons: [{ kind: 'sword', tier: 2, dmgMul: 1, cd: 1.0, range: 112 }],
    },
    {
      id: 'bot_oren',
      name: 'Shieldbearer Oren',
      factor: 0.98,
      ratingOffset: 10,
      weapons: [
        { kind: 'spear', tier: 2, dmgMul: 0.72, cd: 1.18, range: 142, cleave: 2 },
        { kind: 'daggers', tier: 2, dmgMul: 0.45, cd: 0.52, range: 92 },
      ],
    },
    {
      id: 'bot_vael',
      name: 'Foundry Master Vael',
      factor: 1.12,
      ratingOffset: 65,
      weapons: [
        { kind: 'hammer', tier: 3, dmgMul: 1.25, cd: 1.65, range: 118 },
        { kind: 'crossbow', tier: 2, dmgMul: 0.55, cd: 0.78, range: 345 },
      ],
    },
  ];

  return specs.map((spec) => {
    const power = Math.max(25, Math.round(base * spec.factor));
    const scale = power / 165;
    const snapshot: PvpHeroSnapshot = {
      v: 1,
      stage: Math.max(1, Math.round(scale * 1.6)),
      maxHp: Math.max(90, Math.round(115 * scale)),
      armor: Math.max(2, Math.round(4 * scale)),
      healPerSecond: Math.round(1.6 * scale * 10) / 10,
      critChance: 0.09,
      critMultiplier: 1.7,
      thornsDamage: 0,
      weapons: spec.weapons.map((w) => ({
        kind: w.kind,
        tier: w.tier,
        damage: Math.max(6, Math.round(16 * scale * w.dmgMul)),
        cooldown: w.cd,
        range: w.range,
        cleave: w.cleave ?? 1,
        burnDps: w.kind === 'hammer' ? Math.round(3 * scale) : 0,
        slow: 0,
        stunChance: w.kind === 'hammer' ? 0.22 : 0,
      })),
    };
    return {
      playerId: spec.id,
      nickname: spec.name,
      country: 'F7',
      rating: Math.max(650, myRating + spec.ratingOffset),
      wins: 12 + Math.round(scale * 3),
      losses: 6,
      power,
      snapshot,
      isBot: true,
    };
  });
}

let lastSyncAt = 0;
let inflightSync: Promise<{ ok: boolean; error?: string }> | null = null;

export async function syncRankings(
  state: GameState,
  options: { force?: boolean } = {},
): Promise<{ ok: boolean; throttled?: boolean; error?: string }> {
  const now = Date.now();
  if (!options.force && now - lastSyncAt < 180_000) return { ok: true, throttled: true };
  if (inflightSync) return inflightSync;
  lastSyncAt = now;
  inflightSync = (async () => {
    try {
      const nick = state.nickname || 'Forge Smith';
      const payload = buildRankPayload(state);
      const res = await rankClient.submitScores(payload, nick);
      void rankClient
        .uploadPvpSnapshot({
          snapshot: buildPvpSnapshot(state),
          power: computeForgePower(state),
          nickname: nick,
        })
        .catch(() => {});
      return res;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'sync_failed' };
    } finally {
      inflightSync = null;
    }
  })();
  return inflightSync;
}
