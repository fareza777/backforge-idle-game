import { describe, expect, it } from 'vitest';
import {
  backpackDimensions,
  calculateLoadout,
  createDefaultState,
  inventoryCapacity,
  makeItem,
  monsterHp,
  offlineRewardFor,
  shopPrice,
  waveReward,
} from '../src/game/data';
import { BACKUP_KEY, SAVE_KEY, loadState, saveState, type StorageLike } from '../src/game/save';
import { GameStore } from '../src/game/store';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function inventory(...items: (ReturnType<typeof makeItem> | null)[]): (ReturnType<typeof makeItem> | null)[] {
  return Array.from({ length: 12 }, (_, index) => items[index] ?? null);
}

describe('backpack and adjacency rules', () => {
  it('starts with a merge available in the first row', () => {
    const state = createDefaultState();
    expect(state.inventory[0]?.kind).toBe('sword');
    expect(state.inventory[1]).toMatchObject({ kind: 'sword', tier: 1 });
    expect(state.gold).toBeGreaterThanOrEqual(shopPrice(1, 1));
  });

  it('applies Whetstone only to orthogonal weapon neighbors', () => {
    const sword = makeItem('sword');
    const diagonalSword = makeItem('sword');
    const loadout = calculateLoadout(inventory(sword, makeItem('whetstone'), null, diagonalSword), createDefaultState().talents);
    expect(loadout.weapons.find((weapon) => weapon.item.id === sword.id)?.damage).toBeCloseTo(15.6);
    expect(loadout.weapons.find((weapon) => weapon.item.id === diagonalSword.id)?.damage).toBeCloseTo(13);
  });

  it('applies Gear haste, Ember burn, and Frost slow independently', () => {
    const loadout = calculateLoadout(inventory(
      makeItem('gear'),
      makeItem('sword'),
      makeItem('ember'),
      null,
      null,
      makeItem('frost'),
      null,
      null,
      null,
      makeItem('bow'),
    ), createDefaultState().talents);
    const sword = loadout.weapons.find((weapon) => weapon.item.kind === 'sword')!;
    expect(sword.cooldown).toBeLessThan(1.05);
    expect(sword.burnDps).toBeGreaterThan(0);
    expect(sword.slow).toBeGreaterThan(0);
    expect(loadout.weapons.find((weapon) => weapon.item.kind === 'bow')?.slow).toBeGreaterThan(0);
  });

  it('expands from 4x3 to 5x5 without losing items', () => {
    const talents = { attack: 0, health: 0, gold: 0, slots: 0, crit: 0, overdrive: 0 };
    expect(backpackDimensions(talents)).toEqual({ columns: 4, rows: 3 });
    expect(inventoryCapacity({ ...talents, slots: 3 }, true)).toBe(26);
    expect(backpackDimensions({ ...talents, slots: 3 })).toEqual({ columns: 5, rows: 5 });
  });
});

describe('economy and progression', () => {
  it('keeps the first wave short and rewarding', () => {
    expect(monsterHp(1, 1)).toBe(28);
    expect(waveReward(1, 1).gold).toBe(36);
    const mergedSwordDamage = calculateLoadout(inventory(makeItem('sword', 2)), createDefaultState().talents).weapons[0].damage;
    expect(mergedSwordDamage).toBeGreaterThan(monsterHp(1, 1));
  });

  it('makes Bosses meaningfully stronger and better rewarding', () => {
    expect(monsterHp(1, 5, true)).toBeGreaterThan(monsterHp(1, 5) * 5);
    expect(waveReward(1, 5).gold).toBeGreaterThan(waveReward(1, 4).gold * 2);
  });

  it('caps offline progression at twelve hours', () => {
    const twelveHours = offlineRewardFor(12 * 60 * 60, 1, 1);
    const twoDays = offlineRewardFor(48 * 60 * 60, 1, 1);
    expect(twoDays).toEqual(twelveHours);
    expect(twelveHours.gold).toBe(30240);
    expect(twelveHours.ore).toBe(1512);
  });
});

describe('reliable saves', () => {
  it('writes a backup before replacing a valid save', () => {
    const storage = new MemoryStorage();
    const first = createDefaultState(1000);
    saveState(storage, first);
    const second = { ...first, gold: 999, lastSeen: 2000 };
    saveState(storage, second);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).gold).toBe(999);
    expect(JSON.parse(storage.getItem(BACKUP_KEY)!).gold).toBe(150);
  });

  it('recovers the backup when the primary save is corrupted', () => {
    const storage = new MemoryStorage();
    const state = { ...createDefaultState(1000), gold: 321 };
    saveState(storage, state);
    storage.setItem(SAVE_KEY, '{broken json');
    const loaded = loadState(storage, 2000);
    expect(loaded.recovered).toBe(true);
    expect(loaded.corrupted).toBe(true);
    expect(loaded.state.gold).toBe(321);
  });

  it('rejects malformed items during normalization', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...createDefaultState(), inventory: [{ id: 'x', kind: 'unknown', tier: 99 }] }));
    const loaded = loadState(storage);
    expect(loaded.state.inventory[0]).toBeNull();
  });
});

describe('game store actions', () => {
  it('merges identical items and advances onboarding', () => {
    const storage = new MemoryStorage();
    const store = new GameStore({ storage, now: () => 1000, random: () => 0.2, persist: false });
    expect(store.moveOrMerge(0, 1)).toBe('merged');
    expect(store.getSnapshot().inventory[1]).toMatchObject({ kind: 'sword', tier: 2 });
    expect(store.getSnapshot().inventory[0]).toBeNull();
    expect(store.getSnapshot().onboardingStep).toBe(1);
    expect(store.getSnapshot().stats.merges).toBe(1);
  });

  it('swaps different items and refuses out-of-range moves', () => {
    const store = new GameStore({ storage: new MemoryStorage(), random: () => 0.2, persist: false });
    const source = store.getSnapshot().inventory[0];
    const target = store.getSnapshot().inventory[3];
    expect(store.moveOrMerge(0, 3)).toBe('swapped');
    expect(store.getSnapshot().inventory[3]?.id).toBe(source?.id);
    expect(store.getSnapshot().inventory[0]?.id).toBe(target?.id);
    expect(store.moveOrMerge(-1, 2)).toBe('none');
  });

  it('buys only visible transparent shop items and deducts Gold', () => {
    const store = new GameStore({ storage: new MemoryStorage(), random: () => 0.2, persist: false });
    const entry = store.getSnapshot().shop[0];
    const before = store.getSnapshot().gold;
    expect(store.buyShopItem(0)).toBe(true);
    expect(store.getSnapshot().gold).toBe(before - entry.price);
    expect(store.getSnapshot().inventory.some((item) => item?.kind === entry.kind && item.tier === entry.tier)).toBe(true);
  });

  it('does not allow a second daily claim on the same day', () => {
    const store = new GameStore({ storage: new MemoryStorage(), now: () => new Date(2026, 10, 24, 12).getTime(), random: () => 0.2, persist: false });
    expect(store.claimDaily()?.day).toBe(1);
    expect(store.claimDaily()).toBeNull();
  });

  it('progresses waves, Bosses, and stages in order', () => {
    const store = new GameStore({ storage: new MemoryStorage(), random: () => 0.2, persist: false });
    for (let wave = 1; wave <= 10; wave += 1) {
      const result = store.completeWave();
      expect(result.boss).toBe(wave === 5 || wave === 10);
      expect(result.stageCleared).toBe(wave === 10);
    }
    expect(store.getSnapshot().stage).toBe(2);
    expect(store.getSnapshot().wave).toBe(1);
    expect(store.getSnapshot().stats.bosses).toBe(2);
    expect(store.getSnapshot().achievements).toContain('stage-two');
  });

  it('doubles offline rewards only once', () => {
    let now = 1000;
    const storage = new MemoryStorage();
    const store = new GameStore({ storage, now: () => now, random: () => 0.2, persist: false });
    store.persistNow();
    now += 2 * 60 * 60 * 1000;
    const reopened = new GameStore({ storage, now: () => now, random: () => 0.2, persist: false });
    const pending = reopened.getOfflineReward()!;
    const before = reopened.getSnapshot().gold;
    expect(reopened.claimOffline(true)?.gold).toBe(pending.gold * 2);
    expect(reopened.getSnapshot().gold).toBe(before + pending.gold * 2);
    expect(reopened.claimOffline()).toBeNull();
  });
});

describe('v1.1.0 expansions: new gear, bonds, smelting, bounties, story & ascension', () => {
  it('supports new equipment kinds and Set Bonds', () => {
    const loadout = calculateLoadout(
      inventory(
        makeItem('spear', 1),
        makeItem('bellows', 1),
        makeItem('crossbow', 1),
        makeItem('plate', 1),
        makeItem('shield', 1),
      ),
      createDefaultState().talents,
    );
    expect(loadout.weapons.find((w) => w.item.kind === 'spear')?.cleave).toBe(2);
    expect(loadout.maxHp).toBeGreaterThan(100);
    expect(loadout.thornsDamage).toBeGreaterThan(0);
    expect(loadout.bonds.find((b) => b.id === 'vanguard')?.active).toBe(true);
    expect(loadout.critChance).toBeGreaterThan(0.05);
  });

  it('smelts spare items into Gold and Ore and advances salvage bounty', () => {
    const store = new GameStore({ storage: new MemoryStorage(), random: () => 0.2, persist: false });
    const beforeGold = store.getSnapshot().gold;
    const beforeOre = store.getSnapshot().ore;
    expect(store.salvageItem(3)).toBe(true);
    expect(store.getSnapshot().inventory[3]).toBeNull();
    expect(store.getSnapshot().gold).toBeGreaterThan(beforeGold);
    expect(store.getSnapshot().ore).toBeGreaterThan(beforeOre);
    expect(store.getSnapshot().stats.salvages).toBe(1);
  });

  it('direct-merges a matching shop item when backpack is full', () => {
    const store = new GameStore({ storage: new MemoryStorage(), random: () => 0.2, persist: false });
    const first = store.getSnapshot().shop[0];
    // Fill remaining slots with shields so backpack is full, keeping slot 0 as matching item
    const inv = Array.from({ length: 12 }, (_, i) => (i === 0 ? makeItem(first.kind, first.tier) : makeItem('shield', 1)));
    store.importSave(JSON.stringify({ ...store.getSnapshot(), gold: 9999, inventory: inv }));
    expect(store.canDirectMergeShopEntry(store.getSnapshot().shop[0])).toBe(true);
    expect(store.buyShopItem(0)).toBe(true);
    expect(store.getSnapshot().inventory[0]?.tier).toBe(first.tier + 1);
  });

  it('allows deterministic Gem Forge Exchange offers and bounty claims', () => {
    const store = new GameStore({ storage: new MemoryStorage(), random: () => 0.2, persist: false });
    store.importSave(JSON.stringify({ ...store.getSnapshot(), gems: 40 }));
    const oreBefore = store.getSnapshot().ore;
    expect(store.buyGemOffer('ore-pack')).toBe(true);
    expect(store.getSnapshot().ore).toBe(oreBefore + 35);

    for (let i = 0; i < 3; i += 1) {
      store.moveOrMerge(0, 1);
      store.moveOrMerge(1, 0);
    }
    const mergeBounty = store.getSnapshot().bounties.find((b) => b.kind === 'merge')!;
    // Trigger 3 real merges
    store.importSave(JSON.stringify({
      ...store.getSnapshot(),
      inventory: [makeItem('sword'), makeItem('sword'), makeItem('sword'), makeItem('sword'), makeItem('sword'), makeItem('sword'), null, null, null, null, null, null],
    }));
    store.moveOrMerge(0, 1);
    store.moveOrMerge(2, 3);
    store.moveOrMerge(4, 5);
    const updatedBounty = store.getSnapshot().bounties.find((b) => b.id === mergeBounty.id)!;
    expect(updatedBounty.progress).toBe(updatedBounty.target);
    expect(store.claimBounty(updatedBounty.id)).toBe(true);
    expect(store.getSnapshot().stats.bountiesClaimed).toBe(1);
  });

  it('unlocks Masterwork Ascension at Stage 5 and preserves Forge Marks', () => {
    const store = new GameStore({ storage: new MemoryStorage(), random: () => 0.2, persist: false });
    expect(store.canAscend()).toBe(false);
    store.importSave(JSON.stringify({ ...store.getSnapshot(), stage: 5, highestStage: 5 }));
    expect(store.canAscend()).toBe(true);
    const marks = store.ascendForge();
    expect(marks).toBeGreaterThanOrEqual(2);
    expect(store.getSnapshot().ascensions).toBe(1);
    expect(store.getSnapshot().forgeMarks).toBe(marks);
    expect(store.getSnapshot().stage).toBe(1);
  });
});

import { F7RankClient } from '../src/platform/f7RankSdk';
import {
  buildPvpSnapshot,
  computeForgePower,
  generateBotOpponents,
  loadoutFromSnapshot,
  resolveWorldBossTheme,
} from '../src/platform/online';

describe('online features: F7RankClient offline-first SDK, World Boss & Async PvP', () => {
  it('queues scores offline and flushes when network returns', async () => {
    const store = new Map<string, string>();
    let online = false;
    const mockFetch = (async (url: string) => {
      if (!online) throw new Error('Network offline');
      if (url.endsWith('/v1/auth/anon')) {
        return new Response(JSON.stringify({
          playerId: 'p1',
          gameId: 'backforge_idle',
          token: 'tok_1234567890abcdef',
          nickname: 'Smith',
          country: 'ID',
          recoveryCode: 'F7-ABCD-1234',
        }), { status: 201 });
      }
      if (url.endsWith('/v1/scores/submit')) {
        return new Response(JSON.stringify({ ok: true, results: [{ boardId: 'power', accepted: true }] }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const client = new F7RankClient({
      baseUrl: 'https://f7-rank-api.fajar-mreza.workers.dev',
      gameId: 'backforge_idle',
      storage: {
        get: (k) => store.get(k) ?? null,
        set: (k, v) => { store.set(k, v); },
      },
      fetchImpl: mockFetch,
    });

    const offlineRes = await client.submitScores([{ boardId: 'power', score: 420 }]);
    expect(offlineRes.ok).toBe(false);
    expect(await client.getPendingCount()).toBe(1);

    online = true;
    const flushRes = await client.flushQueue('Smith');
    expect(flushRes.ok).toBe(true);
    expect(flushRes.flushed).toBe(1);
    expect(await client.getPendingCount()).toBe(0);
  });

  it('builds compact PvP snapshots under 2048 bytes and valid bot opponents', () => {
    const state = createDefaultState();
    const power = computeForgePower(state);
    expect(power).toBeGreaterThanOrEqual(20);
    const snap = buildPvpSnapshot(state);
    expect(JSON.stringify(snap).length).toBeLessThan(2048);

    const bots = generateBotOpponents(power, 1000);
    expect(bots.length).toBe(3);
    const rivalLoadout = loadoutFromSnapshot(bots[0].snapshot, bots[0].power);
    expect(rivalLoadout.weapons.length).toBeGreaterThan(0);
  });

  it('maps World Boss themes to distinct BackForge Idle names', () => {
    const t1 = resolveWorldBossTheme({ bossId: 'anvil_titan', title: 'Ironcrown Anvil Titan' });
    const t2 = resolveWorldBossTheme({ bossId: 'furnace_behemoth', title: 'Grand Furnace Behemoth' });
    const t3 = resolveWorldBossTheme({ bossId: 'frostforge_automaton', title: 'Frostforge Automaton' });
    expect(t1.title).toBe('Ironcrown Anvil Titan');
    expect(t2.title).toBe('Grand Furnace Behemoth');
    expect(t3.title).toBe('Frostforge Automaton');
    expect(t1.title).not.toMatch(/Umbral|Ignis|Leviathan/);
  });
});
