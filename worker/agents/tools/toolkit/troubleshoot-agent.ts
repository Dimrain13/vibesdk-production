import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Troubleshoot Agent Tool
 * 
 * Deep root cause analysis for persistent errors.
 * READ-ONLY - investigates but does not modify code.
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
- Investigates with READ-ONLY access
- Analyzes logs, configurations, error messages
- Provides actionable fix recommendations
- Does NOT modify code directly

You must implement the recommended fixes.`,
        args: {
            issue: t.string().describe('Brief description of the problem'),
            component: t.string().describe('Affected component: frontend, backend, database, or integration'),
            error_messages: t.string().optional().describe('Error messages or stack traces'),
            previous_attempts: t.string().optional().describe('What fixes were already tried'),
            relevant_files: t.string().optional().describe('File paths that might be related (comma-separated)'),
        },
        run: async ({ issue, component, error_messages, previous_attempts }) => {
            logger.info('Troubleshoot agent invoked', { issue, component });

            streamCb('\n\n🔍 **Troubleshoot Agent - Root Cause Analysis**\n\n');
            streamCb(`**Issue:** ${issue}\n`);
            streamCb(`**Component:** ${component}\n\n`);

            streamCb('---\n\n');
            streamCb('### Investigation Steps\n\n');

            // Step 1: Check static analysis
            streamCb('**Step 1: Static Analysis**\n');
            const analysisResult = await agent.runStaticAnalysisCode();
            
            if (!analysisResult.success) {
                streamCb('⚠️ Issues found in static analysis:\n');
                if (analysisResult.lint?.issues?.length) {
                    streamCb(`- Lint issues: ${analysisResult.lint.issues.length}\n`);
                }
                if (analysisResult.typecheck?.issues?.length) {
                    streamCb(`- Type errors: ${analysisResult.typecheck.issues.length}\n`);
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

            // Generate recommendations based on component
            streamCb('\n---\n\n');
            streamCb('### Root Cause Analysis\n\n');

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
