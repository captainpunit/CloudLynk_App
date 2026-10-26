param([string]$JavaHome, [string]$Architectures = 'arm64-v8a,x86_64')

$ErrorActionPreference = 'Stop'
$mobileRoot = Split-Path -Parent $PSScriptRoot
if (-not $JavaHome) {
    $jdkRoot = Join-Path $env:ProgramFiles 'Eclipse Adoptium'
    if (Test-Path -LiteralPath $jdkRoot) {
        $JavaHome = (Get-ChildItem -LiteralPath $jdkRoot -Directory -Filter 'jdk-17*' |
            Sort-Object Name -Descending | Select-Object -First 1).FullName
    }
    if (-not $JavaHome) { $JavaHome = $env:JAVA_HOME }
}
if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) {
    throw 'Install JDK 17, then pass -JavaHome with its directory.'
}

$previousJava = $env:JAVA_HOME
$previousPreview = $env:CLOUDLYNK_EMBED_PREVIEW
$previousNodeEnv = $env:NODE_ENV
Push-Location $mobileRoot
try {
    $env:JAVA_HOME = $JavaHome
    $env:CLOUDLYNK_EMBED_PREVIEW = 'true'
    $env:NODE_ENV = 'production'
    & npx.cmd expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Android prebuild failed.' }
    & ./android/gradlew.bat -p android :app:assembleDebug "-PreactNativeArchitectures=$Architectures" --max-workers=2 --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android compilation failed.' }
    Write-Output 'Review APK: android/app/build/outputs/apk/debug/app-debug.apk'
} finally {
    $env:JAVA_HOME = $previousJava
    $env:CLOUDLYNK_EMBED_PREVIEW = $previousPreview
    $env:NODE_ENV = $previousNodeEnv
    Pop-Location
}
