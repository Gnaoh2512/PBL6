# Human Review Packet — policy-gold-2026-11-22-v1

Ngày chuẩn bị: 23/11/2026. **PREPARED / NOT_REVIEWED**.
Gold revision **0.1.2-draft**, `pending_review / approved:false / scorable:false`.
Đây là hướng dẫn và biểu mẫu review, không phải phê duyệt semantic, freeze, corpus ingestion hoặc kết quả chạy hệ thống.

## Mở packet và kiểm tra baseline

1. Chạy hai command chỉ đọc ở cuối tài liệu. Nếu source, Gold hoặc packet lệch checksum thì dừng review baseline đó, báo custodian; không tự re-pin để làm hết lỗi.
2. Mở [100 review cards và danh mục 38 units](records.md). Mỗi card giữ nguyên toàn bộ record JSON hiện tại, query, expected outcome, qualifiers, calculations và evidence. Các câu trả lời được sao chép để đối chiếu, chưa được người review xác nhận.
3. Đọc nguyên unit trong publication đã duyệt, không chỉ câu được trích. Liên kết ở mỗi evidence dẫn tới file thật; nhãn có unit ID và số dòng. Đối chiếu nguồn gốc bằng `originalSourceRanges` trong card và [bản policy tổng hợp](../../../../knowledge/policies/academic-demo-hotel-policies.md).
4. [review-register.json](review-register.json) có đủ 100 ID, hash và placeholder trống. `NOT_REVIEWED` là trạng thái hành chính ban đầu; reviewer/rationale/timestamp đều `null`, không có review do AI điền.
5. [review-events.jsonl](review-events.jsonl) ban đầu rỗng; đây là nơi custodian hợp nhất các quyết định thật theo lịch sử append-only. Không sửa register/cards để ghi kết quả và không ghi vào Gold.

Các artifact nguồn giữ nguyên: [Gold](../gold.json), [controls](../review-controls.json), [manifest](../manifest.json), [validation lịch sử hiện tại](../validation.json), [README nguồn](../README.md), [F5](../independent-evaluation-strategy.md).
Baseline và hashes nằm trong [packet-manifest.json](packet-manifest.json); toàn bộ log review tham chiếu hash của manifest này.

Policy là **AI_GENERATED_SYNTHETIC**, đã được user duyệt nội dung cho Academic Demo, hiệu lực 22/11/2026. Chín policy là 0.1.1, POL-07 là 0.1.0, bản tổng hợp là 0.1.1. Approval nguồn không phải approval Gold. Quyết định milestone D1 trong PROCESS cũng không phê duyệt Gold hoặc đóng các quality gates.

## Phân công và độc lập

Chưa chỉ định danh tính R1, R2, disagreement resolver và custodian. Nhóm dự án cần ghi nhận người được giao, quyền và xung đột lợi ích trước review thật. Không ai duyệt record mình soạn. R1/R2 là hai người khác nhau; resolver khác cả hai người của record đang xử lý.

R1/R2 đọc cùng baseline nhưng ghi nhận ý kiến riêng trước khi thấy ý kiến của nhau. Custodian giữ các bản nộp ban đầu riêng, sau đó mới hợp nhất vào log. Packet/log dùng chung không tự cung cấp rào cản độc lập hoặc xác thực người dùng; các quyền này cần con người tổ chức. Không có tên hoặc quyền truy cập nào được tự cấp ở đây.

80 Gold + 20 controls đều là **known regression**, không blind; hai partition cũ là 33/47. Review con người không làm dữ liệu đã lộ thành blind. Dataset độc lập tương lai tuân theo [F5](../independent-evaluation-strategy.md), không tạo trong task này.

## Rubric áp dụng cho cả 100 records

Mỗi card có checklist cùng chín trục. Đánh giá từ nguồn trước khi dùng annotation `sourceReview` của AI. Static PASS và số assertion không phải oracle semantic.
Đánh dấu checklist trên bản làm việc riêng; cards/register trong packet là bản đối chiếu được pin. Ghi các trạng thái trục và quyết định thật vào event, không sửa checkbox hoặc placeholder của baseline.

| Trục (`axes`) | Điều phải kiểm tra |
| --- | --- |
| `query` | Hiểu đủ mục tiêu được hỏi, inputs giả định, thông tin còn thiếu; không tự thêm dữ kiện. Kiểm tra scenario/asOfDate/timezone và applicability. |
| `answer` | A: mọi required meaning đều đúng và trả đủ câu hỏi, không thêm quyền lợi/cam kết. U/O: `expectedAnswer=null` là chủ ý, xem abstention reason/expected behavior. Controls: kiểm tra candidate và expectedReviewDecision, không mặc định candidate đúng. |
| `label` | A: toàn bộ câu hỏi được nguồn hỗ trợ. U: mục tiêu thật sự thiếu/không rõ/mâu thuẫn trong nguồn hoặc inputs; bác tiền đề chưa trả lời đủ mục tiêu. O: thao tác nghiệp vụ, live/private lookup ngoài scope; không suy policy từ code. Thiếu vocabulary/runtime capability không biến A thành U. Controls không có A/U/O: review tính đúng của accept_supported/reject_unsupported, không tự gán nhãn mới. |
| `evidenceSufficiency` | Mỗi meaning/condition/exception có nguồn hỗ trợ đúng subject, đơn vị, thời gian, scope; toàn bộ một alternative set phải đủ. Context không tự là evidence cho một câu trả lời khẳng định. U/O cần review cả corpus/scope, không lấy sự vắng mặt trong một đoạn làm bằng chứng policy phủ định. |
| `citationMinimality` | Mỗi alternative có đủ nội dung và không bắt buộc thêm unit trùng lặp khi một unit đã đủ. Phân biệt minimality ở cấp unit với các đoạn cần để đủ claim; không xóa qualifier chỉ để ít citation. Controls: đánh giá offered và correct refs theo mục tiêu control; U/O không phát hành answer citation nên có thể ghi NOT_APPLICABLE, kèm lý do. |
| `citationIdentity` | Đúng file, policy/version, paragraph, dòng, quote, checksum và nguồn gốc. Cùng ID hoặc citation hợp lệ không chứng minh hỗ trợ nghĩa. Local anchors không phải runtime chunk/citation IDs. |
| `policyConsistency` | Không mâu thuẫn policy khác, không áp hồi tố hoặc chọn phiên bản có lợi. Intent khác backend capability; không coi UI/SQL hoặc model output là quyền lợi đã duyệt. |
| `qualifiers` | Giữ điều kiện, ngoại lệ, staff verification, uncertainty, timestamp, Reserved/Completed, nghĩa vụ tiền và thuế; xem mandatoryQualifiers/forbiddenInferences, không chỉ expectedAnswer. |
| `arithmetic` | Tự tính lại inputs, VND, HALF_UP, calendar vs working days, giới hạn/các mốc; không dùng kết quả validator làm chứng minh. Không có phép tính thì NOT_APPLICABLE với lý do. |

Mỗi trục dùng `PASS`, `FAIL`, `NOT_REVIEWED` hoặc `NOT_APPLICABLE`. NOT_APPLICABLE cần lý do ở `axisRationales`. Verdict PASS đòi mọi trục đã xem, không có FAIL/NOT_REVIEWED; chỉ answer/citationMinimality/arithmetic được NOT_APPLICABLE khi phù hợp. PASS là nhận xét về record, không tự bật approved/scorable.

Controls C01-P/N–C10-P/N là 20 records cần review riêng. **PASS cho negative control** nghĩa là candidate lỗi được expected decision/reason và evidence nhận diện đúng; không có nghĩa chấp thuận candidate. Không reject toàn bộ controls để báo chất lượng tốt. Không trộn controls vào mẫu natural FAQ accuracy/reliability.

## Phân loại phát hiện và verdict

| Loại lỗi (`issueTypes`) | Cách phân biệt |
| --- | --- |
| `CONTENT` | Expected answer/required meaning sai, thiếu điều kiện, tính sai, tự thêm quyền lợi dù trích đúng tài liệu. Nêu chính xác claim và rule nguồn xung đột. |
| `EVIDENCE` | Đáp án có thể đúng nhưng refs thiếu, dư bắt buộc, binding sai subject/qualifier hoặc provenance sai. Chỉ đề xuất chỉnh refs; không đổi đáp án để vừa citation. |
| `CLASSIFICATION` | A/U/O hoặc expectedReviewDecision không đúng mục tiêu câu hỏi/candidate. Nêu mục tiêu đã/không được giải quyết, không đổi nhãn vì runtime chưa trả được. |
| `FAMILY_OVERLAP` | Cùng evaluated rule/scenario nhưng đang tách family/partition, hoặc shared qualifier bị hiểu sai là target. Cần xem các record liên quan cùng nhau. |
| `SOURCE_IDENTITY` | File/version/checksum/validity không đúng. Dừng kết luận theo baseline lệch; không tự sửa policy. |

Một phát hiện có thể có nhiều loại; mức CRITICAL/MAJOR/MINOR/INFO có thể ghi trong rationale, không thay thế verdict.

| Verdict | Cách dùng |
| --- | --- |
| `PASS` | Đã xem đủ các trục, không có lỗi cần sửa; lý do phải nói nguồn hỗ trợ gì và vì sao sufficiency/minimality/label đúng. |
| `NEEDS_REVISION` | Có sửa đổi cụ thể cần đề xuất hoặc bất đồng chưa giải; ghi lỗi, claim/ref/label liên quan và hướng sửa để người được giao xử lý sau. Không tự sửa Gold. |
| `REJECTED` | Record không phù hợp corpus/scope hoặc không thể dùng làm oracle trong baseline này; ghi lý do loại và bằng chứng. Giữ ID/lịch sử, không xóa. |
| `NOT_REVIEWED` | Chưa xem/hoãn; không phải accept hoặc reject. Khi người review chủ động ghi hoãn vẫn cần danh tính, lý do và timestamp thật. |

## Các điểm F1–F4 phải xác nhận

Nguồn finding là báo cáo **GOLD_SEMANTIC_AUDIT_NEEDS_REVISION** trong hội thoại trước, được định vị trong `manifest.findingsResolution.sourceAudit`; không có file audit độc lập để giả làm bản ký. Báo cáo cũ ghi 93 PASS/7 NEEDS_REVISION, không phải human approval. Ở revision hiện tại, F1–F4 là RESOLVED_PENDING_HUMAN_REVIEW.

| Focus | Records | Câu hỏi bắt buộc cho reviewer |
| --- | --- | --- |
| F1 | H-A09, H-A10, H-A11, H-A14, H-A15, H-A16, H-U03, H-U06, H-U11, H-U12 | H-A11/H-U06 cùng rule chứng cứ thực thu ở POL-05-U02-R1/R4? Toàn bộ workflow/ledger đã cùng family refund-evidence-workflow-ledger và held_out; liệu grouping giữ đúng các biến thể A/U, không che overlap với family khác? |
| F2 | H-A20, H-A21, H-A22, H-A23, H-U08 | H-A23/H-A21/H-U08 cùng first-complete/SLA rule ở POL-09-U02-R2/R3? Cả nhóm complaint-completeness-sla đã cùng held_out; phân biệt mốc nhận, đủ hồ sơ, xử lý và escalation. |
| F3 | H-A13 | POL-08-U02-R3/R4/R5 đã đủ cho toàn bộ answer về partial delivery, thuế, staff eligibility, không tự suy tỷ lệ và không hoàn trùng/quá tiền giữ? POL-05-U03 không còn bắt buộc; không cần thêm unit chỉ vì cùng nói về refund. |
| F4 | H-A22 | POL-09-U03-R4/R5 đã đủ cho no-auto-approval, escalation/người phụ trách/mốc tiếp theo, quyền lợi riêng và không hứa tổng/ngân hàng? POL-09-U01 không còn bắt buộc. |

16 records chịu ảnh hưởng; 9 PASS cũ chỉ đổi family/split metadata liên quan. 84 PASS ngoài phạm vi giữ nguyên, **vẫn phải được human review**, không kế thừa approval từ audit AI.

## Ba shared-context anchors chưa có kết luận human

| Focus | Anchor | Records cần đối chiếu cùng nhau | Điều cần phân xử |
| --- | --- | --- | --- |
| CTX1 | POL-08-U01-R4 | D-U01 (dev), H-U01/H-U10 (held_out) | Cùng điều kiện thiếu thông tin nhưng target fabric list, operating/SLA và delivery evidence có khác thật không? Đọc query/abstention và whole unit; nếu cùng evaluated rule thì nêu FAMILY_OVERLAP. |
| CTX2 | POL-09-U03-R4 | H-A24 (dev), H-A22 (held_out) | No-automatic-benefit qualifier chung hay cùng target? Phân biệt early departure với quá hạn complaint. |
| CTX3 | POL-09-U03-R5 | H-A24 (dev), H-A22 (held_out) | Escalation là target của H-A22 hay cũng là essential target của H-A24? Không tự bỏ ref trong H-A24; giữ nguyên Gold và đề xuất nếu cần. |

Chưa chọn trước “leakage” hay “không leakage”. Trong `focusNotes`, mỗi reviewer ghi kết luận có lý do cho mọi focus gắn trên card của mình, dẫn tới record liên quan. Cùng source anchor không tự chứng minh hai query cùng family, và tên family khác không chứng minh độc lập. Nếu kết luận các card liên quan xung đột, custodian chuyển resolver; không tự báo grouping đã được duyệt.

## Ghi nhận quyết định và lịch sử

Mỗi dòng JSONL là một event độc lập, không sửa/xóa dòng cũ. `stage` là R1, R2 hoặc ADJUDICATION. ID người review, tên hiển thị và `appointmentRef` phải là thông tin thật về người được phân công; không dùng placeholder. Timestamp là ISO-8601 có timezone của lúc quyết định thật, không dùng ngày tạo packet để backdate.

Mẫu **chưa điền quyết định** (không append mẫu này vào log):

```json
{
  "eventId": null,
  "recordId": null,
  "stage": null,
  "reviewer": {"id": null, "displayName": null, "appointmentRef": null},
  "verdict": null,
  "rationale": null,
  "timestamp": null,
  "axes": {
    "query": "NOT_REVIEWED", "answer": "NOT_REVIEWED", "label": "NOT_REVIEWED",
    "evidenceSufficiency": "NOT_REVIEWED", "citationMinimality": "NOT_REVIEWED",
    "citationIdentity": "NOT_REVIEWED", "policyConsistency": "NOT_REVIEWED",
    "qualifiers": "NOT_REVIEWED", "arithmetic": "NOT_REVIEWED"
  },
  "axisRationales": {},
  "evidenceReviewed": [],
  "issueTypes": [],
  "focusNotes": {},
  "supersedes": null,
  "resolves": []
}
```

Sau khi con người điền, lưu draft event ngoài packet rồi chạy:

```powershell
python -B -X utf8 ai-service/tests/evaluation/policy-gold-2026-11-22-v1/human-review/validate.py --prepare-event PATH_TO_HUMAN_EVENT.json
```

Lệnh chỉ đọc, xuất một dòng JSON đã kiểm schema và gắn `schemaVersion`, `packetManifestSha256`, `recordSha256`, `previousEventHash`, `eventHash`. Custodian đối chiếu với bản nộp của người review, sau đó append đúng dòng vào review-events.jsonl và chạy lại check. Không tự động ghi log, chọn verdict, sửa Gold hoặc xác nhận danh tính. Nếu có event khác được append trước, phải prepare lại từ cùng nội dung quyết định; không sửa bằng tay hash để bỏ qua chuỗi.

Đổi ý: append event mới cùng record/stage/reviewer với `supersedes` trỏ tới event hiện hành của slot đó; giữ rationale giải thích thay đổi. Không thay người trong cùng slot một cách âm thầm; đổi phân công cần packet/review session mới có quyết định riêng và giữ log cũ.
ADJUDICATION chỉ sau khi có R1/R2 đã review, `resolves` chứa đúng hai event hiện hành, resolver khác R1/R2, ghi lý do xử lý bất đồng/focus. Review R1/R2 thay đổi thì adjudication cũ không còn hiện hành cho cặp mới.

Validator chỉ tổng hợp trạng thái workflow: NOT_REVIEWED, DISAGREEMENT_PENDING, PAIR_AGREES_* hoặc ADJUDICATED_*. Không ghi verdict tổng hợp vào Gold. Hai PASS hoặc một adjudication PASS vẫn cần người có thẩm quyền ra quyết định Gold riêng; không tự approved/freeze/scorable. Finding chéo nhiều records cần custodian kiểm đồng nhất focusNotes trước khi trình duyệt; schema không phân xử ngữ nghĩa của rationale.

`eventHash` = SHA-256 của event bỏ trường eventHash, JSON UTF-8, sort_keys=true, ensure_ascii=false, separators=(",", ":"). Dòng đầu previousEventHash=null; dòng sau trỏ eventHash ngay trước. Hash phát hiện lệch so với một head đã giữ, **không là chữ ký hoặc bằng chứng danh tính/approval**. Custodian giữ bản nộp gốc và bản sao log + số event + head hash ở nơi do nhóm kiểm soát, chốt biên nhận sau mỗi đợt; giữ các receipt trước để phát hiện viết lại/cắt đuôi. Packet hiện chưa tạo receipt hoặc phân quyền cho một đợt review chưa diễn ra.

## Kiểm tra và giới hạn

Từ repository root:

```powershell
python -B -X utf8 ai-service/tests/evaluation/policy-gold-2026-11-22-v1/validate.py
python -B -X utf8 ai-service/tests/evaluation/policy-gold-2026-11-22-v1/human-review/validate.py
```

Lệnh thứ nhất kiểm Gold hiện có. Lệnh thứ hai kiểm baseline hashes, 100 cards/register, exact record copies, evidence quotes/lines, 38 units/10 publications, F1–F4/CTX placement và log nếu có. Không gọi app/provider/network, không ghi artifact hay cài dependency. Structural PASS không chứng minh semantic correctness, quyền người review hoặc quyết định approval.

Chỉ các file mới trong human-review/ được tạo. Không cập nhật README/manifest/validation cũ hoặc PROCESS/EVALUATION để làm trôi các source pins. Không thêm câu hỏi/đáp án, không sửa policy, không ingestion/indexing/API/DB. Review thật, phân công, adjudication, approval Gold, runtime binding và F5 private evaluation còn là công việc của người được giao.
