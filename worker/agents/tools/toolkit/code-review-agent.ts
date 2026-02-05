/**
 * Code Review Agent Tool
 * 
 * A specialized agent that reviews code in the current project.
 * Can analyze for:
 * - Bugs and potential issues
 * - Security vulnerabilities
 * - Performance problems
 * - Code style and best practices
 * - Architecture improvements
 * - Missing error handling
 * - Accessibility issues (for frontend)
 */

import { tool, t } from '../types';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from '../../operations/UserConversationProcessor';
import { createSystemMessage, createUserMessage, Message } from '../../inferutils/common';
import { executeInference } from '../../inferutils/infer';
import z from 'zod';

const CodeReviewSchema = z.object({
    overallScore: z.number().min(1).max(10).describe('Overall code quality score 1-10'),
    summary: z.string().describe('Brief summary of the code review findings'),
    issues: z.array(z.object({
        severity: z.enum(['critical', 'high', 'medium', 'low']).describe('Issue severity'),
        category: z.enum(['bug', 'security', 'performance', 'style', 'architecture', 'accessibility', 'error_handling', 'other']).describe('Issue category'),
        file: z.string().describe('File path where the issue was found'),
        line: z.string().optional().describe('Line number or range if applicable'),
        description: z.string().describe('Description of the issue'),
        suggestion: z.string().describe('How to fix this issue'),
        codeExample: z.string().optional().describe('Example code fix if applicable'),
    })).describe('List of issues found'),
    strengths: z.array(z.string()).describe('Things done well in the code'),
    recommendations: z.array(z.object({
        priority: z.enum(['high', 'medium', 'low']).describe('Priority of the recommendation'),
        title: z.string().describe('Short title for the recommendation'),
        description: z.string().describe('Detailed description'),
    })).describe('General recommendations for improvement'),
});

const CODE_REVIEW_SYSTEM_PROMPT = `You are an expert code reviewer. Your job is to thoroughly analyze code and provide actionable feedback.

## Review Categories

### Bugs
- Logic errors, off-by-one errors, null/undefined handling
- Race conditions, memory leaks, infinite loops

### Security
- XSS vulnerabilities, SQL injection, exposed secrets
- Insecure data handling, missing auth, CORS issues

### Performance
- Unnecessary re-renders (React), N+1 queries
- Missing memoization, large bundle imports
- Inefficient algorithms

### Code Style
- Naming conventions, code organization, DRY violations
- Dead code, overly complex logic, missing types

### Architecture
- Separation of concerns, component structure
- State management, API design, file organization

### Error Handling
- Uncaught exceptions, missing try/catch
- Silent failures, poor error messages

### Accessibility (Frontend)
- Missing ARIA labels, keyboard navigation
- Color contrast, screen reader support

## Guidelines
1. Be specific - reference exact files and lines
2. Be constructive - always suggest a fix
3. Prioritize by impact - critical issues first
4. Acknowledge good code - mention strengths`;

export function createCodeReviewAgentTool(
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'code_review_agent',
        description: `Review the project's code for bugs, security issues, performance problems, and best practices.

Use this to:
- Get a second opinion on generated code
- Find potential issues before deployment
- Improve code quality
- Audit security and performance

Scope options:
- 'full' - Review entire project (up to 20 files)
- 'specific' - Review specific files (provide file_paths)

Focus areas (optional):
- bugs, security, performance, style, architecture, accessibility, error_handling`,
        args: {
            scope: t.string().describe('Review scope: "full" or "specific"'),
            file_paths: t.string().optional().describe('Comma-separated file paths (when scope="specific")'),
            focus_areas: t.string().optional().describe('Comma-separated focus areas: bugs,security,performance,style,architecture,accessibility,error_handling'),
        },
        run: async ({ scope, file_paths, focus_areas }) => {
            logger.info('Code review agent started', { scope, file_paths, focus_areas });
            
            toolRenderer({
                name: 'code_review_agent',
                status: 'start',
            });
            
            streamCb(`\n📝 **Code Review Agent Starting**\n`);
            streamCb(`Scope: ${scope === 'full' ? 'Entire Project' : 'Specific Files'}\n`);
            if (focus_areas) {
                streamCb(`Focus areas: ${focus_areas}\n`);
            }
            streamCb(`\n---\n\n`);

            try {
                // Get files to review
                let filesToReview: { path: string; content: string }[] = [];
                
                if (scope === 'full') {
                    // Get all project files
                    const allFiles = agent.listFiles();
                    const filePaths = allFiles
                        .map(f => f.filePath)
                        .filter(p => 
                            // Include common code files
                            p.endsWith('.ts') || 
                            p.endsWith('.tsx') || 
                            p.endsWith('.js') || 
                            p.endsWith('.jsx') ||
                            p.endsWith('.css')
                        )
                        .filter(p => 
                            // Exclude non-essential files
                            !p.includes('node_modules') &&
                            !p.includes('.git') &&
                            !p.includes('dist/') &&
                            !p.includes('build/')
                        )
                        .slice(0, 20); // Limit to prevent token overflow
                    
                    const result = await agent.readFiles(filePaths);
                    filesToReview = result.files;
                } else if (file_paths) {
                    const paths = file_paths.split(',').map(p => p.trim());
                    const result = await agent.readFiles(paths);
                    filesToReview = result.files;
                }

                if (filesToReview.length === 0) {
                    streamCb(`⚠️ No files found to review.\n`);
                    return {
                        success: false,
                        error: 'No files found to review',
                    };
                }

                streamCb(`Analyzing ${filesToReview.length} files...\n\n`);

                // Build code context for review
                const codeContext = filesToReview.map(f => 
                    `### File: ${f.path}\n\`\`\`\n${f.content.slice(0, 5000)}\n\`\`\``
                ).join('\n\n');

                // Build focus instruction
                const focusInstruction = focus_areas 
                    ? `\n\nFocus especially on these areas: ${focus_areas}`
                    : '';

                // Run the review
                const messages: Message[] = [
                    createSystemMessage(CODE_REVIEW_SYSTEM_PROMPT),
                    createUserMessage(`Please review the following code and provide detailed feedback.${focusInstruction}

## Code to Review

${codeContext}

Provide a thorough review with specific issues, their locations, and how to fix them.`),
                ];

                const operationOptions = agent.getOperationOptions();
                
                const result = await executeInference({
                    env: operationOptions.env,
                    messages,
                    agentActionName: 'blueprint',
                    schema: CodeReviewSchema,
                    context: operationOptions.inferenceContext,
                    stream: {
                        chunk_size: 100,
                        onChunk: streamCb,
                    },
                });

                const review = result.object;

                // Format and stream the review results
                streamCb(`\n\n---\n\n`);
                streamCb(`## 📊 Code Review Results\n\n`);
                streamCb(`**Overall Score: ${review.overallScore}/10**\n\n`);
                streamCb(`### Summary\n${review.summary}\n\n`);

                // Strengths
                if (review.strengths.length > 0) {
                    streamCb(`### ✅ Strengths\n`);
                    review.strengths.forEach(s => streamCb(`- ${s}\n`));
                    streamCb(`\n`);
                }

                // Issues by severity
                const criticalIssues = review.issues.filter(i => i.severity === 'critical');
                const highIssues = review.issues.filter(i => i.severity === 'high');
                const mediumIssues = review.issues.filter(i => i.severity === 'medium');
                const lowIssues = review.issues.filter(i => i.severity === 'low');

                if (criticalIssues.length > 0) {
                    streamCb(`### 🔴 Critical Issues (${criticalIssues.length})\n`);
                    criticalIssues.forEach(issue => {
                        streamCb(`\n**[${issue.category.toUpperCase()}] ${issue.file}${issue.line ? `:${issue.line}` : ''}**\n`);
                        streamCb(`${issue.description}\n`);
                        streamCb(`💡 *Fix:* ${issue.suggestion}\n`);
                        if (issue.codeExample) {
                            streamCb(`\`\`\`\n${issue.codeExample}\n\`\`\`\n`);
                        }
                    });
                    streamCb(`\n`);
                }

                if (highIssues.length > 0) {
                    streamCb(`### 🟠 High Priority Issues (${highIssues.length})\n`);
                    highIssues.forEach(issue => {
                        streamCb(`\n**[${issue.category.toUpperCase()}] ${issue.file}${issue.line ? `:${issue.line}` : ''}**\n`);
                        streamCb(`${issue.description}\n`);
                        streamCb(`💡 *Fix:* ${issue.suggestion}\n`);
                    });
                    streamCb(`\n`);
                }

                if (mediumIssues.length > 0) {
                    streamCb(`### 🟡 Medium Priority Issues (${mediumIssues.length})\n`);
                    mediumIssues.forEach(issue => {
                        streamCb(`- **${issue.file}**: ${issue.description}\n`);
                    });
                    streamCb(`\n`);
                }

                if (lowIssues.length > 0) {
                    streamCb(`### 🟢 Low Priority Issues (${lowIssues.length})\n`);
                    lowIssues.forEach(issue => {
                        streamCb(`- **${issue.file}**: ${issue.description}\n`);
                    });
                    streamCb(`\n`);
                }

                // Recommendations
                if (review.recommendations.length > 0) {
                    streamCb(`### 💡 Recommendations\n`);
                    review.recommendations.forEach(rec => {
                        const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
                        streamCb(`\n${icon} **${rec.title}**\n`);
                        streamCb(`${rec.description}\n`);
                    });
                }

                toolRenderer({
                    name: 'code_review_agent',
                    status: 'success',
                });

                logger.info('Code review completed', {
                    score: review.overallScore,
                    issueCount: review.issues.length,
                    criticalCount: criticalIssues.length,
                });

                return {
                    success: true,
                    score: review.overallScore,
                    summary: review.summary,
                    issueCount: review.issues.length,
                    criticalIssues: criticalIssues.length,
                    highIssues: highIssues.length,
                    issues: review.issues,
                    recommendations: review.recommendations,
                };

            } catch (error) {
                logger.error('Code review failed', error);
                
                toolRenderer({
                    name: 'code_review_agent',
                    status: 'error',
                });

                streamCb(`\n❌ Code review failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);

                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        },
    });
}
