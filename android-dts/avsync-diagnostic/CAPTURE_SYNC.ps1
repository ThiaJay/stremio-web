param(
    [string]$FireTvIp = "192.168.0.144",
    [int]$Seconds = 180
)

$ErrorActionPreference = 'Stop'

$adbCmd = Get-Command adb.exe -ErrorAction SilentlyContinue
$adb = $null
if ($adbCmd) {
    $adb = $adbCmd.Source
}
if (-not $adb) {
    $local = Join-Path $PSScriptRoot 'platform-tools\adb.exe'
    if (Test-Path -LiteralPath $local) {
        $adb = $local
    }
}
if (-not $adb) {
    throw 'adb.exe not found. Run the Fire TV installer first or place platform-tools beside this script.'
}

$serial = $FireTvIp + ':5555'
& $adb connect $serial | Out-Null
& $adb -s $serial logcat -c

Write-Host "Start the DTS-HD MA test stream in Stremio AV Sync Test now."
Write-Host "Capturing internal timing for $Seconds seconds..."

$job = Start-Job -ScriptBlock {
    param($a, $s)
    & $a -s $s logcat -v epoch STREMIO_AVSYNC:I '*:S'
} -ArgumentList $adb, $serial

Start-Sleep -Seconds $Seconds
Stop-Job $job
$lines = Receive-Job $job
Remove-Job $job

$out = Join-Path $PSScriptRoot ("avsync-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".log")
$lines | Set-Content -LiteralPath $out

$deltas = @()
foreach ($line in $lines) {
    if ($line -match 'deltaMs=(-?\d+)') {
        $deltas += [int]$Matches[1]
    }
}

if ($deltas.Count -lt 10) {
    throw "Not enough samples captured ($($deltas.Count)). Keep the stream playing and run again."
}

$sorted = $deltas | Sort-Object
$median = $sorted[[int][Math]::Floor($sorted.Count / 2)]
$mean = [Math]::Round(($deltas | Measure-Object -Average).Average, 1)
$min = ($deltas | Measure-Object -Minimum).Minimum
$max = ($deltas | Measure-Object -Maximum).Maximum
$first = $deltas[0]
$last = $deltas[-1]
$drift = $last - $first

Write-Host ""
Write-Host "Samples: $($deltas.Count)"
Write-Host "Median internal offset: $median ms"
Write-Host "Mean internal offset: $mean ms"
Write-Host "Range: $min to $max ms"
Write-Host "Change across capture: $drift ms"
if ([Math]::Abs($drift) -le 20) {
    Write-Host "Result: offset broadly stable"
} else {
    Write-Host "Result: measurable drift detected"
}
Write-Host "Raw log: $out"
