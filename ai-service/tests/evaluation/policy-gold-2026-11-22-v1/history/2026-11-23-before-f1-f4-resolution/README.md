# Policy Gold review draft — PBL6 Academic Demo (0.1.1-draft)

Ngày chụp nguồn: **22/11/2026**, UTC+07:00. Trạng thái bộ đánh giá: **draft / pending_review / approved: false**.
Policy nguồn đã được user duyệt và có hiệu lực từ ngày này; approval policy **không** truyền sang Gold, facts hay catalog.
Milestone D1 được user chấp nhận ACCEPTED_WITH_LIMITATIONS ngày 23/11/2026; quality gates chưa được coi là PASS.

- [gold.json](gold.json): 80 câu, không có model output hoặc kết quả retrieval.
- [review-controls.json](review-controls.json): 20 controls có lỗi được tiêm có chủ đích, tách khỏi 80 câu.
- [manifest.json](manifest.json): nguồn/version/SHA-256, 38 unit và 176 paragraph anchors, toàn bộ context.
- [validate.py](validate.py): kiểm tra tĩnh chỉ đọc, thư viện chuẩn Python.
- validation.json: kết quả kiểm tra tĩnh tại thời điểm tạo, không phải semantic approval.

Nguồn nghiệp vụ duy nhất: [policy gốc](../../../knowledge/policies/academic-demo-hotel-policies.md) và 10 publication approved, effective.
[Traceability nội bộ](../../../knowledge/policies/publication-draft-review.md) dùng làm bản đồ nguồn, không làm oracle semantic.
Đã đọc [PROCESS](../../../docs/PROCESS.md), [EVALUATION](../../../docs/EVALUATION.md) và convention evaluation.
SQL, mobile, backend/frontend, FAQ cũ chưa approved, fake-provider fixtures, model answer, retrieval top-k,
offered facts, QuestionBinding và renderer không được dùng để quyết định đáp án.

## Cơ cấu và phân chia

| Loại | Dev | Held-out candidate | Tổng |
| --- | ---: | ---: | ---: |
| A — answerable | 24 | 24 | 48 |
| U — insufficient_evidence | 12 | 12 | 24 |
| O — capability_unavailable | 4 | 4 | 8 |
| Tổng | 40 | 40 | 80 |

A: 16 direct, 16 paraphrase/mất dấu, 8 multi-claim, 8 exception/qualifier/time-sensitive.
U: 8 ngoài thông tin nguồn, 8 thiếu điều kiện/không rõ, 8 tiền đề không hỗ trợ kèm đích cần trả lời còn thiếu.
U strata cân mỗi split; A multi/exception hiện dev 5/3 và held-out 3/5, chờ human review; global strata giữ nguyên. O là yêu cầu thực hiện/tra cứu nghiệp vụ, khác câu hỏi policy giả định.
80 query có ID riêng, 33 decision families; 72 đoạn requiredMeaning đề xuất **không phải** 72 atomic facts đã duyệt.
Evidence/context references bao phủ 10 nhóm policy và cả 38 unit; không đồng nghĩa bao phủ mọi nhánh hoặc câu hỏi.

Các biến thể cùng family/rule/scenario group ở cùng split; xem revision notes và split field trong JSON. Sources và background qualifiers có thể dùng ở cả hai split. Shared context được liệt kê REVIEW_REQUIRED, không coi family IDs rời nhau là chứng minh semantic independence.

**Held-out chưa blind, chưa freeze, chưa đủ độc lập để dùng nghiệm thu.** Cùng AI soạn cả hai split và
các query đã được phơi bày trong workspace. Cần evaluator độc lập rà soát/viết lại phần held-out sau khi
catalog/rules đã freeze; nhóm tuning không dùng phần này để thêm aliases rồi báo điểm held-out tăng.
Nếu sử dụng bản này để tuning, phải thay held-out trước đánh giá blind. Độc lập hiện tại chỉ có nghĩa
oracle được dựng từ toàn bộ nguồn, không từ output của hệ thống; chưa có review độc lập của con người.

## Contract evidence và expected behavior

Mỗi case có query, family, topic/risk, split, A/U/O, expectedStatus/Behavior, asOfDate/timezone,
required meanings, mandatory qualifiers, forbidden inferences, source versions và reviewer decisions.
Requester mặc định là guest, public FAQ, không có quyền truy cập nghiệp vụ qua chat.

- A có expectedAnswer và proposed acceptableMinimalEvidenceSets. ExpectedAnswer là rubric ngữ nghĩa,
  không yêu cầu so khớp nguyên văn. Các phần requiredMeanings đều phải đúng và có evidence hỗ trợ;
  không được tự bỏ câu khó để báo coverage đủ. Binding/minimality là đề xuất chờ review.
- U có expectedAnswer=null, lý do thiếu, lời abstention và contextEvidenceRefs riêng. Các refs này chỉ
  chỉ ra ranh giới/qualifier, không chứng minh giá trị đang thiếu. Có thể bác tiền đề bằng nguồn,
  nhưng không vì vậy tự điền số tiền, ngày, người hoặc quyền lợi chưa biết.
- O có capability_unavailable; scope basis là EVALUATION/PROCESS đã pin hash, không phải hotel facts.
  Không giả lập việc tạo/hủy booking, trả tiền, gửi hoàn, đặt dịch vụ hay tra cứu riêng đã thành công.
- Local anchor POL-xx-Uyy-Rn xác định đúng bullet, đường dẫn, dòng, quote và SHA trong manifest.
  Unit full content giữ preamble và điều kiện liên quan; originalSourceRanges trỏ về policy gốc
  với original SHA, không tự chứng minh semantic support.
- Runtime snapshotId/chunkId/citationId và catalogPublicationId để null vì chưa ingestion/bind.
  Không coi local anchors là IDs đã được Qdrant/gate phát hành. Sau ingestion được giao riêng,
  phải bind vào actual IDs bằng source identity/hash, không nhìn rank/model answer để sửa gold.
- Cases tính tiền dùng dữ kiện minh họa ghi rõ trong query, không tạo giá hoặc chứng từ khách sạn.
  calculationCheck ghi input và output số học; các field không có trong input không được suy thêm.
  Các ngày tương lai là hypothetical với điều kiện cùng policy được áp dụng; không cam kết
  booking tương lai đã có policy binding. Cọc/hoàn thật vẫn cần staff verification.
- Source đủ evidence thì nhãn vẫn A dù runtime chưa có alias/fact, không hỗ trợ VND/%/working-days
  hoặc retrieval không lấy đủ context. Giới hạn hiện tại không được dùng đổi A thành U.

## Coverage và khoảng trống

Manifest giữ 38 unit với 176 paragraph và hash; references của 80 cases chạm đủ 38 unit.
Các câu trực tiếp kiểm tra admission; strict deadline; chứng cứ thanh toán; amendment lifecycle,
cọc khả dụng/dư; A_room/A_other/A_bill, tax/Bill; trẻ sơ sinh/capacity/tuổi;
early/late thresholds; lịch hủy; valid event vs processing; no-show; ledger; partial service;
refund evidence/workflow; pet exceptions; complaint clocks/checklist; privacy/log/backup/restore.

Việc chạm một unit bằng context U hoặc supporting qualifier không chứng minh đã kiểm tra mọi rule
trong unit. Chưa cam kết đầy đủ mọi kiểu tiền âm/rounding boundary, mọi tổ hợp Reserved, ngày sinh
29/02, mọi loại service, các ngoại lệ manager duyệt, bản policy bị thay thế, mọi câu diễn đạt khách thực.
Không tự tạo policy revision/conflict làm natural Gold khi approved corpus chưa có. Các thiếu hụt
được human reviewer ưu tiên bổ sung nếu thuộc scope; không padding bằng câu trùng.

## Controls riêng

10 cặp positive/negative: polarity; availability/consent qualifier; strict deadline; calendar vs hours;
room discount allocation; Reserved money; uncollected quote; package vs Kg; đúng cấu trúc citation
nhưng sai question/subject; renderer dùng stale wording. C09 giữ cùng câu/số tiền nhưng đổi evidence
ở negative control để phát hiện citation-support failure. C10 chỉ tiêm câu stale, không tạo lịch sử
policy revision giả. Controls là calibration công khai, không phải blind test hoặc counterexample mới
đóng G20. accept_supported/reject_unsupported là expected review decision, không dự đoán gate hiện tại.

Không trộn 20 controls vào denominator answer correctness, unsafe rate, false acceptance, reliability
hoặc latency của 80 FAQ. Không tạo production facts/catalog từ các controls.

## Human review và rubric

Mọi 80 cases và 20 controls đều **pending_review / approved:false / scorable:false**.
Hai independent reviewers và disagreement resolver chưa được chỉ định (null); không tự điền tên.
User đã duyệt policy, chưa duyệt bộ Gold này. Mỗi người cần review riêng trước khi xem ý kiến nhau:

1. Đọc toàn bộ approved policy và các ranges nguồn, không chỉ expectedAnswer/trace report.
2. Xác nhận label, question binding, các nghĩa bắt buộc, qualifier, phạm vi, ngày/đơn vị và phép tính.
3. Citation identity: đúng document/policy version/unit/quote/hash. Citation support: từng claim có
   được evidence chứng minh, có dùng đúng subject/qualifier, không chỉ trùng từ hoặc số.
4. Kiểm A đủ bằng chứng cho toàn câu; U thực sự thiếu đích trả lời, không chỉ câu hỏi phủ định;
   O thực sự yêu cầu capability, không phải FAQ có đáp án.
5. Kiểm minimal evidence sets và family leakage; đánh dấu accepted/rejected/unresolved kèm lý do,
   reviewer ID, thời điểm và source hashes. Không đủ reviewer hoặc còn bất đồng thì unscorable.
6. Resolver xử lý bất đồng bằng nguồn và quyết định có căn cứ, không dùng LLM self-review làm oracle.
   Sau đó nhóm dự án ký dataset/scope/split và freeze; chưa chạy measured/live ở bước này.

Sau human approval mới dùng rubric để chấm riêng: answer correctness; citation identity; citation
support từng claim; question/required-meaning coverage; abstention/capability. A trả lời một phần
không được complete-correct; U từ chối đích thiếu nhưng có giải thích đúng không thành false acceptance.

Đề xuất báo false acceptance theo U/O khi phát hành câu trả lời/quyền lợi hoặc action không đủ nguồn;
đồng thời báo unsupported/wrong claims trong các câu A (unsafe answer trên toàn bộ eligible turns).
False abstention = A bị trả insufficient_evidence/capability_unavailable do hệ thống không đáp ứng.
Nêu rõ denominator, counts và rubric; không gộp dependency/protocol/deadline thành semantic abstention.
Unknown/unreviewed = unscorable, không tự bỏ khỏi báo cáo hoặc coi là PASS.
Retrieval recall/citation/coverage và safety phải đo riêng sau khi binding thật. Không có score,
latency, cost, reliability hoặc bằng chứng live mới trong artifact này; thresholds/budget cần ký riêng.

## Kiểm tra tĩnh và giới hạn

Chạy từ root repository:

```powershell
python -B -X utf8 ai-service/tests/evaluation/policy-gold-2026-11-22-v1/validate.py
```

Validator chỉ đọc JSON/Markdown/source/Git; không import application, không chạy ingestion hoặc provider,
không ghi file. validation.json là output được ghi ở lần chuẩn bị này. Kiểm SHA/metadata/date,
source anchors/line ranges, 38 body units bất biến, counts/splits/family IDs, exact/normalized duplicate,
các cặp controls và phép tính bằng Decimal/date. Near-duplicate flags chỉ là gợi ý review;
semantic equivalence/support/absence và family independence **NOT VERIFIED by static checks**.

Hiệu lực dùng YAML ISO date không có dấu ngoặc kép để yaml.safe_load trả date như contract hiện tại.
Chỉ activation metadata và thông báo hiệu lực được cập nhật; nội dung 38 publication units nguyên vẹn.
Allowlist/runtime không đổi. Source provenance vẫn synthetic; không biến thành khách sạn thật.
Milestone D1 ACCEPTED_WITH_LIMITATIONS theo user; Gold/live/reliability quality gates vẫn mở. Không ingestion, embedding, Qdrant, Gemini, DB hoặc live evaluation.


## Review revision 0.1.1-draft — 23/11/2026

Trạng thái hiện tại: **GOLD_REVIEW_UPDATED / pending_review / approved:false**.
Cả 100 records đều có reviewDisposition=REVIEW_REQUIRED, không có independent human approval.
Đây là cập nhật bản nháp; không approve, freeze hoặc blind held-out.

### Thay đổi có thể truy vết

- Bản trước sửa được lưu nguyên bytes tại [history/2026-11-23-before-review-update](history/2026-11-23-before-review-update/receipt.json),
  gồm sáu file cũ và validation.json cũ; receipt chứa SHA-256 từng file. Không sửa kết quả evaluation lịch sử.
- Chỉ hai source/reference documents PROCESS.md/EVALUATION.md được re-pin hash và line count
  theo decision 23/11. ScopeBasis của tám O cases được đồng bộ hash tương ứng; không đổi capability scope.
  Mọi policy/traceability/source-unit hash, version, approval, validity và runtime binding giữ nguyên.
- Không thêm hoặc xóa case; không sửa query, expected answer, required-meaning text, label,
  abstention reason hoặc candidate/expected decision của controls. Root manifest lưu before/after và ID moves.
- 16 case chuyển split theo sáu whole families. D/H trong case ID là nguồn gốc, **split** mới là giá trị có hiệu lực.
  Coupled rule groups cho cancellation, amendment và refund procedure được kiểm thêm để không chỉ dựa vào tên family.
  Những groups này và scenario families không bị tách; semantic independence vẫn cần human review.

| Whole family | Từ → sang | Case IDs |
| --- | --- | --- |
| booking-hold-proof | dev → held_out | D-A04–D-A07 |
| guest-capacity | dev → held_out | D-A17, D-U12 |
| privacy-boundary | dev → held_out | D-A24, D-U02 |
| refund-workflow | held_out → dev | H-A11, H-A14–H-A16, H-U03, H-U12 |
| complaint-evidence | held_out → dev | H-A23 |
| early-departure | held_out → dev | H-A24 |

Mỗi split vẫn 40 câu: 24 A/12 U/4 O. Cơ cấu A tổng vẫn 16 direct/16 paraphrase/8 multi/8 exception.
Dev A: 8 direct/8 paraphrase/**5 multi/3 exception**; held-out A: 8/8/**3/5**.
U mỗi split vẫn 4 outside-source/4 partial/4 leading. Phân bố multi/exception mới
**REVIEW_REQUIRED**: giữ nguyên semantic families được ưu tiên hơn cố chia câu cho đẹp quota;
đây không phải thay threshold acceptance hoặc giả quyết định sampling đã được ký.

### Coverage của held-out: câu hỏi chính, không chỉ refs phụ

| Domain bổ sung | Cases held_out có sẵn được đưa sang | Approved evidence |
| --- | --- | --- |
| Booking | D-A04, D-A07 | POL-01-U02: strict-before hold, reconciled proof, không auto restore |
| Deposit/payment | D-A05, D-A06 | POL-03-U01: event time, cọc 0/manual, không suy payment status |
| Children/guests | D-A17; D-U12 kiểm thiếu quote | POL-06-U01: infant capacity, không trả phí để vượt chỗ |
| Privacy | D-A24; D-U02 kiểm contact chưa biết | POL-10-U01/U04: protected access, không dùng PII/secrets làm FAQ, staff handling |

Held-out hiện có A primary target ở đủ POL-01–POL-10, không chỉ có một citation phụ về topic.
Toàn dataset giữ 38 unit/176 paragraph references; dev refs 20 units/7 topics và held-out refs
23 units/10 topics. Dev không phủ POL-02/04/07 là giới hạn sampling phải nêu; không tự gọi mọi rule,
exception, paraphrase hoặc risk combination đã được bao phủ. Không tạo câu trùng hoặc facts mới.

### Bốn evidence sets được tinh gọn

Dấu OR dưới đây nghĩa là mỗi bộ độc lập đủ cho toàn answer, không bắt retrieval trả tất cả các bộ.

| Case | Acceptable alternatives sau sửa | Số source units cần cho mỗi bộ |
| --- | --- | ---: |
| D-A03 | POL-01-U01-R3 OR POL-01-U03-R1 | 1 OR 1 |
| D-A04 | POL-01-U02-R2/R3/R4 OR POL-05-U05-R1/R2 | 1 OR 1 |
| H-A03 | (POL-02-U01-R2/R4 + POL-02-U02-R3/R4) OR (POL-02-U04-R1/R2 + POL-02-U02-R3/R4) | 2 OR 2 |
| H-A14 | POL-05-U04-R5 | 1 |

D-A03 giữ no-24/7, sau22 cần thỏa thuận và same-day staff.
D-A04 giữ strict deadline, receipt verification, hoàn khoản chưa phân bổ và không tự khôi phục;
chứng cứ đến muộn không được dùng giờ xử lý thay event time.
H-A03 giữ consent/availability/staff, thiếu giá chưa chốt và không cộng extra-night + fee cùng thời gian.
H-A14 giữ gửi khác nhận và không có tổng/bank SLA để hứa ngày về.
Các alternatives được dựng từ nguồn trước retrieval, không từ rank/model output; minimality
và claim-evidence entailment vẫn **pending human review**. proposedSupportAlternatives được đồng bộ
với complete-answer sets; không biến các alternatives thành các citation bắt buộc đồng thời.

### Kết quả theo từng record và blockers

[validation.json](validation.json) có 100 recordResults: expected answer/claims, source identity/version,
arithmetic/date nếu áp dụng, abstention, duplicate/overlap, split và lý do cần human review.
AI_AUTHOR_PRE_REVIEW không phải reviewer độc lập; STATIC_PASS chỉ nói về kiểm tĩnh.
Controls negative cố tình sai nên không được diễn giải staticResult PASS là candidate đã đúng.

Các blocker còn mở:

1. Hai human reviewers độc lập và disagreement resolver chưa được chỉ định; toàn bộ 100 records chưa approve.
   Cần ký từng claim/qualifier, minimal alternatives, source interpretation và U/O intent; bất đồng = unscorable.
2. Held-out cùng AI viết và đã lộ; chưa blind/freeze. Không tuyên bố đạt independent benchmark;
   evaluator độc lập phải quyết định giữ/viết lại/thay queries sau khi catalog/rules được freeze riêng.
3. Human cần chốt phân bố strata mới và dev topic gaps. Topic coverage không chứng minh đủ mọi scenario.
4. Bảy shared source anchors qua split ảnh hưởng 11 records được liệt kê trong manifest/report:
   POL-05-U02-R1/R4; POL-08-U01-R4; POL-09-U02-R2/R3; POL-09-U03-R4/R5.
   Human phải so đúng target/required meanings để phân biệt shared safeguard/qualifier với cùng rule.
   Nếu là cùng evaluated rule, gộp whole families và phân lại split trước freeze; không gọi semantic overlap bằng 0.
5. Local evidence IDs chưa bind actual runtime snapshot/chunk/citation/catalog. Không ingestion ở đây.
   D1.15/live/reliability vẫn chưa có bằng chứng khắc phục; milestone acceptance không làm quality gates PASS.

Ưu tiên U/O adjudication: D-U09, D-U12, H-U09, H-U12. Những câu này hỏi hypothetical missing target;
đổi sang truy vấn tài khoản/giá live hay thực hiện action thì O. Các U khác vẫn cần xác nhận rằng
nguồn thật sự thiếu đích trả lời, không chỉ là câu phủ định có thể bác bằng policy.
Twenty controls vẫn calibration biết trước, không dùng cho blind metrics hoặc trộn mẫu số 80 FAQ.

### Danh sách human review hiện hành

Mỗi dòng bên dưới còn **REVIEW_REQUIRED / pending_review / approved:false / scorable:false**.
Validation tĩnh không thay quyết định người review. Mở gold.json/review-controls.json để đọc nguyên
query, answer, qualifiers và evidence; ghi decision/reason/time/reviewer/source hashes khi được giao review.

| ID | Current split | Label / expected control decision | Family | Review status | Source-review focus |
| --- | --- | --- | --- | --- | --- |
| D-A01 | dev | A | booking-admission | REVIEW_REQUIRED | Ngày đến trước ngày tạo bị từ chối theo POL-01-U01-R1; không suy nhận cùng ngày thành booking thông thường. |
| D-A02 | dev | A | booking-admission | REVIEW_REQUIRED | Cùng ngày/walk-in cần staff xác nhận giờ, phòng, quote và payment; không dùng 22:00 làm guarantee. |
| D-A03 | dev | A | booking-admission | REVIEW_REQUIRED | Mỗi alternative độc lập có after-22 agreement, không 24/7 và same-day staff confirmation; không buộc cả hai unit. |
| D-A04 | held_out | A | booking-hold-proof | REVIEW_REQUIRED | Mỗi alternative có deadline strict-before + xử lý khoản chưa phân bổ; không auto-restore. Staff verification vẫn bắt buộc. |
| D-A05 | held_out | A | booking-hold-proof | REVIEW_REQUIRED | 10:14 là event time của khoản cần cuối, không dùng processing 10:20; late evidence cần đối soát. |
| D-A06 | held_out | A | booking-hold-proof | REVIEW_REQUIRED | Cọc tròn về 0 không đòi giao dịch 0, cần staff và vẫn có thể còn thuế/dịch vụ. |
| D-A07 | held_out | A | booking-hold-proof | REVIEW_REQUIRED | Ảnh/chát không đủ receipt/room hold proof; không tự phục hồi hoặc cấp trùng phòng. |
| D-A08 | dev | A | amendment-lifecycle | REVIEW_REQUIRED | Quote hết hạn chỉ bỏ amendment, gốc vẫn chịu điều kiện riêng; tiền bổ sung chưa áp dụng cần verify trước hoàn. |
| D-A09 | dev | A | amendment-lifecycle | REVIEW_REQUIRED | Phải accept đúng quote revision và đủ tiền trước expiry, bằng hạn quá hạn; không đổi gốc khi chưa đủ. |
| D-A10 | dev | A | amendment-lifecycle | REVIEW_REQUIRED | Pending amendment dùng thông số gốc khi hủy; dùng valid receipt timestamp và không hai cancellation fees. |
| D-A11 | dev | A | amendment-finance | REVIEW_REQUIRED | 510000−Reserved300000=210000 available; new255000 cần45000. Không tái dùng phần đã hoàn/reserved. |
| D-A12 | dev | A | amendment-finance | REVIEW_REQUIRED | R850000 => new255000, excess255000; ghi choice trước hiệu lực, thực hiện sau, missing/conflict chuyển staff. |
| D-A13 | dev | A | amendment-finance | REVIEW_REQUIRED | R2550000 => new765000, available510000 => thêm255000; giữ strict quote deadline, không thu cọc lần hai. |
| D-A14 | dev | A | invoice-discount-scope | REVIEW_REQUIRED | A_room60000, A_other40000: cọc492000; không trừ A_bill100000 cho công thức cọc. |
| D-A15 | dev | A | invoice-discount-scope | REVIEW_REQUIRED | A_room=A_bill100000 trong ví dụ; tax206000, Bill2166000, cọc480000, balance1686000; không live/legal tax. |
| D-A16 | dev | A | invoice-discount-scope | REVIEW_REQUIRED | Advance vượt cọc khác final overpayment; giữ advance cần consent; actual P và Bill phải đối soát. |
| D-A17 | held_out | A | guest-capacity | REVIEW_REQUIRED | Infant là một chỗ; Standard2 không nhận3 bằng phụ phí; Suite3 capacity không chứng minh availability. |
| D-A18 | dev | A | guest-age | REVIEW_REQUIRED | Sinh05/12/2008 đạt18 tại10/12/2026; không loại vì tuổi ngày đặt, vẫn kiểm điều kiện khác. |
| D-A19 | dev | A | guest-age | REVIEW_REQUIRED | Đổi ngày thực nhận04/12/2026 còn17; cần giám hộ có căn cứ, không suy quan hệ pháp lý. |
| D-A20 | dev | A | service-identity | REVIEW_REQUIRED | Laundry theo package, 2×120000 +24000 tax=264000 minh họa; không Kg hoặc live quote. |
| D-A21 | dev | A | service-identity | REVIEW_REQUIRED | In-stay service cần check-in, Airport Transfer trước đó là staff riêng; catalogue/rights/price vẫn phải rõ. |
| D-A22 | dev | A | privacy-retention | REVIEW_REQUIRED | Log và copy cùng expiry15/12 10:00 từ01/12; không reset/30-day extension trừ ngoại lệ log riêng. |
| D-A23 | dev | A | privacy-retention | REVIEW_REQUIRED | Restore min(original expiry,created+24h); backup không log end09/01/2027; không revive log hay hứa automation. |
| D-A24 | held_out | A | privacy-boundary | REVIEW_REQUIRED | Chỉ fake data; không gửi JWT/PII vào corpus/model/log; protected ownership và còn backup thì chưa xóa hết. |
| D-O01 | dev | O | tool-live-price | REVIEW_REQUIRED | Actual live lookup/action requires unavailable D1 capability; no hotel facts or fake tool execution. D1 is a read-only FAQ scope; business tools and protected private-data access are not implemented. |
| D-O02 | dev | O | tool-live-availability | REVIEW_REQUIRED | Actual live lookup/action requires unavailable D1 capability; no hotel facts or fake tool execution. D1 is a read-only FAQ scope; business tools and protected private-data access are not implemented. |
| D-O03 | dev | O | tool-create-booking | REVIEW_REQUIRED | Actual live lookup/action requires unavailable D1 capability; no hotel facts or fake tool execution. D1 is a read-only FAQ scope; business tools and protected private-data access are not implemented. |
| D-O04 | dev | O | tool-pay-deposit | REVIEW_REQUIRED | Actual live lookup/action requires unavailable D1 capability; no hotel facts or fake tool execution. D1 is a read-only FAQ scope; business tools and protected private-data access are not implemented. |
| D-U01 | dev | U | service-identity | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Không có danh sách chất liệu được nhận/loại trừ; tên gói và đơn vị không xác định điều kiện đó. |
| D-U02 | held_out | U | privacy-boundary | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Nguồn chỉ nói nhóm dự án/xác minh quyền, không định danh người hay email. |
| D-U03 | dev | U | amendment-lifecycle | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Không có quy tắc chuyển người đại diện hay cutoff; không suy từ sửa ngày/phòng/giá. |
| D-U04 | dev | U | hotel-identity | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Toàn bộ corpus policy approved không định nghĩa địa chỉ hay hạng sao; không lấy SQL/mobile/tài liệu chưa approved để điền. |
| D-U05 | dev | U | invoice-discount-scope | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Thiếu A_room; nếu toàn bộ giảm phòng thì 480.000, nếu không có giảm phòng thì 510.000; chưa thể chọn số cuối. |
| D-U06 | dev | U | amendment-finance | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Thiếu D_held khả dụng sau khoản Reserved/đã hoàn; tổng giữ không đủ để suy số phải bổ sung. |
| D-U07 | dev | U | booking-admission | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Không có cutoff cố định hay xác nhận tiếp nhận cho tình huống; không lấy 22:00 làm bảo đảm. |
| D-U08 | dev | U | guest-age | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Thiếu ngày sinh đầy đủ; năm sinh không đủ xác định số năm tròn tại ngày nhận, không tự suy giám hộ. |
| D-U09 | dev | U | service-entitlements | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Không có bằng chứng entitlement hay định mức Pearl trong approved policy; không chấp nhận tiền đề và không tạo số suất. |
| D-U10 | dev | U | service-entitlements | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Không có entitlement hay danh sách món minibar miễn phí; không biến tiền đề thành quyền lợi. |
| D-U11 | dev | U | privacy-retention | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Mốc sao chép không thay mốc kết thúc demo; thiếu ngày kết thúc nên không có lịch xóa cụ thể. |
| D-U12 | held_out | U | guest-capacity | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Không được trả phí để vượt chỗ; không có báo giá/phòng còn cho phương án thay thế nên không chốt giá. Đây là bài toán policy giả định, không yêu cầu tra giá live. |
| H-A01 | held_out | A | early-late-fees | REVIEW_REQUIRED | 09:59=50%,10:00=30% B_first850000 =>425000/255000 trước thuế, có consent/availability. |
| H-A02 | held_out | A | early-late-fees | REVIEW_REQUIRED | 15:00=30%,15:01=50% B_last850000 =>255000/425000; không dùng giá catalogue/voucher lần hai. |
| H-A03 | held_out | A | early-late-fees | REVIEW_REQUIRED | Hai alternatives mỗi set chỉ cần một nguồn early + nguồn late; không stack extra-night và fee cùng thời gian. |
| H-A04 | held_out | A | early-late-fees | REVIEW_REQUIRED | Tỷ lệ fee không cấp quyền early/late; consent/staff supply cần rõ, không tự phạt nếu chưa duyệt. |
| H-A05 | held_out | A | fee-refund-eligibility | REVIEW_REQUIRED | Prepaid unused fee255000+tax25500=280500 đủ điều kiện sau verify; không room penalty/double tax/refund. |
| H-A06 | held_out | A | cancellation-calendar | REVIEW_REQUIRED | Calendar d>=3/1–2/<=0 áp100/50/0% effective deposit, không rolling hours hoặc total payment. |
| H-A07 | held_out | A | cancellation-valid-event | REVIEW_REQUIRED | Valid received07/12 23:59, arrival10/12 =>d3 despite processing08/12; quyền/receipt phải có. |
| H-A08 | held_out | A | cancellation-valid-event | REVIEW_REQUIRED | Tin chưa hợp lệ không backdate; valid08/12 =>d2, rate50 nếu đúng confirmed/pre-check-in scope. |
| H-A09 | held_out | A | refund-ledger | REVIEW_REQUIRED | D600000,P02200000,d2 =>H300000,F300000,room1900000; không phải all-service total refund. |
| H-A10 | held_out | A | refund-ledger | REVIEW_REQUIRED | P0/C0/E0/U0 rời nhau và verified; T824500, completed100000,reserved200000 =>new524500. |
| H-A11 | dev | A | refund-workflow | REVIEW_REQUIRED | Missing refund evidence => pending information, owner/update; first-complete timestamp staff ghi, chưa hứa tiền. |
| H-A12 | held_out | A | no-show | REVIEW_REQUIRED | No valid late agreement và chưa check-in =>00 ngày sau; cap effective deposit, không double penalty/unused-night charge. |
| H-A13 | held_out | A | service-delivery-refund | REVIEW_REQUIRED | Partially delivered không tự 50% theo phút; staff xác nhận phần chưa cung cấp/tax và tránh refund trùng. |
| H-A14 | dev | A | refund-workflow | REVIEW_REQUIRED | POL-05-U04-R5 độc lập phân biệt kiểm/duyệt/gửi/ngân hàng và không bank SLA; SENT không received. |
| H-A15 | dev | A | refund-workflow | REVIEW_REQUIRED | 500000−200000−Reserved300000=0 new instruction; chưa chứng minh fail thì chưa release reserve. |
| H-A16 | dev | A | refund-workflow | REVIEW_REQUIRED | Chỉ cash via verified channel trong scope; không voucher/points hay double retention/refund entitlement. |
| H-A17 | held_out | A | pet-exceptions | REVIEW_REQUIRED | Pet mặc định no, không automatic size/payment exception; managerial approval gắn booking/version. |
| H-A18 | held_out | A | pet-exceptions | REVIEW_REQUIRED | Assistance animal cần manager trước confirmation; hư cấu không xác nhận legal compliance. |
| H-A19 | held_out | A | pet-exceptions | REVIEW_REQUIRED | Hotel confirmed nhầm pet cần manager verify supply failure, unused accommodation paid refund no F; used service tách. |
| H-A20 | held_out | A | complaint-clock | REVIEW_REQUIRED | Complaint receipt starts24h/3working-day goals cả hồ sơ thiếu; safety ngay, lịch demo Mon–Fri. |
| H-A21 | held_out | A | complaint-clock | REVIEW_REQUIRED | First-complete14/12 =>day7 là23/12 end local day; không dùng received11/12 hoặc reset processing. |
| H-A22 | held_out | A | complaint-clock | REVIEW_REQUIRED | Late complaint/update =>escalate, thông báo người/mốc; không auto compensation/approval/bank guarantee. |
| H-A23 | dev | A | complaint-evidence | REVIEW_REQUIRED | Complaint money checklist và first complete staff; refund check3/send5 từ hai mốc riêng, không total3+5. |
| H-A24 | dev | A | early-departure | REVIEW_REQUIRED | Personal early departure không auto refund; hotel unused supply failure cần manager verify, services separate/no extra rights. |
| H-O01 | held_out | O | tool-private-booking | REVIEW_REQUIRED | Actual live lookup/action requires unavailable D1 capability; no hotel facts or fake tool execution. D1 is a read-only FAQ scope; business tools and protected private-data access are not implemented. |
| H-O02 | held_out | O | tool-cancel-booking | REVIEW_REQUIRED | Actual live lookup/action requires unavailable D1 capability; no hotel facts or fake tool execution. D1 is a read-only FAQ scope; business tools and protected private-data access are not implemented. |
| H-O03 | held_out | O | tool-execute-refund | REVIEW_REQUIRED | Actual live lookup/action requires unavailable D1 capability; no hotel facts or fake tool execution. D1 is a read-only FAQ scope; business tools and protected private-data access are not implemented. |
| H-O04 | held_out | O | tool-order-service | REVIEW_REQUIRED | Actual live lookup/action requires unavailable D1 capability; no hotel facts or fake tool execution. D1 is a read-only FAQ scope; business tools and protected private-data access are not implemented. |
| H-U01 | held_out | U | service-delivery-refund | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Tên Spa/Express không xác định giờ mở cửa hoặc SLA; cần nhân viên xác nhận. |
| H-U02 | held_out | U | hotel-house-rules | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Corpus policy approved không định nghĩa khu hút thuốc hay phí; không tự bổ sung house rules. |
| H-U03 | dev | U | refund-workflow | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Không có thời hạn mục tiêu phê duyệt/ngày duyệt dự kiến; 3 ngày kiểm tra và 5 ngày gửi không xác định ngày đó. |
| H-U04 | held_out | U | pet-exceptions | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Không có bảng phí pet; không suy phí từ ngoại lệ nhận pet hoặc danh mục dịch vụ. |
| H-U05 | held_out | U | fee-refund-eligibility | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Thiếu phần chưa cung cấp đủ điều kiện và phân bổ thuế; không chia đều theo giờ hay hoàn toàn bộ mặc định. |
| H-U06 | held_out | U | refund-ledger | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Chưa biết tiền thực nhận/còn giữ P0/C0/E0/U0, Reserved/đã hoàn; cọc yêu cầu và trạng thái không chứng minh thực thu. |
| H-U07 | held_out | U | cancellation-valid-event | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Thiếu mốc hủy hợp lệ đáng tin, chứng từ tiền và phiên bản; không tự dùng ngày tin nhắn hoặc giờ xử lý. |
| H-U08 | held_out | U | complaint-clock | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Thiếu information_completed_at được xác nhận; không lấy ngày nhận làm mốc 7 ngày hoặc backdate. |
| H-U09 | held_out | U | pet-exceptions | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Không có chấp thuận/điều kiện ghi nhận; kích thước hoặc tiền thêm không tự cấp phép, phải chuyển nhân viên. |
| H-U10 | held_out | U | service-delivery-refund | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: Tên dịch vụ không chứng minh thực hiện; thiếu chứng cứ sử dụng và điều kiện chia phần, không tự suy tỷ lệ. |
| H-U11 | held_out | U | refund-ledger | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: 100% phần cọc không có nghĩa hoàn dịch vụ đã dùng; thiếu phân bổ/eligibility/thuế và lịch sử lệnh nên không chốt tổng. |
| H-U12 | dev | U | refund-workflow | REVIEW_REQUIRED | Unresolved target, not simply negative phrasing: SENT không chứng minh đã nhận, không có SLA ngân hàng/arrival evidence nên không thể nêu ngày chắc chắn. |
| C01-P | calibration_only | accept_supported | C01 | REVIEW_REQUIRED | polarity: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C01-N | calibration_only | reject_unsupported | C01 | REVIEW_REQUIRED | polarity: Đảo phủ định và bỏ điều kiện ngoại lệ. |
| C02-P | calibration_only | accept_supported | C02 | REVIEW_REQUIRED | essential_qualifier: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C02-N | calibration_only | reject_unsupported | C02 | REVIEW_REQUIRED | essential_qualifier: Bỏ điều kiện đồng ý/khả năng cung cấp, biến phí thành entitlement. |
| C03-P | calibration_only | accept_supported | C03 | REVIEW_REQUIRED | deadline_boundary: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C03-N | calibration_only | reject_unsupported | C03 | REVIEW_REQUIRED | deadline_boundary: Đổi điều kiện strict-before thành inclusive. |
| C04-P | calibration_only | accept_supported | C04 | REVIEW_REQUIRED | calendar_vs_duration: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C04-N | calibration_only | reject_unsupported | C04 | REVIEW_REQUIRED | calendar_vs_duration: Đổi ngày lịch sang rolling-hours làm sai nhóm hoàn. |
| C05-P | calibration_only | accept_supported | C05 | REVIEW_REQUIRED | discount_allocation: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C05-N | calibration_only | reject_unsupported | C05 | REVIEW_REQUIRED | discount_allocation: Dùng discount sai scope dù công thức 30% đúng. |
| C06-P | calibration_only | accept_supported | C06 | REVIEW_REQUIRED | reserved_money: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C06-N | calibration_only | reject_unsupported | C06 | REVIEW_REQUIRED | reserved_money: Tái dùng tiền đã dành cho lệnh khác. |
| C07-P | calibration_only | accept_supported | C07 | REVIEW_REQUIRED | uncollected_quote: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C07-N | calibration_only | reject_unsupported | C07 | REVIEW_REQUIRED | uncollected_quote: Tạo quyền hoàn từ báo giá chưa thu, cộng thuế chưa thu. |
| C08-P | calibration_only | accept_supported | C08 | REVIEW_REQUIRED | unit_subject: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C08-N | calibration_only | reject_unsupported | C08 | REVIEW_REQUIRED | unit_subject: Đổi đơn vị package sang Kg, nhân sai subject/quantity. |
| C09-P | calibration_only | accept_supported | C09 | REVIEW_REQUIRED | citation_question_binding: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C09-N | calibration_only | reject_unsupported | C09 | REVIEW_REQUIRED | citation_question_binding: Câu chữ/số tiền đúng nhưng citation sai: trích POL-02-U02 về trả muộn/giá đêm cuối, không hỗ trợ nhận sớm. |
| C10-P | calibration_only | accept_supported | C10 | REVIEW_REQUIRED | renderer_revision: Matches cited approved source under stated hypothetical inputs; conditions remain mandatory. |
| C10-N | calibration_only | reject_unsupported | C10 | REVIEW_REQUIRED | renderer_revision: Rendered text dùng tiêu chí tuổi ngày đặt trái verified source; đây là lỗi stale wording được tiêm thử, không phải policy revision có thật. |

## Cross-split source context: targeted human adjudication

Shared anchors are candidates, not automatic proof of leakage or independence. If the evaluated rule is the same, merge whole rule/scenario groups before freeze.

| Anchor | Dev IDs | Held-out IDs | Disposition |
| --- | --- | --- | --- |
| POL-05-U02-R1 | H-A11 | H-U06 | REVIEW_REQUIRED |
| POL-05-U02-R4 | H-A11, H-A16 | H-U06 | REVIEW_REQUIRED |
| POL-08-U01-R4 | D-U01 | H-U01, H-U10 | REVIEW_REQUIRED |
| POL-09-U02-R2 | H-A23 | H-A21, H-U08 | REVIEW_REQUIRED |
| POL-09-U02-R3 | H-A23 | H-A21, H-U08 | REVIEW_REQUIRED |
| POL-09-U03-R4 | H-A24 | H-A22 | REVIEW_REQUIRED |
| POL-09-U03-R5 | H-A24 | H-A22 | REVIEW_REQUIRED |
