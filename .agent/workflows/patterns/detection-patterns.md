# Detection Patterns

Advanced code analysis patterns for dead code, unused assets, and performance issues.

---

## Section 17: Dead Code Detection

**Goal**: Find functions/classes defined but never called.

```powershell
# Find function definitions
$fns = Select-String -Path lib\**\*.dart -Pattern "^\s*(Future|void|String|Widget)\s+(\w+)\s*\(" |
    ForEach-Object { if ($_.Line -match "\s(\w+)\s*\(") { $matches[1] } } |
    Where-Object { $_ -notmatch "^(build|dispose|initState)$" } |
    Sort-Object -Unique

# Check usage count
foreach ($fn in $fns) {
    $count = (Select-String -Path lib\**\*.dart -Pattern "\b$fn\b" -SimpleMatch).Count
    if ($count -le 1) { Write-Warning "DEAD: $fn" }
}
```

---

## Section 18: Unused Asset Detection

**Goal**: Find assets not referenced in code.

```powershell
$assets = Get-ChildItem assets\ -Recurse -File
foreach ($a in $assets) {
    $refs = Select-String -Path lib\**\*.dart,pubspec.yaml -Pattern $a.Name -SimpleMatch
    if (-not $refs) { Write-Warning "UNUSED: $($a.Name)" }
}
```

---

## Section 19: Widget Performance

**Goal**: Detect rebuild anti-patterns.

| Pattern | Issue |
|---------|-------|
| `setState` in loops | Multiple rebuilds |
| Heavy ops in `build()` | Slow renders |
| Objects created in build | Memory churn |
| `.map()` without keys | Inefficient diffs |

```powershell
# Check for setState in loops
Select-String -Path lib\**\*.dart -Pattern "for\s*\(.*setState" | 
    ForEach-Object { Write-Warning "PERF: setState in loop - $($_.Filename)" }
```

---

## Section 20: Firestore Optimization

**Goal**: Detect inefficient queries.

| Anti-Pattern | Fix |
|--------------|-----|
| `.collection().get()` unbounded | Add `.where()` or `.limit()` |
| Sequential `.get()` calls | Use `Future.wait()` batch |
| `.get()` in loops | Restructure to batch query |

```powershell
# Find unbounded queries
Select-String -Path lib\**\*.dart -Pattern "\.collection\([^)]+\)\.get\(\)" |
    ForEach-Object { Write-Warning "UNBOUNDED: $($_.Filename):$($_.LineNumber)" }
```

---

## Quick Execution

To run all detection on a project:

```powershell
# From project root
$files = Get-ChildItem lib\**\*.dart -Recurse

# Dead code check
Write-Host "=== DEAD CODE ===" -ForegroundColor Cyan
# (run Section 17 script)

# Unused assets
Write-Host "=== UNUSED ASSETS ===" -ForegroundColor Cyan
# (run Section 18 script)

# Performance
Write-Host "=== PERFORMANCE ===" -ForegroundColor Cyan
# (run Section 19 script)

# Firestore
Write-Host "=== FIRESTORE ===" -ForegroundColor Cyan
# (run Section 20 script)
```
