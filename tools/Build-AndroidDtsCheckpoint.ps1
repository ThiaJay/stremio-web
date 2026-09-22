param(
    [string]$OutputDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) 'artifacts\android-dts')
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$BaseCommit = '6ff6cf9d0820382b3c233d018c52e4163b09d345'
$SwitchCommit = '2dc77cd2d9352bc308aa26782f9c77a320df510b'
$Repo = 'https://github.com/anilbeesetti/nextlib.git'

foreach ($command in @('git.exe', 'java.exe')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command is required for the local build fallback."
    }
}

$Temp = Join-Path $env:TEMP ('stremio-dts-build-' + [Guid]::NewGuid().ToString('N'))
$Old = Join-Path $Temp 'nextlib'
$New = Join-Path $Temp 'nextlib-new'

try {
    New-Item -ItemType Directory -Force -Path $Temp | Out-Null

    & git.exe clone --filter=blob:none --no-checkout $Repo $Old
    & git.exe -C $Old config core.autocrlf false
    & git.exe -C $Old checkout --detach $BaseCommit

    & git.exe clone --filter=blob:none --no-checkout $Repo $New
    & git.exe -C $New config core.autocrlf false
    & git.exe -C $New checkout --detach $SwitchCommit

    $Base = 'media3ext\src\main\java\io\github\anilbeesetti\nextlib\media3ext\ffdecoder'
    foreach ($file in @('DecoderMode.kt', 'DecoderRendererController.kt', 'DecoderManager.kt', 'NextRenderersFactory.kt')) {
        Copy-Item -LiteralPath (Join-Path $New "$Base\$file") -Destination (Join-Path $Old "$Base\$file") -Force
    }

    $libraryPath = Join-Path $Old "$Base\FfmpegLibrary.java"
    $library = Get-Content -LiteralPath $libraryPath -Raw
    $oldDts = 'case MimeTypes.AUDIO_DTS, MimeTypes.AUDIO_DTS_HD -> "dca";'
    $newDts = 'case MimeTypes.AUDIO_DTS, MimeTypes.AUDIO_DTS_HD, MimeTypes.AUDIO_DTS_EXPRESS, MimeTypes.AUDIO_DTS_X -> "dca";'
    if (($library.Split($oldDts).Count - 1) -ne 1) { throw 'Unexpected DTS mapping baseline.' }
    [IO.File]::WriteAllText($libraryPath, $library.Replace($oldDts, $newDts))

    $gradlePath = Join-Path $Old 'media3ext\build.gradle.kts'
    $gradle = Get-Content -LiteralPath $gradlePath -Raw
    $anchor = '    compileOnly(libs.kotlin.annotations.jvm)' + [Environment]::NewLine + '}'
    if (($gradle.Split($anchor).Count - 1) -ne 1) {
        $anchor = '    compileOnly(libs.kotlin.annotations.jvm)' + [char]10 + '}'
    }
    if (($gradle.Split($anchor).Count - 1) -ne 1) { throw 'Unexpected Gradle dependency baseline.' }
    $replacement = '    compileOnly(libs.kotlin.annotations.jvm)' + [Environment]::NewLine + '    testImplementation("junit:junit:4.13.2")' + [Environment]::NewLine + '}'
    [IO.File]::WriteAllText($gradlePath, $gradle.Replace($anchor, $replacement))

    $TestTarget = Join-Path $Old 'media3ext\src\test\java\com\stremio\common\players'
    New-Item -ItemType Directory -Force -Path $TestTarget | Out-Null
    Copy-Item -LiteralPath (Join-Path $Root 'android-dts\src\DtsAudioRecoveryPolicy.kt') -Destination $TestTarget
    Copy-Item -LiteralPath (Join-Path $Root 'android-dts\src\DtsAudioRecoveryController.kt') -Destination $TestTarget
    Copy-Item -LiteralPath (Join-Path $Root 'android-dts\test\DtsAudioRecoveryPolicyTest.kt') -Destination $TestTarget

    & git.exe -C $Old diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Patch whitespace validation failed.' }

    Push-Location $Old
    try {
        & .\gradlew.bat :media3ext:testDebugUnitTest :media3ext:assembleRelease --stacktrace
        if ($LASTEXITCODE -ne 0) { throw 'Gradle validation failed.' }
    } finally {
        Pop-Location
    }

    if (Test-Path -LiteralPath $OutputDirectory) {
        Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
    Copy-Item -LiteralPath (Join-Path $Old 'media3ext\build\outputs\aar\media3ext-release.aar') -Destination (Join-Path $OutputDirectory 'nextlib-media3ext-dts-recovery.aar')
    Copy-Item -LiteralPath (Join-Path $Root 'android-dts\RECOVERY_MANIFEST.json') -Destination $OutputDirectory
    Copy-Item -LiteralPath (Join-Path $Root 'android-dts\deploy') -Destination $OutputDirectory -Recurse

    Get-ChildItem -LiteralPath $OutputDirectory -File -Recurse |
        Sort-Object FullName |
        ForEach-Object {
            "$((Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash)  $($_.FullName.Substring($OutputDirectory.Length + 1))"
        } | Set-Content -LiteralPath (Join-Path $OutputDirectory 'SHA256SUMS.txt')

    Write-Host "Local Android DTS checkpoint created at $OutputDirectory"
} finally {
    if (Test-Path -LiteralPath $Temp) {
        Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
    }
}
