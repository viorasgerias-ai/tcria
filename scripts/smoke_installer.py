"""Instala em pasta temporária e testa o executável dentro do instalador nativo."""
import plistlib
import subprocess
import sys
import tempfile
from pathlib import Path

from build_desktop import ROOT, check_packaged, installer_name, target_info


def main():
    target = target_info()
    installer = ROOT / "release" / installer_name(target)
    if not installer.is_file():
        raise FileNotFoundError(installer)
    with tempfile.TemporaryDirectory() as tmp:
        temporary = Path(tmp).resolve()
        report = temporary / "self-test.json"
        if sys.platform == "win32":
            destination = temporary / "oranizator-igualizator"
            subprocess.run([str(installer), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-",
                            "/TASKS=", "/NOICONS", f"/DIR={destination}"], check=True, timeout=180)
            try:
                check_packaged(destination / "oranizator-igualizator.exe", report)
            finally:
                subprocess.run([str(destination / "unins000.exe"), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], check=True, timeout=180)
        else:
            mounted = plistlib.loads(subprocess.check_output(["hdiutil", "attach", "-readonly", "-nobrowse", "-plist", str(installer)]))
            volumes = [item["mount-point"] for item in mounted["system-entities"] if "mount-point" in item]
            if not volumes:
                raise RuntimeError("DMG sem volume montado")
            try:
                destination = temporary / "oranizator-igualizator.app"
                subprocess.run(["ditto", str(Path(volumes[0]) / "oranizator-igualizator.app"), str(destination)], check=True)
                check_packaged(destination / "Contents/MacOS/oranizator-igualizator", report)
            finally:
                for volume in reversed(volumes):
                    subprocess.run(["hdiutil", "detach", volume], check=True)
    print("Instalador e aplicativo conferidos com dados sintéticos.")


if __name__ == "__main__":
    main()
