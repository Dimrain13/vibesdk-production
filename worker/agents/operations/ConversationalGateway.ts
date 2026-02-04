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
    status: 'ready_to_build' | 'needs_clarification' | 'conversational_answer';
    enhancedQuery?: string;
    clarificationQuestion?: string;
    conversationalAnswer?: string;
}

const GatewayResponseSchema = z.object({
    decision: z.enum(['build', 'clarify', 'answer']).describe('Whether to build, clarify, or answer conversationally'),
    reasoning: z.string().describe('Brief explanation of your decision'),
    clarificationQuestion: z.string().optional().describe('If clarify: the question to ask the user'),
    enhancedQuery: z.string().optional().describe('If build: the enhanced/clarified version of the request'),
    conversationalAnswer: z.string().optional().describe('If answer: the conversational response to the question'),
});

const GATEWAY_SYSTEM_PROMPT = `You are a request analyzer. Your job is to determine if a user's request needs building, clarification, or just a conversational answer.

## Decision Criteria

**ANSWER when:**
- User asks a question (what, why, how, when, where, which, who)
- User wants information or explanation
- User wants recommendations or suggestions
- User says "explain", "tell me about", "what is", "how does", etc.
- NO building or code generation is needed

**CLARIFY when:**
- Request is a new project with vague requirements (e.g., "build me an app", "create a website")
- Multiple valid interpretations exist for a BUILD request
- Key details are missing for building (features, design style, data storage, etc.)
- User says something conversational like "hello", "hi", "what can you do"

**BUILD when:**
- Request is specific and actionable (e.g., "build a todo app with categories using React and local storage")
- Request is a modification to existing code (e.g., "fix the bug in header.tsx")
- User clearly wants to create/modify code or files
- Request already contains enough detail to proceed
- User is responding to a previous clarification question

## Response Format

If ANSWER:
- Provide a helpful, conversational response
- No code generation or building needed

If CLARIFY:
- Ask 2-4 focused questions
- Provide options when possible (a, b, c format)
- Keep it concise

If BUILD:
- Enhance the query with any implicit requirements
- Make it specific enough to generate a blueprint

## Examples

User: "what are the best todo apps?"
Decision: answer
Answer: "Some popular todo apps include Todoist for its powerful features, Things for its beautiful design, and Microsoft To Do for its simplicity. What features are most important to you?"

User: "how does React work?"
Decision: answer
Answer: "React is a JavaScript library for building UIs. It uses components to break down interfaces into reusable pieces, and updates efficiently using a virtual DOM..."

User: "what can you do?"
Decision: clarify
Question: "Hi! I'm Orbit, your coding assistant. I can help you build apps, fix bugs, or answer questions. What would you like to do?"

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

        if (parsed.decision === 'answer') {
            return {
                status: 'conversational_answer',
                conversationalAnswer: parsed.conversationalAnswer || 'I can help you with that question.',
            };
        } else if (parsed.decision === 'clarify') {
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
