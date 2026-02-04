import { 
    PhaseConceptGenerationSchemaType, 
    PhaseConceptType,
    FileOutputType,
    PhaseImplementationSchemaType,
} from '../../schemas';
import { StaticAnalysisResponse } from '../../../services/sandbox/sandboxTypes';
import { CurrentDevState, MAX_PHASES, PhasicState, FileState } from '../state';
import { AllIssues, AgentInitArgs, PhaseExecutionResult, UserContext } from '../types';
import { WebSocketMessageResponses } from '../../constants';
import { UserConversationProcessor } from '../../operations/UserConversationProcessor';
import { GenerationContext, PhasicGenerationContext } from '../../domain/values/GenerationContext';
import { IssueReport } from '../../domain/values/IssueReport';
import { PhaseImplementationOperation } from '../../operations/PhaseImplementation';
import { FileRegenerationOperation } from '../../operations/FileRegeneration';
import { PhaseGenerationOperation } from '../../operations/PhaseGeneration';
import { FastCodeFixerOperation } from '../../operations/PostPhaseCodeFixer';
import { customizePackageJson, customizeTemplateFiles, generateProjectName } from '../../utils/templateCustomizer';
import { generateBlueprint } from '../../planning/blueprint';
import { RateLimitExceededError } from 'shared/types/errors';
import {  ImageAttachment, type ProcessedImageAttachment } from '../../../types/image-attachment';
import { OperationOptions } from '../../operations/common';
import { ConversationMessage } from '../../inferutils/common';
import { generateNanoId } from 'worker/utils/idGenerator';
import { IdGenerator } from '../../utils/idGenerator';
import { BaseCodingBehavior, BaseCodingOperations } from './base';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { SimpleCodeGenerationOperation } from '../../operations/SimpleCodeGeneration';
import { StateMigration } from '../stateMigration';
import { runPreDeploySafetyGate } from '../../utils/preDeploySafetyGate';
import { runConversationalGateway } from '../../operations/ConversationalGateway';

interface PhasicOperations extends BaseCodingOperations {
    generateNextPhase: PhaseGenerationOperation;
    implementPhase: PhaseImplementationOperation;
}

/**
 * PhasicCodingBehavior - Deterministically orchestrated agent
 * 
 * Manages the lifecycle of code generation including:
 * - Blueprint, phase generation, phase implementation, review cycles orchestrations
 * - File streaming with WebSocket updates
 * - Code validation and error correction
 * - Deployment to sandbox service
 */
export class PhasicCodingBehavior extends BaseCodingBehavior<PhasicState> implements ICodingAgent {
    protected static readonly PROJECT_NAME_PREFIX_MAX_LENGTH = 20;
    
    // Store pending init args when awaiting user clarification
    protected pendingInitArgs: AgentInitArgs<PhasicState> | null = null;
    
    protected operations: PhasicOperations = {
        regenerateFile: new FileRegenerationOperation(),
        fastCodeFixer: new FastCodeFixerOperation(),
        processUserMessage: new UserConversationProcessor(),
        simpleGenerateFiles: new SimpleCodeGenerationOperation(),
        generateNextPhase: new PhaseGenerationOperation(),
        implementPhase: new PhaseImplementationOperation(),
    };

    /**
     * Initialize the code generator with project blueprint and template
     * Sets up services and begins deployment process
     * 
     * Flow:
     * 1. Run conversational gateway to check if clarification needed
     * 2. If clarification needed → stream question, set awaitingClarification flag, return early
     * 3. If ready to build → proceed with blueprint generation
     */
    async initialize(
        initArgs: AgentInitArgs<PhasicState>,
        ..._args: unknown[]
    ): Promise<PhasicState> {
        await super.initialize(initArgs);
        const { templateInfo } = initArgs;
        if (!templateInfo || !templateInfo.templateDetails) {
            throw new Error('Phasic initialization requires templateInfo.templateDetails');
        }
        let { query, language: _language, frameworks, hostname, inferenceContext, sandboxSessionId } = initArgs;
        
        // ============================================
        // STEP 1: Run Conversational Gateway
        // ============================================
        this.logger.info('Running conversational gateway', { query: query.slice(0, 100) });
        
        const gatewayResult = await runConversationalGateway(
            {
                query,
                projectType: this.projectType,
                onStreamChunk: (chunk: string) => {
                    initArgs.onBlueprintChunk(chunk);
                },
            },
            this.env,
            inferenceContext,
            this.logger
        );
        
        if (gatewayResult.status === 'conversational_answer') {
            // Just answer the question - no building needed
            this.logger.info('Gateway decided to answer conversationally, not building');
            
            // Stream the answer to the user
            initArgs.onBlueprintChunk('\n\n' + gatewayResult.conversationalAnswer + '\n\n');
            
            // Set up minimal state without building
            const packageJson = templateInfo.templateDetails.allFiles['package.json'];
            const projectName = generateProjectName(
                'answered-question',
                generateNanoId(),
                PhasicCodingBehavior.PROJECT_NAME_PREFIX_MAX_LENGTH
            );
            
            const answeredState: PhasicState = {
                ...this.state,
                projectName,
                query,
                blueprint: {} as any, // Empty - no building needed
                templateName: templateInfo.templateDetails.name,
                sandboxInstanceId: undefined,
                generatedPhases: [],
                commandsHistory: [],
                lastPackageJson: packageJson,
                sessionId: sandboxSessionId!,
                hostname,
                metadata: inferenceContext.metadata,
                projectType: this.projectType,
                behaviorType: 'phasic',
                awaitingClarification: false,
            };
            this.setState(answeredState);
            
            this.logger.info('Agent answered question conversationally, no build triggered');
            return this.state;
        }
        
        if (gatewayResult.status === 'needs_clarification') {
            // Stream the clarification question to the user
            this.logger.info('Gateway requires clarification, streaming question');
            
            // Stream the question
            initArgs.onBlueprintChunk('\n\n' + gatewayResult.clarificationQuestion + '\n\n');
            
            // Set up minimal state - user will respond via WebSocket
            const packageJson = templateInfo.templateDetails.allFiles['package.json'];
            const projectName = generateProjectName(
                'project',
                generateNanoId(),
                PhasicCodingBehavior.PROJECT_NAME_PREFIX_MAX_LENGTH
            );
            
            const awaitingState: PhasicState = {
                ...this.state,
                projectName,
                query,
                blueprint: {} as any, // Empty - will be generated after user responds
                templateName: templateInfo.templateDetails.name,
                sandboxInstanceId: undefined,
                generatedPhases: [],
                commandsHistory: [],
                lastPackageJson: packageJson,
                sessionId: sandboxSessionId!,
                hostname,
                metadata: inferenceContext.metadata,
                projectType: this.projectType,
                behaviorType: 'phasic',
                awaitingClarification: true, // Flag to indicate we're waiting for user response
            };
            this.setState(awaitingState);
            
            // Store the init args for later use when user responds
            this.pendingInitArgs = initArgs;
            
            this.logger.info('Agent awaiting user clarification');
            return this.state;
        }
        
        // Gateway approved - use enhanced query if provided
        if (gatewayResult.enhancedQuery) {
            query = gatewayResult.enhancedQuery;
            this.logger.info('Using enhanced query from gateway', { enhancedQuery: query.slice(0, 100) });
        }
        
        // ============================================
        // STEP 2: DIRECT GENERATION (Simple Mode - No Blueprint)
        // ============================================
        // Skip blueprint and phases - go straight to building!
        // This is 62% more token efficient and matches emergent.sh style
        this.logger.info('Using SIMPLE mode - direct generation without blueprint', { 
            query: query.slice(0, 100),
            queryLength: query.length, 
            imagesCount: initArgs.images?.length || 0 
        });
        
        // Prepare template context for direct generation
        const packageJson = templateInfo.templateDetails.allFiles['package.json'];
        const projectName = generateProjectName(
            'app',
            generateNanoId(),
            PhasicCodingBehavior.PROJECT_NAME_PREFIX_MAX_LENGTH
        );
        
        this.logger.info('Generated project name', { projectName });
        
        // Initialize state FIRST (needed for getOperationOptions to work)
        const nextState: PhasicState = {
            ...this.state,
            projectName,
            query,
            blueprint: {
                projectName: projectName,
                description: query,
                features: [query], // Simple: just use the query as a single feature
                techStack: {
                    frontend: frameworks || [],
                    backend: [],
                    database: [],
                    other: []
                },
                dependencies: [],
                devDependencies: [],
                projectStructure: {},
                phases: [] // No phases in simple mode
            } as any,
            templateName: templateInfo.templateDetails.name,
            sandboxInstanceId: undefined,
            generatedPhases: [],
            commandsHistory: [],
            lastPackageJson: packageJson,
            sessionId: sandboxSessionId!,
            hostname,
            metadata: inferenceContext.metadata,
            projectType: this.projectType,
            behaviorType: 'phasic',
        };
        
        this.setState(nextState);
        
        // Broadcast that we're starting generation (no real blueprint, but satisfy interface)
        this.broadcast(WebSocketMessageResponses.BLUEPRINT_GENERATED, {
            blueprint: nextState.blueprint,
        });
        
        // NOW we can call getOperationOptions() since state is set up
        this.logger.info('Starting direct file generation');
        const operationOptions = this.getOperationOptions();
        
        // Generate files directly using SimpleCodeGeneration
        const generationResult = await this.operations.simpleGenerateFiles.execute({
            phaseName: 'Complete Application',
            phaseDescription: query,
            requirements: [query],
            files: [], // SimpleCodeGeneration will determine what files to create
            fileGeneratingCallback: (filePath: string, filePurpose: string) => {
                this.broadcast(WebSocketMessageResponses.FILE_GENERATING, {
                    filepath: filePath,
                    filePurpose: filePurpose,
                });
            },
            fileChunkGeneratedCallback: (filePath: string, chunk: string, format: 'full_content' | 'unified_diff') => {
                this.broadcast(WebSocketMessageResponses.FILE_GENERATED, {
                    filepath: filePath,
                    fileContent: chunk,
                    contentType: format,
                });
            },
            fileClosedCallback: (file, message) => {
                this.broadcast(WebSocketMessageResponses.FILE_CLOSED, {
                    filepath: file.filePath,
                    message: message,
                });
            },
        }, operationOptions);
        
        // Store generated files in state (using generatedFilesMap)
        const fileStateMap: Record<string, FileState> = {};
        for (const file of generationResult.files) {
            fileStateMap[file.filePath] = {
                ...file, // filePath, fileContents, filePurpose
                lastDiff: '', // Initialize lastDiff for FileState
            };
        }
        
        this.setState({
            ...this.state,
            generatedFilesMap: fileStateMap,
        });
        
        this.logger.info('Direct generation complete', { 
            filesGenerated: generationResult.files.length 
        });
        
        // Customize template files (package.json, wrangler.jsonc, .bootstrap.js, .gitignore)
        const customizedFiles = customizeTemplateFiles(
            templateInfo.templateDetails.allFiles,
            {
                projectName,
                commandsHistory: []
            }
        );
        
        this.logger.info('Customized template files', { 
            files: Object.keys(customizedFiles) 
        });
        
        // Save customized files to git
        const filesToSave = Object.entries(customizedFiles).map(([filePath, content]) => ({
            filePath,
            fileContents: content,
            filePurpose: 'Project configuration file'
        }));
        
        await this.fileManager.saveGeneratedFiles(
            filesToSave,
            'Initialize project configuration files',
            true
        );
        
        this.logger.info('Committed customized template files to git');
        
        // Deploy the generated files to sandbox
        await this.deployToSandbox(generationResult.files, true, 'Initial application generation');
        
        // SIMPLE MODE: No phases, no state machine - files are already generated and deployed!
        // In the old phasic flow, we would call initializeAsync() here to start phase generation
        // But in simple mode, we're done - the app is built!
        
        this.logger.info(`Agent ${this.getAgentId()} session: ${this.state.sessionId} initialized successfully - SIMPLE MODE (direct generation complete)`);
        return this.state;
    }

    async onStart(props?: Record<string, unknown> | undefined): Promise<void> {
        await super.onStart(props);
    }

    migrateStateIfNeeded(): void {
        const migratedState = StateMigration.migratePhasic(this.state, this.logger) as PhasicState | null;
        if (migratedState) {
            this.setState(migratedState);
        }

        // migrate overwritten package.jsons
        const oldPackageJson = this.fileManager.getFile('package.json')?.fileContents || this.state.lastPackageJson;
        if (oldPackageJson) {
            const packageJson = customizePackageJson(oldPackageJson, this.state.projectName);
            this.fileManager.saveGeneratedFiles([
                {
                    filePath: 'package.json',
                    fileContents: packageJson,
                    filePurpose: 'Project configuration file'
                }
            ], 'chore: fix overwritten package.json', true);
        }
    }

    rechargePhasesCounter(max_phases: number = MAX_PHASES): void {
        if (this.getPhasesCounter() <= max_phases) {
            this.setState({
                ...this.state,
                phasesCounter: max_phases
            });
        }
    }

    decrementPhasesCounter(): number {
        const counter = this.getPhasesCounter() - 1;
        this.setState({
            ...this.state,
            phasesCounter: counter
        });
        return counter;
    }

    getPhasesCounter(): number {
        return this.state.phasesCounter;
    }

    getOperationOptions(): OperationOptions<PhasicGenerationContext> {
        const context = GenerationContext.from(this.state, this.getTemplateDetails(), this.logger);
        if (!GenerationContext.isPhasic(context)) {
            throw new Error('Expected PhasicGenerationContext');
        }
        return {
            env: this.env,
            agentId: this.getAgentId(),
            context,
            logger: this.logger,
            inferenceContext: this.getInferenceContext(),
            agent: this
        };
    }

    private createNewIncompletePhase(phaseConcept: PhaseConceptType) {
        this.setState({
            ...this.state,
            generatedPhases: [...this.state.generatedPhases, {
                ...phaseConcept,
                completed: false
            }]
        })

        this.logger.info("Created new incomplete phase:", JSON.stringify(this.state.generatedPhases, null, 2));
    }

    private markPhaseComplete(phaseName: string) {
        // First find the phase
        const phases = this.state.generatedPhases;
        if (!phases.some(p => p.name === phaseName)) {
            this.logger.warn(`Phase ${phaseName} not found in generatedPhases array, skipping save`);
            return;
        }
        
        // Update the phase
        this.setState({
            ...this.state,
            generatedPhases: phases.map(p => p.name === phaseName ? { ...p, completed: true } : p)
        });

        this.logger.info("Completed phases:", JSON.stringify(phases, null, 2));
    }

    async queueUserRequest(request: string, images?: ProcessedImageAttachment[]): Promise<void> {
        this.rechargePhasesCounter(3);
        await super.queueUserRequest(request, images);
    }

    async build(): Promise<void> {
        await this.launchStateMachine();
    }

    private async launchStateMachine() {
        this.logger.info("Launching state machine");

        let currentDevState = CurrentDevState.PHASE_IMPLEMENTING;
        const generatedPhases = this.state.generatedPhases;
        const incompletedPhases = generatedPhases.filter(phase => !phase.completed);
        let phaseConcept : PhaseConceptType | undefined;
        if (incompletedPhases.length > 0) {
            phaseConcept = incompletedPhases[incompletedPhases.length - 1];
            this.logger.info('Resuming code generation from incompleted phase', {
                phase: phaseConcept
            });
        } else if (generatedPhases.length > 0) {
            currentDevState = CurrentDevState.PHASE_GENERATING;
            this.logger.info('Resuming code generation after generating all phases', {
                phase: generatedPhases[generatedPhases.length - 1]
            });
        } else {
            phaseConcept = this.state.blueprint.initialPhase;
            this.logger.info('Starting code generation from initial phase', {
                phase: phaseConcept
            });
            this.createNewIncompletePhase(phaseConcept);
        }

        let userContext: UserContext | undefined;

        try {
            let executionResults: PhaseExecutionResult;
            // State machine loop - continues until IDLE state
            while (currentDevState !== CurrentDevState.IDLE) {
                this.logger.info(`[generateAllFiles] Executing state: ${currentDevState}`);
                switch (currentDevState) {
                    case CurrentDevState.PHASE_GENERATING:
                        executionResults = await this.executePhaseGeneration();
                        currentDevState = executionResults.currentDevState;
                        phaseConcept = executionResults.result;
                        userContext = executionResults.userContext;
                        break;
                    case CurrentDevState.PHASE_IMPLEMENTING:
                        executionResults = await this.executePhaseImplementation(phaseConcept, userContext);
                        currentDevState = executionResults.currentDevState;
                        userContext = undefined;
                        break;
                    case CurrentDevState.REVIEWING:
                        currentDevState = await this.executeReviewCycle();
                        break;
                    case CurrentDevState.FINALIZING:
                        currentDevState = await this.executeFinalizing();
                        break;
                    default:
                        break;
                }
            }

            this.logger.info("State machine completed successfully");
        } catch (error) {
            this.logger.error("Error in state machine:", error);
        }
    }

    /**
     * Execute phase generation state - generate next phase with user suggestions
     */
    async executePhaseGeneration(isFinal?: boolean): Promise<PhaseExecutionResult> {
        this.logger.info("Executing PHASE_GENERATING state");
        try {
            const currentIssues = await this.fetchAllIssues();
            
            // Generate next phase with user suggestions if available
            
            // Get stored images if user suggestions are present
            const pendingUserInputs = this.fetchPendingUserRequests();
            const userContext = (pendingUserInputs.length > 0) 
                ? {
                    suggestions: pendingUserInputs,
                    images: this.pendingUserImages
                } as UserContext
                : undefined;

            if (userContext && userContext?.suggestions && userContext.suggestions.length > 0) {
                // Only reset pending user inputs if user suggestions were read
                this.logger.info("Resetting pending user inputs", { 
                    userSuggestions: userContext.suggestions,
                    hasImages: !!userContext.images,
                    imageCount: userContext.images?.length || 0
                });
                
                // Clear images after they're passed to phase generation
                if (userContext?.images && userContext.images.length > 0) {
                    this.logger.info('Clearing stored user images after passing to phase generation');
                    this.pendingUserImages = [];
                }
            }
            
            const nextPhase = await this.generateNextPhase(currentIssues, userContext, isFinal);
                
            if (!nextPhase) {
                this.logger.info("No more phases to implement, transitioning to FINALIZING");
                return {
                    currentDevState: CurrentDevState.FINALIZING,
                };
            }
    
            // Store current phase and transition to implementation
            this.setState({
                ...this.state,
                currentPhase: nextPhase
            });
            
            return {
                currentDevState: CurrentDevState.PHASE_IMPLEMENTING,
                result: nextPhase,
                userContext: userContext,
            };
        } catch (error) {
            if (error instanceof RateLimitExceededError) {
                throw error;
            }
            this.broadcastError("Error generating phase", error);
            return {
                currentDevState: CurrentDevState.IDLE,
            };
        }
    }

    /**
     * Execute phase implementation state - implement current phase
     */
    async executePhaseImplementation(phaseConcept?: PhaseConceptType, userContext?: UserContext): Promise<{currentDevState: CurrentDevState, staticAnalysis?: StaticAnalysisResponse}> {
        try {
            this.logger.info("Executing PHASE_IMPLEMENTING state");
    
            if (phaseConcept === undefined) {
                phaseConcept = this.state.currentPhase;
                if (phaseConcept === undefined) {
                    this.logger.error("No phase concept provided to implement, will call phase generation");
                    const results = await this.executePhaseGeneration();
                    phaseConcept = results.result;
                    if (phaseConcept === undefined) {
                        this.logger.error("No phase concept provided to implement, will return");
                        return {currentDevState: CurrentDevState.FINALIZING};
                    }
                }
            }
    
            this.setState({
                ...this.state,
                currentPhase: undefined // reset current phase
            });
            
            // Prepare issues for implementation
            const currentIssues = await this.fetchAllIssues(true);
            
            // Implement the phase with user context (suggestions and images)
            await this.implementPhase(phaseConcept, currentIssues, userContext);
    
            this.logger.info(`Phase ${phaseConcept.name} completed, generating next phase`);

            const phasesCounter = this.decrementPhasesCounter();

            if ((phaseConcept.lastPhase || phasesCounter <= 0) && this.state.pendingUserInputs.length === 0) return {currentDevState: CurrentDevState.FINALIZING};
            return {currentDevState: CurrentDevState.PHASE_GENERATING};
        } catch (error) {
            this.logger.error("Error implementing phase", error);
            if (error instanceof RateLimitExceededError) {
                throw error;
            }
            return {currentDevState: CurrentDevState.IDLE};
        }
    }

    /**
     * Execute review cycle state - review and cleanup
     */
    async executeReviewCycle(): Promise<CurrentDevState> {
        this.logger.info("Executing REVIEWING state - review and cleanup");
        if (this.state.reviewingInitiated) {
            this.logger.info("Reviewing already initiated, skipping");
            return CurrentDevState.IDLE;
        }
        this.setState({
            ...this.state,
            reviewingInitiated: true
        });

        // If issues/errors found, prompt user if they want to review and cleanup
        const issues = await this.fetchAllIssues(false);
        if (issues.runtimeErrors.length > 0 || issues.staticAnalysis.typecheck.issues.length > 0) {
            this.logger.info("Reviewing stage - issues found, prompting user to review and cleanup");
            const message : ConversationMessage = {
                role: "assistant",
                content: `<system_context>If the user responds with yes, launch the 'deep_debug' tool with the prompt to fix all the issues in the app</system_context>\nThere might be some bugs in the app. Do you want me to try to fix them?`,
                conversationId: IdGenerator.generateConversationId(),
            }
            // Store the message in the conversation history so user's response can trigger the deep debug tool
            this.infrastructure.addConversationMessage(message);
            
            this.broadcast(WebSocketMessageResponses.CONVERSATION_RESPONSE, {
                message: message.content,
                conversationId: message.conversationId,
                isStreaming: false,
            });
        }

        return CurrentDevState.IDLE;
    }

    /**
     * Execute finalizing state - final review and cleanup (runs only once)
     */
    async executeFinalizing(): Promise<CurrentDevState> {
        this.logger.info("Executing FINALIZING state - final review and cleanup");

        if (this.setMVPGenerated()) {
            this.logger.info("Finalizing stage already done");
            return CurrentDevState.REVIEWING;
        }

        const { result: phaseConcept, userContext } = await this.executePhaseGeneration(true);
        if (!phaseConcept) {
            this.logger.warn("Phase concept not generated, skipping final review");
            return CurrentDevState.REVIEWING;
        }
        
        await this.executePhaseImplementation(phaseConcept, userContext);

        const numFilesGenerated = this.fileManager.getGeneratedFilePaths().length;
        this.logger.info(`Finalization complete. Generated ${numFilesGenerated}/${this.getTotalFiles()} files.`);

        // Transition to IDLE - generation complete
        return CurrentDevState.REVIEWING;
    }

    /**
     * Generate next phase with user context (suggestions and images)
     */
    async generateNextPhase(currentIssues: AllIssues, userContext?: UserContext, isFinal?: boolean): Promise<PhaseConceptGenerationSchemaType | undefined> {
        const issues = IssueReport.from(currentIssues);
        
        // Build notification message
        let notificationMsg = "Generating next phase";
        if (isFinal) {
            notificationMsg = "Generating final phase";
        }
        if (userContext?.suggestions && userContext.suggestions.length > 0) {
            notificationMsg = `Generating next phase incorporating ${userContext.suggestions.length} user suggestion(s)`;
        }
        if (userContext?.images && userContext.images.length > 0) {
            notificationMsg += ` with ${userContext.images.length} image(s)`;
        }
        
        // Notify phase generation start
        this.broadcast(WebSocketMessageResponses.PHASE_GENERATING, {
            message: notificationMsg,
            issues: issues,
            userSuggestions: userContext?.suggestions,
        });
        
        const result = await this.operations.generateNextPhase.execute(
            {
                issues,
                userContext,
                isUserSuggestedPhase: userContext?.suggestions && userContext.suggestions.length > 0 && this.state.mvpGenerated,
                isFinal: isFinal ?? false,
            },
            this.getOperationOptions()
        )
        // Execute install commands if any
        if (result.installCommands && result.installCommands.length > 0) {
            this.executeCommands(result.installCommands);
        }

        // Execute delete commands if any
        const filesToDelete = result.files.filter(f => f.changes?.toLowerCase().trim() === 'delete');
        if (filesToDelete.length > 0) {
            this.logger.info(`Deleting ${filesToDelete.length} files: ${filesToDelete.map(f => f.path).join(", ")}`);
            this.deleteFiles(filesToDelete.map(f => f.path));
        }
        
        if (result.files.length === 0) {
            this.logger.info("No files generated for next phase");
            // Notify phase generation complete
            this.broadcast(WebSocketMessageResponses.PHASE_GENERATED, {
                message: `No files generated for next phase`,
                phase: undefined
            });
            return undefined;
        }
        
        this.createNewIncompletePhase(result);
        // Notify phase generation complete
        this.broadcast(WebSocketMessageResponses.PHASE_GENERATED, {
            message: `Generated next phase: ${result.name}`,
            phase: result
        });

        return result;
    }

    /**
     * Implement a single phase of code generation
     * Streams file generation with real-time updates and incorporates technical instructions
     */
    async implementPhase(phase: PhaseConceptType, currentIssues: AllIssues, userContext?: UserContext, streamChunks: boolean = true, postPhaseFixing: boolean = true): Promise<PhaseImplementationSchemaType> {
        const issues = IssueReport.from(currentIssues);
        
        const implementationMsg = userContext?.suggestions && userContext.suggestions.length > 0
            ? `Implementing phase: ${phase.name} with ${userContext.suggestions.length} user suggestion(s)`
            : `Implementing phase: ${phase.name}`;
        const msgWithImages = userContext?.images && userContext.images.length > 0
            ? `${implementationMsg} and ${userContext.images.length} image(s)`
            : implementationMsg;
            
        this.broadcast(WebSocketMessageResponses.PHASE_IMPLEMENTING, {
            message: msgWithImages,
            phase: phase,
            issues: issues,
        });
            
        
        const result = await this.operations.implementPhase.execute(
            {
                phase, 
                issues, 
                isFirstPhase: this.state.generatedPhases.filter(p => p.completed).length === 0,
                fileGeneratingCallback: (filePath: string, filePurpose: string) => {
                    this.broadcast(WebSocketMessageResponses.FILE_GENERATING, {
                        message: `Generating file: ${filePath}`,
                        filePath: filePath,
                        filePurpose: filePurpose
                    });
                },
                userContext,
                shouldAutoFix: this.getInferenceContext().enableRealtimeCodeFix,
                fileChunkGeneratedCallback: streamChunks ? (filePath: string, chunk: string, format: 'full_content' | 'unified_diff') => {
                    this.broadcast(WebSocketMessageResponses.FILE_CHUNK_GENERATED, {
                        message: `Generating file: ${filePath}`,
                        filePath: filePath,
                        chunk,
                        format,
                    });
                } : (_filePath: string, _chunk: string, _format: 'full_content' | 'unified_diff') => {},
                fileClosedCallback: (file: FileOutputType, message: string) => {
                    this.broadcast(WebSocketMessageResponses.FILE_GENERATED, {
                        message,
                        file,
                    });
                }
            },
            this.getOperationOptions()
        );
        
        this.broadcast(WebSocketMessageResponses.PHASE_VALIDATING, {
            message: `Validating files for phase: ${phase.name}`,
            phase: phase,
        });

        // Await the already-created realtime code fixer promises
        const finalFiles = await Promise.allSettled(result.fixedFilePromises).then((results: PromiseSettledResult<FileOutputType>[]) => {
            return results.map((result) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return null;
                }
            }).filter((f): f is FileOutputType => f !== null);
        });
    
        const templateDetails = this.getTemplateDetails();
        const safeFiles = templateDetails
            ? await runPreDeploySafetyGate({
                  files: finalFiles,
                  env: this.env,
                  inferenceContext: this.getInferenceContext(),
                  query: this.state.query,
                  template: templateDetails,
                  phase,
              })
            : finalFiles;

        await this.fileManager.saveGeneratedFiles(safeFiles, `feat: ${phase.name}\n\n${phase.description}`);

        this.logger.info("Files generated for phase:", phase.name, safeFiles.map(f => f.filePath));

        if (result.commands && result.commands.length > 0) {
            this.logger.info("Phase implementation suggested install commands:", result.commands);
            await this.executeCommands(result.commands, false);
        }

        if (safeFiles.length > 0) {
            await this.deployToSandbox(safeFiles, false, phase.name, true);
            if (postPhaseFixing) {
                await this.applyDeterministicCodeFixes();
                if (this.getInferenceContext().enableFastSmartCodeFix) {
                    await this.applyFastSmartCodeFixes();
                }
            }
        }

        // Validation complete
        this.broadcast(WebSocketMessageResponses.PHASE_VALIDATED, {
            message: `Files validated for phase: ${phase.name}`,
            phase: phase
        });
    
        this.logger.info("Files generated for phase:", phase.name, finalFiles.map(f => f.filePath));
    
        this.logger.info(`Validation complete for phase: ${phase.name}`);
    
        // Notify phase completion
        this.broadcast(WebSocketMessageResponses.PHASE_IMPLEMENTED, {
            phase: {
                name: phase.name,
                files: safeFiles.map(f => ({
                    path: f.filePath,
                    purpose: f.filePurpose,
                    contents: f.fileContents
                })),
                description: phase.description
            },
            message: "Files generated successfully for phase"
        });
    
        this.markPhaseComplete(phase.name);
        
        return {
            files: safeFiles,
            deploymentNeeded: result.deploymentNeeded,
            commands: result.commands
        };
    }

    getTotalFiles(): number {
        return this.fileManager.getGeneratedFilePaths().length + ((this.state.currentPhase || this.state.blueprint.initialPhase)?.files?.length || 0);
    }

    private async applyFastSmartCodeFixes() : Promise<void> {
        try {
            const startTime = Date.now();
            this.logger.info("Applying fast smart code fixes");
            // Get static analysis and do deterministic fixes
            const staticAnalysis = await this.runStaticAnalysisCode();
            if (staticAnalysis.typecheck.issues.length + staticAnalysis.lint.issues.length == 0) {
                this.logger.info("No issues found, skipping fast smart code fixes");
                return;
            }
            const issues = staticAnalysis.typecheck.issues.concat(staticAnalysis.lint.issues);
            const allFiles = this.fileManager.getAllRelevantFiles();

            const fastCodeFixer = await this.operations.fastCodeFixer.execute({
                query: this.state.query,
                issues,
                allFiles,
            }, this.getOperationOptions());

            if (fastCodeFixer.length > 0) {
                await this.fileManager.saveGeneratedFiles(fastCodeFixer, "fix: Fast smart code fixes");
                await this.deployToSandbox(fastCodeFixer);
                this.logger.info("Fast smart code fixes applied successfully");
            }
            this.logger.info(`Fast smart code fixes applied in ${Date.now() - startTime}ms`);            
        } catch (error) {
            this.broadcastError("Failed to apply fast smart code fixes", error);
            return;
        }
    }

    async handleUserInput(userMessage: string, images?: ImageAttachment[]): Promise<void> {
        // Check if we're awaiting clarification from the gateway
        if (this.state.awaitingClarification && this.pendingInitArgs) {
            this.logger.info('Received clarification response from user', {
                originalQuery: this.state.query,
                userResponse: userMessage.slice(0, 100),
            });

            // Combine original query with user's clarification
            const enhancedQuery = `${this.state.query}\n\nUser clarification: ${userMessage}`;
            
            // Clear the awaiting flag
            this.setState({
                ...this.state,
                awaitingClarification: false,
            });

            // Now generate the blueprint with the enhanced query
            const initArgs = this.pendingInitArgs;
            this.pendingInitArgs = null;

            // Stream a message to let user know we're proceeding
            this.broadcast(WebSocketMessageResponses.CONVERSATION_RESPONSE, {
                message: 'Got it! Let me build that for you...\n\n',
                conversationId: IdGenerator.generateConversationId(),
                isStreaming: false,
            });

            // Generate blueprint with enhanced query
            await this.generateBlueprintAfterClarification(initArgs, enhancedQuery, images);
            return;
        }

        // Normal flow - pass to conversation processor
        const result = await super.handleUserInput(userMessage, images);
        return result;
    }

    /**
     * Generate blueprint after receiving user clarification
     */
    private async generateBlueprintAfterClarification(
        initArgs: AgentInitArgs<PhasicState>,
        enhancedQuery: string,
        _images?: ImageAttachment[]
    ): Promise<void> {
        const { templateInfo, inferenceContext, hostname, sandboxSessionId } = initArgs;
        
        if (!templateInfo || !templateInfo.templateDetails) {
            this.logger.error('Missing template info for blueprint generation');
            return;
        }

        this.logger.info('Generating blueprint after clarification', { 
            enhancedQuery: enhancedQuery.slice(0, 100) 
        });

        try {
            const blueprint = await generateBlueprint({
                env: this.env,
                inferenceContext,
                query: enhancedQuery,
                language: initArgs.language!,
                frameworks: initArgs.frameworks!,
                templateDetails: templateInfo.templateDetails,
                templateMetaInfo: templateInfo.selection,
                images: initArgs.images,
                projectType: this.projectType,
                stream: {
                    chunk_size: 256,
                    onChunk: (chunk) => {
                        // Broadcast blueprint chunks via WebSocket
                        this.broadcast(WebSocketMessageResponses.BLUEPRINT_CHUNK, { chunk });
                    }
                }
            });

            const packageJson = templateInfo.templateDetails.allFiles['package.json'];
            const projectName = generateProjectName(
                blueprint?.projectName || templateInfo.templateDetails.name || '',
                generateNanoId(),
                PhasicCodingBehavior.PROJECT_NAME_PREFIX_MAX_LENGTH
            );

            this.logger.info('Generated project name after clarification', { projectName });

            // Update state with blueprint
            this.setState({
                ...this.state,
                projectName,
                query: enhancedQuery,
                blueprint,
                templateName: templateInfo.templateDetails.name,
                sandboxInstanceId: undefined,
                generatedPhases: [],
                commandsHistory: [],
                lastPackageJson: packageJson,
                sessionId: sandboxSessionId!,
                hostname,
                metadata: inferenceContext.metadata,
                projectType: this.projectType,
                behaviorType: 'phasic',
                awaitingClarification: false,
            });

            // Customize template files
            const customizedFiles = customizeTemplateFiles(
                templateInfo.templateDetails.allFiles,
                {
                    projectName,
                    commandsHistory: []
                }
            );

            this.logger.info('Customized template files', { 
                files: Object.keys(customizedFiles) 
            });

            // Save customized files to git
            const filesToSave = Object.entries(customizedFiles).map(([filePath, content]) => ({
                filePath,
                fileContents: content,
                filePurpose: 'Project configuration file'
            }));

            await this.fileManager.saveGeneratedFiles(
                filesToSave,
                'Initialize project configuration files',
                true
            );

            this.logger.info('Committed customized template files to git');

            // Now start building
            this.initializeAsync().catch((error: unknown) => {
                this.broadcastError("Initialization failed", error);
            });

            this.logger.info(`Blueprint generated successfully after clarification`);

        } catch (error) {
            this.logger.error('Error generating blueprint after clarification', error);
            this.broadcastError('Failed to generate blueprint', error);
        }
    }
}
