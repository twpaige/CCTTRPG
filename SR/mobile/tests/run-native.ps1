param([string]$Jdk = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
if (-not $Jdk) { throw 'Pass -Jdk with a JDK 17+ directory, or set JAVA_HOME for this terminal.' }
$mobileRoot = Split-Path $PSScriptRoot -Parent
$classes = Join-Path $mobileRoot 'app/build/poc-tests'
New-Item -ItemType Directory -Force $classes | Out-Null
$engine = Join-Path $mobileRoot 'app/src/main/java/com/crownandcall/srproof/PlaybackEngine.java'
& (Join-Path $Jdk 'bin/javac.exe') -d $classes $engine (Join-Path $PSScriptRoot 'PlaybackEngineTest.java')
if ($LASTEXITCODE -ne 0) { throw 'Native executor test compilation failed.' }
& (Join-Path $Jdk 'bin/java.exe') -cp $classes com.crownandcall.srproof.PlaybackEngineTest
if ($LASTEXITCODE -ne 0) { throw 'Native executor tests failed.' }
