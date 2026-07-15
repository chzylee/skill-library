# recording-standard-check.ps1
# SessionStart hook: warn (never block) when the Recording Standard enforcement
# block in ~/.claude/CLAUDE.md is missing or older than the version this hook ships.
# Behavior contract: never error, never block the session. Always exit 0.

$ExpectedVersion = '2026-07-14'

try {
    $claudeMd = Join-Path $HOME '.claude\CLAUDE.md'

    if (-not (Test-Path -LiteralPath $claudeMd)) {
        [Console]::Error.WriteLine(
            "[recording-standard] No ~/.claude/CLAUDE.md found, so the Recording Standard block is not installed. Run the 'recording-standard' skill to install it.")
        exit 0
    }

    $content = Get-Content -LiteralPath $claudeMd -Raw -Encoding UTF8 -ErrorAction Stop

    $match = [regex]::Match($content, '<!-- RECORDING-STANDARD v(\d{4}-\d{2}-\d{2}) START -->')

    if (-not $match.Success) {
        [Console]::Error.WriteLine(
            "[recording-standard] The Recording Standard enforcement block is missing from ~/.claude/CLAUDE.md. Run the 'recording-standard' skill to install it.")
        exit 0
    }

    $installed = $match.Groups[1].Value

    # Compare as dates (yyyy-MM-dd sorts lexically, but parse to be safe).
    $installedDate = [datetime]::ParseExact($installed, 'yyyy-MM-dd', $null)
    $expectedDate  = [datetime]::ParseExact($ExpectedVersion, 'yyyy-MM-dd', $null)

    if ($installedDate -lt $expectedDate) {
        [Console]::Error.WriteLine(
            "[recording-standard] The installed Recording Standard block is stale (installed v$installed, current v$ExpectedVersion). Re-run the 'recording-standard' skill to refresh it.")
        exit 0
    }

    # Present and current: say nothing.
    exit 0
}
catch {
    # Never let a hook failure disrupt the session.
    exit 0
}
