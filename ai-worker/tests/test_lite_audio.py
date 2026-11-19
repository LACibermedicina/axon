import os, subprocess, tempfile
import numpy as np
from harmonia_ai.pipelines import lite_audio
from harmonia_ai import jobs

SR = 22050


def tone(midi, dur, sr=SR, harmonics=(1, .5, .25)):
    t = np.arange(int(dur * sr)) / sr
    f = 440 * 2 ** ((midi - 69) / 12)
    y = sum(a * np.sin(2 * np.pi * f * k * t) for k, a in enumerate(harmonics, start=1))
    env = np.minimum(1, t / 0.01) * np.minimum(1, (dur - t) / 0.03)
    return y * env


def write_wav(y, path):
    y = (y / np.max(np.abs(y)) * 0.8).astype(np.float32)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", path], input=y.tobytes(), check=True)


def song():
    # 120 BPM: C4 E4 G4 C5 (semínimas) | acorde C maior (2 tempos) + G maior (2 tempos)
    mel = np.concatenate([tone(p, 0.5) for p in (60, 64, 67, 72, 67, 64, 62, 60)])
    acc = np.concatenate([sum(tone(p, 1.0) for p in (48, 52, 55)), sum(tone(p, 1.0) for p in (43, 47, 50)),
                          sum(tone(p, 1.0) for p in (48, 52, 55)), sum(tone(p, 1.0) for p in (43, 47, 50))])
    return mel, acc


def test_yin_melody():
    mel, _ = song()
    ev = lite_audio.melody_events(mel)
    assert [e["pitch"] for e in ev] == [60, 64, 67, 72, 67, 64, 62, 60]
    assert abs(ev[1]["start_s"] - 0.5) < 0.05


def test_chroma_chords():
    _, acc = song()
    C, times = lite_audio.chroma(acc)
    c1 = lite_audio.chord_from_chroma(C[(times > 0.1) & (times < 0.9)].sum(axis=0))
    c2 = lite_audio.chord_from_chroma(C[(times > 1.1) & (times < 1.9)].sum(axis=0))
    assert (c1.root, c1.quality) == (0, "") and (c2.root, c2.quality) == (7, "")


def test_job_lite_end_to_end(monkeypatch):
    mel, acc = song()
    media = tempfile.mkdtemp()
    write_wav(mel + 0.0 * acc[: mel.size], os.path.join(media, "a.wav"))
    monkeypatch.setattr(jobs, "MEDIA", __import__("pathlib").Path(media))
    monkeypatch.setattr(jobs, "_ml_available", lambda: False)
    r = jobs.job_transcribe_audio({"asset": "a.wav", "mode": "both", "tempo": 120, "source_name": "teste.wav"})
    assert r["engine"] == "lite"
    kinds = [l["kind"] for l in r["layers"]]
    assert kinds == ["melody", "harmony"]
    assert r["layers"][0]["name"].endswith("teste")
    pitches = [n["pitch"] for n in r["layers"][0]["notes"]]
    assert pitches[:4] == [60, 64, 67, 72]
    assert r["measures"] >= 1
