# Build only on the target OS. Python 3.12 includes tkinter on native installers.
import sys
import tomllib
from pathlib import Path

ROOT = Path(SPECPATH).parent
VERSION = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
a = Analysis(
    [str(ROOT / "desktop_launcher.py")],
    pathex=[str(ROOT)], binaries=[], datas=[(str(ROOT / "LICENSE"), ".")],
    hiddenimports=["tkinter", "tkinter.ttk"], hookspath=[], hooksconfig={},
    runtime_hooks=[], excludes=[], noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [], exclude_binaries=True, name="oranizator-igualizator", debug=False,
    bootloader_ignore_signals=False, strip=False, upx=False, console=False,
    disable_windowed_traceback=False, target_arch=None, codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="oranizator-igualizator")
if sys.platform == "darwin":
    app = BUNDLE(
        coll, name="oranizator-igualizator.app", bundle_identifier="forcebrax.com", version=VERSION,
        info_plist={
            "CFBundleShortVersionString": VERSION,
            "NSHighResolutionCapable": True,
            "LSMinimumSystemVersion": "15.0",
            "NSDocumentsFolderUsageDescription": "Ler os documentos que você selecionar e guardar os resultados locais.",
            "NSDesktopFolderUsageDescription": "Acessar pastas selecionadas na Mesa para processar documentos localmente.",
            "NSDownloadsFolderUsageDescription": "Acessar documentos selecionados em Downloads.",
        },
    )
