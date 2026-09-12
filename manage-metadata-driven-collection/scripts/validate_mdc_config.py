#!/usr/bin/env python3
"""Preflight a LaFenice MDC collection config using only the Python standard library."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
ENDPOINT_RE = re.compile(r"^[A-Za-z0-9_.-]+$")
ROUTE_RE = re.compile(r"^/[A-Za-z0-9_{}./-]*$")
FIELD_TYPES = {
    "string",
    "number",
    "date",
    "datetime",
    "boolean",
    "option",
    "reference",
    "embedded",
    "json",
    "html",
    "rich_text",
    "file",
}
RESERVED_KEYS = {
    "_id",
    "id",
    "created_at",
    "created_at_format",
    "created_month",
    "created_date",
    "created_by",
    "updated_at",
    "updated_at_format",
    "updated_by",
}
RICH_TEXT_FEATURES = {
    "paragraph",
    "heading",
    "bold",
    "italic",
    "underline",
    "strike",
    "ordered_list",
    "bullet_list",
    "blockquote",
    "code",
    "code_block",
    "link",
}
FILE_NAME_TOKENS = {
    "attachment",
    "attachments",
    "avatar",
    "blob",
    "certificate",
    "certificates",
    "cv",
    "file",
    "files",
    "icon",
    "image",
    "images",
    "logo",
    "media",
    "pdf",
    "photo",
    "photos",
    "picture",
    "pictures",
    "portrait",
    "resume",
    "scan",
    "signature",
    "upload",
    "uploads",
    "audio",
    "video",
}
FILE_NAME_PHRASES = {
    "上傳",
    "附件",
    "圖片",
    "照片",
    "頭像",
    "履歷",
    "掃描檔",
    "檔案",
    "影音",
    "影片",
    "音訊",
    "證明文件",
    "證書",
    "簽名檔",
}
FILE_METADATA_KEYS = {
    "caption",
    "checksum",
    "content_type",
    "extension",
    "file_name",
    "filename",
    "media_type",
    "mime_type",
    "original_filename",
    "sha256",
    "size_bytes",
}
FILE_FORMAT_HINTS = {"base64", "binary", "blob", "byte", "bytes", "file", "multipart", "upload"}
FILE_UI_COMPONENTS = {"file", "file_input", "file_upload", "upload", "upload_input"}


class Validator:
    def __init__(self, config: dict[str, Any], mode: str) -> None:
        self.config = config
        self.mode = mode
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, path: str, message: str) -> None:
        self.errors.append(f"{path}: {message}")

    def warn(self, path: str, message: str) -> None:
        self.warnings.append(f"{path}: {message}")

    def validate(self) -> None:
        self._key(self.config.get("key"), "key")
        self._required_text(self.config.get("display"), "display")
        self._required_text(self.config.get("plugin"), "plugin")

        if self.mode == "update":
            version = self.config.get("version")
            if isinstance(version, bool) or not isinstance(version, int) or version < 0:
                self.error("version", "update requires the latest non-negative integer version")

        if self.config.get("access") is None:
            self.warn("access", "omitted; backend defaults read and write to any authenticated user")
        self._access(self.config.get("access"), "access", optional=True)
        self._i18n(self.config.get("i18n"), "i18n")
        self._source_code_endpoint(self.config.get("source_code_endpoint"))

        columns = self.config.get("columns", [])
        if not isinstance(columns, list):
            self.error("columns", "must be an array")
            columns = []
        if not columns:
            self.warn("columns", "collection has no configurable business fields")

        column_keys: set[str] = set()
        columns_by_key: dict[str, dict[str, Any]] = {}
        field_keys: set[str] = set()
        unique_strings: list[str] = []
        for index, column in enumerate(columns):
            path = f"columns[{index}]"
            if not isinstance(column, dict):
                self.error(path, "must be an object")
                continue
            key = self._key(column.get("key"), f"{path}.key")
            if key in RESERVED_KEYS:
                self.error(f"{path}.key", "is system-managed")
            if key and key in field_keys:
                self.error(f"{path}.key", "duplicates another column or relation key")
            if key:
                column_keys.add(key)
                columns_by_key[key] = column
                field_keys.add(key)
            if self._column(column, path) and column.get("type") == "string" and column.get("unique") is True:
                unique_strings.append(key)

        relations = self.config.get("relations", [])
        if not isinstance(relations, list):
            self.error("relations", "must be an array")
            relations = []
        for index, relation in enumerate(relations):
            path = f"relations[{index}]"
            if not isinstance(relation, dict):
                self.error(path, "must be an object")
                continue
            key = self._key(relation.get("key"), f"{path}.key")
            if key and key in field_keys:
                self.error(f"{path}.key", "duplicates another column or relation key")
            if key:
                field_keys.add(key)
            self._relation(relation, path)

        if len(unique_strings) > 1:
            self.warn(
                "columns",
                f"Generate Code enforces only the first unique string ({unique_strings[0]}); additional unique fields need provisioning/migration",
            )

        self._ui(self.config.get("ui"), columns_by_key)

    def _column(self, column: dict[str, Any], path: str) -> bool:
        field_type = column.get("type")
        if field_type not in FIELD_TYPES:
            self.error(f"{path}.type", f"must be one of {', '.join(sorted(FIELD_TYPES))}")
            return False
        self._bool(column.get("required"), f"{path}.required", optional=True)
        self._access(column.get("access"), f"{path}.access", optional=True)
        self._i18n(column.get("i18n"), f"{path}.i18n")
        self._object(column.get("validation"), f"{path}.validation", optional=True)
        self._object(column.get("ui"), f"{path}.ui", optional=True)
        self._file_candidate(column, path, field_type)
        if field_type != "string" and "unique" in column:
            self.warn(f"{path}.unique", f"is not supported for type={field_type} and will be ignored; remove it")

        if field_type == "string":
            self._bool(column.get("unique"), f"{path}.unique", optional=True)
        elif field_type == "number":
            self._bounded_int(column.get("decimal_places", 0), f"{path}.decimal_places", 0, 18)
        elif field_type in {"date", "datetime"}:
            if "timezone" in column:
                self.error(f"{path}.timezone", "is system-managed and cannot be configured")
        elif field_type == "boolean":
            self._bool(column.get("default"), f"{path}.default", optional=True)
        elif field_type == "option":
            self._bool(column.get("multiple"), f"{path}.multiple", optional=True)
            self._options(column.get("options"), f"{path}.options")
        elif field_type in {"reference", "embedded"}:
            self._bool(column.get("multiple"), f"{path}.multiple", optional=True)
            self._collection_source(column.get(field_type), f"{path}.{field_type}", embedded=field_type == "embedded")
        elif field_type == "json":
            self._json_settings(column.get("json"), f"{path}.json")
        elif field_type == "html":
            html = column.get("html")
            if not isinstance(html, dict):
                self.error(f"{path}.html", "must be an object")
            elif html.get("sanitizer_profile") != "div_style_only":
                self.error(f"{path}.html.sanitizer_profile", "must be div_style_only")
        elif field_type == "rich_text":
            self._rich_text(column.get("rich_text"), f"{path}.rich_text")
        elif field_type == "file":
            self._file(column.get("file"), f"{path}.file")
            self._bool(column.get("multiple"), f"{path}.multiple", optional=True)
            ui = column.get("ui") if isinstance(column.get("ui"), dict) else {}
            component = str(ui.get("component") or "").strip().lower()
            if component != "file_upload":
                self.error(f"{path}.ui.component", "type=file requires ui.component=file_upload")
            if column.get("multiple") is True:
                self.warn(
                    f"{path}.multiple",
                    "verify the deployed generated page and API can upload, store, and render an array of File API ids",
                )
        return True

    def _file_candidate(self, column: dict[str, Any], path: str, field_type: str) -> None:
        if field_type == "file":
            return
        ui = column.get("ui") if isinstance(column.get("ui"), dict) else {}
        component = str(ui.get("component") or "").strip().lower()
        if component in FILE_UI_COMPONENTS:
            self.error(
                f"{path}.type",
                f"ui.component={component} requires type=file; a non-file type will not provide file semantics",
            )
            return

        signals: list[str] = []
        key = str(column.get("key") or "").strip().lower()
        display = str(column.get("display") or "").strip().lower()
        for label, value in (("key", key), ("display", display)):
            tokens = {token for token in re.split(r"[^a-z0-9]+", value) if token}
            if label == "key" and key in FILE_METADATA_KEYS:
                continue
            matched = sorted(tokens & FILE_NAME_TOKENS)
            if matched:
                signals.append(f"{label} token(s): {', '.join(matched)}")
            matched_phrases = sorted(phrase for phrase in FILE_NAME_PHRASES if phrase in value)
            if matched_phrases:
                signals.append(f"{label} phrase(s): {', '.join(matched_phrases)}")
        if key.endswith(("_file_id", "_file_ids")):
            signals.append("file-id naming")

        validation = column.get("validation") if isinstance(column.get("validation"), dict) else {}
        format_values = [
            column.get("format"),
            column.get("contentEncoding"),
            column.get("content_encoding"),
            validation.get("format"),
            validation.get("content_encoding"),
        ]
        formats = {
            str(value).strip().lower()
            for value in format_values
            if isinstance(value, str) and value.strip()
        }
        hinted_formats = sorted(formats & FILE_FORMAT_HINTS)
        if hinted_formats:
            signals.append(f"format hint(s): {', '.join(hinted_formats)}")
        if column.get("contentMediaType") or column.get("content_media_type"):
            signals.append("content media type")

        if signals:
            self.warn(
                f"{path}.type",
                "may represent a File API upload ("
                + "; ".join(dict.fromkeys(signals))
                + "); use type=file when LaFenice owns upload/preview/download, or document why this remains non-file",
            )

    def _relation(self, relation: dict[str, Any], path: str) -> None:
        if relation.get("type") != "has_many":
            self.error(f"{path}.type", "must be has_many")
        self._key(relation.get("target_collection"), f"{path}.target_collection")
        foreign_key = self._key(relation.get("foreign_key"), f"{path}.foreign_key")
        if foreign_key and foreign_key != "master_col_id":
            self.warn(f"{path}.foreign_key", "product-plugin master-detail should use system-owned master_col_id")
        self._i18n(relation.get("i18n"), f"{path}.i18n")
        self._access(relation.get("access"), f"{path}.access", optional=True)
        ui = relation.get("ui")
        if not isinstance(ui, dict):
            self.error(f"{path}.ui", "must be an object")
            return
        route = ui.get("route")
        if route not in (None, "") and (not isinstance(route, str) or not ROUTE_RE.fullmatch(route)):
            self.error(f"{path}.ui.route", "must be an absolute frontend route")
        prefill = ui.get("prefill")
        if not isinstance(prefill, dict) or not foreign_key or prefill.get(foreign_key) != "$record.id":
            self.error(f"{path}.ui.prefill", f"must map {foreign_key or '<foreign_key>'} to $record.id")
        locked = ui.get("lock_prefill_fields")
        if not isinstance(locked, list) or not foreign_key or foreign_key not in locked:
            self.error(f"{path}.ui.lock_prefill_fields", f"must include {foreign_key or '<foreign_key>'}")

    def _ui(self, value: Any, columns_by_key: dict[str, dict[str, Any]]) -> None:
        field_keys = set(columns_by_key)
        if value is None:
            self.warn("ui.list", "omitted; generated page will choose fallback list fields")
            return
        if not isinstance(value, dict):
            self.error("ui", "must be an object")
            return
        list_config = value.get("list")
        if list_config is None:
            self.warn("ui.list", "omitted; generated page will choose fallback list fields")
            return
        if not isinstance(list_config, dict):
            self.error("ui.list", "must be an object")
            return
        title = list_config.get("title_field")
        if title is not None and title not in field_keys:
            self.error("ui.list.title_field", "must reference a configured column")
        elif title is not None and columns_by_key.get(title, {}).get("type") == "file":
            self.warn("ui.list.title_field", "a file field may expose a raw File API id and is not a stable human-readable title")
        columns = list_config.get("columns")
        if columns is not None:
            if not isinstance(columns, list) or not all(isinstance(item, str) for item in columns):
                self.error("ui.list.columns", "must be a string array")
            else:
                missing = [item for item in columns if item not in field_keys]
                if missing:
                    self.error("ui.list.columns", f"unknown columns: {', '.join(missing)}")
                file_columns = [item for item in columns if columns_by_key.get(item, {}).get("type") == "file"]
                if file_columns:
                    self.warn(
                        "ui.list.columns",
                        f"file field(s) may expose raw File API ids in the baseline table: {', '.join(file_columns)}; exclude them or verify a secure custom renderer",
                    )

    def _access(self, value: Any, path: str, *, optional: bool) -> None:
        if value is None and optional:
            return
        if not isinstance(value, dict):
            self.error(path, "must be an object")
            return
        for action in ("read", "write"):
            rule = value.get(action)
            rule_path = f"{path}.{action}"
            if rule is None:
                continue
            if not isinstance(rule, dict):
                self.error(rule_path, "must be an object")
                continue
            auth = rule.get("auth_required", True)
            self._bool(auth, f"{rule_path}.auth_required", optional=False)
            roles = rule.get("roles", [])
            if not isinstance(roles, list) or not all(isinstance(role, str) and role.strip() for role in roles):
                self.error(f"{rule_path}.roles", "must be a non-empty-string array")
            elif roles and auth is False:
                self.error(f"{rule_path}.roles", "roles require auth_required=true")
            if action == "write" and auth is False and not roles:
                self.warn(rule_path, "public write access is high risk; confirm this is intentional")

    def _source_code_endpoint(self, value: Any) -> None:
        if value is None:
            return
        if not isinstance(value, dict):
            self.error("source_code_endpoint", "must be an object")
            return
        for name in ("api", "page", "history_api", "history_page"):
            endpoint = value.get(name)
            if endpoint is None:
                continue
            if not isinstance(endpoint, str) or not endpoint.strip() or endpoint.startswith("/") or not ENDPOINT_RE.fullmatch(endpoint):
                self.error(f"source_code_endpoint.{name}", "must be a non-empty endpoint name without a leading slash")

    def _options(self, value: Any, path: str) -> None:
        if not isinstance(value, list) or not value:
            self.error(path, "must be a non-empty array")
            return
        seen: set[str] = set()
        for index, option in enumerate(value):
            item_path = f"{path}[{index}]"
            if not isinstance(option, dict):
                self.error(item_path, "must be an object")
                continue
            option_value = self._required_text(option.get("value"), f"{item_path}.value")
            self._required_text(option.get("label_key"), f"{item_path}.label_key")
            if option_value and option_value in seen:
                self.error(f"{item_path}.value", "must be unique")
            seen.add(option_value)

    def _collection_source(self, value: Any, path: str, *, embedded: bool) -> None:
        if not isinstance(value, dict):
            self.error(path, "must be an object")
            return
        self._key(value.get("collection"), f"{path}.collection")
        value_field = self._key(value.get("value_field", "id"), f"{path}.value_field")
        self._key(value.get("display_field"), f"{path}.display_field")
        if embedded:
            copy_fields = value.get("copy_fields")
            if not isinstance(copy_fields, list) or not copy_fields or not all(isinstance(item, str) for item in copy_fields):
                self.error(f"{path}.copy_fields", "must be a non-empty string array")
            else:
                for index, item in enumerate(copy_fields):
                    self._key(item, f"{path}.copy_fields[{index}]")
                if len(copy_fields) != len(set(copy_fields)):
                    self.error(f"{path}.copy_fields", "cannot contain duplicates")
                if value_field and value_field not in copy_fields:
                    self.error(f"{path}.copy_fields", "must include value_field")

    def _json_settings(self, value: Any, path: str) -> None:
        if not isinstance(value, dict):
            self.error(path, "must be an object")
            return
        roots = value.get("allowed_root", ["object", "array"])
        if not isinstance(roots, list) or not roots or any(root not in {"object", "array"} for root in roots):
            self.error(f"{path}.allowed_root", "must contain object and/or array")
        self._bounded_int(value.get("max_depth", 10), f"{path}.max_depth", 1, 100)

    def _rich_text(self, value: Any, path: str) -> None:
        if not isinstance(value, dict):
            self.error(path, "must be an object")
            return
        if value.get("format") != "prosemirror_json":
            self.error(f"{path}.format", "must be prosemirror_json")
        features = value.get("features", [])
        if not isinstance(features, list) or not all(isinstance(item, str) for item in features):
            self.error(f"{path}.features", "must be a string array")
        else:
            unsupported = sorted(set(features) - RICH_TEXT_FEATURES)
            if unsupported:
                self.error(f"{path}.features", f"unsupported features: {', '.join(unsupported)}")

    def _file(self, value: Any, path: str) -> None:
        if not isinstance(value, dict):
            self.error(path, "must be an object")
            return
        if value.get("visibility", "private") not in {"public", "private"}:
            self.error(f"{path}.visibility", "must be public or private")
        accept = value.get("accept", ["*/*"])
        if not isinstance(accept, list) or not accept or not all(isinstance(item, str) and item.strip() for item in accept):
            self.error(f"{path}.accept", "must be a non-empty string array")
        self._bounded_int(value.get("max_size_bytes", 524288000), f"{path}.max_size_bytes", 1, 10 * 1024**3)

    def _i18n(self, value: Any, path: str) -> None:
        if value is None:
            return
        if not isinstance(value, dict):
            self.error(path, "must be an object")
            return
        for name in ("label_key", "help_key", "placeholder_key"):
            if name in value:
                self._required_text(value.get(name), f"{path}.{name}")

    def _key(self, value: Any, path: str) -> str:
        text = self._required_text(value, path)
        if text and not KEY_RE.fullmatch(text):
            self.error(path, "must start with lowercase and contain only lowercase letters, numbers, and underscores (max 64)")
        return text

    def _required_text(self, value: Any, path: str) -> str:
        if not isinstance(value, str) or not value.strip():
            self.error(path, "is required and must be a non-empty string")
            return ""
        return value.strip()

    def _bool(self, value: Any, path: str, *, optional: bool) -> None:
        if value is None and optional:
            return
        if not isinstance(value, bool):
            self.error(path, "must be a boolean")

    def _object(self, value: Any, path: str, *, optional: bool) -> None:
        if value is None and optional:
            return
        if not isinstance(value, dict):
            self.error(path, "must be an object")

    def _bounded_int(self, value: Any, path: str, minimum: int, maximum: int) -> None:
        if isinstance(value, bool) or not isinstance(value, int):
            self.error(path, "must be an integer")
        elif not minimum <= value <= maximum:
            self.error(path, f"must be between {minimum} and {maximum}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preflight a LaFenice MDC collection config JSON file.")
    parser.add_argument("config", help="UTF-8 JSON file containing a config or GET response with item; use - for stdin")
    parser.add_argument("--mode", choices=("auto", "create", "update"), default="auto")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.config == "-":
            root = json.load(sys.stdin)
        else:
            with Path(args.config).open("r", encoding="utf-8-sig") as handle:
                root = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read config JSON: {exc}", file=sys.stderr)
        return 2

    if not isinstance(root, dict):
        print("ERROR: root JSON value must be an object", file=sys.stderr)
        return 2
    config = root.get("item") if isinstance(root.get("item"), dict) else root
    mode = args.mode
    if mode == "auto":
        mode = "update" if "version" in config else "create"

    validator = Validator(config, mode)
    validator.validate()
    for warning in validator.warnings:
        print(f"WARNING: {warning}")
    for error in validator.errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if validator.errors:
        print(f"FAILED: {len(validator.errors)} error(s), {len(validator.warnings)} warning(s)", file=sys.stderr)
        return 1
    print(f"OK: {config.get('key', '<unknown>')} is valid for {mode} ({len(validator.warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
