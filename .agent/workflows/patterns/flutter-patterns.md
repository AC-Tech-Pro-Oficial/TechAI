# Flutter Improvement Patterns (Pattern F)
// description: Flutter/Dart specific analysis and fix logic

## 1. Analysis Tools

| Tool | Command |
|------|---------|
| **Flutter Analyze** | `flutter analyze` |
| **Dart Format** | `dart format .` |
| **Dart Fix** | `dart fix --apply` |

## 2. Auto-Fix Table

| Issue Type | Action | Logic |
|------------|--------|-------|
| **Compile Errors** | ✅ **AUTO-FIX** | Fix immediately. Priority #1. |
| **Deprecations** | ✅ **AUTO-MIGRATE** | Apply `dart fix --apply` first. |
| **Formatting** | ✅ **AUTO-FIX** | Run `dart format .` |
| **Unused Import** | ✅ **AUTO-FIX** | `dart fix` handles this. |
| **Const Missing** | ✅ **AUTO-FIX** | `dart fix` handles this. |
| **Null Safety** | ⚠️ **MANUAL_REVIEW** | Check `patterns/quality-patterns.md`. |

## 3. Project Prep

```powershell
function Prep-FlutterProject {
    if (Test-Path android/gradlew) { ./android/gradlew --stop 2>$null }
    flutter clean
    flutter pub get
}
```

## 4. Verification Loop Logic (Snippet)

```powershell
function Verify-FlutterProject {
    $maxRetries = 3
    $attempt = 1
    do {
        Write-Host "Verify Cycle: $attempt/$maxRetries"
        $issues = flutter analyze 2>&1
        
        if ($issues -match "error") {
            Write-Warning "Errors detected. Attempting auto-fix..."
            dart fix --apply
            dart format .
            $fixed = $true
        } else {
            return $true # CLEAN
        }
        $attempt++
    } until ($attempt -gt $maxRetries)
    return $false # FAILED
}
```

## 5. Critical Check References

- **Unused Assets**: See `test.md` Section 8.
- **Zombie Files**: See `test.md` Section 7.
- **Security Check**: `patterns/security-patterns.md`.

