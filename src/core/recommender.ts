import * as vscode from 'vscode';
import { RegistryData, RegistryItem } from '../utils/mcp_types';

interface WeightedMatch {
    item: RegistryItem;
    score: number;
    reason: string[];
}

export class MCPRecommender {

    /**
     * Analyze workspace and return recommended servers from the registry
     */
    public async getRecommendations(registry: RegistryData): Promise<RegistryItem[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return [];

        const technologies = await this.detectTechnologies();
        const recommendations: WeightedMatch[] = [];

        // Flatten registry for searching
        const allItems = registry.flatMap(cat => cat.items);

        for (const item of allItems) {
            const match = this.calculateMatch(item, technologies);
            if (match.score > 0) {
                recommendations.push(match);
            }
        }

        // Sort by score (descending) and return items
        return recommendations
            .sort((a, b) => b.score - a.score)
            .map(m => m.item);
    }

    private async detectTechnologies(): Promise<Set<string>> {
        const techs = new Set<string>();

        // 1. Check Files
        if (await this.hasFile('**/pubspec.yaml')) techs.add('dart').add('flutter');
        if (await this.hasFile('**/package.json')) {
            techs.add('node').add('npm');
            // Deep check for specific deps could go here (e.g. react, next)
            // For now, let's just infer generic JS/TS
            techs.add('javascript').add('typescript');
        }
        if (await this.hasFile('**/tsconfig.json')) techs.add('typescript');
        if (await this.hasFile('**/*.py') || await this.hasFile('**/requirements.txt') || await this.hasFile('**/pyproject.toml')) techs.add('python');
        if (await this.hasFile('**/go.mod') || await this.hasFile('**/*.go')) techs.add('go').add('golang');
        if (await this.hasFile('**/Cargo.toml')) techs.add('rust');
        if (await this.hasFile('**/*.java') || await this.hasFile('**/pom.xml')) techs.add('java');
        if (await this.hasFile('**/*.php') || await this.hasFile('**/composer.json')) techs.add('php');

        // 2. Capabilities / Infra
        if (await this.hasFile('**/docker-compose.yml') || await this.hasFile('**/Dockerfile')) techs.add('docker');
        if (await this.hasFile('**/*.sql')) techs.add('sql').add('database');
        if (await this.hasFile('**/firebase.json')) techs.add('firebase');
        if (await this.hasFile('**/.github/**')) techs.add('github');
        if (await this.hasFile('**/.git/**')) techs.add('git');

        // 3. Cloud / Platforms (could infer from config files or imports in future)
        if (await this.hasFile('**/*.tf') || await this.hasFile('**/*.tfvars')) techs.add('terraform').add('aws').add('gcp');

        return techs;
    }

    private calculateMatch(item: RegistryItem, techs: Set<string>): WeightedMatch {
        let score = 0;
        const reasons: string[] = [];
        const lowerName = item.name.toLowerCase();
        const lowerDesc = item.description.toLowerCase();
        const tags = (item.tags || []).map(t => t.toLowerCase());

        // Simple Keyword Matching
        for (const tech of techs) {
            // High relevance if tech is in name
            if (lowerName.includes(tech)) {
                score += 10;
                reasons.push(`Matches project technology: ${tech}`);
            }
            // Moderate relevance if tech is in description or tags
            else if (lowerDesc.includes(tech) || tags.includes(tech)) {
                score += 5;
                reasons.push(`Related to ${tech}`);
            }
        }

        // Boost for "General Utility" or extremely popular tools if we wanted
        // For now, purely context-aware

        return { item, score, reason: reasons };
    }

    private async hasFile(globPattern: string): Promise<boolean> {
        const files = await vscode.workspace.findFiles(globPattern, '**/node_modules/**', 1);
        return files.length > 0;
    }
}
