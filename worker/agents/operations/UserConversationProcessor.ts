import { ConversationalResponseType } from "../schemas";
import { createAssistantMessage, createUserMessage, createMultiModalUserMessage } from "../inferutils/common";
import { executeInference } from "../inferutils/infer";
import { WebSocketMessageResponses } from "../constants";
import { WebSocketMessageData } from "../../api/websocketTypes";
import { AgentOperation, OperationOptions, getSystemPromptWithProjectContext } from "../operations/common";
import { ConversationMessage } from "../inferutils/common";
import { StructuredLogger } from "../../logger";
import { IdGenerator } from '../utils/idGenerator';
// import { MAX_LLM_MESSAGES } from '../constants';
import { RateLimitExceededError, SecurityError } from 'shared/types/errors';
import { buildTools } from "../tools/customTools";
import { PROMPT_UTILS } from "../prompts";
import { RuntimeError } from "worker/services/sandbox/sandboxTypes";
import { CodeSerializerType } from "../utils/codeSerializers";
import { ConversationState } from "../inferutils/common";
import { imagesToBase64 } from "worker/utils/images";
import { ProcessedImageAttachment } from "worker/types/image-attachment";
import { AbortError, InferResponseString } from "../inferutils/core";
import { GenerationContext } from "../domain/values/GenerationContext";
import { compactifyContext } from "../utils/conversationCompactifier";
import { ChatCompletionMessageFunctionToolCall } from "openai/resources";
import { prepareMessagesForInference } from "../utils/common";

// Constants
const CHUNK_SIZE = 64;
export interface ToolCallStatusArgs {
    name: string;
    status: 'start' | 'success' | 'error';
    args?: Record<string, unknown>;
    result?: string;
}

export type RenderToolCall = ( args: ToolCallStatusArgs ) => void;

type ConversationResponseCallback = (
    message: string,
    conversationId: string,
    isStreaming: boolean,
    tool?: ToolCallStatusArgs
) => void;

export function buildToolCallRenderer(callback: ConversationResponseCallback, conversationId: string): RenderToolCall {
    return (args: ToolCallStatusArgs) => {
        callback('', conversationId, false, args);
    }
}

export interface UserConversationInputs {
    userMessage: string;
    conversationState: ConversationState;
    conversationResponseCallback: ConversationResponseCallback;
    errors: RuntimeError[];
    projectUpdates: string[];
    images?: ProcessedImageAttachment[];
}

export interface UserConversationOutputs {
    conversationResponse: ConversationalResponseType;
    conversationState: ConversationState;
}

const RelevantProjectUpdateWebsoketMessages = [
    WebSocketMessageResponses.PHASE_IMPLEMENTING,
    WebSocketMessageResponses.PHASE_IMPLEMENTED,
    WebSocketMessageResponses.CODE_REVIEW,
    WebSocketMessageResponses.FILE_REGENERATING,
    WebSocketMessageResponses.FILE_REGENERATED,
    WebSocketMessageResponses.DEPLOYMENT_COMPLETED,
    WebSocketMessageResponses.COMMAND_EXECUTING,
] as const;
export type ProjectUpdateType = typeof RelevantProjectUpdateWebsoketMessages[number];

const SYSTEM_PROMPT = `You are Orbit, a full-stack interactive coding agent. You think through problems systematically and help users build complete web applications.

## YOUR IDENTITY
You are Orbit. You approach every task with structured reasoning - understanding the problem deeply before acting.

## REASONING FRAMEWORK (Use this for EVERY request)

### 1. UNDERSTAND
- What is the user actually asking for?
- What are the explicit requirements?
- What might be implied but not stated?
- Are there ambiguities that need clarification?

### 2. ANALYZE  
- What's the current state? (existing code, files, project setup)
- What constraints exist?
- What patterns or conventions are already established?

### 3. PLAN
- What are the possible approaches?
- Which approach is best and WHY?
- What's the sequence of steps?
- What tools do I need?

### 4. CONSIDER
- What could go wrong?
- What assumptions am I making?
- Do I need to clarify anything with the user first?

### 5. ACT
- Share my reasoning with the user
- Execute the plan using appropriate tools
- Verify the results

## OUTPUT FORMAT

Structure your responses like this:

**Understanding**: [What I understood from your request]

**Analysis**: [What I see in the current state]

**Plan**: [What I'm going to do and why]

[Then execute with tools]

## CORE CAPABILITIES
- Build full-stack applications (React + TypeScript frontend, backend APIs)
- Debug and fix runtime errors, TypeScript issues, and logic bugs
- Implement features based on user requirements
- Search the web for current documentation and solutions
- Deploy and manage preview environments

## WHEN TO USE ask_human

**USE ask_human when:**
- New project request (ALWAYS clarify requirements first)
- Ambiguous request with multiple valid interpretations
- Need user preferences (design, features, tech choices)
- About to make a significant decision

**SKIP ask_human when:**
- Request is clear and specific
- User said "just build it" or "no questions"
- Simple fix or minor change
- Following up on already-clarified requirements
- **Don't over-engineer** - avoid adding error handling for scenarios that can't happen
- **Reuse existing code** - search for similar functionality before creating new
- **Follow existing patterns** - match the code style already in the project

### When to Skip Clarification
Only skip the clarification step if:
- User explicitly says "just build it" or "no questions, start immediately"
- It's a very simple, unambiguous request (e.g., "fix this typo")
- User is responding to your previous question with clear instructions

### Bug Fixing Protocol
When users report bugs:
1. **Reproduce first** - understand exactly what's failing
2. **Use deep_debug for immediate fixes** - it investigates, reads files, and applies surgical fixes
3. **Use queue_request for feature changes** - queues work for the next development phase
4. **Verify fixes work** - don't claim success without proof

## AVAILABLE TOOLS

### 🔴 PRIORITY TOOL - Use First!
- **ask_human**: Ask the user for clarification or input. USE THIS FIRST before starting any new project or when requirements are unclear. Keep questions concise (max 5) with bullet point options.

### Core Development Tools
- **queue_request**: Queue feature requests or bug fixes for the next phase. Use for any modification that isn't an urgent bug.
- **deep_debug**: Autonomous debugging agent for immediate bug investigation and fixes. Use when users report active bugs that need instant attention. Returns a transcript of all actions taken.
- **web_search**: Search the web for documentation, solutions, or current information.
- **deploy_preview**: Redeploy the preview environment after changes.
- **get_logs**: Fetch application logs to diagnose issues.

### Advanced Tools
- **testing_agent**: Automated testing for backend APIs and frontend functionality. Use after implementing features to verify they work, or when users report bugs needing systematic testing.
- **integration_playbook**: Get comprehensive guides for 3rd party API integrations (Stripe, OpenAI, Supabase, Firebase, Twilio, SendGrid, Google OAuth). Provides code examples, required keys, and setup steps.
- **design_agent**: UI/UX design expert that provides color palettes, typography, layout guidelines, and component recommendations based on app type.
- **troubleshoot_agent**: Deep root cause analysis (RCA) for persistent errors. Use after 2+ failed fix attempts or when error logs are unclear. Read-only investigation with actionable recommendations.
- **support_agent**: Platform help and capabilities questions. Use when users ask "what can you do", deployment questions, GitHub export, API keys, or limitations.
- **finish**: Use to summarize completed work and provide next steps.

### Project Management
- **git**: Version control (commit, log, show). Save work and view history.
- **rename_project**: Change the project name.
- **alter_blueprint**: Modify project requirements document.
- **feedback**: Submit platform feedback.

### Tool Usage Guidelines
- **ask_human FIRST**: For new projects or unclear requirements, ALWAYS use ask_human before proceeding
- **Parallel execution**: Call multiple independent tools simultaneously for efficiency
- **deep_debug**: Use for complex debugging scenarios requiring iterative investigation
- **testing_agent**: Use for comprehensive testing after implementations
- **After tool completion**: Don't repeat yourself - brief confirmation or synthesize results

## DEBUGGING DECISION TREE

**New project or feature request?**
→ First ask clarifying questions using \`ask_human\` tool
→ Wait for user confirmation before proceeding to blueprinting/coding

**User reports a bug?**
→ Is it actively breaking the app? → Use \`deep_debug\` for immediate fix
→ Is it a missing feature or enhancement? → Use \`queue_request\` for next phase

**deep_debug returns an error?**
→ GENERATION_IN_PROGRESS → Call \`wait_for_generation\`, then retry
→ DEBUG_IN_PROGRESS → Call \`wait_for_debug\`, then retry  
→ CALL_LIMIT_EXCEEDED → Ask user if they want to continue in next message

**After successful fix:**
→ Acknowledge what was fixed specifically
→ Don't say "remaining issues" if there are none
→ Offer to verify or continue if user wants

## RESPONSE STYLE

### Do:
- **Ask questions first** for new projects - use ask_human tool
- Be concise and direct - you're a developer, not a customer service bot
- Acknowledge requests briefly: "I'll add that" or "On it"
- Set expectations: "This will be ready in the next phase"
- Be honest about limitations
- Confirm understanding before major work

### Don't:
- Jump straight to blueprinting without asking about requirements
- Write lengthy explanations unless asked
- Repeat yourself after tool calls complete
- Promise timelines you can't guarantee
- Generate code snippets in chat (use tools instead)
- Assume you understand what the user wants without confirming

## SECURITY BOUNDARIES
- Cannot add or manage API keys for users directly in their account settings
- Cannot download the entire codebase (users can export to GitHub)
- Will not assist with malicious requests

## API INTEGRATION SUPPORT
When users provide API keys, endpoints, or integration details:
- Accept and use the provided API information to implement integrations
- Store API keys in environment variables or secure configuration
- Implement proper error handling for API calls
- Follow the provider's documentation for correct implementation
- Use the integration_playbook tool for guidance on common integrations

## TROUBLESHOOTING TIPS
- "Container not listening on port" → Preview still starting, ask user to wait/refresh
- Blank preview → May need a refresh, or check for build errors
- Persistent errors → Use deep_debug to investigate root cause

## PROJECT CONTEXT
Original user query: {{query}}

You have access to the full project codebase, blueprint, and runtime state. Use this context to provide informed responses and make accurate changes.`;

const FALLBACK_USER_RESPONSE = "I understand you'd like to make some changes to your project. I'll work on that in the next phase.";

const USER_PROMPT = `
<system_context>
## Timestamp:
{{timestamp}}

## Project runtime errors:
{{errors}}

## Project updates since last conversation:
{{projectUpdates}}
</system_context>
{{userMessage}}
`;


function buildUserMessageWithContext(userMessage: string, errors: RuntimeError[], projectUpdates: string[], forInference: boolean): string {
    let userPrompt = USER_PROMPT.replace("{{timestamp}}", new Date().toISOString()).replace("{{userMessage}}", userMessage)
    if (forInference) {
        if (projectUpdates && projectUpdates.length > 0) {
            userPrompt = userPrompt.replace("{{projectUpdates}}", projectUpdates.join("\n\n"));
        }
        return userPrompt.replace("{{errors}}", PROMPT_UTILS.serializeErrors(errors));
    } else {
        // To save tokens
        return userPrompt.replace("{{projectUpdates}}", "redacted").replace("{{errors}}", "redacted");
    }
}

export class UserConversationProcessor extends AgentOperation<GenerationContext, UserConversationInputs, UserConversationOutputs> {

    async execute(inputs: UserConversationInputs, options: OperationOptions<GenerationContext>): Promise<UserConversationOutputs> {
        const { env, logger, context, agent } = options;
        const { userMessage, conversationState, errors, images, projectUpdates } = inputs;
        logger.info("Processing user message", { 
            messageLength: inputs.userMessage.length,
            hasImages: !!images && images.length > 0,
            imageCount: images?.length || 0
        });

        try {
            const systemPromptMessages = getSystemPromptWithProjectContext(SYSTEM_PROMPT, context, CodeSerializerType.SIMPLE);
            
            // Create user message with optional images for inference
            const userPromptForInference = buildUserMessageWithContext(userMessage, errors, projectUpdates, true);
            const userMessageForInference = images && images.length > 0
                ? createMultiModalUserMessage(
                    userPromptForInference,
                    await imagesToBase64(env, images),
                    'high'
                )
                : createUserMessage(userPromptForInference);

            let extractedUserResponse = "";
            
            // Generate unique conversation ID for this turn
            const aiConversationId = IdGenerator.generateConversationId();

            logger.info("Generated conversation ID", { aiConversationId });

            const toolCallRenderer = buildToolCallRenderer(inputs.conversationResponseCallback, aiConversationId);

            // Assemble all tools with lifecycle callbacks for UI updates
            const tools = buildTools(
                agent,
                logger,
                toolCallRenderer,
                (chunk: string) => inputs.conversationResponseCallback(chunk, aiConversationId, true)
            ).map(td => ({
                ...td,
                onStart: (_tc: ChatCompletionMessageFunctionToolCall, args: Record<string, unknown>) => Promise.resolve(toolCallRenderer({ name: td.name, status: 'start', args })),
                onComplete: (_tc: ChatCompletionMessageFunctionToolCall, args: Record<string, unknown>, result: unknown) => Promise.resolve(toolCallRenderer({
                    name: td.name,
                    status: 'success',
                    args,
                    result: typeof result === 'string' ? result : JSON.stringify(result)
                }))
            }));

            const runningHistory = await prepareMessagesForInference(env, conversationState.runningHistory);

            const compactHistory = await compactifyContext(runningHistory, env, options, toolCallRenderer, logger);
            if (compactHistory.length !== runningHistory.length) {
                logger.info("Conversation history compactified", { 
                    fullHistoryLength: conversationState.fullHistory.length,
                    runningHistoryLength: conversationState.runningHistory.length,
                    compactifiedRunningHistoryLength: compactHistory.length,
                    reduction: conversationState.runningHistory.length - compactHistory.length
                });
            }

            const messagesForInference =  [...systemPromptMessages, ...compactHistory, {...userMessageForInference, conversationId: IdGenerator.generateConversationId()}];


            logger.info("Executing inference for user message", { 
                messageLength: userMessage.length,
                aiConversationId,
                tools,
            });
            
            // Don't save the system prompts so that every time new initial prompts can be generated with latest project context
            // Use inference message (with images) for AI, but store text-only in history
            let result : InferResponseString;
            try {
                result = await executeInference({
                    env: env,
                    messages: messagesForInference,
                    agentActionName: "conversationalResponse",
                    context: options.inferenceContext,
                    tools, // Enable tools for the conversational AI
                    stream: {
                        onChunk: (chunk) => {
                            logger.info("Processing user message chunk", { chunkLength: chunk.length, aiConversationId });
                            inputs.conversationResponseCallback(chunk, aiConversationId, true);
                            extractedUserResponse += chunk;
                        },
                        chunk_size: CHUNK_SIZE
                    }
                });
            } catch (error) {
                if (error instanceof AbortError) {
                    logger.info("User message processing aborted", { aiConversationId, partialResponse: error.partialResponse() });
                    result = error.partialResponse();
                } else {
                    throw error;
                }
            }
            
            logger.info("Successfully processed user message", {
                streamingSuccess: !!extractedUserResponse,
            });

            const conversationResponse: ConversationalResponseType = {
                userResponse: extractedUserResponse
            };

            
            // For conversation history, store only text (images are ephemeral and not persisted)
            const userPromptForHistory = buildUserMessageWithContext(userMessage, errors, projectUpdates, false);
            const userMessageForHistory = images && images.length > 0
                ? createMultiModalUserMessage(
                    userPromptForHistory,
                    images.map(img => img.r2Key),
                    'high'
                )
                : createUserMessage(userPromptForHistory);

            
            const messages = [{...userMessageForHistory, conversationId: IdGenerator.generateConversationId()}];

            // Save the assistant's response to conversation history
            // If tools were called, include the tool call messages from toolCallContext
            if (result.toolCallContext?.messages && result.toolCallContext.messages.length > 0) {
                messages.push(
                    ...result.toolCallContext.messages
                        .map((message) => ({ ...message, conversationId: IdGenerator.generateConversationId() }))
                );
            }
            
            // Check if final response is duplicate of last assistant message in tool context
            const finalResponse = createAssistantMessage(result.string);
            const lastToolContextMessage = result.toolCallContext?.messages?.[result.toolCallContext.messages.length - 1];
            const isDuplicate = lastToolContextMessage?.role === 'assistant' && 
                               lastToolContextMessage?.content === finalResponse.content;
            
            if (!isDuplicate) {
                messages.push({...finalResponse, conversationId: IdGenerator.generateConversationId()});
                logger.info("Added final assistant response to history");
            } else {
                logger.info("Skipped duplicate final assistant response");
            }

            // Derive compacted running history for storage using stable IDs (no re-compaction)
            const originalRunning = conversationState.runningHistory;
            let storageRunning = originalRunning;
            if (compactHistory.length !== runningHistory.length) {
                const summaryMessage = compactHistory[0]; // assistant text-only summary
                const originalById = new Map(originalRunning.map(m => [m.conversationId, m] as const));
                const preservedTail = compactHistory
                    .slice(1)
                    .map(m => originalById.get(m.conversationId))
                    .filter((m): m is ConversationMessage => !!m);
                storageRunning = [summaryMessage, ...preservedTail];
            }

            return {
                conversationResponse,
                conversationState: {
                    ...conversationState,
                    runningHistory: [...storageRunning, ...messages],
                    fullHistory: [...conversationState.fullHistory, ...messages]
                }
            };
        } catch (error) {
            logger.error("Error processing user message:", error);
            if (error instanceof RateLimitExceededError || error instanceof SecurityError) {
                throw error;
            }   

            const fallbackMessages = [
                {...createUserMessage(userMessage), conversationId: IdGenerator.generateConversationId()},
                {...createAssistantMessage(FALLBACK_USER_RESPONSE), conversationId: IdGenerator.generateConversationId()}
            ]
            
            // Fallback response
            return {
                conversationResponse: {
                    userResponse: FALLBACK_USER_RESPONSE
                },
                conversationState: {
                    ...conversationState,
                    runningHistory: [...conversationState.runningHistory, ...fallbackMessages],
                    fullHistory: [...conversationState.fullHistory, ...fallbackMessages]
                }
            };
        }
    }

    processProjectUpdates<T extends ProjectUpdateType>(updateType: T, _data: WebSocketMessageData<T>, logger: StructuredLogger) : ConversationMessage[] {
        try {
            logger.info("Processing project update", { updateType });

            // Just save it as an assistant message. Dont save data for now to avoid DO size issues
            const preparedMessage = `**<Internal Memo>**
Project Updates: ${updateType}
</Internal Memo>`;

            return [{
                role: 'assistant',
                content: preparedMessage,
                conversationId: IdGenerator.generateConversationId()
            }];
        } catch (error) {
            logger.error("Error processing project update:", error);
            return [];
        }
    }

    isProjectUpdateType(type: unknown): type is ProjectUpdateType {
        return RelevantProjectUpdateWebsoketMessages.includes(type as ProjectUpdateType);
    }
}
