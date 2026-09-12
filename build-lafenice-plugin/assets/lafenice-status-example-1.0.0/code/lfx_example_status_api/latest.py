from datetime import datetime, timezone
from typing import Any


VIEW_ROLES = {"admin", "ai", "super", "lfx-example-status-viewer"}


def handle(
    *,
    method: str,
    query_params: dict[str, Any],
    resource_id: str | None,
    payload: dict[str, Any],
    header: dict[str, str],
    uid: str | None,
    roles: list[str],
) -> tuple[int, dict[str, Any]]:
    normalized_roles = {role.strip().lower() for role in roles if isinstance(role, str)}
    if method == "SCHEDULE":
        return 200, {
            "message": "example status probe completed",
            "source": payload.get("source", "scheduler"),
        }
    if method != "GET":
        return 405, {"error": {"message": "Method is not allowed."}}
    if normalized_roles.isdisjoint(VIEW_ROLES):
        return 403, {"error": {"message": "Status access is denied."}}
    return 200, {
        "message": "success",
        "item": {
            "plugin": "lafenice-status-example",
            "status": "healthy",
            "authenticated": uid is not None,
            "updated_at_format": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        },
    }
