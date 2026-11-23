#!/usr/bin/env python3
"""Generates the built-in sound pack for Chess Review Sounds.

Every sound is synthesized from scratch (sine/saw oscillators, noise, envelopes),
so the pack is original and free of third-party copyright.

Usage:  python3 tools/generate_sounds.py        (needs numpy, scipy and ffmpeg)
Output: sounds/<type>-<n>.mp3 and sounds/index.json
"""
import json
import os
import subprocess
import tempfile
import wave

import numpy as np
from scipy.signal import butter, lfilter

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sounds")
rng = np.random.default_rng(17)


# ---------- building blocks ----------
def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def adsr(n, a=0.005, d=0.05, s=0.6, r=0.1):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    env = np.ones(n) * s
    a = min(a, n)
    env[:a] = np.linspace(0, 1, a, endpoint=False) if a else 1
    d_end = min(a + d, n)
    env[a:d_end] = np.linspace(1, s, d_end - a, endpoint=False) if d_end > a else s
    r = min(r, n)
    if r:
        env[n - r:] *= np.linspace(1, 0, r)
    return env


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lowpass(x, cutoff, order=3):
    b, a = butter(order, cutoff / (SR / 2), btype="low")
    return lfilter(b, a, x)


def highpass(x, cutoff, order=3):
    b, a = butter(order, cutoff / (SR / 2), btype="high")
    return lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band")
    return lfilter(b, a, x)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def sine(freq, dur, phase=0.0):
    t = t_axis(dur)
    f = np.broadcast_to(freq, t.shape) if np.ndim(freq) else np.full_like(t, freq)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def saw(freq, dur):
    t = t_axis(dur)
    f = np.broadcast_to(freq, t.shape) if np.ndim(freq) else np.full_like(t, freq)
    ph = np.cumsum(f) / SR
    return 2 * (ph - np.floor(ph + 0.5))


def square(freq, dur, duty=0.5):
    t = t_axis(dur)
    f = np.broadcast_to(freq, t.shape) if np.ndim(freq) else np.full_like(t, freq)
    ph = np.cumsum(f) / SR % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def bell(freq, dur, tau=0.25):
    """Additive bell: inharmonic partials with individual decays."""
    n = int(SR * dur)
    out = np.zeros(n)
    for ratio, amp, k in [(1, 1.0, 1.0), (2.0, 0.5, 1.4), (2.76, 0.35, 1.9), (5.4, 0.2, 2.6), (8.93, 0.1, 3.4)]:
        out += amp * sine(freq * ratio, dur) * expdecay(n, tau / k)
    return out * adsr(n, a=0.002, d=0.0, s=1.0, r=0.04)


def pluck(freq, dur, tau=0.18, bright=0.6):
    n = int(SR * dur)
    x = sine(freq, dur) + 0.5 * sine(freq * 2, dur) * bright + 0.25 * sine(freq * 3, dur) * bright ** 2
    return x * expdecay(n, tau) * adsr(n, a=0.001, d=0.0, s=1.0, r=0.03)


def place(total, parts):
    """parts: list of (start_seconds, signal)."""
    out = np.zeros(int(SR * total))
    for start, sig in parts:
        i = int(start * SR)
        end = min(i + len(sig), len(out))
        out[i:end] += sig[: end - i]
    return out


def finish(x, peak=0.85, fade=0.02):
    x = x - np.mean(x)
    m = np.max(np.abs(x)) or 1.0
    x = x / m * peak
    f = int(fade * SR)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def noise(dur):
    return rng.uniform(-1, 1, int(SR * dur))


# ---------- the sounds ----------
def brilliant_1():  # sparkling rising arpeggio
    notes = [76, 79, 83, 88, 91, 95]
    parts = [(i * 0.07, bell(midi(n), 0.9, tau=0.35) * 0.8) for i, n in enumerate(notes)]
    shimmer = highpass(noise(1.2), 6000) * expdecay(int(SR * 1.2), 0.25) * 0.05
    return finish(place(1.4, parts) + place(1.4, [(0.3, shimmer)]))


def brilliant_2():  # triumphant major chord with a rise
    dur = 1.3
    n = int(SR * dur)
    chord = 0
    for m in (60, 64, 67, 72):
        chord = chord + lowpass(saw(midi(m), dur) + saw(midi(m) * 1.004, dur), 2600)
    swell = adsr(n, a=0.03, d=0.2, s=0.55, r=0.5)
    sweep = np.linspace(0.45, 1, n)
    hit = place(dur, [(0, bell(midi(84), 1.0, tau=0.5) * 0.4)])
    return finish(chord * swell * sweep * 0.35 + hit)


def great_1():  # two rising chimes
    return finish(place(0.9, [(0, bell(midi(81), 0.5, 0.2)), (0.12, bell(midi(88), 0.7, 0.28))]))


def great_2():  # soft rising whoosh into a ding
    n = int(SR * 0.25)
    w = bandpass(noise(0.25), 800, 5000) * np.linspace(0, 1, n) ** 2 * 0.5
    return finish(place(0.9, [(0, w), (0.2, bell(midi(86), 0.7, 0.3))]))


def best_1():  # short plucky fifth up
    return finish(place(0.6, [(0, pluck(midi(72), 0.3)), (0.09, pluck(midi(79), 0.45, tau=0.2))]))


def best_2():  # marimba-like tick
    return finish(place(0.5, [(0, pluck(midi(79), 0.4, tau=0.09, bright=0.2) + 0.4 * sine(midi(79) * 4, 0.4) * expdecay(int(SR * 0.4), 0.03))]))


def excellent_1():  # clean single bell
    return finish(bell(midi(84), 0.8, tau=0.3))


def excellent_2():  # two-note square "ping"
    parts = []
    for i, m in enumerate((83, 88)):
        x = square(midi(m), 0.2, 0.25)
        n = len(x)
        parts.append((i * 0.07, lowpass(x, 5000) * adsr(n, 0.002, 0.05, 0.4, 0.08) * 0.6))
    return finish(place(0.45, parts))


def good_1():  # soft pop
    n = int(SR * 0.15)
    p = sine(np.linspace(520, 220, n), 0.15) * expdecay(n, 0.04)
    return finish(p)


def good_2():  # woodblock
    n = int(SR * 0.2)
    w = sine(900, 0.2) * expdecay(n, 0.025) + 0.5 * sine(1480, 0.2) * expdecay(n, 0.015)
    return finish(w)


def book_1():  # page-turn swish
    n = int(SR * 0.45)
    x = bandpass(noise(0.45), 1500, 7000) * np.sin(np.linspace(0, np.pi, n)) ** 2
    return finish(x, peak=0.6)


def book_2():  # soft wooden thud
    n = int(SR * 0.3)
    x = sine(np.linspace(180, 90, n), 0.3) * expdecay(n, 0.07) + 0.15 * lowpass(noise(0.3), 800) * expdecay(n, 0.02)
    return finish(x, peak=0.7)


def inaccuracy_1():  # "uh-oh" two falling notes
    parts = []
    for i, m in enumerate((67, 62)):
        d = 0.22
        x = lowpass(saw(midi(m), d) + 0.5 * saw(midi(m) * 2, d), 1800)
        parts.append((i * 0.2, x * adsr(int(SR * d), 0.01, 0.05, 0.6, 0.08) * 0.7))
    return finish(place(0.7, parts))


def inaccuracy_2():  # hollow wobble
    dur = 0.6
    n = int(SR * dur)
    vib = 1 + 0.03 * np.sin(2 * np.pi * 7 * t_axis(dur))
    x = sine(midi(60) * vib, dur) + 0.4 * sine(midi(60) * 2 * vib, dur)
    return finish(x * adsr(n, 0.02, 0.1, 0.5, 0.25))


def mistake_1():  # wah-wah descending
    parts = []
    for i, (m, d) in enumerate([(62, 0.28), (60, 0.28), (58, 0.55)]):
        n = int(SR * d)
        x = saw(midi(m) * (1 + 0.0 * np.arange(n)), d)
        cutoff = 700 + 1200 * np.sin(np.linspace(0, np.pi, n))
        x = lowpass(x, float(np.mean(cutoff)))
        parts.append((i * 0.3, x * adsr(n, 0.02, 0.05, 0.7, 0.1) * 0.7))
    return finish(place(1.0, parts))


def mistake_2():  # short buzzer
    dur = 0.5
    n = int(SR * dur)
    x = lowpass(square(110, dur, 0.5) + 0.5 * square(165, dur, 0.5), 1500)
    return finish(x * adsr(n, 0.005, 0.02, 0.9, 0.12))


def miss_1():  # whoosh past a target
    n = int(SR * 0.6)
    sweep = np.sin(np.linspace(0, np.pi, n)) ** 2
    x = bandpass(noise(0.6), 400, 4500, 2) * sweep
    low = sine(np.linspace(220, 110, n), 0.6) * expdecay(n, 0.2) * 0.4
    return finish(x * 0.7 + low)


def miss_2():  # cartoon bonk
    n = int(SR * 0.45)
    x = sine(np.linspace(420, 160, n), 0.45) * expdecay(n, 0.12)
    x += 0.5 * sine(np.linspace(840, 320, n), 0.45) * expdecay(n, 0.07)
    return finish(x)


def blunder_1():  # sad trombone: three notes and a sliding last note
    parts = []
    specs = [(58, 0.35), (57, 0.35), (56, 0.35)]
    for i, (m, d) in enumerate(specs):
        n = int(SR * d)
        x = lowpass(saw(midi(m), d) + 0.6 * saw(midi(m) * 1.006, d), 1400) * adsr(n, 0.03, 0.05, 0.75, 0.06)
        parts.append((i * 0.4, x * 0.6))
    d = 1.1
    n = int(SR * d)
    glide = midi(55) * (1 - 0.18 * np.clip(np.arange(n) / (0.6 * SR), 0, 1) ** 1.5)
    vib = 1 + 0.025 * np.sin(2 * np.pi * 5.5 * t_axis(d)) * np.clip(np.arange(n) / (0.3 * SR), 0, 1)
    x = lowpass(saw(glide * vib, d), 1100) * adsr(n, 0.03, 0.05, 0.8, 0.3)
    parts.append((1.2, x * 0.7))
    return finish(place(2.4, parts))


def blunder_2():  # slide whistle fall + thud
    d = 0.9
    n = int(SR * d)
    f = np.linspace(1900, 180, n) ** 1.0
    whistle = sine(f, d) * adsr(n, 0.01, 0.02, 0.9, 0.05) * 0.5
    m = int(SR * 0.4)
    thud = (sine(np.linspace(110, 40, m), 0.4) * expdecay(m, 0.1) + 0.3 * lowpass(noise(0.4), 500) * expdecay(m, 0.03)) * 1.0
    return finish(place(1.4, [(0, whistle), (0.88, thud)]))


SOUNDS = {
    "brilliant": [("Sparkle", brilliant_1), ("Fanfare", brilliant_2)],
    "great": [("Twin chime", great_1), ("Whoosh ding", great_2)],
    "best": [("Pluck", best_1), ("Marimba", best_2)],
    "excellent": [("Bell", excellent_1), ("Ping", excellent_2)],
    "good": [("Pop", good_1), ("Wood block", good_2)],
    "book": [("Page turn", book_1), ("Soft thud", book_2)],
    "inaccuracy": [("Uh-oh", inaccuracy_1), ("Wobble", inaccuracy_2)],
    "mistake": [("Wah wah", mistake_1), ("Buzzer", mistake_2)],
    "miss": [("Whoosh", miss_1), ("Bonk", miss_2)],
    "blunder": [("Sad trombone", blunder_1), ("Slide whistle fall", blunder_2)],
}


def write_mp3(x, path):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "96k", path],
        check=True,
    )
    os.remove(wav_path)


def main():
    os.makedirs(OUT, exist_ok=True)
    index = {}
    for move_type, variants in SOUNDS.items():
        index[move_type] = []
        for i, (label, fn) in enumerate(variants, start=1):
            fname = f"{move_type}-{i}.mp3"
            write_mp3(fn(), os.path.join(OUT, fname))
            index[move_type].append({"file": fname, "label": label})
            print("wrote", fname)
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)
    print("wrote index.json")


if __name__ == "__main__":
    main()
