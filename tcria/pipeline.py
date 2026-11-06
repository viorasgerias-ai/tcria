"""Pipeline local de evidências. Python 3.11+, somente biblioteca padrão."""
import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

VERSION = "0.2.0"


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_bytes(canonical(value) + b"\n")


def field_state(value):
    if value is None:
        return "MISSING"
    if not isinstance(value, str):
        return "INVALID"
    return "PRESENT" if value.strip() else "EMPTY"


def _run_pipeline(input_dir, output_dir, responsible=None, origin=None, strict=False):
    """Preserva arquivos, aplica regras explícitas e exporta bundle e ledger."""
    input_dir = Path(input_dir).resolve()
    output_dir = Path(output_dir).resolve()
    if not input_dir.is_dir():
        raise ValueError("Diretório de entrada inexistente")
    if output_dir == input_dir or input_dir in output_dir.parents:
        raise ValueError("Saída deve ficar fora da árvore de entrada")
    if output_dir.exists():
        raise ValueError("Saída já existe; use um diretório novo para preservar o histórico")
    paths = sorted(input_dir.rglob("*"))
    if any(p.is_symlink() for p in paths):
        raise ValueError("Links simbólicos não são aceitos nesta versão")
    paths = [p for p in paths if p.is_file()]
    if not paths:
        raise ValueError("Nenhum arquivo de entrada")
    output_dir.mkdir(parents=True)
    originals = output_dir / "originals"
    originals.mkdir()
    artifacts, results, events = [], [], []

    def record(kind, payload):
        event = {"schema_version": 1, "module_id": "core", "sequence": len(events),
                 "event_type": kind, "payload": payload,
                 "previous_hash": events[-1]["event_hash"] if events else None}
        event["event_hash"] = digest(canonical(event))
        events.append(event)

    for index, path in enumerate(paths):
        data = path.read_bytes()
        artifact_id = f"artifact-{index:06d}"
        saved_path = f"originals/{path.relative_to(input_dir).as_posix()}"
        (output_dir / saved_path).parent.mkdir(parents=True, exist_ok=True)
        (output_dir / saved_path).write_bytes(data)
        artifact = {"artifact_id": artifact_id, "source_path": path.relative_to(input_dir).as_posix(),
                    "stored_path": saved_path, "original_sha256": digest(data),
                    "byte_length": len(data), "media_type": {".txt": "text/plain", ".md": "text/markdown", ".json": "application/json"}.get(path.suffix.lower(), "application/octet-stream"), "responsible_human": responsible,
                    "declared_origin": origin}
        artifacts.append(artifact)
        record("INGESTED", artifact)
        for field, value in (("responsible_human", responsible), ("declared_origin", origin)):
            state = field_state(value)
            results.append({"artifact_id": artifact_id, "rule_id": f"required.{field}",
                            "rule_version": 1, "status": "PASS" if state == "PRESENT" else "FAIL",
                            "reason_code": state, "evidence_ref": f"{artifact_id}.{field}"})
        suffix = path.suffix.lower()
        extraction = {"artifact_id": artifact_id, "rule_id": "extract.supported_text",
                      "rule_version": 1, "extractor_version": "utf8-json-v1",
                      "evidence_ref": f"{artifact_id}.original_sha256",
                      "status": "UNKNOWN", "reason_code": "UNSUPPORTED_FORMAT"}
        if suffix in {".txt", ".md", ".json"}:
            try:
                content = data.decode("utf-8")
                if suffix == ".json":
                    json.loads(content, parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s)))
                extraction.update(status="PASS" if content.strip() else "UNKNOWN",
                                  reason_code="EXTRACTED" if content.strip() else "EMPTY_TEXT",
                                  extracted_text_hash=digest(content.encode("utf-8")))
            except (UnicodeError, ValueError):
                extraction.update(status="FAIL", reason_code="INVALID_TEXT_OR_JSON")
        results.append(extraction)
        # These are literal markers, never an inference about authenticity.
        for rule_id, pattern in (("trace.date", r"\b(?:\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})\b"),
                                 ("trace.reference", r"(?i)\b(?:referência|referencia|processo|protocolo)\s*[:#]\s*\S+")):
            matches = []
            extracted = extraction["reason_code"] in {"EXTRACTED", "EMPTY_TEXT"}
            if extracted:
                matches = [{"start": m.start(), "end": m.end(), "text": m.group()}
                           for m in re.finditer(pattern, content)]
            results.append({"artifact_id": artifact_id, "rule_id": rule_id, "rule_version": 1,
                            "status": "PASS" if matches else "UNKNOWN",
                            "reason_code": "LITERAL_MARKER_FOUND" if matches else
                                           ("MARKER_ABSENT" if extracted else "EXTRACTION_UNAVAILABLE"),
                            "evidence_ref": f"{artifact_id}.original_sha256", "matches": matches})
        results.append({"artifact_id": artifact_id, "rule_id": "prescriptiveGate", "rule_version": 1,
                        "status": "UNKNOWN", "reason_code": "RULE_NOT_PROVIDED",
                        "evidence_ref": f"{artifact_id}.original_sha256"})
    result = {"schema_version": 1, "engine_version": VERSION,
              "rule_set": "metadata-text-literal-trace-v2", "strict": strict,
              "artifacts": artifacts, "checks": results,
              "gaps": [r for r in results if r["status"] != "PASS"],
              "readiness": "READY_FOR_REVIEW" if all(r["status"] == "PASS" for r in results)
                           else ("BLOCKED" if strict else "REVIEW_WITH_GAPS"),
              "human_approved": False}
    result_hash = digest(canonical(result))
    record("AUDITED", {"result_hash": result_hash})
    bundle = {"result": result, "result_hash": result_hash,
              "ledger_head": events[-1]["event_hash"], "event_count": len(events)}
    write_json(output_dir / "bundle.json", bundle)
    write_json(output_dir / "ledger.json", events)
    anchor = digest(canonical(bundle))
    (output_dir / "anchor.sha256").write_text(anchor + "\n", encoding="utf-8")
    lines = ["# Relatório operacional", "", f"Estado: {result['readiness']}",
             "", "Aprovação humana: não registrada.", "",
             "| Artefato | Regra | Estado | Motivo |", "|---|---|---|---|"]
    lines += [f"| {r['artifact_id']} | {r['rule_id']} | {r['status']} | {r['reason_code']} |" for r in results]
    lines += ["", "## Limites", "", "Metadados são declarações, não autenticação. "
              "Hashes verificam integridade contra referência, não a verdade dos fatos. "
              "A âncora local deve ser copiada para local protegido independente. "
              "Este protótipo usa um único módulo e não implementa isolamento entre serviços."]
    (output_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"output_dir": str(output_dir), "readiness": result["readiness"],
            "result_hash": result_hash, "anchor": anchor}


def verify_bundle(directory, trusted_anchor=None):
    """Valida bytes, resultado e ledger; âncora confiável vem de fora do bundle."""
    directory = Path(directory).resolve()
    bundle = json.loads((directory / "bundle.json").read_text(encoding="utf-8"))
    if bundle["result"].get("engine_version") == VERSION and not (directory / "COMPLETE").is_file():
        raise ValueError("Execução incompleta; preserve a pasta para diagnóstico")
    events = json.loads((directory / "ledger.json").read_text(encoding="utf-8"))
    errors = []
    anchor = digest(canonical(bundle))
    if trusted_anchor is not None and anchor != trusted_anchor:
        errors.append("TRUSTED_ANCHOR_MISMATCH")
    if digest(canonical(bundle["result"])) != bundle["result_hash"]:
        errors.append("RESULT_HASH_MISMATCH")
    for artifact in bundle["result"]["artifacts"]:
        path = (directory / artifact["stored_path"]).resolve()
        if directory not in path.parents:
            errors.append("UNSAFE_ARTIFACT_PATH")
            continue
        if not path.is_file():
            errors.append("MISSING_ARTIFACT:" + artifact["artifact_id"])
        elif path.stat().st_size != artifact["byte_length"] or digest(path.read_bytes()) != artifact["original_sha256"]:
            errors.append("ARTIFACT_HASH_MISMATCH:" + artifact["artifact_id"])
    previous = None
    for index, event in enumerate(events):
        unsigned = {k: v for k, v in event.items() if k != "event_hash"}
        if (event["sequence"] != index or event["previous_hash"] != previous
                or digest(canonical(unsigned)) != event["event_hash"]):
            errors.append(f"LEDGER_MISMATCH:{index}")
        previous = event["event_hash"]
    if len(events) != bundle["event_count"] or previous != bundle["ledger_head"]:
        errors.append("LEDGER_HEAD_OR_COUNT_MISMATCH")
    if not events or events[-1]["payload"] != {"result_hash": bundle["result_hash"]}:
        errors.append("AUDIT_LINK_MISMATCH")
    ingested = [e["payload"] for e in events if e["event_type"] == "INGESTED"]
    if ingested != bundle["result"]["artifacts"]:
        errors.append("INGESTION_LINK_MISMATCH")
    return {"valid": not errors, "errors": errors, "anchor": anchor,
            "scope": "TRUSTED_REFERENCE" if trusted_anchor else "INTERNAL_CONSISTENCY_ONLY"}


def run_pipeline(input_dir, output_dir, responsible=None, origin=None, strict=False):
    """Reserva saída exclusiva; COMPLETE só é publicado após todos os arquivos."""
    source, target = Path(input_dir).resolve(), Path(output_dir).resolve()
    if not source.is_dir() or target == source or source in target.parents:
        raise ValueError("Entrada inválida ou saída dentro da entrada")
    try:
        target.mkdir(parents=True, exist_ok=False)
    except FileExistsError as exc:
        raise ValueError("Saída já existe; use um diretório novo") from exc
    result = _run_pipeline(source, target / ".pending", responsible, origin, strict)
    for item in (target / ".pending").iterdir():
        os.replace(item, target / item.name)
    (target / ".pending").rmdir()
    (target / "COMPLETE").write_text(VERSION + "\n", encoding="utf-8")
    result["output_dir"] = str(target)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run")
    run.add_argument("input_dir")
    run.add_argument("output_dir")
    run.add_argument("--responsible")
    run.add_argument("--origin")
    run.add_argument("--strict", action="store_true")
    verify = commands.add_parser("verify")
    verify.add_argument("directory")
    verify.add_argument("--trusted-anchor")
    restore = commands.add_parser("restore", help="Devolver cópias às subpastas de origem")
    restore.add_argument("directory")
    restore.add_argument("destination", help="Pasta original ou nova raiz de exportação")
    restore.add_argument("--trusted-anchor", required=True)
    restore.add_argument("--dry-run", action="store_true")
    review = commands.add_parser("review", help="Registrar decisão humana separada")
    review.add_argument("directory")
    review.add_argument("--records-dir", required=True)
    review.add_argument("--trusted-anchor", required=True)
    review.add_argument("--responsible", required=True)
    review.add_argument("--decision", choices=["APPROVE", "REJECT", "REQUEST_CHANGES"], required=True)
    review.add_argument("--reason", required=True)
    check_review = commands.add_parser("verify-review")
    check_review.add_argument("directory")
    check_review.add_argument("record")
    check_review.add_argument("--trusted-anchor", required=True)
    args = parser.parse_args()
    try:
        if args.command == "run":
            result = run_pipeline(args.input_dir, args.output_dir, args.responsible, args.origin, args.strict)
            exit_code = 2 if result["readiness"] == "BLOCKED" else 0
        elif args.command == "restore":
            from .custody import restore_bundle
            result = restore_bundle(args.directory, args.destination, args.trusted_anchor, args.dry_run)
            exit_code = 0
        elif args.command == "review":
            from .custody import record_review
            result = record_review(args.directory, args.records_dir, args.trusted_anchor,
                                   args.responsible, args.decision, args.reason)
            exit_code = 0
        elif args.command == "verify-review":
            from .custody import verify_review
            result = verify_review(args.directory, args.record, args.trusted_anchor)
            exit_code = 0 if result["valid"] else 1
        else:
            result = verify_bundle(args.directory, args.trusted_anchor)
            exit_code = 0 if result["valid"] else 1
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return exit_code
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
