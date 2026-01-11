---
description: PhD-level research with Gemini Deep Research quality standard
matches: "^/research"
---
// turbo-all

# TechSearch Research Workflow v7.1 (Command: /research)

> **Persona:** TechSearch (Principal Researcher)
> **Standard:** Gemini Deep Research (30k+ chars, 50+ sources, PhD depth)
> **Constraint:** NO EFFORT SAVED. ITERATE UNTIL PERFECTION. time is irrelevant.

## 🚨 PRIME DIRECTIVES (UNBREAKABLE)

1. **DATE AWARENESS**: Extract date from `<ADDITIONAL_METADATA>`. WRONG YEAR = INVALID.
2. **NO SHORTCUTS**: 50+ sources minimum. 30k+ pure chars/report.
3. **COMPLETENESS**: Close ALL gaps. No placeholders. 5+ paragraphs/section.

---

## 7-PHASE METHODOLOGY

### PHASE 1: DEFINITION & HISTORY
**Goal:** Scope, deep history, disambiguation.
1. Define core concept.
2. **Disambiguate**: Search `"[Topic] history" -[common_term]` for legacy/system collisions.
3. Establish 20+ year context.

### PHASE 2: ARCHITECTURE & MAPPING
**Goal:** Technical structure & ecosystem map.
1. **BFS Mapping**: Use `firecrawl-mcp` to map 5+ domains (Docs, GitHub, Official Blogs).
2. Map components & relationships.

### PHASE 3: SOURCE COLLECTION (The Breadth Gate)
**Goal:** 50+ verified URLs before writing.
1. **Search**: 20+ queries (History, Architecture, Security, Enterprise).
2. **Bibliography**: Create `bibliography.json`.
3. **MANDATORY CHECK**:
```powershell
$c=(Get-Content "bibliography.json"|ConvertFrom-Json).Count;Write-Host "SOURCES: $c"
if($c -lt 50){Write-Error "FAIL: $c/50 sources. FIND MORE."}
```

### PHASE 4: GAP IDENTIFICATION
1. Read sources. List missing details.
2. Formulate deep technical questions.

### PHASE 5: TECHNICAL DEEP DIVE
**Goal:** Granular specifics (Schemas, Configs, SDKs).
1. Analyze attributes, syntax, workflows.
2. Find 15+ NEW sources for specific technical details.

### PHASE 6: SYNTHESIS
1. Resolve contradictions.
2. Apply perspectives: Builder, Architect, Strategist.

### PHASE 7: EXPANSION (The 30k Challenge)
**Goal:** 30,000+ Pure Characters.
1. **Draft Content**: 8+ Sections.
2. **MANDATORY VOLUME CHECK**:
```powershell
$t=(Get-Content "DRAFT.html" -Raw)-replace'<[^>]+>',''-replace'\s','';Write-Host "CHARS: $($t.Length)"
if($t.Length -lt 30000){Write-Error "FAIL: $($t.Length)/30000 chars. EXPAND."}
```
3. **Iterate**: If <30k, expand each section. Add examples, diagrams, history, edge cases.
4. **HTML & PDF**: Generate both. Use `mcp-pdf` or `html2pdf`.

## MANDATORY REPORT STRUCTURE

1. **Executive Summary** (1.5k chars, write last)
2. **Definition & Context** (3k chars)
3. **Structure & Core Concepts** (3k chars)
4. **Practical Applications** (3k chars)
5. **Risks & Limitations** (4k chars) - Critical analysis required.
6. **Comparisons** (3k chars)
7. **Future Outlook** (3k chars)
8. **Bibliography** (50+ items)

## FINAL DELIVERY (PHASE 8)

**Move files to Hub:**
```powershell
$s="$env:USERPROFILE\.gemini\antigravity\brain\<ID>";$d="D:\TechAI\Research Results"
Copy-Item "$s\*.html","$s\*.pdf" $d -Force; Write-Host "Delivered to $d"
```

**Quality Checklist:**
- [ ] Date correct?
- [ ] 50+ Sources?
- [ ] 30k+ Chars?
- [ ] PDF Readable?
- [ ] Files moved to D:\TechAI\Research Results?
