<#
  dev.ps1 —— 一键启动 Mika MCP「开发版」（改完代码立刻看效果）

  【重要：必须在一个"普通"终端里运行】
  AI 助手（IDE）自带的那个终端被沙箱限制，不允许启动图形程序。
  在里面跑会看到这样一行：
      >>> [Electron 进程退出] 退出码: 4294930435
  这既不是应用坏了，也不是你操作错了 —— 换个终端就正常。
  本脚本启动前仍会清掉 ELECTRON_RUN_AS_NODE / NODE_OPTIONS（无害的保险）。

  【正确的打开方式】
    · 最简单：在「文件资源管理器」里双击仓库根目录的「启动开发版.cmd」
    · 或者：  Win+R → 输入 pwsh → 回车，然后
              cd D:\Lenovo\Documents\Mika-Repository
              .\dev.ps1

  【用法】（在本仓库目录下）
    .\dev.ps1              普通启动（关掉窗口即退出）
    .\dev.ps1 -Watch       自动重启模式：改了 renderer\ / electron\ 里的文件并保存，自动重启

  【如果提示"禁止运行脚本"】
    pwsh -ExecutionPolicy Bypass -File .\dev.ps1
#>
[CmdletBinding()]
param(
  [switch]$Watch,
  [int]$IntervalMs = 800
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# ── 1. 清掉会让 Electron 变形的环境变量（必须"删除"，设成空字符串无效）──
foreach ($name in @('ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS')) {
  if (Test-Path "Env:$name") { Remove-Item "Env:$name" -Force }
}

$electronExe = Join-Path $PSScriptRoot 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electronExe)) {
  Write-Host '[x] 缺少 node_modules\electron —— 请先在本目录执行:  npm install' -ForegroundColor Red
  exit 1
}

# ── 2. 普通启动 ──
if (-not $Watch) {
  Write-Host ''
  Write-Host '  正在启动 Mika MCP 开发版…' -ForegroundColor Cyan
  Write-Host '  （关掉窗口即退出）' -ForegroundColor DarkGray
  Write-Host ''
  & npm start
  $rc = $LASTEXITCODE
  if ($rc -eq 4294930435 -or $rc -eq -36861) {
    Write-Host ''
    Write-Host '  ===============================================' -ForegroundColor Red
    Write-Host ('   Electron 被当前终端拦住了（退出码 ' + $rc + '）') -ForegroundColor Red
    Write-Host '  ===============================================' -ForegroundColor Red
    Write-Host '   这个终端不允许启动图形窗口，换个终端再试：' -ForegroundColor Yellow
    Write-Host '     · 在「文件资源管理器」里双击仓库根目录的「启动开发版.cmd」' -ForegroundColor Yellow
    Write-Host '     · 或 Win+R → pwsh → cd 到本目录 → .\dev.ps1' -ForegroundColor Yellow
    Write-Host '   完整输出已记录到：仓库目录\启动日志.txt（如果用了启动开发版.cmd）' -ForegroundColor DarkGray
    Write-Host ''
  }
  exit $rc
}

# ── 3. 自动重启模式 ──
$electronArgs = @('.', '--no-sandbox', '--disable-gpu', '--enable-logging')
$watchRoots = @('renderer', 'electron') |
  ForEach-Object { Join-Path $PSScriptRoot $_ } |
  Where-Object { Test-Path $_ }
$watchExts = @('.js', '.css', '.html', '.mjs', '.cjs', '.json')

function Get-SourceStamp {
  $latest = [datetime]::MinValue
  foreach ($root in $watchRoots) {
    foreach ($f in (Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue)) {
      if (($watchExts -contains $f.Extension) -and ($f.LastWriteTime -gt $latest)) {
        $latest = $f.LastWriteTime
      }
    }
  }
  return $latest
}

function Start-Mika {
  $p = Start-Process -FilePath $electronExe -ArgumentList $electronArgs `
    -WorkingDirectory $PSScriptRoot -PassThru -NoNewWindow
  Write-Host ('  [启动] Electron PID ' + $p.Id) -ForegroundColor Green
  return $p
}

function Stop-Mika {
  param($p)
  if ($null -eq $p) { return }
  if (-not $p.HasExited) {
    try { $null = $p.CloseMainWindow() } catch { }
    Start-Sleep -Milliseconds 500
    if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  }
}

Write-Host ''
Write-Host '  Mika MCP 开发版 · 自动重启模式' -ForegroundColor Cyan
Write-Host ('  监视目录: ' + (($watchRoots | ForEach-Object { Split-Path $_ -Leaf }) -join ', ')) -ForegroundColor DarkGray
Write-Host '  改完保存即自动重启；按 Ctrl+C 退出' -ForegroundColor DarkGray
Write-Host '  若窗口一直开不出来，请确认你不是在 AI 助手的终端里运行（见本脚本开头说明）' -ForegroundColor DarkYellow
Write-Host ''

$proc = Start-Mika
$stamp = Get-SourceStamp
try {
  while ($true) {
    Start-Sleep -Milliseconds $IntervalMs

    if ($proc.HasExited) {
      Write-Host '  [窗口已关闭] 重新启动…' -ForegroundColor Yellow
      $proc = Start-Mika
      $stamp = Get-SourceStamp
      continue
    }

    $now = Get-SourceStamp
    if ($now -gt $stamp) {
      Write-Host '  [检测到改动] 重启中…' -ForegroundColor Yellow
      Stop-Mika $proc
      $proc = Start-Mika
      $stamp = Get-SourceStamp
    }
  }
}
finally {
  Stop-Mika $proc
  Write-Host '  已停止监视。' -ForegroundColor DarkGray
}
