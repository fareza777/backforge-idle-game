export type VoiceClipId =
  | 'prologue'
  | 'ch1-intro'
  | 'ch2-intro'
  | 'ch3-intro'
  | 'ch4-intro'
  | 'ch5-intro'
  | 'ch6-intro'
  | 'ch7-intro'
  | 'ch8-intro'
  | 'ch1-boss'
  | 'ch2-boss'
  | 'ch3-boss'
  | 'ch4-boss'
  | 'ch5-boss'
  | 'ch6-boss'
  | 'ch7-boss'
  | 'ch8-boss'
  | 'ch1-chronicle'
  | 'ch2-chronicle'
  | 'ch3-chronicle'
  | 'ch4-chronicle'
  | 'ch5-chronicle'
  | 'ch6-chronicle'
  | 'ch7-chronicle'
  | 'ch8-chronicle'
  | 'onboard-0'
  | 'onboard-1'
  | 'onboard-2'
  | 'wb-anvil_titan'
  | 'wb-furnace_behemoth'
  | 'wb-frostforge_automaton'
  | 'defeat'
  | 'about-story';

const ALL_VOICE_IDS: VoiceClipId[] = [
  'prologue',
  'ch1-intro',
  'ch2-intro',
  'ch3-intro',
  'ch4-intro',
  'ch5-intro',
  'ch6-intro',
  'ch7-intro',
  'ch8-intro',
  'ch1-boss',
  'ch2-boss',
  'ch3-boss',
  'ch4-boss',
  'ch5-boss',
  'ch6-boss',
  'ch7-boss',
  'ch8-boss',
  'ch1-chronicle',
  'ch2-chronicle',
  'ch3-chronicle',
  'ch4-chronicle',
  'ch5-chronicle',
  'ch6-chronicle',
  'ch7-chronicle',
  'ch8-chronicle',
  'onboard-0',
  'onboard-1',
  'onboard-2',
  'wb-anvil_titan',
  'wb-furnace_behemoth',
  'wb-frostforge_automaton',
  'defeat',
  'about-story',
];

export const VO_CLIP_PATHS: Record<VoiceClipId, string> = Object.fromEntries(
  ALL_VOICE_IDS.map((id) => [id, `/audio/vo/${id}.mp3`]),
) as Record<VoiceClipId, string>;

function chapterIndexForStage(stage: number): number {
  const safeStage = Math.max(1, Math.floor(stage));
  return ((safeStage - 1) % 8) + 1;
}

export function voClipForChapterIntro(stage: number): VoiceClipId {
  return `ch${chapterIndexForStage(stage)}-intro` as VoiceClipId;
}

export function voClipForChapterBoss(stage: number): VoiceClipId {
  return `ch${chapterIndexForStage(stage)}-boss` as VoiceClipId;
}

export function voClipForChapterChronicle(stage: number): VoiceClipId {
  return `ch${chapterIndexForStage(stage)}-chronicle` as VoiceClipId;
}

export function voClipForWorldBoss(bossId: string): VoiceClipId {
  if (bossId === 'furnace_behemoth' || bossId === 'ignis_colossus') {
    return 'wb-furnace_behemoth';
  }
  if (bossId === 'frostforge_automaton' || bossId === 'aether_leviathan') {
    return 'wb-frostforge_automaton';
  }
  return 'wb-anvil_titan';
}
