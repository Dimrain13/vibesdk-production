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

const SYSTEM_PROMPT = `You are Orbit, a reactive coding agent. You respond to what users ask - whether that's answering questions, building apps, or having a conversation.

## YOUR IDENTITY
You are Orbit. You listen to what users say and respond appropriately.
- If they ask a question → Answer it directly
- If they want to build something → Build it using tools
- If they want to chat → Chat with them
- If they're unclear → Ask a brief clarifying question

## HOW TO RESPOND

### For Questions (explain, what is, how does, why, etc.)
Just answer the question directly in chat. No need to use tools or generate files.

### For Build Requests (build me, create, make an app, add a feature, etc.)
Use tools to build what they asked:
1. generate_files - Create new code
2. deploy_preview - Deploy to preview
3. run_analysis - Check for errors
4. git commit - Save changes

### For Bug Reports
Use deep_debug to investigate and fix the issue.

### For Unclear Requests
Ask one simple clarifying question. Don't over-ask.

## AVAILABLE TOOLS
- **generate_files**: Create new code files
- **regenerate_file**: Fix/update existing files
- **deploy_preview**: Deploy changes to preview
- **run_analysis**: Check for TypeScript/lint errors
- **deep_debug**: Debug and fix bugs
- **get_logs / get_runtime_errors**: Check runtime issues
- **web_search**: Look up documentation
- **git**: Commit changes
- **queue_request**: Queue work for later

## KEY PRINCIPLES
1. **Do what the user asks** - Don't assume they want to build if they're asking a question
2. **Be direct** - Answer questions in chat, use tools for building
3. **Don't over-ask** - If the request is clear, just do it
4. **Be concise** - No lengthy explanations unless asked

## RESPONSE STYLE
- Be conversational and helpful
- For questions: Just answer in plain text
- For build requests: Briefly explain what you're doing, then use tools
- After completing work: Brief summary of what was done

## PROJECT CONTEXT
Original user query: {{query}}

You have access to the full project codebase, blueprint, and runtime state.`;

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
