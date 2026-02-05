/**
 * RequestClassifier - Pre-agent request classification
 * 
 * This module intercepts ALL incoming requests BEFORE an agent is created.
 * It classifies requests into three categories:
 * 
 * 1. CONVERSATION - Simple questions, greetings, explanations
 *    → Respond directly via LLM, NO agent created
 * 
 * 2. BUILD_VAGUE - Build request but needs clarification
 *    → Ask clarifying questions, then proceed to build
 * 
 * 3. BUILD_CLEAR - Clear build request with enough detail
 *    → Proceed directly to agent creation and blueprinting
 */

import { createSystemMessage, createUserMessage, Message } from '../../../agents/inferutils/common';
import { InferenceContext } from '../../../agents/inferutils/config.types';
import { executeInference } from '../../../agents/inferutils/infer';
import { StructuredLogger } from '../../../logger';
import z from 'zod';

export type RequestType = 'conversation' | 'build_vague' | 'build_clear';

export interface ClassificationResult {
    type: RequestType;
    response?: string;           // For conversation: the direct response
    clarificationQuestion?: string; // For build_vague: questions to ask
    enhancedQuery?: string;      // For build_clear: enhanced version of query
    reasoning: string;           // Why this classification was made
}

const ClassificationSchema = z.object({
    type: z.enum(['conversation', 'build_vague', 'build_clear']).describe('Classification of the request'),
    reasoning: z.string().describe('Brief explanation of classification'),
    response: z.string().optional().describe('If conversation: direct response to user'),
    clarificationQuestion: z.string().optional().describe('If build_vague: questions to ask user'),
    enhancedQuery: z.string().optional().describe('If build_clear: enhanced version of the request'),
});

const CLASSIFIER_PROMPT = `You are a request classifier for a coding assistant called Orbit. Classify user requests into exactly one category:

## Categories

### CONVERSATION
User is chatting, asking questions, or seeking information - NOT asking to build anything.
Examples:
- "Hello" / "Hi" / "Hey there"
- "What can you do?"
- "How does React work?"
- "Explain serverless architecture"
- "Thanks!" / "Great job!"

For CONVERSATION: Provide a helpful, friendly response in the 'response' field.

### BUILD_VAGUE  
User wants to build something but the request lacks specifics.
Examples:
- "Build me an app"
- "Create a website"
- "Make a dashboard"
- "I need a todo app"

For BUILD_VAGUE: Ask 2-4 clarifying questions in the 'clarificationQuestion' field. Use numbered options when possible.

### BUILD_CLEAR
User has a specific, actionable build request with enough detail.
Examples:
- "Build a todo app with React, local storage, and a dark theme"
- "Create a landing page for a SaaS product with pricing section"
- "Fix the bug in header.tsx where the nav doesn't collapse"
- "Add a delete button to each todo item"

For BUILD_CLEAR: Enhance the query with any implicit requirements in the 'enhancedQuery' field.

## Rules
1. When in doubt between BUILD_VAGUE and BUILD_CLEAR, choose BUILD_VAGUE
2. Single-word or very short requests about building are always BUILD_VAGUE
3. Questions about coding concepts without "build/create/make" are CONVERSATION
4. Follow-up responses to clarification questions are BUILD_CLEAR`;

export async function classifyRequest(
    query: string,
    env: Env,
    inferenceContext: InferenceContext,
    logger: StructuredLogger,
    onStreamChunk?: (chunk: string) => void
): Promise<ClassificationResult> {
    logger.info('Classifying request', { query: query.slice(0, 100) });

    const messages: Message[] = [
        createSystemMessage(CLASSIFIER_PROMPT),
        createUserMessage(`Classify this request:\n\n"${query}"`),
    ];

    try {
        const result = await executeInference({
            env,
            messages,
            agentActionName: 'blueprint', // Use blueprint action config for now
            schema: ClassificationSchema,
            context: inferenceContext,
            stream: onStreamChunk ? {
                chunk_size: 64,
                onChunk: onStreamChunk,
            } : undefined,
        });

        const classification = result.object;

        logger.info('Request classified', {
            type: classification.type,
            reasoning: classification.reasoning,
        });

        return {
            type: classification.type as RequestType,
            response: classification.response,
            clarificationQuestion: classification.clarificationQuestion,
            enhancedQuery: classification.enhancedQuery,
            reasoning: classification.reasoning,
        };
    } catch (error) {
        logger.error('Classification failed, defaulting to build_clear', error);
        // On error, default to proceeding with build
        return {
            type: 'build_clear',
            enhancedQuery: query,
            reasoning: 'Classification failed, proceeding with build',
        };
    }
}

/**
 * Generate a conversational response without creating an agent
 */
export async function generateConversationalResponse(
    query: string,
    env: Env,
    inferenceContext: InferenceContext,
    logger: StructuredLogger,
    onStreamChunk: (chunk: string) => void
): Promise<string> {
    logger.info('Generating conversational response');

    const messages: Message[] = [
        createSystemMessage(`You are Orbit, a friendly and helpful coding assistant. 
You help users build web applications, but right now the user is just chatting or asking a question.
Respond naturally and helpfully. Keep responses concise but friendly.
If they seem interested in building something, offer to help them get started.`),
        createUserMessage(query),
    ];

    try {
        const result = await executeInference({
            env,
            messages,
            agentActionName: 'blueprint',
            schema: z.object({ response: z.string() }),
            context: inferenceContext,
            stream: {
                chunk_size: 64,
                onChunk: onStreamChunk,
            },
        });

        return result.object.response;
    } catch (error) {
        logger.error('Conversational response failed', error);
        return "Hi! I'm Orbit, your coding assistant. How can I help you today?";
    }
}
