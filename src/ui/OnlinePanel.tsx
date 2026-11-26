import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateLoadout } from '../game/data';
import { OnlineBattleEngine, type OnlineBattleSnapshot } from '../game/onlineBattle';
import type { GameState, RewardedAction } from '../game/types';
import type {
  BoardResponse,
  PvpMatchResponse,
  PvpOpponent,
  RankSession,
  WorldBossStatusResponse,
} from '../platform/f7RankSdk';
import {
  computeForgePower,
  generateBotOpponents,
  loadoutFromSnapshot,
  offlineWorldBossFallback,
  RANK_BOARDS,
  rankClient,
  resolveWorldBossTheme,
  syncRankings,
  type RankBoardId,
} from '../platform/online';
import { Icon } from './Icons';

type OnlineTab = 'rankings' | 'worldboss' | 'pvp';

interface OnlinePanelProps {
  state: GameState;
  rewardBusy: RewardedAction | null;
  onSetNickname: (name: string) => void;
  onGrantReward: (gold: number, ore: number, reason: string) => void;
  onRewardedTicket: (action: 'worldboss-ticket' | 'pvp-ticket') => Promise<boolean>;
  onToast: (text: string, tone?: 'normal' | 'success' | 'error') => void;
  onSound: (sound: 'click' | 'sword' | 'bow' | 'hit' | 'hammer' | 'victory' | 'crit' | 'overdrive') => void;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

function formatCountdown(endsAt: number): string {
  const diff = Math.max(0, endsAt - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

export function OnlinePanel({
  state,
  rewardBusy,
  onSetNickname,
  onGrantReward,
  onRewardedTicket,
  onToast,
  onSound,
}: OnlinePanelProps) {
  const [tab, setTab] = useState<OnlineTab>('rankings');
  const [session, setSession] = useState<RankSession | null>(null);
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState(state.nickname);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoverInput, setRecoverInput] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  // Rankings state
  const [boardId, setBoardId] = useState<RankBoardId>('power');
  const [scope, setScope] = useState<'global' | 'country'>('global');
  const [boardData, setBoardData] = useState<BoardResponse | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState('');
  const [syncing, setSyncing] = useState(false);

  // World Boss state
  const [wbData, setWbData] = useState<WorldBossStatusResponse | null>(null);
  const [wbLoading, setWbLoading] = useState(false);
  const [wbExtraTicket, setWbExtraTicket] = useState(false);
  const [wbLastResult, setWbLastResult] = useState<string>('');

  // PvP state
  const [pvpData, setPvpData] = useState<PvpMatchResponse | null>(null);
  const [pvpLoading, setPvpLoading] = useState(false);
  const [pvpExtraTickets, setPvpExtraTickets] = useState(false);
  const [pvpSubTab, setPvpSubTab] = useState<'rivals' | 'board' | 'log'>('rivals');
  const [pvpLastResult, setPvpLastResult] = useState<string>('');

  // Live animated battle state (shared for World Boss & PvP)
  const [activeMatch, setActiveMatch] = useState<
    | { mode: 'worldboss' }
    | { mode: 'pvp'; opponent: PvpOpponent }
    | null
  >(null);
  const [liveSnap, setLiveSnap] = useState<OnlineBattleSnapshot | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OnlineBattleEngine | null>(null);

  const heroLoadout = useMemo(
    () => calculateLoadout(state.inventory, state.talents, state.forgeMarks),
    [state.forgeMarks, state.inventory, state.talents],
  );
  const myPower = useMemo(() => computeForgePower(state), [state]);
  const wbTheme = useMemo(() => resolveWorldBossTheme(wbData?.boss), [wbData?.boss]);

  const refreshPending = useCallback(async () => {
    setPendingCount(await rankClient.getPendingCount());
    setSession(await rankClient.getSession());
  }, []);

  const loadBoard = useCallback(async (targetBoard = boardId, targetScope = scope) => {
    setBoardLoading(true);
    setBoardError('');
    try {
      const data = await rankClient.getBoard(targetBoard, { scope: targetScope, limit: 50 });
      setBoardData(data);
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : 'Unable to reach Rankings right now.');
    } finally {
      setBoardLoading(false);
    }
  }, [boardId, scope]);

  const loadWorldBoss = useCallback(async () => {
    setWbLoading(true);
    try {
      const data = await rankClient.getWorldBossStatus();
      setWbData(data);
    } catch {
      setWbData(offlineWorldBossFallback());
    } finally {
      setWbLoading(false);
    }
  }, []);

  const loadPvp = useCallback(async () => {
    setPvpLoading(true);
    try {
      const data = await rankClient.getPvpMatch();
      setPvpData(data);
    } catch {
      setPvpData({
        me: { rating: 1000, wins: 0, losses: 0, streak: 0, fightsToday: 0 },
        opponents: [],
        leaderboard: [],
        defenseLog: [],
        fromCache: true,
      });
    } finally {
      setPvpLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPending();
    void syncRankings(state).then(() => refreshPending());
  }, []); // Run once when Arena tab opens

  useEffect(() => {
    if (tab === 'rankings') void loadBoard(boardId, scope);
    if (tab === 'worldboss') void loadWorldBoss();
    if (tab === 'pvp') void loadPvp();
  }, [tab, boardId, scope, loadBoard, loadWorldBoss, loadPvp]);

  // Mount live animated OnlineBattleEngine when activeMatch is set
  useEffect(() => {
    if (!activeMatch || !canvasRef.current) return;
    const engine = new OnlineBattleEngine(canvasRef.current, {
      mode: activeMatch.mode,
      heroName: state.nickname || 'Forge Smith',
      heroLoadout,
      overdriveTalent: state.talents.overdrive,
      worldBossTheme: activeMatch.mode === 'worldboss' ? wbTheme : undefined,
      rivalName: activeMatch.mode === 'pvp' ? activeMatch.opponent.nickname : undefined,
      rivalLoadout: activeMatch.mode === 'pvp'
        ? loadoutFromSnapshot(activeMatch.opponent.snapshot, activeMatch.opponent.power)
        : undefined,
      onSnapshot: setLiveSnap,
      onSound: (s) => onSound(s),
      onFinish: async ({ damage, won }) => {
        setActiveMatch(null);
        setLiveSnap(null);

        if (activeMatch.mode === 'worldboss') {
          const goldGain = Math.max(40, Math.round(35 + state.highestStage * 18 + Math.min(200, damage / 40)));
          const oreGain = Math.max(3, 3 + Math.floor(state.highestStage * 0.8));
          try {
            const res = await rankClient.submitWorldBossHit({
              damage,
              power: myPower,
              adBonus: wbExtraTicket,
              meta: { stage: state.highestStage, asc: state.ascensions },
              nickname: state.nickname,
            });
            setWbLastResult(
              won
                ? `Survived! Submitted ${formatNum(res.acceptedDamage)} DMG! Total: ${formatNum(res.totalDamage)} (${res.runsToday}/${wbExtraTicket ? 4 : 3} today)`
                : `Knight fell after dealing ${formatNum(res.acceptedDamage)} DMG — submitted! Total: ${formatNum(res.totalDamage)} (${res.runsToday}/${wbExtraTicket ? 4 : 3} today)`,
            );
            onGrantReward(goldGain, oreGain, `World Boss Raid: +${goldGain} Gold, +${oreGain} Ore`);
            void loadWorldBoss();
          } catch {
            setWbLastResult(
              won
                ? `Offline Practice Raid: ${formatNum(damage)} DMG dealt!`
                : `Knight fell after dealing ${formatNum(damage)} DMG (offline)!`,
            );
            onGrantReward(Math.round(goldGain * 0.7), Math.max(2, oreGain - 1), `Offline Raid: +${Math.round(goldGain * 0.7)} Gold`);
          }
          void refreshPending();
        } else {
          const opp = activeMatch.opponent;
          const goldGain = won ? 55 + state.highestStage * 16 : 20 + state.highestStage * 5;
          const oreGain = won ? 4 + Math.floor(state.highestStage * 0.6) : 1;
          try {
            const res = await rankClient.submitPvpResult({
              won,
              isBot: opp.isBot,
              defenderId: opp.playerId,
              defenderName: opp.nickname,
              defenderRating: opp.rating,
              attackerPower: myPower,
              defenderPower: opp.power,
              adBonus: pvpExtraTickets,
              nickname: state.nickname,
            });
            const sign = res.delta >= 0 ? `+${res.delta}` : String(res.delta);
            setPvpLastResult(`${won ? 'Victory' : 'Defeat'} vs ${opp.nickname} (${sign} Rating → ${res.rating})`);
            onGrantReward(goldGain, oreGain, `Arena Duel ${won ? 'Won' : 'Complete'}: +${goldGain} Gold, +${oreGain} Ore`);
            void loadPvp();
          } catch {
            setPvpLastResult(`Offline Spar ${won ? 'Won' : 'Lost'} vs ${opp.nickname}`);
            onGrantReward(Math.round(goldGain * 0.7), oreGain, `Arena Spar: +${Math.round(goldGain * 0.7)} Gold`);
          }
          void refreshPending();
        }
      },
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [activeMatch]);

  async function handleSaveNickname() {
    onSound('click');
    const cleaned = nickInput.trim().slice(0, 20) || 'Forge Smith';
    onSetNickname(cleaned);
    setEditingNick(false);
    try {
      await rankClient.setNickname(cleaned, { stage: state.highestStage });
      await refreshPending();
      onToast(`Smith name updated to ${cleaned}.`, 'success');
      if (tab === 'rankings') void loadBoard(boardId, scope);
    } catch {
      onToast('Saved locally; will sync online when connected.', 'normal');
    }
  }

  async function handleRecover() {
    onSound('click');
    const code = recoverInput.trim().toUpperCase();
    if (!code) return;
    try {
      const sess = await rankClient.recover(code);
      onSetNickname(sess.nickname);
      setNickInput(sess.nickname);
      setShowRecovery(false);
      setRecoverInput('');
      await refreshPending();
      onToast(`Restored online profile: ${sess.nickname}`, 'success');
      void loadBoard(boardId, scope);
    } catch {
      onToast('Invalid recovery code or offline.', 'error');
    }
  }

  async function handleSyncNow() {
    if (syncing) return;
    onSound('click');
    setSyncing(true);
    const res = await syncRankings(state, { force: true });
    await refreshPending();
    setSyncing(false);
    if (res.ok) {
      onToast('Scores & PvP snapshot synced!', 'success');
      void loadBoard(boardId, scope);
    } else {
      onToast('Offline — scores queued locally for next sync.', 'normal');
    }
  }

  const wbRunsToday = wbData?.me?.runsToday ?? 0;
  const wbMaxRuns = wbExtraTicket ? 4 : 3;
  const wbTicketsLeft = Math.max(0, wbMaxRuns - wbRunsToday);

  const pvpMe = pvpData?.me ?? { rating: 1000, wins: 0, losses: 0, streak: 0, fightsToday: 0 };
  const pvpMaxFights = pvpExtraTickets ? 7 : 5;
  const pvpTicketsLeft = Math.max(0, pvpMaxFights - pvpMe.fightsToday);

  const opponentsList = useMemo(() => {
    const real = pvpData?.opponents ?? [];
    const bots = generateBotOpponents(myPower, pvpMe.rating);
    return [...real, ...bots].slice(0, 4);
  }, [myPower, pvpData?.opponents, pvpMe.rating]);

  return (
    <div className="online-panel">
      {/* Profile Strip */}
      <div className="online-profile-bar">
        <div className="online-profile-left">
          <img src="/art/hero-portrait.webp" alt="" className="online-mini-avatar" />
          <div>
            {editingNick ? (
              <div className="nick-edit-row">
                <input
                  type="text"
                  maxLength={20}
                  value={nickInput}
                  onChange={(e) => setNickInput(e.target.value)}
                  aria-label="Smith nickname"
                />
                <button className="forge-button" onClick={() => void handleSaveNickname()}>Save</button>
              </div>
            ) : (
              <div className="nick-display-row">
                <strong>{state.nickname}</strong>
                <button className="text-button" onClick={() => { setNickInput(state.nickname); setEditingNick(true); }}>Edit</button>
              </div>
            )}
            <small>
              Power {formatNum(myPower)} · {pendingCount > 0 ? `${pendingCount} queued offline` : session ? `${session.country} · Online ID ready` : 'Offline-first'}
            </small>
          </div>
        </div>
        <button className="text-button" onClick={() => { onSound('click'); setShowRecovery((v) => !v); }}>
          <Icon name="restore" size={16} />
          Code
        </button>
      </div>

      {showRecovery && (
        <div className="recovery-drawer">
          <p className="justified">
            {session?.recoveryCode
              ? <>Your Recovery Code: <strong>{session.recoveryCode}</strong> — keep this to restore your online ranks on another device.</>
              : 'Sync once online to generate your personal Recovery Code.'}
          </p>
          <div className="nick-edit-row">
            <input
              type="text"
              placeholder="F7-XXXX-XXXX"
              value={recoverInput}
              onChange={(e) => setRecoverInput(e.target.value)}
              aria-label="Enter recovery code"
            />
            <button className="forge-button" onClick={() => void handleRecover()}>Restore</button>
          </div>
        </div>
      )}

      {/* 3-Tab Switcher */}
      <div className="codex-tabs" role="tablist" aria-label="Online Arena modes">
        <button role="tab" aria-selected={tab === 'rankings'} className={tab === 'rankings' ? 'active' : ''} onClick={() => { onSound('click'); setTab('rankings'); }}>
          <Icon name="trophy" size={16} /> Rankings
        </button>
        <button role="tab" aria-selected={tab === 'worldboss'} className={tab === 'worldboss' ? 'active' : ''} onClick={() => { onSound('click'); setTab('worldboss'); }}>
          <Icon name="flame" size={16} /> World Boss
        </button>
        <button role="tab" aria-selected={tab === 'pvp'} className={tab === 'pvp' ? 'active' : ''} onClick={() => { onSound('click'); setTab('pvp'); }}>
          <Icon name="sword" size={16} /> PvP Duel
        </button>
      </div>

      {/* Live Animated Raid / PvP Stage */}
      {activeMatch && (
        <section className="online-live-stage" aria-label="Live online battle">
          <div className="online-stage-arena">
            <img
              src={activeMatch.mode === 'worldboss' ? wbTheme.arena : '/art/ironbridge-foundry-arena.webp'}
              alt=""
              className="arena-background"
            />
            <div className="arena-vignette" aria-hidden="true" />
            <canvas ref={canvasRef} className="online-battle-canvas" />

            <div className="online-stage-hud">
              <span className="online-stage-title">
                {activeMatch.mode === 'worldboss' ? wbTheme.title : `${state.nickname} vs ${activeMatch.opponent.nickname}`}
              </span>
              <div className="online-stage-controls">
                <button
                  type="button"
                  className="online-speed-btn"
                  onClick={() => {
                    const next = liveSnap?.speed === 2 ? 1 : 2;
                    engineRef.current?.setSpeed(next);
                  }}
                >
                  {liveSnap?.speed ?? 1}×
                </button>
                {activeMatch.mode === 'worldboss' && (
                  <span className="online-timer-pill">{(liveSnap?.timeLeft ?? 18).toFixed(1)}s</span>
                )}
              </div>
            </div>

            {activeMatch.mode === 'worldboss' && liveSnap && (
              <div className="wb-live-hud">
                <div className="pvp-hp-box wb-knight-hp">
                  <small>Forge Knight ({liveSnap.heroHp}/{liveSnap.heroMaxHp})</small>
                  <div className="hero-health-track"><span style={{ width: `${(liveSnap.heroHp / Math.max(1, liveSnap.heroMaxHp)) * 100}%` }} /></div>
                </div>
                <span className={`fury-badge ${liveSnap.bossFuryTier >= 3 ? 'is-high' : ''}`}>
                  Titan Fury ×{liveSnap.bossFuryTier}
                </span>
              </div>
            )}

            {activeMatch.mode === 'pvp' && liveSnap && (
              <div className="pvp-hp-bars">
                <div className="pvp-hp-box">
                  <small><span className="pvp-role-tag is-you">YOU</span>{state.nickname} ({liveSnap.heroHp}/{liveSnap.heroMaxHp})</small>
                  <div className="hero-health-track"><span style={{ width: `${(liveSnap.heroHp / Math.max(1, liveSnap.heroMaxHp)) * 100}%` }} /></div>
                </div>
                <div className="pvp-hp-box is-rival">
                  <small><span className="pvp-role-tag is-rival">RIVAL</span>{activeMatch.opponent.nickname} ({liveSnap.enemyHp}/{liveSnap.enemyMaxHp})</small>
                  <div className="boss-health-track"><span style={{ width: `${(liveSnap.enemyHp / Math.max(1, liveSnap.enemyMaxHp)) * 100}%` }} /></div>
                </div>
              </div>
            )}
          </div>

          <div className="online-stage-footer">
            <div className="online-dmg-readout">
              <strong>{formatNum(liveSnap?.totalDamage ?? 0)}</strong>
              <span>{activeMatch.mode === 'worldboss' ? `DMG · ${formatNum(liveSnap?.dps ?? 0)} DPS` : 'Damage Dealt'}</span>
            </div>
            <button
              type="button"
              className={`overdrive-button inline-overdrive ${liveSnap?.overdriveReady ? 'is-ready' : ''}`}
              disabled={!liveSnap?.overdriveReady}
              onClick={() => engineRef.current?.triggerOverdrive()}
            >
              <Icon name="flame" size={15} />
              <span>{liveSnap?.overdriveReady ? 'Anvil Strike!' : `${liveSnap?.overdrive ?? 0}%`}</span>
            </button>
            {activeMatch.mode === 'worldboss' && !liveSnap?.finished && (
              <button type="button" className="text-button finish-early-btn" onClick={() => engineRef.current?.finishNow()}>
                Finish
              </button>
            )}
          </div>
        </section>
      )}

      {/* TAB 1: RANKINGS */}
      {tab === 'rankings' && (
        <div className="online-section">
          <div className="rankings-controls">
            <div className="scope-toggle">
              <button className={scope === 'global' ? 'active' : ''} onClick={() => setScope('global')}>Global</button>
              <button className={scope === 'country' ? 'active' : ''} onClick={() => setScope('country')}>Country</button>
            </div>
            <button className="forge-button" disabled={syncing} onClick={() => void handleSyncNow()}>
              <Icon name="refresh" size={16} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>

          <div className="filter-ribbon" role="tablist" aria-label="Leaderboard categories">
            {RANK_BOARDS.map((b) => (
              <button key={b.id} role="tab" aria-selected={boardId === b.id} className={boardId === b.id ? 'active' : ''} onClick={() => setBoardId(b.id)}>
                {b.label}
              </button>
            ))}
          </div>

          {boardData?.me && (
            <div className="my-rank-card">
              <span>Your Rank</span>
              <strong>{boardData.me.rank ? `#${boardData.me.rank}` : 'Unranked'}</strong>
              <span>{formatNum(boardData.me.score)} pts{boardData.me.percentile ? ` · Top ${boardData.me.percentile}%` : ''}</span>
            </div>
          )}

          {boardLoading && <p className="online-status-note">Loading leaderboard…</p>}
          {boardError && !boardData && <p className="online-status-note">{boardError}</p>}
          {boardData?.fromCache && <p className="online-status-note">Showing cached offline standings.</p>}

          <div className="rank-list">
            {(boardData?.top ?? []).length === 0 && !boardLoading ? (
              <p className="online-empty">No scores posted yet on this board. Tap Sync Now to claim #1!</p>
            ) : (
              (boardData?.top ?? []).map((row) => (
                <div className={`rank-row ${row.playerId === session?.playerId ? 'is-me' : ''}`} key={`${row.playerId}-${row.rank}`}>
                  <span className="rank-num">#{row.rank}</span>
                  <span className="rank-country">{row.country}</span>
                  <strong className="rank-name">{row.nickname}</strong>
                  <span className="rank-score">{formatNum(row.score)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WORLD BOSS */}
      {tab === 'worldboss' && !activeMatch && (
        <div className="online-section">
          <article className="wb-hero-card">
            <div className="wb-portrait-wrap">
              <img src={wbTheme.portrait} alt={wbTheme.title} />
            </div>
            <div className="wb-info">
              <span className="eyebrow">{wbTheme.subtitle} · {wbData ? formatCountdown(wbData.boss.endsAt) : 'Weekly'}</span>
              <h3>{wbTheme.title}</h3>
              <p className="justified">{wbTheme.lore}</p>
              <small className="wb-tactic-hint">Heavy Titan strikes escalate every 4s. Equip Armor, Vials, Frost &amp; Stuns to survive all 18s.</small>
            </div>
          </article>

          {wbData && (
            <div className="wb-hp-card">
              <div className="wb-hp-head">
                <strong>Global Damage</strong>
                <span>{formatNum(wbData.boss.currentDamage)} / {formatNum(wbData.boss.totalHp)}</span>
              </div>
              <div className="boss-health-track">
                <span style={{ width: `${Math.min(100, (wbData.boss.currentDamage / Math.max(1, wbData.boss.totalHp)) * 100)}%` }} />
              </div>
              <small>{wbData.boss.participants} smiths joined · {wbData.boss.hitsCount} raids{wbData.fromCache ? ' (cached)' : ''}</small>
            </div>
          )}

          {wbLastResult && <p className="online-result-banner">{wbLastResult}</p>}

          <div className="wb-actions">
            <div className="ticket-pill">
              <Icon name="flame" size={16} />
              <span>Tickets: <strong>{wbTicketsLeft}</strong> / {wbMaxRuns}</span>
            </div>
            {wbTicketsLeft > 0 ? (
              <button
                className="forge-button forge-button--primary"
                disabled={wbLoading}
                onClick={() => {
                  onSound('click');
                  setActiveMatch({ mode: 'worldboss' });
                }}
              >
                <Icon name="play" size={18} />
                Fight World Boss
              </button>
            ) : !wbExtraTicket ? (
              <button
                className="forge-button"
                disabled={rewardBusy !== null}
                onClick={async () => {
                  onSound('click');
                  if (await onRewardedTicket('worldboss-ticket')) {
                    setWbExtraTicket(true);
                    onToast('+1 World Boss ticket unlocked!', 'success');
                  }
                }}
              >
                <Icon name="ad" size={18} />
                {rewardBusy === 'worldboss-ticket' ? 'Loading…' : '+1 Ticket (Ad)'}
              </button>
            ) : (
              <button className="forge-button" disabled>Tickets Used Today</button>
            )}
          </div>

          <div className="subsection-heading"><Icon name="trophy" size={20} /><h3>Top Raid Contributors</h3></div>
          <div className="rank-list">
            {(wbData?.top ?? []).length === 0 ? (
              <p className="online-empty">Be the first smith to strike {wbTheme.title} this week!</p>
            ) : (
              (wbData?.top ?? []).map((c) => (
                <div className={`rank-row ${c.playerId === session?.playerId ? 'is-me' : ''}`} key={c.playerId}>
                  <span className="rank-num">#{c.rank}</span>
                  <span className="rank-country">{c.country}</span>
                  <strong className="rank-name">{c.nickname}</strong>
                  <span className="rank-score">{formatNum(c.totalDamage)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ASYNC PVP */}
      {tab === 'pvp' && !activeMatch && (
        <div className="online-section">
          <div className="pvp-summary-card">
            <div><span>Rating</span><strong>{pvpMe.rating}</strong></div>
            <div><span>Record</span><strong>{pvpMe.wins}W - {pvpMe.losses}L</strong></div>
            <div><span>Streak</span><strong>{pvpMe.streak}</strong></div>
            <div><span>Tickets</span><strong>{pvpTicketsLeft}/{pvpMaxFights}</strong></div>
          </div>

          {pvpLastResult && <p className="online-result-banner">{pvpLastResult}</p>}

          <div className="rankings-controls">
            <div className="scope-toggle">
              <button className={pvpSubTab === 'rivals' ? 'active' : ''} onClick={() => setPvpSubTab('rivals')}>Rivals</button>
              <button className={pvpSubTab === 'board' ? 'active' : ''} onClick={() => setPvpSubTab('board')}>Top 25</button>
              <button className={pvpSubTab === 'log' ? 'active' : ''} onClick={() => setPvpSubTab('log')}>Defense</button>
            </div>
            {pvpTicketsLeft === 0 && !pvpExtraTickets ? (
              <button
                className="forge-button"
                disabled={rewardBusy !== null}
                onClick={async () => {
                  onSound('click');
                  if (await onRewardedTicket('pvp-ticket')) {
                    setPvpExtraTickets(true);
                    onToast('+2 Arena Duel tickets unlocked!', 'success');
                  }
                }}
              >
                <Icon name="ad" size={16} /> +2 Tickets
              </button>
            ) : (
              <button className="forge-button" disabled={pvpLoading} onClick={() => void loadPvp()}>
                <Icon name="refresh" size={16} /> Refresh
              </button>
            )}
          </div>

          {pvpSubTab === 'rivals' && (
            <div className="pvp-rival-list">
              {opponentsList.map((opp) => (
                <article className="pvp-rival-row" key={opp.playerId}>
                  <div className="pvp-rival-info">
                    <span className="eyebrow">{opp.isBot ? 'Arena Bot' : opp.country} · Rating {opp.rating}</span>
                    <h4>{opp.nickname}</h4>
                    <small>Power {formatNum(opp.power)} · {opp.wins}W / {opp.losses}L</small>
                  </div>
                  <button
                    className="forge-button forge-button--primary"
                    disabled={pvpTicketsLeft <= 0}
                    onClick={() => {
                      onSound('click');
                      setActiveMatch({ mode: 'pvp', opponent: opp });
                    }}
                  >
                    <Icon name="sword" size={16} />
                    Duel
                  </button>
                </article>
              ))}
            </div>
          )}

          {pvpSubTab === 'board' && (
            <div className="rank-list">
              {(pvpData?.leaderboard ?? []).length === 0 ? (
                <p className="online-empty">Fight a duel to enter the Arena Top 25!</p>
              ) : (
                (pvpData?.leaderboard ?? []).map((row) => (
                  <div className={`rank-row ${row.playerId === session?.playerId ? 'is-me' : ''}`} key={row.playerId}>
                    <span className="rank-num">#{row.rank}</span>
                    <span className="rank-country">{row.country}</span>
                    <strong className="rank-name">{row.nickname}</strong>
                    <span className="rank-score">{row.rating}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {pvpSubTab === 'log' && (
            <div className="rank-list">
              {(pvpData?.defenseLog ?? []).length === 0 ? (
                <p className="online-empty">No incoming challenges recorded yet.</p>
              ) : (
                (pvpData?.defenseLog ?? []).map((item) => (
                  <div className="rank-row" key={item.id}>
                    <span className="rank-num">{item.defenderWon ? 'WIN' : 'LOSS'}</span>
                    <strong className="rank-name">{item.attackerName}</strong>
                    <span className="rank-score">{item.ratingDelta >= 0 ? `+${item.ratingDelta}` : item.ratingDelta}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
