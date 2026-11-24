import { calculateLoadout, ITEM_DEFS, monsterDamage, monsterHp, STAGE_WAVES } from './data';
import { chapterForStage, ENEMY_BESTIARY } from './story';
import type { GameStore } from './store';
import type { EnemyKind, HeroLoadout, ItemKind, WeaponLoadout } from './types';

export type BattlePhase = 'idle' | 'fighting' | 'won' | 'lost';

export interface BattleSnapshot {
  phase: BattlePhase;
  stage: number;
  wave: number;
  chapterTitle: string;
  heroHp: number;
  heroMaxHp: number;
  armor: number;
  enemiesRemaining: number;
  enemyTotal: number;
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  overdrive: number;
  overdriveReady: boolean;
  speed: 1 | 2;
  autoWave: boolean;
  canRevive: boolean;
}

interface BattleCallbacks {
  onSnapshot: (snapshot: BattleSnapshot) => void;
  onWaveComplete: (result: { stageCleared: boolean; boss: boolean; gold: number; ore: number }) => void;
  onDefeat: () => void;
  onEnemyDefeated: (kind: EnemyKind) => void;
  onOverdrive: () => void;
  onSound: (sound: 'sword' | 'bow' | 'hit' | 'hammer' | 'victory' | 'crit' | 'overdrive' | 'shield') => void;
}

interface Monster {
  id: number;
  kind: EnemyKind;
  isBoss: boolean;
  x: number;
  vx: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  attackTimer: number;
  attackAnimTime: number;
  attackDuration: number;
  attackHitApplied: boolean;
  animTime: number;
  burnTime: number;
  burnDps: number;
  slowTime: number;
  slowAmount: number;
  stunTime: number;
  hitFlash: number;
  dyingTime: number;
  squash: number;
  bobOffset: number;
}

interface Projectile {
  kind: 'arrow' | 'bolt';
  x: number;
  y: number;
  startX: number;
  targetX: number;
  targetId: number;
  damage: number;
  burnDps: number;
  slow: number;
  stunChance: number;
  critBonus: number;
  life: number;
}

interface Particle {
  kind: 'spark' | 'dust' | 'coin' | 'slash' | 'ring' | 'star';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface AttackAnimation {
  kind: ItemKind | 'fists';
  time: number;
  duration: number;
}

interface PendingHit {
  timer: number;
  targetId: number;
  weapon: WeaponLoadout;
  projectile: boolean;
}

type AnimationName =
  | 'hero-idle'
  | 'hero-run'
  | 'hero-sword'
  | 'hero-daggers'
  | 'hero-heavy'
  | 'hero-bow'
  | 'boar-run'
  | 'boar-attack'
  | 'scout-run'
  | 'golem-walk'
  | 'hound-run'
  | 'boss-walk'
  | 'boss-attack'
  | 'warden-walk'
  | 'dreadnought-walk';

const ANIMATION_INFO: Record<AnimationName, { frames: number; fps: number; bodyHeightRatio: number }> = {
  'hero-idle': { frames: 4, fps: 8, bodyHeightRatio: 1.033 },
  'hero-run': { frames: 4, fps: 14, bodyHeightRatio: 1.009 },
  'hero-sword': { frames: 8, fps: 13, bodyHeightRatio: 0.953 },
  'hero-daggers': { frames: 8, fps: 15, bodyHeightRatio: 1.005 },
  'hero-heavy': { frames: 8, fps: 12, bodyHeightRatio: 0.937 },
  'hero-bow': { frames: 6, fps: 12, bodyHeightRatio: 0.971 },
  'boar-run': { frames: 4, fps: 14, bodyHeightRatio: 1 },
  'boar-attack': { frames: 4, fps: 11, bodyHeightRatio: 1 },
  'scout-run': { frames: 4, fps: 14, bodyHeightRatio: 1 },
  'golem-walk': { frames: 4, fps: 10, bodyHeightRatio: 1 },
  'hound-run': { frames: 4, fps: 14, bodyHeightRatio: 1 },
  'boss-walk': { frames: 4, fps: 10, bodyHeightRatio: 1 },
  'boss-attack': { frames: 4, fps: 10, bodyHeightRatio: 1 },
  'warden-walk': { frames: 4, fps: 10, bodyHeightRatio: 1 },
  'dreadnought-walk': { frames: 4, fps: 10, bodyHeightRatio: 1 },
};

const SPRITE_PATHS: Record<'hero' | EnemyKind, string> = {
  hero: '/art/forge-knight-hero.webp',
  boar: '/art/ironbound-boar.webp',
  scout: '/art/rust-scout.webp',
  golem: '/art/cinder-sentinel.webp',
  hound: '/art/brass-stalker.webp',
  boss: '/art/forge-colossus-boss.webp',
  warden: '/art/obsidian-warden.webp',
  dreadnought: '/art/molten-dreadnought.webp',
};

function clipForWeapon(kind: ItemKind | 'fists'): AnimationName {
  if (kind === 'fists') return 'hero-idle';
  if (kind === 'daggers') return 'hero-daggers';
  if (kind === 'bow' || kind === 'crossbow') return 'hero-bow';
  if (kind === 'axe' || kind === 'hammer') return 'hero-heavy';
  return 'hero-sword';
}

function attackDuration(kind: ItemKind): number {
  const clip = clipForWeapon(kind);
  const info = ANIMATION_INFO[clip];
  return info.frames / info.fps;
}

function walkClipForEnemy(kind: EnemyKind): AnimationName {
  if (kind === 'boar') return 'boar-run';
  if (kind === 'scout') return 'scout-run';
  if (kind === 'golem') return 'golem-walk';
  if (kind === 'hound') return 'hound-run';
  if (kind === 'warden') return 'warden-walk';
  if (kind === 'dreadnought') return 'dreadnought-walk';
  return 'boss-walk';
}

function attackClipForEnemy(kind: EnemyKind): AnimationName | null {
  if (kind === 'boar') return 'boar-attack';
  if (kind === 'boss') return 'boss-attack';
  return null;
}

export class BattleEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly store: GameStore;
  private readonly callbacks: BattleCallbacks;
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly loadedClips = new Set<AnimationName>();
  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribeStore: () => void;
  private frame = 0;
  private lastTime = 0;
  private snapshotTimer = 0;
  private width = 360;
  private height = 250;
  private dpr = 1;
  private ground = 190;
  private phase: BattlePhase = 'idle';
  private activeStage = 1;
  private activeWave = 1;
  private loadout: HeroLoadout;
  private hero = {
    x: 80,
    hp: 100,
    invulnerable: 0,
    hitFlash: 0,
    bob: 0,
    animTime: 0,
    moving: false,
    squash: 0,
  };
  private monsters: Monster[] = [];
  private spawnQueue: EnemyKind[] = [];
  private enemyTotal = 0;
  private spawnTimer = 0;
  private projectiles: Projectile[] = [];
  private pendingHits: PendingHit[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private weaponTimers: number[] = [];
  private fistTimer = 0;
  private attackAnimation: AttackAnimation | null = null;
  private attackQueue: AttackAnimation[] = [];
  private nextMonsterId = 1;
  private completionPending = false;
  private clearTimer = 0;
  private stageCleared = false;
  private revivedThisWave = false;
  private shake = 0;
  private hitStop = 0;
  private overdrive = 0;
  private autoOverdriveDelay = 0;
  private ambientTimer = 0;
  private banner: { text: string; subtext: string; life: number; maxLife: number } | null = null;

  constructor(canvas: HTMLCanvasElement, store: GameStore, callbacks: BattleCallbacks) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas 2D is not available');
    this.canvas = canvas;
    this.ctx = context;
    this.store = store;
    this.callbacks = callbacks;
    const state = store.getSnapshot();
    this.activeStage = state.stage;
    this.activeWave = state.wave;
    this.loadout = calculateLoadout(state.inventory, state.talents, state.forgeMarks);
    this.hero.hp = this.loadout.maxHp;
    Object.entries(SPRITE_PATHS).forEach(([key, path]) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = path;
      this.images.set(key, image);
    });
    (
      [
        'hero-idle',
        'hero-run',
        'hero-sword',
        'hero-daggers',
        'hero-heavy',
        'hero-bow',
        'boar-run',
        'boar-attack',
        'scout-run',
      ] as AnimationName[]
    ).forEach((clip) => this.loadClip(clip));
    this.unsubscribeStore = this.store.subscribe(() => {
      const next = this.store.getSnapshot();
      const prevWeapons = this.loadout.weapons.length;
      this.loadout = calculateLoadout(next.inventory, next.talents, next.forgeMarks);
      this.hero.hp = Math.min(this.hero.hp, this.loadout.maxHp);
      if (this.loadout.weapons.length !== prevWeapons) {
        this.weaponTimers = this.loadout.weapons.map((_, idx) => this.weaponTimers[idx] ?? 0.16);
      }
      this.loadout.weapons.forEach((weapon) => this.loadClip(clipForWeapon(weapon.item.kind)));
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.frame = requestAnimationFrame(this.loop);
  }

  startWave = (): void => {
    if (this.phase === 'fighting') return;
    const state = this.store.getSnapshot();
    this.activeStage = state.stage;
    this.activeWave = state.wave;
    this.loadout = calculateLoadout(state.inventory, state.talents, state.forgeMarks);
    const chapter = chapterForStage(this.activeStage);
    this.phase = 'fighting';
    this.hero.x = this.width * 0.22;
    this.hero.hp = this.loadout.maxHp;
    this.hero.invulnerable = 1;
    this.hero.hitFlash = 0;
    this.hero.animTime = 0;
    this.hero.moving = false;
    this.hero.squash = 0;
    this.attackAnimation = null;
    this.attackQueue = [];
    this.monsters = [];
    this.projectiles = [];
    this.pendingHits = [];
    this.particles = [];
    this.floaters = [];
    this.completionPending = false;
    this.stageCleared = false;
    this.revivedThisWave = false;
    this.clearTimer = 0;
    this.autoOverdriveDelay = 0;
    this.weaponTimers = this.loadout.weapons.map((_, index) => 0.16 + index * 0.11);
    this.fistTimer = 0.35;
    this.loadout.weapons.forEach((weapon) => this.loadClip(clipForWeapon(weapon.item.kind)));

    const boss = this.activeWave % 5 === 0;
    const pool = chapter.regularPool;
    pool.forEach((k) => {
      this.loadClip(walkClipForEnemy(k));
      const atk = attackClipForEnemy(k);
      if (atk) this.loadClip(atk);
    });
    if (boss) {
      this.loadClip(walkClipForEnemy(chapter.bossKind));
      const bossAtk = attackClipForEnemy(chapter.bossKind);
      if (bossAtk) this.loadClip(bossAtk);
    }

    const count = boss ? 1 : Math.min(6, 3 + Math.floor((this.activeWave - 1) / 3));
    this.spawnQueue = Array.from({ length: count }, (_, index) => {
      if (boss) return chapter.bossKind;
      return pool[index % pool.length];
    });
    if (boss && this.activeStage > 2) {
      this.spawnQueue.push(pool[0], pool[pool.length - 1]);
    }
    this.enemyTotal = this.spawnQueue.length;
    this.spawnTimer = 0.15;
    this.banner = {
      text: boss ? 'BOSS WAVE' : `WAVE ${this.activeWave}`,
      subtext: boss ? chapter.bossTitle : `${chapter.roman} · ${chapter.title}`,
      life: 1.9,
      maxLife: 1.9,
    };
    this.emitSnapshot();
  };

  reset = (): void => {
    this.phase = 'idle';
    const state = this.store.getSnapshot();
    this.activeStage = state.stage;
    this.activeWave = state.wave;
    this.monsters = [];
    this.spawnQueue = [];
    this.projectiles = [];
    this.pendingHits = [];
    this.particles = [];
    this.floaters = [];
    this.banner = null;
    this.loadout = calculateLoadout(state.inventory, state.talents, state.forgeMarks);
    this.hero.hp = this.loadout.maxHp;
    this.hero.invulnerable = 0;
    this.hero.hitFlash = 0;
    this.hero.moving = false;
    this.hero.squash = 0;
    this.hero.x = this.width * 0.22;
    this.attackAnimation = null;
    this.attackQueue = [];
    this.weaponTimers = this.loadout.weapons.map(() => 0.16);
    this.fistTimer = 0.35;
    this.emitSnapshot();
  };

  triggerOverdrive = (): boolean => {
    if (this.phase !== 'fighting' || this.overdrive < 100) return false;
    const living = this.monsters.filter((m) => m.hp > 0 && m.dyingTime <= 0);
    if (living.length === 0) return false;

    this.overdrive = 0;
    this.autoOverdriveDelay = 0;
    const state = this.store.getSnapshot();
    this.loadClip('hero-heavy');
    this.attackAnimation = { kind: 'hammer', time: attackDuration('hammer'), duration: attackDuration('hammer') };
    this.attackQueue = [];
    this.hero.squash = 0.22;
    this.shake = 8;
    this.hitStop = 0.04;
    this.callbacks.onSound('overdrive');
    this.callbacks.onOverdrive();

    const baseTotal = Math.max(
      14,
      this.loadout.weapons.reduce((sum, w) => sum + w.damage, 0),
    );
    const slamDamage = baseTotal * 2.4 * (1 + state.talents.overdrive * 0.12);

    this.particles.push({
      kind: 'ring',
      x: this.hero.x + 36,
      y: this.ground - 16,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      size: 38,
      color: '#ffd066',
      rotation: 0,
    });
    this.burst(this.hero.x + 48, this.ground - 26, '#ffae42', 18, 'spark');

    for (const monster of living) {
      monster.stunTime = Math.max(monster.stunTime, 0.85);
      monster.vx += monster.isBoss ? 70 : 140;
      this.damageMonster(monster, slamDamage, null, true);
    }

    this.banner = {
      text: 'ANVIL STRIKE!',
      subtext: 'Forge Overdrive',
      life: 1.1,
      maxLife: 1.1,
    };
    this.emitSnapshot();
    return true;
  };

  revive = (): boolean => {
    if (this.phase !== 'lost' || this.revivedThisWave || this.activeWave % 5 !== 0) return false;
    this.revivedThisWave = true;
    this.phase = 'fighting';
    this.hero.hp = Math.round(this.loadout.maxHp * 0.65);
    this.hero.invulnerable = 2.5;
    this.monsters.forEach((monster) => {
      monster.attackTimer = 1.5;
      monster.attackAnimTime = 0;
      monster.stunTime = 0.8;
    });
    this.banner = { text: 'BACK IN THE FIGHT', subtext: 'Revived once this wave', life: 1.5, maxLife: 1.5 };
    this.emitSnapshot();
    return true;
  };

  getSnapshot = (): BattleSnapshot => {
    const chapter = chapterForStage(this.activeStage);
    const boss = this.monsters.find((monster) => monster.isBoss && monster.hp > 0);
    const bossInfo = boss ? ENEMY_BESTIARY.find((entry) => entry.kind === boss.kind) : null;
    const livingCount = this.monsters.filter((m) => m.hp > 0).length;
    return {
      phase: this.phase,
      stage: this.activeStage,
      wave: this.activeWave,
      chapterTitle: `${chapter.roman}. ${chapter.title}`,
      heroHp: Math.max(0, Math.ceil(this.hero.hp)),
      heroMaxHp: this.loadout.maxHp,
      armor: this.loadout.armor,
      enemiesRemaining: livingCount + this.spawnQueue.length,
      enemyTotal: this.enemyTotal,
      bossHp: boss ? Math.max(0, Math.ceil(boss.hp)) : 0,
      bossMaxHp: boss?.maxHp ?? 0,
      bossName: bossInfo?.name ?? chapter.bossTitle,
      overdrive: Math.min(100, Math.floor(this.overdrive)),
      overdriveReady: this.overdrive >= 100,
      speed: this.store.getSnapshot().speed,
      autoWave: this.store.getSnapshot().autoWave,
      canRevive: this.phase === 'lost' && !this.revivedThisWave && this.activeWave % 5 === 0,
    };
  };

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.unsubscribeStore();
  }

  private loadClip(name: AnimationName): void {
    if (this.loadedClips.has(name)) return;
    this.loadedClips.add(name);
    const info = ANIMATION_INFO[name];
    for (let index = 0; index < info.frames; index += 1) {
      const image = new Image();
      image.decoding = 'async';
      image.src = `/art/animations/${name}-${String(index).padStart(2, '0')}.webp`;
      this.images.set(`${name}-${index}`, image);
    }
  }

  private animationFrame(name: AnimationName, time: number): HTMLImageElement | undefined {
    const info = ANIMATION_INFO[name];
    const index = Math.floor(Math.max(0, time) * info.fps) % info.frames;
    for (let offset = 0; offset < info.frames; offset += 1) {
      const candidate = (index - offset + info.frames) % info.frames;
      const image = this.images.get(`${name}-${candidate}`);
      if (image?.complete && image.naturalWidth > 0) return image;
    }
    return undefined;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(280, rect.width);
    this.height = Math.max(180, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ground = this.height * 0.82;
    this.hero.x = Math.min(this.hero.x, this.width * 0.55);
  }

  private loop = (time: number): void => {
    const realDt = this.lastTime ? Math.min(0.05, (time - this.lastTime) / 1000) : 0;
    this.lastTime = time;
    if (!document.hidden) {
      const speed = this.store.getSnapshot().speed;
      this.update(realDt * speed);
      this.render();
      this.snapshotTimer += realDt;
      if (this.snapshotTimer >= 0.1) {
        this.snapshotTimer = 0;
        this.emitSnapshot();
      }
    }
    this.frame = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 24);
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      return;
    }

    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.65 + Math.random() * 1.1;
      this.particles.push({
        kind: 'dust',
        x: Math.random() * this.width,
        y: this.ground - Math.random() * this.height * 0.6,
        vx: 6 + Math.random() * 10,
        vy: -3 - Math.random() * 5,
        life: 2.5,
        maxLife: 2.5,
        size: 1 + Math.random() * 1.6,
        color: '#fff3c9',
        rotation: 0,
      });
    }
    this.particles = this.particles
      .filter((particle) => {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += particle.kind === 'coin' || particle.kind === 'spark' ? 170 * dt : 0;
        particle.rotation += dt * 4;
        return particle.life > 0;
      })
      .slice(-160);
    this.floaters = this.floaters
      .filter((floater) => {
        floater.life -= dt;
        floater.y -= 28 * dt;
        return floater.life > 0;
      })
      .slice(-40);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    this.hero.hitFlash = Math.max(0, this.hero.hitFlash - dt);
    this.hero.invulnerable = Math.max(0, this.hero.invulnerable - dt);
    this.hero.squash = Math.max(0, this.hero.squash - dt * 2.2);
    this.hero.bob += dt * 5;
    this.hero.animTime += dt;
    if (this.attackAnimation) {
      this.attackAnimation.time -= dt;
      if (this.attackAnimation.time <= 0) this.attackAnimation = this.attackQueue.shift() ?? null;
    }

    if (this.phase === 'won') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0 && this.store.getSnapshot().autoWave && !this.stageCleared) this.startWave();
      return;
    }
    if (this.phase !== 'fighting') return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.spawnQueue.length) {
      this.spawnMonster(this.spawnQueue.shift()!);
      this.spawnTimer = this.activeWave % 5 === 0 ? 1.05 : 0.62;
    }

    const living = this.monsters.filter((monster) => monster.hp > 0 && monster.dyingTime <= 0);
    const target = living.reduce<Monster | null>(
      (nearest, monster) => (!nearest || monster.x < nearest.x ? monster : nearest),
      null,
    );
    const hasRangedOnly = this.loadout.weapons.length > 0
      && this.loadout.weapons.every((weapon) => weapon.item.kind === 'bow' || weapon.item.kind === 'crossbow');

    if (target) {
      const desired = hasRangedOnly
        ? this.width * 0.2
        : Math.max(this.width * 0.2, Math.min(this.width * 0.52, target.x - 68));
      const distance = desired - this.hero.x;
      this.hero.moving = Math.abs(distance) > 5;
      this.hero.x += distance * Math.min(1, dt * 3.8);
    } else {
      const distance = this.width * 0.22 - this.hero.x;
      this.hero.moving = Math.abs(distance) > 5;
      this.hero.x += distance * Math.min(1, dt * 2.5);
    }

    this.hero.hp = Math.min(this.loadout.maxHp, this.hero.hp + this.loadout.healPerSecond * dt);
    this.updateWeapons(dt, target);
    this.updatePendingHits(dt);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.monsters = this.monsters.filter((monster) => monster.hp > 0 || monster.dyingTime > 0);

    // Auto-trigger Overdrive in idle mode after short readiness window
    if (this.overdrive >= 100 && living.length > 0 && this.store.getSnapshot().autoWave) {
      this.autoOverdriveDelay += dt;
      if (this.autoOverdriveDelay >= 1.1) this.triggerOverdrive();
    } else {
      this.autoOverdriveDelay = 0;
    }

    if (!this.completionPending && this.spawnQueue.length === 0 && this.monsters.length === 0) {
      this.completionPending = true;
      this.phase = 'won';
      this.hero.moving = false;
      this.attackAnimation = null;
      this.attackQueue = [];
      this.clearTimer = 1.7;
      const result = this.store.completeWave();
      this.stageCleared = result.stageCleared;
      this.banner = {
        text: result.stageCleared ? 'STAGE CLEAR' : result.boss ? 'BOSS DEFEATED' : 'WAVE CLEAR',
        subtext: `+${result.gold} Gold  +${result.ore} Ore`,
        life: 1.7,
        maxLife: 1.7,
      };
      this.burst(this.hero.x, this.ground - 70, '#f5c45c', 22, 'coin');
      this.callbacks.onSound('victory');
      this.callbacks.onWaveComplete(result);
      this.emitSnapshot();
    }
  }

  private queueAttack(kind: ItemKind | 'fists', duration: number): void {
    const animation = { kind, time: duration, duration };
    if (this.attackAnimation) {
      if (this.attackQueue.length < 2) this.attackQueue.push(animation);
    } else {
      this.attackAnimation = animation;
    }
  }

  private updateWeapons(dt: number, target: Monster | null): void {
    if (!target) return;
    if (this.loadout.weapons.length === 0) {
      this.fistTimer -= dt;
      if (this.fistTimer <= 0 && target.x - this.hero.x < 86) {
        this.fistTimer = 0.9;
        this.queueAttack('fists', 0.24);
        this.pendingHits.push({
          timer: 0.1,
          targetId: target.id,
          weapon: {
            item: { id: 'fists', kind: 'sword', tier: 1 },
            slotIndex: -1,
            damage: 7 + this.store.getSnapshot().talents.attack * 0.6,
            cooldown: 0.9,
            range: 86,
            cleave: 1,
            burnDps: 0,
            slow: 0,
            stunChance: 0,
            critBonus: 0,
            boostLabels: [],
          },
          projectile: false,
        });
      }
      return;
    }
    this.loadout.weapons.forEach((weapon, index) => {
      this.weaponTimers[index] -= dt;
      const distance = target.x - this.hero.x;
      if (this.weaponTimers[index] > 0 || distance > weapon.range) return;
      this.weaponTimers[index] = weapon.cooldown;
      const duration = attackDuration(weapon.item.kind);
      this.queueAttack(weapon.item.kind, duration);
      const isRanged = weapon.item.kind === 'bow' || weapon.item.kind === 'crossbow';
      this.pendingHits.push({
        timer: duration * (isRanged ? 0.5 : 0.38),
        targetId: target.id,
        weapon,
        projectile: isRanged,
      });
    });
  }

  private updatePendingHits(dt: number): void {
    for (let index = this.pendingHits.length - 1; index >= 0; index -= 1) {
      const hit = this.pendingHits[index];
      hit.timer -= dt;
      if (hit.timer > 0) continue;
      this.pendingHits.splice(index, 1);
      const target = this.monsters.find((monster) => monster.id === hit.targetId && monster.hp > 0 && monster.dyingTime <= 0);
      if (!target) continue;
      if (hit.projectile) {
        this.projectiles.push({
          kind: hit.weapon.item.kind === 'crossbow' ? 'bolt' : 'arrow',
          x: this.hero.x + 24,
          y: this.ground - this.height * 0.4,
          startX: this.hero.x + 24,
          targetX: target.x,
          targetId: target.id,
          damage: hit.weapon.damage,
          burnDps: hit.weapon.burnDps,
          slow: hit.weapon.slow,
          stunChance: hit.weapon.stunChance,
          critBonus: hit.weapon.critBonus,
          life: 2,
        });
        this.callbacks.onSound('bow');
      } else {
        const targets = hit.weapon.cleave > 1
          ? this.monsters
            .filter((m) => m.hp > 0 && m.dyingTime <= 0 && m.x - this.hero.x <= hit.weapon.range + 22)
            .sort((a, b) => a.x - b.x)
            .slice(0, hit.weapon.cleave)
          : [target];

        targets.forEach((foe, idx) => {
          const dmg = idx === 0 ? hit.weapon.damage : hit.weapon.damage * 0.72;
          this.damageMonster(foe, dmg, hit.weapon);
        });
        this.callbacks.onSound(hit.weapon.item.kind === 'hammer' || hit.weapon.item.kind === 'axe' ? 'hammer' : 'sword');
        if (hit.weapon.item.kind === 'hammer') this.shake = Math.max(this.shake, 4.5);
      }
    }
  }

  private updateMonsters(dt: number): void {
    for (const monster of this.monsters) {
      // Dying fade & knockback animation
      if (monster.dyingTime > 0) {
        monster.dyingTime = Math.max(0, monster.dyingTime - dt);
        monster.x += monster.vx * dt;
        monster.vx *= Math.pow(0.08, dt);
        continue;
      }

      // Knockback decay
      if (monster.vx > 0) {
        monster.x = Math.min(this.width - 12, monster.x + monster.vx * dt);
        monster.vx *= Math.pow(0.02, dt);
        if (monster.vx < 4) monster.vx = 0;
      }

      const slowMultiplier = monster.slowTime > 0 ? 1 - monster.slowAmount : 1;
      monster.animTime += dt * slowMultiplier;
      monster.squash = Math.max(0, monster.squash - dt * 3);
      monster.hitFlash = Math.max(0, monster.hitFlash - dt);
      monster.burnTime = Math.max(0, monster.burnTime - dt);
      monster.slowTime = Math.max(0, monster.slowTime - dt);
      if (monster.slowTime === 0) monster.slowAmount = 0;
      monster.stunTime = Math.max(0, monster.stunTime - dt);

      if (monster.burnTime > 0 && monster.burnDps > 0) {
        monster.hp -= monster.burnDps * dt;
        if (Math.random() < dt * 7) {
          this.particles.push({
            kind: 'spark',
            x: monster.x + (Math.random() - 0.5) * 24,
            y: this.ground - 30 - Math.random() * 40,
            vx: (Math.random() - 0.5) * 25,
            vy: -35,
            life: 0.45,
            maxLife: 0.45,
            size: 2 + Math.random() * 2,
            color: '#ef7c35',
            rotation: 0,
          });
        }
        if (monster.hp <= 0) {
          this.killMonster(monster);
          continue;
        }
      }

      if (monster.stunTime > 0) {
        monster.attackAnimTime = 0;
        monster.attackHitApplied = false;
        continue;
      }

      if (monster.attackAnimTime > 0) {
        monster.attackAnimTime = Math.max(0, monster.attackAnimTime - dt * slowMultiplier);
        const progress = 1 - monster.attackAnimTime / monster.attackDuration;
        if (!monster.attackHitApplied && progress >= 0.45) {
          monster.attackHitApplied = true;
          this.applyMonsterStrike(monster);
          if (this.phase === 'lost') break;
        }
        continue;
      }

      const distance = monster.x - this.hero.x;
      const attackRange = monster.isBoss ? 96 : monster.kind === 'boar' || monster.kind === 'hound' ? 80 : 78;
      if (distance > attackRange) {
        monster.x -= monster.speed * slowMultiplier * dt;
      } else {
        monster.attackTimer -= dt * slowMultiplier;
        if (monster.attackTimer <= 0) {
          monster.attackTimer = monster.isBoss ? 1.55 : monster.kind === 'hound' ? 0.95 : monster.kind === 'boar' ? 1.25 : 1.1;
          monster.attackDuration = monster.isBoss ? 0.68 : 0.48;
          monster.attackAnimTime = monster.attackDuration;
          monster.attackHitApplied = false;
        }
      }
    }
  }

  private applyMonsterStrike(monster: Monster): void {
    if (this.hero.invulnerable > 0 || monster.hp <= 0) return;
    const reduction = 100 / (100 + this.loadout.armor * 7);
    const damage = Math.max(1, Math.round(monster.damage * reduction));
    this.hero.hp -= damage;
    this.hero.hitFlash = 0.16;
    this.hero.squash = 0.16;
    this.overdrive = Math.min(100, this.overdrive + 9 * this.loadout.overdriveRate);
    this.shake = Math.max(this.shake, monster.isBoss ? 4.5 : 2);
    this.floaters.push({
      x: this.hero.x + 8,
      y: this.ground - this.height * 0.48,
      text: `-${damage}`,
      color: '#c8443f',
      life: 0.8,
      maxLife: 0.8,
      size: 18,
    });
    this.callbacks.onSound(this.loadout.armor >= 6 ? 'shield' : 'hit');

    if (this.loadout.thornsDamage > 0) {
      this.damageMonster(monster, this.loadout.thornsDamage, null, false);
    }

    if (this.hero.hp <= 0) {
      this.hero.hp = 0;
      this.phase = 'lost';
      this.hero.moving = false;
      this.attackAnimation = null;
      this.attackQueue = [];
      this.callbacks.onDefeat();
      this.emitSnapshot();
    }
  }

  private updateProjectiles(dt: number): void {
    this.projectiles = this.projectiles.filter((projectile) => {
      projectile.life -= dt;
      const speed = projectile.kind === 'bolt' ? 560 : 430;
      projectile.x += speed * dt;
      const target = this.monsters.find((monster) => monster.id === projectile.targetId && monster.hp > 0 && monster.dyingTime <= 0);
      if (!target) return false;
      if (projectile.x >= target.x - 18) {
        const weapon: WeaponLoadout = {
          item: { id: projectile.kind, kind: projectile.kind === 'bolt' ? 'crossbow' : 'bow', tier: 1 },
          slotIndex: -1,
          damage: projectile.damage,
          cooldown: 1,
          range: 330,
          cleave: 1,
          burnDps: projectile.burnDps,
          slow: projectile.slow,
          stunChance: projectile.stunChance,
          critBonus: projectile.critBonus,
          boostLabels: [],
        };
        this.damageMonster(target, projectile.damage, weapon);
        return false;
      }
      return projectile.life > 0 && projectile.x < this.width + 30;
    });
  }

  private damageMonster(
    monster: Monster,
    damage: number,
    weapon: WeaponLoadout | null,
    fromOverdrive = false,
  ): void {
    if (monster.hp <= 0 || monster.dyingTime > 0) return;

    const critChance = weapon ? Math.min(0.75, this.loadout.critChance + weapon.critBonus) : 0;
    const isCrit = !fromOverdrive && Math.random() < critChance;
    const rawDamage = isCrit ? damage * this.loadout.critMultiplier : damage;
    const rounded = Math.max(1, Math.round(rawDamage));

    monster.hp -= rounded;
    monster.hitFlash = 0.13;
    monster.squash = isCrit || fromOverdrive ? 0.28 : 0.15;

    const knockbackBase = weapon?.item.kind === 'hammer' || weapon?.item.kind === 'axe'
      ? 62
      : weapon?.item.kind === 'spear'
        ? 44
        : 16;
    monster.vx = Math.max(monster.vx, (monster.isBoss ? 0.35 : 1) * (isCrit ? knockbackBase * 1.4 : knockbackBase));

    if (!fromOverdrive) {
      this.overdrive = Math.min(100, this.overdrive + (isCrit ? 12 : 7.5) * this.loadout.overdriveRate);
    }

    if (weapon) {
      if (weapon.burnDps > 0) {
        monster.burnDps = Math.max(monster.burnDps, weapon.burnDps);
        monster.burnTime = 3;
      }
      if (weapon.slow > 0) {
        monster.slowTime = Math.max(monster.slowTime, 2.2);
        monster.slowAmount = Math.max(monster.slowAmount, weapon.slow);
      }
      if (weapon.stunChance > 0 && Math.random() < weapon.stunChance) {
        monster.stunTime = Math.max(monster.stunTime, 0.65);
      }
    }

    if (isCrit) {
      this.hitStop = Math.max(this.hitStop, 0.028);
      this.shake = Math.max(this.shake, 3.2);
      this.callbacks.onSound('crit');
      this.burst(monster.x, this.ground - this.height * 0.3, '#ffd24c', 8, 'star');
    }

    const color = isCrit
      ? '#ffd24c'
      : fromOverdrive
        ? '#ff9f43'
        : weapon && weapon.item.tier >= 5
          ? '#f1b93f'
          : weapon && weapon.item.tier >= 3
            ? '#c397f5'
            : '#fff8df';
    this.floaters.push({
      x: monster.x + (Math.random() - 0.5) * 14,
      y: this.ground - (monster.isBoss ? this.height * 0.58 : this.height * 0.34),
      text: isCrit ? `CRIT ${rounded}!` : String(rounded),
      color,
      life: isCrit ? 0.85 : 0.72,
      maxLife: isCrit ? 0.85 : 0.72,
      size: isCrit ? 22 : weapon && weapon.damage >= 35 ? 21 : 18,
    });
    this.particles.push({
      kind: 'slash',
      x: monster.x - 8,
      y: this.ground - this.height * 0.3,
      vx: -30,
      vy: -15,
      life: 0.2,
      maxLife: 0.2,
      size: monster.isBoss ? 38 : 26,
      color: isCrit ? '#ffd24c' : weapon?.item.kind === 'hammer' ? '#ffd27b' : '#fff4cf',
      rotation: -0.45,
    });
    this.burst(monster.x, this.ground - this.height * 0.28, '#ffe5a1', 5, 'spark');

    if (monster.hp <= 0) {
      this.killMonster(monster);
    }
  }

  private killMonster(monster: Monster): void {
    if (monster.dyingTime > 0) return;
    monster.hp = 0;
    monster.dyingTime = 0.34;
    monster.vx = monster.isBoss ? 90 : 135;
    this.callbacks.onEnemyDefeated(monster.kind);
    this.burst(
      monster.x,
      this.ground - this.height * 0.25,
      monster.isBoss ? '#f3b94f' : '#d9c49b',
      monster.isBoss ? 22 : 12,
      monster.isBoss ? 'coin' : 'dust',
    );
    if (monster.isBoss) {
      this.shake = 7;
      this.hitStop = 0.045;
    }
  }

  private spawnMonster(kind: EnemyKind): void {
    const boss = kind === 'boss' || kind === 'warden' || kind === 'dreadnought';
    const hpScale = kind === 'golem' ? 1.45 : kind === 'hound' ? 0.85 : 1;
    const speed = kind === 'boss'
      ? 17
      : kind === 'warden'
        ? 16
        : kind === 'dreadnought'
          ? 14
          : kind === 'hound'
            ? 44
            : kind === 'golem'
              ? 22
              : kind === 'boar'
                ? 35
                : 29;
    const hp = Math.round(monsterHp(this.activeStage, this.activeWave, boss) * hpScale);
    this.monsters.push({
      id: this.nextMonsterId++,
      kind,
      isBoss: boss,
      x: this.width + 28 + Math.random() * 18,
      vx: 0,
      hp,
      maxHp: hp,
      damage: monsterDamage(this.activeStage, this.activeWave, boss),
      speed,
      attackTimer: 0.22,
      attackAnimTime: 0,
      attackDuration: boss ? 0.68 : 0.42,
      attackHitApplied: false,
      animTime: Math.random(),
      burnTime: 0,
      burnDps: 0,
      slowTime: 0,
      slowAmount: 0,
      stunTime: 0,
      hitFlash: 0,
      dyingTime: 0,
      squash: 0,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }

  private burst(x: number, y: number, color: string, count: number, kind: Particle['kind']): void {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 95;
      this.particles.push({
        kind,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        life: 0.45 + Math.random() * 0.45,
        maxLife: 0.9,
        size: 2 + Math.random() * 3,
        color,
        rotation: angle,
      });
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake * 0.55);

    for (const monster of this.monsters) this.drawMonster(monster);
    this.drawHero();
    this.drawProjectiles();
    this.drawParticles();
    this.drawFloaters();
    this.drawBanner();
    ctx.restore();
  }

  private drawHero(): void {
    const ctx = this.ctx;
    const attack = this.attackAnimation;
    const clip: AnimationName = attack ? clipForWeapon(attack.kind) : this.hero.moving ? 'hero-run' : 'hero-idle';
    const animationTime = attack ? attack.duration - attack.time : this.hero.animTime;
    const image = this.animationFrame(clip, animationTime) ?? this.images.get('hero');
    const ratio = ANIMATION_INFO[clip].bodyHeightRatio;
    const spriteHeight = Math.min(this.height * 0.68, 170) * ratio;
    const spriteWidth = image?.naturalWidth ? (spriteHeight * image.naturalWidth) / image.naturalHeight : spriteHeight * 0.62;
    const progress = attack ? 1 - attack.time / attack.duration : 0;
    const isRangedAttack = attack?.kind === 'bow' || attack?.kind === 'crossbow';
    const lunge = attack
      ? Math.sin(progress * Math.PI) * (isRangedAttack ? 6 : attack.kind === 'spear' ? 22 : attack.kind === 'fists' ? 14 : 18)
      : 0;
    const tilt = attack
      ? Math.sin(progress * Math.PI) * (isRangedAttack ? -0.05 : 0.14)
      : 0;

    // Subtle idle breathing + impact squash
    const breathe = !attack && !this.hero.moving ? Math.sin(this.hero.bob * 0.7) * 0.014 : 0;
    const scaleY = 1 + breathe - this.hero.squash * 0.18;
    const scaleX = 1 - breathe + this.hero.squash * 0.16;

    ctx.save();
    ctx.globalAlpha = this.hero.invulnerable > 0 && Math.sin(this.hero.invulnerable * 18) > 0 ? 0.68 : 1;
    ctx.fillStyle = 'rgba(61, 42, 24, 0.24)';
    ctx.beginPath();
    ctx.ellipse(this.hero.x + lunge * 0.6, this.ground + 4, spriteWidth * 0.28, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (image?.complete && image.naturalWidth) {
      ctx.save();
      ctx.translate(this.hero.x + lunge, this.ground);
      ctx.rotate(tilt);
      ctx.scale(scaleX, scaleY);
      if (this.hero.hitFlash > 0) ctx.filter = 'brightness(1.65) sepia(0.25)';
      ctx.drawImage(image, -spriteWidth / 2, -spriteHeight, spriteWidth, spriteHeight);
      ctx.restore();
    }
    if (attack && attack.kind !== 'bow' && attack.kind !== 'crossbow' && attack.kind !== 'fists' && progress > 0.28 && progress < 0.72) {
      this.drawAttackArc(attack.kind, progress);
    }
    ctx.restore();
  }

  private drawMonster(monster: Monster): void {
    const ctx = this.ctx;
    const isDying = monster.dyingTime > 0;
    const isAttacking = !isDying && monster.attackAnimTime > 0;
    const attackRange = monster.isBoss ? 96 : monster.kind === 'boar' || monster.kind === 'hound' ? 80 : 78;
    const isApproaching = !isDying && !isAttacking && monster.x - this.hero.x > attackRange;
    const attackClip = isAttacking ? attackClipForEnemy(monster.kind) : null;
    const walkClip = walkClipForEnemy(monster.kind);
    const clip = attackClip ?? walkClip;
    const animationTime = attackClip
      ? monster.attackDuration - monster.attackAnimTime
      : isApproaching
        ? monster.animTime
        : 0;
    const image = this.animationFrame(clip, animationTime) ?? this.images.get(monster.kind);

    const baseHeight = monster.isBoss
      ? Math.min(this.height * 0.76, 192)
      : monster.kind === 'boar' || monster.kind === 'hound'
        ? this.height * 0.31
        : monster.kind === 'golem'
          ? this.height * 0.56
          : this.height * 0.5;
    const spriteHeight = baseHeight;
    const spriteWidth = image?.naturalWidth ? (spriteHeight * image.naturalWidth) / image.naturalHeight : spriteHeight * 0.8;

    const attackProgress = isAttacking ? 1 - monster.attackAnimTime / monster.attackDuration : 0;
    // Expressive windup + lunge + recovery for ALL enemy attacks
    let lunge = 0;
    let tilt = 0;
    if (isAttacking) {
      if (attackProgress < 0.36) {
        const w = attackProgress / 0.36;
        lunge = -w * 14;
        tilt = w * 0.16;
      } else if (attackProgress < 0.68) {
        const s = (attackProgress - 0.36) / 0.32;
        lunge = -14 + Math.sin(s * Math.PI * 0.5) * 46;
        tilt = 0.16 - s * 0.42;
      } else {
        const r = (attackProgress - 0.68) / 0.32;
        lunge = 32 * (1 - r);
        tilt = -0.26 * (1 - r);
      }
    }

    const idleBob = !isDying && !isAttacking && !isApproaching ? Math.sin(monster.animTime * 4 + monster.bobOffset) * 0.018 : 0;
    const scaleY = 1 + idleBob - monster.squash * 0.2;
    const scaleX = 1 - idleBob + monster.squash * 0.18;

    ctx.save();
    if (isDying) {
      ctx.globalAlpha = Math.max(0, monster.dyingTime / 0.34);
      tilt += (1 - monster.dyingTime / 0.34) * 0.35;
    }

    ctx.fillStyle = 'rgba(61, 42, 24, 0.22)';
    ctx.beginPath();
    ctx.ellipse(monster.x, this.ground + 3, spriteWidth * 0.33, monster.isBoss ? 9 : 6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!isDying && monster.slowTime > 0) {
      ctx.strokeStyle = 'rgba(103, 190, 219, 0.82)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(monster.x, this.ground + 2, spriteWidth * 0.38, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Telegraph warning aura during early wind-up
    if (isAttacking && attackProgress < 0.42) {
      ctx.strokeStyle = `rgba(225, 92, 58, ${0.55 * (1 - attackProgress / 0.42)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(monster.x - lunge, this.ground + 2, spriteWidth * 0.4, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (image?.complete && image.naturalWidth) {
      ctx.save();
      ctx.translate(monster.x - lunge, this.ground);
      ctx.rotate(tilt);
      ctx.scale(scaleX, scaleY);
      if (monster.hitFlash > 0) ctx.filter = 'brightness(1.9)';
      ctx.drawImage(image, -spriteWidth / 2, -spriteHeight, spriteWidth, spriteHeight);
      ctx.restore();
    }

    // Enemy strike slash arc
    if (isAttacking && attackProgress > 0.36 && attackProgress < 0.72) {
      ctx.save();
      ctx.strokeStyle = monster.isBoss ? 'rgba(255, 162, 72, 0.85)' : 'rgba(255, 224, 178, 0.85)';
      ctx.lineWidth = monster.isBoss ? 5 : 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(monster.x - lunge - 18, this.ground - spriteHeight * 0.45, monster.isBoss ? 34 : 22, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();
      ctx.restore();
    }

    // Micro HP bar for damaged non-boss monsters
    if (!isDying && !monster.isBoss && monster.hp < monster.maxHp) {
      const barW = Math.max(30, Math.min(48, spriteWidth * 0.55));
      const barX = monster.x - barW / 2;
      const barY = this.ground - spriteHeight - 10;
      ctx.fillStyle = 'rgba(38, 24, 15, 0.78)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, 6);
      ctx.fillStyle = monster.burnTime > 0 ? '#f0823d' : '#d64c44';
      ctx.fillRect(barX, barY, barW * Math.max(0, monster.hp / monster.maxHp), 4);
    }

    if (!isDying && monster.stunTime > 0) {
      ctx.fillStyle = '#f5c45c';
      for (let index = 0; index < 3; index += 1) {
        const angle = this.hero.bob * 4 + (index * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(monster.x + Math.cos(angle) * 18, this.ground - spriteHeight - 14 + Math.sin(angle) * 5, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawAttackArc(kind: ItemKind, progress: number): void {
    if (progress <= 0 || progress >= 1) return;
    const ctx = this.ctx;
    const centerX = this.hero.x + (kind === 'spear' ? 32 : 20);
    const centerY = this.ground - this.height * 0.36;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-0.65 + progress * 1.15);
    ctx.globalAlpha = Math.sin(progress * Math.PI);
    ctx.strokeStyle = kind === 'hammer' ? '#ffd079' : kind === 'spear' ? '#d7ecff' : '#fff6d8';
    ctx.lineWidth = kind === 'hammer' ? 7 : kind === 'axe' ? 8 : kind === 'spear' ? 5 : 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, kind === 'daggers' ? 27 : kind === 'hammer' ? 42 : kind === 'spear' ? 48 : 36, -0.9, 0.85);
    ctx.stroke();
    if (kind === 'daggers') {
      ctx.beginPath();
      ctx.arc(-8, 10, 25, -0.7, 0.7);
      ctx.stroke();
    }
    if (kind === 'hammer') {
      ctx.strokeStyle = 'rgba(245, 196, 92, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 38, 30 + progress * 35, 7 + progress * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawProjectiles(): void {
    const ctx = this.ctx;
    for (const projectile of this.projectiles) {
      const span = Math.max(40, projectile.targetX - projectile.startX);
      const t = Math.min(1, Math.max(0, (projectile.x - projectile.startX) / span));
      const arcY = projectile.kind === 'arrow' ? -Math.sin(t * Math.PI) * 18 : 0;
      ctx.save();
      ctx.translate(projectile.x, projectile.y + arcY);
      if (projectile.kind === 'bolt') {
        ctx.strokeStyle = 'rgba(255, 215, 130, 0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-22, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.strokeStyle = '#d9e3e8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#6f4928';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
        ctx.fillStyle = '#d9e3e8';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(5, -4);
        ctx.lineTo(5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f0c46d';
        ctx.beginPath();
        ctx.moveTo(-13, 0);
        ctx.lineTo(-18, -4);
        ctx.moveTo(-13, 0);
        ctx.lineTo(-18, 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const particle of this.particles) {
      const alpha = Math.min(1, particle.life / Math.min(particle.maxLife, 0.3));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.strokeStyle = particle.color;
      if (particle.kind === 'slash') {
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, -1.1, 1.1);
        ctx.stroke();
      } else if (particle.kind === 'ring') {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, particle.size * (1 + (1 - particle.life / particle.maxLife) * 2.4), 0, Math.PI * 2);
        ctx.stroke();
      } else if (particle.kind === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const a = (i * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * particle.size * 1.8, Math.sin(a) * particle.size * 1.8);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * particle.size * 0.55, Math.sin(a + Math.PI / 4) * particle.size * 0.55);
        }
        ctx.closePath();
        ctx.fill();
      } else if (particle.kind === 'coin') {
        ctx.beginPath();
        ctx.ellipse(0, 0, particle.size, particle.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawFloaters(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const floater of this.floaters) {
      const alpha = Math.min(1, floater.life / 0.2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${floater.size}px "Nunito Sans", sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(45, 29, 17, 0.85)';
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.restore();
    }
  }

  private drawBanner(): void {
    if (!this.banner) return;
    const ctx = this.ctx;
    const progress = 1 - this.banner.life / this.banner.maxLife;
    const alpha = Math.min(1, this.banner.life / 0.35) * Math.min(1, progress / 0.12);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    const y = this.height * 0.3 - progress * 5;
    const gradient = ctx.createLinearGradient(this.width * 0.18, 0, this.width * 0.82, 0);
    gradient.addColorStop(0, 'rgba(245, 196, 92, 0)');
    gradient.addColorStop(0.25, 'rgba(245, 196, 92, 0.9)');
    gradient.addColorStop(0.75, 'rgba(245, 196, 92, 0.9)');
    gradient.addColorStop(1, 'rgba(245, 196, 92, 0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.width * 0.15, y - 22);
    ctx.lineTo(this.width * 0.85, y - 22);
    ctx.moveTo(this.width * 0.22, y + 24);
    ctx.lineTo(this.width * 0.78, y + 24);
    ctx.stroke();
    ctx.font = '800 23px "Fraunces", serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(45, 29, 17, 0.82)';
    ctx.strokeText(this.banner.text, this.width / 2, y - 4);
    ctx.fillStyle = '#fff6d8';
    ctx.fillText(this.banner.text, this.width / 2, y - 4);
    ctx.font = '700 13px "Nunito Sans", sans-serif';
    ctx.strokeStyle = 'rgba(45, 29, 17, 0.8)';
    ctx.strokeText(this.banner.subtext, this.width / 2, y + 17);
    ctx.fillStyle = '#ffe7a8';
    ctx.fillText(this.banner.subtext, this.width / 2, y + 17);
    ctx.restore();
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshot(this.getSnapshot());
  }
}

export function weaponLabel(kind: ItemKind): string {
  return ITEM_DEFS[kind].shortName;
}

export function isBossWave(wave: number): boolean {
  return wave % 5 === 0;
}

export function finalWave(): number {
  return STAGE_WAVES;
}
