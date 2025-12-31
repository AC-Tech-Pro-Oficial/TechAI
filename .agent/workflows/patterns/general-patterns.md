# General Improvement Patterns (Pattern G)
// description: Language-agnostic file handling and safety rules

## 1. Safety Protocols

### Trash Can Logic (Safe Delete)
Always move files to `.gemini/trash` before deletion.

```powershell
$trashPath = ".gemini/trash/$(Get-Date -Format 'yyyyMMdd_HHmm')"
New-Item -ItemType Directory -Force -Path $trashPath | Out-Null

function Safe-Delete ($path) { 
    if (Test-Path $path) {
        Write-Host "Safe-Deleting $path..." -ForegroundColor Yellow
        Copy-Item $path $trashPath -Force -Recurse
        Remove-Item $path -Force -Recurse
    }
}
```

## 2. Common File Operations

### Text File Standardization
- **Encoding**: Ensure UTF-8.
- **Line Endings**: Normalize to LF or CRLF consistently.
- **Trailing Whitespace**: Remove from all text files.

```powershell
function Fix-Whitespace {
    param($FileExtensions = @(".md", ".txt", ".json", ".yaml", ".xml"))
    Get-ChildItem -Recurse -Include $FileExtensions | ForEach-Object {
        (Get-Content $_.FullName) | ForEach-Object { $_.TrimEnd() } | Set-Content $_.FullName -Encoding UTF8
    }
}
```

## 3. Config Cleanup
- Remove empty `TODO` or `FIXME` comments if the task is done (context dependent).
- Ensure `.gitignore` exists and contains standard exclusions (`.env`, `node_modules`, `build/`).

## 4. Git Operations
- **Commit**: Always use emoji-based conventional commits.
- **Branch**: Never commit to `main` without verification.
