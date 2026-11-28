# Підпис файлу сертифікатом GCDev Software (викликає Tauri для exe й інсталятора, див. desktop-build.yml).
# Сертифікат (PFX) і пароль — лише з GitHub Secrets через змінні середовища, у репозиторії їх немає.
param([Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = 'Stop'
$pfx = $env:GC_SIGN_PFX
if (-not $pfx -or -not (Test-Path $pfx)) { throw 'Немає сертифіката для підпису (GC_SIGN_PFX).' }
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signtool) { throw 'signtool.exe не знайдено.' }
& $signtool.FullName sign /f $pfx /p $env:GC_SIGN_PASSWORD /fd sha256 /tr http://timestamp.digicert.com /td sha256 /d 'GameCon' $File
if ($LASTEXITCODE -ne 0) { throw "Підпис не вдався: $File" }
