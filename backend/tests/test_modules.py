"""Testes das fronteiras de segurança, ruído, integrativas, anatomia e IA (offline)."""
import json
import math
import os

import pytest

from core import safety, stochastic, integrative, anatomy


def test_kbt():
    assert stochastic.thermal_energy() == pytest.approx(4.28e-21, rel=1e-3)


def test_diffraction_attenuation_book():
    d = safety.diffraction_attenuation(10)
    assert d["f_MHz"] == pytest.approx(150) and d["attenuation_dB_cm"] == pytest.approx(75)


def test_shannon_levels():
    assert safety.shannon(5, 200, 1.0)["level"] == "conservador"
    assert safety.shannon(2, 250, 5e-4)["level"] == "risco"
    k = safety.shannon(1, 100, .01)["k"]
    assert k == pytest.approx(math.log10(.1 / .01) + math.log10(.1))


def test_cem43():
    assert safety.cem43([43.0] * 60, 1.0) == pytest.approx(1.0)
    assert safety.cem43([44.0] * 60, 1.0) == pytest.approx(2.0)


def test_mechanical_limits():
    assert safety.mechanical(2.0, 1.0, 100)["level"] == "risco"   # MI = 2,0
    assert safety.mechanical(1.0, 1.0, 100)["level"] == "conservador"


def test_sr_has_interior_optimum():
    c = stochastic.sr_curve([.1, .3, .5, .7, 1.0, 1.5, 2.0])
    assert c["sigma"][0] < c["sigma_opt"] < c["sigma"][-1]


def test_ea_bands_and_safety():
    lo = integrative.electroacupuncture(2, .5)
    hi = integrative.electroacupuncture(100, .5)
    assert "encefalinas" in lo["frequency_band"]["mechanism"]
    assert "dinorfina" in hi["frequency_band"]["mechanism"]
    assert lo["ratio"] > 2.5
    assert lo["safety"]["level"] == "conservador"


def test_tavns_lobule_is_sham():
    r = integrative.tavns(site="lobulo")
    assert r["abvn_probability_pct"] == 0
    with pytest.raises(ValueError):
        integrative.tavns(site="nariz")


def test_acupressure_monotone():
    a = integrative.acupressure(20)["F_Abeta_mech"]; b = integrative.acupressure(80)["F_Abeta_mech"]
    assert 0 < a < b < 1


def test_anatomy_refuses_outside_domain():
    out = anatomy.predict(anatomy.Profile(subcut_fat_mm=3))
    assert "domain_error" in out


def test_anatomy_rho_invariance_of_ratio():
    base = anatomy.predict(anatomy.Profile())
    hyp = anatomy.predict(anatomy.Profile(perineural_hypertrophy=1))
    assert base["ratio"] == pytest.approx(hyp["ratio"], rel=1e-9)
    assert hyp["Ith_Abeta_mA"] > base["Ith_Abeta_mA"]


def test_anatomy_lgpd_rejects_identifiers():
    with pytest.raises(ValueError):
        anatomy.Profile.from_dict({"nome": 1})


def test_ai_offline_fallback(monkeypatch):
    for k in list(os.environ):
        if k.endswith("_API_KEY") or k.endswith("_TOKEN"):
            monkeypatch.delenv(k, raising=False)
    from app import ai
    assert ai.chain() == []
    r = ai.bot_answer("o que é a relação de Shannon?")
    assert r["mode"] == "offline" and "1,75" in r["text"]
    assert ai.translate(["Olá"], "en")["mode"] == "offline"


def test_ai_chain_order(monkeypatch):
    from app import ai
    monkeypatch.setenv("GROQ_API_KEY", "gsk-SECRET-111"); monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-SECRET-222")
    monkeypatch.setenv("AI_PROVIDERS", "groq,anthropic")
    assert [p.name for p in ai.chain()][:2] == ["groq", "anthropic"]
    assert "SECRET" not in str(ai.status())


def test_translate_batches_and_cache(monkeypatch, tmp_path):
    from app import ai
    calls = []
    def fake(system, user, max_tokens=800):
        arr = json.loads(user[user.index("["):])
        calls.append(len(arr))
        return {"text": json.dumps([f"EN:{x}" for x in arr]), "provider": "fake"}
    monkeypatch.setattr(ai, "complete", fake)
    monkeypatch.setattr(ai, "_TR_FILE", str(tmp_path / "c.json"))
    monkeypatch.setattr(ai, "_TR_CACHE", {})
    texts = [f"texto {i}" for i in range(85)] + ["texto 0"]
    r = ai.translate(texts, "en", "teste")
    assert r["mode"] == "ia" and calls == [40, 40, 5] and r["texts"][0] == "EN:texto 0" and r["texts"][-1] == "EN:texto 0"
    r2 = ai.translate(["texto 3"], "en")
    assert r2["mode"] == "cache" and len(calls) == 3 and r2["texts"] == ["EN:texto 3"]
