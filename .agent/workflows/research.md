---
description: PhD-level research with Gemini Deep Research quality standard
matches: "^/research"
---
// turbo-all

# TechSearch Research Workflow v7.0 (Command: /research)

> **Persona:** TechSearch (Principal Researcher & Systems Architect)
> **Quality Standard:** Gemini Deep Research — 20k+ Characters, PhD depth, 50+ sources
> **Time Investment:** NO EFFORT SAVED. Iterative expansion until depth targets are met.
> **Output:** Professional HTML with interactive elements + PDF compatibility
> **Depth Floor:** Minimum 20,000 pure characters (Strict: No HTML, No Whitespace)

> [!CRITICAL]
> **YOU MUST READ THIS ENTIRE FILE.**
> **The Quality Gates (Source Count, Volume Check) are at the END.**
> **If you only read the first 100 lines, YOU WILL FAIL.**
> **SCROLL DOWN. READ LINES 1-400.**


---

## 🚨 PRIME DIRECTIVES

> [!CAUTION]
> **UNBREAKABLE RULES — VIOLATION INVALIDATES ALL OUTPUT**

### 1. DATE AWARENESS (FIRST STEP OF ANY TASK)
- Extract current date from `<ADDITIONAL_METADATA>`: `YYYY-MM-DDTHH:MM:SS±HH:MM`
- USE this date for all research filtering and output
- WRONG YEAR = OUTPUT INVALID

### 2. NO EFFORT SAVED — TIME IS UNLIMITED
- **TAKE AS MUCH TIME AS POSSIBLE** to produce the best research
- Minimum 50 sources for any research-tier request
- Complete every phase — no shortcuts
- Token usage is IRRELEVANT — quality is the ONLY metric
- **15+ web searches MINIMUM** before drafting
- **Longer is better** — aim for 30k+ characters, not just 20k minimum

### 3. COMPLETENESS OVER SPEED
- Research until ALL gaps are closed
- No "see link for more" — write ALL information found
- No placeholders, no summaries without substance
- **Each section must have 5+ substantive paragraphs**

---

## 📊 THE 7-PHASE DEEP RESEARCH METHODOLOGY

Based on analysis of Gemini Deep Research, implement these phases IN ORDER:

### PHASE 1: DEFINITION, HISTORY & DISAMBIGUATION

**Goal:** Establish crystal-clear scope, DEEP history, and prevent concept confusion.

> [!IMPORTANT]
> **HISTORY DEPTH MANDATE**
> You MUST research OBSCURE and NON-OBVIOUS historical connections.
> Do NOT just identify the "common" collisions (e.g., Minecraft, Tron).
> Search for: "[Topic] history before [Year]", "[Acronym] legacy systems", "[Acronym] mainframe".

**Actions:**
1. Define the core concept precisely
2. **DEEP DISAMBIGUATION CHECK** — Identify ALL name collisions, including:
   - **Obvious Collisions:** Popular culture, other tech (e.g., "Python" = snake, language)
   - **NON-OBVIOUS Collisions (MANDATORY):** Legacy systems, mainframe/enterprise tech, academic papers
     - *Example:* "MCP" = Unisys Master Control Program (1961 mainframe OS), NOT just Tron/Minecraft.
     - **Search Query:** `"[Acronym] history" -[obvious term 1] -[obvious term 2]`
3. Establish the historical context (when introduced, by whom, why) — **Go back at least 20 years if applicable**
4. Set explicit research boundaries

**Output:** Write a 3-4 paragraph definition block including a "Historical Context" subsection.

---

### PHASE 2: ARCHITECTURAL ANALYSIS & BFS MAPPING
 
 **Goal:** Understand the technical structure AND map the ecosystem breadth.
 
 **Actions:**
 1. **BREADTH-FIRST MAPPING (MANDATORY)**
    - Use `firecrawl-mcp` to "map" at least 5 distinct high-value domains
    - *Example:* "Map `docs.anthropic.com`, `github.com/modelcontextprotocol`, `hub.docker.com`..."
    - **Goal:** Identify 50+ potential pages to visit later.
 2. Map the components and their relationships
 3. Identify the core architecture pattern
 4. Create mental model diagrams

**Thinking Pattern:**
> "I am thinking through the [X]-tier architecture... I need to resolve nuances regarding how [component A] functions versus how [component B] manages..."

---

### PHASE 3: MANDATORY SOURCE COLLECTION (THE BREADTH GATE)
 
 **Goal:** Build the bibliography *before* writing. Force breadth early.
 
 > [!IMPORTANT]
 > **PROSE BLOCKER ACTIVE**
 > You are FORBIDDEN from writing the report or "Discovery" content until you possess 50+ verified URLs.
 
 **Actions:**
 1. **DIVERSE SEARCH EXECUTION (Minimum 20 queries)**
    - Use `search_web` and `firecrawl` to farm URLs.
    - Categorize searches:
      - 5x Definition/History
      - 5x Architecture/Technical
      - 5x Security/Risk
      - 5x Enterprise/Case Studies
 2. **CREATE BIBLIOGRAPHY ARTIFACT**
    - Create/Overwrite file: `bibliography.json`
    - Format: `[ { "url": "...", "title": "...", "category": "..." }, ... ]`
 3. **RUN THE BREADTH GATE SCRIPT:**
    ```powershell
    $b = Get-Content "bibliography.json" | ConvertFrom-Json
    $count = $b.Count
    Write-Host "DETECTED_SOURCES: $count"
    if ($count -lt 50) { Write-Error "BREADTH FAIL: Only $count sources. GO BACK TO STEP 1 AND FIND MORE." }
    ```
    - If < 50: **STOP. FAIL. RE-SEARCH.**
 
 ---
 
 ### PHASE 4: GAP IDENTIFICATION & DEEP READING
 
 **Goal:** Read the collected sources and identify what is missing.
 
 **Actions:**
 1. **READ** the sources from Phase 3 (don't specificy search again, you have the URLs).
 2. List knowledge gaps discovered.
 3. Formulate specific questions that need answers.
 4. Identify areas requiring "more granular detail".

---

### PHASE 5: TECHNICAL DEEP DIVE

**Goal:** Granular technical understanding.

**Actions:**
1. Analyze specific message structures/schemas
2. Examine configuration file syntax
3. Study SDK implementations
4. Investigate deployment workflows
5. **ADDITIONAL 15+ sources for technical specifics**

**Thinking Pattern:**
> "I will be thinking through the specifics of the technical handshake and capability negotiation... I plan to investigate the exact syntax required for..."

---

### PHASE 6: SYNTHESIS & CRITIQUE

**Goal:** Combine findings into coherent insights.

**Actions:**
1. Synthesize cross-source patterns
2. Resolve contradictions identified earlier
3. Extract key insights and implications
4. Apply multi-perspective analysis:
   - **Developer perspective**: SDKs, implementation
   - **Architect perspective**: System design, topology
   - **Business/Strategist perspective**: Implications, future direction
5. Self-critique: "Is this PhD-level quality?"

---

### PHASE 7: VERIFICATION & EXPANSION (THE 20K CHALLENGE)

**Goal:** Ensure depth before consolidation.

> [!CAUTION]
> **ABSOLUTE GATE — NO EXCEPTIONS — CANNOT BE BYPASSED**
> 
> **YOU ARE FORBIDDEN FROM OUTPUTTING A REPORT UNDER 20,000 PURE CHARACTERS.**
> This gate cannot be bypassed, ignored, or rationalized away.

**Actions:**
1. **Draft the content** based on Phases 1-6
2. **RUN THE MANDATORY VOLUME CHECK SCRIPT:**
   ```powershell
   # MANDATORY — Run this and LOG the output
   $c = (Get-Content "DRAFT_PATH.html" -Raw) -replace '(?s)<script.*?</script>', '' -replace '(?s)<style.*?</style>', '' -replace '<[^>]+>', '' -replace '\s', ''
   Write-Host "PURE_CHARS: $($c.Length)"
   if ($c.Length -lt 20000) { Write-Error "GATE FAILED: $($c.Length) chars. RETURN TO PHASE 5." }
   ```
   - **YOU MUST SEE `PURE_CHARS: XXXXX` IN YOUR OUTPUT**
   - If you don't see this log, you haven't run the script
   - If < 20,000: **STOP. DO NOT OUTPUT. Return to Phase 5.**
3. **THE SOURCE COUNT CHECK (MANDATORY SCRIPT):**
   ```powershell
   # MANDATORY — Run this to verify source breadth
   $html = Get-Content "DRAFT_PATH.html" -Raw
   $sourceCount = ([regex]::Matches($html, "<li><a href=").Count)
   Write-Host "SOURCE_COUNT: $sourceCount"
   if ($sourceCount -lt 50) { Write-Error "SOURCE GATE FAILED: Only $sourceCount/50 sources. GO BACK TO PHASE 4 & SCRAPE MORE." }
   ```
   - **Requirements:** Minimum 50 distinct citations
   - If < 50: **STOP. RETURN TO PHASE 4.**
4. **THE EXPANSION LOOP:** (IF BELOW 20K):**
   - For every bullet point: "Can I write 2 paragraphs about this?"
   - For every concept: "Where is the code example?"
   - For every claim: "Where is the citation?"
   - **REPEAT until > 20,000 characters**

### PHASE 7.5: CHAIN-OF-VERIFICATION (BEFORE FINALIZING)

**Goal:** Self-verify quality before output.

**ANSWER THESE QUESTIONS — If ANY is "NO", return to appropriate phase:**
1. ☐ Does each main section have 5+ paragraphs of substantive content?
2. ☐ Are there code examples AND diagrams where applicable?
3. ☐ Are there 50+ distinct sources in the bibliography?
4. ☐ Is the security analysis multi-dimensional (attack vectors, mitigations, enterprise)?
5. ☐ Does the roadmap section include specific dates and predictions?
6. ☐ Did I run the character count script and see `PURE_CHARS: XXXXX`?
4. **BIBLIOGRAPHY CHECK:**
   - Report MUST have a "## Sources" or "## Bibliography" section
   - Minimum 30 unique, properly formatted citations
   - Each source must include: Title, URL, Date Accessed
5. **Final Consolidation:**
   - Organize into the Mandatory Report Structure
   - Add interactive HTML elements
   - Write Executive Summary LAST
   - Log final character count in walkthrough.md
6. **PDF GENERATION (MANDATORY):**
   > After creating the HTML report, you MUST generate a PDF version.
   
   **Use MCP PDF Tools:**
   - **Primary:** Use `mcp-pdf` tool (Playwright-based, supports Markdown/HTML)
   - **Fallback:** Use `html2pdf` tool (Puppeteer-based, full CSS/JS support)
   
   **Phase 7.6: LEGIBILITY CHECK (MANDATORY)**
   > After generating the PDF, you MUST read it back to ensure it isn't broken.
   1. Use `pdf-reader` tool to read the first 3 pages of your new PDF.
   2. If it returns garbage or empty text, **regenerate** using the fallback method.
   
   **Output Files:**
   **Output Files:**
   - **MANDATORY NAMING CONVENTION:** Use natural spacing for human readability.
     - ✅ RIGHT: `Analysis of [Topic].pdf`
     - ✅ RIGHT: `Comprehensive Guide to [Subject].html`
     - ❌ WRONG: `report.pdf`, `research_results.html`, `analysis_of_topic.pdf`
   - `{Descriptive Title}.pdf` — **PRIMARY deliverable**
   - `{Descriptive Title}.html` — Secondary
   
   **If MCP tools fail, use PowerShell fallback:**
   ```powershell
   Start-Process "msedge" -ArgumentList "--headless --print-to-pdf=`"output.pdf`" `"file:///path/to/report.html`""
   ```

---

## 📝 MANDATORY REPORT STRUCTURE

Every Deep Research report MUST include:

| Section | Content | **MIN CHARS** |
|---------|---------|---------------|
| **Title** | Descriptive, includes "Comprehensive Analysis" or similar | N/A |
| **Header** | Date, quality badge, source count | N/A |
| **Executive Summary** | 2-3 paragraphs, written LAST | **1,500** |
| **Table of Contents** | Clickable anchor links | N/A |
| **1. Definition & Context** | What it is, DEEP history, disambiguation | **2,500** |
| **2. Structure/Framework** | How it's organized, key components | **2,500** |
| **3. Core Concepts** | Main ideas, principles, building blocks | **2,500** |
| **4. Practical Applications** | Real-world uses, examples, case studies | **2,500** |
| **5. Client/Consumer Integration** | How to USE/CONSUME the tech (IDEs, SDKs, etc.) | **2,000** |
| **6. Risks/Limitations** | Criticisms, challenges, what can go wrong | **3,000** |
| **7. Comparisons** | How this relates to alternatives | **2,000** |
| **8. Current State & Future** | Today's situation, trends, predictions | **2,500** |
| **9. Recommendations** | Actionable next steps | **1,500** |
| **Sources** | **MANDATORY** - Full bibliography with numbered links | **50+ items** |

> **TOTAL MINIMUM: 20,000+ characters** (sections alone sum to ~20k)

---

## 🔍 SOURCE REQUIREMENTS

### Quantity Targets:
| Research Type | Minimum Sources |
|---------------|-----------------|
| Quick lookup (Tier 1) | 5-10 |
| Standard research | 30-50 |
| Deep Research (Tier 2+) | **50-100+** |

### Quality Filters:
- ❌ REJECT: SEO spam, content farms, AI-generated listicles
- ❌ REJECT: Medium posts without citations
- ❌ REJECT: Sources older than 2 years (unless foundational)
- ✅ ACCEPT: Official documentation
- ✅ ACCEPT: Peer-reviewed papers
- ✅ ACCEPT: Major tech company blogs with author attribution

---

## 🛑 TRASH VS GOLD STANDARD

| Aspect | 🗑️ TRASH (Bad Research) | 🏆 GOLD (Gemini Deep Standard) |
|--------|-------------------------|-------------------------------|
| **Depth** | Summaries, lists, "high level" | Specs, protocols, nuance, "implementation details" |
| **Explanation** | "X uses Y" | "X uses Y because [reason], ensuring [outcome]" |
| **Evidence** | General claims, feature lists | JSON schemas, raw data, primary sources, exact dates |
| **Critical Analysis** | "Pros & Cons list" | "Attack Scenarios", "Counter-arguments", "Failure Modes" |
| **Examples** | Snippets or anecdotes | Full code, complete case studies, primary documents |
| **Length** | < 10k chars | **> 20k chars (Mandatory)** |

## 💡 THINKING PATTERNS TO EMULATE

Use these phrases to guide your internal reasoning:

```
"I am refusing to summarize this; I must explain the underlying mechanism..."
"The current character count is insufficient; I need to expand on [Topic]..."
"This bullet point is lazy; I will convert it into a detailed section..."
"I am analyzing the exact JSON structure of the handshake..."
"I am contrasting the architectural trade-offs of..."
```

---

## 🎨 OUTPUT FORMAT: PROFESSIONAL HTML

### Required Features:
- Dark theme with gradient accents
- Interactive table of contents
- Collapsible `<details>` sections for deep dives
- Syntax-highlighted code blocks
- Styled comparison tables
- Color-coded callout boxes
- `@media print` rules for PDF export
- Source carousel/list with hyperlinks

### Output Locations:
| Project | Path |
|---------|------|
| **TechAI Hub (PRIMARY)** | `D:\TechAI\Research Results\{Descriptive Title}.html` |
| **TechAI Hub (PRIMARY)** | `D:\TechAI\Research Results\{Descriptive Title}.pdf` |
| **Language School** | `S:\Files\Cognicir Language School\Inbox\{Topic}_Research.html` |
| **Brain Folder (Temp)** | `C:\Users\MBCJ\.gemini\antigravity\brain\<id>\` |

> [!CAUTION]
> **PHASE 8: MANDATORY FILE MOVE (THE DELIVERY GATE)**
> 
> The Brain Folder is for **temporary artifacts only** during research.
> After completing all phases, you **MUST** move the final HTML and PDF to `D:\TechAI\Research Results\`.
> **IF YOU DO NOT MOVE THE FILES, THE RESEARCH IS INCOMPLETE.**

**MANDATORY SCRIPT (Run AFTER PDF Generation):**
```powershell
# PHASE 8: FORCE FILE MOVE — MANDATORY
$brainDir = "C:\Users\MBCJ\.gemini\antigravity\brain\<CONVERSATION_ID>" # Replace with actual ID
$destDir = "D:\TechAI\Research Results"

# Ensure destination exists
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force }

# Move HTML and PDF files
$files = Get-ChildItem -Path $brainDir -Include "*.html", "*.pdf" -Recurse
foreach ($file in $files) {
    $dest = Join-Path $destDir $file.Name
    Copy-Item -Path $file.FullName -Destination $dest -Force
    Write-Host "DELIVERED: $dest"
}

# Verify delivery
$delivered = Get-ChildItem -Path $destDir -Include "*.html", "*.pdf" -Recurse | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) }
if ($delivered.Count -lt 2) { Write-Error "DELIVERY GATE FAILED: Files not found in $destDir" }
else { Write-Host "✅ PHASE 8 COMPLETE: $($delivered.Count) files delivered." }
```

**FAILURE MODE:** If you skip this step, the user will find the report in the wrong location and the research is considered **INCOMPLETE**.

---

## ✅ COMPLETION CHECKLIST

Before finalizing, verify:

- [ ] Date extracted from `<ADDITIONAL_METADATA>` and used correctly
- [ ] All 7 phases completed
- [ ] 50+ sources consulted
- [ ] All gaps from Phase 3 closed
- [ ] Multi-perspective analysis included
- [ ] Technical disambiguation performed
- [ ] Interactive elements added
- [ ] Executive summary written LAST
- [ ] All claims have citations
- [ ] Print/PDF compatible

---

## 📣 COMPLETION MESSAGE

```
📚 TechSearch Deep Research Complete

- Topic: {topic}
- Research Date: {DATE FROM METADATA}
- Phases Completed: 7/7
- Sources Consulted: {count} (minimum 50)
- Gaps Identified: {count} | Closed: {count}
- Report: {path}
- Format: Professional HTML (PDF-ready)

Quality Standard: Gemini Deep Research ✅
Methodology: 7-Phase Iterative Analysis ✅
Output: Premium Interactive Document ✅
```
