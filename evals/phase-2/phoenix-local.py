"""Explicitly opt-in launcher for a loopback-only local Phoenix observer."""

from __future__ import annotations

import argparse
import importlib
import importlib.metadata
import os
import sys
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from typing import Any, TextIO


EXPECTED_VERSIONS = {
    "arize-phoenix": "17.26.0",
    "opentelemetry-sdk": "1.43.0",
}
IMPORTS = {
    "arize-phoenix": "phoenix",
    "opentelemetry-sdk": "opentelemetry.sdk",
}
INSTALL = 'install="python -m pip install --requirement evals/phase-2/requirements.txt"'
LOOPBACK_HOST = "127.0.0.1"
OPT_IN = "QUESTIONTRACE_PHOENIX_LOCAL"
FORBIDDEN_EXPORT_ENV = (
    "PHOENIX_COLLECTOR_ENDPOINT",
    "PHOENIX_CLOUD_ENDPOINT",
    "PHOENIX_API_KEY",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
)


def _unsafe_reason(env: Mapping[str, str]) -> str | None:
    host = env.get("PHOENIX_HOST", LOOPBACK_HOST)
    if host != LOOPBACK_HOST:
        return "host_must_be_127.0.0.1"
    for key in FORBIDDEN_EXPORT_ENV:
        if env.get(key):
            return "otel_exporter_forbidden" if key.startswith("OTEL_") else "hosted_exporter_forbidden"
    telemetry = env.get("PHOENIX_TELEMETRY_ENABLED", "false").strip().lower()
    if telemetry not in {"0", "false"}:
        return "telemetry_must_be_disabled"
    return None


def _check_dependencies(
    version_resolver: Callable[[str], str],
    import_resolver: Callable[[str], Any],
) -> tuple[int, str, dict[str, Any] | None]:
    modules: dict[str, Any] = {}
    for package, expected in EXPECTED_VERSIONS.items():
        try:
            actual = version_resolver(package)
        except Exception:
            return 2, f"PHOENIX_CHECK_DEPENDENCY_MISSING package={package} {INSTALL}", None
        if actual != expected:
            return 3, (
                f"PHOENIX_CHECK_VERSION_MISMATCH package={package} expected={expected} "
                f"actual={actual} {INSTALL}"
            ), None
        try:
            modules[package] = import_resolver(IMPORTS[package])
        except Exception:
            return 2, f"PHOENIX_CHECK_DEPENDENCY_MISSING package={package} {INSTALL}", None
    return 0, "", modules


def _default_launcher(phoenix_module: Any, _env: MutableMapping[str, str]) -> Any:
    return phoenix_module.launch_app(host=LOOPBACK_HOST)


def main(
    argv: Sequence[str] | None = None,
    *,
    env: MutableMapping[str, str] | None = None,
    version_resolver: Callable[[str], str] = importlib.metadata.version,
    import_resolver: Callable[[str], Any] = importlib.import_module,
    launcher: Callable[[Any, MutableMapping[str, str]], Any] | None = None,
    stdout: TextIO = sys.stdout,
    stderr: TextIO = sys.stderr,
) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    launch_env = os.environ if env is None else env

    if not args.check and launch_env.get(OPT_IN) != "1":
        print("PHOENIX_START_OPT_IN_REQUIRED set QUESTIONTRACE_PHOENIX_LOCAL=1", file=stdout)
        return 5

    reason = _unsafe_reason(launch_env)
    if reason:
        print(f"PHOENIX_CHECK_UNSAFE_CONFIG reason={reason}", file=stdout)
        return 4

    code, message, modules = _check_dependencies(version_resolver, import_resolver)
    if code:
        print(message, file=stdout)
        return code

    if args.check:
        print(
            "PHOENIX_CHECK_OK arize-phoenix=17.26.0 opentelemetry-sdk=1.43.0 "
            "host=127.0.0.1 telemetry=disabled exporter=none "
            "opt_in=QUESTIONTRACE_PHOENIX_LOCAL",
            file=stdout,
        )
        return 0

    launch_env["PHOENIX_HOST"] = LOOPBACK_HOST
    launch_env["PHOENIX_TELEMETRY_ENABLED"] = "false"
    for key in FORBIDDEN_EXPORT_ENV:
        launch_env.pop(key, None)
    assert modules is not None
    (launcher or _default_launcher)(modules["arize-phoenix"], launch_env)
    print("PHOENIX_START_OK host=127.0.0.1 telemetry=disabled exporter=none", file=stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
