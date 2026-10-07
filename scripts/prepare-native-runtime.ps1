#requires -Version 7.3
param([string]$PythonVersion = '3.12.10')

$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$Target = Join-Path $ProjectRoot 'resources\native-python'
$BundledSource = Join-Path $ProjectRoot 'resources\coding-tools-mcp'
foreach ($required in @('coding_tools_mcp\server.py', 'python_vendor\jwt\__init__.py')) {
    if (-not (Test-Path -LiteralPath (Join-Path $BundledSource $required))) {
        throw "Missing bundled Runtime source or dependency: $required"
    }
}
if ((Get-Item -LiteralPath (Join-Path $ProjectRoot 'resources')).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'Resource directory must not be a link.'
}
if (Test-Path -LiteralPath $Target) {
    if ((Get-Item -LiteralPath $Target).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Python directory must not be a link.'
    }
}
New-Item -ItemType Directory -Path $Target -Force | Out-Null
$Python = Join-Path $Target 'python.exe'
if (-not (Test-Path -LiteralPath $Python)) {
    if ($PythonVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid Python version.' }
    $Archive = Join-Path $Target 'python-embed.zip'
    $PythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
    Invoke-WebRequest -Uri $PythonUrl -OutFile $Archive -TimeoutSec 120
    Expand-Archive -LiteralPath $Archive -DestinationPath $Target -Force
    Remove-Item -LiteralPath $Archive -Force
}
$PthFile = Get-ChildItem -LiteralPath $Target -Filter 'python*._pth' | Select-Object -First 1
if (-not $PthFile) { throw 'Embedded Python ._pth file was not found.' }
$Pth = @(Get-Content -LiteralPath $PthFile.FullName)
$Pth = @($Pth | Where-Object { $_ -ne '..\coding-tools-mcp' -and $_ -ne '..\coding-tools-mcp\python_vendor' })
$Pth += '..\coding-tools-mcp'
$Pth += '..\coding-tools-mcp\python_vendor'
$Pth = @($Pth | ForEach-Object { $_ -replace '^#import site$', 'import site' })
Set-Content -LiteralPath $PthFile.FullName -Value $Pth -Encoding ascii

# Old build scripts copied a second Runtime into site-packages. Keep one source.
$Duplicate = [IO.Path]::GetFullPath((Join-Path $Target 'Lib\site-packages\coding_tools_mcp'))
if (-not $Duplicate.StartsWith($Target + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Unexpected duplicate Runtime path.'
}
if (Test-Path -LiteralPath $Duplicate) {
    foreach ($Ancestor in @((Join-Path $Target 'Lib'), (Join-Path $Target 'Lib\site-packages'))) {
        if ((Get-Item -LiteralPath $Ancestor).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw 'Duplicate Runtime ancestor is a link; inspect before removal.'
        }
    }
    $Entries = @(Get-Item -LiteralPath $Duplicate)
    $Entries += @(Get-ChildItem -LiteralPath $Duplicate -Recurse -Force)
    $Links = @($Entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
    if ($Links) { throw 'Duplicate Runtime contains a link; inspect before removal.' }
    Remove-Item -LiteralPath $Duplicate -Recurse -Force
}
$env:PYTHONDONTWRITEBYTECODE = '1'
& $Python --version
if ($LASTEXITCODE -ne 0) { throw 'Embedded Python failed.' }
& $Python -B -m coding_tools_mcp.server --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Bundled Runtime failed to load.' }
Write-Host "Portable runtime ready: $Target"
