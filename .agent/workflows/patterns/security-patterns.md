---
description: Security architecture detection patterns for APIs, auth, and App Check
---

# Security Architecture Patterns (Pattern S)

Detects missing security patterns in API-facing code.

## S1. External API Calls Without Rate Limiting

```powershell
$apiFiles = Get-ChildItem lib -Recurse -Filter *.dart -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "service|api|client|provider" }

foreach ($file in $apiFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match "generateContent|http\.(get|post)|http\.post|http\.get|apiKey|\.call\(") {
        if ($content -notmatch "RateLimiter|rateLimit|throttle|canMakeRequest") {
            Write-Warning "SECURITY: $($file.Name) calls external API without rate limiting"
        }
    }
}
```

**Fix:** Add `RateLimitingService.canUserMakeRequest()` before API calls.

---

## S2. Sensitive Functions Without Auth

```powershell
$sensitivePatterns = "generateContent|processPayment|adminOnly|gemini|openai|stripe|sendMoney"
$sensitiveFiles = Select-String -Path lib\**\*.dart -Pattern $sensitivePatterns -ErrorAction SilentlyContinue

foreach ($match in ($sensitiveFiles | Group-Object Path)) {
    $content = Get-Content $match.Name -Raw -ErrorAction SilentlyContinue
    if ($content -notmatch "FirebaseAuth|currentUser|isAuthenticated|\.auth\?\.uid") {
        Write-Warning "SECURITY: $(Split-Path $match.Name -Leaf) has sensitive functions without auth check"
    }
}
```

**Fix:** Add `if (FirebaseAuth.instance.currentUser == null) return;` at start.

---

## S3. API Keys Embedded in Compiled App

```powershell
$envKeys = Select-String -Path lib\**\*.dart -Pattern "String\.fromEnvironment\(['`"](.+_KEY|.+_SECRET|.+API)" -ErrorAction SilentlyContinue
if ($envKeys) {
    Write-Warning "SECURITY: API keys may be extracted from compiled APK"
    $envKeys | Select-Object -First 5 | ForEach-Object { 
        Write-Host "  $($_.Filename):$($_.LineNumber)" -ForegroundColor Yellow 
    }
    Write-Host "  → Move sensitive keys to server-side (Firebase Functions)" -ForegroundColor Cyan
}
```

**Fix:** Move API calls to Firebase Callable Functions with server-side keys.

---

## S4. Firebase Functions Without App Check

```powershell
if (Test-Path functions/src/*.ts) {
    $functions = Get-ChildItem functions/src/*.ts -ErrorAction SilentlyContinue
    foreach ($fn in $functions) {
        $content = Get-Content $fn.FullName -Raw -ErrorAction SilentlyContinue
        if ($content -match "onCall|httpsCallable") {
            if ($content -notmatch "enforceAppCheck:\s*true") {
                Write-Warning "SECURITY: $($fn.Name) has callable functions without App Check enforcement"
            }
        }
    }
}
```

**Fix:** Add `enforceAppCheck: true` to function options.

---

## S5. App Check Not Initialized in Client

```powershell
$startupFiles = Get-ChildItem lib -Recurse -Filter *.dart -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "startup|main|app" }
    
$hasAppCheck = Select-String -Path $startupFiles.FullName -Pattern "FirebaseAppCheck|appCheck" -ErrorAction SilentlyContinue
if (-not $hasAppCheck -and (Test-Path firebase.json)) {
    Write-Warning "SECURITY: Firebase project detected but App Check not initialized"
}
```

**Fix:** Add `FirebaseAppCheck.instance.activate()` in startup.

---

## Quick Reference

| Pattern | Issue | Fix |
|---------|-------|-----|
| S1 | No rate limit | Add RateLimitingService |
| S2 | No auth check | Add FirebaseAuth check |
| S3 | Key in APK | Move to server-side |
| S4 | No App Check (server) | Add enforceAppCheck: true |
| S5 | No App Check (client) | Add FirebaseAppCheck.activate() |
