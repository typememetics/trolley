import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class SetupTests(unittest.TestCase):
    def run_setup(self, answer, package_status=0, import_status=0):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / "calls"
            for name, status in [("omarchy", package_status), ("python", import_status)]:
                command = root / name
                command.write_text(
                    '#!/bin/bash\nprintf "%s\\n" "$0 $*" >> "$SETUP_TEST_LOG"\n'
                    f"exit {status}\n"
                )
                command.chmod(0o755)
            result = subprocess.run(
                ["bash", str(Path(__file__).with_name("setup.sh"))],
                input=answer, text=True, capture_output=True,
                env={**os.environ, "PATH": f"{root}:{os.environ['PATH']}",
                     "SETUP_TEST_LOG": str(log)},
                timeout=5,
            )
            return result, log.read_text() if log.exists() else ""

    def test_declining_or_closing_prompt_runs_no_commands(self):
        for answer in ["n\n", "\n", "", "anything\n"]:
            with self.subTest(answer=answer):
                result, calls = self.run_setup(answer)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(calls, "")

    def test_confirmation_installs_fixed_packages_and_checks_import(self):
        result, calls = self.run_setup("y\n")
        self.assertEqual(result.returncode, 0)
        self.assertIn("omarchy pkg add pyside6 qt6-webengine\n", calls)
        self.assertIn("python -c from PySide6.QtWebEngineWidgets import QWebEngineView\n", calls)

    def test_package_failure_stops_before_import(self):
        result, calls = self.run_setup("yes\n\n", package_status=1)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("python", calls)
        self.assertIn("Setup failed", result.stderr)

    def test_import_failure_is_reported(self):
        result, _ = self.run_setup("Y\n\n", import_status=1)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Setup failed", result.stderr)
