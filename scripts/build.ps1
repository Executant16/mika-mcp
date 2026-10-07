param([switch]$SkipPortableRuntime)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $ProjectRoot
try {
    if (-not $SkipPortableRuntime -and -not (Test-Path -LiteralPath "resources\native-python\python.exe")) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\prepare-native-runtime.ps1"
        if ($LASTEXITCODE -ne 0) { throw "Portable runtime preparation failed." }
    }
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw "Tests failed." }
    & npm.cmd run dist
    if ($LASTEXITCODE -ne 0) { throw "Installer build failed." }
}
finally {
    Pop-Location
}
