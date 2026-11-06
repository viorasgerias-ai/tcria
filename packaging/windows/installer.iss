#ifndef AppVersion
  #error AppVersion obrigatório
#endif
#ifndef PayloadDir
  #error PayloadDir obrigatório
#endif
#ifndef ReleaseDir
  #error ReleaseDir obrigatório
#endif
#ifndef ProjectDir
  #error ProjectDir obrigatório
#endif
[Setup]
AppId={{63377C94-0B49-4E98-80DD-D540D297A237}
AppName=oranizator-igualizator
AppVersion={#AppVersion}
AppPublisher=oranizator-igualizator
DefaultDirName={localappdata}\Programs\oranizator-igualizator
DefaultGroupName=oranizator-igualizator
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#ReleaseDir}
OutputBaseFilename=oranizator-igualizator-{#AppVersion}-windows-x64-setup
LicenseFile={#ProjectDir}\LICENSE
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\oranizator-igualizator.exe
CloseApplications=yes
[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; Flags: unchecked
[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\oranizator-igualizator"; Filename: "{app}\oranizator-igualizator.exe"
Name: "{autodesktop}\oranizator-igualizator"; Filename: "{app}\oranizator-igualizator.exe"; Tasks: desktopicon
[Run]
Filename: "{app}\oranizator-igualizator.exe"; Description: "Abrir oranizator-igualizator"; Flags: nowait postinstall skipifsilent
