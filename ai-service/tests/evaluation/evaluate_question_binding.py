"""Offline evaluation of structured policy-domain QuestionBinding on the dev split only.

- Never modifies `.local/grounding/` or `academic-demo.contract.json`.
- Never copies Gold queries into aliases or patterns.
- Never tunes on or evaluates `held_out` by default (`held_out_touched: false`).
- Separates catalog fact coverage gaps from QuestionBinding behavior and verifies host gate
  preflight (`VerificationGate.prepare`) for every bound case.
"""

import argparse
import copy
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.academic_demo_contract import read_contract  # noqa: E402
from app.academic_demo_preflight import ReadOnlyPairedIndex  # noqa: E402
from app.indexing import ChunkingConfig, EmbeddingProfile  # noqa: E402
from app.ingestion.snapshot import ROOT  # noqa: E402
from app.orchestration.verification import VerificationGate  # noqa: E402
from app.orchestration.verification.artifacts import source_view  # noqa: E402
from app.orchestration.verification.catalog import (  # noqa: E402
    VerifiedCatalog,
    canonical,
    component_hashes,
    digest,
    review_hash,
)
from app.orchestration.verification.questions import bind_question  # noqa: E402
from app.providers.contracts import TurnBudget  # noqa: E402
from app.retrieval.hybrid import HybridRetriever  # noqa: E402
from app.schemas.verification import QuestionRule, Source, VerificationContext  # noqa: E402

GOLD_PATH = ROOT / "tests/evaluation/policy-gold-2026-11-22-v1/gold.json"
CONTRACT_PATH = ROOT / "academic-demo.contract.json"
V1_CATALOG_PATH = (
    ROOT / ".local/grounding/demo_synthetic/academic-policies-2026-11-24-v1/catalog.json"
)
CATALOG_PATH = V1_CATALOG_PATH
POLICY_TODAY = date(2026, 11, 25)

# Shared disqualifiers preventing false binding on missing-info / out-of-scope / calculation queries.
COMMON_DISQUALIFIERS = (
    "khong hoi",
    "khong ro",
    "chua ro",
    "chua biet",
    "khong biet",
    "chua ghi",
    "chua co xac nhan",
    "con phong",
    "gia phong",
    "tao booking moi",
    "thuc hien thanh toan",
    "kiem tra don",
    "bao nhieu tien",
    "tong bao nhieu",
    "can bo sung",
    "chinh xac bao nhieu",
    "so coc chinh xac",
)

# General policy-domain patterns for the 19 approved rules in academic-policies-2026-11-24-v1.
# Written from the 10 approved policy topics (not copied from Gold queries).
POLICY_PATTERNS: dict[str, list[dict]] = {
    "q-pol01-min-stay": [
        {
            "patternId": "p-pol01-min-stay",
            "allOf": [["dat phong", "booking"], ["toi thieu", "it nhat"], ["dem"]],
            "noneOf": [*COMMON_DISQUALIFIERS, "huy", "sua"],
        }
    ],
    "q-pol01-rooms-per-req": [
        {
            "patternId": "p-pol01-rooms-per-req",
            "allOf": [
                ["dat phong", "yeu cau dat", "mot don"],
                ["may phong", "bao nhieu phong", "nhieu phong"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "huy", "sua"],
        }
    ],
    "q-pol01-hold-window": [
        {
            "patternId": "p-pol01-hold-window",
            "allOf": [
                ["giu cho", "cua so giu cho", "thanh toan coc"],
                ["bao lau", "may phut", "bao nhieu phut", "thoi han", "thoi gian"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "bao gia sua", "sua booking", "sua don"],
        }
    ],
    "q-pol01-late-arrival": [
        {
            "patternId": "p-pol01-late-arrival-clock",
            "allOf": [
                ["toi", "den", "nhan phong", "check-in", "checkin"],
                ["24/7", "bao truoc", "thoa thuan", "den muon", "sau 22"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "cung ngay", "walk-in", "truoc 22"],
            "requiredParams": [{"kind": "time_hhmm", "minCount": 1, "minValue": 22 * 60}],
        },
        {
            "patternId": "p-pol01-late-arrival-general",
            "allOf": [
                ["den muon", "sau 22:00", "sau 22h", "sau 22 gio", "tiep nhan 24/7"],
                ["nhan phong", "thoa thuan", "khach san", "quy dinh", "khong den"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "cung ngay", "walk-in", "truoc 22"],
        },
    ],
    "q-pol01-modify-quote": [
        {
            "patternId": "p-pol01-modify-quote",
            "allOf": [
                ["bao gia sua", "bao gia doi"],
                ["hieu luc", "bao lau", "may phut", "thoi han"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "het hạn", "het han", "huy"],
        }
    ],
    "q-pol02-standard-hours": [
        {
            "patternId": "p-pol02-standard-hours",
            "allOf": [
                ["gio nhan phong", "gio tra phong", "check-in", "check-out", "nhan tra phong"],
                ["may gio", "chuan", "quy dinh", "tu may gio", "luc may gio"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "som", "muon", "qua gio", "sau 22", "24/7"],
        }
    ],
    "q-pol02-early-checkin": [
        {
            "patternId": "p-pol02-early-checkin",
            "allOf": [
                ["nhan phong som", "nhan som", "check-in som", "checkin som"],
                ["phi", "bao nhieu", "tinh nhu the nao", "phan tram", "quy dinh"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "hoan phi", "tra muon"],
        }
    ],
    "q-pol02-late-checkout": [
        {
            "patternId": "p-pol02-late-checkout",
            "allOf": [
                ["tra phong muon", "tra muon", "check-out muon", "checkout muon"],
                ["phi", "bao nhieu", "tinh nhu the nao", "phan tram", "quy dinh"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "hoan phi", "nhan som"],
        }
    ],
    "q-pol03-deposit-rate": [
        {
            "patternId": "p-pol03-deposit-rate",
            "allOf": [
                ["dat coc", "tien coc", "muc coc"],
                ["bao nhieu phan tram", "ty le", "may phan tram", "muc dat coc"],
            ],
            "noneOf": [
                *COMMON_DISQUALIFIERS,
                "giu cho",
                "bo sung",
                "coc du",
                "giam phong",
                "ung truoc",
            ],
        }
    ],
    "q-pol03-demo-tax": [
        {
            "patternId": "p-pol03-demo-tax",
            "allOf": [
                ["thue hoa don", "thue demo", "muc thue", "thue"],
                ["bao nhieu phan tram", "ty le", "may phan tram", "ap dung"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "bill", "con thu", "giam phong"],
        }
    ],
    "q-pol04-cancellation": [
        {
            "patternId": "p-pol04-cancellation",
            "allOf": [
                ["huy dat phong", "huy booking", "huy phong"],
                ["chinh sach", "ty le hoan", "quy dinh", "phi huy", "truoc may ngay"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "bao gia", "sua", "roi som", "dich vu"],
        }
    ],
    "q-pol05-refund-sla": [
        {
            "patternId": "p-pol05-refund-sla",
            "allOf": [
                ["hoan tien"],
                ["bao lau", "thoi han", "may ngay", "bao nhieu ngay", "xu ly"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "huy dich vu", "roi som", "ung truoc"],
        }
    ],
    "q-pol06-infant-capacity": [
        {
            "patternId": "p-pol06-infant-capacity",
            "allOf": [
                ["tre so sinh", "em be", "tre em"],
                ["suc chua", "tinh vao so nguoi", "tinh la khach", "tinh vao"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS],
        }
    ],
    "q-pol06-min-age": [
        {
            "patternId": "p-pol06-min-age-general",
            "allOf": [
                ["dai dien", "nhan phong", "check-in", "checkin"],
                ["bao nhieu tuoi", "du tuoi", "do tuoi", "dieu kien tuoi", "18 tuoi", "17 tuoi"],
            ],
            "noneOf": [
                *COMMON_DISQUALIFIERS,
                "sinh",
                "chi biet sinh nam",
                "khong biet ngay thang",
            ],
        },
        {
            "patternId": "p-pol06-min-age-dated",
            "allOf": [
                ["sinh", "tuoi"],
                ["nhan", "nhan phong", "dieu kien tuoi"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "chi biet sinh nam", "khong biet ngay thang"],
            "requiredParams": [{"kind": "date_dmy", "minCount": 2}],
        },
    ],
    "q-pol07-pets": [
        {
            "patternId": "p-pol07-pets",
            "allOf": [
                ["thu cung", "cho meo", "vat nuoi"],
                [
                    "cho mang",
                    "mang theo",
                    "duoc mang",
                    "chinh sach",
                    "quy dinh",
                    "cho phep",
                    "duoc phep",
                    "nhan thu cung",
                ],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS],
        }
    ],
    "q-pol08-in-stay-services": [
        {
            "patternId": "p-pol08-in-stay-services",
            "allOf": [
                ["dich vu trong ky luu tru", "dat dich vu"],
                ["dieu kien", "chua nhan phong", "can nhan phong", "duoc nhan"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "huy dich vu", "buffet", "minibar", "laundry"],
        }
    ],
    "q-pol08-cancel-service": [
        {
            "patternId": "p-pol08-cancel-service",
            "allOf": [
                ["huy dich vu"],
                ["truoc khi bat dau", "hoan tien", "chua cung cap", "duoc hoan"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS],
        }
    ],
    "q-pol09-complaints-sla": [
        {
            "patternId": "p-pol09-complaints-sla",
            "allOf": [
                ["khieu nai", "phan anh"],
                ["bao lau", "thoi han", "may ngay", "bao nhieu gio", "xu ly"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS, "roi som", "loi cung ung"],
        }
    ],
    "q-pol10-retention": [
        {
            "patternId": "p-pol10-retention",
            "allOf": [
                ["log", "backup", "ban khoi phuc", "luu giu du lieu"],
                ["thoi han", "bao lau", "giu them", "co han", "luu giu", "ngay", "gio"],
            ],
            "noneOf": [*COMMON_DISQUALIFIERS],
        }
    ],
}

# Fresh natural Vietnamese paraphrases (1 per catalog rule, never in aliases or Gold).
PARAPHRASE_SUITE: list[tuple[str, str]] = [
    ("q-pol01-min-stay", "Cho mình hỏi đặt phòng cần ở tối thiểu mấy đêm vậy?"),
    ("q-pol01-rooms-per-req", "Một yêu cầu đặt phòng có chọn được nhiều phòng cùng lúc không?"),
    (
        "q-pol01-hold-window",
        "Khách có thời gian bao lâu để thanh toán cọc giữ chỗ sau khi tạo đơn?",
    ),
    ("q-pol01-late-arrival", "Nếu mình đến nhận phòng lúc 23h thì có cần thỏa thuận trước không?"),
    ("q-pol01-modify-quote", "Thời hạn hiệu lực của báo giá đổi đặt phòng kéo dài mấy phút?"),
    (
        "q-pol02-standard-hours",
        "Quy định giờ check-in và check-out chuẩn của khách sạn là lúc mấy giờ?",
    ),
    ("q-pol02-early-checkin", "Nhận phòng sớm hơn giờ quy định sẽ tính phí như thế nào?"),
    (
        "q-pol02-late-checkout",
        "Nếu mình muốn trả phòng muộn thì phí tính theo bao nhiêu phần trăm?",
    ),
    ("q-pol03-deposit-rate", "Tỷ lệ đặt cọc khi đặt phòng tại khách sạn là bao nhiêu phần trăm?"),
    ("q-pol03-demo-tax", "Mức thuế hóa đơn áp dụng trong bản demo là mấy phần trăm?"),
    (
        "q-pol04-cancellation",
        "Cho tôi biết quy định tỷ lệ hoàn và phí hủy đặt phòng trước mấy ngày.",
    ),
    ("q-pol05-refund-sla", "Sau khi xác minh thì thời hạn xử lý hoàn tiền mất mấy ngày?"),
    ("q-pol06-infant-capacity", "Em bé hay trẻ sơ sinh có bị tính vào sức chứa phòng không?"),
    ("q-pol06-min-age", "Người đại diện khi check-in cần đạt độ tuổi tối thiểu bao nhiêu tuổi?"),
    ("q-pol07-pets", "Mình có thể mang theo chó mèo hoặc thú cưng khi ở khách sạn không?"),
    (
        "q-pol08-in-stay-services",
        "Nếu chưa nhận phòng thì có đặt dịch vụ trong kỳ lưu trú được không?",
    ),
    (
        "q-pol08-cancel-service",
        "Khi hủy dịch vụ trước khi bắt đầu thì khách có được hoàn tiền không?",
    ),
    ("q-pol09-complaints-sla", "Khách sạn xử lý phản ánh và khiếu nại trong thời hạn bao lâu?"),
    (
        "q-pol10-retention",
        "Thời hạn lưu giữ log và bản khôi phục dữ liệu là bao nhiêu ngày và giờ?",
    ),
]

# Adversarial cases that MUST fail closed (ambiguous or unknown).
ADVERSARIAL_SUITE: list[tuple[str, str]] = [
    ("ambiguous", "Cho hỏi tỷ lệ đặt cọc bao nhiêu phần trăm và thú cưng có được mang vào không?"),
    ("ambiguous", "Quy định phí nhận phòng sớm và thời hạn xử lý khiếu nại là bao lâu?"),
    ("unknown", "Tôi không hỏi chính sách thú cưng đâu nhé."),
    ("unknown", "Chưa biết ngày kết thúc demo, hãy nói hạn giữ backup chính xác."),
    ("unknown", "Tôi tới lúc 18:00 với đặt phòng cùng ngày thì có chắc được nhận không?"),
    ("unknown", "Khách sinh ngày 31/02/2008, nhận phòng 10/12/2026 có đủ tuổi không?"),
    ("unknown", "Khách sạn có cho mang thú cưng không và hồ bơi mở cửa lúc mấy giờ?"),
    ("unknown", "Khách sạn có cho mang thú cưng và mở cửa hồ bơi lúc mấy giờ?"),
    ("unknown", "Khách sạn có cho mang thú cưng không? Còn hồ bơi mở cửa mấy giờ?"),
    ("unknown", "Tôi đến muộn lúc 23:00 hay 25:99 có cần báo trước không?"),
    ("unknown", "Tôi đến muộn lúc 18:00 hay 23:00 có cần báo trước không?"),
    ("unknown", "Khách sinh 05/12/2008, nhận phòng 10/12/2026 hay 31/02/2026 thì đủ tuổi không?"),
]

# Expected rule bindings for all 19 dev-A cases in the pinned v2 (41-fact) catalog.
DEV_A_EXPECTED_BINDINGS: dict[str, str] = {
    "D-A01": "q-pol01-arrival-before-creation",
    "D-A02": "q-pol01-same-day-booking",
    "D-A03": "q-pol01-late-arrival",
    "D-A08": "q-pol01-expired-modify-quote",
    "D-A09": "q-pol01-modify-quote-version-deadline",
    "D-A10": "q-pol01-cancel-while-modify-pending",
    "D-A11": "q-pol03-modify-increase-deposit",
    "D-A12": "q-pol03-modify-decrease-excess-deposit",
    "D-A13": "q-pol03-modify-increase-deposit",
    "D-A14": "q-pol03-deposit-discount-basis",
    "D-A15": "q-pol03-demo-invoice-formula",
    "D-A16": "q-pol03-advance-vs-overpayment",
    "D-A18": "q-pol06-min-age",
    "D-A19": "q-pol06-min-age",
    "D-A20": "q-pol08-express-laundry-unit",
    "D-A21": "q-pol08-in-stay-services",
    "D-A22": "q-pol10-retention",
    "D-A23": "q-pol10-retention",
    "H-A24": "q-pol09-early-departure-vs-supply-failure",
}


def load_verified_catalog(
    catalog_path: Path,
    *,
    expected_hash: str | None = None,
    authorities: frozenset[str] = frozenset({"user-academic-demo"}),
) -> VerifiedCatalog:
    raw = catalog_path.read_bytes()
    data = json.loads(raw)
    sources = tuple(
        Source.model_validate_json(json.dumps(s, ensure_ascii=False)) for s in data["sources"]
    )
    return VerifiedCatalog(
        lambda: raw,
        expected_hash=expected_hash or digest(raw),
        authorities=authorities,
        source_reader=lambda: sources,
    )


def build_augmented_catalog(
    catalog_path: Path = CATALOG_PATH,
) -> tuple[VerifiedCatalog, VerifiedCatalog]:
    """Return (baseline_catalog, pattern_augmented_catalog) in memory without writing to disk."""
    raw_base = catalog_path.read_bytes()
    data_base = json.loads(raw_base)
    sources = tuple(
        Source.model_validate_json(json.dumps(s, ensure_ascii=False)) for s in data_base["sources"]
    )
    authorities = frozenset({"user-academic-demo"})

    base_catalog = VerifiedCatalog(
        lambda: raw_base,
        expected_hash=digest(raw_base),
        authorities=authorities,
        source_reader=lambda: sources,
    )

    augmented = copy.deepcopy(data_base)
    normalized_rules = []
    for rule in augmented["questionRules"]:
        if rule["bindingKey"] in POLICY_PATTERNS:
            rule["patterns"] = POLICY_PATTERNS[rule["bindingKey"]]
        normalized_rules.append(
            QuestionRule.model_validate_json(json.dumps(rule, ensure_ascii=False)).model_dump(
                mode="json", by_alias=True
            )
        )
    augmented["questionRules"] = normalized_rules
    augmented["approval"]["reviewedContentSha256"] = review_hash(augmented)
    raw_aug = canonical(augmented)

    aug_catalog = VerifiedCatalog(
        lambda: raw_aug,
        expected_hash=digest(raw_aug),
        authorities=authorities,
        source_reader=lambda: sources,
    )
    return base_catalog, aug_catalog


def _verify_host_gate_preflight(
    catalog: VerifiedCatalog,
    message: str,
    selected: list,
) -> dict:
    """Confirm host VerificationGate.prepare enforces required facts/qualifiers for supplied evidence."""
    binding = bind_question(catalog, message)
    if binding.status != "bound":
        return {"gate_checked": False, "status": binding.status, "reason": binding.reason}
    vocab_h, rules_h, rend_h = component_hashes(catalog.data)
    ctx = VerificationContext.model_validate_json(
        json.dumps(
            {
                "requestId": "offline-binding-eval",
                "conversationId": "00000000-0000-4000-8000-000000000001",
                "turnId": "00000000-0000-4000-8000-000000000002",
                "diagnosticId": "00000000-0000-4000-8000-000000000003",
                "registryTurnId": "00000000-0000-4000-8000-000000000002",
                "asOfDate": POLICY_TODAY.isoformat(),
                "mode": "demo_synthetic",
                "snapshotId": catalog.data.snapshotId,
                "registryHash": digest([e.model_dump(mode="json") for e in selected]),
                "catalogHash": catalog.expected_hash,
                "vocabularyHash": vocab_h,
                "questionRulesHash": rules_h,
                "rendererHash": rend_h,
            }
        )
    )
    gate = VerificationGate(catalog)
    turn = gate.prepare(ctx, message, selected, TurnBudget())
    return {
        "gate_checked": True,
        "needs_candidate": turn.needs_candidate,
        "preflight_reason": None if turn.preflight is None else turn.preflight.reason,
        "offered_fact_count": len(turn.offered_fact_ids),
    }


def _oracle_evidence(catalog: VerifiedCatalog, message: str, evidence_by_section: dict) -> list:
    binding = bind_question(catalog, message)
    if binding.status != "bound":
        return []
    req_keys = {r.factKey for r in binding.requirements}
    needed_sections = {
        b.sectionId
        for f in catalog.data.facts
        if f.factKey in req_keys
        for b in f.provenance.bindings
    }
    return [
        evidence_by_section[sec] for sec in sorted(needed_sections) if sec in evidence_by_section
    ][:3]


def _bm25_evidence(
    retriever: HybridRetriever, manifest: dict, query: str, evidence_by_chunk: dict
) -> list:
    hits = retriever.bm25(query, manifest, POLICY_TODAY)[:3]
    return [
        evidence_by_chunk[h.chunk.chunk_id] for h in hits if h.chunk.chunk_id in evidence_by_chunk
    ]


def evaluate_dev_binding(
    gold_path: Path = GOLD_PATH,
    contract_path: Path = CONTRACT_PATH,
    v1_catalog_path: Path = V1_CATALOG_PATH,
) -> dict:
    contract = read_contract(contract_path)
    grounding = contract.environment.AI_GROUNDING
    pinned_path = ROOT / grounding.catalog_path
    pinned_cat = load_verified_catalog(
        pinned_path,
        expected_hash=grounding.catalog_sha256,
        authorities=frozenset(grounding.authorities),
    )
    v1_cat = load_verified_catalog(v1_catalog_path)
    gold = json.loads(gold_path.read_text(encoding="utf-8"))
    dev_cases = [c for c in gold["cases"] if c["split"] == "dev"]

    index = ReadOnlyPairedIndex(
        "demo_synthetic",
        None,
        None,
        root=ROOT,
        profile=EmbeddingProfile(),
        chunking=ChunkingConfig(),
        source_pack="academic_policies",
    )
    manifest = index.local_active(POLICY_TODAY)
    retriever = HybridRetriever(index, None, None)
    _, _, _, _, all_evidence = source_view(index, POLICY_TODAY)
    evidence_by_section = {e.sectionId: e for e in all_evidence}
    evidence_by_chunk = {e.chunkId: e for e in all_evidence}

    dev_rows = []
    for case in dev_cases:
        b_v1 = bind_question(v1_cat, case["query"])
        b_cur = bind_question(pinned_cat, case["query"])
        oracle_ev = _oracle_evidence(pinned_cat, case["query"], evidence_by_section)
        bm25_ev = _bm25_evidence(retriever, manifest, case["query"], evidence_by_chunk)
        oracle_gate = _verify_host_gate_preflight(pinned_cat, case["query"], oracle_ev)
        bm25_gate = _verify_host_gate_preflight(pinned_cat, case["query"], bm25_ev)
        expected_key = DEV_A_EXPECTED_BINDINGS.get(case["id"])
        minimal_sets = [
            {"-".join(ref.split("-")[:3]) for ref in ref_set}
            for ref_set in case.get("acceptableMinimalEvidenceSets", ())
            if ref_set
        ]
        bm25_sections = [e.sectionId for e in bm25_ev]
        bm25_complete = bool(minimal_sets) and any(
            unit_set.issubset(set(bm25_sections)) for unit_set in minimal_sets
        )
        dev_rows.append(
            {
                "id": case["id"],
                "label": case["label"],
                "topic": case.get("topic") or case.get("primaryTopic"),
                "acceptable_unit_sets": [sorted(u) for u in minimal_sets],
                "expected_binding_key": expected_key,
                "v1_baseline_status": b_v1.status,
                "pinned_status": b_cur.status,
                "pinned_reason": b_cur.reason,
                "pinned_key": b_cur.key,
                "pattern_id": b_cur.matchedPatternId,
                "key_matches_expected": (
                    b_cur.status == "bound" and b_cur.key == expected_key
                    if expected_key is not None
                    else b_cur.status != "bound"
                ),
                "oracle_gate": oracle_gate,
                "bm25_retrieved_sections": bm25_sections,
                "bm25_complete_evidence_at_3": bm25_complete,
                "bm25_retrieved_gate": bm25_gate,
            }
        )

    dev_a = [r for r in dev_rows if r["label"] == "A"]
    dev_u = [r for r in dev_rows if r["label"] == "U"]
    dev_o = [r for r in dev_rows if r["label"] == "O"]

    paraphrase_rows = []
    for expected_key, query in PARAPHRASE_SUITE:
        b_v1 = bind_question(v1_cat, query)
        b_cur = bind_question(pinned_cat, query)
        oracle_ev = _oracle_evidence(pinned_cat, query, evidence_by_section)
        bm25_ev = _bm25_evidence(retriever, manifest, query, evidence_by_chunk)
        oracle_gate = _verify_host_gate_preflight(pinned_cat, query, oracle_ev)
        bm25_gate = _verify_host_gate_preflight(pinned_cat, query, bm25_ev)
        paraphrase_rows.append(
            {
                "expected_key": expected_key,
                "v1_baseline_status": b_v1.status,
                "pinned_status": b_cur.status,
                "pinned_key": b_cur.key,
                "matched": b_cur.status == "bound" and b_cur.key == expected_key,
                "oracle_gate_needs_candidate": oracle_gate.get("needs_candidate", False),
                "bm25_retrieved_sections": [e.sectionId for e in bm25_ev],
                "bm25_gate_needs_candidate": bm25_gate.get("needs_candidate", False),
            }
        )

    adversarial_rows = []
    for expected_status, query in ADVERSARIAL_SUITE:
        b_cur = bind_question(pinned_cat, query)
        adversarial_rows.append(
            {
                "expected_status": expected_status,
                "actual_status": b_cur.status,
                "reason": b_cur.reason,
                "matched": b_cur.status == expected_status,
            }
        )

    return {
        "schema_version": 3,
        "mode": "offline_question_binding_dev_eval",
        "evaluation_catalog_mode": "pinned_runtime_catalog",
        "runtime_catalog_version": pinned_cat.data.catalogVersion,
        "runtime_catalog_path": grounding.catalog_path.as_posix(),
        "runtime_catalog_sha256": pinned_cat.expected_hash,
        "runtime_catalog_facts_count": len(pinned_cat.data.facts),
        "runtime_catalog_rules_count": len(pinned_cat.data.questionRules),
        "runtime_catalog_patterns_count": sum(
            len(r.patterns) for r in pinned_cat.data.questionRules
        ),
        "v1_baseline_catalog_sha256": v1_cat.expected_hash,
        "v1_baseline_patterns_count": sum(len(r.patterns) for r in v1_cat.data.questionRules),
        "evidence_note": (
            "oracle_gate_ready injects required sections from catalog bindings (does NOT measure "
            "retrieval recall); bm25_retrieved_gate_ready uses actual offline HybridRetriever.bm25() "
            "top-3 retrieval (with FTS5 adjacent bigrams)."
        ),
        "split_evaluated": "dev",
        "held_out_touched": False,
        "catalog_snapshot_id": pinned_cat.data.snapshotId,
        "dev_summary": {
            "total": len(dev_rows),
            "dev_a_total": len(dev_a),
            "dev_a_v1_baseline_bound": sum(r["v1_baseline_status"] == "bound" for r in dev_a),
            "dev_a_pinned_bound_total": sum(r["pinned_status"] == "bound" for r in dev_a),
            "dev_a_pinned_bound_exact": sum(r["key_matches_expected"] for r in dev_a),
            "dev_a_oracle_gate_ready": sum(
                bool(r["oracle_gate"].get("needs_candidate")) for r in dev_a
            ),
            "dev_a_bm25_complete_evidence_at_3": sum(
                r["bm25_complete_evidence_at_3"] for r in dev_a
            ),
            "dev_a_bm25_retrieved_gate_ready": sum(
                bool(r["bm25_retrieved_gate"].get("needs_candidate")) for r in dev_a
            ),
            "dev_u_total": len(dev_u),
            "dev_u_false_bound": sum(r["pinned_status"] == "bound" for r in dev_u),
            "dev_o_total": len(dev_o),
            "dev_o_false_bound": sum(r["pinned_status"] == "bound" for r in dev_o),
        },
        "paraphrase_summary": {
            "total": len(paraphrase_rows),
            "v1_baseline_bound": sum(r["v1_baseline_status"] == "bound" for r in paraphrase_rows),
            "pinned_exact_matched": sum(r["matched"] for r in paraphrase_rows),
            "oracle_gate_ready": sum(r["oracle_gate_needs_candidate"] for r in paraphrase_rows),
            "bm25_retrieved_gate_ready": sum(
                r["bm25_gate_needs_candidate"] for r in paraphrase_rows
            ),
        },
        "adversarial_summary": {
            "total": len(adversarial_rows),
            "matched": sum(r["matched"] for r in adversarial_rows),
            "false_bound": sum(r["actual_status"] == "bound" for r in adversarial_rows),
        },
        "dev_cases": dev_rows,
        "paraphrase_cases": paraphrase_rows,
        "adversarial_cases": adversarial_rows,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args(argv)
    report = evaluate_dev_binding()
    encoded = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    summary = {
        k: v
        for k, v in report.items()
        if k not in {"dev_cases", "paraphrase_cases", "adversarial_cases"}
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
