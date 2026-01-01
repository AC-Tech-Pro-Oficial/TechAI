# TechAI

<p align="center">
  <img src="./assets/logo.png" alt="TechAI Logo" width="200">
</p>

<p align="center">
  <strong>The Central Hub for AC Tech's AI Development Ecosystem</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PowerShell-5391FE?style=for-the-badge&logo=powershell&logoColor=white" alt="PowerShell">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/AI%20Agentic-FF6B6B?style=for-the-badge&logo=google-gemini&logoColor=white" alt="AI Agentic">
  <img src="https://img.shields.io/badge/Antigravity%20IDE-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Antigravity IDE">
</p>

---

## 📋 Overview

TechAI is the **central nervous system** of AC Tech's software engineering operations. Following the "Hub & Spoke" architecture model, it serves as the **Source of Truth** for all agent context, configuration, and rule enforcement across the entire AC Tech ecosystem.

This repository houses the tools, configurations, and memory systems that power our intelligent multi-agent workflows, enabling rapid development through AI-assisted coding, research, and design.

---

## 🤖 The Agentic Swarm

TechAI orchestrates a team of specialized AI agents, each with a distinct persona and responsibility:

| Agent | Role | Specialty |
|:------|:-----|:----------|
| **TechAI** ⭐ | Chief of Staff | Routes all requests. Does NOT implement. |
| **TechRules** | The Warden | Enforces standards & project rules. |
| **TechSearch** | The Scholar | PhD-level deep research & analysis. |
| **TechPlan** | The Architect | High-level design & implementation plans. |
| **TechCode** | The Builder | Senior Engineer. Code → Fix → Repeat loop. |
| **TechTest** | The Auditor | QA & Security verification. |
| **TechDesign** | The Artist | UI/UX & asset generation. |
| **TechAssist** | The Technician | SysAdmin & troubleshooting. |

> **All requests route through TechAI first.** TechAI delegates to the appropriate specialist.

---

## 🛠️ Key Components

### 🧩 Antigravity IDE Extension

<p align="center">
  <img src="./assets/ide_extension_screenshot.png" alt="TechAI IDE Extension Screenshot" width="600">
</p>

The **TechAI IDE Extension** for Google Antigravity IDE provides:
- **📊 AI Quota Monitoring**: Real-time tracking of Claude, Gemini, and other AI usage.
- **🔧 MCP Server Management**: Configure and monitor Model Context Protocol servers.
- **⚙️ Smart Configuration**: Automated settings management for the agentic workflow.

### 🧠 Context Memory
The `Personal Context Memory.txt` file acts as the long-term memory store for agent interactions, user preferences, and operational context. All agents read this file to personalize their responses.

### 📜 Project Rules & Manifesto
- **`PROJECT_RULES.md`**: Defines operational safety (e.g., GitHub rate limits, anti-spam protection).
- **`TechAI_Manifesto.md`**: The "Global Agentic Constitution" — prime directives, model exclusivity, and quality standards.

### 🔑 Credentials Vault
Securely manages API keys for all integrated services (Gemini, Claude, OpenAI, Firebase, Hostinger, etc.). **Never committed to Git.**

---

## 📂 Project Structure

```text
TechAI/
├── Credentials/              # [SECURE] API keys and secrets (GitIgnored)
├── IDE Extension/            # Source code for the Antigravity IDE extension
├── Prompts/                  # Agent persona definitions and templates
├── Research Results/         # Artifacts from deep research sessions
├── assets/                   # Branding and media assets
│   ├── logo.png              # AC Tech logo
│   └── ide_extension_screenshot.png
├── docs/                     # Internal documentation and guides
├── tools/                    # Automation scripts (PS1/Py)
├── Personal Context Memory.txt  # Agent long-term memory
├── PROJECT_RULES.md          # Operational safety & rules
├── TechAI_Manifesto.md       # Core philosophy & constitution
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
| Tool | Version | Purpose |
|------|---------|---------|
| PowerShell | 7+ | Scripting & Automation |
| Node.js | 18+ | IDE Extension development |
| Python | 3.10+ | Research & CLI tools |
| Antigravity IDE | Latest | Primary development environment |

### IDE Extension Setup
```powershell
# Navigate to the extension directory
cd "IDE Extension"

# Install dependencies
npm install

# Build the extension
npm run build

# Package as VSIX (optional)
npm run package
# Output: D:\IDE Extensions\TechAI.vsix
```

### Configuration Paths
| File | Location | Purpose |
|------|----------|---------|
| MCP Config | `C:\Users\MBCJ\.gemini\antigravity\mcp_config.json` | **ONLY** MCP configuration file |
| Global Workflows | `C:\Users\MBCJ\.gemini\antigravity\global_workflows\` | Source of truth for `/commands` |
| Credentials | `D:\TechAI\Credentials\` | API keys (local only) |

---

## 📖 Documentation

- [IDE Extension Guide](./docs/IDE_Extension.md)
- [TechAI Manifesto](./TechAI_Manifesto.md)
- [Credentials Guide](./Credentials/CREDENTIALS_GUIDE.md)

---

## 🤝 Contact & Support

| Channel | Link |
|---------|------|
| 📧 Email | [contato@ac-tech.pro](mailto:contato@ac-tech.pro) |
| 🌐 GitHub | [AC-Tech-Pro-Oficial](https://github.com/AC-Tech-Pro-Oficial) |
| 📸 Instagram | [@actech.oficial](https://www.instagram.com/actech.oficial/) |
| 🐦 X / Twitter | [@ac_tech_pro](https://x.com/ac_tech_pro) |
| 🎵 TikTok | [@ac.tech.pro](https://www.tiktok.com/@ac.tech.pro) |

---

<p align="center">
  <strong>© 2026 AC Tech. Quality > Speed > Cost.</strong>
</p>

