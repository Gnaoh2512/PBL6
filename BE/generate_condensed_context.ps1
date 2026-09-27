<#
Run from the BE folder.

Full codebase (still trimmed of blank lines/comments):
    .\generate_condensed_context.ps1

Only the folders relevant to what you're fixing right now (recommended —
this is what actually keeps it short). Comma-separate, matches on path substring:
    .\generate_condensed_context.ps1 -Only "dto\room,service\RoomAdminServiceImpl,entity\Room"

Skip the comment/blank-line stripping if you ever need exact original formatting:
    .\generate_condensed_context.ps1 -NoMinify
#>

param(
    [string]$Only = "",
    [switch]$NoMinify
)

$root = "src\main\java\com\example\pbl6"
$output = "condensed_be_sources.txt"
Remove-Item $output -ErrorAction SilentlyContinue

function Strip-Java([string]$text) {
    # remove /* ... */ and /** ... */ block comments (incl. javadoc)
    $text = [regex]::Replace($text, '/\*.*?\*/', '', 'Singleline')
    # remove // line comments (naive but fine for this codebase; skips lines with http:// etc. only if // is truly a comment start)
    $text = [regex]::Replace($text, '(?m)^\s*//.*$', '')
    # collapse blank lines
    $text = [regex]::Replace($text, '(?m)^\s*\r?\n', '')
    return $text
}

$files = Get-ChildItem -Path $root -Recurse -Filter *.java | Sort-Object FullName
if ($Only -ne "") {
    $patterns = $Only -split "," | ForEach-Object { $_.Trim() }
    $files = $files | Where-Object {
        $full = $_.FullName
        ($patterns | Where-Object { $full -like "*$_*" }).Count -gt 0
    }
}

if ($files.Count -eq 0) {
    Write-Host "No files matched. Check your -Only filter." -ForegroundColor Yellow
    exit 1
}

$rootFull = (Get-Item $root).FullName

foreach ($f in $files) {
    $relPath = $f.FullName.Substring($rootFull.Length + 1)
    $content = Get-Content $f.FullName -Raw
    if (-not $NoMinify) { $content = Strip-Java $content }
    Add-Content -Path $output -Value "// ===== FILE: com/example/pbl6/$relPath ====="
    Add-Content -Path $output -Value $content
    Add-Content -Path $output -Value ""
}

$lineCount = (Get-Content $output).Count
Write-Host "Wrote $($files.Count) files, $lineCount lines, to $output"