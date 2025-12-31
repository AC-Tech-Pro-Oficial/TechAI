$ErrorActionPreference = "Continue"
Write-Host "🚀 Starting Phase 3..."
if (-not (Test-Path "D:\TechAI\.sync_projects_tmpy.json")) { Write-Host "❌ No projects context"; exit 1 }

$discoveredProjects = Get-Content "D:\TechAI\.sync_projects_tmpy.json" -Raw | ConvertFrom-Json
Write-Host "📦 Loaded $($discoveredProjects.Count) projects."

# --- PART 1: APPLY DRAFTS ---
Write-Host "📝 Applying drafts..."
foreach ($p in $discoveredProjects) {
    if (-not (Test-Path $p.Path)) { continue }
    $draft = Join-Path $p.Path "PROJECT_RULES.draft.md"
    $target = Join-Path $p.Path "PROJECT_RULES.md"
    if (Test-Path $draft) {
        Write-Host "   - Moving draft for $($p.Name)"
        Move-Item $draft $target -Force
    }
}

# --- COPY WORKFLOWS ---
Write-Host "📂 Copying workflows..."
$source = "C:\Users\MBCJ\.gemini\antigravity\global_workflows"
$destinations = @("D:\TechAI\.agent\workflows", "D:\.agent\workflows", "C:\Users\MBCJ\.agent\workflows")
foreach ($dest in $destinations) {
    if (-not (Test-Path $dest)) { New-Item $dest -ItemType Directory -Force | Out-Null }
    if (Test-Path "$source\*.md") { Copy-Item "$source\*.md" "$dest\" -Force }
}

# --- PART 2: GIT SYNC LOOP ---
Write-Host "🔄 syncing git repositories..."
$results = @()
foreach ($p in $discoveredProjects) {
    if (-not (Test-Path $p.Path)) { 
        $results += @{ Name = $p.Name; Status = "❌ Path Missing" }
        continue 
    }
    Write-Host "   - Syncing $($p.Name)..."
    Push-Location $p.Path
    
    try {
        $pullOutput = git pull --rebase --autostash 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "     ❌ Pull Conflict"
            $results += @{ Name = $p.Name; Status = "❌ Conflict" }
            Pop-Location; continue 
        }

        if (git status --porcelain) {
            Write-Host "     Commit & Push..."
            git add -A
            git commit -m "🔄 Sync v3.1" | Out-Null
            git push | Out-Null
            if ($LASTEXITCODE -eq 0) { 
                $tag = "sync-$($p.Name)-$(Get-Date -Format 'yyyyMMdd-HHmm')"
                git tag $tag
                git push origin $tag 2>&1 | Out-Null
                $results += @{ Name = $p.Name; Status = "✅ Pushed & Tagged" }
            }
            else {
                $results += @{ Name = $p.Name; Status = "❌ Push Failed" }
            }
        }
        else {
            $results += @{ Name = $p.Name; Status = "⚪ No changes" }
        }
    }
    catch {
        $results += @{ Name = $p.Name; Status = "❌ Error: $_" }
    }
    Pop-Location
}

# --- PART 3: NOTIFICATIONS ---
Write-Host "📢 Sending notifications..."
$config = Get-Content "D:\TechAI\projects.json" -Raw | ConvertFrom-Json
$summary = $results | Out-String
$discord = $config.settings.notifications.discordWebhook

if ($discord) { 
    try {
        Invoke-RestMethod -Uri $discord -Method Post -Body (@{ content = "**Sync Complete**`n$summary" } | ConvertTo-Json) -ContentType 'application/json' -ErrorAction SilentlyContinue 
    }
    catch {}
}

$results | Format-Table -AutoSize
Remove-Item "D:\TechAI\.sync_projects_tmpy.json" -ErrorAction SilentlyContinue
Write-Host "✅ Done!"
