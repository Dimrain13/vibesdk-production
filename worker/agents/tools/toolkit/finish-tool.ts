import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Finish Tool
 * 
 * Provides a summary when completing a task or feature.
 * Use to wrap up work with clear status and next steps.
 */

export function createFinishTool(
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'finish',
        description: `Provide a completion summary for tasks.

Use this tool when:
- Completing an MVP or feature
- Finishing a bug fix
- Wrapping up a task phase

Include:
- What was completed (2-3 bullet points)
- Testing status
- Next action items
- Any blockers or notes

Keep summaries concise and actionable.`,
        args: {
            summary: t.string().describe('Completion summary with what was done and next steps'),
            status: t.string().optional().describe('Status: completed, partial, or blocked'),
            next_actions: t.string().optional().describe('Recommended next actions'),
        },
        run: async ({ summary, status, next_actions }) => {
            logger.info('Finish tool invoked', { status: status || 'completed' });

            const statusEmoji = {
                completed: '✅',
                partial: '🟡',
                blocked: '🔴',
            }[status || 'completed'] || '✅';

            streamCb('\n\n---\n\n');
            streamCb(`## ${statusEmoji} Task Summary\n\n`);
            streamCb(summary);
            streamCb('\n\n');

            if (next_actions) {
                streamCb('### Next Actions\n\n');
                streamCb(next_actions);
                streamCb('\n\n');
            }

            streamCb('---\n');

            toolRenderer({ 
                name: 'finish', 
                status: 'success', 
                result: status || 'completed' 
            });

            return {
                success: true,
                status: status || 'completed',
                summary_provided: true,
                message: 'Task summary has been presented.',
            };
        },
    });
}
