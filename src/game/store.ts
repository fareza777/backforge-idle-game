import {
  ACHIEVEMENTS,
  BASE_COLUMNS,
  BASE_ROWS,
  createDefaultState,
  createStarterInventory,
  GEM_SHOP_OFFERS,
  inventoryCapacity,
  ITEM_DEFS,
  makeItem,
  MAX_TIER,
  nextBountyAfter,
  offlineRewardFor,
  salvageValue,
  shopPrice,
  shopTierForStage,
  STAGE_WAVES,
  TALENT_INFO,
  talentCost,
  waveReward,
} from './data';
import { loadState, normalizeState, saveState, type StorageLike } from './save';
import type {
  BountyProgress,
  EnemyKind,
  GameSettings,
  GameState,
  OfflineReward,
  RewardedAction,
  ShopEntry,
  Talents,
  Theme,
} from './types';

export interface GameEvent {
  type: 'merge' | 'buy' | 'reward' | 'achievement' | 'error' | 'wave' | 'smelt';
  message: string;
}

interface StoreOptions {
  storage?: StorageLike | null;
  now?: () => number;
  random?: () => number;
  persist?: boolean;
}

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAILY_REWARDS = [
  { gold: 80, ore: 3, gems: 0 },
  { gold: 120, ore: 5, gems: 0 },
  { gold: 0, ore: 8, gems: 3 },
  { gold: 180, ore: 8, gems: 0 },
  { gold: 0, ore: 12, gems: 5 },
  { gold: 260, ore: 12, gems: 0 },
  { gold: 400, ore: 20, gems: 15 },
] as const;

export class GameStore {
  private state: GameState;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(event: GameEvent) => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly storage: StorageLike | null;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly persist: boolean;
  private pendingOffline: OfflineReward | null = null;

  constructor(options: StoreOptions = {}) {
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.persist = options.persist ?? true;
    const loaded = loadState(this.storage, this.now());
    this.state = loaded.state;
    this.recovered = loaded.recovered;
    const capacity = inventoryCapacity(this.state.talents, this.state.tempExtraSlot);
    this.state.inventory = Array.from(
      { length: Math.max(capacity, this.state.inventory.length) },
      (_, index) => this.state.inventory[index] ?? null,
    );
    if (this.state.shop.length === 0) this.state.shop = this.generateShop();
    const elapsed = Math.max(0, Math.floor((this.now() - this.state.lastSeen) / 1000));
    if (elapsed >= 60) {
      const rewards = offlineRewardFor(elapsed, this.state.stage, this.state.wave, this.state.forgeMarks);
      this.pendingOffline = { seconds: elapsed, ...rewards };
    }
    this.checkAchievements(true);
  }

  recovered = false;

  getSnapshot = (): GameState => this.state;

  getOfflineReward = (): OfflineReward | null => this.pendingOffline;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onEvent = (listener: (event: GameEvent) => void): (() => void) => {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  };

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  private event(type: GameEvent['type'], message: string): void {
    this.eventListeners.forEach((listener) => listener({ type, message }));
  }

  private scheduleSave(): void {
    if (!this.persist || !this.storage) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persistNow(), 120);
  }

  persistNow(): boolean {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    return saveState(this.storage, this.state);
  }

  touchSeen(): void {
    this.state = { ...this.state, lastSeen: this.now() };
    this.persistNow();
  }

  private makeShopEntry(): ShopEntry {
    const source = this.shopPoolForStage();
    const maxTier = shopTierForStage(this.state.stage);
    const kind = source[Math.floor(this.random() * source.length)] ?? 'sword';
    const tier = 1 + Math.floor(this.random() * maxTier);
    return {
      id: makeItem(kind, tier).id,
      kind,
      tier,
      price: shopPrice(tier, this.state.stage),
    };
  }

  private shopPoolForStage(): ShopEntry['kind'][] {
    const pool: ShopEntry['kind'][] = [
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
    if (this.state.stage === 1) return pool.filter((kind) => kind !== 'hammer' && kind !== 'crossbow');
    return pool;
  }

  private generateShop(): ShopEntry[] {
    const shop: ShopEntry[] = [];
    for (let index = 0; index < 3; index += 1) {
      let entry = this.makeShopEntry();
      let attempts = 0;
      while (shop.some((existing) => existing.kind === entry.kind) && attempts < 10) {
        entry = this.makeShopEntry();
        attempts += 1;
      }
      shop.push(entry);
    }
    return shop;
  }

  private advanceBounty(kind: BountyProgress['kind'], amount = 1): BountyProgress[] {
    return this.state.bounties.map((bounty) => {
      if (bounty.kind !== kind || bounty.progress >= bounty.target) return bounty;
      return { ...bounty, progress: Math.min(bounty.target, bounty.progress + amount) };
    });
  }

  private recordHighestTier(kind: ShopEntry['kind'], tier: number): GameState['highestTierForged'] {
    const prev = this.state.highestTierForged[kind] ?? 0;
    if (tier <= prev) return this.state.highestTierForged;
    return { ...this.state.highestTierForged, [kind]: tier };
  }

  moveOrMerge(from: number, to: number): 'merged' | 'moved' | 'swapped' | 'none' {
    if (from === to || from < 0 || to < 0) return 'none';
    const inventory = [...this.state.inventory];
    const source = inventory[from];
    if (!source) return 'none';
    const target = inventory[to];
    if (!target) {
      inventory[to] = source;
      inventory[from] = null;
      this.state = { ...this.state, inventory };
      this.emit();
      this.scheduleSave();
      return 'moved';
    }
    if (source.kind === target.kind && source.tier === target.tier && source.tier < MAX_TIER) {
      const nextTier = source.tier + 1;
      inventory[to] = makeItem(source.kind, nextTier);
      inventory[from] = null;
      const stats = { ...this.state.stats, merges: this.state.stats.merges + 1 };
      this.state = {
        ...this.state,
        inventory,
        gold: this.state.gold + source.tier * 4,
        ore: this.state.ore + 1,
        stats,
        bounties: this.advanceBounty('merge', 1),
        highestTierForged: this.recordHighestTier(source.kind, nextTier),
        onboardingStep: this.state.onboardingStep === 0 ? 1 : this.state.onboardingStep,
      };
      this.checkAchievements(true);
      this.event('merge', `${ITEM_DEFS[source.kind].name} merged into Tier ${nextTier}`);
      this.emit();
      this.scheduleSave();
      return 'merged';
    }
    inventory[from] = target;
    inventory[to] = source;
    this.state = { ...this.state, inventory };
    this.emit();
    this.scheduleSave();
    return 'swapped';
  }

  canDirectMergeShopEntry(entry: ShopEntry): boolean {
    if (entry.tier >= MAX_TIER) return false;
    const cap = inventoryCapacity(this.state.talents, this.state.tempExtraSlot);
    return this.state.inventory.slice(0, cap).some((item) => item?.kind === entry.kind && item.tier === entry.tier);
  }

  buyShopItem(index: number): boolean {
    const entry = this.state.shop[index];
    if (!entry) return false;
    if (this.state.gold < entry.price) {
      this.event('error', 'Not enough Gold for that item.');
      return false;
    }
    const cap = inventoryCapacity(this.state.talents, this.state.tempExtraSlot);
    const emptyIndex = this.state.inventory.findIndex((item, slot) => !item && slot < cap);

    if (emptyIndex < 0) {
      const mergeIndex = entry.tier < MAX_TIER
        ? this.state.inventory.findIndex((item, slot) => slot < cap && item?.kind === entry.kind && item.tier === entry.tier)
        : -1;
      if (mergeIndex < 0) {
        this.event('error', 'Your backpack is full. Merge or smelt an item first.');
        return false;
      }
      const nextTier = entry.tier + 1;
      const inventory = [...this.state.inventory];
      inventory[mergeIndex] = makeItem(entry.kind, nextTier);
      const shop = [...this.state.shop];
      shop[index] = this.makeShopEntry();
      this.state = {
        ...this.state,
        gold: this.state.gold - entry.price + entry.tier * 4,
        ore: this.state.ore + 1,
        inventory,
        shop,
        stats: { ...this.state.stats, merges: this.state.stats.merges + 1 },
        bounties: this.advanceBounty('merge', 1),
        highestTierForged: this.recordHighestTier(entry.kind, nextTier),
      };
      this.checkAchievements(true);
      this.event('merge', `Direct-merged ${ITEM_DEFS[entry.kind].name} into Tier ${nextTier}!`);
      this.emit();
      this.scheduleSave();
      return true;
    }

    const inventory = [...this.state.inventory];
    inventory[emptyIndex] = makeItem(entry.kind, entry.tier);
    const shop = [...this.state.shop];
    shop[index] = this.makeShopEntry();
    this.state = {
      ...this.state,
      gold: this.state.gold - entry.price,
      inventory,
      shop,
      highestTierForged: this.recordHighestTier(entry.kind, entry.tier),
    };
    this.event('buy', `${ITEM_DEFS[entry.kind].name} added to your backpack`);
    this.emit();
    this.scheduleSave();
    return true;
  }

  salvageItem(index: number): boolean {
    const item = this.state.inventory[index];
    if (!item) return false;
    const cap = inventoryCapacity(this.state.talents, this.state.tempExtraSlot);
    if (index < 0 || index >= cap) return false;
    const reward = salvageValue(item, this.state.stage);
    const inventory = [...this.state.inventory];
    inventory[index] = null;
    this.state = {
      ...this.state,
      gold: this.state.gold + reward.gold,
      ore: this.state.ore + reward.ore,
      inventory,
      stats: { ...this.state.stats, salvages: this.state.stats.salvages + 1 },
      bounties: this.advanceBounty('salvage', 1),
    };
    this.checkAchievements(true);
    this.event('smelt', `Smelted ${ITEM_DEFS[item.kind].shortName} T${item.tier} → +${reward.gold} Gold, +${reward.ore} Ore`);
    this.emit();
    this.scheduleSave();
    return true;
  }

  refreshShop(free = false): boolean {
    const cost = Math.min(90, 18 + this.state.refreshCount * 3);
    if (!free && this.state.gold < cost) {
      this.event('error', 'Not enough Gold to refresh the Forge Shop.');
      return false;
    }
    this.state = {
      ...this.state,
      gold: this.state.gold - (free ? 0 : cost),
      refreshCount: this.state.refreshCount + 1,
      shop: this.generateShop(),
    };
    this.event('reward', free ? 'Fresh stock — rewarded refresh complete.' : 'The Forge Shop has fresh stock.');
    this.emit();
    this.scheduleSave();
    return true;
  }

  buyGemOffer(offerId: 'ore-pack' | 'gold-vault' | 'temper-gear'): boolean {
    const offer = GEM_SHOP_OFFERS.find((o) => o.id === offerId);
    if (!offer) return false;
    if (this.state.gems < offer.gems) {
      this.event('error', `Need ${offer.gems} Gems for ${offer.name}.`);
      return false;
    }
    if (offerId === 'ore-pack') {
      this.state = { ...this.state, gems: this.state.gems - offer.gems, ore: this.state.ore + 35 };
      this.event('reward', 'Iron Ore Ingots claimed (+35 Ore).');
    } else if (offerId === 'gold-vault') {
      const goldGain = Math.round((220 + this.state.stage * 95) * (1 + this.state.forgeMarks * 0.1));
      this.state = { ...this.state, gems: this.state.gems - offer.gems, gold: this.state.gold + goldGain };
      this.event('reward', `Caravan Gold Vault opened (+${goldGain} Gold).`);
    } else {
      const cap = inventoryCapacity(this.state.talents, this.state.tempExtraSlot);
      const emptyIndex = this.state.inventory.findIndex((item, slot) => !item && slot < cap);
      if (emptyIndex < 0) {
        this.event('error', 'Free a backpack slot before forging a Tier 3 blade.');
        return false;
      }
      const kind = this.state.stage >= 2 ? 'spear' : 'sword';
      const inventory = [...this.state.inventory];
      inventory[emptyIndex] = makeItem(kind, 3);
      this.state = {
        ...this.state,
        gems: this.state.gems - offer.gems,
        inventory,
        highestTierForged: this.recordHighestTier(kind, 3),
      };
      this.checkAchievements(true);
      this.event('reward', `Forged Tier 3 ${ITEM_DEFS[kind].name} into your pack!`);
    }
    this.emit();
    this.scheduleSave();
    return true;
  }

  recordEnemyDefeat(kind: EnemyKind): void {
    const prev = this.state.stats.defeatedByKind[kind] ?? 0;
    const stats = {
      ...this.state.stats,
      enemies: this.state.stats.enemies + 1,
      defeatedByKind: { ...this.state.stats.defeatedByKind, [kind]: prev + 1 },
    };
    this.state = {
      ...this.state,
      stats,
      bounties: this.advanceBounty('enemies', 1),
    };
    this.checkAchievements(true);
    this.emit();
    this.scheduleSave();
  }

  recordOverdrive(): void {
    this.state = {
      ...this.state,
      stats: { ...this.state.stats, overdrives: this.state.stats.overdrives + 1 },
      bounties: this.advanceBounty('overdrive', 1),
    };
    this.checkAchievements(true);
    this.emit();
    this.scheduleSave();
  }

  claimBounty(id: string): boolean {
    const index = this.state.bounties.findIndex((b) => b.id === id);
    if (index < 0) return false;
    const target = this.state.bounties[index];
    if (target.progress < target.target) return false;
    const otherKinds = this.state.bounties.filter((_, i) => i !== index).map((b) => b.kind);
    const replacement = nextBountyAfter(target, otherKinds, this.state.stage);
    const bounties = [...this.state.bounties];
    bounties[index] = replacement;
    this.state = {
      ...this.state,
      gold: this.state.gold + target.rewardGold,
      ore: this.state.ore + target.rewardOre,
      gems: this.state.gems + target.rewardGems,
      bounties,
      stats: { ...this.state.stats, bountiesClaimed: this.state.stats.bountiesClaimed + 1 },
    };
    this.checkAchievements(true);
    this.event(
      'reward',
      `Bounty claimed: +${target.rewardGold} Gold, +${target.rewardOre} Ore, +${target.rewardGems} Gems`,
    );
    this.emit();
    this.scheduleSave();
    return true;
  }

  canAscend(): boolean {
    return this.state.highestStage >= 5;
  }

  ascensionMarksReward(): number {
    if (!this.canAscend()) return 0;
    return Math.max(2, this.state.highestStage - 3 + Math.floor(this.state.stats.bosses / 3));
  }

  ascendForge(): number {
    if (!this.canAscend()) return 0;
    const gained = this.ascensionMarksReward();
    const cap = inventoryCapacity(this.state.talents, false);
    const starter = createStarterInventory();
    const inventory = Array.from({ length: cap }, (_, i) => starter[i] ?? null);
    this.state = {
      ...this.state,
      gold: 200 + this.state.forgeMarks * 40,
      stage: 1,
      wave: 1,
      ascensions: this.state.ascensions + 1,
      forgeMarks: this.state.forgeMarks + gained,
      inventory,
      refreshCount: 0,
      tempExtraSlot: false,
      shop: this.generateShop(),
    };
    this.checkAchievements(true);
    this.event('achievement', `Masterwork Reforge complete! +${gained} Forge Marks earned.`);
    this.emit();
    this.persistNow();
    return gained;
  }

  completeWave(): { stageCleared: boolean; boss: boolean; gold: number; ore: number } {
    const boss = this.state.wave % 5 === 0;
    const reward = waveReward(this.state.stage, this.state.wave, this.state.talents.gold, this.state.forgeMarks);
    const stageCleared = this.state.wave >= STAGE_WAVES;
    const nextStage = stageCleared ? this.state.stage + 1 : this.state.stage;
    const nextWave = stageCleared ? 1 : this.state.wave + 1;
    const stats = {
      ...this.state.stats,
      waves: this.state.stats.waves + 1,
      bosses: this.state.stats.bosses + (boss ? 1 : 0),
    };
    this.state = {
      ...this.state,
      gold: this.state.gold + reward.gold,
      ore: this.state.ore + reward.ore,
      stage: nextStage,
      wave: nextWave,
      highestStage: Math.max(this.state.highestStage, nextStage),
      stats,
      bounties: this.advanceBounty('waves', 1),
      refreshCount: stageCleared ? 0 : this.state.refreshCount,
      shop: stageCleared ? this.generateShop() : this.state.shop,
      tempExtraSlot: stageCleared ? false : this.state.tempExtraSlot,
      onboardingStep: this.state.onboardingStep === 2 ? 3 : this.state.onboardingStep,
      onboardingDone: this.state.onboardingStep === 2 ? true : this.state.onboardingDone,
    };
    this.checkAchievements(true);
    this.event('wave', stageCleared ? `Stage ${this.state.stage - 1} cleared!` : `Wave ${this.state.wave} is ready.`);
    this.emit();
    this.scheduleSave();
    return { stageCleared, boss, ...reward };
  }

  setAutoWave(value: boolean): void {
    if (this.state.autoWave === value) return;
    this.state = { ...this.state, autoWave: value };
    this.emit();
    this.scheduleSave();
  }

  setSpeed(speed: 1 | 2): void {
    if (this.state.speed === speed) return;
    this.state = { ...this.state, speed };
    this.emit();
    this.scheduleSave();
  }

  updateSettings(patch: Partial<GameSettings>): void {
    this.state = { ...this.state, settings: { ...this.state.settings, ...patch } };
    this.emit();
    this.scheduleSave();
  }

  setTheme(theme: Theme): void {
    this.updateSettings({ theme });
  }

  upgradeTalent(talent: keyof Talents): boolean {
    const level = this.state.talents[talent];
    if (level >= TALENT_INFO[talent].max) return false;
    const cost = talentCost(talent, level);
    if (this.state.ore < cost) {
      this.event('error', 'Not enough Ore for that Forge Talent.');
      return false;
    }
    const talents = { ...this.state.talents, [talent]: level + 1 };
    const capacity = inventoryCapacity(talents, this.state.tempExtraSlot);
    const inventory = Array.from(
      { length: Math.max(capacity, this.state.inventory.length) },
      (_, index) => this.state.inventory[index] ?? null,
    );
    this.state = { ...this.state, ore: this.state.ore - cost, talents, inventory };
    this.event('reward', `${TALENT_INFO[talent].name} upgraded.`);
    this.emit();
    this.scheduleSave();
    return true;
  }

  claimDaily(): { gold: number; ore: number; gems: number; day: number } | null {
    const now = new Date(this.now());
    const today = dateKey(now);
    if (this.state.dailyLastClaim === today) return null;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const streak = this.state.dailyLastClaim === dateKey(yesterday)
      ? Math.min(7, this.state.dailyStreak + 1)
      : 1;
    const reward = DAILY_REWARDS[streak - 1];
    this.state = {
      ...this.state,
      gold: this.state.gold + reward.gold,
      ore: this.state.ore + reward.ore,
      gems: this.state.gems + reward.gems,
      dailyLastClaim: today,
      dailyStreak: streak,
    };
    this.event('reward', `Day ${streak} reward claimed.`);
    this.emit();
    this.scheduleSave();
    return { ...reward, day: streak };
  }

  claimOffline(double = false): OfflineReward | null {
    const pending = this.pendingOffline;
    if (!pending) return null;
    const multiplier = double ? 2 : 1;
    const claimed = {
      seconds: pending.seconds,
      gold: pending.gold * multiplier,
      ore: pending.ore * multiplier,
    };
    this.state = {
      ...this.state,
      gold: this.state.gold + claimed.gold,
      ore: this.state.ore + claimed.ore,
      lastSeen: this.now(),
    };
    this.pendingOffline = null;
    this.event('reward', double ? 'Idle Forge rewards doubled.' : 'Idle Forge rewards claimed.');
    this.emit();
    this.scheduleSave();
    return claimed;
  }

  grantRewarded(action: RewardedAction): void {
    if (action === 'extra-slot') {
      if (this.state.tempExtraSlot) return;
      const inventory = [...this.state.inventory, null];
      this.state = { ...this.state, tempExtraSlot: true, inventory };
      this.event('reward', 'One extra backpack slot unlocked for this stage.');
    } else if (action === 'free-refresh') {
      this.refreshShop(true);
      return;
    }
    this.emit();
    this.scheduleSave();
  }

  setRemoveAds(value: boolean): void {
    if (this.state.removeAds === value) return;
    this.state = { ...this.state, removeAds: value };
    this.emit();
    this.scheduleSave();
  }

  markPrologueSeen(): void {
    if (this.state.prologueSeen) return;
    this.state = { ...this.state, prologueSeen: true };
    this.emit();
    this.scheduleSave();
  }

  markChapterSeen(stage: number): void {
    if (this.state.seenChapters.includes(stage)) return;
    this.state = { ...this.state, seenChapters: [...this.state.seenChapters, stage] };
    this.emit();
    this.scheduleSave();
  }

  advanceOnboarding(): void {
    if (this.state.onboardingDone) return;
    const onboardingStep = Math.min(3, this.state.onboardingStep + 1);
    this.state = { ...this.state, onboardingStep, onboardingDone: onboardingStep >= 3 };
    this.emit();
    this.scheduleSave();
  }

  finishOnboarding(): void {
    if (this.state.onboardingDone) return;
    this.state = { ...this.state, prologueSeen: true, onboardingStep: 3, onboardingDone: true };
    this.emit();
    this.scheduleSave();
  }

  addPlaySeconds(seconds: number): void {
    const rounded = Math.max(0, Math.floor(seconds));
    if (!rounded) return;
    this.state = { ...this.state, stats: { ...this.state.stats, playSeconds: this.state.stats.playSeconds + rounded } };
    this.emit();
    this.scheduleSave();
  }

  private checkAchievements(grantRewards: boolean): void {
    const earned = new Set<string>();
    if (this.state.stats.merges >= 1) earned.add('first-merge');
    if (this.state.stats.waves >= 1) earned.add('first-wave');
    if (this.state.stats.bosses >= 1) earned.add('boss-one');
    if (this.state.highestStage >= 2) earned.add('stage-two');
    if (this.state.highestStage >= 4) earned.add('stage-four');
    if (this.state.highestStage >= 5) earned.add('stage-five');
    if (this.state.highestStage >= 8) earned.add('stage-eight');
    const maxTier = Math.max(
      ...Object.values(this.state.highestTierForged).map((t) => t ?? 0),
      ...this.state.inventory.map((item) => item?.tier ?? 0),
      0,
    );
    if (maxTier >= 3) earned.add('rare-gear');
    if (maxTier >= 4) earned.add('epic-gear');
    if (maxTier >= 5) earned.add('legendary-gear');
    if (this.state.stats.merges >= 20) earned.add('merge-twenty');
    if (this.state.stats.enemies >= 100) earned.add('enemy-hundred');
    if (this.state.stats.overdrives >= 10) earned.add('overdrive-ten');
    if (this.state.stats.bountiesClaimed >= 5) earned.add('bounty-five');
    if (this.state.stats.salvages >= 5) earned.add('smelt-five');
    if (this.state.ascensions >= 1) earned.add('first-ascension');

    const fresh = [...earned].filter((id) => !this.state.achievements.includes(id));
    if (!fresh.length) return;
    const gems = fresh.reduce((sum, id) => sum + (ACHIEVEMENTS.find((entry) => entry.id === id)?.gems ?? 0), 0);
    this.state = {
      ...this.state,
      achievements: [...this.state.achievements, ...fresh],
      gems: this.state.gems + (grantRewards ? gems : 0),
    };
    if (grantRewards) {
      const achievement = ACHIEVEMENTS.find((entry) => entry.id === fresh[0]);
      this.event('achievement', achievement ? `${achievement.name} unlocked — +${gems} Gems` : 'Achievement unlocked.');
    }
  }

  exportSave(): string {
    return JSON.stringify(this.state, null, 2);
  }

  importSave(text: string): boolean {
    try {
      const raw: unknown = JSON.parse(text);
      if (!raw || typeof raw !== 'object' || !('inventory' in raw)) return false;
      this.state = normalizeState(raw);
      const capacity = inventoryCapacity(this.state.talents, this.state.tempExtraSlot);
      this.state.inventory = Array.from(
        { length: Math.max(capacity, this.state.inventory.length) },
        (_, index) => this.state.inventory[index] ?? null,
      );
      if (this.state.shop.length === 0) this.state.shop = this.generateShop();
      this.pendingOffline = null;
      this.emit();
      this.scheduleSave();
      return true;
    } catch {
      return false;
    }
  }

  reset(): void {
    this.state = createDefaultState(this.now());
    this.state.shop = this.generateShop();
    this.pendingOffline = null;
    this.emit();
    this.persistNow();
  }

  dispose(): void {
    this.persistNow();
    this.listeners.clear();
    this.eventListeners.clear();
  }
}

export const INITIAL_CAPACITY = BASE_COLUMNS * BASE_ROWS;
