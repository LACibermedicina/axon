"""Testes da API — exigem fastapi + httpx (instalados no CI). Pulados se ausentes."""
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

c = TestClient(app)


def test_health():
    r = c.get("/api/health").json()
    assert r["project"] == "axon" and r["version"] == "0.1.0-alpha"


def test_threshold_and_refusal():
    r = c.post("/api/model/threshold", json={"D_um": 9, "r_mm": 1}).json()
    assert r["provenance"] == "RESULTADO DE MODELO" and abs(r["data"]["Ith_mA"] - 0.296) < 1e-3
    assert c.post("/api/model/threshold", json={"D_um": 30, "r_mm": 1}).status_code == 422


def test_frontiers():
    r = c.post("/api/safety/frontiers", json={"I_mA": 1, "pw_us": 100, "area_cm2": .5}).json()
    assert set(r["data"]) == {"electrochemical", "thermal", "mechanical", "chronic"}


def test_anatomy_lgpd():
    assert c.post("/api/anatomy/predict", json={"cpf": 1}).status_code == 422
