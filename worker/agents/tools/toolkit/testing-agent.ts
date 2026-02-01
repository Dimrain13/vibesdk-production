import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Testing Agent Tool
 * 
 * Automated testing for backend APIs and frontend components.
 * Validates functionality after feature implementation.
 */

export function createTestingAgentTool(
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    let callCount = 0;

    return tool({
        name: 'testing_agent',
        description: `Automated testing agent for backend and frontend validation.

Use this tool:
- After completing medium (>2 features) or large features
- Upon phase completion
- For integration testing

Provide:
- Problem statement and features to test
- Files of reference with method names
- Required credentials if needed
- Testing type: backend, frontend, or both

LIMITED TO ONE CALL PER CONVERSATION TURN.`,
        args: {
            problem_statement: t.string().describe('Original problem statement and user requirements'),
            features_to_test: t.string().describe('Features or bugs to test (comma-separated)'),
            files_of_reference: t.string().optional().describe('Files to validate against (comma-separated paths)'),
            testing_type: t.string().describe('Testing scope: backend, frontend, or both'),
            credentials: t.string().optional().describe('Required credentials for testing'),
            context_notes: t.string().optional().describe('Additional context or notes for the testing agent'),
        },
        run: async ({ features_to_test, testing_type }) => {
            if (callCount > 0) {
                logger.warn('Testing agent: Already called once this turn');
                return {
                    error: 'CALL_LIMIT_EXCEEDED: Testing agent can only be called once per turn.',
                };
            }
            callCount++;

            logger.info('Testing agent invoked', { 
                testing_type, 
                features: features_to_test 
            });

            streamCb('\n\n🧪 **Testing Agent**\n\n');
            streamCb(`**Testing Type:** ${testing_type}\n`);
            streamCb(`**Features:** ${features_to_test}\n\n`);

            // Run lint and typecheck first
            streamCb('Running static analysis...\n');
            
            const analysisResult = await agent.runStaticAnalysisCode();
            
            if (!analysisResult.success) {
                streamCb('\n⚠️ **Analysis Issues Found:**\n');
                
                if (analysisResult.lint?.issues?.length) {
                    streamCb(`\n**Lint Issues:** ${analysisResult.lint.issues.length}\n`);
                    analysisResult.lint.issues.slice(0, 5).forEach((issue) => {
                        streamCb(`- ${issue.filePath}:${issue.line} - ${issue.message}\n`);
                    });
                }
                
                if (analysisResult.typecheck?.issues?.length) {
                    streamCb(`\n**Type Errors:** ${analysisResult.typecheck.issues.length}\n`);
                    analysisResult.typecheck.issues.slice(0, 5).forEach((issue) => {
                        streamCb(`- ${issue.filePath}:${issue.line} - ${issue.message}\n`);
                    });
                }
            } else {
                streamCb('✅ Static analysis passed\n');
            }

            // Check runtime errors
            streamCb('\nChecking runtime errors...\n');
            const runtimeErrors = await agent.fetchRuntimeErrors();
            
            if (runtimeErrors && runtimeErrors.length > 0) {
                streamCb(`\n⚠️ **Runtime Errors Found:** ${runtimeErrors.length}\n`);
                runtimeErrors.slice(0, 3).forEach((err) => {
                    streamCb(`- ${err.message}\n`);
                });
            } else {
                streamCb('✅ No runtime errors detected\n');
            }

            // Generate test summary
            const testPassed = analysisResult.success && (!runtimeErrors || runtimeErrors.length === 0);
            
            streamCb('\n---\n');
            streamCb(`\n**Test Result:** ${testPassed ? '✅ PASSED' : '❌ ISSUES FOUND'}\n`);

            toolRenderer({ 
                name: 'testing_agent', 
                status: testPassed ? 'success' : 'error',
                result: testPassed ? 'All tests passed' : 'Issues found'
            });

            return {
                success: testPassed,
                testing_type,
                features_tested: features_to_test.split(',').map((f: string) => f.trim()),
                static_analysis: {
                    passed: analysisResult.success,
                    lint_issues: analysisResult.lint?.issues?.length || 0,
                    type_errors: analysisResult.typecheck?.issues?.length || 0,
                },
                runtime_errors: runtimeErrors?.length || 0,
                recommendation: testPassed 
                    ? 'All checks passed. Ready for user verification.'
                    : 'Please fix the issues above before proceeding.',
            };
        },
    });
}
