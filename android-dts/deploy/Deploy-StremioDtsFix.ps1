param(
    [string]$Apk = (Join-Path $PSScriptRoot 'stremio-dts-fix.apk'),
    [string]$Serial = $env:ANDROID_SERIAL
)

$ErrorActionPreference = 'Stop'
$Package = 'com.stremio.one'

function Get-Adb {
    $local = Join-Path $PSScriptRoot 'platform-tools\adb.exe'
    if (Test-Path -LiteralPath $local) { return $local }
    $cmd = Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $zip = Join-Path $env:TEMP 'platform-tools-latest-windows.zip'
    $dir = Join-Path $PSScriptRoot 'platform-tools'
    Write-Host 'Android Platform Tools not found. Downloading the official Google package.'
    Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' -OutFile $zip
    if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $PSScriptRoot -Force
    Remove-Item -LiteralPath $zip -Force
    if (-not (Test-Path -LiteralPath $local)) { throw 'adb.exe was not found after extracting Platform Tools.' }
    return $local
}

if (-not (Test-Path -LiteralPath $Apk)) {
    throw "Signed deployment APK not found at $Apk. The official app is left unchanged."
}

$adb = Get-Adb
& $adb start-server | Out-Null

$deviceLines = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' })
if ($Serial) {
    $deviceLines = @($deviceLines | Where-Object { ($_ -split '\s+')[0] -eq $Serial })
}
if ($deviceLines.Count -ne 1) {
    throw "Expected exactly one authorised Android device. Found $($deviceLines.Count). Set ANDROID_SERIAL when more than one device is connected."
}

$resolvedSerial = ($deviceLines[0] -split '\s+')[0]
$adbArgs = @('-s', $resolvedSerial)

$receiptDir = Join-Path $PSScriptRoot 'receipts'
New-Item -ItemType Directory -Force -Path $receiptDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$receipt = Join-Path $receiptDir "preinstall-$stamp.txt"

"Device $resolvedSerial" | Set-Content -LiteralPath $receipt
"APK $Apk" | Add-Content -LiteralPath $receipt
"APK SHA256 $((Get-FileHash -Algorithm SHA256 -LiteralPath $Apk).Hash)" | Add-Content -LiteralPath $receipt
& $adb @adbArgs shell dumpsys package $Package 2>&1 | Add-Content -LiteralPath $receipt

Write-Host 'Installing as an in-place update only. The script will never uninstall the official app.'
$install = & $adb @adbArgs install -r --no-streaming $Apk 2>&1
$install | ForEach-Object { Write-Host $_ }

if (($install -join [Environment]::NewLine) -notmatch 'Success') {
    throw 'In-place install failed. The existing Stremio installation has not been removed.'
}

& $adb @adbArgs shell am force-stop $Package | Out-Null
& $adb @adbArgs shell monkey -p $Package 1 | Out-Null
Write-Host "Deployment completed on $resolvedSerial. Receipt saved to $receipt"
