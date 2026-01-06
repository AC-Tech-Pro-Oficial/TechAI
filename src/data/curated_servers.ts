/**
 * TechAI Antigravity - Curated MCP Servers
 * Local marketplace of hand-picked, verified MCP servers
 * 
 * These servers augment the upstream registry (punkpeye/awesome-mcp-servers)
 * with additional high-quality tools that may not be in the main list yet.
 */

import { RegistryCategory, RegistryItem } from '../utils/mcp_types';

/**
 * Curated servers organized by category.
 * These are merged with the upstream registry data.
 */
export const CURATED_SERVERS: RegistryCategory[] = [
    {
        name: 'Document Generation',
        items: [
            {
                name: 'nicholasxuu/mcp-html-to-pdf',
                url: 'https://github.com/nicholasxuu/mcp-html-to-pdf',
                description: 'Puppeteer-based HTML to PDF converter with full CSS/JS support, headers, footers, and page settings',
                tags: ['PDF', 'Puppeteer', 'Local'],
                isBestPick: true,
                isTrusted: true
            },
            {
                name: '@nicholasxuu/mcp-pdf-generator',
                url: 'https://www.npmjs.com/package/@nicholasxuu/mcp-pdf-generator',
                description: 'Playwright-based PDF generator supporting Markdown and HTML to PDF conversion',
                tags: ['PDF', 'Playwright', 'Markdown', 'Local'],
                isTrusted: true
            },
            {
                name: 'AiondoAI/mcp-docx-server',
                url: 'https://github.com/AiondoAI/mcp-docx-server',
                description: 'Create and edit DOCX documents with formatting, tables, images, and styles',
                tags: ['DOCX', 'Word', 'Local']
            }
        ]
    },
    {
        name: 'Image & Media',
        items: [
            {
                name: 'microsoft/playwright-mcp',
                url: 'https://github.com/microsoft/playwright-mcp',
                description: 'Official Playwright MCP for browser automation, screenshots, and web testing',
                tags: ['Browser', 'Automation', 'Testing', 'Local'],
                isBestPick: true,
                isTrusted: true
            },
            {
                name: 'odenizo/mcp-unsplash',
                url: 'https://github.com/odenizo/mcp-unsplash',
                description: 'Search and download high-quality photos from Unsplash',
                tags: ['Images', 'Stock Photos', 'Cloud']
            },
            {
                name: 'arjunkmrm/mcp-image-edit',
                url: 'https://github.com/arjunkmrm/mcp-image-edit',
                description: 'Basic image editing operations - resize, crop, rotate, filters',
                tags: ['Images', 'Editing', 'Local']
            }
        ]
    },
    {
        name: 'AI & LLM Integration',
        items: [
            // === ANTHROPIC / CLAUDE ===
            {
                name: 'anthropic/claude-code-mcp',
                url: 'https://github.com/anthropic/claude-code-mcp',
                description: 'Official Claude code execution and analysis tools',
                tags: ['AI', 'Claude', 'Code', 'Cloud'],
                isTrusted: true
            },
            {
                name: 'anthropic/tool-search-mcp',
                url: 'https://github.com/anthropic/tool-search-mcp',
                description: 'Anthropic Tool Search Tool - dynamic tool discovery with defer_loading for reduced token usage',
                tags: ['AI', 'Claude', 'Tool Search', 'Token Optimization'],
                isBestPick: true,
                isTrusted: true
            },
            {
                name: 'anthropics/anthropic-tools',
                url: 'https://github.com/anthropics/anthropic-tools',
                description: 'Official Anthropic tools SDK for function calling and tool use with Claude',
                tags: ['AI', 'Claude', 'SDK', 'Cloud'],
                isTrusted: true
            },
            // === GOOGLE / GEMINI ===
            {
                name: 'google/gemini-mcp-server',
                url: 'https://github.com/google/gemini-mcp-server',
                description: 'Google Gemini API integration for multimodal AI capabilities',
                tags: ['AI', 'Gemini', 'Cloud'],
                isTrusted: true
            },
            {
                name: 'aliargun/mcp-server-gemini',
                url: 'https://github.com/aliargun/mcp-server-gemini',
                description: 'Community Gemini MCP server with JSON mode, Google Search grounding, and latest models',
                tags: ['AI', 'Gemini', 'Community', 'Cloud']
            },
            {
                name: '@houtini/gemini-mcp',
                url: 'https://www.npmjs.com/package/@houtini/gemini-mcp',
                description: 'NPM deployable Gemini MCP server for tool calling and dynamic function execution',
                tags: ['AI', 'Gemini', 'NPM', 'Cloud']
            },
            {
                name: '@google/genai',
                url: 'https://www.npmjs.com/package/@google/genai',
                description: 'Official Google Gen AI SDK for building Gemini-powered applications',
                tags: ['AI', 'Gemini', 'SDK', 'Cloud'],
                isTrusted: true
            },
            // === OPENAI ===
            {
                name: 'openai/openai-mcp',
                url: 'https://github.com/openai/openai-mcp',
                description: 'OpenAI GPT and DALL-E integration via MCP',
                tags: ['AI', 'GPT', 'DALL-E', 'Cloud'],
                isTrusted: true
            },
            // === GITHUB COPILOT ===
            {
                name: 'github/copilot-mcp',
                url: 'https://github.com/github/copilot-mcp',
                description: 'GitHub Copilot integration for code completion and suggestions via MCP',
                tags: ['AI', 'Copilot', 'GitHub', 'Code', 'Cloud'],
                isTrusted: true
            },
            // === GROK (X.AI) ===
            {
                name: 'xai-org/grok-mcp',
                url: 'https://github.com/xai-org/grok-mcp',
                description: 'Grok (X.AI) API integration for real-time web knowledge and reasoning',
                tags: ['AI', 'Grok', 'X.AI', 'Cloud']
            },
            // === LLAMA / META ===
            {
                name: 'meta/llama-mcp',
                url: 'https://github.com/meta/llama-mcp',
                description: 'Meta Llama integration for local and cloud LLM capabilities',
                tags: ['AI', 'Llama', 'Meta', 'Local', 'Cloud']
            },
            // === MISTRAL ===
            {
                name: 'mistralai/mistral-mcp',
                url: 'https://github.com/mistralai/mistral-mcp',
                description: 'Mistral AI models integration with function calling support',
                tags: ['AI', 'Mistral', 'Cloud']
            }
        ]
    },

    {
        name: 'Web Scraping & Automation',
        items: [
            {
                name: 'AhmedNabil1994/scraping-mcp-server',
                url: 'https://github.com/AhmedNabil1994/scraping-mcp-server',
                description: 'Web scraping with Puppeteer - extract data, screenshots, and PDFs',
                tags: ['Scraping', 'Puppeteer', 'Local']
            },
            {
                name: 'nicholasxuu/mcp-browser-automation',
                url: 'https://github.com/nicholasxuu/mcp-browser-automation',
                description: 'Automated browser interactions - form filling, clicking, navigation',
                tags: ['Automation', 'Browser', 'Local']
            }
        ]
    },
    {
        name: 'Communication',
        items: [
            {
                name: 'resend/mcp-send-email',
                url: 'https://github.com/resend/mcp-send-email',
                description: 'Send emails via Resend API with templates and attachments',
                tags: ['Email', 'Cloud'],
                isTrusted: true
            },
            {
                name: 'twilio/mcp-server',
                url: 'https://github.com/twilio/mcp-server',
                description: 'Twilio integration for SMS, voice, and WhatsApp messaging',
                tags: ['SMS', 'Voice', 'WhatsApp', 'Cloud'],
                isTrusted: true
            }
        ]
    },
    {
        name: 'Cloud Storage',
        items: [
            {
                name: 'aws/s3-mcp-server',
                url: 'https://github.com/aws/s3-mcp-server',
                description: 'Amazon S3 file operations - upload, download, list, delete',
                tags: ['AWS', 'S3', 'Storage', 'Cloud'],
                isTrusted: true
            },
            {
                name: 'google/gcs-mcp-server',
                url: 'https://github.com/google/gcs-mcp-server',
                description: 'Google Cloud Storage operations',
                tags: ['GCP', 'Storage', 'Cloud'],
                isTrusted: true
            },
            {
                name: 'dropbox/mcp-server',
                url: 'https://github.com/dropbox/mcp-server',
                description: 'Dropbox file sync and sharing',
                tags: ['Dropbox', 'Storage', 'Cloud']
            }
        ]
    },
    {
        name: 'Hosting & Domains',
        items: [
            {
                name: 'hostinger/hostinger-api-mcp',
                url: 'https://www.npmjs.com/package/hostinger-api-mcp',
                description: 'Official Hostinger API MCP server - domain registration, DNS management, billing, VPS control, and hosting automation',
                tags: ['Hosting', 'Domains', 'DNS', 'VPS', 'Cloud'],
                isBestPick: true,
                isTrusted: true
            }
        ]
    },
    {
        name: 'Development Tools',
        items: [
            {
                name: 'npm/mcp-server',
                url: 'https://github.com/npm/mcp-server',
                description: 'NPM package search, info, and dependency analysis',
                tags: ['NPM', 'Packages', 'Cloud']
            },
            {
                name: 'jetbrains/mcp-server',
                url: 'https://github.com/jetbrains/mcp-server',
                description: 'JetBrains IDE integration and code analysis',
                tags: ['IDE', 'JetBrains', 'Local']
            },
            {
                name: 'prettier/mcp-prettier',
                url: 'https://github.com/prettier/mcp-prettier',
                description: 'Code formatting with Prettier for multiple languages',
                tags: ['Formatting', 'Code', 'Local']
            }
        ]
    },
    {
        name: 'Analytics & Monitoring',
        items: [
            {
                name: 'grafana/mcp-server',
                url: 'https://github.com/grafana/mcp-server',
                description: 'Grafana dashboard queries and alerting',
                tags: ['Monitoring', 'Dashboards', 'Cloud']
            },
            {
                name: 'datadog/mcp-server',
                url: 'https://github.com/datadog/mcp-server',
                description: 'Datadog metrics, logs, and APM data access',
                tags: ['Monitoring', 'APM', 'Cloud']
            },
            {
                name: 'sentry/mcp-server',
                url: 'https://github.com/sentry/mcp-server',
                description: 'Sentry error tracking and performance monitoring',
                tags: ['Errors', 'Performance', 'Cloud']
            }
        ]
    },
    {
        name: 'Project Management',
        items: [
            {
                name: 'atlassian/jira-mcp',
                url: 'https://github.com/atlassian/jira-mcp',
                description: 'Jira issue management, sprints, and workflows',
                tags: ['Jira', 'Issues', 'Cloud']
            },
            {
                name: 'asana/mcp-server',
                url: 'https://github.com/asana/mcp-server',
                description: 'Asana task management and project tracking',
                tags: ['Tasks', 'Projects', 'Cloud']
            },
            {
                name: 'trello/mcp-server',
                url: 'https://github.com/trello/mcp-server',
                description: 'Trello boards, cards, and automation',
                tags: ['Kanban', 'Cards', 'Cloud']
            }
        ]
    }
];

/**
 * Additional trusted namespaces beyond those in recommender.ts
 * Add here as community contributors prove reliability
 */
export const ADDITIONAL_TRUSTED_NAMESPACES = [
    'hostinger',      // Hostinger official
    'nicholasxuu',    // mcp-html-to-pdf, mcp-pdf-generator
    'resend',         // Email service
    'jetbrains',      // JetBrains
    'prettier',       // Prettier formatting
    'grafana',        // Monitoring
    'datadog',        // APM
    'sentry',         // Error tracking
    'atlassian',      // Jira
    'asana',          // Task management
    'trello',         // Kanban
    'dropbox',        // Storage
];

/**
 * Merge curated servers with upstream registry data.
 * Deduplicates by name (curated takes precedence).
 */
export function mergeCuratedServers(upstream: RegistryCategory[]): RegistryCategory[] {
    const result: RegistryCategory[] = [];
    const seenNames = new Set<string>();

    // First, add all curated servers (they take precedence)
    for (const category of CURATED_SERVERS) {
        const items: RegistryItem[] = [];
        for (const item of category.items) {
            const key = item.name.toLowerCase();
            if (!seenNames.has(key)) {
                seenNames.add(key);
                items.push(item);
            }
        }
        if (items.length > 0) {
            result.push({ name: category.name, items });
        }
    }

    // Then add upstream items, skipping duplicates
    for (const category of upstream) {
        const newItems: RegistryItem[] = [];
        for (const item of category.items) {
            const key = item.name.toLowerCase();
            const altKey = item.url.toLowerCase().replace('https://github.com/', '');
            if (!seenNames.has(key) && !seenNames.has(altKey)) {
                seenNames.add(key);
                newItems.push(item);
            }
        }

        if (newItems.length > 0) {
            // Find existing category or create new
            const existing = result.find(c => c.name.toLowerCase() === category.name.toLowerCase());
            if (existing) {
                existing.items.push(...newItems);
            } else {
                result.push({ name: category.name, items: newItems });
            }
        }
    }

    return result;
}
