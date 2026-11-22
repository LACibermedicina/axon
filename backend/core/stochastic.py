"""axon · Ruído térmico e ressonância estocástica (Cap. 8).

Detector de limiar adimensional sob dinâmica de Langevin (eq. 8.1):
    τ dV/dt = −V + s(t) + σ·ξ(t),  disparo quando V ≥ θ (reset a 0).
Sinal senoidal subliminar (A = 0,5; θ = 1; 5 Hz) — parâmetros do livro.
A implementação exata do livro não é publicada; o σ ótimo desta implementação
é reportado como [RESULTADO DE MODELO - SEMENTE 42] e comparado ao valor do
livro (σ ≈ 0,61) apenas como ordem de grandeza.
"""
from __future__ import annotations

from typing import Dict, Sequence

import numpy as np

KB = 1.380649e-23   # J/K [LITERATURA] CODATA
T_BODY = 310.0      # K


def thermal_energy(T: float = T_BODY) -> float:
    """k_B·T (J). A 310 K ≈ 4,28 × 10⁻²¹ J."""
    return KB * T


def sr_detector(sigma: float, A: float = .5, theta: float = 1., f: float = 5., T: float = 4.,
                dt: float = 1e-3, reps: int = 5, seed: int = 42) -> float:
    """SNR (u.a.) da sequência de disparos na frequência do sinal."""
    rng = np.random.default_rng(seed)
    n = int(T / dt); t = np.arange(n) * dt
    s = A * np.sin(2 * np.pi * f * t)
    snr = []
    for _ in range(reps):
        x = s + sigma * rng.standard_normal(n)
        spikes = (x >= theta) & (np.roll(x, 1) < theta)
        spikes[0] = False
        y = spikes.astype(float) - spikes.mean()
        P = np.abs(np.fft.rfft(y)) ** 2
        freqs = np.fft.rfftfreq(n, dt)
        k = int(np.argmin(np.abs(freqs - f)))
        bg = np.r_[P[max(k - 12, 1):k - 2], P[k + 3:k + 13]]
        snr.append(P[k] / (bg.mean() + 1e-12))
    return float(np.mean(snr))


def sr_curve(sigmas: Sequence[float] = None, **kw) -> Dict:
    if sigmas is None:
        sigmas = np.round(np.linspace(.05, 2.0, 40), 3)
    snr = [sr_detector(float(s), **kw) for s in sigmas]
    i = int(np.argmax(snr))
    return {"sigma": list(map(float, sigmas)), "snr": snr, "sigma_opt": float(sigmas[i]),
            "book_sigma_opt": 0.61, "tag": "RESULTADO DE MODELO - SEMENTE 42",
            "caveat": "Demonstração adimensional; não é modelo de axônio (Fig. 4 do livro)."}
