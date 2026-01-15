/**
 * TechAI MCP Dashboard Script
 * Handles UI interactions, tab switching, and data rendering for the MCP Panel.
 */

const vscode = acquireVsCodeApi();

// State
let currentServers = {};
let currentRegistry = [];
let currentRecommended = [];
let pinnedGroups = [];
let activeTags = [];

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const contents = document.querySelectorAll('.content');
const loadingOverlay = document.getElementById('loading');

// Initialize
window.addEventListener('load', () => {
    // Restore previous state if available
    const state = vscode.getState();
    if (state && state.activeTab) {
        switchTab(state.activeTab);
    }
});

// Message Handler
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'updateData':
            handleUpdateData(message);
            break;
        case 'setBusy':
            setBusy(message.busy);
            break;
        case 'setLoading':
            setLoading(message.value);
            break;
        case 'switchTab':
            switchTab(message.tabId);
            break;
    }
});

function handleUpdateData(data) {
    if (data.servers) {
        currentServers = data.servers;
        renderServers(currentServers);
    }
    
    if (data.registry) {
        currentRegistry = data.registry;
        renderRegistry(currentRegistry);
    }
    
    if (data.recommended) {
        currentRecommended = data.recommended;
        renderRecommended(currentRecommended);
    }

    if (data.settings) {
        updateSettingsUI(data.settings);
    }

    if (data.contextSettings) {
        updateContextSettingsUI(data.contextSettings);
    }

    if (data.credentials) {
        renderCredentials(data.credentials);
    }
    
    if (data.llmProviders) {
        renderLLMProviders(data.llmProviders);
    }
}

// --- Navigation ---

function switchTab(tabId) {
    // Update tabs
    tabs.forEach(tab => {
        if (tab.id === `tab-${tabId}`) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update content
    contents.forEach(content => {
        if (content.id === tabId) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });

    // Save state
    vscode.setState({ activeTab: tabId });
}

// --- Rendering: Installed Servers ---

function renderServers(servers) {
    const container = document.getElementById('servers-list');
    if (!container) return;

    if (Object.keys(servers).length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                <div style="font-size: 40px; margin-bottom: 10px;">📦</div>
                <h3>No Servers Installed</h3>
                <p>Go to the Marketplace or Recommended tab to add servers.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = Object.entries(servers).map(([id, config]) => {
        const isEnabled = config.enabled !== false; // Default to true if undefined
        const statusClass = isEnabled ? 'status-normal' : 'status-warning';
        const statusText = isEnabled ? 'Active' : 'Disabled';
        
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title" title="${id}">${id}</span>
                    <div class="server-toggle">
                        <label class="toggle-switch">
                            <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleServer('${id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="card-desc">
                    <code>${config.command} ${(config.args || []).join(' ')}</code>
                </div>
                <div class="actions">
                     <button class="btn secondary" onclick="uninstallServer('${id}')">Uninstall</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- Rendering: Recommended ---

function renderRecommended(items) {
    const container = document.getElementById('recommended-list');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                <div style="font-size: 40px; margin-bottom: 10px;">✨</div>
                <h3>No Recommendations</h3>
                <p>Check back later for personalized suggestions.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => renderRegistryCard(item, true)).join('');
}

// --- Rendering: Registry / Marketplace ---

function renderRegistry(items) {
    const container = document.getElementById('registry-list');
    if (!container) return;
    
    // Initial render is handled by filterMarketplace
    filterMarketplace();
}

function renderRegistryCard(item, isRecommended = false) {
    const isInstalled = currentServers[item.id] || currentServers[item.name]; // Simple check
    const installBtn = isInstalled 
        ? `<button class="btn secondary" disabled>Installed</button>`
        : `<button class="btn" onclick="installServer('${item.source.repo}', '${item.name}')">Install</button>`;
        
    const badge = isRecommended ? `<span class="best-pick-badge">Best Pick</span>` : '';
    
    return `
        <div class="card">
            <div class="card-header">
                <span class="card-title" title="${item.name}">${item.name}</span>
                ${badge}
            </div>
            <div class="card-meta">
                ${(item.tags || []).map(t => `<span class="tag" onclick="addTagFilter('${t}')">${t}</span>`).join('')}
            </div>
            <div class="card-desc" title="${item.description || ''}">
                ${item.description || 'No description available.'}
            </div>
            <div class="actions">
                ${installBtn}
                <button class="btn secondary" onclick="openLink('${item.source.repo}')">View Source</button>
            </div>
        </div>
    `;
}

// --- Marketplace Filtering ---

function filterMarketplace() {
    const query = document.getElementById('search').value.toLowerCase();
    const container = document.getElementById('registry-list');
    
    if (!currentRegistry) return;

    const filtered = currentRegistry.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(query) || 
                              (item.description && item.description.toLowerCase().includes(query));
        
        const matchesTags = activeTags.length === 0 || 
                            activeTags.every(tag => (item.tags || []).includes(tag));
                            
        return matchesSearch && matchesTags;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <h3>No matches found</h3>
                <p>Try correcting your search or filters.</p>
            </div>
        `;
    } else {
        container.innerHTML = `<div class="grid">${filtered.map(item => renderRegistryCard(item)).join('')}</div>`;
    }
}

function addTagFilter(tag) {
    if (!activeTags.includes(tag)) {
        activeTags.push(tag);
        renderActiveTags();
        filterMarketplace();
        switchTab('marketplace'); // Switch if clicking from Recommended
    }
}

function removeTagFilter(tag) {
    activeTags = activeTags.filter(t => t !== tag);
    renderActiveTags();
    filterMarketplace();
}

function renderActiveTags() {
    const container = document.getElementById('active-tags');
    if (!container) return;

    container.innerHTML = activeTags.map(tag => `
        <div class="tag-chip">
            ${tag}
            <span class="tag-chip-remove" onclick="removeTagFilter('${tag}')">×</span>
        </div>
    `).join('');
}


// --- User Actions ---

function sendMessage(command, args = {}) {
    vscode.postMessage({ command, ...args });
}

function toggleServer(id, enabled) {
    sendMessage('toggleServer', { id, enabled });
}

function uninstallServer(id) {
    sendMessage('uninstallServer', { id });
}

function installServer(repoUrl, name) {
    sendMessage('installServer', { repoUrl, name });
}

function openLink(url) {
    sendMessage('openLink', { url });
}

function updateSetting(key, value) {
    if (key === 'enabled' || key === 'pollingInterval' || key === 'autoUpdate' || key === 'showGauges' || key === 'showPromptCredits') {
        sendMessage('updateConfig', { key: `techai.${key}`, value });
    } else {
        sendMessage('updateSetting', { key: `mcp.${key}`, value });
    }
}

function setBusy(busy) {
    if (busy) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

function setLoading(isLoading) {
    const loadingEl = document.getElementById('loading-indicator'); 
    // Usually handled by overlay, but can be specific element
}

// --- Credentials ---

function renderCredentials(credentials) {
    credentials.forEach(cred => {
        const statusEl = document.getElementById(`cred-${cred.id}-status`);
        if (statusEl) {
            statusEl.textContent = cred.hasCredential ? 'Configured' : 'Not Set';
            statusEl.className = `status-badge ${cred.hasCredential ? 'status-normal' : ''}`;
        }
        
        // Clear input after save (security best practice)
        const inputEl = document.getElementById(`cred-${cred.id}`);
        if (inputEl && cred.hasCredential && inputEl.value) {
            inputEl.value = ''; 
        }
    });
}

function saveCredential(serverId) {
    const input = document.getElementById(`cred-${serverId}`);
    if (input && input.value) {
        sendMessage('saveCredential', { serverId, value: input.value });
        input.value = ''; // Clear immediately
    }
}

function deleteCredential(serverId) {
    sendMessage('deleteCredential', { serverId });
}

// --- LLM Providers ---

function renderLLMProviders(providers) {
    providers.forEach(p => {
        // Toggle Switch
        const toggle = document.getElementById(`llm-${p.id}-enabled`);
        if (toggle) toggle.checked = p.enabled;

        // Model Selection
        const modelSelect = document.getElementById(`llm-${p.id}-model`);
        if (modelSelect && p.model) modelSelect.value = p.model;
        
        // Endpoint
        const endpointInput = document.getElementById(`llm-${p.id}-endpoint`);
        if (endpointInput && p.endpoint) endpointInput.value = p.endpoint;

        // Key Status (Visual feedback only, don't fill password field)
        const keyInput = document.getElementById(`llm-${p.id}-key`);
        if (keyInput) {
            keyInput.placeholder = p.hasApiKey ? '•••••••••••••••• (Saved)' : 'Enter API Key';
        }
    });
}

function toggleLLMProvider(providerId, enabled) {
    sendMessage('toggleLLMProvider', { providerId, enabled });
}

function saveLLMKey(providerId) {
    const input = document.getElementById(`llm-${providerId}-key`);
    if (input && input.value) {
        sendMessage('saveLLMKey', { providerId, apiKey: input.value });
        input.value = '';
    }
}

function updateLLMModel(providerId, model) {
    sendMessage('updateLLMProvider', { providerId, model });
}

function updateLLMEndpoint(providerId, endpoint) {
    sendMessage('updateLLMProvider', { providerId, endpoint });
}

// --- Context Settings ---

function updateContextSettingsUI(settings) {
    if (settings.includeReadme !== undefined) document.getElementById('ctx-readme').checked = settings.includeReadme;
    if (settings.includeManifest !== undefined) document.getElementById('ctx-manifest').checked = settings.includeManifest;
    if (settings.includeGitignore !== undefined) document.getElementById('ctx-gitignore').checked = settings.includeGitignore;
    if (settings.includeSystemContext !== undefined) document.getElementById('ctx-system').checked = settings.includeSystemContext;
    if (settings.cacheTtlSeconds !== undefined) {
        document.getElementById('ctx-cache-ttl').value = settings.cacheTtlSeconds;
        document.getElementById('cache-ttl-display').textContent = settings.cacheTtlSeconds + 's';
    }

    // Render custom files list
    const list = document.getElementById('custom-files-list');
    if (list && settings.customFiles) {
        list.innerHTML = settings.customFiles.map(file => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 6px; margin-bottom: 5px;">
                <span style="font-size: 0.9em; font-family: monospace;">${file}</span>
                <button onclick="removeCustomFile('${file}')" style="background: none; border: none; color: #ff6b6b; cursor: pointer; font-weight: bold;">×</button>
            </div>
        `).join('');
    }
}

function updateContextSetting(key, value) {
    sendMessage('updateContextSetting', { key, value });
}

function addCustomFile() {
    const input = document.getElementById('new-custom-file');
    if (input && input.value) {
        sendMessage('addCustomContextFile', { filePath: input.value.trim() });
        input.value = '';
    }
}

function removeCustomFile(filePath) {
    sendMessage('removeCustomContextFile', { filePath });
}

// --- UI Updates ---

function updateSettingsUI(settings) {
    // Fill in settings values
    if (settings.autoApplyEnabled !== undefined) {
        const el = document.getElementById('setting-auto-apply');
        if (el) el.checked = settings.autoApplyEnabled;
    }
    
    // Config path display
    if (settings.configPath) {
        const el = document.getElementById('config-path');
        if (el) el.textContent = settings.configPath;
    }

    if (settings.maxContextTokens) {
         const el = document.getElementById('setting-max-tokens');
         if (el) el.value = settings.maxContextTokens;
         const display = document.getElementById('token-display');
         if (display) display.textContent = (settings.maxContextTokens/1000) + 'K';
    }

    if (settings.showBadges !== undefined) {
        const el = document.getElementById('setting-show-badges');
        if (el) el.checked = settings.showBadges;
    }
    
    if (settings.debugEnabled !== undefined) {
        const el = document.getElementById('setting-debug');
        if (el) el.checked = settings.debugEnabled;
    }

    // VS Code Settings
    if (settings.showGauges !== undefined) {
        const el = document.getElementById('setting-show-gauges');
        if (el) el.checked = settings.showGauges;
    }

     if (settings.showPromptCredits !== undefined) {
        const el = document.getElementById('setting-show-prompt-credits');
        if (el) el.checked = settings.showPromptCredits;
    }
}
