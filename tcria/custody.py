"""Devolução conservadora e decisões humanas separadas do resultado técnico."""
import json
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from uuid import uuid4

from .pipeline import canonical, digest, field_state, verify_bundle


def checked_bundle(directory, anchor):
    if not isinstance(anchor, str) or len(anchor) != 64:
        raise ValueError("Âncora independente SHA-256 obrigatória")
    verification = verify_bundle(directory, anchor)
    if not verification["valid"]:
        raise ValueError("Bundle inválido: " + ", ".join(verification["errors"]))
    return json.loads((Path(directory) / "bundle.json").read_text(encoding="utf-8"))


def safe_path(root, relative):
    """Recusa travessia e symlinks, inclusive links internos e raiz."""
    if not isinstance(relative, str) or "\\" in relative or ":" in relative:
        raise ValueError("Caminho inválido")
    parts = PurePosixPath(relative)
    if parts.is_absolute() or not parts.parts or any(p in {"", ".", ".."} for p in relative.split("/")):
        raise ValueError("Caminho fora da raiz")
    root = Path(root).absolute()
    for parent in [root, *root.parents]:
        if parent.is_symlink():
            raise ValueError("Links simbólicos não são aceitos")
    path = root
    for part in parts.parts:
        path = path / part
        if path.is_symlink():
            raise ValueError("Links simbólicos não são aceitos")
    return path


def restore_bundle(directory, destination, trusted_anchor, dry_run=False):
    """Copia bytes validados, sem apagar a origem e sem substituir divergências.

    Preflight cobre o lote completo. Concorrência hostil nas pastas de destino
    requer controle de acesso do sistema operacional; não é suportada.
    """
    bundle = checked_bundle(directory, trusted_anchor)
    root = Path(destination).absolute()
    bundle_root = Path(directory).resolve()
    if root.resolve() == bundle_root or bundle_root in root.resolve().parents:
        raise ValueError("Destino não pode ficar dentro do bundle")
    plan, destinations = [], set()
    for artifact in bundle["result"]["artifacts"]:
        target = safe_path(root, artifact["source_path"])
        source = safe_path(bundle_root, artifact["stored_path"])
        if target in destinations:
            raise ValueError("Caminho de origem duplicado")
        destinations.add(target)
        for parent in target.parents:
            if parent.exists() and not parent.is_dir():
                raise ValueError("Pasta de destino ocupada por arquivo")
        if target.exists():
            if not target.is_file() or digest(target.read_bytes()) != artifact["original_sha256"]:
                raise ValueError("Conflito; arquivo preservado: " + str(target))
            action = "UNCHANGED"
        else:
            action = "COPY"
        plan.append((source, target, artifact, action))
    for _, target, _, _ in plan:
        if any(other != target and target in other.parents for other in destinations):
            raise ValueError("Conflito entre arquivo e pasta no manifesto")
    if not dry_run:
        for source, target, artifact, action in plan:
            if action == "UNCHANGED":
                continue
            data = source.read_bytes()
            if digest(data) != artifact["original_sha256"]:
                raise ValueError("Original mudou durante devolução")
            safe_path(root, artifact["source_path"])
            target.parent.mkdir(parents=True, exist_ok=True)
            # Exclusive creation also refuses a concurrent ordinary-file collision.
            with target.open("xb") as stream:
                stream.write(data)
            if digest(target.read_bytes()) != artifact["original_sha256"]:
                raise ValueError("Falha na conferência da cópia: " + str(target))
    return {"dry_run": dry_run, "destination": str(root),
            "files": [{"source_path": a["source_path"], "action": action}
                      for _, _, a, action in plan],
            "bundle_hash": trusted_anchor}


def record_review(directory, records_dir, trusted_anchor, responsible, decision, reason):
    checked_bundle(directory, trusted_anchor)
    if field_state(responsible) != "PRESENT" or field_state(reason) != "PRESENT":
        raise ValueError("Responsável e justificativa são obrigatórios")
    if decision not in {"APPROVE", "REJECT", "REQUEST_CHANGES"}:
        raise ValueError("Decisão inválida")
    root = Path(records_dir).resolve()
    bundle_root = Path(directory).resolve()
    if root == bundle_root or bundle_root in root.parents:
        raise ValueError("Decisões devem ficar fora do bundle")
    root.mkdir(parents=True, exist_ok=True)
    record = {"schema_version": 1, "decision_id": uuid4().hex,
              "responsible_human": responsible, "decision": decision, "reason": reason,
              "reviewed_bundle_hash": trusted_anchor,
              "recorded_at": datetime.now(timezone.utc).isoformat()}
    record["record_hash"] = digest(canonical(record))
    path = root / (record["decision_id"] + ".json")
    with path.open("xb") as stream:
        stream.write(canonical(record) + b"\n")
    return {"record": str(path), "record_hash": record["record_hash"],
            "reviewed_bundle_hash": trusted_anchor}


def verify_review(directory, record_path, trusted_anchor):
    checked_bundle(directory, trusted_anchor)
    record = json.loads(Path(record_path).read_text(encoding="utf-8"))
    errors = []
    unsigned = {k: v for k, v in record.items() if k != "record_hash"}
    if digest(canonical(unsigned)) != record.get("record_hash"):
        errors.append("REVIEW_HASH_MISMATCH")
    if record.get("reviewed_bundle_hash") != trusted_anchor:
        errors.append("REVIEW_BUNDLE_MISMATCH")
    if (record.get("decision") not in {"APPROVE", "REJECT", "REQUEST_CHANGES"}
            or any(field_state(record.get(k)) != "PRESENT" for k in
                   ("responsible_human", "reason", "decision_id", "recorded_at"))):
        errors.append("INVALID_REVIEW")
    return {"valid": not errors, "errors": errors,
            "scope": "INTEGRITY_AND_BUNDLE_LINK_NOT_IDENTITY_AUTHENTICATION"}
