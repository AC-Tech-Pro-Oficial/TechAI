# PowerShell Improvement Patterns (Pattern PS)

> [!NOTE]
> Defines verification and fix logic for PowerShell projects.
> **Trigger**: `*.ps1` files present.

## 0. Safe Update Helper (Protocol S)

> [!IMPORTANT]
> **Use this for ALL text-based edits to prevent file corruption.**

```powershell
function Safe-Update-File {
    param($Path, $NewContent)
    $tempPath = "$Path.tmp"
    # Use UTF8 NoBOM for safety, unless project strictly demands BOM
    [System.IO.File]::WriteAllText($tempPath, $NewContent, [System.Text.Encoding]::UTF8)
    
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($tempPath, [ref]$null, [ref]$errors)
    
    if ($errors) {
        Write-Warning "Safe-Edit Failed: Syntax errors detected in fix for $Path"
        $errors | Format-Table -AutoSize
        Remove-Item $tempPath -Force
        return $false
    } else {
        Move-Item $tempPath $Path -Force
        Write-Host "Fixed (Verified): $Path" -ForegroundColor Green
        return $true
    }
}
```

## 1. Analysis Tools

| Tool | Command |
|------|---------|
| **PSScriptAnalyzer** | `Invoke-ScriptAnalyzer -Path . -Recurse` |
| **Syntax Check** | `[System.Management.Automation.Language.Parser]::ParseFile(...)` |

## 2. Auto-Fix Table

| Issue Type | Detection Pattern | Action |
|------------|-------------------|--------|
| **Formatting** | `PSAvoidTrailingWhitespace` | **Fix**: `Foreach { $_.TrimEnd() }` |
| **Unused Vars** | `PSUseDeclaredVarsMoreThanAssignments` | **Fix**: Remove assignment line |
| **Aliases** | `PSAvoidUsingCmdletAliases` | **Fix**: Expand alias (e.g., `gal` -> `Get-Alias`) |
| **ShouldProcess** | `Suppressed ShouldProcess` | **Fix**: Add `[CmdletBinding(SupportsShouldProcess=$true)]` |
| **Console Output** | `PSAvoidUsingWriteHost` | **Fix**: Change to `Write-Output` or `Write-Warning` (Context dependent) |
| **Credentials** | `password|secret` (Regex) | **Warn**: Suggest `Get-Credential` |

## 3. Critical Fix Patterns

### PS-1: CmdletBinding Injection
**Problem**: Functions performing state changes missing `SupportsShouldProcess`.
**Fix**:
```powershell
function Verb-Noun {
    [CmdletBinding(SupportsShouldProcess=$true)] # <--- INJECT THIS
    param()
```

### PS-2: Safe Execution Policy
**Problem**: Scripts fail due to restricted policy.
**Fix**: Not code change, but execution wrapper:
```powershell
PowerShell.exe -ExecutionPolicy Bypass -File script.ps1
```

### PS-3: Variable Scoping
**Problem**: Leaking variables (Global/Script scope abuse).
**Fix**:
```powershell
# BAD
$Script:myVar = 1
# GOOD (Function Scope)
$myVar = 1
```

## 4. Verification Logic (Snippet)

```powershell
function Verify-PowerShellProject {
    Write-Host "Running PSScriptAnalyzer..." -ForegroundColor Cyan
    if (Get-Command Invoke-ScriptAnalyzer -ErrorAction SilentlyContinue) {
        $results = Invoke-ScriptAnalyzer -Path . -Recurse
        if ($results) {
            $results | Format-Table -AutoSize
            return $false # FAILED
        }
    } else {
        Write-Warning "PSScriptAnalyzer not installed. Skipping deep analysis."
    }
    return $true # PASSED
}
```

## 5. Logic Pattern L: Runtime Invariants

> [!IMPORTANT]
> These patterns detect **runtime logic errors** that static analysis cannot catch.

| Pattern | Detection Method | Fix |
| :--- | :--- | :--- |
| **L1: Deleted artifacts referenced later** | Grep `Remove-Item $path` then find later refs to `$path` | Move deletion to AFTER last usage |
| **L2: Catch without logging** | Grep `catch` blocks missing `Write-Log` | Add `Write-Log "$($_.Exception.Message)" -Level Error` |
| **L3: Unconditional cleanup after error** | Manual review of post-`catch` code | Add error flag guard (e.g., `if (-not $ErrorOccurred)`) |

