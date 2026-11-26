from pathlib import Path
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent
RATE = 48000
DURATION = 37
rng = np.random.default_rng(731)
mix = np.zeros((RATE * DURATION, 2), dtype=np.float32)


def add(signal, when, level, pan=0):
    start = round(when * RATE)
    frames = max(0, min(len(signal), len(mix) - start))
    gains = np.sqrt([(1 - pan) / 2, (1 + pan) / 2])
    mix[start:start+frames] += signal[:frames, None] * level * gains


def note(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def pluck(midi, length=.72, softness=1):
    t = np.arange(round(length * RATE)) / RATE
    w = 2*np.pi*note(midi)*t
    tone = np.sin(w + .12*np.sin(w*2.01)) + .28*np.sin(w*2.001) + .14*np.sin(w*3.994)
    return tone * (1-np.exp(-t*116)) * np.exp(-t*(4.7/softness))


def pad(midi, length=4):
    t = np.arange(round(length * RATE)) / RATE
    w = 2*np.pi*note(midi)*t
    tone = np.sin(w*.998) + .46*np.sin(w*1.003) + .22*np.sin(2*w+.22*np.sin(t*4))
    return tone * np.sin(np.pi*t/length)**1.35


def strike(length=1.25):
    t = np.arange(round(length*RATE))/RATE
    waves = sum(np.sin(2*np.pi*f*t)*k*np.exp(-t*r) for f,k,r in
                [(302,.51,6),(672,.38,5),(1373,.18,11),(2090,.22,13),(3460,.12,25)])
    air = np.diff(rng.normal(0,.25,len(t)+1))*np.exp(-t*48)
    return (waves+air)*np.minimum(1,t*1350)


def drum(deep=True):
    t = np.arange(int(.56*RATE))/RATE
    bend = (47 if deep else 89)*t + 1.75*(1-np.exp(-35*t))
    noise = rng.normal(0,.13,len(t))*np.exp(-t*22)
    return (np.sin(np.pi*2*bend)*np.exp(-t*8)+noise)*np.minimum(1,t*398)


def breath(length=.36):
    n = int(length*RATE)
    raw = rng.normal(0,1,n)
    air = np.convolve(raw,np.ones(42)/42,mode="same")
    return air*np.sin(np.linspace(0,np.pi,n))**2


chords = [(47,54,59,62),(43,50,55,59),(50,57,62,66),(45,52,57,61)]
for bar in range(18):
    chord = chords[bar % 4]
    time = 1 + bar*2
    quieter = 11 <= bar <= 13
    for voice, midi in enumerate(chord):
        add(pad(midi),time,.046 if quieter else .072,[-.35,.44,-.27,.24][voice])
    for i, voice in enumerate((0,1,2,1,3,2,1,2)):
        if quieter and i in (2, 5, 7):
            continue
        tick = time + .25*i
        tone = pluck(chord[voice] + (12 if voice >= 2 else 0))
        level = (.058 if quieter else .104) * (1.16 if i in (0,4) else .75)
        pan = (-.44 if i % 2 == 0 else .44)
        add(tone,tick,level,pan)
        add(tone,tick+.186,level*.17,-pan)
    if not quieter:
        add(drum(),time,.26)
        add(drum(False),time+1.02,.13,.12)
        if 3 <= bar <= 10 or bar >= 14:
            add(drum(),time+1.5,.17)

for index, time in enumerate((.12,.7,1.5,5.5,10,12.55,15,19.5,24,28.5,32.0)):
    add(strike(),time,.3 if index in (0,2,4,10) else .16,(-.35 if index%2 else .30))
    if time > 1:
        add(breath(),time-.28,.34)
        add(drum(),time,.23)

# A clean final chord sustains across the title hold.
for i, midi in enumerate((47,54,59,62,66,71)):
    add(pluck(midi,2.4,1.6),32.0+i*.036,.13,(-.28 if i%2 else .28))
mix[:] = np.tanh(mix * 1.55)
mix[-RATE*2:] *= np.linspace(1,0,RATE*2)[:,None]**1.3
with wave.open(str(ROOT / "video/public/forge-score.wav"),"wb") as score:
    score.setnchannels(2)
    score.setsampwidth(2)
    score.setframerate(RATE)
    score.writeframes(np.int16(mix*32760).tobytes())

