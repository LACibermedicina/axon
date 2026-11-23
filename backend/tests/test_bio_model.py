"""Suíte de regressão do núcleo (§22.5 do livro). Semente 42."""
import math

import numpy as np
import pytest

from core import bio_model as bm


@pytest.fixture(scope="module")
def ref():
    return bm.run_reference(n_boot=2000)


# --- Regressão de valores (contrato) ------------------------------------------
def test_alpha(ref):
    assert abs(ref["alpha_r1mm"] - 1.1266) <= 1e-4


def test_ratio_1mm(ref):
    assert abs(ref["ratio_3_9_r1mm"] - 3.2077) <= 1e-4


def test_ratios_by_distance(ref):
    assert round(ref["ratio_3_9_r05mm"], 2) == 2.17
    assert round(ref["ratio_3_9_r15mm"], 2) == 4.07


def test_rho_i_sensitivity(ref):
    assert round(ref["ratio_3_9_rho_i70"], 2) == 2.85
    assert round(ref["ratio_3_9_rho_i150"], 2) == 3.48


def test_monte_carlo(ref):
    assert round(ref["ratio_I50"], 2) == 3.10
    lo, hi = ref["ratio_CI95"]
    assert round(lo, 2) == 2.98 and round(hi, 2) == 3.22
    assert round(ref["I50_Abeta_mA"], 2) == 0.25 and round(ref["I50_Adelta_mA"], 2) == 0.78
    assert round(ref["Adelta_frac_when_Abeta_le10pct"] * 100, 2) == 0.38


def test_absolute_thresholds(ref):
    t = ref["Ith_mA_r1mm"]
    assert t[1.0] == pytest.approx(5.61, abs=5e-3)
    assert t[9.0] == pytest.approx(0.30, abs=5e-3)
    assert t[16.0] == pytest.approx(0.21, abs=6e-3)


# --- Propriedades -------------------------------------------------------------
def test_rho_e_invariance():
    a = bm.Ith(3, .1) / bm.Ith(9, .1)
    b = bm.Ith(3, .1, rho_e=bm.RHO_E * 7.3) / bm.Ith(9, .1, rho_e=bm.RHO_E * 7.3)
    assert a == pytest.approx(b, rel=1e-12)


def test_dt_convergence():
    a = bm.Ith(9, .1); b = bm.Ith(9, .1, dt=.25e-6)
    assert abs(b / a - 1) < .01


def test_N_convergence():
    for D in (1, 9, 16):
        a = bm.Ith(D, .1); b = bm.Ith(D, .1, N=81)
        assert abs(b / a - 1) < .005


def test_monotonicity():
    Ds = np.arange(1, 17)
    th = [bm.Ith(D, .1) for D in Ds]
    assert all(x > y for x, y in zip(th, th[1:]))
    rs = [.03, .05, .07, .1, .15]
    tr = [bm.Ith(9, r) for r in rs]
    assert all(x < y for x, y in zip(tr, tr[1:]))


def test_stability_bound():
    assert bm.stability_bound(1) == pytest.approx(7e-6, rel=.05)
    assert 1e-6 * 7 <= bm.stability_bound(1) * 1.01


def test_domain_refusal():
    with pytest.raises(bm.DomainError):
        bm.Ith_checked(20, .1)
    with pytest.raises(bm.DomainError):
        bm.Ith_checked(9, .2)


def test_reproducible_seed():
    T = bm.threshold_grid()
    a = bm.monte_carlo(T, n_boot=50)["ratio_I50"]
    b = bm.monte_carlo(T, n_boot=50)["ratio_I50"]
    assert a == b


def test_activation_profile_center_positive():
    p = bm.activation_profile(9, .1, 1e-3)
    c = len(p["f_mV"]) // 2
    assert p["f_mV"][c] > 0 and p["f_mV"][c - 1] < p["f_mV"][c]
