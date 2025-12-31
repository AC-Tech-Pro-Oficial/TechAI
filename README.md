<div align="center">

<img src="assets/logo.png" width="128" alt="TechQuotas Logo" />

# TechQuotas Antigravity
### Precision Analytics for your AI Quotas.

![VS Code](https://img.shields.io/badge/VS%20Code-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Version](https://img.shields.io/badge/v1.1.14-blue?style=for-the-badge)
![Downloads](https://img.shields.io/badge/Downloads-10K+-green?style=for-the-badge)

</div>

---

## 📊 The Dashboard Experience

**TechQuotas Antigravity** transforms how you monitor your AI consumption. Forget checking logs or guessing limits. Get real-time, visual telemetry right inside your IDE.

> "If you can't measure it, you can't manage it." — *Peter Drucker*

### 🎯 Key Capabilities

*   **📈 Visual Gauge System**: Circular progress indicators for every model (Claude, Gemini, OpenAI).
*   **⚡ Instant Live-Updates**: Status bar reflects quota changes the millisecond they happen.
*   **🖱️ Drag-and-Drop Prioritization**: Reorder model groups via the UI to change their display priority.
*   **🚦 Smart Alerting**: Color-coded warnings (Green/Yellow/Red) based on remaining capacity.

---

## 📸 Visual Tour

### The Control Panel
Access the dedicated dashboard via command palette. Toggle visibility, reorder columns, and view deep analytics.

*(Insert screenshot of dashboard here if available, otherwise placeholders are removed for cleanliness)*

### The Status Bar
Compact, informative, and beautiful.
*   `● Claude 75%` (Healthy)
*   `● Gemini 15%` (Critical)

---

## 🚀 Installation

### Option A: VS Code Marketplace (Recommended)
1.  Open **Extensions** sidebar (`Ctrl+Shift+X`).
2.  Search for `TechQuotas Antigravity`.
3.  Click **Install**.

### Option B: The "Power User" Way (VSIX)
Download the latest `.vsix` from [Releases](https://github.com/ACTechPRO/TechQuotas-Antigravity/releases) and:

```bash
code --install-extension techquotas-antigravity.vsix
```

---

## ⚙️ Configuration

Fine-tune your telemetry in `settings.json`:

```json
{
  "techquotas.pollingInterval": 60,       // Refresh every 60s
  "techquotas.showGauges": true,          // Show visual icons
  "techquotas.pinnedModels": ["claude-3-opus", "gemini-1.5-pro"] 
}
```

---

## 💬 Support & Feedback

*   **Need Help?** [Open a Discussion](https://github.com/ACTechPRO/TechQuotas-Antigravity/discussions)
*   **Found a Glitch?** [Report an Issue](https://github.com/ACTechPRO/TechQuotas-Antigravity/issues)
*   **Wiki Docs**: [Read the Manual](https://github.com/ACTechPRO/TechQuotas-Antigravity/wiki)

---

<div align="center">

**Engineered by AC Tech Solutions**

[🌐 Website](https://ac-tech.pro) • [🐙 GitHub](https://github.com/ACTechPRO)

</div>
