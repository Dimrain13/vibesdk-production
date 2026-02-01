/**
 * Enhanced Troubleshooting System
 * 
 * Provides intelligent error analysis, pattern detection, and auto-recovery.
 */

export interface ErrorPattern {
    pattern: RegExp;
    category: ErrorCategory;
    suggestion: string;
    autoFix?: () => Promise<boolean>;
}

export type ErrorCategory = 
    | 'syntax'
    | 'import'
    | 'type'
    | 'runtime'
    | 'network'
    | 'timeout'
    | 'permission'
    | 'configuration'
    | 'dependency'
    | 'unknown';

export interface AnalyzedError {
    originalError: string;
    category: ErrorCategory;
    rootCause: string;
    suggestions: string[];
    relatedFiles: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    canAutoFix: boolean;
}

// Common error patterns and their solutions
const ERROR_PATTERNS: ErrorPattern[] = [
    // Import/Module errors
    {
        pattern: /Cannot find module ['"]([^'"]+)['"]/i,
        category: 'import',
        suggestion: 'Module not found. Check if the package is installed or the import path is correct.',
    },
    {
        pattern: /Module not found: Can't resolve ['"]([^'"]+)['"]/i,
        category: 'import',
        suggestion: 'Module resolution failed. Verify the package exists in node_modules or check the path alias configuration.',
    },
    {
        pattern: /is not exported from/i,
        category: 'import',
        suggestion: 'Named export not found. Check the export name in the source module or use default import.',
    },

    // TypeScript errors
    {
        pattern: /Property ['"]([^'"]+)['"] does not exist on type/i,
        category: 'type',
        suggestion: 'Property access error. Add the property to the type definition or use type assertion.',
    },
    {
        pattern: /Type ['"]([^'"]+)['"] is not assignable to type/i,
        category: 'type',
        suggestion: 'Type mismatch. Check the expected type and convert or cast the value appropriately.',
    },
    {
        pattern: /TS\d+:/,
        category: 'type',
        suggestion: 'TypeScript compilation error. Check the type definitions and ensure type compatibility.',
    },
    {
        pattern: /Cannot use namespace ['"]([^'"]+)['"] as a type/i,
        category: 'type',
        suggestion: 'Namespace used as type. Import the specific type instead of the namespace.',
    },

    // Syntax errors
    {
        pattern: /SyntaxError: Unexpected token/i,
        category: 'syntax',
        suggestion: 'Syntax error in code. Check for missing brackets, quotes, or invalid JavaScript/TypeScript syntax.',
    },
    {
        pattern: /Unexpected end of (input|JSON)/i,
        category: 'syntax',
        suggestion: 'Incomplete code or JSON. Check for missing closing brackets or truncated content.',
    },
    {
        pattern: /Unterminated string/i,
        category: 'syntax',
        suggestion: 'String not closed. Add the missing quote character.',
    },

    // Runtime errors
    {
        pattern: /TypeError: (.*) is not a function/i,
        category: 'runtime',
        suggestion: 'Attempting to call a non-function. Check if the variable is properly initialized and is actually a function.',
    },
    {
        pattern: /TypeError: Cannot read propert(y|ies) of (undefined|null)/i,
        category: 'runtime',
        suggestion: 'Null/undefined access. Add null checks or use optional chaining (?.).',
    },
    {
        pattern: /ReferenceError: (.*) is not defined/i,
        category: 'runtime',
        suggestion: 'Variable not defined. Check spelling, imports, and variable scope.',
    },
    {
        pattern: /RangeError: Maximum call stack/i,
        category: 'runtime',
        suggestion: 'Infinite recursion detected. Check for circular function calls or missing base cases.',
    },

    // Network errors
    {
        pattern: /fetch failed|ECONNREFUSED|ENOTFOUND/i,
        category: 'network',
        suggestion: 'Network request failed. Check the URL, network connectivity, and CORS settings.',
    },
    {
        pattern: /CORS|Access-Control-Allow/i,
        category: 'network',
        suggestion: 'CORS error. Configure the server to allow requests from your origin or use a proxy.',
    },
    {
        pattern: /net::ERR_/i,
        category: 'network',
        suggestion: 'Browser network error. Check if the server is running and accessible.',
    },

    // Timeout errors
    {
        pattern: /timeout|timed out|ETIMEDOUT/i,
        category: 'timeout',
        suggestion: 'Operation timed out. Increase timeout limits or optimize the slow operation.',
    },
    {
        pattern: /exceeded.*limit/i,
        category: 'timeout',
        suggestion: 'Resource limit exceeded. Reduce payload size or increase limits.',
    },

    // Permission errors
    {
        pattern: /EACCES|permission denied/i,
        category: 'permission',
        suggestion: 'Permission denied. Check file permissions or run with appropriate privileges.',
    },
    {
        pattern: /unauthorized|401|403/i,
        category: 'permission',
        suggestion: 'Authentication/authorization failed. Check API keys, tokens, or user permissions.',
    },

    // Configuration errors
    {
        pattern: /Missing (required )?environment variable/i,
        category: 'configuration',
        suggestion: 'Environment variable not set. Add the required variable to your .env file or environment.',
    },
    {
        pattern: /Invalid configuration/i,
        category: 'configuration',
        suggestion: 'Configuration error. Review the config file for syntax errors or invalid values.',
    },

    // Dependency errors
    {
        pattern: /peer dep|peerDependencies/i,
        category: 'dependency',
        suggestion: 'Peer dependency issue. Install the required peer dependency or update package versions.',
    },
    {
        pattern: /version mismatch|incompatible/i,
        category: 'dependency',
        suggestion: 'Version conflict. Check package versions and resolve conflicts in package.json.',
    },
];

/**
 * Analyze an error and provide intelligent suggestions
 */
export function analyzeError(error: string | Error): AnalyzedError {
    const errorString = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : error;
    
    // Find matching patterns
    const matches: { pattern: ErrorPattern; match: RegExpMatchArray }[] = [];
    for (const ep of ERROR_PATTERNS) {
        const match = errorString.match(ep.pattern);
        if (match) {
            matches.push({ pattern: ep, match });
        }
    }

    // Determine category (use first match or unknown)
    const category = matches.length > 0 ? matches[0].pattern.category : 'unknown';

    // Extract file references
    const filePattern = /(?:at |in |from |file:\/\/)?([\/\w\-\.]+\.[jt]sx?):?(\d+)?/gi;
    const relatedFiles: string[] = [];
    let fileMatch;
    while ((fileMatch = filePattern.exec(errorString)) !== null) {
        if (!relatedFiles.includes(fileMatch[1])) {
            relatedFiles.push(fileMatch[1]);
        }
    }

    // Build suggestions
    const suggestions = matches.map(m => m.pattern.suggestion);
    if (suggestions.length === 0) {
        suggestions.push('Review the error message and stack trace for more details.');
        suggestions.push('Check recent code changes that might have caused this error.');
    }

    // Determine severity
    let severity: AnalyzedError['severity'] = 'medium';
    if (category === 'syntax' || category === 'type') {
        severity = 'high'; // Build blockers
    } else if (category === 'runtime' && errorString.includes('Maximum call stack')) {
        severity = 'critical'; // App crash
    } else if (category === 'configuration' || category === 'permission') {
        severity = 'high'; // Can't proceed
    } else if (category === 'network' || category === 'timeout') {
        severity = 'low'; // Often transient
    }

    // Determine root cause
    let rootCause = 'Unknown error';
    if (matches.length > 0) {
        const match = matches[0].match;
        if (match[1]) {
            rootCause = `${category} error related to: ${match[1]}`;
        } else {
            rootCause = `${category} error detected`;
        }
    }

    return {
        originalError: errorString.slice(0, 500),
        category,
        rootCause,
        suggestions,
        relatedFiles: relatedFiles.slice(0, 5),
        severity,
        canAutoFix: matches.some(m => !!m.pattern.autoFix),
    };
}

/**
 * Format error analysis for display
 */
export function formatErrorAnalysis(analysis: AnalyzedError): string {
    const severityEmoji = {
        low: '🟡',
        medium: '🟠',
        high: '🔴',
        critical: '💥',
    }[analysis.severity];

    let output = `## ${severityEmoji} Error Analysis\n\n`;
    output += `**Category:** ${analysis.category}\n`;
    output += `**Severity:** ${analysis.severity}\n`;
    output += `**Root Cause:** ${analysis.rootCause}\n\n`;

    if (analysis.relatedFiles.length > 0) {
        output += `### Related Files\n`;
        analysis.relatedFiles.forEach(f => {
            output += `- \`${f}\`\n`;
        });
        output += '\n';
    }

    output += `### Suggestions\n`;
    analysis.suggestions.forEach((s, i) => {
        output += `${i + 1}. ${s}\n`;
    });

    return output;
}

/**
 * Common fix patterns that can be applied automatically
 */
export const COMMON_FIXES: Record<string, {
    detect: (error: string, code: string) => boolean;
    fix: (code: string) => string;
    description: string;
}> = {
    missingImport: {
        detect: (error) => /Cannot find module|is not defined/.test(error),
        fix: (code) => code, // Would need context to add import
        description: 'Add missing import statement',
    },
    nullCheck: {
        detect: (error) => /Cannot read propert.*of (undefined|null)/.test(error),
        fix: (code) => code.replace(/(\w+)\.(\w+)/g, '$1?.$2'),
        description: 'Add optional chaining for null safety',
    },
    asyncAwait: {
        detect: (error) => /is not a function.*then|Promise/.test(error),
        fix: (code) => code,
        description: 'Add async/await or .then() for Promise handling',
    },
};

/**
 * Detect potential issues before they become errors
 */
export function detectPotentialIssues(code: string): string[] {
    const issues: string[] = [];

    // Check for common anti-patterns
    if (/console\.(log|error|warn)\(/.test(code)) {
        issues.push('Consider removing console statements for production');
    }

    if (/any\b/.test(code) && /\.tsx?$/.test(code)) {
        issues.push('Using "any" type reduces type safety');
    }

    if (/setTimeout|setInterval/.test(code) && !/clearTimeout|clearInterval/.test(code)) {
        issues.push('Timer created without cleanup - potential memory leak');
    }

    if (/addEventListener/.test(code) && !/removeEventListener/.test(code)) {
        issues.push('Event listener added without removal - potential memory leak');
    }

    if (/async\s+function|=>\s*async/.test(code) && !/try\s*{/.test(code)) {
        issues.push('Async function without try-catch - unhandled promise rejection risk');
    }

    if (/fetch\(/.test(code) && !/\.catch|try\s*\{/.test(code)) {
        issues.push('Fetch without error handling');
    }

    if (/process\.env\./.test(code) && !/\|\||\?\?|\?\./.test(code)) {
        issues.push('Environment variable access without fallback');
    }

    return issues;
}

/**
 * Generate a debugging checklist based on error type
 */
export function generateDebugChecklist(category: ErrorCategory): string[] {
    const checklists: Record<ErrorCategory, string[]> = {
        syntax: [
            'Check for missing or extra brackets, braces, parentheses',
            'Verify all strings are properly quoted and closed',
            'Look for missing semicolons or commas',
            'Ensure JSX is properly formed with closing tags',
        ],
        import: [
            'Verify the package is installed (check package.json)',
            'Check the import path is correct (relative vs absolute)',
            'Ensure the export exists in the source file',
            'Check for circular dependencies',
        ],
        type: [
            'Review type definitions for the variables involved',
            'Check if types need to be updated after code changes',
            'Consider using type assertions if types are correct',
            'Verify generic type parameters are correct',
        ],
        runtime: [
            'Add console.log to trace the execution flow',
            'Check if variables are initialized before use',
            'Verify async operations complete before accessing results',
            'Look for race conditions in concurrent code',
        ],
        network: [
            'Verify the URL is correct and server is running',
            'Check network connectivity',
            'Review CORS configuration on the server',
            'Inspect request/response in browser dev tools',
        ],
        timeout: [
            'Identify the slow operation causing the timeout',
            'Consider breaking large operations into smaller chunks',
            'Add progress indicators for long operations',
            'Increase timeout limits if operation is legitimately slow',
        ],
        permission: [
            'Verify API keys and tokens are valid',
            'Check user permissions for the operation',
            'Review file/resource permissions',
            'Ensure authentication is properly configured',
        ],
        configuration: [
            'Check all required environment variables are set',
            'Verify config file syntax (JSON, YAML, etc.)',
            'Compare config against documentation',
            'Look for typos in config keys',
        ],
        dependency: [
            'Run npm/yarn install to ensure all deps are installed',
            'Check for version conflicts in package.json',
            'Review peer dependency requirements',
            'Try deleting node_modules and reinstalling',
        ],
        unknown: [
            'Read the full error message and stack trace',
            'Search for the error message online',
            'Check recent code changes',
            'Try to reproduce with minimal code',
        ],
    };

    return checklists[category] || checklists.unknown;
}
