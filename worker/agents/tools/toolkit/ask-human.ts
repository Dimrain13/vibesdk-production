import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from '../../operations/UserConversationProcessor';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';

/**
 * Ask Human Tool
 * 
 * Pauses execution to ask the user for clarification or input.
 * Use when you need user decisions or information to proceed.
 * 
 * IMPORTANT: After calling this tool, the agent MUST stop and wait
 * for the user's response. Do NOT continue with other tools.
 */

export function createAskHumanTool(
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'ask_human',
        description: `Ask the user for clarification or input. STOPS execution and waits for user response.

Use this tool for:
- Clarification on ambiguous instructions
- Getting confirmation before critical actions (like blueprinting)
- Requesting human feedback on proposed solutions
- Asking for credentials or API keys
- Getting user preferences or choices

CRITICAL: After using this tool, you MUST STOP and wait for the user's response.
Do NOT call any other tools (generate_files, generate_blueprint, etc.) after ask_human.
The user will respond in their next message.

Keep questions concise and provide clear options when possible.
Limit to 5 questions max with bullet point choices.`,
        args: {
            question: t.string().describe('The question to ask the user. Be clear and provide options.'),
        },
        run: async ({ question }) => {
            logger.info('Ask human tool invoked - halting execution for user input', { 
                question: question.slice(0, 100) 
            });

            // Stream the question directly to chat
            streamCb('\n\n');
            streamCb(question);
            streamCb('\n\n');

            // Set the flag to halt the build loop
            agent.setWaitingForUserInput(true);

            toolRenderer({ 
                name: 'ask_human', 
                status: 'success', 
                result: 'Question sent - waiting for user response' 
            });

            // Return a clear signal that execution should halt
            return {
                success: true,
                status: 'WAITING_FOR_USER',
                message: 'Question presented to user. Execution halted until user responds.',
                instruction: 'Do NOT proceed with any other tools until user responds.',
                question_sent: question,
            };
        },
    });
}
