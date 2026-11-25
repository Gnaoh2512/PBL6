# Run from the BE project root (the folder that contains pom.xml):
#   powershell -ExecutionPolicy Bypass -File .\apply_clean.ps1 -Zip C:\path\to\pbl6_clean.zip
param([Parameter(Mandatory=$true)][string]$Zip)
$ErrorActionPreference = "Stop"
if (-not (Test-Path ".\pom.xml")) { throw "Run this from the BE folder (pom.xml not found)." }

# 1. wipe the old backend package so no stale/deleted classes survive
$pkg = ".\src\main\java\com\example\pbl6"
if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }

# 2. empty the tests (kept as an empty folder)
if (Test-Path ".\src\test\java") {
  Get-ChildItem ".\src\test\java" -Recurse -Filter *.java | Remove-Item -Force
}

# 3. unpack the clean backend
Expand-Archive -Path $Zip -DestinationPath . -Force
Write-Host "Done. Now build with your IDE or: .\mvnw.cmd -DskipTests clean package"