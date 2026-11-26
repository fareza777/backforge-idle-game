import fs from 'node:fs';
import path from 'node:path';

const apiKey = process.env.DEEPGRAM_API_KEY;
if (!apiKey) {
  console.error('Missing DEEPGRAM_API_KEY environment variable.');
  process.exit(1);
}

const model = process.env.DEEPGRAM_VOICE || 'aura-2-draco-en';
const force = process.argv.includes('--force');
const outDir = path.resolve('public/audio/vo');
fs.mkdirSync(outDir, { recursive: true });

const CLIPS = [
  {
    id: 'prologue',
    text: 'The Quiet Anvil. For three winters, the great waterwheels of Hearthstone Valley stood still. Without smiths to tend the mountain roads, old brass-forged sentinels and iron-plated beasts wandered down from the high quarries, blocking every caravan between the valley and Emberpeak. One stubborn Forge Knight remains at the gate, and your grandfather’s leather pack still holds the last tempered steel. Merge matching gear, arrange boosters beside your blades, and wake the valley’s anvils one honest wave at a time.',
  },
  {
    id: 'ch1-intro',
    text: 'Chapter 1, Sunlit Forge Valley. Caravan lanterns are dark along the river road. Clear the meadow gate and relight the first hearth.',
  },
  {
    id: 'ch2-intro',
    text: 'Chapter 2, Ashen Quarry. Beyond the meadow, terraced iron cliffs echo with heavy footsteps. Stone sentinels guard the mine archway.',
  },
  {
    id: 'ch3-intro',
    text: 'Chapter 3, Ironbridge Foundry. Steam rises from the great stone viaduct. Swift clockwork hounds patrol the bridge deck ahead.',
  },
  {
    id: 'ch4-intro',
    text: 'Chapter 4, Emberpeak Citadel. Golden light crowns the mountain fortress. Only seasoned steel and smart pack placement endure here.',
  },
  {
    id: 'ch5-intro',
    text: 'Chapter 5, Rekindled Valley. Reinforced clockwork patrols test the valley’s new defenses. Masterwork Ascension unlocks here.',
  },
  {
    id: 'ch6-intro',
    text: 'Chapter 6, Deep Ashen Seams. In the lower canyon, quarry machines run at full pressure. Keep Frost and Ember close to your main blades.',
  },
  {
    id: 'ch7-intro',
    text: 'Chapter 7, The Great Aqueduct. Across the upper aqueduct, rapid clockwork packs close the distance in heartbeats.',
  },
  {
    id: 'ch8-intro',
    text: 'Chapter 8, Crown of Steel. The highest courtyard awaits. Every forged bond, talent, and timing choice converges on the Crown of Steel.',
  },
  {
    id: 'ch1-boss',
    text: 'The Forge Colossus steps onto the bridge—solid brass plates, twin furnace vents, and an anvil-sized hammer.',
  },
  {
    id: 'ch2-boss',
    text: 'The Obsidian Warden plants its riveted tower shield in the quarry dust and ignites its furnace halberd.',
  },
  {
    id: 'ch3-boss',
    text: 'Twin chimneys roar as the Molten Dreadnought lumbers across the cobblestones, hoisting its anvil-gauntlets.',
  },
  {
    id: 'ch4-boss',
    text: 'At the summit terrace, the Citadel Warden lowers its visor—unyielding plate and sweeping halberd arcs.',
  },
  {
    id: 'ch5-boss',
    text: 'A newly tempered Forge Colossus Prime marches across the meadow—heavier, faster, and armored in gilded brass.',
  },
  {
    id: 'ch6-boss',
    text: 'Obsidian Warden Prime locks shields with booming precision—only sustained strikes or Anvil Overdrive can stagger it.',
  },
  {
    id: 'ch7-boss',
    text: 'Molten Dreadnought Prime vents white-hot steam across the stone span—brace your shields and unleash Overdrive!',
  },
  {
    id: 'ch8-boss',
    text: 'The Sovereign Dreadnought—pinnacle of the old foundry—steps forward to test the finest pack in the realm.',
  },
  {
    id: 'ch1-chronicle',
    text: 'With the Forge Colossus felled at the river bridge, the valley smithy drew its first steady breath in years. Merchants rolled their carts back down to the square, bringing fresh ore from the foothills.',
  },
  {
    id: 'ch2-chronicle',
    text: 'Breaking through the Ashen Quarry reopened the deep iron seams. Miners salvaged crates of clean basalt and raw ore, letting your knight carry heavier armor into the mountain pass.',
  },
  {
    id: 'ch3-chronicle',
    text: 'Once the Molten Dreadnought’s boilers cooled, the Ironbridge waterwheels turned freely again. Clean water and steady bellows air doubled the valley’s daily output.',
  },
  {
    id: 'ch4-chronicle',
    text: 'Lighting the four summit braziers of Emberpeak signaled peace across every mountain pass. Yet deeper mechanical vaults still hum beneath the snowline.',
  },
  {
    id: 'ch5-chronicle',
    text: 'The valley’s proving grounds proved your craft beyond doubt. Smiths from distant ridges now seek your Forge Marks to temper their own blades.',
  },
  {
    id: 'ch6-chronicle',
    text: 'Even the deepest quarry vaults yielded their finest ingots. Every strike of your knight’s hammer now carries the weight of six chapters.',
  },
  {
    id: 'ch7-chronicle',
    text: 'With the Great Aqueduct secured, every foundry from the river to the high ridges beats in steady, peaceful rhythm.',
  },
  {
    id: 'ch8-chronicle',
    text: 'At the Crown of Steel, the Grand Forge roared back to life. Your name stands beside the master smiths of Hearthstone Valley, and endless Masterwork trials await beyond.',
  },
  {
    id: 'onboard-0',
    text: 'Drag one sword onto the other to forge a stronger blade.',
  },
  {
    id: 'onboard-1',
    text: 'Forge bond. The Whetstone adds twenty percent attack to the blade beside it.',
  },
  {
    id: 'onboard-2',
    text: 'Start the wave below. Your knight fights automatically.',
  },
  {
    id: 'wb-anvil_titan',
    text: 'Ironcrown Anvil Titan. The sovereign juggernaut of Emberpeak Citadel. Twin steam chimneys roar as its anvil-gauntlets shake the mountain terrace.',
  },
  {
    id: 'wb-furnace_behemoth',
    text: 'Grand Furnace Behemoth. A towering twin-boiler colossus forged beneath Ironbridge. Every hammer blow vents white-hot cinders across the viaduct.',
  },
  {
    id: 'wb-frostforge_automaton',
    text: 'Frostforge Automaton. Clad in quenched mountain steel and frost-tempered plate, it guards the high passes with sweeping halberd arcs.',
  },
  {
    id: 'defeat',
    text: 'The forge went cold. Your knight held the line until the line gave way. Reforge the plan and try again.',
  },
  {
    id: 'about-story',
    text: 'The valley’s old forge has gone quiet. You are the smith who will wake it, one blade, one brave knight, and one impossible pack at a time.',
  },
];

let totalBytes = 0;

for (const clip of CLIPS) {
  const filePath = path.join(outDir, `${clip.id}.mp3`);
  if (!force && fs.existsSync(filePath) && fs.statSync(filePath).size >= 2000) {
    const existingSize = fs.statSync(filePath).size;
    totalBytes += existingSize;
    console.log(`[skip] ${clip.id}.mp3 (${existingSize} bytes)`);
    continue;
  }

  const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3&bit_rate=48000`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: clip.text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[error] ${clip.id}: HTTP ${res.status} - ${errText}`);
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) {
    console.error(`[error] ${clip.id}: generated audio too small (${buf.length} bytes)`);
    process.exit(1);
  }

  fs.writeFileSync(filePath, buf);
  totalBytes += buf.length;
  console.log(`[ok] ${clip.id}.mp3 (${buf.length} bytes)`);
}

console.log(`Generated/verified ${CLIPS.length} VO clips. Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
