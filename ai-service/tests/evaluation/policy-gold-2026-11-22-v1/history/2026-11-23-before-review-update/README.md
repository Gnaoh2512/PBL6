# Policy Gold draft — PBL6 Academic Demo

Ngày chụp nguồn: **22/11/2026**, UTC+07:00. Trạng thái bộ đánh giá: **draft / pending_review / approved: false**.
Policy nguồn đã được user duyệt và có hiệu lực từ ngày này; approval policy **không** truyền sang Gold, facts hay catalog.
Chưa nghiệm thu D1.

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
Mỗi split có một nửa mỗi stratum. O là yêu cầu thực hiện/tra cứu nghiệp vụ, khác câu hỏi policy giả định.
80 query có ID riêng, 33 decision families; 72 đoạn requiredMeaning đề xuất **không phải** 72 atomic facts đã duyệt.
Evidence/context references bao phủ 10 nhóm policy và cả 38 unit; không đồng nghĩa bao phủ mọi nhánh hoặc câu hỏi.

Các biến thể trong cùng family, kể cả A/U, ở cùng split. Dev tập trung admission, giữ chỗ, amendment,
phân bổ giảm giá, capacity/age, đơn vị dịch vụ, privacy. Held-out candidate tập trung phí sớm/muộn,
hủy/no-show, refund, pet, delivery và complaint. Quy ước chung và nguồn policy có thể dùng ở cả hai split.
Kiểm tra family IDs rời nhau chỉ là kiểm tra cấu trúc; human review phải tìm các paraphrase/decision
tương đương bị đặt tên khác nhau và gộp/chuyển chúng trước freeze.

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
Giữ D1 acceptance mở. Không ingestion, embedding, Qdrant, Gemini, DB hoặc live evaluation.
