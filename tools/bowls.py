"""Synthesise a calm singing bowl loop for Sthira (no samples, no licence questions).

Run from the site folder: python3 tools/bowls.py
Writes audio/bowls.m4a and audio/bowls.ogg (about -24 LUFS, 96 s seamless loop).
"""
import subprocess
import wave

import numpy as np

SR = 44100
LOOP = 96.0
# Partial ratios and relative levels typical of a hand beaten bowl.
PARTIALS = [(1.0, 1.0), (2.71, 0.55), (5.03, 0.28), (7.9, 0.12), (11.4, 0.05)]
BOWLS = [196.0, 261.6, 293.7]  # G3, C4, D4: a calm open sound
STRIKES = [(0.5, 0), (14.0, 1), (27.5, 2), (40.0, 0), (54.5, 1), (66.0, 2), (80.5, 1)]


def strike(f0: float, length: float, seed: int) -> np.ndarray:
    """One soft mallet strike: detuned partial pairs beat slowly while they decay."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(length * SR)) / SR
    out = np.zeros_like(t)
    for i, (ratio, level) in enumerate(PARTIALS):
        f = f0 * ratio
        beat = rng.uniform(0.6, 2.2) / (1 + i * 0.3)  # slow wobble, the bowl's "wah"
        decay = 22.0 / (1 + i * 1.4)  # higher partials die away sooner
        env = np.exp(-t / decay)
        phase = rng.uniform(0, 2 * np.pi)
        pair = np.sin(2 * np.pi * f * t + phase) + np.sin(2 * np.pi * (f + beat) * t)
        out += level * 0.5 * pair * env
    attack = np.clip(t / 0.012, 0, 1)  # soft felt mallet, no click
    return out * attack


def render() -> np.ndarray:
    n = int(LOOP * SR)
    left = np.zeros(n)
    right = np.zeros(n)
    for k, (at, b) in enumerate(STRIKES):
        tone = strike(BOWLS[b], 40.0, seed=k) * (0.8 if b == 0 else 0.65)
        pan = [0.35, 0.5, 0.65][b]
        start = int(at * SR)
        idx = (np.arange(len(tone)) + start) % n  # wrap the tail round so the loop is seamless
        np.add.at(left, idx, tone * (1 - pan))
        np.add.at(right, idx, tone * pan)
    stereo = np.stack([left, right], axis=1)
    return stereo / np.max(np.abs(stereo)) * 0.5


def main() -> None:
    audio = render()
    tmp = "audio/bowls-raw.wav"
    with wave.open(tmp, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype(np.int16).tobytes())
    norm = "loudnorm=I=-24:TP=-4:LRA=11"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp, "-af", norm, "-ar", "44100",
                    "-c:a", "aac", "-b:a", "80k", "audio/bowls.m4a"], check=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp, "-af", norm, "-ar", "48000",
                    "-c:a", "libopus", "-b:a", "64k", "audio/bowls.ogg"], check=True)
    subprocess.run(["rm", tmp], check=True)


if __name__ == "__main__":
    main()
