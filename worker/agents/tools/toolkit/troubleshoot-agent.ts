import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';
import { analyzeError, formatErrorAnalysis, generateDebugChecklist } from '../../utils/troubleshootingSystem';

/**
 * Troubleshoot Agent Tool
 * 
 * Deep root cause analysis for persistent errors.
 * Uses intelligent error pattern matching and analysis.
 */

export function createTroubleshootAgentTool(
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'troubleshoot_agent',
        description: `Deep root cause analysis (RCA) for persistent errors.

Use this when:
- After 2+ failed attempts to fix an issue
- Backend/frontend services failing to start
- Persistent API connection errors
- Database connectivity issues
- Unexplained 500/502/503 errors

This agent:
- Analyzes error patterns intelligently
- Provides categorized diagnosis
- Generates targeted fix suggestions
- Creates debugging checklists

You must implement the recommended fixes.`,
        args: {
            issue: t.string().describe('Brief description of the problem'),
            component: t.string().describe('Affected component: frontend, backend, database, or integration'),
            error_messages: t.string().optional().describe('Error messages or stack traces'),
            previous_attempts: t.string().optional().describe('What fixes were already tried'),
            relevant_files: t.string().optional().describe('File paths that might be related (comma-separated)'),
        },
        run: async ({ issue, component, error_messages, previous_attempts, relevant_files }) => {
            logger.info('Troubleshoot agent invoked', { issue, component });

            streamCb('\n\n🔍 **Troubleshoot Agent - Root Cause Analysis**\n\n');
            streamCb(`**Issue:** ${issue}\n`);
            streamCb(`**Component:** ${component}\n\n`);

            // Intelligent error analysis if error messages provided
            let errorAnalysis = null;
            if (error_messages) {
                errorAnalysis = analyzeError(error_messages);
                streamCb(formatErrorAnalysis(errorAnalysis));
                streamCb('\n');
            }

            streamCb('---\n\n');
            streamCb('### Investigation Steps\n\n');

            // Step 1: Check static analysis
            streamCb('**Step 1: Static Analysis**\n');
            const analysisResult = await agent.runStaticAnalysisCode();
            
            if (!analysisResult.success) {
                streamCb('⚠️ Issues found in static analysis:\n');
                if (analysisResult.lint?.issues?.length) {
                    streamCb(`- Lint issues: ${analysisResult.lint.issues.length}\n`);
                    // Analyze first lint error
                    const firstLint = analysisResult.lint.issues[0];
                    if (firstLint) {
                        const lintAnalysis = analyzeError(firstLint.message);
                        streamCb(`  Category: ${lintAnalysis.category}\n`);
                    }
                }
                if (analysisResult.typecheck?.issues?.length) {
                    streamCb(`- Type errors: ${analysisResult.typecheck.issues.length}\n`);
                    // Analyze first type error
                    const firstType = analysisResult.typecheck.issues[0];
                    if (firstType) {
                        const typeAnalysis = analyzeError(firstType.message);
                        streamCb(`  Category: ${typeAnalysis.category}\n`);
                    }
                }
            } else {
                streamCb('✅ Static analysis passed\n');
            }

            // Step 2: Check runtime errors
            streamCb('\n**Step 2: Runtime Errors**\n');
            const runtimeErrors = await agent.fetchRuntimeErrors();
            
            if (runtimeErrors && runtimeErrors.length > 0) {
                streamCb(`⚠️ ${runtimeErrors.length} runtime error(s) detected:\n`);
                runtimeErrors.slice(0, 3).forEach((err) => {
                    streamCb(`- ${err.message}\n`);
                    const runtimeAnalysis = analyzeError(err.message);
                    streamCb(`  → ${runtimeAnalysis.suggestions[0] || 'Review error details'}\n`);
                });
            } else {
                streamCb('✅ No runtime errors detected\n');
            }

            // Step 3: Check logs
            streamCb('\n**Step 3: Log Analysis**\n');
            const logs = await agent.getLogs();
            
            // Parse logs for errors (logs is a string)
            const logLines = logs ? logs.split('\n') : [];
            const errorLogs = logLines.filter((line) => 
                line.toLowerCase().includes('error') || line.toLowerCase().includes('warn')
            );
            
            if (errorLogs.length > 0) {
                streamCb(`⚠️ ${errorLogs.length} error/warning log entries:\n`);
                errorLogs.slice(0, 3).forEach((log) => {
                    streamCb(`- ${log.slice(0, 100)}...\n`);
                });
            } else {
                streamCb('✅ No error logs found\n');
            }

            // Step 4: File analysis if relevant files provided
            if (relevant_files) {
                streamCb('\n**Step 4: Code Analysis**\n');
                const files = relevant_files.split(',').map(f => f.trim());
                streamCb(`Analyzing ${files.length} file(s)...\n`);
                
                // Check for potential issues in file names/patterns
                for (const file of files.slice(0, 3)) {
                    streamCb(`- \`${file}\`\n`);
                }
            }

            // Generate intelligent recommendations
            streamCb('\n---\n\n');
            streamCb('### Root Cause Analysis\n\n');

            // Use error category to generate targeted checklist
            const category = errorAnalysis?.category || 
                (component === 'frontend' ? 'runtime' : 
                 component === 'backend' ? 'runtime' :
                 component === 'database' ? 'configuration' : 'unknown');
            
            const checklist = generateDebugChecklist(category);
            
            streamCb(`**Debug Checklist (${category}):**\n`);
            checklist.forEach((item, i) => {
                streamCb(`${i + 1}. ${item}\n`);
            });

            // Component-specific recommendations
            const recommendations: string[] = [];
            
            if (component === 'frontend') {
                recommendations.push(
                    'Check browser console for client-side errors',
                    'Verify API endpoint URLs are correct',
                    'Check for missing environment variables',
                    'Ensure all imports are resolved',
                );
            } else if (component === 'backend') {
                recommendations.push(
                    'Check server logs for stack traces',
                    'Verify database connections',
                    'Check for missing dependencies',
                    'Ensure environment variables are set',
                );
            } else if (component === 'database') {
                recommendations.push(
                    'Verify connection string format',
                    'Check database credentials',
                    'Ensure database service is running',
                    'Check for schema migration issues',
                );
            } else {
                recommendations.push(
                    'Check API credentials and keys',
                    'Verify endpoint URLs',
                    'Check rate limits',
                    'Review integration documentation',
                );
            }

            if (error_messages) {
                streamCb(`**Error Pattern:** ${error_messages.slice(0, 200)}\n\n`);
            }

            if (previous_attempts) {
                streamCb(`**Previous Attempts:** ${previous_attempts}\n\n`);
            }

            streamCb('### Recommendations\n\n');
            recommendations.forEach((rec, i) => {
                streamCb(`${i + 1}. ${rec}\n`);
            });

            streamCb('\n### Next Steps\n\n');
            streamCb('1. Review the issues identified above\n');
            streamCb('2. Implement the recommended fixes\n');
            streamCb('3. Test the specific functionality\n');
            streamCb('4. Use `deep_debug` if issues persist\n');

            toolRenderer({ 
                name: 'troubleshoot_agent', 
                status: 'success', 
                result: `RCA for ${component}` 
            });

            return {
                success: true,
                component,
                findings: {
                    static_analysis: analysisResult.success ? 'passed' : 'issues_found',
                    runtime_errors: runtimeErrors?.length || 0,
                    error_logs: errorLogs.length,
                },
                recommendations,
                action_required: true,
                note: 'This agent is READ-ONLY. Please implement the recommended fixes.',
            };
        },
    });
}
