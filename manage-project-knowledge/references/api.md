# Project Knowledge API (schema 2)

All paths below are relative to the verified `/{PROJECT_ROOT}/api`. Native Core API; no Generate Code. Use Bearer JWT (`super`/`ai`); definitions are platform-wide developer metadata, not tenant business records.

## Discovery and reads

| Method | Path | Result |
| --- | --- | --- |
| GET | `/project-knowledge/catalog` | schema version, document kinds, data lifecycle model, access scope |
| GET | `/project-knowledge/projects?search=...&archived=false&limit=30&after=...` | projects, key cursor |
| GET | `/project-knowledge/projects/{project_id}` | project and document counts |
| GET | `/project-knowledge/projects/{project_id}/documents?kind=...&feature=...&key=...&search=...&limit=40&after=...` | document metadata and key cursor |
| GET | `/project-knowledge/projects/{project_id}/documents/{document_id}?view=latest` | current head and latest revision |
| GET | same path with `view=accepted` | effective revision, or null when unconfirmed/retired |
| GET | same path with `revision_id={id}` | a committed historical revision |
| GET | `/project-knowledge/projects/{project_id}/documents/{document_id}/revisions?before=...&limit=20` | revision metadata descending; next_cursor is version number |
| GET | `/project-knowledge/projects/{project_id}/documents/{document_id}/diff?from_revision={id}&to_revision={id}` | bounded unified content diff; to_revision defaults latest |
| GET | `/project-knowledge/projects/{project_id}/context?feature=...&after=...&limit=30` | accepted documents, pending drafts, data lifecycle document references, environment |
| GET | `/project-knowledge/projects/{project_id}/export?format=json` | latest and accepted snapshots; no full history |
| GET | same with `format=markdown` | readable export |
| POST | `/project-knowledge/imports/preview` | validate JSON snapshot, return document/accepted/draft counts and key_exists |
| POST | `/project-knowledge/imports` | validate again and create a new active project; returns 201 with item, or 409 on duplicate key |

Project/document lists: at most 100 per call; search is literal substring on indexed scope plus bounded name/title/key/summary/tags fields, not semantic search. Follow `next_cursor` with `after` until null. Revision history uses `before` instead. Context pages scan document keys, filter **accepted** feature membership, and include project-wide specifications; a page may have no matches but a non-null cursor. Context full content budget is 32,000 characters. Entries with `content_omitted` retain exact IDs; fetch their committed revision separately. Drafts never silently replace accepted content.

Kinds: `lifecycle`, `feature`, `requirement`, `decision`, `data`, `api`, `page`, `entry`, `schedule`, `role`, `guide`, `handoff`.

## Project writes

`POST /project-knowledge/projects`:

```json
{"key":"maintenance","name":"設備維護平台","summary":"設備、保養與逾期提醒","plugins":["maintenance"],"target_version":"1.0.0"}
```

Creates an empty project. Response `item` contains immutable `id`, `key`, and `version`. Add any number of data lifecycle documents with normal document creation; none is automatically generated.

`PATCH /project-knowledge/projects/{id}` accepts `version`, `name`, `summary`, `plugins`, `target_version`, `archived`. Supply the full editable metadata. Version mismatch returns 409. Archive is reversible and blocks document writes until restored; no permanent deletion endpoint.

## Document writes

`POST /project-knowledge/projects/{id}/documents`:

```json
{
  "key":"REQ-001",
  "kind":"requirement",
  "content":{
    "title":"本人訂單查詢",
    "summary":"使用者只能讀取本人訂單",
    "body":"## 預期行為\n\n清單與單筆查詢均限制本人資料。",
    "feature":"",
    "acceptance":["以另一位使用者的訂單 ID 查詢不得取得內容"],
    "implementation":"not-started",
    "verification":"unverified",
    "source":"使用者明確提出的需求"
  },
  "spec_status":"draft",
  "message":"整理需求供確認"
}
```

`POST /project-knowledge/projects/{id}/documents/{doc_id}/revisions`:

```json
{"base_version":1,"content":{"title":"本人訂單查詢","body":"修訂後的完整內容"},"spec_status":"draft","message":"補充單筆查詢的權限邊界"}
```

The second example is structurally minimal; in actual edits start from the returned complete `revision.content` and preserve untouched fields. This endpoint replaces the revision content, not a partial patch. `spec_status` is `draft`, `accepted`, or `retired`; retirement clears effective content but retains history. A future draft does not revive the retired accepted version. Confirming a revision creates a new accepted revision; previous ones remain readable.

Content fields:

- `title` (160 chars), `summary` (1000), `body` (60,000 Markdown characters).
- `feature`: existing feature document key or empty for project-wide. Feature documents remain project-level; data lifecycles may belong to a feature.
- `tags`: up to 20 key strings; `related`: up to 40 existing document keys from the same project.
- `implementation`: `not-started`, `in-progress`, `implemented`.
- `verification`: `unverified`, `passed`, `failed`; `passed` requires `verification_evidence` naming environment and evidence.
- `source`, `next_action`, `blockers`, `checkpoint`, `verification_evidence`: each up to 1000 characters.
- `acceptance`: up to 40 strings, each up to 1000 characters.
- `permissions`: up to 80 objects `{role, resource, actions, condition, denied, evidence}`.
- `resources`: up to 30 objects `{kind, key, method, fingerprint, note}`. Kinds: collection key, module key, gateway endpoint, page menu key, role name, scheduler name. `method` is empty or HTTP method for Gateway. `fingerprint` starts empty.
- `data_lifecycle`: lifecycle documents only; object or null. A lifecycle describes Plugin business data, not development phases. Fields: `subject` (200 chars), `collections` (up to 30 keys), `creation`, `invariants`, `retention`, `deletion` (1000 chars each).
- `data_lifecycle.states`: up to 40 `{key, label, description, records, initial, terminal}` objects. Keys must be unique; label is 100 chars; description/records 1000 each. Terminal identifies a normal endpoint; an explicit correction/reopen transition may leave it.
- `data_lifecycle.transitions`: up to 100 `{from_state, to_state, event, actor, guard, effects, handler, failure, evidence}` objects. Both state keys must exist. Event is required (200 chars); other text fields are limited to 1000 each. Self-transitions support corrections and idempotent operations.
- Accepting a lifecycle requires a subject, creation rules, states and at least one initial state. An incomplete definition may remain a draft. This validates the document structure; it does not execute a business workflow.
- Development progress belongs in `handoff`, including `next_action`, `blockers` and `checkpoint`. Legacy development `phases` from the initial preview are read-only historical data; omit them when saving a corrected revision.

`POST .../documents/{doc_id}/check-resources?view=latest` (or accepted) is read-only inspection. Returns checked revision ID, time, safe metadata and fingerprint per resource. States: `missing`, `untracked`, `current`, `changed`. To establish a baseline, ensure the checked revision is still latest, merge returned fingerprints into its bindings, then save a new document revision with a reason. Do not mark verification passed from this check.

## Version and portability boundaries

Writes publish immutable revision IDs with atomic document compare-and-swap; uncommitted revisions are not readable. Limit: 2000 committed revisions per document. Export cap: 500 documents / 4MB. Diff cap: 1000 lines / 60,000 characters with explicit truncation.

Both import endpoints accept `{"package": <JSON export>, "target_key": "new-key"}`. Omit target_key to use the source project key. Each imported document keeps its key, current effective/latest contents and source version numbers. The importing user owns the new revisions. Verification resets to unverified and source evidence and resource fingerprints remain available for review.

Every endpoint requires super or ai. Project snapshots contain shared developer documents. Use the separate Plugin archive workflow for deployment.
