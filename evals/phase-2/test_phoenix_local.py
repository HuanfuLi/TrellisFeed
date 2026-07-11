"""Executable contract tests for the opt-in, loopback-only Phoenix launcher."""

from __future__ import annotations

import importlib.util
import io
import pathlib
import socket
import unittest
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).with_name("phoenix-local.py")


def load_module():
    spec = importlib.util.spec_from_file_location("questiontrace_phoenix_local", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class FakePhoenix:
    def __init__(self):
        self.calls = []

    def launch_app(self, **kwargs):
        self.calls.append(kwargs)
        return object()


class PhoenixLocalContractTests(unittest.TestCase):
    def setUp(self):
        self.module = load_module()

    def invoke(self, argv, *, env=None, versions=None, imports=None, launcher=None):
        stdout = io.StringIO()
        stderr = io.StringIO()
        versions = versions or {
            "arize-phoenix": "17.26.0",
            "opentelemetry-sdk": "1.43.0",
        }
        imports = imports or {"phoenix": object(), "opentelemetry.sdk": object()}
        code = self.module.main(
            argv,
            env={} if env is None else env,
            version_resolver=lambda name: versions[name],
            import_resolver=lambda name: imports[name],
            launcher=launcher,
            stdout=stdout,
            stderr=stderr,
        )
        return code, stdout.getvalue(), stderr.getvalue()

    def test_check_exact_versions_prints_complete_success_contract(self):
        code, stdout, stderr = self.invoke(["--check"])
        self.assertEqual(code, 0)
        self.assertEqual(
            stdout,
            "PHOENIX_CHECK_OK arize-phoenix=17.26.0 opentelemetry-sdk=1.43.0 "
            "host=127.0.0.1 telemetry=disabled exporter=none "
            "opt_in=QUESTIONTRACE_PHOENIX_LOCAL\n",
        )
        self.assertEqual(stderr, "")

    def test_check_missing_distribution_or_import_is_exact_exit_2(self):
        install = ' install="python -m pip install --requirement evals/phase-2/requirements.txt"\n'
        for package, versions, imports in [
            ("arize-phoenix", {"opentelemetry-sdk": "1.43.0"}, {"phoenix": object(), "opentelemetry.sdk": object()}),
            ("opentelemetry-sdk", {"arize-phoenix": "17.26.0", "opentelemetry-sdk": "1.43.0"}, {"phoenix": object()}),
        ]:
            with self.subTest(package=package):
                code, stdout, stderr = self.invoke(["--check"], versions=versions, imports=imports)
                self.assertEqual(code, 2)
                self.assertEqual(stdout, f"PHOENIX_CHECK_DEPENDENCY_MISSING package={package}" + install)
                self.assertEqual(stderr, "")

    def test_check_version_mismatch_is_exact_exit_3(self):
        code, stdout, stderr = self.invoke(
            ["--check"],
            versions={"arize-phoenix": "17.25.0", "opentelemetry-sdk": "1.43.0"},
        )
        self.assertEqual(code, 3)
        self.assertEqual(
            stdout,
            'PHOENIX_CHECK_VERSION_MISMATCH package=arize-phoenix expected=17.26.0 '
            'actual=17.25.0 install="python -m pip install --requirement evals/phase-2/requirements.txt"\n',
        )
        self.assertEqual(stderr, "")

    def test_check_rejects_each_unsafe_environment_with_exact_exit_4(self):
        cases = [
            ({"PHOENIX_HOST": "0.0.0.0"}, "host_must_be_127.0.0.1"),
            ({"PHOENIX_COLLECTOR_ENDPOINT": "https://app.phoenix.arize.com"}, "hosted_exporter_forbidden"),
            ({"OTEL_EXPORTER_OTLP_ENDPOINT": "http://collector:4317"}, "otel_exporter_forbidden"),
            ({"PHOENIX_TELEMETRY_ENABLED": "true"}, "telemetry_must_be_disabled"),
        ]
        for env, reason in cases:
            with self.subTest(reason=reason):
                code, stdout, stderr = self.invoke(["--check"], env=env)
                self.assertEqual(code, 4)
                self.assertEqual(stdout, f"PHOENIX_CHECK_UNSAFE_CONFIG reason={reason}\n")
                self.assertEqual(stderr, "")

    def test_start_requires_opt_in_before_import_or_launch(self):
        imports = mock.Mock(side_effect=AssertionError("dependency import must not occur"))
        stdout = io.StringIO()
        stderr = io.StringIO()
        code = self.module.main(
            [], env={}, version_resolver=mock.Mock(side_effect=AssertionError("version lookup must not occur")),
            import_resolver=imports, launcher=mock.Mock(), stdout=stdout, stderr=stderr,
        )
        self.assertEqual(code, 5)
        self.assertEqual(stdout.getvalue(), "PHOENIX_START_OPT_IN_REQUIRED set QUESTIONTRACE_PHOENIX_LOCAL=1\n")
        self.assertEqual(stderr.getvalue(), "")
        imports.assert_not_called()

    def test_enabled_start_forces_loopback_disables_telemetry_and_never_exports(self):
        phoenix = FakePhoenix()
        env = {
            "QUESTIONTRACE_PHOENIX_LOCAL": "1",
            "PHOENIX_HOST": "127.0.0.1",
            "PHOENIX_TELEMETRY_ENABLED": "false",
        }
        with mock.patch.object(socket, "create_connection", side_effect=AssertionError("network egress")), mock.patch.object(socket.socket, "connect", side_effect=AssertionError("network egress")):
            code, stdout, stderr = self.invoke(
                [], env=env, imports={"phoenix": phoenix, "opentelemetry.sdk": object()},
                launcher=lambda module, launch_env: module.launch_app(host="127.0.0.1"),
            )
        self.assertEqual(code, 0)
        self.assertEqual(stdout, "PHOENIX_START_OK host=127.0.0.1 telemetry=disabled exporter=none\n")
        self.assertEqual(stderr, "")
        self.assertEqual(phoenix.calls, [{"host": "127.0.0.1"}])
        self.assertEqual(env["PHOENIX_HOST"], "127.0.0.1")
        self.assertEqual(env["PHOENIX_TELEMETRY_ENABLED"], "false")
        self.assertNotIn("OTEL_EXPORTER_OTLP_ENDPOINT", env)
        self.assertNotIn("PHOENIX_COLLECTOR_ENDPOINT", env)


if __name__ == "__main__":
    unittest.main()
