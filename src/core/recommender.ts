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

        for (const item of allItems) {
            const match = this.calculateMatch(item, serviceScores);
            // Threshold: Only recommend if score is meaningful
            if (match.score >= 10) {
                recommendations.push(match);
            }
        }

        console.log('[MCPRecommender] Found', recommendations.length, 'recommendations');

        // 3. Sort by score (descending) and limit results
        return recommendations
            .sort((a, b) => b.score - a.score)
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

        // Git (generic)
        if (await this.hasFile('**/.git/**')) {
            addScore('git', 20);
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

        // ============================================
        // UNIVERSAL DEVELOPER TOOLS (Small Boost)
        // ============================================

        // File system operations are always useful
        addScore('filesystem', 5);

        // Search is always useful
        addScore('search', 5);

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
        const lowerDesc = item.description.toLowerCase();
        const tags = (item.tags || []).map(t => t.toLowerCase());

        serviceScores.forEach((serviceScore, service) => {
            // Use word boundary regex for accurate matching
            const regex = new RegExp(`\\b${this.escapeRegex(service)}\\b`, 'i');

            // Check name (strongest signal)
            if (regex.test(lowerName)) {
                score += serviceScore * 1.5;
                reasons.push(`Name: ${service}`);
            }
            // Check description
            else if (regex.test(lowerDesc)) {
                score += serviceScore;
                reasons.push(`Desc: ${service}`);
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
