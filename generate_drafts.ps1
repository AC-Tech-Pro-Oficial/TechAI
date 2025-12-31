$projects = Get-Content "D:\TechAI\.sync_projects_tmpy.json" | ConvertFrom-Json
foreach ($p in $projects) {
    if (-not (Test-Path $p.Path)) { continue }
    $draftPath = Join-Path $p.Path "PROJECT_RULES.draft.md"
    $currentPath = Join-Path $p.Path "PROJECT_RULES.md"
    
    $content = "# Project Rules: $($p.Name)`n`n"
    $content += "## Metadata`n- **Type**: $($p.Type)`n- **Path**: $($p.Path)`n`n"
    $content += "## Core Directives`n1. Follow global rules in `D:\TechAI\PROJECT_RULES.md`.`n"
    
    # Preserve MANUAL blocks if existing
    if (Test-Path $currentPath) {
        $oldContent = Get-Content $currentPath -Raw
        if ($oldContent -match "(?s)<!-- MANUAL -->(.*?)<!-- /MANUAL -->") {
            $content += "`n<!-- MANUAL -->$($matches[1])<!-- /MANUAL -->`n"
        } else {
             $content += "`n<!-- MANUAL -->`n`n<!-- /MANUAL -->`n"
        }
    } else {
        $content += "`n<!-- MANUAL -->`n`n<!-- /MANUAL -->`n"
    }

    Set-Content -Path $draftPath -Value $content -Encoding UTF8
    Write-Host "Draft generated for $($p.Name)"
}
