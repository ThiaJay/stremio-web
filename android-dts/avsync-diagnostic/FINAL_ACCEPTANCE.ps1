param(
    [string]$FireTvIp = "192.168.0.144"
)

$ErrorActionPreference = 'Stop'
$serial = $FireTvIp + ':5555'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $PSScriptRoot ("FINAL-AVSYNC-" + $stamp)
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Get-Adb {
    $local = Join-Path $PSScriptRoot 'platform-tools\adb.exe'
    if (Test-Path -LiteralPath $local) { return $local }
    $cmd = Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $zip = Join-Path $env:TEMP 'platform-tools-latest-windows.zip'
    Write-Host 'ADB not found. Downloading Google Android Platform Tools...'
    Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' -OutFile $zip
    Expand-Archive -LiteralPath $zip -DestinationPath $PSScriptRoot -Force
    Remove-Item -LiteralPath $zip -Force
    if (-not (Test-Path -LiteralPath $local)) { throw 'adb.exe not found after Platform Tools extraction.' }
    return $local
}

function Run-Adb {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
    & $script:adb -s $serial @Args
}

function Save-Command {
    param([string]$Name,[string[]]$Args)
    try {
        $text = (& $script:adb -s $serial @Args 2>&1 | Out-String)
        # Basic privacy scrub for hardware addresses.
        $text = $text -replace '(?i)([0-9a-f]{2}:){5}[0-9a-f]{2}', 'XX:XX:XX:XX:XX:XX'
        Set-Content -LiteralPath (Join-Path $outDir $Name) -Value $text -Encoding UTF8
    } catch {
        Set-Content -LiteralPath (Join-Path $outDir $Name) -Value ("UNAVAILABLE: " + $_.Exception.Message) -Encoding UTF8
    }
}

function EpochSeconds {
    return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000.0
}

$phaseRows = New-Object System.Collections.Generic.List[object]
function Timed-Phase {
    param([string]$Name,[int]$Seconds)
    $start = EpochSeconds
    Write-Host ""
    Write-Host ">>> $Name — $Seconds seconds"
    Start-Sleep -Seconds $Seconds
    $end = EpochSeconds
    $phaseRows.Add([pscustomobject]@{ phase=$Name; start_epoch=$start; end_epoch=$end })
}

function Wait-And-Mark {
    param([string]$Prompt,[string]$PhaseName)
    Write-Host ""
    Read-Host $Prompt | Out-Null
    $t = EpochSeconds
    $phaseRows.Add([pscustomobject]@{ phase=$PhaseName; start_epoch=$t; end_epoch=$t })
}

$script:adb = Get-Adb
Write-Host "Connecting to Fire TV $serial ..."
& $script:adb connect $serial | Out-Host
$state = (& $script:adb -s $serial get-state 2>&1 | Out-String).Trim()
if ($state -ne 'device') { throw "Fire TV is not connected over ADB. State: $state" }

# Preflight evidence.
Save-Command 'device-props.txt' @('shell','sh','-c',"getprop ro.product.manufacturer; getprop ro.product.model; getprop ro.product.device; getprop ro.build.version.release; getprop ro.build.version.sdk; getprop ro.build.display.id; getprop ro.product.cpu.abi")
Save-Command 'display.txt' @('shell','dumpsys','display')
Save-Command 'wm-size.txt' @('shell','wm','size')
Save-Command 'wm-density.txt' @('shell','wm','density')
Save-Command 'package-avsync.txt' @('shell','dumpsys','package','com.stremio.avsync')
Save-Command 'package-dtsfix.txt' @('shell','dumpsys','package','com.stremio.dtsfix')
Save-Command 'audio-before.txt' @('shell','dumpsys','audio')
Save-Command 'surface-list-before.txt' @('shell','dumpsys','SurfaceFlinger','--list')

# Start a full logcat capture. The app probe tag is extracted later, but the wider log
# preserves decoder, AudioTrack, MediaCodec, buffering and renderer evidence.
& $script:adb -s $serial logcat -c
$logPath = Join-Path $outDir 'full-logcat.txt'
$logJob = Start-Job -ScriptBlock {
    param($adb,$serial,$path)
    & $adb -s $serial logcat -v epoch '*:V' 2>&1 | Out-File -LiteralPath $path -Encoding utf8
} -ArgumentList $script:adb,$serial,$logPath

Write-Host ""
Write-Host "FINAL TEST"
Write-Host "Use Stremio AV Sync Test and the SAME DTS-HD MA 5.1 source used previously."
Read-Host 'Press ENTER once the DTS-HD MA source is playing normally' | Out-Null
$phaseRows.Add([pscustomobject]@{phase='DTS_START';start_epoch=(EpochSeconds);end_epoch=(EpochSeconds)})

Save-Command 'media-codec-dts-start.txt' @('shell','dumpsys','media.codec')
Save-Command 'audio-dts-start.txt' @('shell','dumpsys','audio')

# Long enough to distinguish constant offset from real drift.
Timed-Phase 'DTS_BASELINE' 120

# Pause/resume is automated to keep the transition timing reproducible.
Write-Host ""
Write-Host ">>> Automated pause/resume check"
$pauseStart = EpochSeconds
Run-Adb shell input keyevent 85 | Out-Null
Start-Sleep -Seconds 8
Run-Adb shell input keyevent 85 | Out-Null
$pauseEnd = EpochSeconds
$phaseRows.Add([pscustomobject]@{phase='PAUSE_RESUME';start_epoch=$pauseStart;end_epoch=$pauseEnd})
Timed-Phase 'POST_PAUSE' 45

# Manual seek is retained because Fire TV/Stremio seek step size is UI-state dependent.
Wait-And-Mark 'On the Fire Stick, seek FORWARD about 5 minutes. Once playback resumes, press ENTER here' 'SEEK_FORWARD_MARK'
Timed-Phase 'POST_SEEK_FORWARD' 60

Wait-And-Mark 'Now seek BACK about 5 minutes. Once playback resumes, press ENTER here' 'SEEK_BACK_MARK'
Timed-Phase 'POST_SEEK_BACK' 60

Save-Command 'media-codec-dts-end.txt' @('shell','dumpsys','media.codec')
Save-Command 'audio-dts-end.txt' @('shell','dumpsys','audio')
Save-Command 'gfxinfo-dts.txt' @('shell','dumpsys','gfxinfo','com.stremio.avsync')

# Control source catches regressions from globally preferring bundled FFmpeg audio.
Write-Host ""
Write-Host "CONTROL SOURCE"
Read-Host 'Play ONE normal non-DTS source that you know already works (AAC, AC3 or EAC3 is ideal). Once playing normally, press ENTER' | Out-Null
$phaseRows.Add([pscustomobject]@{phase='CONTROL_START';start_epoch=(EpochSeconds);end_epoch=(EpochSeconds)})
Save-Command 'media-codec-control-start.txt' @('shell','dumpsys','media.codec')
Save-Command 'audio-control-start.txt' @('shell','dumpsys','audio')
Timed-Phase 'NON_DTS_CONTROL' 90
Save-Command 'media-codec-control-end.txt' @('shell','dumpsys','media.codec')
Save-Command 'audio-control-end.txt' @('shell','dumpsys','audio')
Save-Command 'gfxinfo-control.txt' @('shell','dumpsys','gfxinfo','com.stremio.avsync')

# Finish capture.
Stop-Job $logJob -ErrorAction SilentlyContinue
Receive-Job $logJob -ErrorAction SilentlyContinue | Out-Null
Remove-Job $logJob -Force -ErrorAction SilentlyContinue
$phaseRows | Export-Csv -LiteralPath (Join-Path $outDir 'phases.csv') -NoTypeInformation -Encoding UTF8

if (-not (Test-Path -LiteralPath $logPath)) { throw 'Full logcat capture was not created.' }

$lines = Get-Content -LiteralPath $logPath
$probe = @()
$interesting = @()
foreach ($line in $lines) {
    if ($line -match 'STREMIO_AVSYNC:.*positionMs=(\d+).*framePtsMs=(\d+).*deltaMs=(-?\d+)') {
        $ts = $null
        if ($line -match '^\s*([0-9]+\.[0-9]+)') { $ts = [double]$Matches[1] }
        $probe += [pscustomobject]@{
            epoch = $ts
            position_ms = [long]$Matches[1]
            frame_pts_ms = [long]$Matches[2]
            delta_ms = [int]$Matches[3]
        }
    }
    if ($line -match '(?i)ffmpeg|dts|audiotrack|mediacodec|decoder|audio.?sink|tunnel|offload|dropped|playbackexception|exoplayerimplinternal|buffer') {
        $interesting += $line
    }
}
$probe | Export-Csv -LiteralPath (Join-Path $outDir 'avsync-samples.csv') -NoTypeInformation -Encoding UTF8
$interesting | Set-Content -LiteralPath (Join-Path $outDir 'relevant-log-lines.txt') -Encoding UTF8

function Median([double[]]$a) {
    if (-not $a -or $a.Count -eq 0) { return $null }
    $s = $a | Sort-Object
    $n = $s.Count
    if ($n % 2) { return [double]$s[[int][Math]::Floor($n/2)] }
    return ([double]$s[$n/2-1] + [double]$s[$n/2]) / 2.0
}

function Phase-Stats {
    param([string]$Name,[double]$Start,[double]$End)
    $rows = @($probe | Where-Object { $_.epoch -ne $null -and $_.epoch -ge $Start -and $_.epoch -le $End })
    if ($rows.Count -lt 2) {
        return [pscustomobject]@{phase=$Name;samples=$rows.Count;median_ms=$null;mean_ms=$null;min_ms=$null;max_ms=$null;stddev_ms=$null;drift_ms_per_min=$null;outliers_gt20ms=$null}
    }
    [double[]]$vals = @($rows | ForEach-Object {[double]$_.delta_ms})
    $mean = ($vals | Measure-Object -Average).Average
    $min = ($vals | Measure-Object -Minimum).Minimum
    $max = ($vals | Measure-Object -Maximum).Maximum
    $med = Median $vals
    $variance = (($vals | ForEach-Object { ($_-$mean)*($_-$mean) } | Measure-Object -Average).Average)
    $sd = [Math]::Sqrt($variance)

    # Least-squares slope of offset versus elapsed seconds, converted to ms/min.
    $t0 = [double]$rows[0].epoch
    [double[]]$xs = @($rows | ForEach-Object {[double]$_.epoch - $t0})
    $xmean = ($xs | Measure-Object -Average).Average
    $num = 0.0; $den = 0.0
    for($i=0;$i -lt $rows.Count;$i++){
        $dx = $xs[$i]-$xmean
        $num += $dx*($vals[$i]-$mean)
        $den += $dx*$dx
    }
    $slope = if($den -gt 0){($num/$den)*60.0}else{0.0}
    $outliers = @($vals | Where-Object {[Math]::Abs($_-$med) -gt 20}).Count

    return [pscustomobject]@{
        phase=$Name
        samples=$rows.Count
        median_ms=[Math]::Round($med,1)
        mean_ms=[Math]::Round($mean,1)
        min_ms=[Math]::Round($min,1)
        max_ms=[Math]::Round($max,1)
        stddev_ms=[Math]::Round($sd,1)
        drift_ms_per_min=[Math]::Round($slope,2)
        outliers_gt20ms=$outliers
    }
}

$stats = @()
foreach($p in $phaseRows) {
    if($p.end_epoch -gt $p.start_epoch -and $p.phase -notin @('PAUSE_RESUME')) {
        $stats += Phase-Stats $p.phase ([double]$p.start_epoch) ([double]$p.end_epoch)
    }
}
$stats | Export-Csv -LiteralPath (Join-Path $outDir 'phase-stats.csv') -NoTypeInformation -Encoding UTF8

# Overall DTS stats use all samples before CONTROL_START.
$controlMark = ($phaseRows | Where-Object phase -eq 'CONTROL_START' | Select-Object -First 1)
$dtsRows = if($controlMark){@($probe | Where-Object {$_.epoch -lt [double]$controlMark.start_epoch})}else{@($probe)}
$dtsStats = $null
if($dtsRows.Count -ge 2) {
    $first=[double]$dtsRows[0].epoch; $last=[double]$dtsRows[-1].epoch
    $dtsStats = Phase-Stats 'DTS_OVERALL' $first $last
}

$errCount = @($lines | Where-Object { $_ -match '(?i)PlaybackException|FATAL EXCEPTION|UnexpectedRuntime|Player is accessed on the wrong thread' }).Count
$dropMentions = @($lines | Where-Object { $_ -match '(?i)dropped.*frame|droppedFrames' }).Count
$ffmpegMentions = @($lines | Where-Object { $_ -match '(?i)FfmpegAudioRenderer|ffmpeg' }).Count
$dtsMentions = @($lines | Where-Object { $_ -match '(?i)dts|audio/dts' }).Count

$summary = New-Object System.Collections.Generic.List[string]
$summary.Add('STREMIO FINAL AV SYNC ACCEPTANCE')
$summary.Add('Generated: ' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))
$summary.Add('Fire TV: ' + $serial)
$summary.Add('')
if($dtsStats){
    $summary.Add("DTS overall samples: $($dtsStats.samples)")
    $summary.Add("DTS median offset: $($dtsStats.median_ms) ms")
    $summary.Add("DTS mean offset: $($dtsStats.mean_ms) ms")
    $summary.Add("DTS range: $($dtsStats.min_ms) to $($dtsStats.max_ms) ms")
    $summary.Add("DTS jitter SD: $($dtsStats.stddev_ms) ms")
    $summary.Add("DTS drift: $($dtsStats.drift_ms_per_min) ms/min")
    $summary.Add("DTS >20ms outliers from median: $($dtsStats.outliers_gt20ms)")
}
$summary.Add("Playback/thread fatal error mentions: $errCount")
$summary.Add("Dropped-frame log mentions: $dropMentions")
$summary.Add("FFmpeg log mentions: $ffmpegMentions")
$summary.Add("DTS/codec log mentions: $dtsMentions")
$summary.Add('')
$summary.Add('PER-PHASE')
foreach($s in $stats){
    $summary.Add(("$($s.phase): n=$($s.samples), median=$($s.median_ms)ms, mean=$($s.mean_ms)ms, range=$($s.min_ms)..$($s.max_ms)ms, SD=$($s.stddev_ms)ms, drift=$($s.drift_ms_per_min)ms/min, outliers=$($s.outliers_gt20ms)"))
}
$summary.Add('')
$summary.Add('Files collected: full logcat, filtered renderer/codec lines, device/build/display data, audio-route dumps, MediaCodec state, gfxinfo, raw samples and phase timings.')
$summary.Add('This is intended to be the final user-side diagnostic. Any remaining implementation should be completed from this evidence plus automated CI/regression tests.')
$summaryPath = Join-Path $outDir 'FINAL-RESULT.txt'
$summary | Set-Content -LiteralPath $summaryPath -Encoding UTF8

# Zip everything so the user sends one file back.
$zipPath = $outDir + '.zip'
Compress-Archive -Path (Join-Path $outDir '*') -DestinationPath $zipPath -Force

Write-Host ""
Write-Host "FINAL TEST COMPLETE"
Get-Content -LiteralPath $summaryPath | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "Send this ONE file back to ChatGPT:"
Write-Host $zipPath
