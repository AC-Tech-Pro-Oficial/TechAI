// IMMEDIATE STARTUP CHECK
(function () {
    var debugDiv = document.createElement('div');
    debugDiv.id = 'debug-startup';
    // Hidden by default (display:none)
    debugDiv.style.cssText = 'display:none;position:fixed;top:60px;right:10px;background:#1a1a2e;color:#00ff88;padding:8px 12px;border-radius:6px;font-size:11px;z-index:9999;font-family:monospace;max-width:300px;';
    debugDiv.innerHTML = '✓ JS Running | Waiting for data...';
    document.body.appendChild(debugDiv);
})();

// Helper to toggle debug UI
function updateDebugUI() {
    const dbg = document.getElementById('debug-startup');
    if (dbg) {
        dbg.style.display = debugEnabled ? 'block' : 'none';
    }
}

// GLOBAL ERROR HANDLER
window.onerror = function (message, source, lineno, colno, error) {
    const errorMsg = `UI Error: ${message} (${source}:${lineno})`;
    console.error(errorMsg);
    // Verify vscode API availability before using it
    if (typeof vscode !== 'undefined') {
        vscode.postMessage({ command: 'logError', error: errorMsg });
    }
    // Show visual alert in the UI if it's completely broken
    const loader = document.getElementById('loading');
    if (loader) {
        loader.innerHTML = `<div style="color: #ff6b6b; padding: 20px; text-align: center;">
            <h3>⚠️ UI Error</h3>
            <p>${message}</p>
            <small>Line ${lineno}</small>
        </div>`;
        loader.classList.remove('hidden');
    }
};

const vscode = acquireVsCodeApi();
let registryData = [];
let serversData = {};
let recommendedData = [];
let activeTags = [];
let showOnlyBestPicks = false;
let autoApplyEnabled = false;
let maxContextTokens = 50000;
let showBadges = true;
let debugEnabled = false;
let configPath = '';

function toggleAutoApply(enabled) {
    if (typeof enabled === 'undefined') {
        autoApplyEnabled = !autoApplyEnabled;
    } else {
        autoApplyEnabled = enabled;
    }
    sendMessage('toggleAutoApply', { value: autoApplyEnabled });
}

function updateSetting(key, value) {
    switch (key) {
        case 'enabled':
            sendMessage('updateConfig', { key: 'techai.enabled', value });
            break;
        case 'pollingInterval':
            sendMessage('updateConfig', { key: 'techai.pollingInterval', value });
            break;
        case 'autoUpdate':
            sendMessage('updateConfig', { key: 'techai.autoUpdate', value });
            break;
        case 'showGauges':
            sendMessage('updateConfig', { key: 'techai.showGauges', value });
            break;
        case 'showPromptCredits':
            sendMessage('updateConfig', { key: 'techai.showPromptCredits', value });
            break;
        case 'autoApply':
            autoApplyEnabled = value;
            sendMessage('updateSetting', { key: 'mcp.autoApplyBestPicks', value });
            break;
        case 'maxTokens':
            maxContextTokens = value;
            sendMessage('updateSetting', { key: 'mcp.maxContextTokens', value });
            break;
        case 'showBadges':
            showBadges = value;
            sendMessage('updateSetting', { key: 'mcp.showBadges', value });
            break;
        case 'debug':
            debugEnabled = value;
            updateDebugUI(); // Toggle UI
            sendMessage('updateSetting', { key: 'mcp.debugLogging', value });
            break;
    }
}

function syncSettingsUI(settings) {
    // Sync toggles
    if (settings.autoApplyEnabled !== undefined) {
        autoApplyEnabled = settings.autoApplyEnabled;
        const el = document.getElementById('setting-auto-apply');
        if (el) el.checked = autoApplyEnabled;
    }
    if (settings.maxContextTokens !== undefined) {
        maxContextTokens = settings.maxContextTokens;
        const slider = document.getElementById('setting-max-tokens');
        const display = document.getElementById('token-display');
        if (slider) slider.value = maxContextTokens;
        if (display) display.textContent = (maxContextTokens / 1000) + 'K';
    }
    if (settings.showBadges !== undefined) {
        showBadges = settings.showBadges;
        const el = document.getElementById('setting-show-badges');
        if (el) el.checked = showBadges;
    }
    if (settings.debugEnabled !== undefined) {
        debugEnabled = settings.debugEnabled;
        updateDebugUI(); // Sync UI state
        const el = document.getElementById('setting-debug');
        if (el) el.checked = debugEnabled;
    }
    if (settings.configPath !== undefined) {
        configPath = settings.configPath;
        const el = document.getElementById('config-path');
        if (el) el.textContent = configPath;
    }
    // VS Code config settings
    if (settings.showGauges !== undefined) {
        const el = document.getElementById('setting-show-gauges');
        if (el) el.checked = settings.showGauges;
    }
    if (settings.showPromptCredits !== undefined) {
        const el = document.getElementById('setting-show-prompt-credits');
        if (el) el.checked = settings.showPromptCredits;
    }
}

// ========== CONTEXT INJECTION HANDLERS ==========
function updateContextSetting(key, value) {
    sendMessage('updateContextSetting', { key, value });
}

function addCustomFile() {
    const input = document.getElementById('new-custom-file');
    const filePath = input.value.trim();
    if (filePath) {
        sendMessage('addCustomContextFile', { filePath });
        input.value = '';
    }
}

function removeCustomFile(filePath) {
    sendMessage('removeCustomContextFile', { filePath });
}

function renderCustomFiles(files) {
    const container = document.getElementById('custom-files-list');
    if (!container) return;

    if (!files || files.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No custom files configured.</p>';
        return;
    }

    let html = '';
    files.forEach(function (f) {
        html += '<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--card-bg); border-radius: 6px; margin-bottom: 8px;">';
        html += '<span style="flex: 1; font-family: monospace; font-size: 0.9em;">' + f + '</span>';
        html += '<button onclick="removeCustomFile(\'' + f + '\')" style="background: transparent; border: none; color: #ff6b6b; cursor: pointer; font-size: 1.2em;">✕</button>';
        html += '</div>';
    });
    container.innerHTML = html;
}

function syncContextSettings(settings) {
    if (!settings) return;

    const toggles = {
        'ctx-readme': settings.includeReadme,
        'ctx-manifest': settings.includeManifest,
        'ctx-gitignore': settings.includeGitignore,
        'ctx-system': settings.includeSystemContext
    };

    Object.entries(toggles).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.checked = value !== false;
    });

    if (settings.cacheTtlSeconds !== undefined) {
        const slider = document.getElementById('ctx-cache-ttl');
        const display = document.getElementById('cache-ttl-display');
        if (slider) slider.value = settings.cacheTtlSeconds;
        if (display) display.textContent = settings.cacheTtlSeconds + 's';
    }

    if (settings.customFiles) {
        renderCustomFiles(settings.customFiles);
    }
}

// ========== CREDENTIALS HANDLERS ==========
function saveCredential(serverId) {
    const input = document.getElementById('cred-' + serverId);
    if (input && input.value.trim()) {
        sendMessage('saveCredential', { serverId, value: input.value.trim() });
        input.value = '';
        updateCredentialStatus(serverId, true);
    }
}

function deleteCredential(serverId) {
    sendMessage('deleteCredential', { serverId });
    updateCredentialStatus(serverId, false);
}

function updateCredentialStatus(serverId, hasCredential) {
    const status = document.getElementById('cred-' + serverId + '-status');
    if (status) {
        status.textContent = hasCredential ? '✓ Configured' : 'Not Set';
        status.style.background = hasCredential ? 'rgba(0,200,100,0.2)' : 'var(--card-bg)';
        status.style.color = hasCredential ? '#00c864' : 'var(--text-secondary)';
    }
}

function syncCredentialsStatus(credentials) {
    if (!credentials) return;
    credentials.forEach(cred => {
        updateCredentialStatus(cred.id, cred.hasCredential);
    });
}

// ========== LLM PROVIDERS HANDLERS ==========
function toggleLLMProvider(providerId, enabled) {
    sendMessage('toggleLLMProvider', { providerId, enabled });
}

function saveLLMKey(providerId) {
    const input = document.getElementById('llm-' + providerId + '-key');
    if (input && input.value.trim()) {
        sendMessage('saveLLMKey', { providerId, apiKey: input.value.trim() });
        input.value = '••••••••••••••••';
        input.disabled = true;
        setTimeout(() => {
            input.value = '';
            input.disabled = false;
            input.placeholder = '✓ Key saved';
        }, 1500);
    }
}

function updateLLMModel(providerId, model) {
    sendMessage('updateLLMProvider', { providerId, model });
}

function updateLLMEndpoint(providerId, endpoint) {
    sendMessage('updateLLMProvider', { providerId, endpoint });
}

function syncLLMProviders(providers) {
    if (!providers) return;
    providers.forEach(p => {
        const enabledEl = document.getElementById('llm-' + p.id + '-enabled');
        if (enabledEl) enabledEl.checked = p.enabled;

        const modelEl = document.getElementById('llm-' + p.id + '-model');
        if (modelEl && p.model) modelEl.value = p.model;

        const endpointEl = document.getElementById('llm-' + p.id + '-endpoint');
        if (endpointEl && p.endpoint) endpointEl.value = p.endpoint;

        const keyEl = document.getElementById('llm-' + p.id + '-key');
        if (keyEl && p.hasApiKey) {
            keyEl.placeholder = '✓ Key saved (hidden)';
        }
    });
}

function uninstallServer(id) {
    sendMessage('uninstallServer', { id });
}
function switchTab(tabId) {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));

    const contents = document.querySelectorAll('.content');
    contents.forEach(c => c.classList.add('hidden'));

    // Find tab by ID structure 'tab-{tabId}' which we should set in HTML
    const activeTab = document.getElementById('tab-' + tabId);
    // Fallback: search by text content if ID not found (legacy support)
    if (activeTab) {
        activeTab.classList.add('active');
    } else {
        // Try to find by text content or mapping
        tabs.forEach(t => {
            if (t.textContent.toLowerCase().includes(tabId)) t.classList.add('active');
        });
    }

    const content = document.getElementById(tabId);
    if (content) content.classList.remove('hidden');
}

function sendMessage(command, payload = {}) {
    vscode.postMessage({ command, ...payload });
}

let activeInstalledFilters = [];
let recommendedActiveTags = [];

function renderServers(servers) {
    console.log('[MCP Debug] renderServers called, servers:', servers);
    console.log('[MCP Debug] activeInstalledFilters:', activeInstalledFilters);

    // DEBUG: Visual update
    const dbg = document.getElementById('debug-startup');
    if (dbg) dbg.innerHTML = '✓ Data received! Servers: ' + Object.keys(servers || {}).length;

    serversData = servers;
    const container = document.getElementById('servers-list');

    // Apply filter if active
    let displayServerIds = Object.keys(servers || {});
    console.log('[MCP Debug] All server IDs:', displayServerIds);
    if (activeInstalledFilters.length > 0) {
        displayServerIds = displayServerIds.filter(id => {
            const config = servers[id];

            // AND Logic: Server must match ALL active filters
            const matches = activeInstalledFilters.every(filterTag => {
                if (filterTag === 'Env Vars') {
                    return config.env && Object.keys(config.env).length > 0;
                } else {
                    return config.command === filterTag;
                }
            });

            console.log('[MCP Debug] Checking:', id, 'filters:', activeInstalledFilters, 'matches:', matches);
            return matches;
        });
        console.log('[MCP Debug] Filtered server IDs:', displayServerIds);
    }

    if (!servers || Object.keys(servers).length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1; padding: 40px;">No servers configured. Visit the Marketplace to install one.</p>';
        return;
    }

    if (displayServerIds.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 20px;">
                <p style="color: var(--text-secondary);">No servers match filters "<strong>${activeInstalledFilters.join(', ')}</strong>"</p>
                <button class="btn secondary" style="width: auto; margin-top: 10px;" onclick="clearInstalledFilter()">Clear All</button>
            </div>
        `;
        return;
    }

    // Show Active Filter Indicator if needed
    let filterHtml = '';
    if (activeInstalledFilters.length > 0) {
        filterHtml = `
            <div style="grid-column: 1/-1; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="color: var(--text-secondary); font-size: 0.9em;">Active Filters:</span>
                ${activeInstalledFilters.map(tag => `
                    <span class="tag-chip">
                        ${tag}
                        <span class="tag-chip-remove" onclick="filterInstalledServers('${tag === 'Env Vars' ? 'Env Vars' : JSON.stringify(tag).replace(/^"|"$/g, '')}')">×</span>
                    </span>
                `).join('')}
                <span style="color: var(--accent-color); cursor: pointer; font-size: 0.8em; text-decoration: underline;" onclick="clearInstalledFilter()">Clear All</span>
            </div>
        `;
    }

    // Sort: Enabled servers first, then alphabetically within each group
    displayServerIds.sort((a, b) => {
        const aEnabled = !servers[a].disabled;
        const bEnabled = !servers[b].disabled;
        if (aEnabled !== bEnabled) return bEnabled ? 1 : -1; // Enabled first
        return a.localeCompare(b); // Then alphabetically
    });

    const listHtml = displayServerIds.map(id => {
        const config = servers[id];
        const isEnabled = !config.disabled;

        // Highlight logic
        const isCommandActive = activeInstalledFilters.includes(config.command);
        const isEnvActive = activeInstalledFilters.includes('Env Vars');

        return `
        <div class="card" style="${!isEnabled ? 'opacity: 0.7;' : ''}">
            <div class="card-header">
                <span class="card-title">${id}</span>
                <label class="toggle-container">
                    <input type="checkbox" class="toggle-chk" 
                        ${isEnabled ? 'checked' : ''} 
                        onchange="toggleServer('${id}', this.checked)">
                    <div class="toggle-track"></div>
                </label>
            </div>
            <div class="card-meta">
                <span class="tag click-tag ${isCommandActive ? 'active-tag-highlight' : ''}" onclick='filterInstalledServers(${JSON.stringify(config.command)})' title="Filter by ${config.command}">${config.command}</span>
                ${config.env && Object.keys(config.env).length > 0 ? `<span class="tag cloud click-tag ${isEnvActive ? 'active-tag-highlight' : ''}" onclick="filterInstalledServers('Env Vars')">Env Vars</span>` : ''}
            </div>
            <div class="card-desc">
                Running via ${config.command} with arguments: ${config.args.join(' ')}
            </div>
            <div class="actions">
                <button class="btn secondary" onclick="sendMessage('editConfig')">Configure</button>
                <button class="btn" style="background: #ef4444;" onclick="uninstallServer('${id}')">Uninstall</button>
            </div>
        </div>
    `}).join('');

    container.innerHTML = filterHtml + listHtml;
}

function filterInstalledServers(tag) {
    console.log('[MCP Debug] filterInstalledServers toggle:', tag);
    if (activeInstalledFilters.includes(tag)) {
        activeInstalledFilters = activeInstalledFilters.filter(t => t !== tag);
    } else {
        activeInstalledFilters.push(tag);
    }
    renderServers(serversData);
}

function clearInstalledFilter() {
    activeInstalledFilters = [];
    renderServers(serversData);
}

function renderRecommended(items) {
    recommendedData = items || [];
    filterRecommended();
}

function filterRecommended() {
    const container = document.getElementById('recommended-list');

    if (!recommendedData || recommendedData.length === 0) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);">No specific recommendations found for this workspace.</p>';
        return;
    }

    // Filter by Best Picks first
    let filteredItems = recommendedData;
    if (showOnlyBestPicks) {
        filteredItems = recommendedData.filter(item => item.isBestPick);
    }

    // Then filter by active tags
    if (recommendedActiveTags.length > 0) {
        filteredItems = filteredItems.filter(item => {
            const itemTags = item.tags || [];
            return recommendedActiveTags.every(tag => itemTags.includes(tag));
        });
    }

    // Best Picks toggle button
    const bestPicksBtnHtml = `
        <div style="grid-column: 1/-1; margin-bottom: 15px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <button class="btn ${showOnlyBestPicks ? '' : 'secondary'}" 
                onclick="toggleBestPicks()" 
                style="${showOnlyBestPicks ? 'background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #1a1a1a;' : ''}">
                ★ Show Best Picks Only
            </button>
            <button class="btn" onclick="sendMessage('installBestPicks')" 
                style="background-color: var(--success-color); color: white; display: flex; align-items: center; gap: 6px;">
                <span>⬇</span> Install Best Picks
            </button>
            <div class="server-toggle">
                <label class="toggle-switch">
                    <input type="checkbox" ${autoApplyEnabled ? 'checked' : ''} onchange="toggleAutoApply(this.checked)">
                    <span class="slider"></span>
                </label>
                <span style="color: var(--text-secondary); font-size: 0.9em;">Auto-Apply on Startup</span>
            </div>
            <span style="color: var(--text-secondary); font-size: 0.85em; margin-left: auto;">
                ${showOnlyBestPicks ? 'Showing curated recommendations' : 'Showing all recommendations'}
            </span>
        </div>
    `;

    // Render active tags UI
    let activeTagsHtml = '';
    if (recommendedActiveTags.length > 0) {
        activeTagsHtml = `
            <div style="grid-column: 1/-1; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                ${recommendedActiveTags.map(tag => `
                    <span class="tag-chip">
                        ${tag}
                        <span class="tag-chip-remove" onclick="filterRecommendedWithTag('${tag}')">×</span>
                    </span>
                `).join('')}
                <small style="color: var(--text-secondary); cursor: pointer; margin-left: 10px;" onclick="clearRecommendedTags()">Clear All</small>
            </div>
        `;
    }


    if (filteredItems.length === 0) {
        container.innerHTML = bestPicksBtnHtml + activeTagsHtml + '<p style="text-align: center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);">No recommendations match your filter.</p>';
        return;
    }

    container.innerHTML = bestPicksBtnHtml + activeTagsHtml + filteredItems.map(item => `
        <div class="card">
            <div class="card-header">
                <span class="card-title" title="${item.name}">${item.name.split('/').pop()}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${item.isBestPick ? '<span class="best-pick-badge">Best Pick</span>' : ''}
                    <small style="color: var(--text-secondary); font-size: 0.8em">${item.name.split('/')[0]}</small>
                </div>
            </div>
            <div class="card-meta">
                ${(item.tags || []).map(t => {
        let cls = 'tag';
        if (t === 'Cloud') cls += ' cloud';
        if (t === 'Local') cls += ' local';
        if (recommendedActiveTags.includes(t)) cls += ' active-tag-highlight';
        return `<span class="${cls}" onclick="filterRecommendedWithTag('${t}')">${t}</span>`;
    }).join('')}
            </div>
            <div class="card-desc" title="${item.description}">
                ${item.description}
            </div>
            <div class="actions">
                <button class="btn" onclick="installServer('${item.url}', '${item.name}')">Install</button>
                <button class="btn secondary" onclick="sendMessage('openLink', {url: '${item.url}'})">GitHub</button>
            </div>
        </div>
    `).join('');
}

function filterRecommendedWithTag(tag) {
    if (recommendedActiveTags.includes(tag)) {
        recommendedActiveTags = recommendedActiveTags.filter(t => t !== tag);
    } else {
        recommendedActiveTags.push(tag);
    }
    filterRecommended();
}

function clearRecommendedTags() {
    recommendedActiveTags = [];
    filterRecommended();
}

function toggleBestPicks() {
    showOnlyBestPicks = !showOnlyBestPicks;
    filterRecommended();
}

function renderRegistry(data) {
    registryData = data || [];
    filterMarketplace();
}

function filterMarketplace() {
    const query = document.getElementById('search').value.toLowerCase();
    const container = document.getElementById('registry-list');

    if (!registryData || registryData.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">Loading registry data...</p>';
        return;
    }

    let html = '';
    let hasResults = false;

    registryData.forEach(category => {
        const items = category.items.filter(item => {
            // 1. Check text search
            const matchesText = item.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query);

            // 2. Check active tags (must have ALL active tags)
            const itemTags = item.tags || [];
            const matchesTags = activeTags.every(tag => itemTags.includes(tag));

            return matchesText && matchesTags;
        });

        if (items.length > 0) {
            hasResults = true;
            html += `<div class="section-title">${category.name}</div><div class="grid">`;
            html += items.map(item => `
                <div class="card">
                    <div class="card-header">
                        <span class="card-title" title="${item.name}">${item.name.split('/').pop()}</span>
                        <small style="color: var(--text-secondary); font-size: 0.8em">${item.name.split('/')[0]}</small>
                    </div>
                    <div class="card-meta">
                        ${(item.tags || []).map(t => {
                let cls = 'tag';
                if (t === 'Cloud') cls += ' cloud';
                if (t === 'Local') cls += ' local';
                // Check if active to style differently if needed in future
                const isActive = activeTags.includes(t);
                if (isActive) cls += ' active-tag-highlight'; // Optional: add styles for this if desired
                return `<span class="${cls}" onclick="filterWithTag('${t}')">${t}</span>`;
            }).join('')}
                    </div>
                    <div class="card-desc" title="${item.description}">
                        ${item.description}
                    </div>
                    <div class="actions">
                        <button class="btn" onclick="installServer('${item.url}', '${item.name}')">Install</button>
                        <button class="btn secondary" onclick="sendMessage('openLink', {url: '${item.url}'})">GitHub</button>
                    </div>
                </div>
            `).join('');
            html += `</div>`;
        }
    });

    container.innerHTML = hasResults ? html : '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">No servers found matching your criteria.</p>';
}

function renderActiveTags() {
    const container = document.getElementById('active-tags');
    if (activeTags.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = activeTags.map(tag => `
        <span class="tag-chip">
            ${tag}
            <span class="tag-chip-remove" onclick="filterWithTag('${tag}')">×</span>
        </span>
    `).join('') + (activeTags.length > 0 ? '<small style="color: var(--text-secondary); align-self: center; cursor: pointer; margin-left: 10px;" onclick="clearTags()">Clear All</small>' : '');
}

function clearTags() {
    activeTags = [];
    renderActiveTags();
    filterMarketplace();
}

function filterWithTag(tag) {
    // Switch to marketplace
    switchTab('marketplace');

    // Toggle tag
    if (activeTags.includes(tag)) {
        activeTags = activeTags.filter(t => t !== tag);
    } else {
        activeTags.push(tag);
    }

    renderActiveTags();
    filterMarketplace();
}

function toggleServer(id, enabled) {
    sendMessage('toggleServer', { id, enabled });
}

function installServer(repoUrl, name) {
    sendMessage('installServer', { repoUrl, name });
}

function setLoading(isLoading) {
    const loader = document.getElementById('loading');
    // Safely handle loader visibility
    if (isLoading) {
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'updateData':
            autoApplyEnabled = message.autoApplyEnabled;
            renderServers(message.servers);
            renderRegistry(message.registry);
            renderRecommended(message.recommended);
            // Sync settings if provided
            if (message.settings) {
                syncSettingsUI(message.settings);
            }
            // Sync new tab data
            if (message.contextSettings) {
                syncContextSettings(message.contextSettings);
            }
            if (message.credentials) {
                syncCredentialsStatus(message.credentials);
            }
            if (message.llmProviders) {
                syncLLMProviders(message.llmProviders);
            }
            setLoading(false);
            break;
        case 'syncSettings':
            syncSettingsUI(message.settings);
            break;
        case 'setLoading':
            setLoading(message.value);
            break;
        case 'setBusy':
            setLoading(message.busy);
            break;
        case 'switchTab':
            if (message.tabId) {
                switchTab(message.tabId);
            }
            break;
    }
});
