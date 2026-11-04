import gc
import importlib.util
import json
import tempfile
import time
import tkinter as tk
import tomllib
import unittest
from pathlib import Path
from unittest.mock import patch

from tcria.desktop import APP_VERSION, Desktop, anchor_value, save_reference

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("desktop_build", ROOT / "scripts/build_desktop.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class DesktopContractTests(unittest.TestCase):
    def test_anchor_format(self):
        self.assertEqual(anchor_value(" A" + "A" * 63 + "\n"), "a" * 64)
        for value in ("", "../abc", "z" * 64, "a" * 63):
            with self.assertRaises(ValueError):
                anchor_value(value)

    def test_reference_must_be_independent_and_never_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            bundle = base / "result"
            bundle.mkdir()
            with self.assertRaises(ValueError):
                save_reference(bundle / "anchor.sha256", bundle, "a" * 64)
            outside = base / "external.sha256"
            save_reference(outside, bundle, "a" * 64)
            self.assertEqual(outside.read_text(), "a" * 64 + "\n")
            with self.assertRaises(FileExistsError):
                save_reference(outside, bundle, "b" * 64)
            with self.assertRaises(ValueError):
                save_reference(base / "invalid.sha256", bundle, "invalid")
            self.assertFalse((base / "invalid.sha256").exists())

    def test_native_targets_and_version(self):
        self.assertEqual(build.installer_name(build.target_info("win32", "AMD64")), "oranizator-igualizator-0.3.0-windows-x64-setup.exe")
        self.assertEqual(build.installer_name(build.target_info("darwin", "arm64")), "oranizator-igualizator-0.3.0-macos-arm64.dmg")
        self.assertEqual(build.installer_name(build.target_info("darwin", "x86_64")), "oranizator-igualizator-0.3.0-macos-x86_64.dmg")
        with self.assertRaises(ValueError):
            build.target_info("linux", "x86_64")
        self.assertEqual(APP_VERSION, tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]["version"])


class DesktopWindowTests(unittest.TestCase):
    def setUp(self):
        try:
            self.root = tk.Tk()
        except tk.TclError as exc:
            self.skipTest("Tela gráfica indisponível: " + str(exc))
        self.root.withdraw()
        self.addCleanup(self.teardown_tk)
        self.app = Desktop(self.root)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name).resolve()
        self.source = self.base / "entrada"
        self.source.mkdir()
        (self.source / "doc.txt").write_text("Exemplo sintético. 2026-11-04. Processo: ABC.")

    def teardown_tk(self):
        # Join the worker, then destroy and collect Tk on the main thread to
        # avoid Tcl_AsyncDelete aborts on macOS.
        worker = getattr(self.app, "worker", None)
        if worker is not None:
            worker.join(10)
        if getattr(self.app, "poll_id", None):
            try:
                self.root.after_cancel(self.app.poll_id)
            except tk.TclError:
                pass
        self.root.destroy()
        del self.app, self.root
        gc.collect()

    def wait(self):
        deadline = time.monotonic() + 10
        while self.app.busy and time.monotonic() < deadline:
            self.root.update()
            time.sleep(0.01)
        self.assertFalse(self.app.busy, "A interface não recebeu a conclusão da operação")

    def test_organize_verify_restore_and_review_via_interface(self):
        self.app.source.set(str(self.source))
        self.app.output.set(str(self.base / "resultado"))
        self.app.responsible.set("Operador sintético")
        self.app.origin.set("Teste sintético")
        with patch("tcria.desktop.messagebox.showerror") as error:
            self.app.organize()
            self.wait()
            self.assertEqual(len(self.app.anchor.get()), 64)
            self.app.verify()
            self.wait()
            self.assertIn("Integridade conferida", self.app.status.get())
            self.app.destination.set(str(self.base / "devolucao"))
            self.app.restore(True)
            self.wait()
            self.assertFalse((self.base / "devolucao").exists())
            self.app.restore(False)
            self.wait()
            self.assertEqual((self.base / "devolucao/doc.txt").read_bytes(), (self.source / "doc.txt").read_bytes())
            self.app.records.set(str(self.base / "revisoes"))
            self.app.reviewer.set("Revisor sintético")
            self.app.reason.set("Teste sintético")
            self.app.review()
            self.wait()
            self.assertTrue(Path(self.app.review_file.get()).exists())
            self.app.check_review()
            self.wait()
            self.assertIn("conferidos", self.app.status.get())
            error.assert_not_called()

    def test_failed_integrity_is_visible_and_busy_close_is_refused(self):
        with patch("tcria.desktop.messagebox.showinfo") as info:
            self.app.busy = True
            self.app.close()
            info.assert_called_once()
            self.assertTrue(self.root.winfo_exists())
            self.app.busy = False
        self.app.bundle.set(str(self.base / "missing"))
        self.app.anchor.set("a" * 64)
        with patch("tcria.desktop.messagebox.showerror") as error:
            self.app.verify()
            self.wait()
            error.assert_called_once()
            self.assertIn("falhou", self.app.status.get())
