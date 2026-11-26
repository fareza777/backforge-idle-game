import type { WorldBossTheme } from '../platform/online';
import type { HeroLoadout, ItemKind, WeaponLoadout } from './types';

export type OnlineBattleMode = 'worldboss' | 'pvp';

export interface OnlineBattleSnapshot {
  mode: OnlineBattleMode;
  timeLeft: number;
  duration: number;
  totalDamage: number;
  dps: number;
  heroHp: number;
  heroMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  overdrive: number;
  overdriveReady: boolean;
  speed: 1 | 2;
  finished: boolean;
  won: boolean | null;
}

interface OnlineBattleOptions {
  mode: OnlineBattleMode;
  heroName: string;
  heroLoadout: HeroLoadout;
  overdriveTalent: number;
  worldBossTheme?: WorldBossTheme;
  rivalName?: string;
  rivalLoadout?: HeroLoadout;
  onSnapshot: (snap: OnlineBattleSnapshot) => void;
  onFinish: (result: { damage: number; won: boolean }) => void;
  onSound?: (sound: 'sword' | 'bow' | 'hit' | 'hammer' | 'victory' | 'crit' | 'overdrive') => void;
}

type ClipName =
  | 'hero-idle'
  | 'hero-run'
  | 'hero-sword'
  | 'hero-daggers'
  | 'hero-heavy'
  | 'hero-bow'
  | 'boss-walk'
  | 'boss-attack'
  | 'warden-walk'
  | 'dreadnought-walk';

const CLIP_META: Record<ClipName, { frames: number; fps: number; bodyHeightRatio: number }> = {
  'hero-idle': { frames: 4, fps: 8, bodyHeightRatio: 1.033 },
  'hero-run': { frames: 4, fps: 14, bodyHeightRatio: 1.009 },
  'hero-sword': { frames: 8, fps: 13, bodyHeightRatio: 0.953 },
  'hero-daggers': { frames: 8, fps: 15, bodyHeightRatio: 1.005 },
  'hero-heavy': { frames: 8, fps: 12, bodyHeightRatio: 0.937 },
  'hero-bow': { frames: 6, fps: 12, bodyHeightRatio: 0.971 },
  'boss-walk': { frames: 4, fps: 10, bodyHeightRatio: 1 },
  'boss-attack': { frames: 4, fps: 10, bodyHeightRatio: 1 },
  'warden-walk': { frames: 4, fps: 10, bodyHeightRatio: 1 },
  'dreadnought-walk': { frames: 4, fps: 10, bodyHeightRatio: 1 },
};

function clipForWeapon(kind: ItemKind | 'fists'): ClipName {
  if (kind === 'fists') return 'hero-idle';
  if (kind === 'daggers') return 'hero-daggers';
  if (kind === 'bow' || kind === 'crossbow') return 'hero-bow';
  if (kind === 'axe' || kind === 'hammer') return 'hero-heavy';
  return 'hero-sword';
}

function attackDuration(kind: ItemKind): number {
  const clip = clipForWeapon(kind);
  const meta = CLIP_META[clip];
  return meta.frames / meta.fps;
}

interface FighterState {
  x: number;
  hp: number;
  maxHp: number;
  moving: boolean;
  animTime: number;
  bob: number;
  hitFlash: number;
  squash: number;
  burnTime: number;
  burnDps: number;
  slowTime: number;
  slowAmount: number;
  stunTime: number;
  weaponTimers: number[];
  fistTimer: number;
  attack: { kind: ItemKind | 'fists'; time: number; duration: number } | null;
  attackQueue: { kind: ItemKind | 'fists'; time: number; duration: number }[];
  pendingHits: { timer: number; weapon: WeaponLoadout; projectile: boolean }[];
}

interface Projectile {
  fromHero: boolean;
  kind: 'arrow' | 'bolt';
  x: number;
  y: number;
  startX: number;
  targetX: number;
  damage: number;
  burnDps: number;
  slow: number;
  stunChance: number;
  critBonus: number;
  life: number;
}

interface Particle {
  kind: 'spark' | 'dust' | 'slash' | 'ring' | 'star';
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
  size: number;
}

export class OnlineBattleEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly opts: OnlineBattleOptions;
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly resizeObserver: ResizeObserver;
  private frame = 0;
  private lastTime = 0;
  private snapshotTimer = 0;
  private width = 360;
  private height = 220;
  private dpr = 1;
  private ground = 180;
  private speed: 1 | 2 = 1;
  private duration: number;
  private elapsed = 0;
  private totalDamage = 0;
  private overdrive = 0;
  private shake = 0;
  private hitStop = 0;
  private finished = false;
  private won: boolean | null = null;
  private finishNotified = false;
  private endHoldTimer = 0;

  private hero: FighterState;
  private rival: FighterState;
  private bossX = 280;
  private bossAnimTime = 0;
  private bossAttackTimer = 0.7;
  private bossAttackAnim = 0;
  private bossAttackDuration = 0.78;
  private bossHitApplied = false;
  private bossHitFlash = 0;
  private bossSquash = 0;
  private bossBurnTime = 0;
  private bossBurnDps = 0;
  private bossSlowTime = 0;
  private bossStunTime = 0;
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private ambientTimer = 0;
  private banner: { text: string; subtext: string; life: number; maxLife: number } | null = null;

  constructor(canvas: HTMLCanvasElement, options: OnlineBattleOptions) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.opts = options;
    this.duration = options.mode === 'worldboss' ? 18 : 28;

    const rivalLoadout = options.rivalLoadout ?? options.heroLoadout;
    this.hero = this.createFighter(72, options.heroLoadout);
    this.rival = this.createFighter(290, rivalLoadout);

    // Preload all hero + boss clips + portraits immediately
    (Object.keys(CLIP_META) as ClipName[]).forEach((clip) => this.loadClip(clip));
    this.loadImage('hero', '/art/forge-knight-hero.webp');
    if (options.worldBossTheme) {
      this.loadImage('worldboss', options.worldBossTheme.portrait);
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.hero.x = this.width * 0.16;
    this.rival.x = this.width * 0.84;
    this.bossX = this.width * 0.82;

    this.banner = {
      text: options.mode === 'worldboss' ? (options.worldBossTheme?.title ?? 'WORLD BOSS').toUpperCase() : 'ARENA DUEL',
      subtext: options.mode === 'worldboss' ? '18s Timed Raid' : `${options.heroName} vs ${options.rivalName ?? 'Rival'}`,
      life: 1.6,
      maxLife: 1.6,
    };

    this.emitSnapshot();
    this.frame = requestAnimationFrame(this.loop);
  }

  private createFighter(x: number, loadout: HeroLoadout): FighterState {
    return {
      x,
      hp: loadout.maxHp,
      maxHp: loadout.maxHp,
      moving: false,
      animTime: 0,
      bob: Math.random() * 6,
      hitFlash: 0,
      squash: 0,
      burnTime: 0,
      burnDps: 0,
      slowTime: 0,
      slowAmount: 0,
      stunTime: 0,
      weaponTimers: loadout.weapons.map((_, idx) => 0.14 + idx * 0.12),
      fistTimer: 0.3,
      attack: null,
      attackQueue: [],
      pendingHits: [],
    };
  }

  private loadImage(key: string, src: string): void {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    this.images.set(key, img);
  }

  private loadClip(name: ClipName): void {
    const info = CLIP_META[name];
    for (let i = 0; i < info.frames; i += 1) {
      this.loadImage(`${name}-${i}`, `/art/animations/${name}-${String(i).padStart(2, '0')}.webp`);
    }
  }

  private animationFrame(name: ClipName, time: number): HTMLImageElement | undefined {
    const info = CLIP_META[name];
    const index = Math.floor(Math.max(0, time) * info.fps) % info.frames;
    for (let offset = 0; offset < info.frames; offset += 1) {
      const candidate = (index - offset + info.frames) % info.frames;
      const img = this.images.get(`${name}-${candidate}`);
      if (img?.complete && img.naturalWidth > 0) return img;
    }
    return undefined;
  }

  setSpeed(speed: 1 | 2): void {
    this.speed = speed;
    this.emitSnapshot();
  }

  triggerOverdrive(): boolean {
    if (this.finished || this.overdrive < 100) return false;
    this.overdrive = 0;
    const dur = attackDuration('hammer');
    this.hero.attack = { kind: 'hammer', time: dur, duration: dur };
    this.hero.attackQueue = [];
    this.hero.squash = 0.24;
    this.shake = 8;
    this.hitStop = 0.04;
    this.opts.onSound?.('overdrive');

    const baseTotal = Math.max(
      18,
      this.opts.heroLoadout.weapons.reduce((s, w) => s + w.damage, 0),
    );
    const slamDmg = Math.round(baseTotal * 2.5 * (1 + this.opts.overdriveTalent * 0.12));

    const targetX = this.opts.mode === 'worldboss' ? this.bossX : this.rival.x;
    this.particles.push({
      kind: 'ring',
      x: targetX,
      y: this.ground - 20,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      size: 40,
      color: '#ffd066',
      rotation: 0,
    });
    this.burst(targetX, this.ground - 36, '#ffae42', 18, 'spark');

    if (this.opts.mode === 'worldboss') {
      this.bossStunTime = Math.max(this.bossStunTime, 0.8);
      this.applyBossDamage(slamDmg, true);
    } else {
      this.rival.stunTime = Math.max(this.rival.stunTime, 0.85);
      this.applyFighterDamage(this.rival, this.opts.rivalLoadout ?? this.opts.heroLoadout, slamDmg, null, true);
    }

    this.banner = { text: 'ANVIL STRIKE!', subtext: 'Forge Overdrive', life: 1.0, maxLife: 1.0 };
    this.emitSnapshot();
    return true;
  }

  finishNow(): void {
    if (this.finished) return;
    if (this.opts.mode === 'worldboss') {
      this.conclude(true);
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(280, rect.width);
    this.height = Math.max(180, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ground = this.height * 0.76;
  }

  private loop = (time: number): void => {
    const realDt = this.lastTime ? Math.min(0.05, (time - this.lastTime) / 1000) : 0;
    this.lastTime = time;
    if (!document.hidden) {
      this.update(realDt * this.speed);
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
      this.ambientTimer = 0.35 + Math.random() * 0.5;
      const auraColor = this.opts.mode === 'worldboss'
        ? (this.opts.worldBossTheme?.auraColor ?? '#f0b84b')
        : '#ffe8b5';
      this.particles.push({
        kind: 'dust',
        x: Math.random() * this.width,
        y: this.ground - Math.random() * this.height * 0.65,
        vx: (Math.random() - 0.5) * 14,
        vy: -8 - Math.random() * 14,
        life: 1.8,
        maxLife: 1.8,
        size: 1.3 + Math.random() * 1.8,
        color: auraColor,
        rotation: 0,
      });
    }

    this.particles = this.particles
      .filter((p) => {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.kind === 'spark' ? 160 * dt : 0;
        p.rotation += dt * 4;
        return p.life > 0;
      })
      .slice(-140);

    this.floaters = this.floaters
      .filter((f) => {
        f.life -= dt;
        f.y -= 30 * dt;
        return f.life > 0;
      })
      .slice(-36);

    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    if (this.finished) {
      this.endHoldTimer -= dt;
      if (!this.finishNotified && this.endHoldTimer <= 0) {
        this.finishNotified = true;
        this.opts.onFinish({
          damage: Math.max(10, Math.round(this.totalDamage)),
          won: Boolean(this.won),
        });
      }
      return;
    }

    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      if (this.opts.mode === 'worldboss') {
        this.conclude(true);
      } else {
        const heroPct = this.hero.hp / this.hero.maxHp;
        const rivalPct = this.rival.hp / this.rival.maxHp;
        this.conclude(heroPct >= rivalPct);
      }
      return;
    }

    this.stepFighterTimers(this.hero, this.opts.heroLoadout, dt);
    if (this.opts.mode === 'worldboss') {
      this.updateWorldBossMode(dt);
    } else {
      this.stepFighterTimers(this.rival, this.opts.rivalLoadout ?? this.opts.heroLoadout, dt);
      this.updatePvpMode(dt);
    }
    this.updateProjectiles(dt);
  }

  private stepFighterTimers(f: FighterState, loadout: HeroLoadout, dt: number): void {
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    f.squash = Math.max(0, f.squash - dt * 2.4);
    f.bob += dt * 5;
    f.animTime += dt;
    f.burnTime = Math.max(0, f.burnTime - dt);
    f.slowTime = Math.max(0, f.slowTime - dt);
    if (f.slowTime === 0) f.slowAmount = 0;
    f.stunTime = Math.max(0, f.stunTime - dt);
    f.hp = Math.min(f.maxHp, f.hp + loadout.healPerSecond * dt);

    if (f.burnTime > 0 && f.burnDps > 0) {
      f.hp = Math.max(0, f.hp - f.burnDps * dt);
    }

    if (f.attack) {
      f.attack.time -= dt;
      if (f.attack.time <= 0) f.attack = f.attackQueue.shift() ?? null;
    }
  }

  private queueFighterAttack(f: FighterState, kind: ItemKind | 'fists', duration: number): void {
    const anim = { kind, time: duration, duration };
    if (f.attack) {
      if (f.attackQueue.length < 2) f.attackQueue.push(anim);
    } else {
      f.attack = anim;
    }
  }

  private updateWorldBossMode(dt: number): void {
    const heroTargetX = this.width * 0.42;
    const bossTargetX = this.width * 0.66;

    const heroDist = heroTargetX - this.hero.x;
    this.hero.moving = Math.abs(heroDist) > 4;
    this.hero.x += heroDist * Math.min(1, dt * 3.6);

    const bossDist = bossTargetX - this.bossX;
    if (Math.abs(bossDist) > 4) {
      this.bossX += bossDist * Math.min(1, dt * 2.8);
    }

    // World boss timers & animated attacks
    const slowMul = this.bossSlowTime > 0 ? 0.72 : 1;
    this.bossAnimTime += dt * slowMul;
    this.bossHitFlash = Math.max(0, this.bossHitFlash - dt);
    this.bossSquash = Math.max(0, this.bossSquash - dt * 2.4);
    this.bossBurnTime = Math.max(0, this.bossBurnTime - dt);
    this.bossSlowTime = Math.max(0, this.bossSlowTime - dt);
    this.bossStunTime = Math.max(0, this.bossStunTime - dt);

    if (this.bossBurnTime > 0 && this.bossBurnDps > 0) {
      const tick = this.bossBurnDps * dt;
      this.totalDamage += tick;
      if (Math.random() < dt * 7) {
        this.particles.push({
          kind: 'spark',
          x: this.bossX + (Math.random() - 0.5) * 32,
          y: this.ground - 40 - Math.random() * 55,
          vx: (Math.random() - 0.5) * 26,
          vy: -40,
          life: 0.45,
          maxLife: 0.45,
          size: 2.3,
          color: '#ef7c35',
          rotation: 0,
        });
      }
    }

    if (this.bossStunTime <= 0) {
      if (this.bossAttackAnim > 0) {
        this.bossAttackAnim = Math.max(0, this.bossAttackAnim - dt * slowMul);
        const progress = 1 - this.bossAttackAnim / this.bossAttackDuration;
        if (!this.bossHitApplied && progress >= 0.46) {
          this.bossHitApplied = true;
          this.shake = Math.max(this.shake, 5.5);
          this.hero.hitFlash = 0.16;
          this.hero.squash = 0.18;
          this.overdrive = Math.min(100, this.overdrive + 14 * this.opts.heroLoadout.overdriveRate);
          this.opts.onSound?.('hit');
          this.burst(this.hero.x + 28, this.ground - 36, this.opts.worldBossTheme?.auraColor ?? '#f0b84b', 10, 'spark');
          this.particles.push({
            kind: 'ring',
            x: this.bossX - 42,
            y: this.ground - 8,
            vx: 0,
            vy: 0,
            life: 0.35,
            maxLife: 0.35,
            size: 26,
            color: this.opts.worldBossTheme?.auraColor ?? '#f0b84b',
            rotation: 0,
          });
        }
      } else if (Math.abs(bossDist) <= 12) {
        this.bossAttackTimer -= dt * slowMul;
        if (this.bossAttackTimer <= 0) {
          this.bossAttackTimer = 1.65;
          this.bossAttackAnim = this.bossAttackDuration;
          this.bossHitApplied = false;
        }
      }
    }

    // Hero weapon swings against World Boss
    const dist = this.bossX - this.hero.x;
    const loadout = this.opts.heroLoadout;
    if (loadout.weapons.length === 0) {
      this.hero.fistTimer -= dt;
      if (this.hero.fistTimer <= 0 && dist < 135) {
        this.hero.fistTimer = 0.85;
        this.queueFighterAttack(this.hero, 'fists', 0.28);
        this.applyBossDamage(9, false);
      }
    } else {
      loadout.weapons.forEach((weapon, idx) => {
        this.hero.weaponTimers[idx] -= dt;
        if (this.hero.weaponTimers[idx] > 0 || dist > Math.max(weapon.range, 145)) return;
        this.hero.weaponTimers[idx] = weapon.cooldown;
        const dur = attackDuration(weapon.item.kind);
        this.queueFighterAttack(this.hero, weapon.item.kind, dur);
        const isRanged = weapon.item.kind === 'bow' || weapon.item.kind === 'crossbow';
        this.hero.pendingHits.push({
          timer: dur * (isRanged ? 0.5 : 0.38),
          weapon,
          projectile: isRanged,
        });
      });
    }

    for (let i = this.hero.pendingHits.length - 1; i >= 0; i -= 1) {
      const hit = this.hero.pendingHits[i];
      hit.timer -= dt;
      if (hit.timer > 0) continue;
      this.hero.pendingHits.splice(i, 1);
      if (hit.projectile) {
        this.projectiles.push({
          fromHero: true,
          kind: hit.weapon.item.kind === 'crossbow' ? 'bolt' : 'arrow',
          x: this.hero.x + 24,
          y: this.ground - this.height * 0.4,
          startX: this.hero.x + 24,
          targetX: this.bossX,
          damage: hit.weapon.damage,
          burnDps: hit.weapon.burnDps,
          slow: hit.weapon.slow,
          stunChance: hit.weapon.stunChance,
          critBonus: hit.weapon.critBonus,
          life: 2,
        });
        this.opts.onSound?.('bow');
      } else {
        this.applyBossDamage(hit.weapon.damage, false, hit.weapon);
        this.opts.onSound?.(hit.weapon.item.kind === 'hammer' || hit.weapon.item.kind === 'axe' ? 'hammer' : 'sword');
      }
    }
  }

  private updatePvpMode(dt: number): void {
    const heroLoadout = this.opts.heroLoadout;
    const rivalLoadout = this.opts.rivalLoadout ?? heroLoadout;

    const heroRangedOnly = heroLoadout.weapons.length > 0
      && heroLoadout.weapons.every((w) => w.item.kind === 'bow' || w.item.kind === 'crossbow');
    const rivalRangedOnly = rivalLoadout.weapons.length > 0
      && rivalLoadout.weapons.every((w) => w.item.kind === 'bow' || w.item.kind === 'crossbow');

    const heroDesired = heroRangedOnly ? this.width * 0.24 : Math.min(this.width * 0.43, this.rival.x - 66);
    const rivalDesired = rivalRangedOnly ? this.width * 0.76 : Math.max(this.width * 0.57, this.hero.x + 66);

    const hd = heroDesired - this.hero.x;
    this.hero.moving = Math.abs(hd) > 5;
    this.hero.x += hd * Math.min(1, dt * 3.8);

    const rd = rivalDesired - this.rival.x;
    this.rival.moving = Math.abs(rd) > 5;
    this.rival.x += rd * Math.min(1, dt * 3.8);

    const distance = this.rival.x - this.hero.x;

    // Hero attacks Rival
    if (this.hero.stunTime <= 0) {
      this.stepFighterWeapons(this.hero, heroLoadout, distance, true, dt);
    }
    // Rival attacks Hero
    if (this.rival.stunTime <= 0) {
      const slowMul = this.rival.slowTime > 0 ? 1 - this.rival.slowAmount : 1;
      this.stepFighterWeapons(this.rival, rivalLoadout, distance, false, dt * slowMul);
    }

    if (this.rival.hp <= 0) {
      this.conclude(true);
    } else if (this.hero.hp <= 0) {
      this.conclude(false);
    }
  }

  private stepFighterWeapons(
    attacker: FighterState,
    attackerLoadout: HeroLoadout,
    distance: number,
    isHero: boolean,
    dt: number,
  ): void {
    if (attackerLoadout.weapons.length === 0) {
      attacker.fistTimer -= dt;
      if (attacker.fistTimer <= 0 && distance <= 96) {
        attacker.fistTimer = 0.85;
        this.queueFighterAttack(attacker, 'fists', 0.26);
        const target = isHero ? this.rival : this.hero;
        const targetLoadout = isHero ? (this.opts.rivalLoadout ?? this.opts.heroLoadout) : this.opts.heroLoadout;
        this.applyFighterDamage(target, targetLoadout, 9, null, false, isHero);
      }
    } else {
      attackerLoadout.weapons.forEach((weapon, idx) => {
        attacker.weaponTimers[idx] -= dt;
        if (attacker.weaponTimers[idx] > 0 || distance > Math.max(weapon.range, 92)) return;
        attacker.weaponTimers[idx] = weapon.cooldown;
        const dur = attackDuration(weapon.item.kind);
        this.queueFighterAttack(attacker, weapon.item.kind, dur);
        const isRanged = weapon.item.kind === 'bow' || weapon.item.kind === 'crossbow';
        attacker.pendingHits.push({
          timer: dur * (isRanged ? 0.5 : 0.38),
          weapon,
          projectile: isRanged,
        });
      });
    }

    for (let i = attacker.pendingHits.length - 1; i >= 0; i -= 1) {
      const hit = attacker.pendingHits[i];
      hit.timer -= dt;
      if (hit.timer > 0) continue;
      attacker.pendingHits.splice(i, 1);
      if (hit.projectile) {
        this.projectiles.push({
          fromHero: isHero,
          kind: hit.weapon.item.kind === 'crossbow' ? 'bolt' : 'arrow',
          x: attacker.x + (isHero ? 24 : -24),
          y: this.ground - this.height * 0.4,
          startX: attacker.x + (isHero ? 24 : -24),
          targetX: isHero ? this.rival.x : this.hero.x,
          damage: hit.weapon.damage,
          burnDps: hit.weapon.burnDps,
          slow: hit.weapon.slow,
          stunChance: hit.weapon.stunChance,
          critBonus: hit.weapon.critBonus,
          life: 2,
        });
        this.opts.onSound?.('bow');
      } else {
        const target = isHero ? this.rival : this.hero;
        const targetLoadout = isHero ? (this.opts.rivalLoadout ?? this.opts.heroLoadout) : this.opts.heroLoadout;
        this.applyFighterDamage(target, targetLoadout, hit.weapon.damage, hit.weapon, false, isHero);
        this.opts.onSound?.(hit.weapon.item.kind === 'hammer' || hit.weapon.item.kind === 'axe' ? 'hammer' : 'sword');
      }
    }
  }

  private updateProjectiles(dt: number): void {
    this.projectiles = this.projectiles.filter((p) => {
      p.life -= dt;
      const speed = p.kind === 'bolt' ? 540 : 420;
      p.x += (p.fromHero ? 1 : -1) * speed * dt;
      const targetX = this.opts.mode === 'worldboss' ? this.bossX : p.fromHero ? this.rival.x : this.hero.x;
      const hit = p.fromHero ? p.x >= targetX - 18 : p.x <= targetX + 18;
      if (hit) {
        const syntheticWeapon: WeaponLoadout = {
          item: { id: p.kind, kind: p.kind === 'bolt' ? 'crossbow' : 'bow', tier: 1 },
          slotIndex: -1,
          damage: p.damage,
          cooldown: 1,
          range: 340,
          cleave: 1,
          burnDps: p.burnDps,
          slow: p.slow,
          stunChance: p.stunChance,
          critBonus: p.critBonus,
          boostLabels: [],
        };
        if (this.opts.mode === 'worldboss') {
          this.applyBossDamage(p.damage, false, syntheticWeapon);
        } else {
          const target = p.fromHero ? this.rival : this.hero;
          const targetLoadout = p.fromHero ? (this.opts.rivalLoadout ?? this.opts.heroLoadout) : this.opts.heroLoadout;
          this.applyFighterDamage(target, targetLoadout, p.damage, syntheticWeapon, false, p.fromHero);
        }
        return false;
      }
      return p.life > 0 && p.x > -30 && p.x < this.width + 30;
    });
  }

  private applyBossDamage(damage: number, fromOverdrive: boolean, weapon?: WeaponLoadout): void {
    const critChance = weapon ? Math.min(0.75, this.opts.heroLoadout.critChance + weapon.critBonus) : 0;
    const isCrit = !fromOverdrive && Math.random() < critChance;
    const rounded = Math.max(1, Math.round(isCrit ? damage * this.opts.heroLoadout.critMultiplier : damage));
    this.totalDamage += rounded;
    this.bossHitFlash = 0.12;
    this.bossSquash = isCrit || fromOverdrive ? 0.25 : 0.12;

    if (!fromOverdrive) {
      this.overdrive = Math.min(100, this.overdrive + (isCrit ? 12 : 8) * this.opts.heroLoadout.overdriveRate);
    }
    if (weapon) {
      if (weapon.burnDps > 0) {
        this.bossBurnDps = Math.max(this.bossBurnDps, weapon.burnDps);
        this.bossBurnTime = 3;
      }
      if (weapon.slow > 0) this.bossSlowTime = Math.max(this.bossSlowTime, 2.2);
    }
    if (isCrit) {
      this.hitStop = Math.max(this.hitStop, 0.025);
      this.shake = Math.max(this.shake, 3);
      this.opts.onSound?.('crit');
      this.burst(this.bossX, this.ground - this.height * 0.45, '#ffd24c', 8, 'star');
    }

    this.floaters.push({
      x: this.bossX + (Math.random() - 0.5) * 24,
      y: this.ground - this.height * 0.58,
      text: isCrit ? `CRIT ${rounded}!` : String(rounded),
      color: isCrit ? '#ffd24c' : fromOverdrive ? '#ff9f43' : '#fff8df',
      life: 0.78,
      size: isCrit || fromOverdrive ? 22 : 18,
    });
    this.particles.push({
      kind: 'slash',
      x: this.bossX - 18,
      y: this.ground - this.height * 0.36,
      vx: -25,
      vy: -12,
      life: 0.2,
      maxLife: 0.2,
      size: 36,
      color: isCrit ? '#ffd24c' : '#fff4cf',
      rotation: -0.45,
    });
    this.burst(this.bossX - 10, this.ground - this.height * 0.35, '#ffe5a1', 5, 'spark');
  }

  private applyFighterDamage(
    target: FighterState,
    targetLoadout: HeroLoadout,
    damage: number,
    weapon: WeaponLoadout | null,
    fromOverdrive: boolean,
    fromHero = true,
  ): void {
    const attackerLoadout = fromHero ? this.opts.heroLoadout : (this.opts.rivalLoadout ?? this.opts.heroLoadout);
    const critChance = weapon ? Math.min(0.75, attackerLoadout.critChance + weapon.critBonus) : 0;
    const isCrit = !fromOverdrive && Math.random() < critChance;
    const raw = isCrit ? damage * attackerLoadout.critMultiplier : damage;
    const reduction = 100 / (100 + targetLoadout.armor * 7);
    const finalDmg = Math.max(1, Math.round(raw * reduction));

    target.hp = Math.max(0, target.hp - finalDmg);
    target.hitFlash = 0.13;
    target.squash = isCrit || fromOverdrive ? 0.26 : 0.14;
    if (fromHero) {
      this.totalDamage += finalDmg;
      if (!fromOverdrive) this.overdrive = Math.min(100, this.overdrive + (isCrit ? 13 : 8.5) * attackerLoadout.overdriveRate);
    } else {
      this.overdrive = Math.min(100, this.overdrive + 9 * this.opts.heroLoadout.overdriveRate);
    }

    if (weapon) {
      if (weapon.burnDps > 0) {
        target.burnDps = Math.max(target.burnDps, weapon.burnDps);
        target.burnTime = 3;
      }
      if (weapon.slow > 0) {
        target.slowTime = Math.max(target.slowTime, 2.2);
        target.slowAmount = Math.max(target.slowAmount, weapon.slow);
      }
      if (weapon.stunChance > 0 && Math.random() < weapon.stunChance) {
        target.stunTime = Math.max(target.stunTime, 0.6);
      }
    }

    if (isCrit) {
      this.hitStop = Math.max(this.hitStop, 0.025);
      this.shake = Math.max(this.shake, 3);
      this.opts.onSound?.('crit');
      this.burst(target.x, this.ground - this.height * 0.34, '#ffd24c', 8, 'star');
    }

    this.floaters.push({
      x: target.x + (Math.random() - 0.5) * 16,
      y: this.ground - this.height * 0.48,
      text: isCrit ? `CRIT ${finalDmg}!` : `-${finalDmg}`,
      color: fromHero ? (isCrit ? '#ffd24c' : '#fff8df') : '#e55c55',
      life: 0.75,
      size: isCrit ? 21 : 17,
    });
    this.particles.push({
      kind: 'slash',
      x: target.x,
      y: this.ground - this.height * 0.35,
      vx: fromHero ? 20 : -20,
      vy: -10,
      life: 0.2,
      maxLife: 0.2,
      size: 26,
      color: isCrit ? '#ffd24c' : '#fff4cf',
      rotation: fromHero ? -0.45 : 0.45,
    });
  }

  private conclude(won: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.won = won;
    this.endHoldTimer = 1.1;
    this.hero.moving = false;
    this.rival.moving = false;
    this.opts.onSound?.('victory');
    this.banner = {
      text: this.opts.mode === 'worldboss' ? 'RAID COMPLETE' : won ? 'DUEL VICTORY!' : 'DUEL DEFEAT',
      subtext: this.opts.mode === 'worldboss' ? `${Math.round(this.totalDamage).toLocaleString()} Total Damage` : won ? 'Arena Rating Up' : 'Reforge & Try Again',
      life: 1.4,
      maxLife: 1.4,
    };
    this.burst(won ? this.hero.x : this.rival.x, this.ground - 60, '#f5c45c', 22, 'star');
    this.emitSnapshot();
  }

  private burst(x: number, y: number, color: string, count: number, kind: Particle['kind']): void {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const spd = 35 + Math.random() * 95;
      this.particles.push({
        kind,
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 35,
        life: 0.45 + Math.random() * 0.4,
        maxLife: 0.85,
        size: 2 + Math.random() * 2.8,
        color,
        rotation: a,
      });
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake * 0.55);

    if (this.opts.mode === 'worldboss') {
      this.drawWorldBoss();
    } else {
      this.drawKnight(this.rival, false, this.finished && this.won === true);
    }
    this.drawKnight(this.hero, true, this.finished && this.won === false);
    this.drawProjectiles();
    this.drawParticles();
    this.drawFloaters();
    this.drawBanner();
    ctx.restore();
  }

  private drawKnight(f: FighterState, isHero: boolean, defeated: boolean): void {
    const ctx = this.ctx;
    const attack = f.attack;
    const clip: ClipName = attack ? clipForWeapon(attack.kind) : f.moving ? 'hero-run' : 'hero-idle';
    const animTime = attack ? attack.duration - attack.time : f.animTime;
    const image = this.animationFrame(clip, animTime) ?? this.images.get('hero');
    const ratio = CLIP_META[clip].bodyHeightRatio;
    const spriteH = Math.min(this.height * 0.48, 124) * ratio;
    const spriteW = image?.naturalWidth ? (spriteH * image.naturalWidth) / image.naturalHeight : spriteH * 0.62;
    const progress = attack ? 1 - attack.time / attack.duration : 0;
    const isRanged = attack?.kind === 'bow' || attack?.kind === 'crossbow';
    const dir = isHero ? 1 : -1;
    const lunge = attack ? Math.sin(progress * Math.PI) * (isRanged ? 6 : 18) * dir : 0;
    const tilt = (attack ? Math.sin(progress * Math.PI) * (isRanged ? -0.05 : 0.14) : 0) + (defeated ? 0.32 : 0);
    const breathe = !attack && !f.moving ? Math.sin(f.bob * 0.7) * 0.015 : 0;
    const scaleY = 1 + breathe - f.squash * 0.18;
    const scaleX = 1 - breathe + f.squash * 0.16;

    ctx.save();
    if (defeated) ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(42, 26, 15, 0.25)';
    ctx.beginPath();
    ctx.ellipse(f.x + lunge * 0.5, this.ground + 4, spriteW * 0.28, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (f.slowTime > 0) {
      ctx.strokeStyle = 'rgba(103, 190, 219, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(f.x, this.ground + 2, spriteW * 0.34, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (image?.complete && image.naturalWidth) {
      ctx.save();
      ctx.translate(f.x + lunge, this.ground);
      ctx.rotate(tilt * dir);
      ctx.scale(scaleX * dir, scaleY);
      if (f.hitFlash > 0) {
        ctx.filter = 'brightness(1.75)';
      } else if (!isHero) {
        ctx.filter = 'hue-rotate(195deg) saturate(1.18)';
      }
      ctx.drawImage(image, -spriteW / 2, -spriteH, spriteW, spriteH);
      ctx.restore();
    }

    if (attack && attack.kind !== 'bow' && attack.kind !== 'crossbow' && attack.kind !== 'fists' && progress > 0.26 && progress < 0.74) {
      ctx.save();
      ctx.translate(f.x + 22 * dir, this.ground - this.height * 0.36);
      ctx.scale(dir, 1);
      ctx.rotate(-0.6 + progress * 1.15);
      ctx.globalAlpha = Math.sin(progress * Math.PI);
      ctx.strokeStyle = isHero ? '#fff6d8' : '#b4e4ff';
      ctx.lineWidth = attack.kind === 'hammer' || attack.kind === 'axe' ? 7 : 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, attack.kind === 'daggers' ? 26 : 36, -0.9, 0.85);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawWorldBoss(): void {
    const ctx = this.ctx;
    const theme = this.opts.worldBossTheme;
    const walkClip = theme?.walkClip ?? 'dreadnought-walk';
    const isAttacking = this.bossAttackAnim > 0;
    const clip = isAttacking && theme?.attackClip ? theme.attackClip : walkClip;
    const progress = isAttacking ? 1 - this.bossAttackAnim / this.bossAttackDuration : 0;
    const animTime = isAttacking && theme?.attackClip ? progress * this.bossAttackDuration : this.bossAnimTime;
    const image = this.animationFrame(clip, animTime) ?? this.images.get('worldboss');

    const spriteH = Math.min(this.height * 0.58, 152);
    const spriteW = image?.naturalWidth ? (spriteH * image.naturalWidth) / image.naturalHeight : spriteH * 0.85;

    let lunge = 0;
    let tilt = 0;
    if (isAttacking) {
      if (progress < 0.36) {
        const w = progress / 0.36;
        lunge = -w * 18;
        tilt = w * 0.16;
      } else if (progress < 0.68) {
        const s = (progress - 0.36) / 0.32;
        lunge = -18 + Math.sin(s * Math.PI * 0.5) * 56;
        tilt = 0.16 - s * 0.42;
      } else {
        const r = (progress - 0.68) / 0.32;
        lunge = 38 * (1 - r);
        tilt = -0.26 * (1 - r);
      }
    }

    const breathe = !isAttacking ? Math.sin(this.bossAnimTime * 4) * 0.02 : 0;
    const scaleY = 1 + breathe - this.bossSquash * 0.18;
    const scaleX = 1 - breathe + this.bossSquash * 0.16;
    const aura = theme?.auraColor ?? '#f0b84b';

    ctx.save();
    // Elemental ground aura ring
    ctx.strokeStyle = aura;
    ctx.globalAlpha = 0.45 + Math.sin(this.bossAnimTime * 5) * 0.15;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(this.bossX - lunge * 0.5, this.ground + 3, spriteW * 0.42, 11, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(32, 18, 10, 0.3)';
    ctx.beginPath();
    ctx.ellipse(this.bossX - lunge * 0.5, this.ground + 4, spriteW * 0.36, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isAttacking && progress < 0.42) {
      ctx.strokeStyle = `rgba(232, 82, 52, ${0.65 * (1 - progress / 0.42)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.bossX - lunge, this.ground + 3, spriteW * 0.46, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (image?.complete && image.naturalWidth) {
      ctx.save();
      ctx.translate(this.bossX - lunge, this.ground);
      ctx.rotate(tilt);
      ctx.scale(scaleX, scaleY);
      if (this.bossHitFlash > 0) ctx.filter = 'brightness(1.85)';
      ctx.drawImage(image, -spriteW / 2, -spriteH, spriteW, spriteH);
      ctx.restore();
    }

    if (isAttacking && progress > 0.36 && progress < 0.72) {
      ctx.strokeStyle = aura;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(this.bossX - lunge - 26, this.ground - spriteH * 0.45, 38, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawProjectiles(): void {
    const ctx = this.ctx;
    for (const p of this.projectiles) {
      const dir = p.fromHero ? 1 : -1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(dir, 1);
      ctx.strokeStyle = p.kind === 'bolt' ? '#d9e3e8' : '#6f4928';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.fillStyle = p.fromHero ? '#ffe49d' : '#8ed6ff';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(6, -4);
      ctx.lineTo(6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / Math.min(p.maxLife, 0.3));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.kind === 'slash') {
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, -1.1, 1.1);
        ctx.stroke();
      } else if (p.kind === 'ring') {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 + (1 - p.life / p.maxLife) * 2.3), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const a = (i * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * p.size * 1.7, Math.sin(a) * p.size * 1.7);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * p.size * 0.55, Math.sin(a + Math.PI / 4) * p.size * 0.55);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawFloaters(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life / 0.22);
      ctx.font = `800 ${f.size}px "Nunito Sans", sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(40, 24, 12, 0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  private drawBanner(): void {
    if (!this.banner) return;
    const ctx = this.ctx;
    const progress = 1 - this.banner.life / this.banner.maxLife;
    const alpha = Math.min(1, this.banner.life / 0.3) * Math.min(1, progress / 0.12);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    const y = this.height * 0.46;
    ctx.font = '800 20px "Fraunces", serif';
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = 'rgba(35, 21, 12, 0.85)';
    ctx.strokeText(this.banner.text, this.width / 2, y);
    ctx.fillStyle = '#fff4d4';
    ctx.fillText(this.banner.text, this.width / 2, y);
    ctx.font = '700 12px "Nunito Sans", sans-serif';
    ctx.strokeText(this.banner.subtext, this.width / 2, y + 18);
    ctx.fillStyle = '#ffd98e';
    ctx.fillText(this.banner.subtext, this.width / 2, y + 18);
    ctx.restore();
  }

  private emitSnapshot(): void {
    const elapsedSafe = Math.max(0.5, this.elapsed);
    this.opts.onSnapshot({
      mode: this.opts.mode,
      timeLeft: Math.max(0, this.duration - this.elapsed),
      duration: this.duration,
      totalDamage: Math.round(this.totalDamage),
      dps: Math.round(this.totalDamage / elapsedSafe),
      heroHp: Math.max(0, Math.ceil(this.hero.hp)),
      heroMaxHp: this.hero.maxHp,
      enemyHp: this.opts.mode === 'worldboss' ? Math.max(0, 1) : Math.max(0, Math.ceil(this.rival.hp)),
      enemyMaxHp: this.opts.mode === 'worldboss' ? 1 : this.rival.maxHp,
      overdrive: Math.min(100, Math.floor(this.overdrive)),
      overdriveReady: this.overdrive >= 100,
      speed: this.speed,
      finished: this.finished,
      won: this.won,
    });
  }
}
