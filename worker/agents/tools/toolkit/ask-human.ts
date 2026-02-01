import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Ask Human Tool
 * 
 * Pauses execution to ask the user for clarification or input.
 * Use when you need user decisions or information to proceed.
 */

export function createAskHumanTool(
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'ask_human',
        description: `Ask the user for clarification or input.

Use this tool for:
- Clarification on ambiguous instructions
- Getting confirmation before critical actions
- Requesting human feedback on proposed solutions
- Asking for credentials or API keys
- Getting user preferences or choices

Keep questions concise and provide clear options when possible.
Limit to 5 questions max with bullet point choices.`,
        args: {
            question: t.string().describe('The question to ask the user'),
        },
        run: async ({ question }) => {
            logger.info('Ask human tool invoked', { question: question.slice(0, 100) });

            streamCb('\n\n❓ **Question for You**\n\n');
            streamCb(question);
            streamCb('\n\n');
            streamCb('*Please respond with your answer or preference.*\n');

            toolRenderer({ 
                name: 'ask_human', 
                status: 'success', 
                result: 'Question sent to user' 
            });

            return {
                success: true,
                question_sent: true,
                message: 'Question has been presented to the user. Waiting for their response.',
                note: 'The user will respond in their next message.',
            };
        },
    });
}
