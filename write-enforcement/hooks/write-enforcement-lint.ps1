<#
  write-enforcement-lint.ps1  -  PreToolUse hook for the Writing Standard's mechanical floor.

  WHAT IT DOES
    Runs before a guarded write tool fires. If the tool is a Notion page-write
    (tool name contains "notion-create-pages" or "notion-update-page"), it extracts the
    page markdown, re-surfaces the "how to write" reminder, and flags the four screenable
    Writing-Standard violations (see ../references/mechanical-floor.md). It is ADVISORY:
    it prints to stderr and exits 0 so the write always proceeds.

  I/O CONTRACT (Claude Code PreToolUse) - verified 2026-07-14 against the hooks reference
    - Reads the hook JSON payload from STDIN: { tool_name, tool_input, ... }.
    - Advisory (default): emit JSON on STDOUT with permissionDecision "defer" +
      additionalContext (the reminder + flags), and exit 0. This is the documented
      NON-BLOCKING channel: the tool proceeds through normal permission flow AND Claude
      receives the context. The same text is also written to stderr so it appears in the
      user's transcript.
      IMPORTANT: exit 0 + stderr ALONE does NOT reach Claude - stderr is only surfaced to
      Claude on exit 2 (which blocks). additionalContext is the correct advisory channel.
    - On ANY error (bad JSON, missing fields, unreadable reference): exit 0 silently. A
      broken gate must never disrupt a session.

  DEFAULT = ADVISORY (non-blocking). This is deliberate: a hard gate on the write tool that
  crashes or blocks would break every session. Advisory re-surfaces the rules and warns.

  STRICT / BLOCK MODE (opt-in)
    Set the environment variable WRITE_ENFORCEMENT_STRICT=1 (or flip $Strict below to $true).
    In strict mode, if any violation is flagged the hook emits a PreToolUse deny decision as
    JSON on STDOUT and exits 0, so Claude sees the reason and the write is blocked until fixed:

        {
          "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": "<reminder + flags>"
          }
        }

    Even in strict mode, parse/read errors exit 0 silently (fail open, never crash a write).

  RETARGETING (target-agnostic)
    The guard matches on the tool name (see $WriteToolPatterns). To guard an Obsidian or
    Confluence write tool instead/also, add its tool-name substring to $WriteToolPatterns and
    update the matcher in settings.json (see SKILL.md). The content checks are unchanged.
#>

$ErrorActionPreference = 'Stop'

# ---- config -------------------------------------------------------------------------------
$Strict = $false
if ($env:WRITE_ENFORCEMENT_STRICT -eq '1') { $Strict = $true }

# Tool-name substrings that identify a guarded page-write. Add Obsidian/Confluence here to retarget.
$WriteToolPatterns = @('notion-create-pages', 'notion-update-page')

# Banned coined labels (extend as new offenders appear; keep in sync with mechanical-floor.md).
$Banned = @('carve-out', 'gap-read', 'cohort')

# The "how to write" reminder surfaced on every guarded write.
$Reminder = @'
[write-enforcement] Writing Standard reminder - applied at write time:
  Open with an overview (reader grasps the page in one glance). Prefer structure - tables,
  tiers, collapsible sections - over walls of prose. Cite-or-flag every factual claim (link a
  primary source or mark it unverified); label interpretation as interpretation. Teammate-
  engineer voice: no insider jargon or coined labels without their referent (gloss any coinage).
  Current state only - change-history goes to a Changelog, never inline. Default docs to
  collapsible sections. Run the humanizer norm.
'@

# ---- main (fail-open) ---------------------------------------------------------------------
try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

    $payload = $raw | ConvertFrom-Json
    $toolName = [string]$payload.tool_name
    if ([string]::IsNullOrWhiteSpace($toolName)) { exit 0 }

    # Only act on a guarded write tool (substring match).
    $isGuarded = $false
    foreach ($p in $WriteToolPatterns) {
        if ($toolName.ToLowerInvariant().Contains($p.ToLowerInvariant())) { $isGuarded = $true; break }
    }
    if (-not $isGuarded) { exit 0 }

    # Recursively collect every string value from tool_input -> the page content, robustly.
    $sb = New-Object System.Text.StringBuilder
    function Collect-Strings($node) {
        if ($null -eq $node) { return }
        if ($node -is [string]) { [void]$script:sb.AppendLine($node); return }
        if ($node -is [System.Collections.IEnumerable] -and -not ($node -is [string])) {
            foreach ($item in $node) { Collect-Strings $item }
            return
        }
        if ($node.PSObject -and $node.PSObject.Properties) {
            foreach ($prop in $node.PSObject.Properties) { Collect-Strings $prop.Value }
        }
    }
    Collect-Strings $payload.tool_input
    $content = $sb.ToString()
    if ([string]::IsNullOrWhiteSpace($content)) {
        # Nothing to screen - still surface the reminder, advisory.
        [Console]::Error.WriteLine($Reminder)
        exit 0
    }

    $lower = $content.ToLowerInvariant()
    $flags = New-Object System.Collections.Generic.List[string]

    # --- Check 1: mode declaration near the top ---
    $head = if ($content.Length -gt 1200) { $content.Substring(0, 1200) } else { $content }
    $headLower = $head.ToLowerInvariant()
    $hasModeLabel = $headLower.Contains('**mode:')
    $modeWords = @('reference', 'living documentation', 'living doc', 'operational surface',
                   'operational', 'standard', 'contract', 'log', 'archive')
    $hasModeCallout = $false
    foreach ($line in ($head -split "`n")) {
        $t = $line.Trim()
        if ($t.StartsWith('>')) {
            $lt = $t.ToLowerInvariant()
            foreach ($w in $modeWords) { if ($lt.Contains($w)) { $hasModeCallout = $true; break } }
        }
        if ($hasModeCallout) { break }
    }
    if (-not ($hasModeLabel -or $hasModeCallout)) {
        $flags.Add("No mode declaration found near the top - open with a callout naming the page's mode (Reference / Living doc / Operational / Standard / Log).")
    }

    # --- Check 2: collapsible headers on long docs ---
    $headingCount = ([regex]::Matches($content, '(?m)^\s*##')).Count
    $detailsCount = ([regex]::Matches($lower, '<details')).Count
    if ($headingCount -ge 4 -and $detailsCount -eq 0) {
        $flags.Add("Long page ($headingCount headings) with no collapsible sections - wrap sections in <details><summary> so the outline reads without noise. Keep the overview and a worked example visible.")
    }

    # --- Check 3: banned coined jargon ---
    foreach ($term in $Banned) {
        if ($lower.Contains($term.ToLowerInvariant())) {
            $flags.Add("Possible coined jargon '$term' - name its referent or use a descriptive term (self-describing-names rule).")
        }
    }

    # --- Check 4: inline change-notes (current-state-only) ---
    $changePatterns = @(
        'changed on\s+\S',
        'updated after',
        '\(was:',
        'used to be',
        'previously,'
    )
    foreach ($pat in $changePatterns) {
        $m = [regex]::Match($content, $pat, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($m.Success) {
            $snippet = $m.Value.Trim()
            $flags.Add("Inline change-note '$snippet' - deliverables are current-state only; move history to a Changelog.")
        }
    }

    # ---- emit --------------------------------------------------------------------------------
    $out = New-Object System.Text.StringBuilder
    [void]$out.AppendLine($Reminder)
    if ($flags.Count -gt 0) {
        [void]$out.AppendLine("")
        [void]$out.AppendLine("[write-enforcement] $($flags.Count) possible Writing-Standard issue(s) flagged (advisory - verify, they may be false alarms):")
        foreach ($f in $flags) { [void]$out.AppendLine("  - $f") }
    } else {
        [void]$out.AppendLine("")
        [void]$out.AppendLine("[write-enforcement] No mechanical-floor violations flagged.")
    }
    $message = $out.ToString()

    # Mirror to stderr so the message shows in the user's transcript either way.
    [Console]::Error.WriteLine($message)

    if ($Strict -and $flags.Count -gt 0) {
        # Strict/block mode: deny via JSON on stdout so Claude sees the reason and the write is blocked.
        $decision = [ordered]@{
            hookSpecificOutput = [ordered]@{
                hookEventName            = 'PreToolUse'
                permissionDecision       = 'deny'
                permissionDecisionReason = $message
            }
        }
        ($decision | ConvertTo-Json -Depth 6 -Compress) | Write-Output
        exit 0
    }

    # Advisory (default): emit "defer" + additionalContext on stdout so Claude SEES the message
    # without the write being blocked. (Plain stderr + exit 0 would NOT reach Claude.)
    $advisory = [ordered]@{
        hookSpecificOutput = [ordered]@{
            hookEventName      = 'PreToolUse'
            permissionDecision = 'defer'
            additionalContext  = $message
        }
    }
    ($advisory | ConvertTo-Json -Depth 6 -Compress) | Write-Output
    exit 0
}
catch {
    # Fail open: never disrupt a write, whatever went wrong.
    exit 0
}
