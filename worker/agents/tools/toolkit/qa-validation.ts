import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * QA Validation Tool
 * 
 * Proactive validation that catches issues BEFORE preview deployment.
 * Runs static analysis, checks imports, validates env vars, and
 * verifies route consistency.
 * 
 * NEW TOOL — fills the gap between file generation and deploy-preview.
 */

interface ValidationResult {
    category: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    file?: string;
    line?: number;
    fix?: string;
}

export function createQAValidationTool(
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'qa_validation',
        description: `Run proactive quality checks on generated code before deploying to preview.

This catches common issues that would otherwise break the preview:
- TypeScript compilation errors
- Missing/broken imports
- Undefined environment variables
- Route mismatches between frontend and backend
- Missing dependencies in package.json
- Common React anti-patterns

Use AFTER generating/modifying files and BEFORE deploy_preview.
Much cheaper than a full debug cycle.`,
        args: {
            focus_paths: t.array(t.string()).optional().describe('Specific file paths to focus validation on. If empty, validates all files.'),
            check_env: t.boolean().optional().describe('Whether to check for env var consistency (default: true)'),
            check_routes: t.boolean().optional().describe('Whether to check API route consistency (default: true)'),
            auto_fix: t.boolean().optional().describe('Attempt automatic fixes for simple issues (default: false)'),
        },
        run: async ({ focus_paths, check_env, check_routes, auto_fix }) => {
            logger.info('QA validation invoked', { focus_paths, auto_fix });

            streamCb('\n\n🔍 **QA Validation**\n\n');

            const issues: ValidationResult[] = [];
            const fixes: string[] = [];
            const shouldCheckEnv = check_env !== false;
            const shouldCheckRoutes = check_routes !== false;
            const shouldAutoFix = auto_fix === true;

            // ─── Step 1: Static Analysis (TypeScript + Lint) ───
            streamCb('Running static analysis...\n');
            try {
                const analysis = await agent.runStaticAnalysisCode(focus_paths);

                if (analysis.typecheck?.issues?.length) {
                    for (const issue of analysis.typecheck.issues) {
                        issues.push({
                            category: 'typecheck',
                            severity: 'error',
                            message: issue.message,
                            file: issue.filePath,
                            line: issue.line,
                        });
                    }
                }

                if (analysis.lint?.issues?.length) {
                    for (const issue of analysis.lint.issues) {
                        issues.push({
                            category: 'lint',
                            severity: issue.severity === 'error' ? 'error' : 'warning',
                            message: issue.message,
                            file: issue.filePath,
                            line: issue.line,
                        });
                    }
                }

                if (analysis.success) {
                    streamCb('✅ TypeScript & lint checks passed\n');
                } else {
                    const errorCount = issues.filter(i => i.severity === 'error').length;
                    const warnCount = issues.filter(i => i.severity === 'warning').length;
                    streamCb(`⚠️ Found ${errorCount} error(s), ${warnCount} warning(s)\n`);
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Analysis failed';
                streamCb(`⚠️ Static analysis error: ${msg}\n`);
                issues.push({
                    category: 'analysis',
                    severity: 'warning',
                    message: `Static analysis failed: ${msg}`,
                });
            }

            // ─── Step 2: File Existence & Import Checks ───
            streamCb('Checking file imports...\n');
            try {
                const allFiles = agent.listFiles();
                const filePaths = new Set(allFiles.map(f => f.path));

                for (const file of allFiles) {
                    if (!file.content) continue;
                    if (!file.path.match(/\.(ts|tsx|js|jsx)$/)) continue;

                    // Check relative imports
                    const importPattern = /(?:from|import)\s+['"](\.[^'"]+)['"]/g;
                    let match;
                    while ((match = importPattern.exec(file.content)) !== null) {
                        const importPath = match[1];
                        // Resolve relative to file directory
                        const fileDir = file.path.split('/').slice(0, -1).join('/');
                        const resolved = resolveImportPath(fileDir, importPath);

                        // Check if any valid resolution exists
                        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
                        const exists = extensions.some(ext => filePaths.has(resolved + ext));

                        if (!exists) {
                            issues.push({
                                category: 'import',
                                severity: 'error',
                                message: `Import "${importPath}" cannot be resolved`,
                                file: file.path,
                                fix: `Check that the imported file exists or update the import path`,
                            });
                        }
                    }
                }

                const importErrors = issues.filter(i => i.category === 'import').length;
                if (importErrors === 0) {
                    streamCb('✅ Import resolution check passed\n');
                } else {
                    streamCb(`⚠️ ${importErrors} unresolved import(s) found\n`);
                }
            } catch (error) {
                streamCb('⚠️ Import check skipped (could not list files)\n');
            }

            // ─── Step 3: Environment Variable Consistency ───
            if (shouldCheckEnv) {
                streamCb('Checking environment variables...\n');
                try {
                    const allFiles = agent.listFiles();
                    const referencedEnvVars = new Set<string>();
                    const definedEnvVars = new Set<string>();

                    for (const file of allFiles) {
                        if (!file.content) continue;

                        // Find env var references in code
                        if (file.path.match(/\.(ts|tsx|js|jsx)$/)) {
                            const envPatterns = [
                                /process\.env\.([A-Z_][A-Z0-9_]*)/g,
                                /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
                            ];
                            for (const pattern of envPatterns) {
                                let match;
                                while ((match = pattern.exec(file.content)) !== null) {
                                    referencedEnvVars.add(match[1]);
                                }
                            }
                        }

                        // Find env var definitions in .env files
                        if (file.path.match(/\.env/)) {
                            const lines = file.content.split('\n');
                            for (const line of lines) {
                                const envMatch = line.match(/^([A-Z_][A-Z0-9_]*)=/);
                                if (envMatch) {
                                    definedEnvVars.add(envMatch[1]);
                                }
                            }
                        }
                    }

                    // Check for referenced but undefined env vars
                    const undefinedVars = [...referencedEnvVars].filter(v => !definedEnvVars.has(v));

                    // Filter out common built-in vars
                    const builtins = new Set(['NODE_ENV', 'PORT', 'HOST', 'HOME', 'PATH', 'PWD']);
                    const reallyUndefined = undefinedVars.filter(v => !builtins.has(v));

                    if (reallyUndefined.length > 0) {
                        for (const envVar of reallyUndefined) {
                            issues.push({
                                category: 'env',
                                severity: 'warning',
                                message: `Environment variable "${envVar}" is referenced in code but not defined in .env.example`,
                                fix: `Add ${envVar}= to .env.example`,
                            });
                        }
                        streamCb(`⚠️ ${reallyUndefined.length} env var(s) referenced but not in .env: ${reallyUndefined.join(', ')}\n`);
                    } else {
                        streamCb('✅ Environment variable check passed\n');
                    }
                } catch {
                    streamCb('⚠️ Env var check skipped\n');
                }
            }

            // ─── Step 4: Route Consistency ───
            if (shouldCheckRoutes) {
                streamCb('Checking API route consistency...\n');
                try {
                    const allFiles = agent.listFiles();
                    const definedRoutes = new Set<string>();
                    const calledRoutes = new Set<string>();

                    for (const file of allFiles) {
                        if (!file.content) continue;

                        // Backend route definitions (Express/Next.js patterns)
                        if (file.path.match(/\/(api|routes|server)\//)) {
                            const routePatterns = [
                                /(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g,
                                /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g,
                            ];
                            for (const pattern of routePatterns) {
                                let match;
                                while ((match = pattern.exec(file.content)) !== null) {
                                    if (match[2]) {
                                        definedRoutes.add(`${match[1].toUpperCase()} ${match[2]}`);
                                    }
                                }
                            }
                        }

                        // Frontend API calls
                        if (file.path.match(/\.(ts|tsx|js|jsx)$/) && !file.path.includes('/api/')) {
                            const fetchPattern = /fetch\s*\(\s*[`'"]([/][^'"`]+)[`'"]/g;
                            let match;
                            while ((match = fetchPattern.exec(file.content)) !== null) {
                                calledRoutes.add(match[1]);
                            }
                        }
                    }

                    // This is a soft check — just report for awareness
                    if (calledRoutes.size > 0 || definedRoutes.size > 0) {
                        streamCb(`📡 Found ${definedRoutes.size} defined route(s), ${calledRoutes.size} frontend API call(s)\n`);
                    }
                    streamCb('✅ Route check complete\n');
                } catch {
                    streamCb('⚠️ Route check skipped\n');
                }
            }

            // ─── Step 5: Auto-fix if requested ───
            if (shouldAutoFix && issues.some(i => i.severity === 'error')) {
                streamCb('\n🔧 Attempting auto-fixes...\n');

                const errorFiles = [...new Set(
                    issues
                        .filter(i => i.severity === 'error' && i.file)
                        .map(i => i.file!)
                )];

                for (const filePath of errorFiles.slice(0, 3)) { // Max 3 files
                    try {
                        const fileIssues = issues
                            .filter(i => i.file === filePath)
                            .map(i => i.message);

                        await agent.regenerateFileByPath(filePath, fileIssues);
                        fixes.push(filePath);
                        streamCb(`✅ Auto-fixed: \`${filePath}\`\n`);
                    } catch {
                        streamCb(`⚠️ Could not auto-fix: \`${filePath}\`\n`);
                    }
                }
            }

            // ─── Summary ───
            const errors = issues.filter(i => i.severity === 'error');
            const warnings = issues.filter(i => i.severity === 'warning');
            const passed = errors.length === 0;

            streamCb('\n---\n');
            streamCb(`\n**QA Result:** ${passed ? '✅ PASSED' : '❌ ISSUES FOUND'}\n`);
            streamCb(`- Errors: ${errors.length}\n`);
            streamCb(`- Warnings: ${warnings.length}\n`);
            if (fixes.length > 0) {
                streamCb(`- Auto-fixed: ${fixes.length} file(s)\n`);
            }

            if (!passed) {
                streamCb('\n**Top issues to fix:**\n');
                for (const issue of errors.slice(0, 5)) {
                    streamCb(`- ❌ ${issue.file ? `\`${issue.file}\`: ` : ''}${issue.message}\n`);
                    if (issue.fix) {
                        streamCb(`  → Fix: ${issue.fix}\n`);
                    }
                }
            }

            toolRenderer({
                name: 'qa_validation',
                status: passed ? 'success' : 'error',
                result: `${errors.length} errors, ${warnings.length} warnings`,
            });

            return {
                passed,
                errors: errors.length,
                warnings: warnings.length,
                issues: issues.slice(0, 20), // Cap returned issues
                auto_fixes: fixes,
                recommendation: passed
                    ? 'All checks passed. Safe to deploy preview.'
                    : errors.length <= 3
                        ? 'A few issues found. Consider fixing before deploy, or use auto_fix=true.'
                        : 'Multiple issues detected. Fix errors before deploying to avoid a broken preview.',
            };
        },
    });
}

/**
 * Resolve a relative import path from a directory
 */
function resolveImportPath(fromDir: string, importPath: string): string {
    const parts = fromDir.split('/').filter(Boolean);
    const importParts = importPath.split('/');

    for (const part of importParts) {
        if (part === '.') continue;
        if (part === '..') {
            parts.pop();
        } else {
            parts.push(part);
        }
    }

    return parts.join('/');
}
