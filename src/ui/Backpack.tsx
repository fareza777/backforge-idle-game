import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  backpackDimensions,
  calculateLoadout,
  inventoryCapacity,
  ITEM_DEFS,
  MAX_TIER,
  orthogonalNeighbors,
  RARITIES,
  RARITY_COLORS,
  salvageValue,
  scaleForTier,
} from '../game/data';
import type { GameState, Item, Talents } from '../game/types';
import type { VoiceClipId } from '../game/voice';
import { Icon } from './Icons';

export type MoveResult = 'merged' | 'moved' | 'swapped' | 'none';

interface BackpackProps {
  state: GameState;
  onMove: (from: number, to: number) => MoveResult;
  onSalvage: (index: number) => boolean;
  onAdvanceOnboarding: () => void;
  onSkipOnboarding: () => void;
  activeVoice?: VoiceClipId | null;
  onToggleVoice?: (id: VoiceClipId) => void;
}

interface DragState {
  from: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

export function Backpack({
  state,
  onMove,
  onSalvage,
  onAdvanceOnboarding,
  onSkipOnboarding,
  activeVoice,
  onToggleVoice,
}: BackpackProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pulse, setPulse] = useState<{ slot: number; id: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capacity = inventoryCapacity(state.talents, state.tempExtraSlot);
  const usedSlots = state.inventory.slice(0, capacity).filter(Boolean).length;
  const { columns, rows } = backpackDimensions(state.talents, state.tempExtraSlot);
  const activeIndex = drag?.moved ? drag.from : selected;
  const selectedItem = selected !== null ? state.inventory[selected] : null;
  const showCoach = !state.onboardingDone && state.onboardingStep < 3;

  const loadout = useMemo(
    () => calculateLoadout(state.inventory, state.talents, state.forgeMarks),
    [state.forgeMarks, state.inventory, state.talents],
  );
  const activeBonds = useMemo(() => loadout.bonds.filter((bond) => bond.active), [loadout.bonds]);

  const linkedSlots = useMemo(() => {
    const map = new Map<number, string>();
    loadout.synergyLinks.forEach((link) => {
      if (!map.has(link.to)) map.set(link.to, ITEM_DEFS[link.kind].accent);
      if (!map.has(link.from)) map.set(link.from, ITEM_DEFS[link.kind].accent);
    });
    return map;
  }, [loadout.synergyLinks]);

  const highlighted = useMemo(() => {
    const result = new Set<number>();
    if (activeIndex === null) return result;
    const item = state.inventory[activeIndex];
    if (!item) return result;
    orthogonalNeighbors(activeIndex, columns, capacity).forEach((index) => {
      const neighbor = state.inventory[index];
      if (!neighbor) return;
      const category = ITEM_DEFS[item.kind].category;
      const neighborCategory = ITEM_DEFS[neighbor.kind].category;
      if ((category === 'booster' && neighborCategory === 'weapon') || (category === 'weapon' && neighborCategory === 'booster')) {
        result.add(index);
      }
    });
    return result;
  }, [activeIndex, capacity, columns, state.inventory]);

  const tutorialSlots = useMemo(() => {
    const result = new Set<number>();
    if (state.onboardingStep === 0) {
      result.add(0);
      result.add(1);
    }
    if (state.onboardingStep === 1 && state.inventory[2]) {
      result.add(2);
      orthogonalNeighbors(2, columns, capacity).forEach((index) => result.add(index));
    }
    return result;
  }, [capacity, columns, state.inventory, state.onboardingStep]);

  function beginDrag(event: PointerEvent<HTMLButtonElement>, index: number, item: Item | null) {
    if (!item || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next: DragState = {
      from: index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const moved = current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 6;
    const next = { ...current, x: event.clientX, y: event.clientY, moved };
    dragRef.current = next;
    setDrag(next);
    if (moved) {
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]');
      const index = target ? Number(target.dataset.slot) : NaN;
      setHover(Number.isInteger(index) && index >= 0 && index < capacity ? index : null);
    }
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) {
      if (selected !== null && selected !== Number((event.currentTarget as HTMLElement).dataset.slot)) {
        onMove(selected, Number((event.currentTarget as HTMLElement).dataset.slot));
        setSelected(null);
      }
      return;
    }
    if (current.moved) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]');
      const index = target ? Number(target.dataset.slot) : NaN;
      if (Number.isInteger(index) && index >= 0 && index < capacity && index !== current.from) {
        const result = onMove(current.from, index);
        if (result === 'merged') {
          if (pulseTimer.current) clearTimeout(pulseTimer.current);
          setPulse({ slot: index, id: Date.now() });
          pulseTimer.current = setTimeout(() => setPulse(null), 650);
          setSelected(index);
        } else if (result !== 'none') {
          setSelected(index);
        }
      }
    } else if (selected !== null && selected !== current.from) {
      onMove(selected, current.from);
      setSelected(null);
    } else {
      setSelected(selected === current.from ? null : current.from);
    }
    dragRef.current = null;
    setDrag(null);
    setHover(null);
  }

  function cancelDrag() {
    dragRef.current = null;
    setDrag(null);
    setHover(null);
  }

  const gridStyle = {
    '--columns': columns,
    '--rows': rows,
  } as CSSProperties;

  const selectedWeapon = selected !== null ? loadout.weapons.find((w) => w.slotIndex === selected) : undefined;
  const selectedSalvage = selectedItem ? salvageValue(selectedItem, state.stage) : null;

  function selectedStatLine(): string {
    if (!selectedItem) return '';
    const def = ITEM_DEFS[selectedItem.kind];
    const scale = scaleForTier(selectedItem.tier);
    if (selectedWeapon) {
      const extras = selectedWeapon.boostLabels.length ? ` (${selectedWeapon.boostLabels.join(' · ')})` : '';
      return `${Math.round(selectedWeapon.damage)} ATK · ${selectedWeapon.cooldown.toFixed(2)}s${extras}`;
    }
    if (def.category === 'defense') {
      const parts: string[] = [];
      if (def.baseArmor) parts.push(`+${Math.round(def.baseArmor * scale)} Armor`);
      if (def.baseHp) parts.push(`+${Math.round(def.baseHp * scale)} Max HP`);
      return parts.join(' · ');
    }
    if (def.category === 'support' && def.baseHeal) {
      return `+${(def.baseHeal * scale).toFixed(1)} HP/s`;
    }
    return def.description;
  }

  return (
    <section className={`backpack-section ${showCoach ? 'is-onboarding' : ''}`} aria-label="Backpack">
      {!showCoach && (
        <div className="section-heading backpack-heading">
          <div className="section-title">
            <Icon name="backpack" size={20} />
            <h2>Your Backpack</h2>
          </div>
          <div className="pack-heading-right">
            {activeBonds.length > 0 && (
              <div className="bond-pills" title={activeBonds.map((b) => `${b.name}: ${b.bonusText}`).join('\n')}>
                {activeBonds.slice(0, 2).map((bond) => (
                  <span key={bond.id} className="bond-pill">
                    <Icon name="sparkle" size={12} />
                    {bond.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            )}
            <span className="capacity-label">{usedSlots}<span> / {capacity}</span></span>
          </div>
        </div>
      )}

      {showCoach && (
        <div className="onboarding-coach" role="status">
          <div className="coach-icon"><Icon name={state.onboardingStep === 0 ? 'hand' : state.onboardingStep === 1 ? 'sparkle' : 'sword'} size={23} /></div>
          <div className="coach-copy">
            <span className="eyebrow">{state.onboardingStep === 2 ? 'Final lesson' : 'First lesson'} · {state.onboardingStep + 1} of 3</span>
            {state.onboardingStep === 0
              ? <p><strong>Drag one sword onto the other</strong> to forge a stronger blade.</p>
              : state.onboardingStep === 1
                ? <p><strong>Forge bond:</strong> the Whetstone adds +20% Attack to the blade beside it.</p>
                : <p><strong>Start the wave below.</strong> Your knight fights automatically.</p>}
          </div>
          <div className="coach-actions">
            {onToggleVoice && (
              <button
                type="button"
                className={`vo-mini-btn ${activeVoice === (`onboard-${state.onboardingStep}` as VoiceClipId) ? 'is-playing' : ''}`}
                aria-label="Listen to guide"
                onClick={() => onToggleVoice(`onboard-${state.onboardingStep}` as VoiceClipId)}
              >
                <Icon name="volume" size={14} />
              </button>
            )}
            {state.onboardingStep === 1
              ? <button className="forge-button" onClick={onAdvanceOnboarding}>I’m ready</button>
              : <button className="text-button" onClick={onSkipOnboarding}>Skip</button>}
          </div>
        </div>
      )}

      <div className="backpack-frame">
        <div className="backpack-flap" aria-hidden="true"><span /></div>
        <div
          className={`backpack-grid ${drag?.moved ? 'is-dragging' : ''}`}
          style={gridStyle}
          role="grid"
          aria-label={`${columns} by ${rows} backpack grid`}
          onContextMenu={(event) => event.preventDefault()}
        >
          {Array.from({ length: capacity }, (_, index) => {
            const item = state.inventory[index];
            const definition = item ? ITEM_DEFS[item.kind] : null;
            const isTutorial = tutorialSlots.has(index);
            const isHover = hover === index && drag?.moved && drag.from !== index;
            const canMerge = Boolean(
              item
                && drag?.moved
                && state.inventory[drag.from]?.kind === item.kind
                && state.inventory[drag.from]?.tier === item.tier
                && item.tier < MAX_TIER,
            );
            const linkAccent = linkedSlots.get(index);
            const rarityStyle = item
              ? ({
                  '--rarity': RARITY_COLORS[item.tier - 1],
                  ...(linkAccent ? { '--link-accent': linkAccent } : {}),
                } as CSSProperties)
              : undefined;
            return (
              <button
                key={index}
                type="button"
                data-slot={index}
                data-testid={`backpack-slot-${index}`}
                role="gridcell"
                aria-label={item ? `${definition?.name}, Tier ${item.tier}, slot ${index + 1}` : `Empty slot ${index + 1}`}
                aria-selected={selected === index}
                className={[
                  'backpack-slot',
                  item ? 'has-item' : 'is-empty',
                  selected === index ? 'is-selected' : '',
                  highlighted.has(index) ? 'is-boosted' : '',
                  linkAccent ? 'has-synergy-link' : '',
                  isTutorial ? 'is-tutorial' : '',
                  isHover ? 'is-drop-target' : '',
                  canMerge ? 'can-merge' : '',
                  index === capacity - 1 && state.tempExtraSlot ? 'is-bonus-slot' : '',
                  drag?.moved && drag.from === index ? 'is-drag-source' : '',
                ].filter(Boolean).join(' ')}
                style={rarityStyle}
                onPointerDown={(event) => beginDrag(event, index, item)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
              >
                {item ? (
                  <>
                    <img className="item-art" src={`/art/items/${item.kind}.webp`} alt="" draggable={false} />
                    <span className="tier-badge">T{item.tier}</span>
                    {definition?.category === 'booster' && <span className="booster-mark" aria-hidden="true">+</span>}
                    {linkAccent && definition?.category === 'weapon' && (
                      <span className="synergy-pip" aria-hidden="true" style={{ background: linkAccent }} />
                    )}
                    {pulse?.slot === index && <span key={pulse.id} className="merge-burst"><Icon name="sparkle" size={42} /></span>}
                  </>
                ) : (
                  <span className="empty-slot-mark" aria-hidden="true">+</span>
                )}
              </button>
            );
          })}
          {state.onboardingStep === 0 && !drag?.moved && (
            <div className="tutorial-hand" aria-hidden="true">
              <Icon name="hand" size={32} />
              <span />
            </div>
          )}
        </div>
        <div className="backpack-stitch" aria-hidden="true" />
      </div>

      {!showCoach && (
        <div className={`item-inspector ${selectedItem ? 'has-selection' : ''}`} aria-live="polite">
          {selectedItem && selected !== null ? (
            <div className="inspector-row">
              <div className="inspector-copy">
                <span className="inspector-rarity" style={{ color: RARITY_COLORS[selectedItem.tier - 1] }}>
                  {RARITIES[selectedItem.tier - 1]} · T{selectedItem.tier}
                </span>
                <strong>{ITEM_DEFS[selectedItem.kind].name}</strong>
                <p>{selectedStatLine()}</p>
              </div>
              {selectedSalvage && usedSlots > 1 && (
                <button
                  type="button"
                  className="smelt-button"
                  title={`Smelt for +${selectedSalvage.gold} Gold and +${selectedSalvage.ore} Ore`}
                  onClick={() => {
                    if (onSalvage(selected)) setSelected(null);
                  }}
                >
                  <Icon name="smelt" size={17} />
                  <span>+{selectedSalvage.ore}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <Icon name="hand" size={19} />
              <p><strong>Drag to merge.</strong> Tap any gear to inspect stats or smelt for Ore.</p>
            </>
          )}
        </div>
      )}

      {drag?.moved && state.inventory[drag.from] && (
        <div
          className="drag-ghost"
          style={{ left: drag.x, top: drag.y, '--rarity': RARITY_COLORS[state.inventory[drag.from]!.tier - 1] } as CSSProperties}
          aria-hidden="true"
        >
          <img src={`/art/items/${state.inventory[drag.from]!.kind}.webp`} alt="" />
          <span>T{state.inventory[drag.from]!.tier}</span>
        </div>
      )}
    </section>
  );
}

export function boosterHint(talents: Talents): string {
  return talents.slots >= 2
    ? 'Boosters connect up, down, left, or right — never diagonally.'
    : 'Place a booster beside a weapon to wake up its power.';
}
