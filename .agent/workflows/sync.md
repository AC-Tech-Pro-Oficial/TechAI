---
description: Semantic sync - analyzes changes & context to update rules, then pushes to GitHub
matches: "^/sync"
---
// turbo-all

# Context-Aware Sync Workflow v3.1 (Turbo Optimized)

> **Source of Truth**: `C:\Users\MBCJ\.gemini\antigravity\global_workflows\`
> **Config File**: `D:\TechAI\projects.json`
> **Goal**: Automatically discover & sync projects with advanced insights and notifications.

---

## Command Variants
| Command | Description |
|---------|-------------|
| `/sync` | Full sync all projects |
| `/sync dry-run` | Visualize changes without writing |
| `/sync quick` | Skip analysis, execute immediately |

---

## Phase 1: Discovery & Analysis (Consolidated)
// turbo
```powershell
# --- PART 1: SETUP ---
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "🔧 Starting Sync v3.1..."

$dryRun = $false; $quickMode = $false; $targetFilter = $null
foreach ($arg in $args) {
    if ($arg -eq "dry-run" -or $arg -eq "--dry-run") { $dryRun = $true; Write-Host "🧪 DRY RUN" }
    elseif ($arg -eq "quick" -or $arg -eq "--quick") { $quickMode = $true; Write-Host "⚡ QUICK MODE" }
    elseif ($arg -like "--*") { continue }
    else { $targetFilter = $arg }
}

if (-not (Test-Connection github.com -Count 1 -Quiet)) { Write-Host "❌ ABORT: No Internet"; exit 1 }

$config = Get-Content "D:\TechAI\projects.json" -Raw | ConvertFrom-Json
$stateFile = "D:\TechAI\.sync_state.json"

# --- SECURITY CHECK: Ensure credentials are NEVER committed ---
$securityPatterns = @("Credentials/", "credentials/", "secrets/", ".secrets/", "*.pem", "*_api_key.txt", "*_token.txt")
Write-Host "🔒 Security Check: Validating gitignore..."
$globalIgnore = git config --global core.excludesFile
if (-not $globalIgnore -or -not (Test-Path $globalIgnore)) {
    Write-Host "❌ ABORT: No global gitignore found. Run security setup first."
    exit 1
}

# --- PART 2: DISCOVERY ---
$scanPaths = $config.autoDiscover.scanPaths
$excludePaths = $config.autoDiscover.excludePaths
$discoveredProjects = @()

foreach ($scanPath in $scanPaths) {
    if (-not (Test-Path $scanPath)) { continue }
    $gitDirs = Get-ChildItem -Path $scanPath -Directory -Recurse -Depth $config.autoDiscover.maxDepth -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq ".git" } |
        Where-Object { 
            $parent = $_.Parent.FullName
            $excluded = $false
            foreach ($ex in $excludePaths) { if ($parent -like "$ex*") { $excluded = $true; break } }
            -not $excluded
        }
    
    foreach ($gitDir in $gitDirs) {
        $path = $gitDir.Parent.FullName; $name = $gitDir.Parent.Name
        $type = "Unknown"
        if ($name -eq "TechAI") { $type = "Hub" }
        elseif (Test-Path "$path\pubspec.yaml") { $type = "Flutter" }
        elseif (Test-Path "$path\next.config.js") { $type = "Next.js" }
        elseif (Test-Path "$path\package.json") { $type = "Node.js" }
        elseif (Test-Path "$path\requirements.txt") { $type = "Python" }
        elseif (Get-ChildItem -Path $path -Filter "*.typ" -Recurse -Depth 1 -ErrorAction SilentlyContinue) { $type = "Typst" }
        
        $discoveredProjects += @{ Name = $name; Path = $path; Type = $type }
    }
}

if ($targetFilter) {
    $discoveredProjects = $discoveredProjects | Where-Object { $_.Name -like "*$targetFilter*" }
    if (!$discoveredProjects) { Write-Host "❌ No matching projects"; exit 0 }
}
Write-Host "📦 Found $($discoveredProjects.Count) projects"

# --- PART 3: SEMANTIC ANALYSIS ---
if (!$quickMode) {
    $lastSync = if (Test-Path $stateFile) { (Get-Content $stateFile | ConvertFrom-Json).timestamp } else { "HEAD~10" }
    
    foreach ($proj in $discoveredProjects) {
        Push-Location $proj.Path
        if ($proj.Type -eq "Flutter" -and (git diff --name-only $lastSync HEAD 2>$null | Select-String "pubspec.yaml")) {
             $diff = git diff $lastSync HEAD -- pubspec.yaml 2>$null
             if ($diff -match "^\+.*:\s*\^") { Write-Host "📊 $($proj.Name): Dependency Update Detected" }
        }
        Pop-Location
    }
}

# Export for Phase 2 (Persist State)
$discoveredProjects | ConvertTo-Json | Set-Content "D:\TechAI\.sync_projects_tmpy.json"
```

---

## Phase 2: Agent Drafting
*   **Agent**: `TechRules`
*   **Action**: Read `D:\TechAI\.sync_projects_tmpy.json`. Generate `PROJECT_RULES.draft.md` in each project.
    *   **Logic**:
        1. **Preserve**: `<!-- MANUAL -->` blocks.
        2. **Auto-Update Facts**: Check versions/folders and update facts.
        3. **No Placeholders**: Strict sovereignty.
*   **Context**: Filter brain retrieval by Project Name.

---

## Phase 2.5: README Generation
*   **Agent**: `TechRules`
*   **Action**: For each project in `.sync_projects_tmpy.json`, generate a comprehensive `README.md`.

// turbo
```powershell
# README Generation Script
$projects = Get-Content "D:\TechAI\.sync_projects_tmpy.json" -Raw | ConvertFrom-Json
$dryRun = ($args -contains "dry-run" -or $args -contains "--dry-run")

foreach ($p in $projects) {
    $path = $p.Path; $name = $p.Name; $type = $p.Type
    Write-Host "📝 Generating README for $name..."
    
    # Detect stack and generate badges
    $badges = ""
    switch ($type) {
        "Flutter" { $badges = "![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat&logo=flutter) ![Dart](https://img.shields.io/badge/Dart-0175C2?style=flat&logo=dart)" }
        "Node.js" { $badges = "![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)" }
        "Next.js" { $badges = "![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js) ![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)" }
        "Python" { $badges = "![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)" }
        "Typst" { $badges = "![Typst](https://img.shields.io/badge/Typst-239DAD?style=flat)" }
        "Hub" { $badges = "![PowerShell](https://img.shields.io/badge/PowerShell-5391FE?style=flat&logo=powershell&logoColor=white)" }
        default { $badges = "![Project](https://img.shields.io/badge/Project-Active-green)" }
    }
    
    # Get description from PROJECT_RULES.md if exists
    $description = "A $type project."
    if (Test-Path "$path\PROJECT_RULES.md") {
        $rules = Get-Content "$path\PROJECT_RULES.md" -Raw
        if ($rules -match "<!--\s*MANUAL\s*-->(.*?)<!--\s*/MANUAL\s*-->" ) {
            $manual = $matches[1].Trim()
            if ($manual -and $manual -ne "") { $description = $manual }
        }
    }
    
    # Find images for screenshots section
    $screenshots = ""
    $images = Get-ChildItem -Path $path -Include *.png,*.jpg,*.gif,*.webp -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -First 3
    if ($images) {
        $screenshots = "`n## 📸 Screenshots`n"
        foreach ($img in $images) {
            $relPath = $img.FullName.Replace($path, "").TrimStart("\").Replace("\", "/")
            $screenshots += "![Screenshot](./$relPath)`n"
        }
    }
    
    # Generate directory structure (simplified)
    $structure = "``````" + "`n"
    $structure += "$name/`n"
    $dirs = Get-ChildItem -Path $path -Directory -Depth 0 -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch "^\.|node_modules|build|\.git" } | Select-Object -First 8
    foreach ($d in $dirs) { $structure += "├── $($d.Name)/`n" }
    $files = Get-ChildItem -Path $path -File -Depth 0 -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "\.(md|json|yaml|py|dart|js|ts|typ)$" } | Select-Object -First 5
    foreach ($f in $files) { $structure += "├── $($f.Name)`n" }
    $structure += "``````"
    
    # Generate installation instructions based on type
    $install = ""
    switch ($type) {
        "Flutter" { $install = "``````bash`nflutter pub get`nflutter run`n``````" }
        "Node.js" { $install = "``````bash`nnpm install`nnpm start`n``````" }
        "Next.js" { $install = "``````bash`nnpm install`nnpm run dev`n``````" }
        "Python" { $install = "``````bash`npip install -r requirements.txt`npython main.py`n``````" }
        "Typst" { $install = "``````bash`ntypst compile main.typ`n``````" }
        default { $install = "See project documentation." }
    }
    
    # Check for license
    $license = "Proprietary"
    if (Test-Path "$path\LICENSE") { $license = "See [LICENSE](./LICENSE)" }
    
    # Build final README
    $readme = @"
# $name

$badges

> $description
$screenshots
## 🏗️ Project Structure

$structure

## 🚀 Getting Started

$install

## 📄 License

$license

---
*Auto-generated by TechAI Sync v3.2*
"@
    
    if ($dryRun) {
        Write-Host "  [DRY RUN] Would write README.md ($($readme.Length) chars)"
    } else {
        Set-Content -Path "$path\README.md" -Value $readme -Encoding UTF8
        Write-Host "  ✅ README.md generated ($($readme.Length) chars)"
    }
}
```

---

## Phase 3: Execution (Consolidated)
> [!CAUTION]
> **Check before proceeding.** If `$dryRun`, Agent MUST stop here.

// turbo
```powershell
# Retrieve Context
if (-not (Test-Path "D:\TechAI\.sync_projects_tmpy.json")) { Write-Host "❌ No projects context"; exit 1 }
$discoveredProjects = Get-Content "D:\TechAI\.sync_projects_tmpy.json" -Raw | ConvertFrom-Json
$dryRun = ($args -contains "dry-run" -or $args -contains "--dry-run")
$quickMode = ($args -contains "quick" -or $args -contains "--quick")

if ($dryRun) { Write-Host "🧪 DRY RUN COMPLETE. No changes applied."; exit 0 }

# --- PART 1: APPLY DRAFTS & BACKUP ---
foreach ($p in $discoveredProjects) {
    if (Test-Path "$($p.Path)\PROJECT_RULES.draft.md") { Move-Item "$($p.Path)\PROJECT_RULES.draft.md" "$($p.Path)\PROJECT_RULES.md" -Force }
}

$source = "C:\Users\MBCJ\.gemini\antigravity\global_workflows"
$destinations = @("D:\TechAI\.agent\workflows", "D:\.agent\workflows", "C:\Users\MBCJ\.agent\workflows")
foreach ($dest in $destinations) {
    if (-not (Test-Path $dest)) { New-Item $dest -ItemType Directory -Force | Out-Null }
    Copy-Item "$source\*.md" "$dest\" -Force
}

# --- PART 2: GIT SYNC LOOP ---
$results = @()
foreach ($p in $discoveredProjects) {
    Push-Location $p.Path
    $pull = git pull --rebase --autostash 2>&1
    if ($LASTEXITCODE -ne 0) {
        $results += @{ Name = $p.Name; Status = "❌ Conflict" }
        Pop-Location; continue 
    }
    
    if (git status --porcelain) {
        git add -A; git commit -m "🔄 Sync v3.1"
        git push; $pushStatus = $LASTEXITCODE
        
        if ($pushStatus -eq 0) { 
            $tag = "sync-$($p.Name)-$(Get-Date -Format 'yyyyMMdd-HHmm')" -replace ' ', '-'
            git tag $tag; git push origin $tag 2>&1 | Out-Null
            $results += @{ Name = $p.Name; Status = "✅ Pushed & Tagged" }
        } else {
            $results += @{ Name = $p.Name; Status = "❌ Push Failed" }
        }
    } else {
        $results += @{ Name = $p.Name; Status = "⚪ No changes" }
    }
    Pop-Location
}

# --- PART 3: NOTIFICATIONS ---
$config = Get-Content "D:\TechAI\projects.json" -Raw | ConvertFrom-Json
$summary = $results | Out-String
$discord = $config.settings.notifications.discordWebhook
$slack = $config.settings.notifications.slackWebhook

if ($discord) { Invoke-RestMethod -Uri $discord -Method Post -Body (@{ content = "**Sync Complete**`n$summary" } | ConvertTo-Json) -ContentType 'application/json' -ErrorAction SilentlyContinue }
if ($slack) { Invoke-RestMethod -Uri $slack -Method Post -Body (@{ text = "*Sync Complete*`n```$summary```" } | ConvertTo-Json) -ContentType 'application/json' -ErrorAction SilentlyContinue }

$results | Format-Table -AutoSize
Remove-Item "D:\TechAI\.sync_projects_tmpy.json" -ErrorAction SilentlyContinue
```
