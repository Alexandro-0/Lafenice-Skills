# lafenice-status-example 1.0.0

A compact LaFenice Plugin Export output example bundled with the plugin-development skills.

The HTML module is intentionally small but follows the MDC HTML baseline: it receives
runtime context through `postMessage`, applies App Shell theme tokens, renders table cells
with DOM APIs, keeps the table at `width: max-content` inside a scrollable wrapper, and
reserves enough width for the `updated_at_format` column. Use
`LaFeniceBackend/code_templates/metadata_collection_page.html` as the full collection-page
reference.
