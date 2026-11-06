import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

import unittest
from tests import test_pipeline
from tcria.custody import restore_bundle, record_review, verify_review, safe_path
from tcria.pipeline import canonical, digest, field_state, run_pipeline, verify_bundle


class CustodyTests(unittest.TestCase):
    setUp = test_pipeline.PipelineTests.setUp
    run_case = test_pipeline.PipelineTests.run_case

    def test_nested_paths_and_identical_names_round_trip(self):
        for folder, content in (("a", b"first"), ("b", b"second")):
            (self.source / folder).mkdir()
            (self.source / folder / "same.txt").write_bytes(content)
        before = {p.relative_to(self.source): p.read_bytes() for p in self.source.rglob("*") if p.is_file()}
        result = self.run_case()
        destination = self.root / "returned"
        plan = restore_bundle(self.root / "output", destination, result["anchor"], True)
        self.assertFalse(destination.exists())
        self.assertTrue(all(f["action"] == "COPY" for f in plan["files"]))
        restore_bundle(self.root / "output", destination, result["anchor"])
        self.assertEqual(before, {p.relative_to(destination): p.read_bytes() for p in destination.rglob("*") if p.is_file()})
        self.assertEqual(before, {p.relative_to(self.source): p.read_bytes() for p in self.source.rglob("*") if p.is_file()})
        unchanged = restore_bundle(self.root / "output", self.source, result["anchor"])
        self.assertTrue(all(f["action"] == "UNCHANGED" for f in unchanged["files"]))

    def test_collision_preflight_does_not_write_any_file(self):
        (self.source / "aaa.txt").write_bytes(b"earlier file")
        result = self.run_case()
        (self.source / "example.txt").write_bytes(b"changed")
        (self.source / "aaa.txt").unlink()
        with self.assertRaises(ValueError):
            restore_bundle(self.root / "output", self.source, result["anchor"])
        self.assertFalse((self.source / "aaa.txt").exists())
        self.assertEqual((self.source / "example.txt").read_bytes(), b"changed")

    def test_restore_rejects_tampered_bundle(self):
        result = self.run_case()
        (self.root / "output/originals/example.txt").write_bytes(b"modified")
        with self.assertRaises(ValueError):
            restore_bundle(self.root / "output", self.root / "returned", result["anchor"])
        self.assertFalse((self.root / "returned").exists())

    def test_path_traversal_and_symlink_rejected(self):
        for path in ("../escape", "/tmp/escape", "a/../../escape", "C:\\escape", "a//b", "."):
            with self.assertRaises(ValueError):
                safe_path(self.root, path)
        (self.root / "link").symlink_to(self.source, target_is_directory=True)
        with self.assertRaises(ValueError):
            safe_path(self.root, "link/example.txt")
        with self.assertRaises(ValueError):
            safe_path(self.root / "link", "example.txt")

    def test_source_symlink_rejected(self):
        (self.source / "link.txt").symlink_to(self.source / "example.txt")
        with self.assertRaises(ValueError):
            self.run_case()

    def test_concurrent_runs_only_one_writer(self):
        def attempt(_):
            try:
                return self.run_case()["anchor"]
            except ValueError:
                return None
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(attempt, range(2)))
        self.assertEqual(sum(x is not None for x in outcomes), 1)
        self.assertTrue(verify_bundle(self.root / "output")["valid"])

    def test_interrupted_run_cannot_verify_or_overwrite(self):
        with patch("tcria.pipeline.write_json", side_effect=OSError("interrupted")):
            with self.assertRaises(OSError):
                self.run_case()
        self.assertFalse((self.root / "output/COMPLETE").exists())
        with self.assertRaises((ValueError, OSError)):
            verify_bundle(self.root / "output")
        with self.assertRaises(ValueError):
            self.run_case()

    def test_review_is_separate_and_cannot_migrate(self):
        a = self.run_case()
        path = self.root / "output/bundle.json"
        before = path.read_bytes()
        review = record_review(self.root / "output", self.root / "reviews", a["anchor"],
                               "Operador sintético", "REQUEST_CHANGES", "Regras pendentes")
        self.assertEqual(before, path.read_bytes())
        self.assertTrue(verify_review(self.root / "output", review["record"], a["anchor"])["valid"])
        (self.source / "new.txt").write_bytes(b"new")
        b = self.run_case("other")
        self.assertIn("REVIEW_BUNDLE_MISMATCH", verify_review(self.root / "other", review["record"], b["anchor"])["errors"])
        record = json.loads(Path(review["record"]).read_text())
        record["decision"] = "APPROVE"
        Path(review["record"]).write_text(json.dumps(record))
        self.assertIn("REVIEW_HASH_MISMATCH", verify_review(self.root / "output", review["record"], a["anchor"])["errors"])

    def test_metadata_states_and_canonical_json(self):
        self.assertEqual([field_state(x) for x in (None, "", 42, "Name")],
                         ["MISSING", "EMPTY", "INVALID", "PRESENT"])
        with self.assertRaises(ValueError):
            canonical({"x": float("nan")})

    def test_undefined_rule_and_absent_markers_stay_unknown(self):
        self.run_case(responsible="Synthetic", origin="Synthetic", strict=True)
        result = json.loads((self.root / "output/bundle.json").read_text())["result"]
        self.assertEqual(result["readiness"], "BLOCKED")
        for rule in ("trace.date", "trace.reference", "prescriptiveGate"):
            self.assertEqual(next(c["status"] for c in result["checks"] if c["rule_id"] == rule), "UNKNOWN")

    def test_literal_markers_have_exact_offsets(self):
        text = "Documento 2026-11-04. Processo: ABC-123."
        (self.source / "example.txt").write_text(text)
        self.run_case()
        result = json.loads((self.root / "output/bundle.json").read_text())["result"]
        for check in result["checks"]:
            for match in check.get("matches", []):
                self.assertEqual(text[match["start"]:match["end"]], match["text"])

    def test_invalid_encoding_and_json_reported(self):
        (self.source / "invalid.txt").write_bytes(b"\xff")
        (self.source / "invalid.json").write_text('{"x":NaN}')
        self.run_case()
        result = json.loads((self.root / "output/bundle.json").read_text())["result"]
        self.assertEqual(sum(c["reason_code"] == "INVALID_TEXT_OR_JSON" for c in result["checks"]), 2)

    def test_intermediate_event_tamper(self):
        self.run_case()
        path = self.root / "output/ledger.json"
        events = json.loads(path.read_text())
        events[0]["payload"]["declared_origin"] = "modified"
        path.write_text(json.dumps(events))
        self.assertFalse(verify_bundle(self.root / "output")["valid"])

    def test_complete_rewrite_detected_against_external_anchor(self):
        a = self.run_case("a")
        (self.source / "example.txt").write_bytes(b"different")
        self.run_case("b")
        self.assertTrue(verify_bundle(self.root / "b")["valid"])
        self.assertFalse(verify_bundle(self.root / "b", a["anchor"])["valid"])
