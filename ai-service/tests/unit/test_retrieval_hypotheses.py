"""D1.17 lexical/scoring oracles on temporary corpora, never on the pinned index."""

import json
import math
import sqlite3
from contextlib import closing
from datetime import date

import pytest
from test_ingestion import corpus as corpus

from app.ingestion.snapshot import build, normalize
from app.retrieval.index import KnowledgeIndex

TODAY = date(2026, 11, 13)


@pytest.fixture
def ranked_index(corpus):
    source = corpus / "tests/fixtures/d1/faq.md"
    front_matter = source.read_text(encoding="utf8").split("## ", 1)[0]
    # Equal token lengths isolate frequency; B before A distinguishes rowid from ID sorting.
    sections = [
        ("WEAK", "wifi lounge lounge lounge"),
        ("TIEB", "wifi wifi wifi lounge"),
        ("TIEA", "wifi wifi wifi lounge"),
        ("LAST", "wifi lounge lounge lounge"),
        ("NONE", "parking garage lounge lounge"),
    ]
    source.write_text(
        front_matter + "\n".join(f"## {key}\n\n{body}\n" for key, body in sections),
        encoding="utf8",
    )
    path = build("demo_synthetic", TODAY, corpus)
    return KnowledgeIndex(path, "demo_synthetic", TODAY, corpus)


@pytest.mark.parametrize("top_k,expected", [(-1, 1), (0, 1), (1, 1), (2, 2), (3, 3), (99, 3)])
def test_bm25_frequency_ties_and_top_k_follow_numeric_rank(ranked_index, top_k, expected):
    with closing(
        sqlite3.connect(
            (ranked_index.path / "index.sqlite").as_uri() + "?mode=ro&immutable=1", uri=True
        )
    ) as db:
        assert db.execute("SELECT count(*) FROM chunks").fetchone()[0] == 5
        rows = db.execute(
            "SELECT rowid, bm25(chunks), metadata FROM chunks "
            "WHERE chunks MATCH ? ORDER BY bm25(chunks), rowid",
            ('"wifi"',),
        ).fetchall()
    assert len(rows) == 4  # More candidates than the runtime top-3 cap.
    assert all(math.isfinite(row[1]) for row in rows)
    assert [json.loads(row[2])["sectionId"] for row in rows] == ["TIEB", "TIEA", "WEAK", "LAST"]
    assert rows[0][1] == rows[1][1] < rows[2][1] == rows[3][1]
    assert rows[0][0] < rows[1][0] and rows[2][0] < rows[3][0]
    result = ranked_index.search("Wi-Fi", TODAY, top_k=top_k)
    assert [e.sectionId for e in result] == ["TIEB", "TIEA", "WEAK"][:expected]
    assert ranked_index.search("Wi-Fi", TODAY, top_k=top_k) == result
    assert all("score" not in e.model_dump() for e in result)


@pytest.mark.parametrize("topic", ["jacuzzi", "karaoke", "spa"])
def test_generic_token_ablation_removes_domain_negative_candidates(corpus, topic):
    index = KnowledgeIndex(build("demo_synthetic", TODAY, corpus), "demo_synthetic", TODAY, corpus)
    # These independently written domain negatives have no answer in the tiny FAQ.
    result = index.search(f"khách sạn {topic}", TODAY)
    assert {e.sectionId for e in result} == {"FAQ-WIFI", "FAQ-LUGGAGE", "FAQ-CONTACT"}
    assert index.search(topic, TODAY) == []


@pytest.mark.parametrize("topic,gold", [("Wi-Fi", "FAQ-WIFI"), ("hành lý", "FAQ-LUGGAGE")])
def test_generic_ablation_keeps_positive_gold_on_this_fixture(corpus, topic, gold):
    index = KnowledgeIndex(build("demo_synthetic", TODAY, corpus), "demo_synthetic", TODAY, corpus)
    full = index.search(f"khách sạn {topic}", TODAY)
    ablated = index.search(topic, TODAY)
    assert gold in {e.sectionId for e in full}
    assert [e.sectionId for e in ablated] == [gold]
    assert len(full) == 3  # Removing generic tokens changes membership, not just ranking.


@pytest.mark.parametrize(
    "query,collision,expected",
    [
        ("hồ", "hỗ", {"FAQ-CONTACT"}),
        ("cưng", "cung", {"FAQ-WIFI"}),
        ("sân", "sạn", {"FAQ-WIFI", "FAQ-LUGGAGE", "FAQ-CONTACT"}),
        ("tiền", "tiện", {"FAQ-WIFI"}),
    ],
)
def test_diacritic_collision_is_lexical_match_not_semantic_support(
    corpus, query, collision, expected
):
    index = KnowledgeIndex(build("demo_synthetic", TODAY, corpus), "demo_synthetic", TODAY, corpus)
    assert normalize(query) == normalize(collision)
    assert {e.sectionId for e in index.search(query, TODAY)} == expected
