# Conversion Examples

本例展示 string/binary file、external URL、JSON object 與 nested one-to-many 同時存在時的轉換方式。

## Contents

- [Input](#input)
- [Boundary and file decisions](#boundary-and-file-decisions)
- [MDC drafts](#mdc-drafts)
- [Traceability excerpt](#traceability-excerpt)
- [Readiness](#readiness)

## Input

使用者指定 plugin `procurement`，提供 JSON Schema：

```json
{
  "title": "PurchaseOrder",
  "type": "object",
  "required": ["orderNo", "status", "invoiceDocument", "lines"],
  "properties": {
    "orderNo": {"type": "string", "maxLength": 30},
    "status": {"type": "string", "enum": ["draft", "approved"]},
    "invoiceDocument": {
      "type": "string",
      "format": "binary",
      "contentMediaType": "application/pdf"
    },
    "externalPreviewUrl": {
      "type": "string",
      "format": "uri",
      "description": "Preview remains hosted by the supplier; no upload."
    },
    "metadata": {
      "type": "object",
      "additionalProperties": true
    },
    "lines": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["sku", "quantity"],
        "properties": {
          "sku": {"type": "string"},
          "quantity": {"type": "integer", "minimum": 1}
        }
      }
    }
  }
}
```

## Boundary and file decisions

- `PurchaseOrder` → `procurement_purchase_orders`，因為有 stable order number 與獨立 lifecycle。
- `lines[]` → `procurement_purchase_order_lines` detail collection，因為是可重複、可個別編輯的 child records。
- `invoiceDocument` → `invoice_file_id` / `type: file`，explicit binary PDF 是高信心 file evidence。
- `externalPreviewUrl` → `external_preview_url` / `type: string`，因為 description 明確說 external hosted 且不 upload。
- `metadata` → `json`，因為 properties 任意。

## MDC drafts

Master draft（access 尚未確認，所以不可直接部署）：

```json
{
  "key": "procurement_purchase_orders",
  "display": "Purchase Orders",
  "plugin": "procurement",
  "i18n": {"label_key": "collection.procurement_purchase_orders"},
  "ui": {
    "list": {
      "title_field": "order_no",
      "columns": ["order_no", "status", "external_preview_url"]
    }
  },
  "columns": [
    {
      "key": "order_no",
      "display": "Order Number",
      "type": "string",
      "required": true,
      "unique": true,
      "validation": {"max_length": 30},
      "ui": {"component": "text_input"}
    },
    {
      "key": "status",
      "display": "Status",
      "type": "option",
      "required": true,
      "multiple": false,
      "options": [
        {"value": "draft", "label_key": "purchase_order.status.draft"},
        {"value": "approved", "label_key": "purchase_order.status.approved"}
      ],
      "ui": {"component": "select"}
    },
    {
      "key": "invoice_file_id",
      "display": "Invoice",
      "type": "file",
      "required": true,
      "multiple": false,
      "file": {
        "visibility": "private",
        "accept": ["application/pdf"],
        "max_size_bytes": 10485760
      },
      "ui": {"component": "file_upload", "show_preview": true, "allow_remove": true}
    },
    {
      "key": "external_preview_url",
      "display": "External Preview URL",
      "type": "string",
      "required": false,
      "unique": false,
      "validation": {"format": "uri"},
      "ui": {"component": "text_input"}
    },
    {
      "key": "metadata",
      "display": "Metadata",
      "type": "json",
      "required": false,
      "json": {"allowed_root": ["object"], "max_depth": 10},
      "ui": {"component": "json_editor"}
    }
  ],
  "relations": [
    {
      "key": "lines",
      "display": "Order Lines",
      "type": "has_many",
      "target_collection": "procurement_purchase_order_lines",
      "foreign_key": "master_col_id",
      "ui": {
        "component": "detail_link",
        "prefill": {"master_col_id": "$record.id"},
        "lock_prefill_fields": ["master_col_id"]
      }
    }
  ]
}
```

Detail draft：

```json
{
  "key": "procurement_purchase_order_lines",
  "display": "Purchase Order Lines",
  "plugin": "procurement",
  "ui": {
    "list": {"title_field": "sku", "columns": ["sku", "quantity"]}
  },
  "columns": [
    {
      "key": "master_col_id",
      "display": "Purchase Order",
      "type": "reference",
      "required": true,
      "multiple": false,
      "reference": {
        "collection": "procurement_purchase_orders",
        "value_field": "id",
        "display_field": "order_no"
      },
      "ui": {"component": "hidden"}
    },
    {
      "key": "sku",
      "display": "SKU",
      "type": "string",
      "required": true,
      "unique": false,
      "ui": {"component": "text_input"}
    },
    {
      "key": "quantity",
      "display": "Quantity",
      "type": "number",
      "required": true,
      "decimal_places": 0,
      "validation": {"min": 1},
      "ui": {"component": "number_input", "step": 1}
    }
  ],
  "relations": []
}
```

## Traceability excerpt

```json
{
  "field_mappings": [
    {
      "source_path": "PurchaseOrder.invoiceDocument",
      "target_collection": "procurement_purchase_orders",
      "target_key": "invoice_file_id",
      "mdc_type": "file",
      "cardinality": "one",
      "evidence": ["format=binary", "contentMediaType=application/pdf"],
      "confidence": "high",
      "transformation": "Upload PDF through File API; store returned id."
    },
    {
      "source_path": "PurchaseOrder.externalPreviewUrl",
      "target_collection": "procurement_purchase_orders",
      "target_key": "external_preview_url",
      "mdc_type": "string",
      "cardinality": "one",
      "evidence": ["format=uri", "description says supplier-hosted and no upload"],
      "confidence": "high",
      "transformation": "Preserve external URL."
    },
    {
      "source_path": "PurchaseOrder.lines[]",
      "target_collection": "procurement_purchase_order_lines",
      "target_key": "master_col_id",
      "mdc_type": "has_many/detail",
      "cardinality": "many",
      "evidence": ["array of structured objects"],
      "confidence": "high",
      "transformation": "Split child records and bind with master_col_id."
    }
  ],
  "file_candidates": [
    {
      "source_path": "PurchaseOrder.invoiceDocument",
      "decision": "file",
      "reason": "Explicit binary PDF uploaded into LaFenice.",
      "confidence": "high"
    },
    {
      "source_path": "PurchaseOrder.externalPreviewUrl",
      "decision": "non_file",
      "reason": "Explicit external-hosted URL with no upload lifecycle.",
      "confidence": "high"
    }
  ]
}
```

## Readiness

```json
{
  "conversion": {
    "source_format": "json_schema",
    "ready_for_mdc": false,
    "readiness_reasons": [
      "Collection and relation read/write roles are not specified.",
      "PDF maximum size of 10 MiB is an assumption requiring confirmation."
    ]
  },
  "assumptions": [
    "Invoice files are private.",
    "Invoice PDF maximum size is 10 MiB."
  ],
  "blocking_decisions": [
    "Confirm read/write roles for both collections and the has-many relation.",
    "Confirm invoice visibility and maximum upload size."
  ],
  "migration_notes": [
    "Existing binary invoice values must be uploaded to File API and replaced by returned ids."
  ]
}
```

補齊 access 與 file policy、把相同 access 套到兩份 drafts/relation、通過 MDC validator 後，才可改成 `ready_for_mdc: true` 並交給遠端建立流程。
