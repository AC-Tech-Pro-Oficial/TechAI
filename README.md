# TechAI IDE Extension

> Advanced AI quota monitoring, MCP server management, and developer tools for Antigravity IDE

![Version](https://img.shields.io/badge/version-2.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### 📊 AI Quota Monitoring
- Real-time quota tracking for AI models (Anthropic, Gemini, GPT)
- Visual gauges in status bar
- Configurable polling intervals
- Multi-model support with group ordering

### 🔧 MCP Server Management
- **Installed** - View and manage your configured MCP servers
- **Recommended** - AI-powered recommendations based on your workspace
- **Marketplace** - Browse and install from the community registry
- **Settings** - In-panel configuration with token limits

### ⚙️ Smart Defaults
- Auto-apply Best Picks feature for curated MCP servers
- Context-aware token limit management
- Interactive authentication for API keys

## 🚀 Installation

### From VSIX
1. Download `techai-ide-2.0.0.vsix` from Releases
2. In Antigravity: `Ctrl+Shift+P` → "Install from VSIX"
3. Select the downloaded file
4. Reload window

### From Source
```bash
cd "D:\TechAI\IDE Extension"
npm install
npm run package
```

## 📖 Usage

### Status Bar
The extension adds quota information to your status bar. Click to open the quick menu.

### MCP Panel
Access via Activity Bar (TechAI icon) or `Ctrl+Shift+P` → "TechAI: Open MCP Panel"

### Commands
| Command | Description |
|---------|-------------|
| `TechAI: Refresh Now` | Force refresh quota data |
| `TechAI: Open Dashboard` | Open full dashboard view |
| `TechAI: Open MCP Panel` | Open MCP server manager |
| `TechAI: Apply Best Picks` | Apply curated MCP servers |
| `TechAI: Check for Updates` | Check for extension updates |

## ⚙️ Configuration

Access via Settings or the in-panel Settings tab:

| Setting | Description | Default |
|---------|-------------|---------|
| `techai.enabled` | Enable auto monitoring | `true` |
| `techai.pollingInterval` | Refresh interval (seconds) | `120` |
| `techai.showGauges` | Show visual gauge icons | `true` |
| `techai.pinnedModels` | Models to show in status bar | `[]` |
| `techai.autoUpdate` | Auto-install updates | `false` |

## 📁 Project Structure

```
IDE Extension/
├── assets/          # Icons and images
├── docs/            # Documentation
├── export/          # Compiled JavaScript
├── src/
│   ├── core/        # Core managers (MCP, Config, API)
│   ├── ui/          # UI components (Panel, Dashboard)
│   └── extension.ts # Entry point
├── package.json
└── tsconfig.json
```

## 🔗 Related

- [TechAI Hub](../) - Main TechAI repository
- [AC Tech](https://ac-tech.pro) - Developer website

## 📄 License

MIT License - see [LICENSE](./LICENSE)

---

*Part of the TechAI ecosystem by AC Tech*
