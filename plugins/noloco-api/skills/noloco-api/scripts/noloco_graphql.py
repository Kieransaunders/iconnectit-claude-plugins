#!/usr/bin/env python3
"""Send authenticated GraphQL requests to a Noloco app data API."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def read_text(path: str | None, stdin_fallback: bool = False) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8")
    if stdin_fallback and not sys.stdin.isatty():
        return sys.stdin.read()
    return ""


def read_json(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    raw = Path(path).read_text(encoding="utf-8")
    if not raw.strip():
        return {}
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("variables file must contain a JSON object")
    return data


def build_endpoint(app_name: str | None, endpoint: str | None) -> str:
    if endpoint:
        return endpoint
    if not app_name:
        raise ValueError("provide --app-name or --endpoint")
    return f"https://api.portals.noloco.io/data/{app_name}"


def post_graphql(
    endpoint: str,
    api_key: str,
    query: str,
    variables: dict[str, Any],
    operation_name: str | None,
    timeout: float,
) -> tuple[int, dict[str, Any]]:
    payload: dict[str, Any] = {"query": query}
    if variables:
        payload["variables"] = variables
    if operation_name:
        payload["operationName"] = operation_name

    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_body = response.read().decode("utf-8")
            status = response.status
    except urllib.error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        status = exc.code
    except urllib.error.URLError as exc:
        raise RuntimeError(f"request failed: {exc.reason}") from exc

    try:
        data = json.loads(response_body) if response_body.strip() else {}
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"response was not JSON (HTTP {status}): {response_body[:500]}") from exc

    if not isinstance(data, dict):
        raise RuntimeError(f"response JSON was not an object (HTTP {status})")

    return status, data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send a GraphQL query or mutation to Noloco's app data API."
    )
    parser.add_argument("--app-name", help="Noloco app name used in /data/<app_name>.")
    parser.add_argument("--endpoint", help="Full Noloco GraphQL endpoint override.")
    parser.add_argument(
        "--api-key-env",
        default="NOLOCO_API_KEY",
        help="Environment variable containing the Noloco App API key.",
    )
    parser.add_argument(
        "--api-key",
        help="Noloco App API key. Prefer --api-key-env so secrets do not enter shell history.",
    )
    parser.add_argument("--query-file", help="File containing a GraphQL query or mutation.")
    parser.add_argument(
        "--variables-file",
        help="JSON file containing GraphQL variables as an object.",
    )
    parser.add_argument("--operation-name", help="Optional GraphQL operationName.")
    parser.add_argument("--timeout", type=float, default=30.0, help="Request timeout in seconds.")
    parser.add_argument(
        "--allow-graphql-errors",
        action="store_true",
        help="Exit 0 even when the GraphQL response contains an errors array.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        endpoint = build_endpoint(args.app_name, args.endpoint)
        api_key = args.api_key or os.environ.get(args.api_key_env)
        if not api_key:
            raise ValueError(f"set {args.api_key_env} or pass --api-key")

        query = read_text(args.query_file, stdin_fallback=True).strip()
        if not query:
            raise ValueError("provide --query-file or pipe a GraphQL query on stdin")

        variables = read_json(args.variables_file)
        status, data = post_graphql(
            endpoint=endpoint,
            api_key=api_key,
            query=query,
            variables=variables,
            operation_name=args.operation_name,
            timeout=args.timeout,
        )
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(data, indent=2, sort_keys=True))

    if status < 200 or status >= 300:
        print(f"error: HTTP {status}", file=sys.stderr)
        return 1
    if data.get("errors") and not args.allow_graphql_errors:
        print("error: GraphQL response contained errors", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
