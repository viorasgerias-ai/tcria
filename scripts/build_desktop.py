"""Compilação nativa do aplicativo e instalador. Não faz cross compilation."""
import argparse
import hashlib
import json
import platform
import shutil
import subprocess
import sys
import tempfile
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]


def target_info(system=None, machine=None):
    system = system or sys.platform
    machine = (machine or platform.machine()).lower()
    if system == "win32" and machine in {"amd64", "x86_64"}:
        return {"platform": "windows", "arch": "x64", "extension": ".exe", "suffix": "-setup"}
    if system == "darwin" and machine in {"arm64", "x86_64"}:
        return {"platform": "macos", "arch": machine, "extension": ".dmg", "suffix": ""}
    raise ValueError("Compile em Windows x64 ou macOS Intel/Apple Silicon; compilação cruzada não é suportada.")


def installer_name(target):
    return f"oranizator-igualizator-{VERSION}-{target['platform']}-{target['arch']}{target['suffix']}{target['extension']}"


def check_packaged(binary, report):
    subprocess.run([str(binary), "--self-test", "--report", str(report)], check=True, timeout=180)
    if not json.loads(report.read_text(encoding="utf-8")).get("valid"):
        raise RuntimeError("O aplicativo empacotado falhou no teste funcional")


def build():
    target = target_info()
    release = ROOT / "release"
    release.mkdir(exist_ok=True)
    # Check that this Python has the Tcl/Tk resources before invoking PyInstaller.
    import tkinter as tk
    root = tk.Tk()
    root.withdraw()
    root.update_idletasks()
    root.destroy()
    subprocess.run([sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
                    "--distpath", str(ROOT / "dist"), "--workpath", str(ROOT / "build"),
                    str(ROOT / "packaging/desktop.spec")], cwd=ROOT, check=True)
    binary = ROOT / ("dist/oranizator-igualizator/oranizator-igualizator.exe" if target["platform"] == "windows" else "dist/oranizator-igualizator.app/Contents/MacOS/oranizator-igualizator")
    with tempfile.TemporaryDirectory() as tmp:
        check_packaged(binary, Path(tmp) / "smoke.json")
    if target["platform"] == "windows":
        compiler = shutil.which("ISCC") or str(Path(r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe"))
        if not Path(compiler).is_file():
            raise RuntimeError("Instale o Inno Setup 6 (https://jrsoftware.org/isinfo.php)")
        subprocess.run([compiler, f"/DAppVersion={VERSION}", f"/DPayloadDir={ROOT / 'dist/oranizator-igualizator'}",
                        f"/DReleaseDir={release}", f"/DProjectDir={ROOT}",
                        str(ROOT / "packaging/windows/installer.iss")], check=True)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            stage = Path(tmp) / "oranizator-igualizator"
            stage.mkdir()
            shutil.copytree(ROOT / "dist/oranizator-igualizator.app", stage / "oranizator-igualizator.app", symlinks=True)
            (stage / "Applications").symlink_to("/Applications")
            (stage / "LEIA-ME.txt").write_text(
                "Arraste oranizator-igualizator.app para Applications. Documentos e resultados ficam nas pastas que você selecionar.\n"
                "Esta compilação não tem assinatura Developer ID nem notarização Apple.\n", encoding="utf-8")
            subprocess.run(["hdiutil", "create", "-volname", "oranizator-igualizator", "-srcfolder", str(stage),
                            "-ov", "-format", "UDZO", str(release / installer_name(target))], check=True)
    installer = release / installer_name(target)
    if not installer.is_file():
        raise RuntimeError("O instalador esperado não foi criado")
    checksum = hashlib.sha256(installer.read_bytes()).hexdigest()
    (release / "SHA256SUMS.txt").write_text(f"{checksum}  {installer.name}\n", encoding="utf-8")
    print(json.dumps({"installer": str(installer), "sha256": checksum}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", action="store_true", help="Exibir alvo sem compilar")
    args = parser.parse_args()
    try:
        if args.plan:
            print(json.dumps({"target": target_info(), "installer": installer_name(target_info())}, indent=2))
        else:
            build()
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as exc:
        parser.exit(1, str(exc) + "\n")


if __name__ == "__main__":
    main()
