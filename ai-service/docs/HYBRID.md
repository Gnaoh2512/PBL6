# Phase 2 — Hybrid Retrieval

Mốc triển khai/ranking Phase 2 được giữ bên dưới. **Phase 3 hiện default hybrid và gate bắt buộc**;
cần catalog/source receipts được pin theo [GROUNDING](GROUNDING.md) trước startup generation.
Benchmark Phase 2 là lịch sử, không phải bằng chứng semantic quality của gate.

Luồng đã triển khai: query → BM25 + một query embedding/vector search → RRF → metadata
filtering → ranked evidence. Có component/CLI và tích hợp FAQ opt-in; không tự bật trong
`.env`, không đổi generation prompt/model/budget hoặc triển khai semantic gate mới.

## Module và cấu hình

- [fusion.py](../app/retrieval/fusion.py): candidate/ranked evidence, metadata eligibility,
  dedup và RRF. [hybrid.py](../app/retrieval/hybrid.py): snapshot pin, BM25, orchestration,
  failure states và adapter sang `Evidence` cũ.
- [retrieval_http.py](../app/providers/retrieval_http.py): async query embedding/Qdrant.
  Dùng lại request body, response/vector validator và profile của Phase 1; không encode
  riêng từng candidate hoặc tạo collection khi search.
- [indexing.py](../app/indexing.py): `AI_HYBRID` cấu hình `bm25_top_k=10`, `vector_top_k=10`,
  `final_top_k=3`, `rrf_constant=60`. Top-k component từ 1–100; FAQ luôn tối đa ba evidence
  theo citation contract Spring hiện có. `AI_EMBEDDING`/`AI_CHUNKING` phải khớp snapshot.

Query model/API/dimension/recipe lấy từ profile chung của [Phase 1](INGESTION.md). Model 001
dùng `RETRIEVAL_QUERY`; model 2 dùng search-query prefix. Cả hai validate finite/nonzero,
dimension và L2. Không sửa Gemini generation prompt. Usage hiện có vẫn là generation token
counters; chưa có cost/token meter cho embedding.

## Snapshot, metadata và ranking

Một lượt pin `active.json` một lần trước hai nhánh. Cả SQLite và Qdrant lấy cùng manifest,
run/collection và fingerprint, không đọc hai active aliases độc lập. Sau retrieval đọc lại
local state để từ chối nguồn/config đã đổi; nếu rebuild cùng fingerprint trong lúc query,
lượt đang chạy được hoàn tất trên collection cũ còn nguyên, không trộn collections.

`PairedIndex.local_active()` kiểm tra nguồn/approval/hiệu lực, config, manifest, SQLite checksum
và rows. Query Qdrant kiểm tra collection tồn tại, size/Cosine/point count; từng hit phải khớp
toàn payload và point ID của manifest. Full remote vector checksum audit vẫn nằm ở
`PairedIndex.active()`/CLI Phase 1 status; online không scroll toàn bộ vectors mỗi query.
Full source/SQLite validation vẫn đồng bộ, phù hợp corpus nhỏ, chưa có latency SLO/scale proof.

BM25 giữ FTS5/normalization hiện có, `ORDER BY bm25(chunks), rowid`; score gốc nhỏ hơn xếp
trước. Vector xếp giảm cosine, phân xử ties trong tập hits trả về bằng chunk ID. RRF dùng
rank một-based: `sum(1 / (constant + rank))`, không cộng BM25 và cosine raw scores.
Nguồn: [Cormack–Clarke–Buettcher, SIGIR 2009](https://cormack.uwaterloo.ca/cormack/cormacksigir09-rrf.pdf).

Mỗi chunk chỉ có một vote/backend, dùng best original rank khi backend có duplicate; cùng ID
khác payload bị từ chối. Final ties: RRF giảm dần → best rank tăng dần → chunk ID tăng dần.
RRF ổn định theo các candidate lists đã nhận; ANN/top-k boundary trên corpus lớn vẫn cần đo,
không coi việc sort ties trong hits là bảo đảm recall toàn collection.

Filtering dùng dữ liệu thực có trong schema Phase 1: mode production/demo, approved,
effective dates, document type/category và source/document ID. Có prefilter ở backend và
kiểm tra lại trước final top-k. Source bị thu hồi/hết hiệu lực khiến snapshot không còn hợp
lệ theo Phase 1; không âm thầm dùng nguồn đó hoặc tự tạo rule nghiệp vụ mới.

Ranked output giữ full Chunk/provenance, source/section/version/checksums, RRF score và
backend/rank/raw score cho debug. FAQ adapter chuyển sang fields `citationId/documentId/
version/chunkId/sectionId/title/sourceRef/excerpt/corpusMode` hiện có, không thêm rank/score
vào public envelope hoặc sửa Spring/FE. Score không chứng minh semantic support.

## Failure contract và deadline

| Tình huống | Result nội bộ | FAQ/API |
| --- | --- | --- |
| Cả hai branches thành công, có hits | `hybrid`; mỗi branch `ok` hoặc `empty` | Existing answer path, tối đa 3 evidence |
| Một branch empty, branch kia có hits | `hybrid`, giữ trạng thái từng branch | Không coi empty là lỗi |
| Không có hits sau filtering | `empty` | `insufficient_evidence`, không gọi answer generation |
| Query trống | `empty`, cả hai `not_run/empty_query` | Không encode/query |
| Một branch lỗi, branch kia thành công | `failed`, ghi branch/stage/code, không final ranked hits | Fail-closed, không trả partial như full hybrid |
| Cả hai branches lỗi | `failed`, giữ cả hai lỗi | Fail-closed |
| Query embedding lỗi | Vector `error/embedding`; BM25 vẫn có outcome riêng | Dependency/protocol/timeout mapping theo lỗi |
| Snapshot missing/stale/invalid | `failed`, `snapshot_error`, branches `not_run` | 503 `DEPENDENCY_UNAVAILABLE` |
| Provider/vector store unavailable | `failed` | Existing 503 `DEPENDENCY_UNAVAILABLE` |
| Embedding response/schema/vector sai | `failed` | Existing 502 `AI_PROTOCOL_ERROR` |
| Provider read timeout/request deadline | Không publish partial | Existing 504 `DEADLINE_EXCEEDED` |

Không hỗ trợ degraded mode trong Phase 2; không fallback âm thầm sang BM25. Generation chỉ
chạy sau full successful retrieval. FastAPI dependency-failure latch/readiness policy cũ
vẫn áp dụng. Hybrid readiness kiểm tra local snapshot và Qdrant, không tạo query embedding.

Query embedding và Qdrant dùng native async HTTP, timeout không lớn hơn thời gian còn lại
của cùng `TurnBudget`; không retry. FAQ outer deadline vẫn 20 giây tối đa từ Spring,
hai generation/8000 input/2000 output như cũ. Cancellation hủy retrieval tasks và HTTP context;
không phát hành BM25 result nếu vector đang lỗi/chưa hoàn tất. Local sync source/SQLite work
có kiểm tra budget trước/sau, không là hard real-time CPU deadline.

Tại mốc Phase 2, factory chưa bật gate D1.20. Phase 3 đã thay bằng loader/gate bắt buộc. Nếu host inject gate, adapter truyền
snapshot ID thật của batch vào gate; catalog cũ sai snapshot bị từ chối, không lấy RRF score
làm certificate hoặc fallback sang free-form sau verification failure.

## Cách chạy

Trước tiên cần paired snapshot Phase 1 hợp lệ và Qdrant đúng storage. Không rebuild từ query.
Nguồn production hiện chưa được duyệt; không tự đưa fixture vào production. Giữ demo riêng.

PowerShell từ `ai-service`, cấu hình cho lần vận hành được phép gọi provider:

```powershell
$env:AI_RETRIEVAL_MODE='hybrid'
$env:AI_CORPUS_MODE='demo_synthetic'
$env:AI_HYBRID='{"bm25_top_k":10,"vector_top_k":10,"final_top_k":3,"rrf_constant":60}'
$env:AI_QDRANT_URL='http://127.0.0.1:6333'
```

Factory lấy active paired index theo mode; `AI_INDEX_PATH` legacy không được dùng ở hybrid
mode. Đặt `AI_RETRIEVAL_MODE=bm25` để dùng retrieval legacy tường minh, vẫn cần gate/publications Phase 3. Không có fallback giữa hai mode.
Startup probe Gemini generation cũ vẫn tồn tại; không start service thật trong Phase 2 tests.

CLI sau **sẽ gọi query embedding API thật** và cần flag tường minh; chưa chạy trong nhiệm vụ:

```powershell
.\.venv\Scripts\python.exe -B -m app.retrieval.hybrid_cli --mode demo_synthetic --query 'Wi-Fi ở đâu?' --allow-embedding-api
```

Có `--category` và `--source-id`. CLI chỉ retrieval/debug, không gọi generation, không tạo
collection, không ingest. Không có flag cho fake encoder trong runtime/CLI.

## Tests và benchmark

```powershell
$env:PBL6_QDRANT_DOCKER='1'
$env:PBL6_HYBRID_BENCHMARK_REPORT=(Join-Path (Get-Location) '.local\paired-index\phase2-benchmark.json')
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit tests/integration --tb=short --show-capture=no
```

Docker tests dùng container/port riêng, fake query encoder hoặc mock embedding REST,
Qdrant thật và root tạm. Offline network guard chung không đổi; Docker fixture cho phép
đúng port container và stdlib socketpair để chạy async trên Windows. Không cần Gemini key.

Chạy benchmark standalone khi đã có Qdrant local được phép dùng, không cần Gemini:

```powershell
.\.venv\Scripts\python.exe -B -m tests.evaluation.benchmark_hybrid --qdrant-url http://127.0.0.1:6333 --output .local/paired-index/phase2-benchmark.json
```

Benchmark dùng source/gold mới ở `tests/fixtures/hybrid/`, **không sửa D1 fixtures/artifacts**.
18 câu/8 sections: 16 answerable, 2 unanswerable. Gold sections được viết trước lần chạy,
không lấy kết quả retrieval làm label. Encoder SHA-256 character trigram độc lập labels;
đây là fake baseline, không phải Gemini hay semantic model production. Rebuild/query chỉ
trong temporary root/demo collection, cleanup sau benchmark; report được ignore bởi Git.

Đo Recall@3, MRR@3 và Precision@3 theo gold binary của 16 answerable queries. Hai câu không
có gold được báo riêng bằng số lượt nonempty retrieval; không bỏ chúng để suy chất lượng
abstention. Latency p50/p95 là một pass local, gồm pin/validate trước và sau retrieval,
không gồm indexing/container startup, không phải latency Gemini hoặc production SLO.

Kết quả hiện tại và acceptance ở [PROCESS](PROCESS.md) và [EVALUATION](EVALUATION.md).
Gold production, Gemini vectors thật, paraphrases độc lập và nhiều lần đo/concurrency còn
thiếu; không tuyên bố Hybrid tốt hơn vector hoặc đủ grounding từ benchmark synthetic này.
Phase 3 đã nối context/gate/renderer theo [GROUNDING](GROUNDING.md); dữ liệu thật/semantic quality còn mở;
chưa mở reranking, LLM judge, agent, knowledge graph hoặc business tools.
