"""Portal: esquema, publicação, feeds, newsletter (LGPD) e assistente de IA (sempre como proposta)."""
import json
import pytest


@pytest.fixture()
def portal(tmp_path, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "t" * 24)
    from app import portal as P
    monkeypatch.setattr(P, "PORTAL_DIR", tmp_path)
    return P


def test_seed_only_published_is_public(portal):
    pub = portal.public()
    assert pub["news"] and all(n["status"] == "publicado" for n in pub["news"])
    assert pub["episodes"] == []  # episódios do seed aguardam liberação


def test_clean_drops_unknown_fields_and_bad_choices(portal):
    c = portal.clean("news", {"title": "A", "category": "spam", "evil": 1, "status": "publicado"})
    assert c == {"title": "A", "status": "publicado"}


def test_publish_flow_and_feeds(portal):
    r = portal.apply_ops([{"op": "create", "collection": "events", "data": {"title": "Seminário", "start": "2026-12-01T14:00", "end": "2026-12-01T16:00", "kind": "evento"}}])
    eid = r["results"][0]["id"]
    assert not any(e["id"] == eid for e in portal.public()["events"])
    portal.apply_ops([{"op": "publish", "collection": "events", "id": eid}])
    assert any(e["id"] == eid for e in portal.public()["events"])
    assert "DTSTART;TZID=America/Sao_Paulo:20261201T140000" in portal.ics()
    assert "<rss" in portal.rss() and "Seminário" in portal.rss()


def test_subscribe_requires_consent_and_unsubscribe_deletes(portal):
    with pytest.raises(ValueError):
        portal.subscribe("a@b.com", [], False)
    portal.subscribe("A@B.com", ["novidades"], True)
    tok = portal.load()["subscribers"][0]["token"]
    assert portal.unsubscribe(tok) and portal.load()["subscribers"] == []


def test_admin_token(portal):
    assert portal.check_admin("Bearer " + "t" * 24) and not portal.check_admin("Bearer x")


def test_assist_returns_proposal_without_applying(portal, monkeypatch):
    from app import ai
    monkeypatch.setattr(ai, "complete", lambda *a, **k: {"provider": "fake", "text": json.dumps({"message": "ok", "ops": [
        {"op": "create", "collection": "news", "data": {"title": "Nova", "category": "novidade", "hack": "x"}},
        {"op": "drop", "collection": "users"}]})})
    before = len(portal.load()["news"])
    r = portal.assist("crie uma notícia")
    assert r["mode"] == "ia" and len(r["ops"]) == 1 and "hack" not in r["ops"][0]["data"]
    assert len(portal.load()["news"]) == before


def test_empty_portal_gets_seed_and_respects_deletions(portal, monkeypatch):
    # portal criado vazio (versão antiga): o conteúdo de base entra; o que o admin apagou não volta
    (portal.PORTAL_DIR / "portal.json").write_text(json.dumps(portal._empty()), encoding="utf-8")
    monkeypatch.setattr(portal, "_REL_SYNCED", False)
    news = portal.public()["news"]
    assert len(news) >= 10
    gone = news[0]["id"]
    portal.apply_ops([{"op": "delete", "collection": "news", "id": gone}])
    monkeypatch.setattr(portal, "_REL_SYNCED", False)
    assert gone not in {n["id"] for n in portal.public()["news"]}
