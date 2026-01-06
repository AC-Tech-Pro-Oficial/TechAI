"use strict";
/**
 * TechAI MCP Proxy - Prompt Library
 *
 * Provides workspace-specific prompts via MCP prompts/list and prompts/get.
 * Prompts are dynamically selected based on detected project type.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptLibrary = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
const LOG_CAT = 'Prompts';
/**
 * Built-in prompts organized by project type
 */
const BUILTIN_PROMPTS = {
    // Flutter/Dart projects
    'flutter': [
        {
            name: 'flutter-best-practices',
            description: 'Flutter development best practices and conventions',
            arguments: []
        },
        {
            name: 'flutter-state-management',
            description: 'Guide for choosing and implementing state management in Flutter',
            arguments: [
                { name: 'provider', description: 'Current provider (optional)', required: false }
            ]
        },
        {
            name: 'flutter-testing',
            description: 'Flutter widget and integration testing patterns',
            arguments: []
        }
    ],
    // Node.js/TypeScript projects
    'nodejs': [
        {
            name: 'nodejs-best-practices',
            description: 'Node.js best practices for production applications',
            arguments: []
        },
        {
            name: 'typescript-patterns',
            description: 'TypeScript design patterns and type safety tips',
            arguments: []
        },
        {
            name: 'api-design',
            description: 'REST API design guidelines and conventions',
            arguments: []
        }
    ],
    // Python projects
    'python': [
        {
            name: 'python-best-practices',
            description: 'Python development best practices (PEP8, typing, etc.)',
            arguments: []
        },
        {
            name: 'python-testing',
            description: 'Python testing with pytest patterns',
            arguments: []
        }
    ],
    // General prompts (available to all)
    'general': [
        {
            name: 'code-review',
            description: 'Perform a thorough code review with focus on quality and security',
            arguments: [
                { name: 'focus', description: 'Area to focus on (security, performance, style)', required: false }
            ]
        },
        {
            name: 'refactor-suggestions',
            description: 'Suggest refactoring improvements for cleaner code',
            arguments: []
        },
        {
            name: 'documentation-generator',
            description: 'Generate comprehensive documentation for code',
            arguments: [
                { name: 'style', description: 'Documentation style (jsdoc, docstring, markdown)', required: false }
            ]
        },
        {
            name: 'git-commit-message',
            description: 'Generate a well-formatted git commit message',
            arguments: [
                { name: 'changes', description: 'Summary of changes made', required: true }
            ]
        },
        {
            name: 'explain-code',
            description: 'Explain code in detail for learning purposes',
            arguments: []
        }
    ]
};
/**
 * Prompt content templates
 */
const PROMPT_CONTENT = {
    'flutter-best-practices': () => [
        {
            role: 'user',
            content: {
                type: 'text',
                text: `You are a Flutter expert. Please follow these best practices:

1. **State Management**: Use Riverpod or Provider for state management
2. **Folder Structure**: Follow feature-first organization
3. **Widgets**: Keep widgets small and focused
4. **Performance**: Use const constructors, ListView.builder for long lists
5. **Testing**: Write widget tests for all UI components
6. **Null Safety**: Embrace null safety, avoid using ! operator
7. **Async**: Use async/await, handle errors properly
8. **Naming**: Follow Dart naming conventions (lowerCamelCase for variables)

Apply these practices to all code suggestions.`
            }
        }
    ],
    'code-review': (args) => [
        {
            role: 'user',
            content: {
                type: 'text',
                text: `Perform a thorough code review${args.focus ? ` focusing on ${args.focus}` : ''}.

Check for:
1. **Security**: SQL injection, XSS, secrets exposure
2. **Performance**: N+1 queries, memory leaks, unnecessary re-renders
3. **Style**: Naming conventions, code organization, comments
4. **Logic**: Edge cases, error handling, race conditions
5. **Maintainability**: DRY violations, complex functions, magic numbers

Provide specific, actionable feedback with line numbers.`
            }
        }
    ],
    'git-commit-message': (args) => [
        {
            role: 'user',
            content: {
                type: 'text',
                text: `Generate a git commit message following this format:

<type>(<scope>): <subject>

<body>

Types: feat, fix, docs, style, refactor, test, chore
- Subject: imperative, lowercase, no period
- Body: explain what and why

Changes summary: ${args.changes || 'Please analyze the staged changes'}

Generate only the commit message, nothing else.`
            }
        }
    ],
    'documentation-generator': (args) => [
        {
            role: 'user',
            content: {
                type: 'text',
                text: `Generate comprehensive documentation in ${args.style || 'markdown'} format.

Include:
1. **Description**: What does this code do?
2. **Parameters**: Input parameters with types
3. **Returns**: Return value description
4. **Examples**: Usage examples
5. **Errors**: Possible errors/exceptions

Be thorough but concise.`
            }
        }
    ]
};
class PromptLibrary {
    constructor() {
        this.customPrompts = [];
        this.projectType = 'unknown';
    }
    /**
     * Set the current project type
     */
    setProjectType(type) {
        this.projectType = type;
        logger_1.logger.debug(LOG_CAT, `Project type set to: ${type}`);
    }
    /**
     * Add custom prompts
     */
    addCustomPrompts(prompts) {
        this.customPrompts.push(...prompts);
    }
    /**
     * Get all available prompts for current project
     */
    getPrompts() {
        const prompts = [];
        // Add general prompts
        prompts.push(...BUILTIN_PROMPTS['general']);
        // Add project-specific prompts
        if (this.projectType !== 'unknown' && BUILTIN_PROMPTS[this.projectType]) {
            prompts.push(...BUILTIN_PROMPTS[this.projectType]);
        }
        // Add custom prompts
        prompts.push(...this.customPrompts);
        logger_1.logger.debug(LOG_CAT, `Returning ${prompts.length} prompts for ${this.projectType}`);
        return prompts;
    }
    /**
     * Get a specific prompt's messages
     */
    getPromptMessages(name, args = {}) {
        const generator = PROMPT_CONTENT[name];
        if (generator) {
            return generator(args);
        }
        // Default fallback
        return [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Execute the "${name}" prompt with arguments: ${JSON.stringify(args)}`
                }
            }
        ];
    }
    /**
     * Check if a prompt exists
     */
    hasPrompt(name) {
        const allPrompts = this.getPrompts();
        return allPrompts.some(p => p.name === name);
    }
    /**
     * Load custom prompts from a directory
     */
    loadCustomPrompts(promptsDir) {
        if (!fs.existsSync(promptsDir)) {
            return;
        }
        try {
            const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                const filePath = path.join(promptsDir, file);
                const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (Array.isArray(content)) {
                    this.customPrompts.push(...content);
                }
                else if (content.name) {
                    this.customPrompts.push(content);
                }
            }
            logger_1.logger.info(LOG_CAT, `Loaded ${this.customPrompts.length} custom prompts from ${promptsDir}`);
        }
        catch (e) {
            logger_1.logger.warn(LOG_CAT, `Failed to load custom prompts: ${e}`);
        }
    }
}
exports.PromptLibrary = PromptLibrary;
//# sourceMappingURL=prompts.js.map