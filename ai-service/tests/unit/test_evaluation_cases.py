import json

from app.ingestion.snapshot import ROOT


def test_evaluation_splits_do_not_share_paraphrase_groups():
    data = json.loads((ROOT / "tests/evaluation/d1_queries.json").read_text(encoding="utf8"))
    assert len(data["dev"]) == len(data["held_out"]) == 12
    assert not ({x["group"] for x in data["dev"]} & {x["group"] for x in data["held_out"]})
    for split in ("dev", "held_out"):
        for status in ("answered", "insufficient_evidence", "capability_unavailable"):
            assert sum(row["status"] == status for row in data[split]) == 4
