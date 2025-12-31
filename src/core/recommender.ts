import * as vscode from 'vscode';
import { RegistryData, RegistryItem } from '../utils/mcp_types';

interface WeightedMatch {
    item: RegistryItem;
    score: number;
    reasons: string[];
}

/**
 * MCP Recommender v2 - Service-Based Detection
 * 
 * Philosophy: Detect SERVICES and INTEGRATIONS, not programming languages.
 * MCP tools are about connecting AI to external services (GitHub, Firebase, databases, etc.)
 */
export class MCPRecommender {

    /**
     * Curated "Best-in-Class" tools for each service category.
     * These are hand-picked for quality, reliability, and official status.
     */
    private static readonly BEST_PICKS: Record<string, string[]> = {
        'github': ['github/github-mcp-server', 'modelcontextprotocol/server-github'],
        'git': ['modelcontextprotocol/server-git', 'adhikasp/mcp-git-ingest'], // adhikasp is community
        'firebase': ['firebase-mcp', 'gannonh/firebase-mcp'],
        'docker': ['modelcontextprotocol/server-docker'],
        'postgres': ['modelcontextprotocol/server-postgres'],
        'slack': ['modelcontextprotocol/server-slack'],
        'filesystem': ['modelcontextprotocol/server-filesystem'],
        'cloudflare': ['cloudflare/mcp-server-cloudflare'],
        'vercel': ['vercel/mcp-server'], // Official Vercel MCP
    };

    /**
     * TRUSTED NAMESPACES - repos from these owners are auto-installed without warning
     */
    private static readonly TRUSTED_NAMESPACES = [
        'modelcontextprotocol',   // Anthropic Official Reference Implementations
        'anthropic',              // Anthropic's own tools
        'github',                 // GitHub Official
        'cloudflare',             // Cloudflare Official
        'microsoft',              // Microsoft Official
        'aws',                    // Amazon Web Services
        'google',                 // Google Official
        'vercel',                 // Vercel Official
        'supabase',               // Supabase Official
        'stripe',                 // Stripe Official
        'twilio',                 // Twilio Official
        'gannonh',                // Firebase MCP maintainer (widely trusted)
    ];

    /**
     * Analyze workspace and return recommended servers from the registry
     */
    public async getRecommendations(registry: RegistryData): Promise<RegistryItem[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return [];

        // 1. Detect services/integrations used in the project
        const serviceScores = await this.detectServices();

        console.log('[MCPRecommender] Detected services:', Object.fromEntries(serviceScores));

        // 2. Calculate matches against registry items
        const recommendations: WeightedMatch[] = [];
        const allItems = registry.flatMap(cat => cat.items);

        // Get list of best pick names for detected services
        const detectedServices = Array.from(serviceScores.keys());
        const bestPickNames = new Set<string>();
        for (const service of detectedServices) {
            const picks = MCPRecommender.BEST_PICKS[service] || [];
            picks.forEach(p => bestPickNames.add(p.toLowerCase()));
        }

        for (const item of allItems) {
            const match = this.calculateMatch(item, serviceScores);
            // Threshold: Only recommend if score is meaningful
            if (match.score >= 10) {
                // Mark as Best Pick if in curated list
                const lowerName = item.name.toLowerCase();
                if (bestPickNames.has(lowerName) ||
                    Array.from(bestPickNames).some(bp => lowerName.includes(bp.split('/').pop() || ''))) {
                    match.item.isBestPick = true;
                }

                // Mark as Trusted if from trusted namespace
                const namespace = item.name.split('/')[0]?.toLowerCase();
                if (MCPRecommender.TRUSTED_NAMESPACES.includes(namespace)) {
                    match.item.isTrusted = true;
                } else {
                    match.item.isTrusted = false;
                }

                recommendations.push(match);
            }
        }

        console.log('[MCPRecommender] Found', recommendations.length, 'recommendations');

        // 3. Sort by score (descending), Best Picks first, and limit results
        return recommendations
            .sort((a, b) => {
                // Best picks come first
                if (a.item.isBestPick && !b.item.isBestPick) return -1;
                if (!a.item.isBestPick && b.item.isBestPick) return 1;
                return b.score - a.score;
            })
            .slice(0, 20) // Limit to top 20
            .map(m => m.item);
    }

    /**
     * Detect services and integrations from workspace files
     * Returns a map of service name -> confidence score
     */
    private async detectServices(): Promise<Map<string, number>> {
        const scores = new Map<string, number>();
        const addScore = (service: string, points: number) => {
            scores.set(service, (scores.get(service) || 0) + points);
        };

        // ============================================
        // VERSION CONTROL
        // ============================================

        // GitHub
        if (await this.hasFile('**/.github/**')) {
            addScore('github', 25);
        }
        // Check package.json for github.com repository
        const pkgContent = await this.readFileContent('**/package.json');
        if (pkgContent && pkgContent.includes('github.com')) {
            addScore('github', 10);
        }

        // Git (generic) - Check for .git directory directly as findFiles excludes it
        let hasGit = false;
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                try {
                    const gitPath = vscode.Uri.joinPath(folder.uri, '.git');
                    await vscode.workspace.fs.stat(gitPath);
                    hasGit = true;
                    break;
                } catch {
                    // .git does not exist in this folder
                }
            }
        }

        if (hasGit || await this.hasFile('**/.gitignore')) {
            addScore('git', 20);
            // Boost GitHub if Git is present (high likelihood of remote origin)
            addScore('github', 10);
        }

        // GitLab
        if (await this.hasFile('**/.gitlab-ci.yml')) {
            addScore('gitlab', 25);
        }

        // Azure DevOps
        if (await this.hasFile('**/azure-pipelines.yml')) {
            addScore('azure devops', 25);
        }

        // ============================================
        // CLOUD PLATFORMS
        // ============================================

        // Firebase
        if (await this.hasFile('**/firebase.json') || await this.hasFile('**/.firebaserc')) {
            addScore('firebase', 25);
        }

        // Vercel
        if (await this.hasFile('**/vercel.json') || await this.hasFile('**/.vercel/**')) {
            addScore('vercel', 25);
        }

        // Netlify
        if (await this.hasFile('**/netlify.toml')) {
            addScore('netlify', 25);
        }

        // AWS
        if (await this.hasFile('**/serverless.yml') || await this.hasFile('**/samconfig.toml')) {
            addScore('aws', 20);
        }

        // Terraform (infra as code)
        if (await this.hasFile('**/*.tf')) {
            addScore('terraform', 20);
            addScore('aws', 10); // Often used with AWS
        }

        // Supabase
        if (await this.hasFile('**/supabase/**')) {
            addScore('supabase', 25);
        }

        // ============================================
        // CONTAINERS & ORCHESTRATION
        // ============================================

        // Docker
        if (await this.hasFile('**/Dockerfile')) {
            addScore('docker', 20);
        }
        if (await this.hasFile('**/docker-compose.yml') || await this.hasFile('**/docker-compose.yaml')) {
            addScore('docker', 25);

            // Parse docker-compose for database services
            const composeContent = await this.readFileContent('**/docker-compose.yml') ||
                await this.readFileContent('**/docker-compose.yaml');
            if (composeContent) {
                if (composeContent.includes('postgres')) addScore('postgres', 15);
                if (composeContent.includes('mysql')) addScore('mysql', 15);
                if (composeContent.includes('mongo')) addScore('mongodb', 15);
                if (composeContent.includes('redis')) addScore('redis', 15);
            }
        }

        // Kubernetes
        if (await this.hasFile('**/k8s/**') || await this.hasFile('**/*.yaml')) {
            const k8sContent = await this.readFileContent('**/k8s/**/*.yaml');
            if (k8sContent && k8sContent.includes('apiVersion:')) {
                addScore('kubernetes', 20);
            }
        }

        // ============================================
        // DATABASES (from package.json dependencies)
        // ============================================

        if (pkgContent) {
            // PostgreSQL
            if (pkgContent.includes('"pg"') || pkgContent.includes('"postgres"') ||
                pkgContent.includes('"@prisma/client"')) {
                addScore('postgres', 15);
            }

            // MongoDB
            if (pkgContent.includes('"mongodb"') || pkgContent.includes('"mongoose"')) {
                addScore('mongodb', 15);
            }

            // MySQL
            if (pkgContent.includes('"mysql"') || pkgContent.includes('"mysql2"')) {
                addScore('mysql', 15);
            }

            // Redis
            if (pkgContent.includes('"redis"') || pkgContent.includes('"ioredis"')) {
                addScore('redis', 15);
            }

            // Supabase
            if (pkgContent.includes('"@supabase/supabase-js"')) {
                addScore('supabase', 20);
            }

            // Firebase
            if (pkgContent.includes('"firebase"') || pkgContent.includes('"firebase-admin"')) {
                addScore('firebase', 15);
            }
        }

        // Prisma
        if (await this.hasFile('**/prisma/schema.prisma')) {
            addScore('prisma', 20);
        }

        // ============================================
        // PRODUCTIVITY & COLLABORATION TOOLS
        // ============================================

        if (pkgContent) {
            // Slack
            if (pkgContent.includes('"@slack/')) {
                addScore('slack', 15);
            }
        }

        // Notion (check for notion in various places)
        if (await this.hasFile('**/.notion/**')) {
            addScore('notion', 20);
        }

        // Linear
        if (await this.hasFile('**/.linear/**')) {
            addScore('linear', 20);
        }

        // NOTE: Removed generic "filesystem" and "search" boosts - too generic, caused false positives

        return scores;
    }

    /**
     * Calculate match score between a registry item and detected services
     * Uses word boundary matching to prevent partial matches
     */
    private calculateMatch(item: RegistryItem, serviceScores: Map<string, number>): WeightedMatch {
        let score = 0;
        const reasons: string[] = [];
        const lowerName = item.name.toLowerCase();

        // Strip URLs and markdown links from description to prevent false positives
        // e.g., "uses [tool](https://github.com/user/tool)" shouldn't match "github"
        const cleanDesc = this.stripUrls(item.description.toLowerCase());

        const tags = (item.tags || []).map(t => t.toLowerCase());

        serviceScores.forEach((serviceScore, service) => {
            // Use word boundary regex for accurate matching
            const regex = new RegExp(`\\b${this.escapeRegex(service)}\\b`, 'i');

            // Check name (strongest signal)
            if (regex.test(lowerName)) {
                score += serviceScore * 1.5;
                reasons.push(`Name: ${service}`);
            }
            // Check cleaned description (no URLs)
            else if (regex.test(cleanDesc)) {
                // Penalize broad services if they only appear in description
                const broadServices = ['git', 'github', 'node', 'npm', 'python', 'java', 'docker'];
                if (broadServices.includes(service)) {
                    // Only give 30% score for broad terms in description to avoid false positives
                    // e.g. "container-use" mentioning "git branches" shouldn't trigger "git" recommendation
                    score += serviceScore * 0.3;
                    reasons.push(`Desc(weak): ${service}`);
                } else {
                    score += serviceScore;
                    reasons.push(`Desc: ${service}`);
                }
            }
            // Check tags
            else if (tags.some(tag => regex.test(tag))) {
                score += serviceScore * 1.2;
                reasons.push(`Tag: ${service}`);
            }
        });

        return { item, score, reasons };
    }

    /**
     * Strip URLs and markdown links from text
     * Removes: [text](url), https://..., http://..., github.com/...
     */
    private stripUrls(text: string): string {
        return text
            // Remove markdown links: [text](url) -> text
            .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
            // Remove plain URLs
            .replace(/https?:\/\/[^\s)]+/g, '')
            // Remove github.com/... patterns without protocol
            .replace(/github\.com\/[^\s)]+/g, '')
            // Clean up extra spaces
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Escape special regex characters in service names
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Check if a file matching the glob pattern exists
     */
    private async hasFile(globPattern: string): Promise<boolean> {
        const files = await vscode.workspace.findFiles(globPattern, '**/node_modules/**', 1);
        return files.length > 0;
    }

    /**
     * Read content of first file matching the glob pattern
     */
    private async readFileContent(globPattern: string): Promise<string | null> {
        try {
            const files = await vscode.workspace.findFiles(globPattern, '**/node_modules/**', 1);
            if (files.length > 0) {
                const uint8Array = await vscode.workspace.fs.readFile(files[0]);
                return new TextDecoder().decode(uint8Array);
            }
        } catch (e) {
            console.error(`[MCPRecommender] Error reading file for pattern ${globPattern}:`, e);
        }
        return null;
    }
}
