
# =====================================================================
# PBL6 HOTEL MANAGEMENT - DATABASE INITIALIZATION
# Executes schema_v3_clean.sql followed by dummy_data.sql
# =====================================================================

$ErrorActionPreference = "Stop"

$MySqlUser = "root"

$SchemaFile = Join-Path $PSScriptRoot "schema_v4_clean.sql"
$DummyFile  = Join-Path $PSScriptRoot "dummy_data.sql"

# Check MySQL installation
$MySql = Get-Command mysql.exe -ErrorAction SilentlyContinue

if (-not $MySql) {
    Write-Host "ERROR: mysql.exe not found. Add MySQL bin to PATH." -ForegroundColor Red
    exit 1
}

# Check SQL files
foreach ($File in @($SchemaFile, $DummyFile)) {
    if (-not (Test-Path $File)) {
        Write-Host "ERROR: Missing file: $File" -ForegroundColor Red
        exit 1
    }
}

# Execute a SQL file
function Invoke-MySqlScript {
    param (
        [string]$FilePath
    )

    Write-Host ""
    Write-Host "Executing: $(Split-Path $FilePath -Leaf)" -ForegroundColor Cyan

    $Command = '"{0}" --user="{1}" --password --default-character-set=utf8mb4 < "{2}"' -f `
        $MySql.Source, $MySqlUser, $FilePath

    & $env:ComSpec /d /c $Command

    if ($LASTEXITCODE -ne 0) {
        throw "MySQL execution failed: $FilePath (Exit code: $LASTEXITCODE)"
    }

    Write-Host "Completed successfully." -ForegroundColor Green
}

try {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host " PBL6 DATABASE INITIALIZATION" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow

    Write-Host ""
    Write-Host "WARNING: Existing hotel_management database will be dropped." -ForegroundColor Red

    $Confirm = Read-Host "Continue? (YES/NO)"

    if ($Confirm -cne "YES") {
        Write-Host "Operation cancelled."
        exit 0
    }

    # 1. Rebuild database
    Invoke-MySqlScript -FilePath $SchemaFile

    # 2. Insert dummy data
    Invoke-MySqlScript -FilePath $DummyFile

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " DATABASE INITIALIZATION SUCCESSFUL" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green

}
catch {
    Write-Host ""
    Write-Host "DATABASE INITIALIZATION FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
