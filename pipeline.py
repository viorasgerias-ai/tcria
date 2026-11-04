"""Compatibilidade com o pipeline operacional fornecido."""
from tcria.pipeline import run_pipeline, verify_bundle, main

if __name__ == "__main__":
    raise SystemExit(main())
