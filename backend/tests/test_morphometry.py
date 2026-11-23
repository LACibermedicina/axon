import pytest

from core import morphometry as m


def cls(r, c):
    return next(x for x in r["classes"] if x["cls"] == c)


def test_reference_adult_ranges():
    r = m.predict(m.Patient(age=30, height=170), "Nervo mediano")
    for c in r["classes"]:
        lo, hi = c["range_um"]
        assert lo * .6 <= c["D_um"]["p10"] <= c["D_um"]["med"] <= c["D_um"]["p90"] <= hi * 1.05
    a = cls(r, "Aα")
    assert 55 <= a["cv_ms"] <= 70          # VC motora clínica 50–65 m/s
    assert abs(sum(c["share"] for c in r["classes"]) - 1) < 1e-9
    assert 0.6 <= cls(r, "Aβ")["g"] <= 0.75


def test_age_slows_and_thins_large_fibres():
    y = cls(m.predict(m.Patient(age=30), "Nervo mediano"), "Aβ")
    o = cls(m.predict(m.Patient(age=80), "Nervo mediano"), "Aβ")
    assert o["D_um"]["med"] < y["D_um"]["med"]
    # −0,9 m/s por década (±50 %) sobre 5 décadas
    assert 0.45 * 5 * .9 * (41 / 55) < y["cv_ms"] - o["cv_ms"] < 1.5 * 5 * .9


def test_height_only_lower_limb():
    s1 = cls(m.predict(m.Patient(height=160, weight=55), "Nervo sural"), "Aβ")["cv_ms"]
    s2 = cls(m.predict(m.Patient(height=195, weight=80), "Nervo sural"), "Aβ")["cv_ms"]
    md1 = cls(m.predict(m.Patient(height=160, weight=55), "Nervo mediano"), "Aβ")["cv_ms"]
    md2 = cls(m.predict(m.Patient(height=195, weight=80), "Nervo mediano"), "Aβ")["cv_ms"]
    assert s2 < s1 and md1 == md2


def test_sex_has_no_independent_effect():
    a = m.predict(m.Patient(sex="M"), "Nervo tibial")
    b = m.predict(m.Patient(sex="F"), "Nervo tibial")
    assert [c["cv_ms"] for c in a["classes"]] == [c["cv_ms"] for c in b["classes"]]


def test_cooling_17_ms_per_degree_at_50():
    w = cls(m.predict(m.Patient(temp=33), "Nervo mediano"), "Aβ")
    c = cls(m.predict(m.Patient(temp=30), "Nervo mediano"), "Aβ")
    assert c["cv_ms"] == pytest.approx(w["cv_ms"] * (1 - 3 * 1.7 / 50), rel=1e-9)


def test_diabetes_axonal_loss_and_demyelination():
    h = m.predict(m.Patient(), "Nervo sural")
    d = m.predict(m.Patient(hba1c=9, dmYears=12, demy=.3, sfl=.4), "Nervo sural")
    assert d["relative_density"] < h["relative_density"]
    assert cls(d, "Aβ")["g"] > cls(h, "Aβ")["g"]
    assert cls(d, "Aβ")["cv_ms"] < cls(h, "Aβ")["cv_ms"]


def test_kinds_and_latency():
    assert m.kind_of("Nervo vago") == "vago" and m.kind_of("Ramo auricular do vago") == "abvn"
    assert m.kind_of("Raiz L5 ventral") == "raizv" and m.kind_of("Nervo sural") == "cutaneo"
    assert m.latency_ms(600, 60) == pytest.approx(10.8)
    with pytest.raises(ValueError):
        m.predict(m.Patient(age=200))


def test_parity_with_frontend_morpho_js():
    # valores obtidos de frontend/js/morpho.js com o mesmo paciente (paridade JS ↔ Python)
    r = m.predict(m.Patient(age=70, height=190, weight=80, temp=31, hba1c=8.5, dmYears=10, demy=.2, sfl=.3), "Nervo sural")
    got = [[c["cls"], round(c["D_um"]["med"], 6), round(c["cv_ms"], 6), round(c["share"], 6)] for c in r["classes"]]
    assert got == [["Aβ", 7.763558, 29.289856, 0.114472], ["Aδ", 2.88, 10.86548, 0.163987], ["C", 0.768, 1.076818, 0.721542]]
    assert round(r["relative_density"], 6) == 0.455179
