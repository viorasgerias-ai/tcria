"""Entrada do executável desktop e teste do aplicativo empacotado."""
import argparse
import json
import tempfile
from pathlib import Path


def self_test():
    from tcria.custody import record_review, restore_bundle, verify_review
    from tcria.pipeline import run_pipeline, verify_bundle
    # Creating Tk proves the packaged Tcl/Tk resources can load on the target OS.
    import tkinter as tk
    root = tk.Tk()
    root.withdraw()
    from tcria.desktop import Desktop
    app = Desktop(root)
    root.update_idletasks()
    root.destroy()
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        source = base / "entrada" / "subpasta"
        source.mkdir(parents=True)
        (source / "documento.txt").write_text("Exemplo sintético. 2026-11-04. Processo: TESTE-001.", encoding="utf-8")
        result = run_pipeline(base / "entrada", base / "resultado", "Operador sintético", "Teste do instalador")
        if not verify_bundle(base / "resultado", result["anchor"])["valid"]:
            raise RuntimeError("Falha na verificação do bundle")
        restore_bundle(base / "resultado", base / "devolucao", result["anchor"])
        if (base / "devolucao/subpasta/documento.txt").read_bytes() != (source / "documento.txt").read_bytes():
            raise RuntimeError("Falha na devolução dos bytes")
        review = record_review(base / "resultado", base / "revisoes", result["anchor"],
                               "Revisor sintético", "REQUEST_CHANGES", "Teste de distribuição")
        if not verify_review(base / "resultado", review["record"], result["anchor"])["valid"]:
            raise RuntimeError("Falha na revisão")
    return {"valid": True, "checks": ["tk-window", "ingest", "verify", "restore", "review"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if args.self_test:
        if not args.report:
            parser.error("--self-test exige --report")
        try:
            report = self_test()
        except Exception as exc:
            args.report.write_text(json.dumps({"valid": False, "error": str(exc)}), encoding="utf-8")
            return 1
        args.report.write_text(json.dumps(report), encoding="utf-8")
        return 0
    from tcria.desktop import main as desktop_main
    desktop_main()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
