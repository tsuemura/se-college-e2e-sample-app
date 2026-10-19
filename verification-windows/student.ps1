# verification-windows/student.ps1
#
# 講座「実践E2E自動テスト」（共有デモ環境版）を、Windows の受講者（コマンドプロンプトを使う山田さん）として
# GitHub Actions の windows-latest ランナー上で一通り再現するスクリプト。
#
# 方針:
#   - 手を動かす手順は、講義スライド（verification/shared/slides/001.md〜108.md）に書かれたコマンドを
#     そのまま実行する。受講者が打つコマンドは cmd.exe の子プロセスで実行し、出力を逐語で out/logs/ に残す。
#   - 受講者が書くテストコードは、受講者役エージェントが stages/ に用意したものを各段階で tests/ にコピーする。
#   - スライドに書かれていない補助（ヘッドレスのスクリーンショット、動画、ログ保存、デモ環境の後始末）は
#     このスクリプトの都合で追加している。
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$scriptRoot = $PSScriptRoot
$outDir = Join-Path $scriptRoot 'out'
$logsDir = Join-Path $outDir 'logs'
$shotsDir = Join-Path $outDir 'screenshots'
$videosDir = Join-Path $outDir 'videos'
$reportsDir = Join-Path $outDir 'playwright-reports'
$testResultsDir = Join-Path $outDir 'test-results'
New-Item -ItemType Directory -Force -Path $logsDir, $shotsDir, $videosDir, $reportsDir, $testResultsDir | Out-Null

$demo = 'https://se-college-demo.takuyasuemura.workers.dev'
$marker = 'win-ci'
$home_ = $env:USERPROFILE                     # スライドどおり、ホームフォルダに e2e を作る
$e2e = Join-Path $home_ 'e2e'
$e2ePs = Join-Path $home_ 'e2e-ps'
$shot = Join-Path $scriptRoot 'shot.mjs'
$recordConfig = Join-Path $scriptRoot 'playwright.record.config.ts'
$paramsPath = Join-Path $scriptRoot 'stages\params.json'

# 受講者の PC には無い環境変数を消す（CI=true だと Playwright がリトライ 2 回・workers 1 になり、出力が変わる）
Remove-Item Env:CI -ErrorAction SilentlyContinue
Remove-Item Env:GITHUB_ACTIONS -ErrorAction SilentlyContinue
# 失敗時に HTML レポートを自動で開く動作は、ランナーではブラウザを待ち続けてしまうので抑止する（スライドでは自動で開く）
$env:PLAYWRIGHT_HTML_OPEN = 'never'
$env:E2E_DIR = $e2e
$env:DEMO_URL = $demo

$steps = New-Object System.Collections.Generic.List[string]

function Write-Section { param([string]$LogName, [string]$Title)
    $path = Join-Path $logsDir $LogName
    "=== $Title ===" | Out-File -FilePath $path -Encoding utf8
    "実行時刻: $(Get-Date -Format o)" | Out-File -FilePath $path -Append -Encoding utf8
    return $path
}
function Append-Text { param([string]$Path, [string]$Text) $Text | Out-File -FilePath $Path -Append -Encoding utf8 }

function Invoke-Proc { param([string]$LogPath, [string]$FileName, [string]$Arguments, [string]$Dir, [string]$Shown, [int]$TimeoutSec = 600)
    Append-Text $LogPath "`n$Shown`n"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FileName; $psi.Arguments = $Arguments; $psi.WorkingDirectory = $Dir
    $psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [Text.Encoding]::UTF8; $psi.StandardErrorEncoding = [Text.Encoding]::UTF8
    $p = [System.Diagnostics.Process]::Start($psi)
    $so = $p.StandardOutput.ReadToEndAsync(); $se = $p.StandardError.ReadToEndAsync()
    $timedOut = $false
    if (-not $p.WaitForExit($TimeoutSec * 1000)) { $timedOut = $true; & taskkill.exe /PID $p.Id /T /F 2>$null | Out-Null; $p.WaitForExit() }
    $out = $so.Result; if ($se.Result) { $out += "`n[stderr]`n" + $se.Result }
    Append-Text $LogPath $out
    if ($timedOut) { Append-Text $LogPath "(タイムアウト ${TimeoutSec} 秒で強制終了)" }
    Append-Text $LogPath "(exit code: $($p.ExitCode))"
    $sec = [int](($p.ExitTime - $p.StartTime).TotalSeconds)
    Append-Text $LogPath "(所要時間: ${sec} 秒)"
    return [PSCustomObject]@{ Output = $out; ExitCode = $p.ExitCode; Seconds = $sec }
}
function Invoke-Cmd { param([string]$LogPath, [string]$Dir, [string]$CommandLine, [int]$TimeoutSec = 600)
    # 受講者が打つコマンド（コマンドプロンプト）。プロンプト表示もスライドと同じ形で残す
    Invoke-Proc -LogPath $LogPath -FileName 'cmd.exe' -Arguments "/d /s /c `"$CommandLine`"" -Dir $Dir -Shown "$Dir> $CommandLine" -TimeoutSec $TimeoutSec
}
function Invoke-PS { param([string]$LogPath, [string]$Dir, [string]$CommandLine, [int]$TimeoutSec = 600)
    # PowerShell を選んだ受講者の体験。子プロセスの Windows PowerShell 5.1 で、この機械の実行ポリシーのまま実行する
    $cmd = $CommandLine.Replace('"', '\"')
    Invoke-Proc -LogPath $LogPath -FileName 'powershell.exe' -Arguments "-NoProfile -Command `"$cmd`"" -Dir $Dir -Shown "PS $Dir> $CommandLine" -TimeoutSec $TimeoutSec
}
function Invoke-Node { param([string]$LogPath, [string]$ArgLine, [int]$TimeoutSec = 300)
    Invoke-Proc -LogPath $LogPath -FileName 'node' -Arguments $ArgLine -Dir $e2e -Shown "(検証用) node $ArgLine" -TimeoutSec $TimeoutSec
}
function Save-Report { param([string]$Stage)
    $src = Join-Path $e2e 'playwright-report'; if (Test-Path $src) { Copy-Item $src (Join-Path $reportsDir $Stage) -Recurse -Force }
    $srcR = Join-Path $e2e 'test-results'; if (Test-Path $srcR) { Copy-Item $srcR (Join-Path $testResultsDir $Stage) -Recurse -Force }
}
function Use-Stage { param([string]$Name, [string]$LogPath)
    $src = Join-Path $scriptRoot "stages\$Name"
    $dst = Join-Path $e2e 'tests\reservation.spec.ts'
    if (-not (Test-Path $src)) { Append-Text $LogPath "stages\$Name がありません。この段階はスキップします"; return $false }
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    [System.IO.File]::WriteAllText($dst, [System.IO.File]::ReadAllText($src, [Text.Encoding]::UTF8), (New-Object System.Text.UTF8Encoding($false)))
    Append-Text $LogPath "tests\reservation.spec.ts を stages\$Name の内容で保存した（受講者は VS Code かメモ帳で同じ内容を保存する想定）"
    Copy-Item $src (Join-Path $outDir "stage-$Name") -Force
    return $true
}
function Note { param([string]$Text) $steps.Add($Text); Write-Host $Text }

# ============================================================
# 00. 環境情報（スライド 1〜2「開始前におねがい」/ 23「インストールできてるか確認」）
# ============================================================
$log = Write-Section '00-environment.txt' '環境情報（windows-latest ランナー）'
Append-Text $log "OS: $([System.Environment]::OSVersion.VersionString) / $((Get-CimInstance Win32_OperatingSystem).Caption) / $((Get-CimInstance Win32_OperatingSystem).OSArchitecture)"
Append-Text $log "PowerShell (このスクリプト): $($PSVersionTable.PSVersion) / $($PSVersionTable.PSEdition)"
Append-Text $log "USERPROFILE: $home_"
Append-Text $log "chcp: $(cmd.exe /c chcp)"
Append-Text $log "[Console]::OutputEncoding: $([Console]::OutputEncoding.EncodingName) (CodePage=$([Console]::OutputEncoding.CodePage))"
Append-Text $log "Culture: $((Get-Culture).Name) / UI: $((Get-UICulture).Name)"
Append-Text $log "注意: ランナーの実行ポリシー・コードページ・言語は受講者の素の Windows 11（日本語版、Restricted、CP932）と異なる。下は子プロセスで測った値"
Invoke-PS -LogPath $log -Dir $home_ -CommandLine 'Get-ExecutionPolicy -List | Format-Table -AutoSize | Out-String' | Out-Null
Invoke-Cmd -LogPath $log -Dir $home_ -CommandLine 'node --version' | Out-Null
Invoke-Cmd -LogPath $log -Dir $home_ -CommandLine 'npm --version' | Out-Null
Invoke-PS -LogPath $log -Dir $home_ -CommandLine 'npm --version' | Out-Null
Note "00 環境情報: 記録した"

# ============================================================
# 01. スライド 29「Playwright を入れる」（コマンドプロンプト）
# ============================================================
$log = Write-Section '01-npm-init-playwright-cmd.txt' 'スライド 29: mkdir e2e / cd e2e / npm init playwright（コマンドプロンプト）'
Invoke-Cmd -LogPath $log -Dir $home_ -CommandLine 'mkdir e2e' | Out-Null
Append-Text $log "`n$home_> cd e2e`n（以降は $e2e で実行）"
$init = Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npm init -y playwright@latest -- --quiet --browser=chromium --no-examples' -TimeoutSec 900
Note "01 npm init playwright (cmd): exit=$($init.ExitCode) $($init.Seconds)s"

# ============================================================
# 01b. 同じことを PowerShell で（スライド 24・25・30 の「スクリプトの実行が無効」の確認）
# ============================================================
$log = Write-Section '01b-npm-init-playwright-powershell.txt' 'スライド 29/30: PowerShell を選んだ受講者の体験'
Invoke-PS -LogPath $log -Dir $home_ -CommandLine 'mkdir e2e-ps | Out-Null; Set-Location e2e-ps; npm init -y playwright@latest -- --quiet --browser=chromium --no-examples' -TimeoutSec 900 | Out-Null
Append-Text $log "`n（ランナーの実行ポリシーは受講者の既定（Restricted）と違うので、『スクリプトの実行が無効』はここでは再現しない可能性が高い。上の 00-environment.txt の Get-ExecutionPolicy -List を参照）"
Note "01b npm init playwright (PowerShell): 記録した"

# ============================================================
# 02. スライド 31「入れたあとのフォルダ構成」
# ============================================================
$log = Write-Section '02-folder-structure.txt' 'スライド 31: フォルダ構成の確認'
Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'dir' | Out-Null
Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npx playwright --version' | Out-Null
Note "02 フォルダ構成: 記録した"

# ============================================================
# 03. スライド 32「設定ファイルに、テスト対象を書く」（受講者はエディタで 2 行直す）
# ============================================================
$log = Write-Section '03-edit-config.txt' 'スライド 32: playwright.config.ts の baseURL と trace を直す'
$cfgPath = Join-Path $e2e 'playwright.config.ts'
if (Test-Path $cfgPath) {
    $cfg = [System.IO.File]::ReadAllText($cfgPath, [Text.Encoding]::UTF8)
    $baseLine = ($cfg -split "`n" | Where-Object { $_ -match 'baseURL' }) -join ' | '
    $traceLine = ($cfg -split "`n" | Where-Object { $_ -match "trace:" }) -join ' | '
    Append-Text $log "生成された設定の該当行:`n  $baseLine`n  $traceLine"
    $new = $cfg -replace "//\s*baseURL:\s*'[^']*',", "baseURL: '$demo',"
    $new = $new -replace "trace:\s*'on-first-retry'", "trace: 'retain-on-failure'"
    $okBase = $new -match "baseURL: '$([regex]::Escape($demo))',"
    $okTrace = $new -match "trace: 'retain-on-failure'"
    Append-Text $log "baseURL を置き換えられたか: $okBase / trace を置き換えられたか: $okTrace"
    if (-not $okBase -or -not $okTrace) { Append-Text $log "!!! スライドの説明どおりの行が見つからなかった（生成されたテンプレートがスライドの想定と違う）" }
    [System.IO.File]::WriteAllText($cfgPath, $new, (New-Object System.Text.UTF8Encoding($false)))
    Append-Text $log "`n--- 修正後の use: の部分 ---"
    Append-Text $log (($new -split "`n" | Select-String -Pattern 'use: \{' -Context 0, 12 | Out-String))
    Copy-Item $cfgPath (Join-Path $outDir 'playwright.config.ts') -Force
    Note "03 設定ファイル: baseURL=$okBase trace=$okTrace"
} else {
    Append-Text $log "!!! playwright.config.ts が無い（npm init が失敗している）"
    Note "03 設定ファイル: 見つからない"
}

# ============================================================
# 04. スライド 34〜37: codegen の起動確認（GUI。クリックはできない）と「録画した」コードの保存
# ============================================================
$log = Write-Section '04-codegen-launch.txt' 'スライド 34〜35: npx playwright codegen の起動確認'
try {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $cg = Start-Process -FilePath 'cmd.exe' -ArgumentList "/d /s /c `"npx playwright codegen $demo`"" -WorkingDirectory $e2e -PassThru
    Start-Sleep -Seconds 25
    $alive = -not $cg.HasExited
    $procs = Get-Process | Where-Object { $_.ProcessName -match 'chrome|node' } | Select-Object ProcessName, Id, StartTime | Format-Table -AutoSize | Out-String
    Append-Text $log "25 秒後: codegen のプロセスは生きているか: $alive`n$procs"
    try {
        Add-Type -AssemblyName System.Windows.Forms, System.Drawing
        $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
        $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
        $bmp.Save((Join-Path $shotsDir '04-codegen-fullscreen.png')); $g.Dispose(); $bmp.Dispose()
        Append-Text $log "画面全体を 04-codegen-fullscreen.png に保存した（ランナーのデスクトップ。真っ黒ならセッションに画面が無い）"
    } catch { Append-Text $log "画面の撮影に失敗: $($_.Exception.Message)" }
    & taskkill.exe /PID $cg.Id /T /F 2>$null | Out-Null
    Get-Process | Where-Object { $_.ProcessName -match '^chrome' } | Stop-Process -Force -ErrorAction SilentlyContinue
    Append-Text $log "codegen を終了した（所要 $([int]$sw.Elapsed.TotalSeconds) 秒）"
    Note "04 codegen 起動: alive=$alive"
} catch { Append-Text $log "codegen の起動に失敗: $($_.Exception.Message)"; Note "04 codegen 起動: 失敗" }

$log = Write-Section '05-recorded-test.txt' 'スライド 35〜37: 録画の結果（stages/01-recorded.spec.ts）を tests/reservation.spec.ts として保存'
$params = $null
if (Test-Path $paramsPath) { $params = Get-Content $paramsPath -Raw -Encoding UTF8 | ConvertFrom-Json; Append-Text $log "録画で使った値: $(Get-Content $paramsPath -Raw -Encoding UTF8)" }
$hasStage1 = Use-Stage -Name '01-recorded.spec.ts' -LogPath $log
if ($params) {
    # 録画中にブラウザで実際に行う操作（スライド 35）の結果をデモ環境に作る（ヘッドレス）
    Invoke-Node -LogPath $log -ArgLine "`"$shot`" reserve `"$paramsPath`" `"$shotsDir`" 05" | Out-Null
}
Note "05 録画コード: stage1=$hasStage1"

# ============================================================
# 05. スライド 18「触ってみよう」相当の画面（ログイン、一覧、新規予約、重複エラー）
# ============================================================
$log = Write-Section '06-touch-app.txt' 'スライド 18: デモ環境を触る（ヘッドレスで画面を記録）'
Invoke-Node -LogPath $log -ArgLine "`"$shot`" touch `"$shotsDir`" 06 `"$marker`"" | Out-Null
Note "06 アプリ画面: 記録した"

# ============================================================
# 06. スライド 38「実行する前に：録画で作った予約をキャンセルする」（受講者はブラウザで行う）
# ============================================================
$log = Write-Section '07-cancel-recorded.txt' 'スライド 38: 録画で作った予約をキャンセルする'
if ($params) { Invoke-Node -LogPath $log -ArgLine "`"$shot`" cancel `"$paramsPath`" `"$shotsDir`" 07" | Out-Null }
Note "07 録画の予約をキャンセル: 実行した"

# ============================================================
# 07. スライド 39「実行してみる」（--headed）→ 41「もう一度実行してみよう」（失敗するはず）
# ============================================================
$log = Write-Section '08-first-run-headed.txt' 'スライド 39: npx playwright test --headed'
$r1 = Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npx playwright test --headed' -TimeoutSec 300
Save-Report -Stage '01-first-run'
Note "08 1 回目（--headed）: exit=$($r1.ExitCode)"

$log = Write-Section '09-second-run.txt' 'スライド 41: もう一度実行する（同じ日時なので失敗するはず）'
$r2 = Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npx playwright test' -TimeoutSec 300
Append-Text $log "`n観察: 1 回目 exit=$($r1.ExitCode) / 2 回目 exit=$($r2.ExitCode) → スライドどおり 2 回目だけ失敗したか: $(($r1.ExitCode -eq 0) -and ($r2.ExitCode -ne 0))"
Save-Report -Stage '02-second-run'
Note "09 2 回目: exit=$($r2.ExitCode)"

# ============================================================
# 08. スライド 45〜49: HTML レポート、エラーメッセージ、失敗した瞬間の画面、トレース
# ============================================================
$log = Write-Section '10-html-report.txt' 'スライド 45〜49: レポートを開く（npx playwright show-report をヘッドレスで撮る）'
Invoke-Node -LogPath $log -ArgLine "`"$shot`" report `"$(Join-Path $e2e 'playwright-report')`" `"$shotsDir`" 10-report-second-run 9323" | Out-Null
$traces = Get-ChildItem (Join-Path $e2e 'test-results') -Recurse -Filter 'trace.zip' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
Append-Text $log "trace.zip: $($traces -join ', ')"
Note "10 レポート: 記録した"

# ============================================================
# 09. スライド 53〜55: ランダムな入力 + 後処理（画面で）→ 2 回続けて通るはず
# ============================================================
$log = Write-Section '11-independent.txt' 'スライド 54〜55: stages/02-independent.spec.ts で 2 回実行'
if (Use-Stage -Name '02-independent.spec.ts' -LogPath $log) {
    $a = Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npx playwright test' -TimeoutSec 300
    $b = Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npx playwright test' -TimeoutSec 300
    Append-Text $log "`n観察: 1 回目 exit=$($a.ExitCode) / 2 回目 exit=$($b.ExitCode)"
    Save-Report -Stage '03-independent'
    Note "11 独立化: exit=$($a.ExitCode)/$($b.ExitCode)"
}

# ============================================================
# 10. スライド 60〜68: 整形（名前、expect、beforeEach）
# ============================================================
$log = Write-Section '12-readable.txt' 'スライド 64〜68: stages/03-readable.spec.ts'
if (Use-Stage -Name '03-readable.spec.ts' -LogPath $log) {
    $c = Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npx playwright test' -TimeoutSec 300
    Save-Report -Stage '04-readable'
    Note "12 整形: exit=$($c.ExitCode)"
}

# ============================================================
# 11. スライド 81: 2 本目のテスト（前処理で前提の予約を作る。画面で）
# ============================================================
$log = Write-Section '13-second-test.txt' 'スライド 81: stages/04-second-test.spec.ts'
if (Use-Stage -Name '04-second-test.spec.ts' -LogPath $log) {
    $d = Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npx playwright test' -TimeoutSec 300
    Save-Report -Stage '05-second-test'
    Note "13 2 本目: exit=$($d.ExitCode)"
}

# ============================================================
# 12. スライド 85〜90: 前提条件と後処理を切り出す（afterEach、API）→ すべてのテストを実行
# ============================================================
$log = Write-Section '14-arranged.txt' 'スライド 85〜90: stages/05-arranged.spec.ts と全テストの実行'
if (Use-Stage -Name '05-arranged.spec.ts' -LogPath $log) {
    $e1 = Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npx playwright test' -TimeoutSec 300
    $e2 = Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine 'npx playwright test' -TimeoutSec 300
    Append-Text $log "`n観察: 1 回目 exit=$($e1.ExitCode) / 2 回目 exit=$($e2.ExitCode)"
    Save-Report -Stage '06-final'
    Invoke-Node -LogPath $log -ArgLine "`"$shot`" report `"$(Join-Path $e2e 'playwright-report')`" `"$shotsDir`" 14-report-final 9324" | Out-Null
    $env:RECORD_OUTPUT_DIR = (Join-Path $videosDir 'final')
    Invoke-Cmd -LogPath $log -Dir $e2e -CommandLine "npx playwright test --config `"$recordConfig`"" -TimeoutSec 300 | Out-Null
    Note "14 切り出し後: exit=$($e1.ExitCode)/$($e2.ExitCode)"
}

# ============================================================
# 13. 後始末: デモ環境に残った自分の予約を消す（印 win-ci、または 2031 年）
# ============================================================
$log = Write-Section '15-cleanup.txt' '後始末: デモ環境の自分の予約を消す'
Invoke-Node -LogPath $log -ArgLine "`"$shot`" cleanup `"$marker`" 2031" | Out-Null
Get-Process | Where-Object { $_.ProcessName -match '^chrome|^node' } | Stop-Process -Force -ErrorAction SilentlyContinue
Note "15 後始末: 実行した"

# 自分が書いたテストの最終形と、各段階のコピーを成果物に含める
if (Test-Path (Join-Path $e2e 'tests')) { Copy-Item (Join-Path $e2e 'tests') (Join-Path $outDir 'tests-final') -Recurse -Force }
$steps | Out-File -FilePath (Join-Path $outDir 'summary.txt') -Encoding utf8
Write-Host "`n==== summary ===="; Get-Content (Join-Path $outDir 'summary.txt')
exit 0
