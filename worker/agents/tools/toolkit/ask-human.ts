import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Ask Human Tool
 * 
 * Pauses execution to ask the user for clarification or input.
 * Streams the question to chat and returns a signal to stop.
 */

export function createAskHumanTool(
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'ask_human',
        description: `Ask the user for clarification or input.

Use this tool when:
- The request is unclear or ambiguous
- You need user preferences or choices
- You need confirmation before a major action

Keep questions concise. Provide clear options when possible.`,
        args: {
            question: t.string().describe('The question to ask the user'),
        },
        run: async ({ question }) => {
            logger.info('Ask human tool invoked', { 
                question: question.slice(0, 100) 
            });

            // Stream the question directly to chat
            streamCb('\n\n');
            streamCb(question);
            streamCb('\n\n');

            toolRenderer({ 
                name: 'ask_human', 
                status: 'success', 
                result: 'Question sent to user' 
            });

            return {
                success: true,
                message: 'Question sent. Waiting for user response.',
                question_sent: question,
            };
        },
    });
}
