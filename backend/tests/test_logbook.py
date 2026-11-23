import pytest

from app import logbook, portal


@pytest.fixture(autouse=True)
def tmpdir(tmp_path, monkeypatch):
    monkeypatch.setattr(logbook, "PORTAL_DIR", tmp_path)
    yield


def test_publish_get_comment_delete():
    r = logbook.publish("Diário", "Ana", "<article>ok</article>", 3, 1)
    d = logbook.get(r["id"])
    assert d["title"] == "Diário" and "token" not in d and d["html"].startswith("<article")
    c = logbook.comment(r["id"], "<b>Leo</b>", "Ótimo <script>x</script>")
    assert "&lt;script&gt;" in c["text"] and "&lt;b&gt;" in c["name"]
    assert len(logbook.list_comments(r["id"])) == 1
    with pytest.raises(PermissionError):
        logbook.delete(r["id"], "errado")
    assert logbook.delete(r["id"], r["token"])
    with pytest.raises(KeyError):
        logbook.get(r["id"])


def test_limits_and_ids():
    with pytest.raises(ValueError):
        logbook.publish("x", "y", "")
    with pytest.raises(KeyError):
        logbook.get("../../etc")
    r = logbook.publish("x", "y", "<p>a</p>")
    with pytest.raises(ValueError):
        logbook.comment(r["id"], "a", " ")
