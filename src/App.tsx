import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { calculateLoadout, inventoryCapacity, ITEM_DEFS, RARITY_COLORS, STAGE_WAVES } from './game/data';
import { GameAudio } from './game/audio';
import { BattleEngine, type BattleSnapshot } from './game/battle';
import { chapterForStage, PROLOGUE_STORY } from './game/story';
import { GameStore } from './game/store';
import {
  voClipForChapterBoss,
  voClipForChapterChronicle,
  voClipForChapterIntro,
  type VoiceClipId,
} from './game/voice';
import type { GameSettings, ModalName, RewardedAction, Theme } from './game/types';
import {
  hideBannerAd,
  initializeBilling,
  initializeNative,
  isNativePlatform,
  purchaseRemoveAds,
  rateGame,
  restoreRemoveAds,
  shareGame,
  showBannerAd,
  showInterstitialAtBreak,
  showPrivacyOptions,
  showRewardedAd,
  updateAdMute,
} from './platform/native';
import { Backpack, type MoveResult } from './ui/Backpack';
import { Icon, type IconName } from './ui/Icons';
import { Modal } from './ui/Modal';
import {
  AchievementsPanel,
  BountiesPanel,
  CodexPanel,
  DailyPanel,
  GuidePanel,
  SettingsContent,
  ShopPanel,
  TalentsPanel,
} from './ui/MenuPanels';
import { OnlinePanel } from './ui/OnlinePanel';
import { syncRankings } from './platform/online';

type NavView = 'battle' | 'talents' | 'codex' | 'shop' | 'arena';
type OpenModal = Exclude<ModalName, null>;
type SplashStep = 'mecha' | 'f7' | 'done';

interface WaveResult {
  stageCleared: boolean;
  boss: boolean;
  gold: number;
  ore: number;
}

interface ToastMessage {
  id: number;
  text: string;
  tone: 'normal' | 'success' | 'error';
}

const navItems: { value: NavView; label: string; icon: IconName }[] = [
  { value: 'battle', label: 'Battle', icon: 'sword' },
  { value: 'talents', label: 'Talents', icon: 'anvil' },
  { value: 'codex', label: 'Codex', icon: 'book' },
  { value: 'arena', label: 'Arena', icon: 'trophy' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
];

function localDateKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const capped = Math.min(12 * 60 * 60, Math.max(0, Math.floor(seconds)));
  const hours = Math.floor(capped / 3600);
  const minutes = Math.floor((capped % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

function formatNumber(value: number): string {
  return value >= 10000 ? `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k` : String(Math.round(value));
}

function initialSnapshot(store: GameStore): BattleSnapshot {
  const state = store.getSnapshot();
  const loadout = calculateLoadout(state.inventory, state.talents, state.forgeMarks);
  const chapter = chapterForStage(state.stage);
  return {
    phase: 'idle',
    stage: state.stage,
    wave: state.wave,
    chapterTitle: `${chapter.roman}. ${chapter.title}`,
    heroHp: loadout.maxHp,
    heroMaxHp: loadout.maxHp,
    armor: loadout.armor,
    enemiesRemaining: 0,
    enemyTotal: 0,
    bossHp: 0,
    bossMaxHp: 0,
    bossName: chapter.bossTitle,
    overdrive: 0,
    overdriveReady: false,
    speed: state.speed,
    autoWave: state.autoWave,
    canRevive: false,
  };
}

export default function App() {
  const [store] = useState(() => new GameStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [view, setView] = useState<NavView>('battle');
  const [modal, setModal] = useState<OpenModal | null>(null);
  const [splash, setSplash] = useState<SplashStep>('mecha');
  const [f7VideoFailed, setF7VideoFailed] = useState(false);
  const [battle, setBattle] = useState<BattleSnapshot>(() => initialSnapshot(store));
  const [waveResult, setWaveResult] = useState<WaveResult | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [dispatchBanner, setDispatchBanner] = useState<{ title: string; quote: string } | null>(null);
  const [rewardBusy, setRewardBusy] = useState<RewardedAction | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [nativeAdSpace, setNativeAdSpace] = useState(false);
  const [activeVoice, setActiveVoice] = useState<VoiceClipId | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BattleEngine | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const lastOnboardVoRef = useRef<number>(-1);
  const lastModalVoRef = useRef<string>('');
  if (!audioRef.current) audioRef.current = new GameAudio(state.settings);

  const loadout = useMemo(
    () => calculateLoadout(state.inventory, state.talents, state.forgeMarks),
    [state.forgeMarks, state.inventory, state.talents],
  );
  const chapter = useMemo(() => chapterForStage(battle.stage), [battle.stage]);
  const capacity = inventoryCapacity(state.talents, state.tempExtraSlot);
  const usedSlots = state.inventory.slice(0, capacity).filter(Boolean).length;
  const inventoryFull = usedSlots === capacity;
  const refreshCost = Math.min(90, 18 + state.refreshCount * 3);
  const dailyReady = state.dailyLastClaim !== localDateKey();
  const readyBounties = state.bounties.filter((b) => b.progress >= b.target).length;
  const hasMenuAlert = dailyReady || readyBounties > 0;

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'normal') => {
    setToast({ id: Date.now() + Math.random(), text, tone });
  }, []);

  const press = useCallback(() => {
    audioRef.current?.unlock();
    audioRef.current?.play('click');
  }, []);

  const haptic = useCallback((pattern: number | number[] = 12) => {
    if (store.getSnapshot().settings.haptics && isNativePlatform) navigator.vibrate?.(pattern);
  }, [store]);

  const applyRemoveAds = useCallback(() => {
    store.setRemoveAds(true);
    void hideBannerAd();
    showToast('Remove Ads is active. Enjoy the quiet forge.', 'success');
  }, [showToast, store]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!dispatchBanner) return;
    const timer = setTimeout(() => setDispatchBanner(null), 7500);
    return () => clearTimeout(timer);
  }, [dispatchBanner]);

  useEffect(() => {
    if (splash === 'mecha') {
      const timer = setTimeout(() => setSplash('f7'), 1450);
      return () => clearTimeout(timer);
    }
    if (splash === 'f7') {
      const timer = setTimeout(() => setSplash('done'), f7VideoFailed ? 1700 : 5200);
      return () => clearTimeout(timer);
    }
  }, [f7VideoFailed, splash]);

  useEffect(() => {
    if (splash !== 'done') return;
    if (store.getOfflineReward()) {
      setModal('offline');
    } else if (!store.getSnapshot().prologueSeen) {
      setModal('prologue');
    }
  }, [splash, store]);

  useEffect(() => {
    if (splash !== 'done') return;
    if (!state.seenChapters.includes(state.stage)) {
      const info = chapterForStage(state.stage);
      store.markChapterSeen(state.stage);
      setDispatchBanner({ title: `Chapter ${info.roman} · ${info.title}`, quote: info.introQuote });
      audioRef.current?.playVoice(voClipForChapterIntro(state.stage));
    }
  }, [splash, state.seenChapters, state.stage, store]);

  useEffect(() => {
    const unsub = audioRef.current?.subscribeVoice(setActiveVoice);
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (splash !== 'done' || modal !== null) return;
    if (state.onboardingDone || state.onboardingStep >= 3) return;
    if (lastOnboardVoRef.current === state.onboardingStep) return;
    lastOnboardVoRef.current = state.onboardingStep;
    audioRef.current?.playVoice(`onboard-${state.onboardingStep}` as VoiceClipId);
  }, [modal, splash, state.onboardingDone, state.onboardingStep]);

  useEffect(() => {
    if (splash !== 'done') return;
    if (modal === 'prologue' && lastModalVoRef.current !== 'prologue') {
      lastModalVoRef.current = 'prologue';
      audioRef.current?.playVoice('prologue');
    } else if (modal === 'stage-clear' && lastModalVoRef.current !== `clear-${state.stage}`) {
      lastModalVoRef.current = `clear-${state.stage}`;
      audioRef.current?.playVoice(voClipForChapterChronicle(Math.max(1, state.stage - 1)));
    } else if (modal === 'defeat' && lastModalVoRef.current !== `defeat-${Date.now().toString().slice(0, -3)}`) {
      lastModalVoRef.current = `defeat-${Date.now().toString().slice(0, -3)}`;
      audioRef.current?.playVoice('defeat');
    } else if (modal === null) {
      lastModalVoRef.current = '';
    }
  }, [modal, splash, state.stage]);

  useEffect(() => {
    if (store.recovered) showToast('Your last safe forge backup was restored.', 'success');
    const unlock = () => audioRef.current?.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    const playTimer = setInterval(() => store.addPlaySeconds(15), 15000);
    const persist = () => store.persistNow();
    const touch = () => {
      store.touchSeen();
      if (document.hidden) audioRef.current?.stopVoice();
    };
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', touch);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('beforeunload', persist);
      document.removeEventListener('visibilitychange', touch);
      clearInterval(playTimer);
    };
  }, [showToast, store]);

  useEffect(() => store.onEvent((event) => {
    if (event.type === 'error') {
      audioRef.current?.play('error');
      showToast(event.message, 'error');
    } else if (event.type === 'merge') {
      audioRef.current?.play('merge');
      haptic([12, 25, 18]);
      showToast(event.message, 'success');
    } else if (event.type === 'smelt') {
      audioRef.current?.play('smelt');
      haptic(10);
      showToast(event.message, 'success');
    } else if (event.type === 'buy') {
      audioRef.current?.play('coin');
      haptic();
      showToast(event.message, 'success');
    } else if (event.type === 'achievement') {
      audioRef.current?.play('victory');
      showToast(event.message, 'success');
    }
  }), [haptic, showToast, store]);

  useEffect(() => {
    audioRef.current?.updateSettings(state.settings);
    document.documentElement.dataset.theme = state.settings.theme;
    const themeColor = state.settings.theme === 'dark' ? '#15120F' : state.settings.theme === 'warm' ? '#3B2418' : '#F4E8CF';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    const volume = state.settings.sfx
      ? state.settings.sfxVolume
      : state.settings.voice
        ? state.settings.voiceVolume
        : state.settings.ambience
          ? state.settings.ambienceVolume
          : 0;
    void updateAdMute(!state.settings.sfx && !state.settings.ambience && !state.settings.voice, volume);
  }, [state.settings]);

  useEffect(() => {
    const handleAdSpace = (event: Event) => setNativeAdSpace(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener('backpack-forge:ad-space', handleAdSpace);
    return () => window.removeEventListener('backpack-forge:ad-space', handleAdSpace);
  }, []);

  useEffect(() => {
    if (splash !== 'done') return;
    void initializeNative(store.getSnapshot().removeAds);
    void initializeBilling(applyRemoveAds);
  }, [applyRemoveAds, splash, store]);

  useEffect(() => {
    if (splash !== 'done' || !isNativePlatform) return;
    if (state.removeAds) void hideBannerAd();
    else void showBannerAd();
  }, [splash, state.removeAds]);

  useEffect(() => {
    if (splash !== 'done' || view !== 'battle' || !canvasRef.current) return;
    const engine = new BattleEngine(canvasRef.current, store, {
      onSnapshot: setBattle,
      onWaveComplete: (result) => {
        setWaveResult(result);
        if (result.stageCleared) {
          setModal('stage-clear');
          void syncRankings(store.getSnapshot());
        } else if (result.boss) {
          showToast(`Boss defeated — +${result.gold} Gold, +${result.ore} Ore.`, 'success');
        }
        if (result.stageCleared || result.boss) void showInterstitialAtBreak();
      },
      onDefeat: () => {
        setModal('defeat');
        void showInterstitialAtBreak();
      },
      onEnemyDefeated: (kind) => store.recordEnemyDefeat(kind),
      onOverdrive: () => store.recordOverdrive(),
      onBossWave: (stage) => {
        const info = chapterForStage(stage);
        setDispatchBanner({ title: info.bossTitle, quote: info.bossIntro });
        audioRef.current?.playVoice(voClipForChapterBoss(stage));
      },
      onSound: (sound) => audioRef.current?.play(sound),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [showToast, splash, store, view]);

  useEffect(() => () => {
    store.persistNow();
    audioRef.current?.dispose();
  }, [store]);

  function handleMove(from: number, to: number): MoveResult {
    const result = store.moveOrMerge(from, to);
    if (result === 'moved' || result === 'swapped') press();
    return result;
  }

  function handleTheme(theme: Theme) {
    press();
    store.setTheme(theme);
  }

  function handleSettings(patch: Partial<GameSettings>) {
    store.updateSettings(patch);
  }

  function startWave() {
    press();
    engineRef.current?.startWave();
  }

  function triggerOverdrive() {
    if (engineRef.current?.triggerOverdrive()) {
      haptic([20, 30, 20]);
    }
  }

  function returnToCamp() {
    press();
    audioRef.current?.stopVoice();
    engineRef.current?.reset();
    setModal(null);
  }

  async function runRewarded(action: RewardedAction) {
    if (rewardBusy) return;
    press();
    setRewardBusy(action);
    const earned = await showRewardedAd();
    setRewardBusy(null);
    if (!earned) {
      showToast('No reward was earned. Your forge is unchanged.', 'error');
      return;
    }
    if (action === 'revive') {
      if (engineRef.current?.revive()) {
        setModal(null);
        showToast('Your knight is back in the fight.', 'success');
      }
      return;
    }
    if (action === 'offline-double') {
      const reward = store.claimOffline(true);
      if (reward) {
        setModal(null);
        showToast(`Idle haul doubled: +${reward.gold} Gold, +${reward.ore} Ore.`, 'success');
      }
      return;
    }
    store.grantRewarded(action);
    haptic([15, 30, 15]);
  }

  function exportSave() {
    press();
    const blob = new Blob([store.exportSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backpack-forge-save-${localDateKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Save exported. Keep the file somewhere safe.', 'success');
  }

  function importSave(text: string): boolean {
    press();
    const success = store.importSave(text);
    if (success) {
      engineRef.current?.reset();
      setView('battle');
      showToast('Forge save imported successfully.', 'success');
    }
    return success;
  }

  function resetProgress() {
    store.reset();
    engineRef.current?.reset();
    setView('battle');
    setModal(null);
    showToast('A new forge is ready.', 'success');
  }

  async function handlePurchase() {
    if (purchaseBusy) return;
    press();
    setPurchaseBusy(true);
    const result = await purchaseRemoveAds(applyRemoveAds);
    setPurchaseBusy(false);
    if (result === 'started') showToast('Complete the purchase in Google Play.');
    else if (result === 'unavailable') showToast('Remove Ads is available in the configured Android release.', 'error');
    else showToast('The purchase could not be started. Please try again.', 'error');
  }

  async function handleRestore() {
    if (purchaseBusy) return;
    press();
    setPurchaseBusy(true);
    let owned = false;
    const success = await restoreRemoveAds((value) => {
      owned = owned || value;
      if (value) applyRemoveAds();
      else showToast('No Remove Ads purchase was found on this Google account.', 'error');
    });
    setPurchaseBusy(false);
    if (!success) showToast('Purchase restoration is available in the Android release.', 'error');
    else if (owned) showToast('Remove Ads purchase restored.', 'success');
  }

  async function handleShare() {
    press();
    const success = await shareGame();
    showToast(success ? 'The forge is ready to share.' : 'Sharing was cancelled.', success ? 'success' : 'normal');
  }

  function handleRate() {
    press();
    rateGame();
  }

  function closeModal() {
    press();
    audioRef.current?.stopVoice();
    if (modal === 'prologue') store.markPrologueSeen();
    setModal(null);
  }

  if (splash !== 'done') {
    return (
      <div className={`splash-screen ${splash === 'f7' ? 'splash-screen--f7' : ''}`}>
        {splash === 'mecha' ? (
          <div className="mecha-splash">
            <img src="/brand/mech-legion-emblem.webp" alt="MechaLegion emblem" />
            <div className="mecha-wordmark"><span>Mecha</span><strong>Legion</strong></div>
            <p>Where iron meets imagination.</p>
          </div>
        ) : f7VideoFailed ? (
          <div className="mecha-splash f7-fallback-splash">
            <img src="/brand/f7-mark.svg" alt="F7 Developer mark" className="f7-fallback-logo" />
            <div className="mecha-wordmark"><strong>F7</strong><span>Developer</span></div>
          </div>
        ) : (
          <video
            className="f7-video"
            poster="/brand/f7-splash-poster.webp"
            autoPlay
            muted
            playsInline
            onEnded={() => setSplash('done')}
            onError={() => setF7VideoFailed(true)}
          >
            <source src="/brand/f7-splash-portrait-silent.webm" type="video/webm" />
            <source src="/brand/f7-splash-portrait-silent.mp4" type="video/mp4" />
          </video>
        )}
        <button className="splash-skip" onClick={() => { press(); setSplash('done'); }}>Skip intro</button>
      </div>
    );
  }

  const pageMeta: Record<Exclude<NavView, 'battle'>, { eyebrow: string; title: string; copy: string }> = {
    talents: { eyebrow: 'Permanent progress', title: 'Forge Talents', copy: 'Temper the knight, not just the blade.' },
    codex: { eyebrow: 'Field notes from the valley', title: 'Forge Codex', copy: 'Gear, enemies, and the valley chronicle.' },
    arena: { eyebrow: 'F7 Shared Network', title: 'Online Arena', copy: 'Global rankings, World Boss raids, and PvP duels.' },
    shop: { eyebrow: 'Optional extras', title: 'Forge Shop', copy: 'Clear choices. Useful rewards. No chance required.' },
  };

  let modalContent: ReactNode = null;
  let modalTitle = '';
  let modalEyebrow = '';
  let modalWide = false;
  let modalClass = '';
  let modalClose: (() => void) | undefined = closeModal;

  if (modal === 'prologue') {
    modalTitle = PROLOGUE_STORY.title;
    modalEyebrow = PROLOGUE_STORY.eyebrow;
    modalClose = () => {
      audioRef.current?.stopVoice();
      store.markPrologueSeen();
      setModal(null);
    };
    modalContent = (
      <div className="prologue-panel">
        <div className="prologue-hero">
          <img src="/art/forge-knight-hero.webp" alt="Forge Knight" />
        </div>
        <button
          type="button"
          className={`vo-pill-btn ${activeVoice === 'prologue' ? 'is-playing' : ''}`}
          onClick={() => {
            audioRef.current?.unlock();
            audioRef.current?.toggleVoice('prologue');
          }}
        >
          <Icon name="volume" size={15} />
          <span>{activeVoice === 'prologue' ? 'Stop Narration' : 'Listen Narration'}</span>
        </button>
        {PROLOGUE_STORY.paragraphs.map((paragraph, idx) => (
          <p className="justified" key={idx}>{paragraph}</p>
        ))}
        <button
          className="forge-button forge-button--primary"
          onClick={() => {
            press();
            audioRef.current?.stopVoice();
            store.markPrologueSeen();
            setModal(null);
          }}
        >
          <Icon name="flame" size={19} />
          Light the Forge
        </button>
      </div>
    );
  } else if (modal === 'guide') {
    modalTitle = 'Forge Guide';
    modalEyebrow = 'How to play';
    modalContent = <GuidePanel />;
  } else if (modal === 'bounties') {
    modalTitle = 'Valley Bounties';
    modalEyebrow = 'Guild contracts';
    modalContent = (
      <BountiesPanel
        state={state}
        onClaim={(id) => {
          press();
          if (store.claimBounty(id)) {
            audioRef.current?.play('coin');
            haptic([12, 24]);
          }
        }}
      />
    );
  } else if (modal === 'settings') {
    modalTitle = 'Workshop Settings';
    modalEyebrow = 'Make the forge yours';
    modalContent = <SettingsContent settings={state.settings} recovered={store.recovered} onSettings={handleSettings} onTheme={handleTheme} onExport={exportSave} onImport={importSave} onReset={resetProgress} onPrivacy={() => void showPrivacyOptions()} />;
  } else if (modal === 'achievements') {
    modalTitle = 'Forge Achievements';
    modalEyebrow = 'Milestones worth keeping';
    modalContent = <AchievementsPanel state={state} />;
  } else if (modal === 'daily') {
    modalTitle = 'Daily Watch';
    modalEyebrow = 'Seven days of forge gifts';
    modalContent = <DailyPanel state={state} onClaim={() => { press(); const reward = store.claimDaily(); if (reward) { audioRef.current?.play('coin'); showToast(`Day ${reward.day} gift claimed.`, 'success'); } }} />;
  } else if (modal === 'about') {
    modalTitle = 'Behind the Forge';
    modalEyebrow = 'Backpack Forge: Idle Merge RPG';
    modalContent = (
      <div className="about-panel">
        <div className="studio-lockup">
          <img src="/brand/mech-legion-emblem.webp" alt="MechaLegion" />
          <span>MechaLegion</span>
          <i />
          <span className="f7-badge"><img src="/brand/f7-mark.svg" alt="F7 Developer" /></span>
          <span>F7 Developer</span>
        </div>
        <p className="about-lead justified">The valley’s old forge has gone quiet. You are the smith who will wake it — one blade, one brave knight, and one impossible pack at a time.</p>
        <button
          type="button"
          className={`vo-pill-btn ${activeVoice === 'about-story' ? 'is-playing' : ''}`}
          onClick={() => {
            audioRef.current?.unlock();
            audioRef.current?.toggleVoice('about-story');
          }}
        >
          <Icon name="volume" size={15} />
          <span>{activeVoice === 'about-story' ? 'Stop Story' : 'Listen Story'}</span>
        </button>
        <p className="justified">Backpack Forge is a cozy fantasy auto-battler about making space, choosing what to carry, and finding the small arrangement that changes a whole fight. No paid lootboxes. No forced watching. Just a good blade and a better plan.</p>
        <div className="about-actions"><button className="forge-button" onClick={() => void handleShare()}><Icon name="share" size={18} />Share the Forge</button><button className="forge-button" onClick={handleRate}><Icon name="star" size={18} />Rate on Google Play</button></div>
        <p className="build-label">Version 1.1.0 · Android, portrait, one-handed · English</p>
      </div>
    );
  } else if (modal === 'menu') {
    modalTitle = 'The Forge Ledger';
    modalEyebrow = 'Everything else';
    modalContent = (
      <div className="menu-list">
        {([
          ['bounties', 'sword', 'Valley Bounties', readyBounties > 0 ? `${readyBounties} ${readyBounties === 1 ? 'contract' : 'contracts'} ready to claim!` : 'Active guild contracts for Ore & Gems'],
          ['achievements', 'trophy', 'Achievements', `${state.achievements.length} / 16 earned · Gem rewards`],
          ['daily', 'calendar', 'Daily Rewards', dailyReady ? 'A seven-day gift is waiting' : 'Today’s gift is already yours'],
          ['guide', 'book', 'Forge Guide', 'Merges, boosters, bonds, smelting & overdrive'],
          ['settings', 'settings', 'Settings', 'Themes, sound, privacy, and saves'],
          ['about', 'about', 'About & Credits', 'The story and the studios'],
        ] as [OpenModal, IconName, string, string][]).map(([target, icon, title, copy]) => (
          <button key={target} onClick={() => { press(); setModal(target); }}>
            <span className="menu-row-icon"><Icon name={icon} size={25} /></span>
            <span><strong>{title}</strong><small>{copy}</small></span>
            <Icon name="chevron" size={20} />
          </button>
        ))}
        <div className="menu-quick-actions"><button className="forge-button" onClick={() => void handleShare()}><Icon name="share" size={18} />Share</button><button className="forge-button" onClick={handleRate}><Icon name="star" size={18} />Rate Us</button></div>
      </div>
    );
  } else if (modal === 'offline') {
    const reward = store.getOfflineReward();
    modalTitle = 'The Forge Never Slept';
    modalEyebrow = 'Your idle haul is home';
    modalClose = undefined;
    modalClass = 'reward-modal';
    modalContent = reward ? (
      <div className="offline-content">
        <div className="offline-emblem"><Icon name="anvil" size={55} /></div>
        <p className="reward-lead">While you were away, the forge kept its rhythm for <strong>{formatDuration(reward.seconds)}</strong>.</p>
        <div className="reward-totals"><div><Icon name="coin" size={29} /><strong>+{formatNumber(reward.gold)}</strong><span>Gold</span></div><div><Icon name="ore" size={29} /><strong>+{formatNumber(reward.ore)}</strong><span>Ore</span></div></div>
        <p className="reward-cap"><Icon name="about" size={15} />Idle gathering is capped at 12 hours.</p>
        <button className="forge-button forge-button--primary" onClick={() => { press(); store.claimOffline(); if (!state.prologueSeen) setModal('prologue'); else setModal(null); }}><Icon name="check" size={20} />Claim Rewards</button>
        <button className="forge-button rewarded-double" disabled={rewardBusy !== null} onClick={() => void runRewarded('offline-double')}><Icon name="play" size={18} />{rewardBusy === 'offline-double' ? 'Loading ad…' : 'Watch to Double'}</button>
      </div>
    ) : null;
  } else if (modal === 'stage-clear') {
    modalTitle = `Stage ${state.stage - 1} Cleared`;
    modalEyebrow = 'The valley opens a little wider';
    const clearedChapter = chapterForStage(Math.max(1, state.stage - 1));
    modalContent = (
      <div className="stage-clear-content">
        <div className="victory-crest"><Icon name="trophy" size={58} /></div>
        <p className="reward-lead">Chapter {clearedChapter.roman} complete. <strong>{chapter.title}</strong> is ready.</p>
        {waveResult && <div className="reward-totals"><div><Icon name="coin" size={28} /><strong>+{waveResult.gold}</strong><span>Gold</span></div><div><Icon name="ore" size={28} /><strong>+{waveResult.ore}</strong><span>Ore</span></div></div>}
        <button
          type="button"
          className={`vo-pill-btn ${activeVoice === voClipForChapterChronicle(clearedChapter.chapterNumber) ? 'is-playing' : ''}`}
          onClick={() => {
            audioRef.current?.unlock();
            audioRef.current?.toggleVoice(voClipForChapterChronicle(clearedChapter.chapterNumber));
          }}
        >
          <Icon name="volume" size={15} />
          <span>{activeVoice === voClipForChapterChronicle(clearedChapter.chapterNumber) ? 'Stop Chronicle' : 'Listen Chronicle'}</span>
        </button>
        <p className="justified">{clearedChapter.chronicleEntry}</p>
        <button className="forge-button forge-button--primary" onClick={closeModal}><Icon name="arrowRight" size={20} />Enter Stage {state.stage}</button>
      </div>
    );
  } else if (modal === 'defeat') {
    modalTitle = 'The Forge Went Cold';
    modalEyebrow = 'A setback, not the end';
    modalClose = returnToCamp;
    modalContent = (
      <div className="defeat-content">
        <div className="defeat-emblem"><Icon name="shield" size={54} /></div>
        <p className="reward-lead">Your knight held the line until the line gave way. Reforge the plan and try again.</p>
        <p className="justified">Your Gold, Ore, items, and talents are safe. Move a booster beside a weapon, merge a matching pair, or temper a permanent talent before the next attempt.</p>
        {battle.canRevive && <button className="forge-button forge-button--primary" disabled={rewardBusy !== null} onClick={() => void runRewarded('revive')}><Icon name="play" size={19} />{rewardBusy === 'revive' ? 'Loading ad…' : 'Watch to Revive This Boss'}</button>}
        <button className="forge-button" onClick={returnToCamp}><Icon name="refresh" size={19} />Reforge & Retry</button>
        <button className="text-button" onClick={() => { press(); setModal(null); setView('talents'); }}>Spend Ore on Talents</button>
      </div>
    );
  }

  return (
    <div className={`app-shell theme-${state.settings.theme} ${nativeAdSpace ? 'has-native-ad' : ''}`} data-theme={state.settings.theme}>
      <div className="ambient-grain" aria-hidden="true" />
      {view === 'battle' ? (
        <main className="battle-workspace">
          <section className="arena" aria-label="Auto-battle arena">
            <img className="arena-background" src={chapter.arena} alt="" />
            <div className="arena-vignette" aria-hidden="true" />
            <canvas ref={canvasRef} className="battle-canvas" aria-label="Living battle animation" />
            <div className="arena-topline">
              <div className="stage-wave" title={chapter.title}>
                <span>{chapter.roman} · STG</span><strong>{battle.stage}</strong><i /><span>WAVE</span><strong>{battle.wave}</strong><small>/ {STAGE_WAVES}</small>
              </div>
              <button className="icon-button menu-button" onClick={() => { press(); setModal('menu'); }} aria-label="Open game menu">
                <Icon name="menu" size={24} />
                {hasMenuAlert && <span className="menu-dot" aria-hidden="true" />}
              </button>
            </div>

            {dispatchBanner && (
              <button
                type="button"
                className="story-dispatch"
                onClick={() => {
                  setDispatchBanner(null);
                  audioRef.current?.stopVoice();
                }}
              >
                <strong>{dispatchBanner.title}</strong>
                <span>{dispatchBanner.quote}</span>
              </button>
            )}

            <div className="resource-row" aria-label="Resources">
              <div className="resource-chip resource-chip--gold"><Icon name="coin" size={18} /><strong>{formatNumber(state.gold)}</strong></div>
              <div className="resource-chip resource-chip--ore"><Icon name="ore" size={18} /><strong>{formatNumber(state.ore)}</strong></div>
              <div className="resource-chip resource-chip--gem"><Icon name="gem" size={18} /><strong>{state.gems}</strong></div>
              <div className="battle-toggles">
                <div className="speed-toggle" aria-label="Battle speed"><button className={battle.speed === 1 ? 'active' : ''} onClick={() => { press(); store.setSpeed(1); }}>1×</button><button className={battle.speed === 2 ? 'active' : ''} onClick={() => { press(); store.setSpeed(2); }}>2×</button></div>
                <button className={`auto-toggle ${state.autoWave ? 'active' : ''}`} onClick={() => { press(); store.setAutoWave(!state.autoWave); }} aria-pressed={state.autoWave}><Icon name={state.autoWave ? 'refresh' : 'pause'} size={15} /><span>Auto</span></button>
              </div>
            </div>

            {battle.bossMaxHp > 0 && (
              <div className="boss-health">
                <div><span>{battle.bossName.toUpperCase()}</span><strong>{formatNumber(battle.bossHp)} / {formatNumber(battle.bossMaxHp)}</strong></div>
                <div className="boss-health-track"><span style={{ width: `${(battle.bossHp / battle.bossMaxHp) * 100}%` }} /></div>
              </div>
            )}

            <div className="hero-hud">
              <div className="hero-portrait"><img src="/art/hero-portrait.webp" alt="Forge Knight" /></div>
              <div className="hero-vitals">
                <div><Icon name="heart" size={15} /><strong>Forge Knight</strong><span>{battle.heroHp} / {battle.heroMaxHp}</span></div>
                <div className="hero-health-track"><span style={{ width: `${(battle.heroHp / battle.heroMaxHp) * 100}%` }} /></div>
                <small><Icon name="sword" size={13} />{Math.round(loadout.weapons.reduce((sum, weapon) => sum + weapon.damage, 0))} ATK<span>·</span><Icon name="shield" size={13} />{battle.armor} Armor</small>
              </div>
            </div>

            <button
              type="button"
              className={`overdrive-button ${battle.overdriveReady && battle.phase === 'fighting' ? 'is-ready' : ''}`}
              disabled={!battle.overdriveReady || battle.phase !== 'fighting'}
              onClick={triggerOverdrive}
              aria-label={`Anvil Strike Overdrive ${battle.overdrive}%`}
            >
              <Icon name="flame" size={16} />
              <span>{battle.overdriveReady ? 'Anvil Strike!' : `${battle.overdrive}%`}</span>
            </button>

            <div className={`battle-state battle-state--${battle.phase}`} aria-live="polite">
              {battle.phase === 'fighting'
                ? `${battle.enemiesRemaining} ${battle.enemiesRemaining === 1 ? 'foe' : 'foes'}`
                : battle.phase === 'won'
                  ? 'Wave cleared'
                  : battle.phase === 'lost'
                    ? 'Knight down'
                    : chapter.title}
            </div>
          </section>

          <div className="forge-workspace">
            <Backpack
              state={state}
              onMove={handleMove}
              onSalvage={(slot) => {
                press();
                return store.salvageItem(slot);
              }}
              onAdvanceOnboarding={() => { press(); store.advanceOnboarding(); }}
              onSkipOnboarding={() => { press(); audioRef.current?.stopVoice(); store.finishOnboarding(); }}
              activeVoice={activeVoice}
              onToggleVoice={(id) => {
                audioRef.current?.unlock();
                audioRef.current?.toggleVoice(id);
              }}
            />
          </div>

          <section className="forge-tray" aria-label="Forge Shop and battle controls">
            <div className="tray-heading">
              <div className="section-title"><Icon name="anvil" size={20} /><h2>Forge Shop</h2></div>
              <button className="refresh-button" disabled={state.gold < refreshCost} onClick={() => { press(); store.refreshShop(); }}><Icon name="refresh" size={17} /><span>Refresh</span><strong><Icon name="coin" size={14} />{refreshCost}</strong></button>
            </div>
            <div className="shop-slots">
              {state.shop.slice(0, 3).map((entry, index) => {
                const canMerge = store.canDirectMergeShopEntry(entry);
                return (
                  <button key={entry.id} className={`shop-slot ${canMerge ? 'can-direct-merge' : ''}`} onClick={() => { press(); store.buyShopItem(index); }} aria-label={`Buy ${ITEM_DEFS[entry.kind].name} Tier ${entry.tier} for ${entry.price} Gold`}>
                    <span className="shop-tier" style={{ color: RARITY_COLORS[entry.tier - 1] }}>T{entry.tier}</span>
                    {canMerge && <span className="shop-merge-tag">MERGE</span>}
                    <img src={`/art/items/${entry.kind}.webp`} alt="" draggable={false} />
                    <strong>{ITEM_DEFS[entry.kind].shortName}</strong>
                    <span className="shop-price"><Icon name="coin" size={14} />{entry.price}</span>
                  </button>
                );
              })}
            </div>
            <div className="battle-actions">
              <div className="pack-status"><span className={inventoryFull ? 'is-full' : ''}><Icon name="backpack" size={16} />{inventoryFull ? 'Pack full' : `${capacity - usedSlots} slots free`}</span>{state.tempExtraSlot && <small>+1 rewarded slot</small>}</div>
              <button className="forge-button forge-button--primary wave-button" disabled={battle.phase === 'fighting'} onClick={startWave}>
                <Icon name={battle.phase === 'fighting' ? 'pause' : 'play'} size={19} />
                {battle.phase === 'fighting' ? 'Fighting…' : battle.phase === 'won' ? 'Next Wave' : battle.phase === 'lost' ? 'Retry Wave' : 'Start Wave'}
                {!state.onboardingDone && state.onboardingStep === 2 && <span className="onboarding-pulse" />}
              </button>
            </div>
          </section>
        </main>
      ) : (
        <main className={`page-workspace page-workspace--${view}`}>
          <header className="page-header"><div><p className="eyebrow">{pageMeta[view].eyebrow}</p><h1>{pageMeta[view].title}</h1><p>{pageMeta[view].copy}</p></div><button className="icon-button" onClick={() => { press(); setView('battle'); }} aria-label="Back to battle"><Icon name="close" size={24} /></button></header>
          <div className="page-scroll">
            {view === 'talents' && (
              <TalentsPanel
                state={state}
                canAscend={store.canAscend()}
                ascensionMarks={store.ascensionMarksReward()}
                onUpgrade={(talent) => { press(); if (store.upgradeTalent(talent)) { audioRef.current?.play('hammer'); haptic(); } }}
                onAscend={() => {
                  press();
                  const gained = store.ascendForge();
                  if (gained > 0) {
                    audioRef.current?.play('victory');
                    setView('battle');
                  }
                }}
              />
            )}
            {view === 'codex' && (
              <CodexPanel
                state={state}
                activeVoice={activeVoice}
                onToggleVoice={(id) => {
                  audioRef.current?.unlock();
                  audioRef.current?.toggleVoice(id);
                }}
              />
            )}
            {view === 'arena' && (
              <OnlinePanel
                state={state}
                rewardBusy={rewardBusy}
                activeVoice={activeVoice}
                onToggleVoice={(id) => {
                  audioRef.current?.unlock();
                  audioRef.current?.toggleVoice(id);
                }}
                onPlayVoice={(id) => {
                  audioRef.current?.unlock();
                  audioRef.current?.playVoice(id);
                }}
                onStopVoice={() => audioRef.current?.stopVoice()}
                onSetNickname={(name) => store.setNickname(name)}
                onGrantReward={(gold, ore, reason) => store.grantOnlineReward(gold, ore, reason)}
                onRewardedTicket={async (action) => {
                  if (rewardBusy) return false;
                  setRewardBusy(action);
                  const earned = await showRewardedAd();
                  setRewardBusy(null);
                  if (!earned) showToast('No ticket earned. Try again shortly.', 'error');
                  return earned;
                }}
                onToast={showToast}
                onSound={(s) => {
                  audioRef.current?.unlock();
                  audioRef.current?.play(s);
                }}
              />
            )}
            {view === 'shop' && (
              <ShopPanel
                state={state}
                offlineAvailable={Boolean(store.getOfflineReward())}
                rewardBusy={rewardBusy}
                purchaseBusy={purchaseBusy}
                onPurchase={() => void handlePurchase()}
                onRestore={() => void handleRestore()}
                onRewarded={(action) => void runRewarded(action)}
                onBuyGemOffer={(offerId) => {
                  press();
                  if (store.buyGemOffer(offerId)) {
                    audioRef.current?.play('coin');
                    haptic();
                  }
                }}
              />
            )}
          </div>
        </main>
      )}

      <nav className="bottom-nav" aria-label="Game navigation">
        {navItems.map((item) => <button key={item.value} className={view === item.value ? 'active' : ''} aria-current={view === item.value ? 'page' : undefined} onClick={() => { press(); setView(item.value); }}><span className="nav-icon"><Icon name={item.icon} size={25} /></span><span>{item.label}</span></button>)}
      </nav>

      {toast && <div key={toast.id} className={`toast toast--${toast.tone}`} role="status"><Icon name={toast.tone === 'error' ? 'about' : toast.tone === 'success' ? 'check' : 'sparkle'} size={19} /><span>{toast.text}</span></div>}

      {modal && <Modal title={modalTitle} eyebrow={modalEyebrow} onClose={modalClose} wide={modalWide} className={modalClass}>{modalContent}</Modal>}
    </div>
  );
}
