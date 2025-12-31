# Breaking Changes Registry

Known API changes that require code migration. Used by `/test` Section 4.6.

---

## Flutter Packages

### firebase_app_check (0.4.0+)

| Old API | New API | Notes |
|---------|---------|-------|
| `androidProvider: AndroidProvider.playIntegrity` | `providerAndroid: const AndroidPlayIntegrityProvider()` | Type changed from enum to class |
| `appleProvider: AppleProvider.appAttest` | `providerApple: const AppleAppAttestProvider()` | Type changed from enum to class |

**Detection:**
```powershell
rg "androidProvider:|appleProvider:" lib/ --glob "*.dart"
```

---

### shared_preferences (11.0.0+)

| Old API | New API | Notes |
|---------|---------|-------|
| `encryptedSharedPreferences: true` | *(removed)* | Encryption is now automatic |

**Detection:**
```powershell
rg "encryptedSharedPreferences" lib/ --glob "*.dart"
```

---

### google_generative_ai → firebase_ai

| Old API | New API | Notes |
|---------|---------|-------|
| `GenerativeModel` | `FirebaseAI.instance.generativeModel` | Package migration |

**Detection:**
```powershell
rg "package:google_generative_ai" lib/ --glob "*.dart"
```

---

## Python Packages

### requests → httpx (async)

| Old API | New API | Notes |
|---------|---------|-------|
| `requests.get()` | `httpx.get()` or `async with httpx.AsyncClient()` | For async support |

**Detection:**
```powershell
rg "import requests" --glob "*.py"
```

---

### typing (Python 3.9+)

| Old API | New API | Notes |
|---------|---------|-------|
| `from typing import List, Dict` | `list`, `dict` | Built-in generics |

**Detection:**
```powershell
rg "from typing import.*List|Dict" --glob "*.py"
```

---

## PowerShell

### PSScriptAnalyzer Rules

| Old Pattern | New Pattern | Notes |
|-------------|-------------|-------|
| `Write-Host` | `Write-Output` or `Write-Information` | For pipeline compatibility |
| Plural function names | Singular nouns | PSUseApprovedVerbs |

**Detection:**
```powershell
Invoke-ScriptAnalyzer -Path . -Recurse
```

---

## How to Add New Entries

When you encounter a breaking change:
1. Add package name and version
2. Document old vs new API
3. Add detection script
4. Reference in Pattern Q for fix guidance

