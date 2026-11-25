"""Offline builder for immutable Academic Demo catalog v2 (41 facts, 31 rules with patterns).

- Reads the approved paired snapshot (`academic_policies`) via ReadOnlyPairedIndex.
- Preserves all 28 facts and 19 rules from `academic-policies-2026-11-24-v1` (read-only).
- Adds 13 policy facts (12 new questionRules) closing the 13 `dev-A` policy-rule gaps, with
  programmatically verified character spans against the exact approved source chunks.
- Attaches structured `QuestionPattern`s to all 31 rules (zero Gold queries copied).
- Never overwrites an existing release directory unless explicitly requested; never runs online.
"""

import argparse
import copy
import json
import shutil
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.academic_demo_preflight import ReadOnlyPairedIndex  # noqa: E402
from app.indexing import ChunkingConfig, EmbeddingProfile  # noqa: E402
from app.ingestion.snapshot import ROOT  # noqa: E402
from app.orchestration.verification.artifacts import source_view  # noqa: E402
from app.orchestration.verification.catalog import (  # noqa: E402
    VerifiedCatalog,
    canonical,
    digest,
    review_hash,
)
from app.schemas.verification import CatalogData, QuestionRule, Source  # noqa: E402
from tests.evaluation.evaluate_question_binding import (  # noqa: E402
    COMMON_DISQUALIFIERS,
    POLICY_PATTERNS,
)

V1_DIR = ROOT / ".local/grounding/demo_synthetic/academic-policies-2026-11-24-v1"
DEFAULT_RELEASE = "academic-policies-2026-11-25-v2"
AUTHORITY = "user-academic-demo"
DECISION_ID = "academic-demo-policies-2026-11-25-v2"
POLICY_TODAY = date(2026, 11, 25)

NEW_PREDICATES = [
    {
        "id": "arrival_before_creation_allowed",
        "valueKind": "boolean",
        "enumValues": [],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "same_day_booking_auto_confirmed",
        "valueKind": "boolean",
        "enumValues": [],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "modify_quote_old_version_or_exact_deadline_valid",
        "valueKind": "boolean",
        "enumValues": [],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "expired_modify_quote_cancels_original",
        "valueKind": "boolean",
        "enumValues": [],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "cancel_while_modify_pending_basis",
        "valueKind": "enum",
        "enumValues": ["original_booking_terms"],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "deposit_uses_total_bill_discount",
        "valueKind": "boolean",
        "enumValues": [],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "demo_invoice_calculation_formula",
        "valueKind": "enum",
        "enumValues": ["bill_g_s_e_tax_minus_abill"],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "advance_over_deposit_is_bill_overpayment",
        "valueKind": "boolean",
        "enumValues": [],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "modify_increase_topup_rule",
        "valueKind": "enum",
        "enumValues": ["topup_max_dnew_minus_dheld_no_double_charge"],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "modify_decrease_excess_choice",
        "valueKind": "enum",
        "enumValues": ["refund_or_hold_advance_before_effective"],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "express_laundry_billing_unit",
        "valueKind": "enum",
        "enumValues": ["package"],
        "units": [],
        "cardinality": "single",
    },
    {
        "id": "express_laundry_example_unit_price",
        "valueKind": "decimal",
        "enumValues": [],
        "units": ["vnd"],
        "cardinality": "single",
    },
    {
        "id": "early_departure_vs_supply_failure_rule",
        "valueKind": "enum",
        "enumValues": ["personal_no_auto_refund_supply_failure_manager_refund"],
        "units": [],
        "cardinality": "single",
    },
]

# Each entry defines one atomic fact, its exact quote in the approved policy section,
# and its faithful canonical Vietnamese rendering preserving all conditions/exceptions.
NEW_FACT_SPECS = [
    {
        "factId": "pol01-arrival-before-creation-v1",
        "factKey": "pol01.arrival_before_creation_allowed",
        "predicate": "arrival_before_creation_allowed",
        "value": {"kind": "boolean", "data": False},
        "unit": None,
        "sectionId": "POL-01-U01",
        "quote": "Booking thông thường chỉ nhận ngày đến sau ngày tạo; ngày đến trước ngày tạo bị từ chối.",
        "templateKey": "tmpl-pol01-arrival-before-creation-v1",
        "label": "Không được nhận",
        "suffix": (
            ": booking thông thường chỉ nhận ngày đến sau ngày tạo (UTC+07:00); "
            "ngày đến trước ngày tạo bị từ chối."
        ),
    },
    {
        "factId": "pol01-same-day-auto-confirmed-v1",
        "factKey": "pol01.same_day_auto_confirmed",
        "predicate": "same_day_booking_auto_confirmed",
        "value": {"kind": "boolean", "data": False},
        "unit": None,
        "sectionId": "POL-01-U01",
        "quote": (
            "Cùng ngày hoặc walk-in cần nhân viên xác nhận giờ tiếp nhận, phòng, báo giá và "
            "thanh toán. Chưa có cutoff cố định: không mặc định còn phòng hoặc được nhận trước 22:00"
        ),
        "templateKey": "tmpl-pol01-same-day-auto-confirmed-v1",
        "label": "Không tự động được nhận",
        "suffix": (
            ": đặt phòng cùng ngày hoặc walk-in cần nhân viên xác nhận giờ tiếp nhận, phòng, "
            "báo giá và thanh toán; chưa có cutoff cố định và không mặc định còn phòng hoặc "
            "được nhận kể cả trước 22:00."
        ),
    },
    {
        "factId": "pol01-modify-quote-version-deadline-v1",
        "factKey": "pol01.modify_quote_old_version_or_at_deadline_valid",
        "predicate": "modify_quote_old_version_or_exact_deadline_valid",
        "value": {"kind": "boolean", "data": False},
        "unit": None,
        "sectionId": "POL-01-U04",
        "quote": (
            "Báo giá hiệu lực 15 phút từ lúc phát hành. Khách phải chấp nhận đúng phiên bản báo "
            "giá và đủ khoản bổ sung theo thời điểm giao dịch đáng tin trước hạn; bằng hạn là "
            "quá hạn. Không dùng chấp nhận phiên bản báo giá cũ cho phiên bản báo giá mới."
        ),
        "templateKey": "tmpl-pol01-modify-quote-version-deadline-v1",
        "label": "Không thể tự động đổi phòng",
        "suffix": (
            ": báo giá sửa hiệu lực 15 phút (UTC+07:00), không dùng chấp nhận phiên bản báo giá "
            "cũ cho phiên bản mới, và tiền đủ đúng bằng hạn được tính là quá hạn; chỉ áp thay "
            "đổi khi đủ chấp nhận đúng phiên bản, tiền trước hạn và xác nhận khả năng cung ứng."
        ),
    },
    {
        "factId": "pol01-expired-modify-quote-original-v1",
        "factKey": "pol01.expired_modify_quote_cancels_original",
        "predicate": "expired_modify_quote_cancels_original",
        "value": {"kind": "boolean", "data": False},
        "unit": None,
        "sectionId": "POL-01-U05",
        "quote": (
            "Từ chối, không chấp nhận hoặc hết hạn thiếu tiền/chấp nhận: bỏ riêng phần sửa, "
            "không tự hủy/phạt booking gốc. Khoản bổ sung chưa được áp dụng là tiền chưa phân "
            "bổ, hoàn sau xác minh, không phí hủy"
        ),
        "templateKey": "tmpl-pol01-expired-modify-quote-original-v1",
        "label": "Không tự bị hủy hoặc phạt booking gốc",
        "suffix": (
            ": khi báo giá sửa hết hạn hoặc thiếu tiền/chấp nhận, hệ thống chỉ bỏ riêng phần sửa; "
            "khoản bổ sung chưa áp dụng là tiền chưa phân bổ, được hoàn sau xác minh không phí hủy."
        ),
    },
    {
        "factId": "pol01-cancel-while-modify-pending-v1",
        "factKey": "pol01.cancel_while_modify_pending_basis",
        "predicate": "cancel_while_modify_pending_basis",
        "value": {"kind": "enum", "data": "original_booking_terms"},
        "unit": None,
        "sectionId": "POL-01-U06",
        "quote": (
            "Sửa chưa có hiệu lực: hủy trên ngày đến/cọc/phiên bản gốc và chấm dứt báo giá "
            "đang chờ. Sửa đã có hiệu lực: dùng ngày đến/cọc/phiên bản đã chốt. Không thu hai phí hủy."
        ),
        "templateKey": "tmpl-pol01-cancel-while-modify-pending-v1",
        "label": "Dùng ngày đến, cọc và phiên bản của booking gốc",
        "suffix": (
            " khi báo giá sửa chưa có hiệu lực, đồng thời chấm dứt báo giá đang chờ và không thu "
            "hai phí hủy (chỉ dùng thông số đã chốt nếu sửa đã có hiệu lực)."
        ),
    },
    {
        "factId": "pol03-deposit-discount-basis-v1",
        "factKey": "pol03.deposit_uses_total_bill_discount",
        "predicate": "deposit_uses_total_bill_discount",
        "value": {"kind": "boolean", "data": False},
        "unit": None,
        "sectionId": "POL-03-U02",
        "quote": "Cọc=làm tròn HALF_UP[30%×max(G−A_room,0)] VND nguyên, không dùng A_bill thay A_room.",
        "templateKey": "tmpl-pol03-deposit-discount-basis-v1",
        "label": "Không dùng tổng giảm hóa đơn A_bill để tính cọc",
        "suffix": (
            ": cọc tính bằng HALF_UP[30% × max(G − A_room, 0)] VND nguyên, chỉ trừ phần giảm "
            "được chấp nhận phân bổ rõ cho tiền phòng (A_room), không dùng A_other hay A_bill."
        ),
    },
    {
        "factId": "pol03-demo-invoice-formula-v1",
        "factKey": "pol03.demo_invoice_formula",
        "predicate": "demo_invoice_calculation_formula",
        "value": {"kind": "enum", "data": "bill_g_s_e_tax_minus_abill"},
        "unit": None,
        "sectionId": "POL-03-U02",
        "quote": (
            "Ví dụ G=1.700.000, S=360.000, E=0: toàn bộ giảm 100.000 VND là giảm phòng, "
            "A_room=A_bill=100.000, A_other=0. Tax=206.000, Bill=2.166.000, cọc=480.000; "
            "nếu đã nộp cọc đó thì còn thu 1.686.000."
        ),
        "templateKey": "tmpl-pol03-demo-invoice-formula-v1",
        "label": "Công thức hóa đơn demo",
        "suffix": (
            ": Tax = HALF_UP[10% × (G+S+E)], Bill = max(G+S+E+Tax − A_bill, 0), "
            "Cọc = HALF_UP[30% × max(G − A_room, 0)], Còn thu = max(Bill − P, 0). "
            "Ví dụ minh họa trong policy (G=1.700.000, S=360.000, E=0, giảm phòng 100.000, đã nộp cọc): "
            "Tax=206.000, Bill=2.166.000, cọc=480.000, còn thu=1.686.000 VND (số minh họa, cần nhân viên đối soát)."
        ),
    },
    {
        "factId": "pol03-advance-vs-overpayment-v1",
        "factKey": "pol03.advance_over_deposit_is_bill_overpayment",
        "predicate": "advance_over_deposit_is_bill_overpayment",
        "value": {"kind": "boolean", "data": False},
        "unit": None,
        "sectionId": "POL-03-U03",
        "quote": (
            "Ứng trước vượt cọc yêu cầu khác với thu thừa hóa đơn: phần ứng trước có thể giữ làm "
            "khoản ứng trước cho Bill nếu khách đồng ý."
        ),
        "templateKey": "tmpl-pol03-advance-vs-overpayment-v1",
        "label": "Không mặc nhiên là tiền thu thừa hóa đơn phải hoàn ngay",
        "suffix": (
            ": ứng trước vượt cọc yêu cầu khác với thu thừa hóa đơn cuối cùng; phần vượt cọc có "
            "thể giữ làm khoản ứng trước cho hóa đơn (Bill) nếu khách đồng ý, và mọi khoản hoàn "
            "đều cần đối soát chứng từ."
        ),
    },
    {
        "factId": "pol03-modify-increase-topup-v1",
        "factKey": "pol03.modify_increase_topup_rule",
        "predicate": "modify_increase_topup_rule",
        "value": {"kind": "enum", "data": "topup_max_dnew_minus_dheld_no_double_charge"},
        "unit": None,
        "sectionId": "POL-03-U04",
        "quote": (
            "D_held là cọc phòng khả dụng: tiền thực đã thu còn giữ, không tính phần đã hoàn và "
            "không tính phần đã dành cho lệnh hoàn hoặc chỉ thị tài chính khác. Không dùng tiền "
            "dịch vụ/phí tự bù cọc. Cần bổ sung=max(D_new−D_held,0); không thu cọc cũ lần hai."
        ),
        "templateKey": "tmpl-pol03-modify-increase-topup-v1",
        "label": "Chỉ nộp phần cọc bổ sung max(D_new − D_held, 0), không thu lại toàn bộ cọc mới",
        "suffix": (
            ": D_held là cọc phòng thực còn giữ sau khi trừ phần đã hoàn và phần đã dành cho lệnh "
            "hoàn/chỉ thị khác (không dùng tiền dịch vụ bù cọc). Ví dụ trong policy: "
            "giữ 510.000 trừ 300.000 dành hoàn → D_held=210.000, D_new=255.000 → bổ sung 45.000 VND; "
            "hoặc R=2.550.000, D_held=510.000 → D_new=765.000, bổ sung 255.000 VND (số minh họa, cần đối soát)."
        ),
    },
    {
        "factId": "pol03-modify-decrease-excess-v1",
        "factKey": "pol03.modify_decrease_excess_choice",
        "predicate": "modify_decrease_excess_choice",
        "value": {"kind": "enum", "data": "refund_or_hold_advance_before_effective"},
        "unit": None,
        "sectionId": "POL-03-U05",
        "quote": (
            "Trước hiệu lực, khách ghi trong chấp nhận báo giá lựa chọn hoàn cọc dư không phí hủy "
            "hoặc giữ ứng trước cho hóa đơn mới; chưa chọn thì nhân viên xin xác nhận, chưa áp phần sửa."
        ),
        "templateKey": "tmpl-pol03-modify-decrease-excess-v1",
        "label": "Cọc mới D_new = HALF_UP(30% × max(R, 0)), cọc dư = max(D_held − D_new, 0)",
        "suffix": (
            ": trước khi phần sửa có hiệu lực, khách phải ghi lựa chọn hoàn cọc dư không phí hủy "
            "hoặc giữ ứng trước cho hóa đơn mới trong chấp nhận báo giá (chưa chọn thì chưa áp sửa). "
            "Ví dụ trong policy: R=850.000, D_held=510.000 → D_new=255.000, cọc dư=255.000 VND (không áp phí hủy)."
        ),
    },
    {
        "factId": "pol08-express-laundry-unit-v1",
        "factKey": "pol08.express_laundry_unit",
        "predicate": "express_laundry_billing_unit",
        "value": {"kind": "enum", "data": "package"},
        "unit": None,
        "sectionId": "POL-08-U03",
        "quote": "Express Laundry 3kg ID 3 theo package. Gói 3kg không phải giá mỗi Kg",
        "templateKey": "tmpl-pol08-express-laundry-unit-v1",
        "label": "Tính theo package (gói 3kg), không tính theo Kg",
        "suffix": "; phải xác minh danh mục, giá và trạng thái hoạt động trước khi nhận yêu cầu.",
    },
    {
        "factId": "pol08-express-laundry-example-price-v1",
        "factKey": "pol08.express_laundry_example_price",
        "predicate": "express_laundry_example_unit_price",
        "value": {"kind": "decimal", "data": "120000"},
        "unit": "vnd",
        "unitText": "VND",
        "sectionId": "POL-08-U03",
        "quote": (
            "Ví dụ hai package laundry giá 120.000/package: trước thuế 240.000, thuế demo 10% là "
            "24.000, tổng 264.000; không phải hai Kg."
        ),
        "templateKey": "tmpl-pol08-express-laundry-example-price-v1",
        "label": "120.000",
        "prefix": "Giá minh họa trong dữ liệu giả lập là ",
        "suffix": (
            "/package (ví dụ 2 package: trước thuế 240.000, thuế demo 10% là 24.000, tổng 264.000 VND; "
            "đây là số minh họa, không phải báo giá live hiện tại)."
        ),
    },
    {
        "factId": "pol09-early-departure-vs-supply-failure-v1",
        "factKey": "pol09.early_departure_vs_supply_failure",
        "predicate": "early_departure_vs_supply_failure_rule",
        "value": {
            "kind": "enum",
            "data": "personal_no_auto_refund_supply_failure_manager_refund",
        },
        "unit": None,
        "sectionId": "POL-09-U03",
        "quote": (
            "Khách sạn không cung cấp phần lưu trú chưa dùng: quản lý xác minh để hoàn toàn bộ "
            "tiền phòng phần đó đã thu, không phí hủy; dịch vụ đã dùng đối soát riêng, không tự "
            "tặng nâng hạng/dịch vụ.\n- Rời sớm vì lý do cá nhân sau nhận phòng không tự hoàn "
            "các đêm đã xác nhận hoặc áp bảng hủy trước nhận; quản lý có thể duyệt ngoại lệ có lý do."
        ),
        "templateKey": "tmpl-pol09-early-departure-vs-supply-failure-v1",
        "label": "Rời sớm do cá nhân không tự hoàn đêm đã xác nhận; lỗi cung ứng của khách sạn được hoàn phần phòng chưa dùng",
        "suffix": (
            " sau khi quản lý xác minh và không áp phí hủy (dịch vụ đã dùng đối soát riêng, "
            "không tự hứa nâng hạng hay bồi thường thêm; rời sớm cá nhân cần quản lý duyệt ngoại lệ có lý do)."
        ),
    },
]

NEW_QUESTION_RULES = [
    {
        "bindingKey": "q-pol01-arrival-before-creation",
        "aliases": [
            "Ngày đến trước ngày tạo booking có được nhận không?",
            "Đặt phòng chọn ngày nhận phòng trước ngày tạo đơn có được không?",
        ],
        "requirements": [
            {
                "factKey": "pol01.arrival_before_creation_allowed",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol01.arrival_before_creation_allowed"],
        "patterns": [
            {
                "patternId": "p-pol01-arrival-before-creation",
                "allOf": [
                    ["tao don", "ngay tao", "booking thong thuong"],
                    ["nhan phong", "ngay den"],
                    ["duoc nhan", "tu choi", "hop le", "truoc ngay tao"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS, "cung ngay", "walk-in", "22h", "22:00", "23:00"],
                "requiredParams": [
                    {"kind": "date_dmy", "minCount": 2, "minValue": None, "maxValue": None}
                ],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol01-same-day-booking",
        "aliases": [
            "Đặt phòng cùng ngày có tự động được nhận không?",
            "Đặt phòng và nhận phòng trong ngày hôm nay có cần nhân viên xác nhận không?",
        ],
        "requirements": [
            {
                "factKey": "pol01.same_day_auto_confirmed",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol01.same_day_auto_confirmed"],
        "patterns": [
            {
                "patternId": "p-pol01-same-day-booking",
                "allOf": [
                    ["cung ngay", "ngay hom nay", "walk-in"],
                    ["dat phong", "nhan ngay", "nhan phong"],
                    ["tu dong", "xac nhan", "nhan vien", "walk-in"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS, "gio muon nhat", "chot gio"],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol01-modify-quote-version-deadline",
        "aliases": [
            "Chấp nhận phiên bản báo giá sửa cũ và nộp tiền đúng hạn có tự động đổi phòng không?",
            "Báo giá sửa phiên bản cũ và thanh toán đúng bằng hạn 15 phút có hợp lệ không?",
        ],
        "requirements": [
            {
                "factKey": "pol01.modify_quote_old_version_or_at_deadline_valid",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol01.modify_quote_old_version_or_at_deadline_valid"],
        "patterns": [
            {
                "patternId": "p-pol01-modify-quote-version-deadline",
                "allOf": [
                    ["bao gia sua", "bao gia doi"],
                    ["phien ban cu", "ban moi", "dung han", "bang han"],
                    ["doi phong", "hop le", "tu dong", "ap dung"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS, "het han"],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol01-expired-modify-quote",
        "aliases": [
            "Báo giá sửa hết hạn có tự hủy hoặc phạt booking gốc không?",
            "Hết hạn báo giá sửa đơn vì thiếu cọc bổ sung thì booking gốc có bị hủy không?",
        ],
        "requirements": [
            {
                "factKey": "pol01.expired_modify_quote_cancels_original",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol01.expired_modify_quote_cancels_original"],
        "patterns": [
            {
                "patternId": "p-pol01-expired-modify-quote",
                "allOf": [
                    ["bao gia sua", "bao gia doi"],
                    ["het han", "thieu coc"],
                    ["booking goc", "don goc", "tu bi huy", "phat"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol01-cancel-while-modify-pending",
        "aliases": [
            "Hủy khi báo giá sửa chưa có hiệu lực thì dùng ngày đến và cọc nào?",
            "Gửi yêu cầu hủy hợp lệ lúc báo giá đổi ngày chưa có hiệu lực tính theo đơn nào?",
        ],
        "requirements": [
            {
                "factKey": "pol01.cancel_while_modify_pending_basis",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol01.cancel_while_modify_pending_basis"],
        "patterns": [
            {
                "patternId": "p-pol01-cancel-while-modify-pending",
                "allOf": [
                    ["huy hop le", "huy don", "huy booking"],
                    ["bao gia doi", "bao gia sua"],
                    ["chua co hieu luc", "dang cho"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol03-deposit-discount-basis",
        "aliases": [
            "Tính cọc có dùng tổng giảm hóa đơn gồm cả giảm khác ngoài tiền phòng không?",
            "Có dùng A_bill thay A_room để tính tiền đặt cọc không?",
        ],
        "requirements": [
            {
                "factKey": "pol03.deposit_uses_total_bill_discount",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol03.deposit_uses_total_bill_discount"],
        "patterns": [
            {
                "patternId": "p-pol03-deposit-discount-basis",
                "allOf": [
                    ["giam phong", "a_room", "a_other", "a_bill"],
                    ["tong giam", "tinh coc"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS, "bill", "con thu"],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol03-demo-invoice-formula",
        "aliases": [
            "Công thức tính thuế, Bill, cọc và còn thu trong ví dụ hóa đơn demo như thế nào?",
            "Theo ví dụ hóa đơn demo G=1.700.000, S=360.000, giảm phòng 100.000 thì thuế, Bill, cọc và còn thu bao nhiêu?",
        ],
        "requirements": [
            {
                "factKey": "pol03.demo_invoice_formula",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol03.demo_invoice_formula"],
        "patterns": [
            {
                "patternId": "p-pol03-demo-invoice-formula",
                "allOf": [
                    ["bill", "hoa don"],
                    ["thue", "tax"],
                    ["con thu", "coc"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS, "a_other"],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol03-advance-vs-overpayment",
        "aliases": [
            "Ứng trước nhiều hơn cọc yêu cầu có mặc nhiên là tiền thu thừa hóa đơn phải hoàn ngay không?",
            "Trả trước vượt mức cọc có tự động coi là thu thừa hóa đơn không?",
        ],
        "requirements": [
            {
                "factKey": "pol03.advance_over_deposit_is_bill_overpayment",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol03.advance_over_deposit_is_bill_overpayment"],
        "patterns": [
            {
                "patternId": "p-pol03-advance-vs-overpayment",
                "allOf": [
                    ["ung truoc", "tra truoc"],
                    ["nhieu hon coc", "vuot coc"],
                    ["thu thua", "hoan ngay"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol03-modify-increase-deposit",
        "aliases": [
            "Khi tăng giá trị booking có cần nộp lại toàn bộ cọc mới không?",
            "Cách tính cọc khả dụng và tiền cọc cần bổ sung khi tăng giá trị đặt phòng?",
        ],
        "requirements": [
            {
                "factKey": "pol03.modify_increase_topup_rule",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol03.modify_increase_topup_rule"],
        "patterns": [
            {
                "patternId": "p-pol03-modify-increase-reconcile",
                "allOf": [
                    ["coc kha dung", "dang giu coc", "d_held"],
                    ["danh cho hoan", "can bo sung", "nop lai ca"],
                ],
                "noneOf": [
                    "khong hoi",
                    "khong ro",
                    "chua ro",
                    "chua biet",
                    "khong biet",
                    "chua ghi",
                    "chua co xac nhan",
                    "phan du",
                    "coc du",
                ],
                "requiredParams": [
                    {"kind": "vnd_amount", "minCount": 2, "minValue": None, "maxValue": None}
                ],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol03-modify-decrease-excess-deposit",
        "aliases": [
            "Khi giảm giá trị booking trước check-in thì cọc dư và trình tự lựa chọn xử lý ra sao?",
            "Cọc mới và phần cọc dư khi sửa giảm giá trị đặt phòng được xử lý thế nào?",
        ],
        "requirements": [
            {
                "factKey": "pol03.modify_decrease_excess_choice",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol03.modify_decrease_excess_choice"],
        "patterns": [
            {
                "patternId": "p-pol03-modify-decrease-excess",
                "allOf": [
                    ["coc kha dung", "sua truoc check-in", "giam gia tri"],
                    ["phan du", "coc du"],
                    ["lua chon", "xu ly", "trinh tu"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS, "danh cho hoan"],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol08-express-laundry-unit",
        "aliases": [
            "Express Laundry 3kg tính theo package hay Kg và giá minh họa là bao nhiêu?",
            "Đơn vị tính của Express Laundry 3kg là package hay theo Kg?",
        ],
        "requirements": [
            {
                "factKey": "pol08.express_laundry_unit",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            },
            {
                "factKey": "pol08.express_laundry_example_price",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": "vnd",
                "timeScope": {"kind": "none"},
            },
        ],
        "permittedFactKeys": [
            "pol08.express_laundry_unit",
            "pol08.express_laundry_example_price",
        ],
        "patterns": [
            {
                "patternId": "p-pol08-express-laundry-unit",
                "allOf": [
                    ["express laundry", "laundry 3kg"],
                    ["package", "kg", "don vi"],
                ],
                "noneOf": [
                    "khong hoi",
                    "khong ro",
                    "chua ro",
                    "chua biet",
                    "khong biet",
                    "chat lieu vai",
                    "loai tru",
                ],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
    {
        "bindingKey": "q-pol09-early-departure-vs-supply-failure",
        "aliases": [
            "Sau check-in rời sớm vì lý do cá nhân khác gì khách sạn không cung cấp được phần lưu trú còn lại?",
            "Rời sớm cá nhân sau khi nhận phòng khác gì lỗi cung ứng của khách sạn?",
        ],
        "requirements": [
            {
                "factKey": "pol09.early_departure_vs_supply_failure",
                "subjectId": "demo-hotel",
                "qualifierIds": ["academic-demo-only"],
                "unit": None,
                "timeScope": {"kind": "none"},
            }
        ],
        "permittedFactKeys": ["pol09.early_departure_vs_supply_failure"],
        "patterns": [
            {
                "patternId": "p-pol09-early-departure-vs-supply-failure",
                "allOf": [
                    ["roi som"],
                    ["ly do ca nhan", "ca nhan"],
                    ["khong cung cap", "loi cung ung"],
                ],
                "noneOf": [*COMMON_DISQUALIFIERS],
                "requiredParams": [],
                "disallowedParams": [],
                "asciiFold": True,
            }
        ],
    },
]


def build_v2_catalog() -> tuple[dict, bytes]:
    v1_data = json.loads((V1_DIR / "catalog.json").read_text(encoding="utf-8"))
    index = ReadOnlyPairedIndex(
        "demo_synthetic",
        None,
        None,
        root=ROOT,
        profile=EmbeddingProfile(),
        chunking=ChunkingConfig(),
        source_pack="academic_policies",
    )
    _, mode, snapshot, actual_sources, evidence = source_view(index, POLICY_TODAY)
    assert mode == v1_data["mode"] == "demo_synthetic"
    assert snapshot == v1_data["snapshotId"]
    ev_by_section = {e.sectionId: e for e in evidence}
    src_by_doc = {s["documentId"]: s for s in actual_sources}

    data = copy.deepcopy(v1_data)
    data["catalogVersion"] = DEFAULT_RELEASE
    data["questionRulesVersion"] = "2"
    data["rendererVersion"] = "2"
    data["vocabulary"]["version"] = "2"
    data["vocabulary"]["predicates"].extend(NEW_PREDICATES)

    # First, create all new templates and facts with verified character spans.
    new_binding_ids = []
    for spec in NEW_FACT_SPECS:
        ev = ev_by_section[spec["sectionId"]]
        src = src_by_doc[ev.documentId]
        start = ev.excerpt.find(spec["quote"])
        if start < 0:
            raise ValueError(f"Exact quote not found in {spec['sectionId']}: {spec['quote']!r}")
        end = start + len(spec["quote"])

        if spec["unit"] is not None:
            segments = [
                {"kind": "qualifier", "text": None, "qualifierId": "academic-demo-only"},
                {"kind": "literal", "text": " " + spec.get("prefix", ""), "qualifierId": None},
                {"kind": "value", "text": None, "qualifierId": None},
                {"kind": "literal", "text": " ", "qualifierId": None},
                {"kind": "unit", "text": None, "qualifierId": None},
                {"kind": "literal", "text": spec["suffix"], "qualifierId": None},
            ]
            unit_text = spec["unitText"]
        else:
            segments = [
                {"kind": "qualifier", "text": None, "qualifierId": "academic-demo-only"},
                {"kind": "literal", "text": " ", "qualifierId": None},
                {"kind": "value", "text": None, "qualifierId": None},
                {"kind": "literal", "text": spec["suffix"], "qualifierId": None},
            ]
            unit_text = None

        template = {
            "key": spec["templateKey"],
            "version": "1",
            "segments": segments,
            "valueLabels": [{"value": spec["value"], "text": spec["label"]}],
            "unitText": unit_text,
            "scopeText": None,
        }
        data["templates"].append(template)

        binding_id = f"bind-{spec['factId']}"
        new_binding_ids.append(binding_id)
        fact = {
            "schemaVersion": "d1-fact-1",
            "factId": spec["factId"],
            "factVersion": "1",
            "factKey": spec["factKey"],
            "subjectId": "demo-hotel",
            "predicate": spec["predicate"],
            "value": spec["value"],
            "unit": spec["unit"],
            "qualifierIds": ["academic-demo-only"],
            "timeScope": {"kind": "none"},
            "validity": dict(src["validity"]),
            "provenance": {
                "bindings": [
                    {
                        "bindingId": binding_id,
                        "factId": spec["factId"],
                        "documentId": ev.documentId,
                        "sourceVersion": ev.version,
                        "sourceRef": ev.sourceRef,
                        "sourceSha256": src["sourceSha256"],
                        "snapshotId": snapshot,
                        "citationId": ev.citationId,
                        "chunkId": ev.chunkId,
                        "sectionId": ev.sectionId,
                        "excerptSha256": digest(ev.excerpt.encode()),
                        "spans": [[start, end]],
                    }
                ]
            },
            "renderer": {
                "key": template["key"],
                "version": template["version"],
                "hash": digest(template),
                "ordinal": 0,
            },
            "approval": {
                "status": "approved",
                "decisionId": DECISION_ID,
                "authorityRef": AUTHORITY,
                "reviewedContentSha256": "0" * 64,
            },
        }
        data["facts"].append(fact)

    for qual in data["vocabulary"]["qualifiers"]:
        if qual["id"] == "academic-demo-only":
            qual["supportBindingIds"] = list(qual["supportBindingIds"]) + new_binding_ids
            break

    # Re-sign ALL facts because vocabulary.version and vocabulary.predicates changed.
    tmpl_by_key = {t["key"]: t for t in data["templates"]}
    for fact in data["facts"]:
        tmpl = tmpl_by_key[fact["renderer"]["key"]]
        fact["approval"] = {
            "status": "approved",
            "decisionId": DECISION_ID,
            "authorityRef": AUTHORITY,
            "reviewedContentSha256": review_hash(
                fact, vocabulary=data["vocabulary"], template=tmpl
            ),
        }

    # Attach reviewed patterns to existing 19 rules and append 12 new rules.
    normalized_rules = []
    for rule in data["questionRules"]:
        if rule["bindingKey"] in POLICY_PATTERNS:
            rule["patterns"] = POLICY_PATTERNS[rule["bindingKey"]]
        normalized_rules.append(
            QuestionRule.model_validate_json(json.dumps(rule, ensure_ascii=False)).model_dump(
                mode="json", by_alias=True
            )
        )
    for rule in NEW_QUESTION_RULES:
        normalized_rules.append(
            QuestionRule.model_validate_json(json.dumps(rule, ensure_ascii=False)).model_dump(
                mode="json", by_alias=True
            )
        )
    data["questionRules"] = normalized_rules

    # Sign catalog approval over canonical validated structure.
    data["approval"] = {
        "status": "approved",
        "decisionId": DECISION_ID,
        "authorityRef": AUTHORITY,
        "reviewedContentSha256": review_hash(data),
    }
    raw = canonical(data)

    # Validate end-to-end with strict CatalogData + VerifiedCatalog before returning.
    parsed = CatalogData.model_validate_json(raw)
    sources_objs = tuple(
        Source.model_validate_json(json.dumps(s, ensure_ascii=False)) for s in data["sources"]
    )
    VerifiedCatalog(
        lambda: raw,
        expected_hash=digest(raw),
        authorities=frozenset({AUTHORITY}),
        source_reader=lambda: sources_objs,
    )
    assert len(parsed.facts) == 41
    assert len(parsed.questionRules) == 31
    assert len(parsed.templates) == 41
    return data, raw


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", default=DEFAULT_RELEASE)
    parser.add_argument("--force", action="store_true", default=False)
    args = parser.parse_args(argv)

    out_dir = ROOT / ".local/grounding/demo_synthetic" / args.release
    if out_dir.exists() and not args.force:
        raise SystemExit(f"Release directory already exists (immutable): {out_dir}")

    data, raw_catalog = build_v2_catalog()
    out_dir.mkdir(parents=True, exist_ok=True)
    catalog_file = out_dir / "catalog.json"
    sources_file = out_dir / "sources.json"
    catalog_file.write_bytes(raw_catalog)
    shutil.copyfile(V1_DIR / "sources.json", sources_file)
    raw_sources = sources_file.read_bytes()

    print(
        json.dumps(
            {
                "release": args.release,
                "catalog_path": f".local/grounding/demo_synthetic/{args.release}/catalog.json",
                "catalog_sha256": digest(raw_catalog),
                "catalog_bytes": len(raw_catalog),
                "sources_path": f".local/grounding/demo_synthetic/{args.release}/sources.json",
                "sources_sha256": digest(raw_sources),
                "facts": len(data["facts"]),
                "questionRules": len(data["questionRules"]),
                "patterns": sum(len(r.get("patterns", ())) for r in data["questionRules"]),
                "templates": len(data["templates"]),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
