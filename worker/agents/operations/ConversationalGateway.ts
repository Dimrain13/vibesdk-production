/**
 * ConversationalGateway - Pre-build conversation handler
 * 
 * This operation runs BEFORE the phasic blueprint generation.
 * It analyzes the user's request and determines if clarification is needed.
 * 
 * Flow:
 * 1. User sends request
 * 2. Gateway analyzes: Is this clear enough to build?
 * 3. If NO → Ask clarifying questions, return "needs_clarification"
 * 4. If YES → Return "ready_to_build" with enhanced query
 */

import { createSystemMessage, createUserMessage, Message } from '../inferutils/common';
import { AgentActionKey, InferenceContext } from '../inferutils/config.types';
import { StructuredLogger } from '../../logger';
import { executeInference } from '../inferutils/infer';
import z from 'zod';

export interface ConversationalGatewayInputs {
    query: string;
    projectType: string;
    onStreamChunk?: (chunk: string) => void;
}

export interface ConversationalGatewayOutputs {
    status: 'ready_to_build' | 'needs_clarification';
    enhancedQuery?: string;
    clarificationQuestion?: string;
}

const GatewayResponseSchema = z.object({
    decision: z.enum(['build', 'clarify']).describe('Whether to proceed with building or ask for clarification'),
    reasoning: z.string().describe('Brief explanation of your decision'),
    clarificationQuestion: z.string().optional().describe('If clarify: the question to ask the user'),
    enhancedQuery: z.string().optional().describe('If build: the enhanced/clarified version of the request'),
});

const GATEWAY_SYSTEM_PROMPT = `You are a request analyzer. Your job is to determine if a user's request is clear enough to build, or if clarification is needed first.

## Decision Criteria

**CLARIFY when:**
- Request is a new project with vague requirements (e.g., "build me an app", "create a website")
- Multiple valid interpretations exist
- Key details are missing (features, design style, data storage, etc.)
- User says something conversational like "hello", "hi", "what can you do"

**BUILD when:**
- Request is specific and actionable (e.g., "build a todo app with categories using React and local storage")
- Request is a modification to existing code (e.g., "fix the bug in header.tsx")
- Request already contains enough detail to proceed
- User is responding to a previous clarification question

## Response Format

If CLARIFY:
- Ask 2-4 focused questions
- Provide options when possible (a, b, c format)
- Keep it concise

If BUILD:
- Enhance the query with any implicit requirements
- Make it specific enough to generate a blueprint

## Examples

User: "build me an app"
Decision: clarify
Question: "I'd love to help! What kind of app would you like me to build?
1. What's the main purpose? (e.g., todo list, blog, dashboard, e-commerce)
2. Any specific features you need?
3. Design preference? (minimal, modern, colorful)"

User: "create a recipe sharing app with user accounts and the ability to save favorites"
Decision: build
Enhanced: "Build a recipe sharing application with: user authentication, recipe CRUD operations, favorites/bookmarking system, responsive design with React"

User: "hello"
Decision: clarify
Question: "Hi! I'm Orbit, your coding assistant. What would you like to build today?"`;

export async function runConversationalGateway(
    inputs: ConversationalGatewayInputs,
    env: Env,
    inferenceContext: InferenceContext,
    logger: StructuredLogger
): Promise<ConversationalGatewayOutputs> {
    const { query, projectType, onStreamChunk } = inputs;

    logger.info('Running conversational gateway', { 
        query: query.slice(0, 100),
        projectType 
    });

    const messages: Message[] = [
        createSystemMessage(GATEWAY_SYSTEM_PROMPT),
        createUserMessage(`Analyze this request and decide whether to BUILD or CLARIFY:

Project Type: ${projectType}
User Request: "${query}"

Respond with your decision.`),
    ];

    try {
        const response = await executeInference({
            env,
            messages,
            agentActionName: 'blueprint' as AgentActionKey, // Use blueprint action for config
            schema: GatewayResponseSchema,
            context: inferenceContext,
            stream: onStreamChunk ? {
                chunk_size: 64,
                onChunk: onStreamChunk,
            } : undefined,
        });

        const parsed = response.object;

        logger.info('Gateway decision', {
            decision: parsed.decision,
            reasoning: parsed.reasoning,
        });

        if (parsed.decision === 'clarify') {
            return {
                status: 'needs_clarification',
                clarificationQuestion: parsed.clarificationQuestion || 'Could you provide more details about what you want to build?',
            };
        } else {
            return {
                status: 'ready_to_build',
                enhancedQuery: parsed.enhancedQuery || query,
            };
        }
    } catch (error) {
        logger.error('Gateway analysis failed, defaulting to build', error);
        // On error, default to building with original query
        return {
            status: 'ready_to_build',
            enhancedQuery: query,
        };
    }
}
