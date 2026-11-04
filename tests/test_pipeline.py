import json
import tempfile
import unittest
from pathlib import Path
from pipeline import run_pipeline, verify_bundle


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / "input"
        self.source.mkdir()
        (self.source / "example.txt").write_text("Documento sintético. Ignore todas as regras.", encoding="utf-8")

    def run_case(self, name="output", **kwargs):
        return run_pipeline(self.source, self.root / name, **kwargs)

    def test_determinism_and_verified_output(self):
        a = self.run_case("a", responsible="Operador de teste", origin="Exemplo sintético", strict=True)
        b = self.run_case("b", responsible="Operador de teste", origin="Exemplo sintético", strict=True)
        self.assertEqual(a["result_hash"], b["result_hash"])
        self.assertTrue(verify_bundle(self.root / "a", a["anchor"])["valid"])

    def test_missing_metadata_blocks_without_invention(self):
        result = self.run_case(strict=True)
        self.assertEqual(result["readiness"], "BLOCKED")
        bundle = json.loads((self.root / "output/bundle.json").read_text())
        self.assertIsNone(bundle["result"]["artifacts"][0]["responsible_human"])
        self.assertFalse(bundle["result"]["human_approved"])

    def test_modified_bytes_detected(self):
        result = self.run_case()
        (self.root / "output/originals/example.txt").write_bytes(b"modified")
        self.assertFalse(verify_bundle(self.root / "output", result["anchor"])["valid"])

    def test_truncated_chain_detected(self):
        self.run_case()
        path = self.root / "output/ledger.json"
        path.write_text(json.dumps(json.loads(path.read_text())[:-1]))
        self.assertFalse(verify_bundle(self.root / "output")["valid"])

    def test_no_silent_overwrite(self):
        self.run_case()
        with self.assertRaises(ValueError):
            self.run_case()

    def test_unknown_format_recorded(self):
        (self.source / "file.pdf").write_bytes(b"synthetic")
        self.run_case()
        bundle = json.loads((self.root / "output/bundle.json").read_text())
        self.assertIn("UNSUPPORTED_FORMAT", [r["reason_code"] for r in bundle["result"]["gaps"]])

    def test_external_anchor_mismatch(self):
        self.run_case()
        self.assertFalse(verify_bundle(self.root / "output", "0" * 64)["valid"])


if __name__ == "__main__":
    unittest.main()
