#!/usr/bin/env python3
"""Inspect a LaFenice plugin archive without extracting it."""

from __future__ import annotations

import argparse
import hashlib
import json
import tarfile
from pathlib import Path, PurePosixPath
from typing import Any


PAYLOAD_FILES = {
    "collections": "payload/collections.json",
    "code": "payload/code_modules.json",
    "code_versions": "payload/code_versions.json",
    "menu": "payload/menu_routes.json",
    "roles": "payload/roles.json",
    "language_pack": "payload/language_pack.json",
    "schedulers": "payload/schedulers.json",
    "app_env": "payload/app_env.json",
    "gateway_routes": "payload/gateway_routes.json",
}


def safe_path(name: str) -> str:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or str(path) != name:
        raise ValueError(f"unsafe archive path: {name}")
    return name


def read_archive(path: Path) -> tuple[dict[str, bytes], dict[str, Any]]:
    files: dict[str, bytes] = {}
    with tarfile.open(path, "r:gz") as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue
            name = safe_path(member.name)
            source = archive.extractfile(member)
            if source is not None:
                files[name] = source.read()
    if "manifest.json" not in files:
        raise ValueError("manifest.json is missing")
    manifest = json.loads(files["manifest.json"].decode("utf-8"))
    if manifest.get("schema_version") != 1:
        raise ValueError("unsupported manifest schema_version")
    return files, manifest


def json_value(files: dict[str, bytes], name: str, default: Any) -> Any:
    data = files.get(name)
    return default if data is None else json.loads(data.decode("utf-8"))


def count_menu(nodes: Any) -> int:
    if not isinstance(nodes, list):
        return 0
    return sum(
        1 + count_menu(node.get("children"))
        for node in nodes
        if isinstance(node, dict)
    )


def verify_checksums(files: dict[str, bytes]) -> list[str]:
    checksums = json_value(files, "checksums.json", {})
    if not isinstance(checksums, dict):
        raise ValueError("checksums.json must contain an object")
    warnings: list[str] = []
    for name, expected in checksums.items():
        if not isinstance(name, str) or not isinstance(expected, str):
            warnings.append("ignored a malformed checksum entry")
            continue
        data = files.get(name)
        if data is None:
            warnings.append(f"checksum references missing file: {name}")
            continue
        actual = hashlib.sha256(data).hexdigest()
        if actual != expected:
            raise ValueError(f"checksum mismatch: {name}")
    return warnings


def inspect(path: Path) -> dict[str, Any]:
    files, manifest = read_archive(path)
    warnings = verify_checksums(files)
    counts: dict[str, int] = {}
    for section, filename in PAYLOAD_FILES.items():
        value = json_value(files, filename, [] if section != "gateway_routes" else {})
        if section == "menu":
            counts[section] = count_menu(value)
        elif section == "gateway_routes" and isinstance(value, dict):
            counts[section] = sum(len(methods) for methods in value.values() if isinstance(methods, dict))
        else:
            counts[section] = len(value) if isinstance(value, list) else 0
    modules = json_value(files, PAYLOAD_FILES["code"], [])
    versions = json_value(files, PAYLOAD_FILES["code_versions"], [])
    module_keys = {
        item.get("module_key") for item in modules
        if isinstance(item, dict) and isinstance(item.get("module_key"), str)
    }
    version_keys = {
        item.get("module_key") for item in versions
        if isinstance(item, dict) and isinstance(item.get("module_key"), str)
    }
    for module_key in sorted(module_keys - version_keys):
        warnings.append(f"code module has no version payload: {module_key}")
    for module_key in sorted(version_keys - module_keys):
        warnings.append(f"code version has no module payload: {module_key}")
    return {
        "archive": path.name,
        "plugin": manifest.get("plugin", {}),
        "schema_version": manifest.get("schema_version"),
        "counts": counts,
        "manifest_counts": manifest.get("counts", {}),
        "warnings": [*manifest.get("warnings", []), *warnings],
        "files": sorted(files),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--files", action="store_true", help="include the archive file list")
    args = parser.parse_args()
    try:
        result = inspect(args.archive)
        if not args.files:
            result.pop("files", None)
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except (OSError, tarfile.TarError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        print(json.dumps({"archive": args.archive.name, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
