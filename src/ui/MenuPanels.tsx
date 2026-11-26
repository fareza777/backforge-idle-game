import { useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  GEM_SHOP_OFFERS,
  ITEM_DEFS,
  RARITIES,
  RARITY_COLORS,
  SHOP_POOL,
  TALENT_INFO,
  talentCost,
} from '../game/data';
import { CHAPTERS, ENEMY_BESTIARY, PROLOGUE_STORY } from '../game/story';
import { voClipForChapterChronicle, voClipForChapterIntro, type VoiceClipId } from '../game/voice';
import type { GameSettings, GameState, ItemCategory, ItemKind, RewardedAction, Talents, Theme } from '../game/types';
import { isNativePlatform, usingTestAds } from '../platform/native';
import { Icon, type IconName } from './Icons';

interface TalentsPanelProps {
  state: GameState;
  canAscend: boolean;
  ascensionMarks: number;
  onUpgrade: (talent: keyof Talents) => void;
  onAscend: () => void;
}

const talentIcons: Record<keyof Talents, IconName> = {
  attack: 'sword',
  health: 'shield',
  gold: 'coin',
  slots: 'backpack',
  crit: 'sparkle',
  overdrive: 'flame',
};

export function TalentsPanel({ state, canAscend, ascensionMarks, onUpgrade, onAscend }: TalentsPanelProps) {
  const [confirmAscend, setConfirmAscend] = useState(false);

  return (
    <div className="talents-panel">
      <p className="lede justified">Ore outlasts Gold. Spend it here to temper your knight permanently across every chapter and reforge.</p>
      <div className="ore-balance">
        <Icon name="ore" size={22} />
        <strong>{state.ore}</strong>
        <span>Ore ready to temper</span>
        {state.forgeMarks > 0 && (
          <em className="marks-chip">
            <Icon name="star" size={14} /> {state.forgeMarks} Marks (+{state.forgeMarks * 15}% Power)
          </em>
        )}
      </div>

      <div className="talent-list">
        {(Object.keys(TALENT_INFO) as (keyof Talents)[]).map((key) => {
          const info = TALENT_INFO[key];
          const level = state.talents[key];
          const maxed = level >= info.max;
          const cost = talentCost(key, level);
          return (
            <article className="talent-row" key={key}>
              <div className="talent-sigil"><Icon name={talentIcons[key]} size={28} /></div>
              <div className="talent-copy">
                <div className="talent-title"><h3>{info.name}</h3><span>Lv. {level}<i> / {info.max}</i></span></div>
                <p>{info.description}</p>
                <div className="talent-track"><span style={{ width: `${(level / info.max) * 100}%` }} /></div>
              </div>
              <button
                className="forge-button talent-button"
                disabled={maxed || state.ore < cost}
                onClick={() => onUpgrade(key)}
                aria-label={maxed ? `${info.name} maxed` : `Upgrade ${info.name} for ${cost} Ore`}
              >
                {maxed ? <Icon name="check" size={18} /> : <><Icon name="ore" size={16} />{cost}</>}
              </button>
            </article>
          );
        })}
      </div>

      <article className={`ascension-card ${canAscend ? 'is-ready' : ''}`}>
        <div className="ascension-head">
          <Icon name="star" size={30} />
          <div>
            <span className="eyebrow">Masterwork Ascension · Reforge {state.ascensions + 1}</span>
            <h3>Reforge the Valley</h3>
          </div>
        </div>
        <p className="justified">
          {canAscend
            ? `Restart at Stage 1 with a fresh pack to claim +${ascensionMarks} Forge Marks. Each Mark grants +15% Attack & HP and +10% Gold & Ore forever. Talents, Gems, Bestiary, and Achievements remain yours.`
            : `Reach Stage 5 to unlock Masterwork Ascension. Earn permanent Forge Marks that amplify every future chapter.`}
        </p>
        {canAscend && !confirmAscend && (
          <button className="forge-button forge-button--primary" onClick={() => setConfirmAscend(true)}>
            <Icon name="sparkle" size={18} />
            Reforge for +{ascensionMarks} Marks
          </button>
        )}
        {canAscend && confirmAscend && (
          <div className="ascend-confirm">
            <button
              className="forge-button forge-button--primary"
              onClick={() => {
                setConfirmAscend(false);
                onAscend();
              }}
            >
              Confirm Reforge
            </button>
            <button className="text-button" onClick={() => setConfirmAscend(false)}>Cancel</button>
          </div>
        )}
      </article>
    </div>
  );
}

interface CodexPanelProps {
  state: GameState;
  activeVoice: VoiceClipId | null;
  onToggleVoice: (id: VoiceClipId) => void;
}

const codexFilters: { value: 'all' | ItemCategory; label: string }[] = [
  { value: 'all', label: 'All Gear' },
  { value: 'weapon', label: 'Weapons' },
  { value: 'defense', label: 'Defense' },
  { value: 'support', label: 'Support' },
  { value: 'booster', label: 'Boosters' },
];

function gearStat(kind: ItemKind): string {
  const def = ITEM_DEFS[kind];
  if (def.baseDamage) return `${def.baseDamage} base damage · ${def.cooldown}s${def.cleave ? ` · Cleave ${def.cleave}` : ''}`;
  if (def.baseArmor && def.baseHp) return `${def.baseArmor} Armor · +${def.baseHp} HP`;
  if (def.baseArmor) return `${def.baseArmor} base Armor`;
  if (def.baseHeal) return `${def.baseHeal} HP/s restored`;
  if (kind === 'whetstone') return '+20% Attack per tier';
  if (kind === 'ember') return 'Burn for 3 seconds';
  if (kind === 'frost') return 'Slow movement & attacks';
  if (kind === 'bellows') return '+8% Crit & faster Overdrive';
  return '+12% attack speed per tier';
}

export function CodexPanel({ state, activeVoice, onToggleVoice }: CodexPanelProps) {
  const [section, setSection] = useState<'gear' | 'bestiary' | 'chronicle'>('gear');
  const [filter, setFilter] = useState<'all' | ItemCategory>('all');
  const kinds = SHOP_POOL.filter((kind) => filter === 'all' || ITEM_DEFS[kind].category === filter);

  return (
    <div className="codex-panel">
      <div className="codex-tabs" role="tablist" aria-label="Codex sections">
        <button role="tab" aria-selected={section === 'gear'} className={section === 'gear' ? 'active' : ''} onClick={() => setSection('gear')}>
          <Icon name="sword" size={16} /> Gear
        </button>
        <button role="tab" aria-selected={section === 'bestiary'} className={section === 'bestiary' ? 'active' : ''} onClick={() => setSection('bestiary')}>
          <Icon name="shield" size={16} /> Bestiary
        </button>
        <button role="tab" aria-selected={section === 'chronicle'} className={section === 'chronicle' ? 'active' : ''} onClick={() => setSection('chronicle')}>
          <Icon name="book" size={16} /> Chronicle
        </button>
      </div>

      {section === 'gear' && (
        <>
          <p className="lede justified">Boosters connect orthogonally (up, down, left, right) to adjacent weapons. Carry matching categories to awaken Set Bonds.</p>
          <div className="filter-ribbon" role="tablist" aria-label="Gear category">
            {codexFilters.map((entry) => (
              <button key={entry.value} role="tab" aria-selected={filter === entry.value} className={filter === entry.value ? 'active' : ''} onClick={() => setFilter(entry.value)}>{entry.label}</button>
            ))}
          </div>
          <div className="codex-list">
            {kinds.map((kind) => {
              const def = ITEM_DEFS[kind];
              const invTier = state.inventory.reduce((highest, item) => (item?.kind === kind ? Math.max(highest, item.tier) : highest), 0);
              const ownedTier = Math.max(invTier, state.highestTierForged[kind] ?? 0);
              return (
                <article className="codex-entry" key={kind}>
                  <div className="codex-art"><img src={`/art/items/${kind}.webp`} alt="" /></div>
                  <div className="codex-copy">
                    <span className="eyebrow">{def.category}</span>
                    <h3>{def.name}</h3>
                    <p className="justified">{def.description}</p>
                    <div className="codex-meta"><strong>{gearStat(kind)}</strong><span>{ownedTier ? `Highest forged: T${ownedTier}` : 'Not yet forged'}</span></div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="rarity-legend">
            {RARITIES.map((rarity, index) => <span key={rarity}><i style={{ background: RARITY_COLORS[index] }} />{rarity}</span>)}
          </div>
        </>
      )}

      {section === 'bestiary' && (
        <div className="codex-list">
          <p className="lede justified">Field notes on every ironbound beast, clockwork patrol, and foundry boss guarding the roads of Hearthstone Valley.</p>
          {ENEMY_BESTIARY.map((enemy) => {
            const defeated = state.stats.defeatedByKind[enemy.kind] ?? 0;
            return (
              <article className="codex-entry bestiary-entry" key={enemy.kind}>
                <div className="codex-art bestiary-art"><img src={enemy.portrait} alt="" /></div>
                <div className="codex-copy">
                  <span className="eyebrow">{enemy.isBoss ? 'Chapter Boss' : 'Valley Foe'} · {enemy.role}</span>
                  <h3>{enemy.name}</h3>
                  <p className="justified">{enemy.description}</p>
                  <div className="codex-meta">
                    <strong>Tip: {enemy.tacticTip}</strong>
                    <span>{defeated > 0 ? `${defeated} defeated` : 'Unencountered'}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {section === 'chronicle' && (
        <div className="codex-list">
          <article className="chronicle-card">
            <div className="chronicle-head">
              <div>
                <span className="eyebrow">{PROLOGUE_STORY.eyebrow}</span>
                <h3>{PROLOGUE_STORY.title}</h3>
              </div>
              <button
                type="button"
                className={`vo-pill-btn ${activeVoice === 'prologue' ? 'is-playing' : ''}`}
                onClick={() => onToggleVoice('prologue')}
              >
                <Icon name="volume" size={14} />
                <span>{activeVoice === 'prologue' ? 'Stop' : 'Listen'}</span>
              </button>
            </div>
            {PROLOGUE_STORY.paragraphs.map((p, i) => (
              <p className="justified" key={i}>{p}</p>
            ))}
          </article>
          {CHAPTERS.map((chapter) => {
            const unlocked = state.highestStage > chapter.chapterNumber;
            const current = state.highestStage === chapter.chapterNumber;
            const clipId = unlocked
              ? voClipForChapterChronicle(chapter.chapterNumber)
              : current
                ? voClipForChapterIntro(chapter.chapterNumber)
                : null;
            return (
              <article className={`chronicle-card ${unlocked ? 'is-cleared' : current ? 'is-current' : 'is-locked'}`} key={chapter.chapterNumber}>
                <div className="chronicle-head">
                  <div>
                    <span className="eyebrow">Chapter {chapter.roman} · {chapter.subtitle}</span>
                    <h3>{chapter.title}</h3>
                  </div>
                  {clipId && (
                    <button
                      type="button"
                      className={`vo-pill-btn ${activeVoice === clipId ? 'is-playing' : ''}`}
                      onClick={() => onToggleVoice(clipId)}
                    >
                      <Icon name="volume" size={14} />
                      <span>{activeVoice === clipId ? 'Stop' : 'Listen'}</span>
                    </button>
                  )}
                </div>
                {unlocked ? (
                  <p className="justified">{chapter.chronicleEntry}</p>
                ) : current ? (
                  <p className="justified">{chapter.introQuote} <em>(Defeat {chapter.bossTitle} on Wave 10 to complete this chronicle.)</em></p>
                ) : (
                  <p className="justified muted-copy">Reach Stage {chapter.chapterNumber} to unlock this chapter’s dispatch.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ShopPanelProps {
  state: GameState;
  offlineAvailable: boolean;
  rewardBusy: RewardedAction | null;
  purchaseBusy: boolean;
  onPurchase: () => void;
  onRestore: () => void;
  onRewarded: (action: RewardedAction) => void;
  onBuyGemOffer: (offerId: 'ore-pack' | 'gold-vault' | 'temper-gear') => void;
}

export function ShopPanel({
  state,
  offlineAvailable,
  rewardBusy,
  purchaseBusy,
  onPurchase,
  onRestore,
  onRewarded,
  onBuyGemOffer,
}: ShopPanelProps) {
  const rewards: { action: Exclude<RewardedAction, 'revive'>; title: string; description: string; icon: IconName; disabled?: boolean }[] = [
    { action: 'offline-double', title: 'Double Idle Rewards', description: offlineAvailable ? 'Your waiting forge haul is ready to double.' : 'No idle haul is waiting right now.', icon: 'coin', disabled: !offlineAvailable },
    { action: 'free-refresh', title: 'Free Shop Refresh', description: 'Turn all three Forge Shop slots without spending Gold.', icon: 'refresh' },
    { action: 'extra-slot', title: 'One Extra Slot', description: state.tempExtraSlot ? 'The bonus slot is yours until this stage ends.' : 'Carry one more piece until the current stage is cleared.', icon: 'backpack', disabled: state.tempExtraSlot },
  ];
  return (
    <div className="shop-panel">
      <div className="shop-banner-art">
        <div><span className="eyebrow">The honest forge</span><h3>Power, never chance.</h3><p className="justified">No paid lootboxes. No spin tables. Every reward here is shown clearly before you choose it.</p></div>
        <Icon name="shop" size={64} />
      </div>

      <article className="remove-ads-offer">
        <div className="offer-seal"><Icon name={state.removeAds ? 'check' : 'ad'} size={30} /></div>
        <div className="offer-copy">
          <span className="eyebrow">One-time purchase · USD $4.99</span>
          <h3>{state.removeAds ? 'The forge is ad-free.' : 'Remove Ads Forever'}</h3>
          <p>{state.removeAds ? 'Banner and interstitial ads are hidden on this device. Rewarded bonuses remain optional.' : 'Keep the battle quiet and the backpack clear. Rewarded bonuses stay optional.'}</p>
        </div>
        {state.removeAds ? (
          <button className="forge-button" disabled><Icon name="check" size={18} />Owned</button>
        ) : (
          <div className="offer-actions">
            <button className="forge-button" onClick={onPurchase} disabled={purchaseBusy || !isNativePlatform}>{purchaseBusy ? 'Opening…' : 'Get Remove Ads'}</button>
            <button className="text-button" onClick={onRestore} disabled={purchaseBusy || !isNativePlatform}><Icon name="restore" size={16} />Restore Purchase</button>
          </div>
        )}
      </article>

      <div className="subsection-heading">
        <Icon name="gem" size={22} />
        <h3>Gem Forge Exchange ({state.gems} Gems)</h3>
      </div>
      <div className="reward-list">
        {GEM_SHOP_OFFERS.map((offer) => (
          <article className="reward-row" key={offer.id}>
            <div className="reward-icon">
              <Icon name={offer.id === 'ore-pack' ? 'ore' : offer.id === 'gold-vault' ? 'coin' : 'sword'} size={25} />
            </div>
            <div>
              <h4>{offer.name}</h4>
              <p>{offer.description}</p>
            </div>
            <button
              className="forge-button"
              disabled={state.gems < offer.gems}
              onClick={() => onBuyGemOffer(offer.id)}
            >
              <Icon name="gem" size={15} />
              {offer.gems}
            </button>
          </article>
        ))}
      </div>

      <div className="subsection-heading"><Icon name="gift" size={22} /><h3>Watch a short ad, take a bonus</h3></div>
      <div className="reward-list">
        {rewards.map((reward) => (
          <article className="reward-row" key={reward.action}>
            <div className="reward-icon"><Icon name={reward.icon} size={25} /></div>
            <div><h4>{reward.title}</h4><p>{reward.description}</p></div>
            <button className="forge-button" disabled={reward.disabled || rewardBusy !== null} onClick={() => onRewarded(reward.action)}>
              {rewardBusy === reward.action ? 'Loading…' : reward.disabled ? <Icon name="check" size={18} /> : <><Icon name="play" size={15} />Watch</>}
            </button>
          </article>
        ))}
      </div>
      {usingTestAds && isNativePlatform && <p className="testing-note">Development build: Google test ad units are active.</p>}
    </div>
  );
}

interface BountiesPanelProps {
  state: GameState;
  onClaim: (id: string) => void;
}

export function BountiesPanel({ state, onClaim }: BountiesPanelProps) {
  return (
    <div className="achievements-panel">
      <p className="lede justified">Complete valley guild bounties as you merge, smelt, and clear waves. Claiming a bounty immediately posts a tougher, richer contract.</p>
      <div className="achievement-list">
        {state.bounties.map((bounty) => {
          const ready = bounty.progress >= bounty.target;
          return (
            <article className={`achievement-row bounty-row ${ready ? 'is-earned' : ''}`} key={bounty.id}>
              <div className="achievement-medal">
                <Icon name={bounty.kind === 'merge' ? 'sparkle' : bounty.kind === 'overdrive' ? 'flame' : bounty.kind === 'salvage' ? 'smelt' : 'sword'} size={27} />
              </div>
              <div className="achievement-copy">
                <h3>{bounty.title}</h3>
                <p>Tier {bounty.tier} Contract · +{bounty.rewardGold} Gold, +{bounty.rewardOre} Ore, +{bounty.rewardGems} Gems</p>
                <div className="achievement-track"><span style={{ width: `${Math.min(100, (bounty.progress / bounty.target) * 100)}%` }} /></div>
                <small>{bounty.progress} / {bounty.target}</small>
              </div>
              <button className="forge-button forge-button--primary" disabled={!ready} onClick={() => onClaim(bounty.id)}>
                {ready ? 'Claim' : `${bounty.progress}/${bounty.target}`}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function GuidePanel() {
  const sections: { icon: IconName; title: string; body: string }[] = [
    {
      icon: 'hand',
      title: '1. Drag & Merge Gear',
      body: 'Drag any piece onto a matching piece of the same kind and tier to forge the next tier (up to Tier 7 Masterwork). Buying a matching item from the Forge Shop when your pack is full will even Direct-Merge it!',
    },
    {
      icon: 'sparkle',
      title: '2. Orthogonal Boosters & Set Bonds',
      body: 'Boosters (Whetstone, Ember Core, Frost Crystal, Gear Mechanism, Brass Bellows) buff weapons directly up, down, left, or right—never diagonally. Carry 2+ matching categories to activate Set Bonds like Vanguard Wall or Blademaster Flurry.',
    },
    {
      icon: 'smelt',
      title: '3. Smelt Spare Gear',
      body: 'Tap any item in your pack to inspect its live boosted stats, or tap Smelt in the bottom-right of the inspector to recycle unneeded items into Gold and Ore.',
    },
    {
      icon: 'flame',
      title: '4. Anvil Strike Overdrive',
      body: 'Every swing and block charges Anvil Strike. When full (100%), tap the glowing Anvil Strike badge in the Arena to slam and stun all foes—or let Auto-Wave trigger it automatically.',
    },
    {
      icon: 'star',
      title: '5. Masterwork Ascension',
      body: 'Once you reach Stage 5, visit Talents to Reforge the Valley for permanent Forge Marks (+15% Attack & HP, +10% Gold & Ore per Mark).',
    },
  ];
  return (
    <div className="guide-panel">
      <p className="lede justified">Everything you need to master Hearthstone Valley’s backpack auto-battler in one place.</p>
      <div className="guide-list">
        {sections.map((s) => (
          <article className="guide-card" key={s.title}>
            <div className="guide-icon"><Icon name={s.icon} size={26} /></div>
            <div>
              <h3>{s.title}</h3>
              <p className="justified">{s.body}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

interface AchievementsPanelProps {
  state: GameState;
}

function achievementProgress(state: GameState, id: string): { current: number; target: number } {
  const maxTier = Math.max(
    ...Object.values(state.highestTierForged).map((t) => t ?? 0),
    ...state.inventory.map((item) => item?.tier ?? 0),
    0,
  );
  if (id === 'first-merge') return { current: Math.min(1, state.stats.merges), target: 1 };
  if (id === 'first-wave') return { current: Math.min(1, state.stats.waves), target: 1 };
  if (id === 'boss-one') return { current: Math.min(1, state.stats.bosses), target: 1 };
  if (id === 'stage-two') return { current: Math.min(2, state.highestStage), target: 2 };
  if (id === 'stage-four') return { current: Math.min(4, state.highestStage), target: 4 };
  if (id === 'stage-five') return { current: Math.min(5, state.highestStage), target: 5 };
  if (id === 'stage-eight') return { current: Math.min(8, state.highestStage), target: 8 };
  if (id === 'rare-gear') return { current: maxTier >= 3 ? 1 : 0, target: 1 };
  if (id === 'epic-gear') return { current: maxTier >= 4 ? 1 : 0, target: 1 };
  if (id === 'legendary-gear') return { current: maxTier >= 5 ? 1 : 0, target: 1 };
  if (id === 'merge-twenty') return { current: Math.min(20, state.stats.merges), target: 20 };
  if (id === 'enemy-hundred') return { current: Math.min(100, state.stats.enemies), target: 100 };
  if (id === 'overdrive-ten') return { current: Math.min(10, state.stats.overdrives), target: 10 };
  if (id === 'bounty-five') return { current: Math.min(5, state.stats.bountiesClaimed), target: 5 };
  if (id === 'smelt-five') return { current: Math.min(5, state.stats.salvages), target: 5 };
  if (id === 'first-ascension') return { current: Math.min(1, state.ascensions), target: 1 };
  return { current: 0, target: 1 };
}

export function AchievementsPanel({ state }: AchievementsPanelProps) {
  return (
    <div className="achievements-panel">
      <div className="gem-balance"><Icon name="gem" size={25} /><strong>{state.gems}</strong><span>Gems earned</span></div>
      <p className="lede justified">Milestones are paid in Gems once. Keep the receipts in your save, even after a long absence.</p>
      <div className="achievement-list">
        {ACHIEVEMENTS.map((achievement, index) => {
          const earned = state.achievements.includes(achievement.id);
          const progress = achievementProgress(state, achievement.id);
          return (
            <article className={`achievement-row ${earned ? 'is-earned' : ''}`} key={achievement.id}>
              <div className="achievement-medal"><Icon name={index === 0 ? 'sparkle' : index === 2 ? 'shield' : index >= 7 ? 'star' : 'trophy'} size={27} /></div>
              <div className="achievement-copy"><h3>{achievement.name}</h3><p>{achievement.description}</p><div className="achievement-track"><span style={{ width: `${(progress.current / progress.target) * 100}%` }} /></div><small>{progress.current} / {progress.target}</small></div>
              <span className="achievement-gem"><Icon name="gem" size={16} />+{achievement.gems}</span>
              {earned && <span className="earned-stamp">Earned</span>}
            </article>
          );
        })}
      </div>
    </div>
  );
}

interface DailyPanelProps {
  state: GameState;
  onClaim: () => void;
}

const dailyNames = ['Kindling', 'Steel & Stone', 'A Gleaming Ore', 'Caravan Gold', 'Deep Seam', 'Masterwork', 'The Great Haul'];
const dailyGold = [80, 120, 0, 180, 0, 260, 400];
const dailyOre = [3, 5, 8, 8, 12, 12, 20];
const dailyGems = [0, 0, 3, 0, 5, 0, 15];

function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function DailyPanel({ state, onClaim }: DailyPanelProps) {
  const claimedToday = state.dailyLastClaim === todayKey();
  const nextDay = claimedToday ? state.dailyStreak : (state.dailyStreak % 7) + 1;
  return (
    <div className="daily-panel">
      <div className="daily-hero"><Icon name="calendar" size={48} /><div><span className="eyebrow">Seven watches, one forge</span><h3>{claimedToday ? 'Today’s gift is in your pack.' : `Day ${nextDay} is waiting.`}</h3><p>{claimedToday ? 'Come back tomorrow to keep the seven-day watch.' : 'Claim each local day to keep the streak alive.'}</p></div></div>
      <div className="daily-calendar">
        {dailyNames.map((name, index) => {
          const day = index + 1;
          const isToday = day === nextDay && !claimedToday;
          const completed = day <= state.dailyStreak && claimedToday;
          return (
            <article className={`daily-day ${isToday ? 'is-today' : ''} ${completed ? 'is-complete' : ''}`} key={name}>
              <span className="day-number">Day {day}</span>
              <div className="day-icon">{day === 7 ? <Icon name="star" size={30} /> : day === 3 || day === 5 ? <Icon name="gem" size={28} /> : <Icon name={day % 2 ? 'coin' : 'ore'} size={28} />}</div>
              <h4>{name}</h4>
              <div className="day-rewards">
                {dailyGold[index] > 0 && <span><Icon name="coin" size={14} />{dailyGold[index]}</span>}
                {dailyOre[index] > 0 && <span><Icon name="ore" size={14} />{dailyOre[index]}</span>}
                {dailyGems[index] > 0 && <span><Icon name="gem" size={14} />{dailyGems[index]}</span>}
              </div>
              {completed && <span className="day-check"><Icon name="check" size={16} /></span>}
            </article>
          );
        })}
      </div>
      <button className="forge-button forge-button--primary claim-daily" disabled={claimedToday} onClick={onClaim}>
        <Icon name={claimedToday ? 'check' : 'gift'} size={21} />{claimedToday ? 'Claimed Today' : `Claim Day ${nextDay}`}
      </button>
    </div>
  );
}

interface SettingsContentProps {
  settings: GameSettings;
  recovered: boolean;
  onSettings: (patch: Partial<GameSettings>) => void;
  onTheme: (theme: Theme) => void;
  onExport: () => void;
  onImport: (text: string) => boolean;
  onReset: () => void;
  onPrivacy: () => void;
}

const themeOptions: { value: Theme; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'warm', label: 'Warm', icon: 'flame' },
];

export function SettingsContent({ settings, recovered, onSettings, onTheme, onExport, onImport, onReset, onPrivacy }: SettingsContentProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState(false);
  return (
    <div className="settings-panel">
      {recovered && <div className="recovery-note"><Icon name="restore" size={21} /><p><strong>Your backup caught you.</strong> The main save was unreadable, so the last safe forge record was restored.</p></div>}
      <section className="settings-section">
        <div className="settings-heading"><Icon name="sun" size={22} /><h3>Workshop light</h3></div>
        <div className="theme-selector">
          {themeOptions.map((theme) => <button key={theme.value} className={settings.theme === theme.value ? 'active' : ''} onClick={() => onTheme(theme.value)}><Icon name={theme.icon} size={21} />{theme.label}</button>)}
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-heading"><Icon name="volume" size={22} /><h3>Sound & feel</h3></div>
        <SettingToggle label="Forge & battle sounds" description="Hammer, merge chimes, sword swings, and coin drops." checked={settings.sfx} onChange={(value) => onSettings({ sfx: value })} />
        <label className="range-setting"><span>Sound volume</span><input type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={(event) => onSettings({ sfxVolume: Number(event.target.value) })} /><strong>{Math.round(settings.sfxVolume * 100)}%</strong></label>
        <SettingToggle label="Workshop ambience" description="Soft wind, hearth embers, and distant birds. No instrumental music." checked={settings.ambience} onChange={(value) => onSettings({ ambience: value })} />
        <label className="range-setting"><span>Ambience volume</span><input type="range" min="0" max="1" step="0.05" value={settings.ambienceVolume} onChange={(event) => onSettings({ ambienceVolume: Number(event.target.value) })} /><strong>{Math.round(settings.ambienceVolume * 100)}%</strong></label>
        <SettingToggle label="Story voice-over" description="Spoken narration for prologue, chapters, bosses, and lore." checked={settings.voice} onChange={(value) => onSettings({ voice: value })} />
        <label className="range-setting"><span>Voice-over volume</span><input type="range" min="0" max="1" step="0.05" value={settings.voiceVolume} onChange={(event) => onSettings({ voiceVolume: Number(event.target.value) })} /><strong>{Math.round(settings.voiceVolume * 100)}%</strong></label>
        <SettingToggle label="Touch feedback" description="A short vibration for merges and important actions." checked={settings.haptics} onChange={(value) => onSettings({ haptics: value })} />
      </section>
      <section className="settings-section">
        <div className="settings-heading"><Icon name="download" size={22} /><h3>Save & backup</h3></div>
        <p className="section-note justified">Progress autosaves after every merge, purchase, and wave. A second local copy protects against a damaged save.</p>
        <div className="save-actions">
          <button className="forge-button" onClick={onExport}><Icon name="download" size={18} />Export Save</button>
          <button className="forge-button" onClick={() => fileRef.current?.click()}><Icon name="upload" size={18} />Import Save</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const ok = onImport(await file.text());
            setImportError(!ok);
            event.target.value = '';
          }} />
        </div>
        {importError && <p className="form-error">That file is not a valid Backpack Forge save.</p>}
        {confirmReset ? (
          <div className="reset-confirm"><p><strong>Start a completely new forge?</strong> Export a backup first if you want to keep this one.</p><button className="danger-button" onClick={() => { onReset(); setConfirmReset(false); }}>Yes, reset progress</button><button className="text-button" onClick={() => setConfirmReset(false)}>Keep my forge</button></div>
        ) : <button className="text-button danger-text" onClick={() => setConfirmReset(true)}><Icon name="trash" size={17} />Reset local progress</button>}
      </section>
      <section className="settings-section privacy-section">
        <div className="settings-heading"><Icon name="shield" size={22} /><h3>Privacy choices</h3></div>
        <p className="section-note justified">Ads use Google’s consent tools. Rewarded ads are always optional, and Remove Ads hides banner and interstitial placements.</p>
        {isNativePlatform && <button className="forge-button" onClick={onPrivacy}><Icon name="settings" size={18} />Privacy Options</button>}
      </section>
      <p className="build-label">Backpack Forge · v1.1.0 · F7 Developer</p>
    </div>
  );
}

function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="toggle-setting">
      <div><strong>{label}</strong><p>{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}><span /></button>
    </div>
  );
}
