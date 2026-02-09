import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Agent Communication Bus
 * 
 * Enables Emergent-style multi-agent coordination where specialized agents
 * can communicate bidirectionally. Instead of a single LLM loop calling
 * tool functions, this creates a coordinator that can:
 * 
 * 1. Route tasks to the best-fit specialist agent
 * 2. Allow agents to request help from other agents
 * 3. Run validation after each agent completes
 * 4. Escalate to more capable models when agents fail
 * 5. Track cumulative context across agent handoffs
 * 
 * Architecture:
 * 
 *   User Request
 *        │
 *   ┌────▼────┐
 *   │ Coordinator │  ← Routes to best agent, manages handoffs
 *   └────┬────┘
 *        │
 *   ┌────┴─────────────────────────┐
 *   │         │          │         │
 *   ▼         ▼          ▼         ▼
 * Builder  Designer  Integration  QA
 *   │         │          │         │
 *   └─────────┴──────────┴─────────┘
 *              │
 *         Message Bus  ← agents send messages to each other
 */

// ============================================================================
// Types
// ============================================================================

export type AgentRole = 
    | 'coordinator'
    | 'builder'
    | 'designer'
    | 'integration'
    | 'qa'
    | 'debugger';

export type MessageType = 
    | 'task'           // Coordinator assigns work
    | 'result'         // Agent returns completed work
    | 'request'        // Agent asks another agent for help
    | 'feedback'       // Agent gives feedback on another's work
    | 'validation'     // QA reports issues
    | 'escalation';    // Agent can't handle task, needs upgrade

export interface AgentMessage {
    id: string;
    from: AgentRole;
    to: AgentRole;
    type: MessageType;
    payload: {
        task?: string;
        result?: string;
        files?: string[];           // File paths involved
        issues?: string[];          // Problems found
        suggestion?: string;        // Recommended action
        severity?: 'low' | 'medium' | 'high' | 'critical';
        context?: Record<string, unknown>;
    };
    timestamp: number;
    parentMessageId?: string;       // For threaded conversations
}

export interface AgentState {
    role: AgentRole;
    busy: boolean;
    currentTask?: string;
    completedTasks: number;
    failedTasks: number;
    lastActivity: number;
}

export interface CoordinatorPlan {
    steps: CoordinatorStep[];
    currentStep: number;
    status: 'planning' | 'executing' | 'validating' | 'complete' | 'failed';
}

export interface CoordinatorStep {
    agent: AgentRole;
    task: string;
    dependsOn?: number[];   // Step indices this depends on
    status: 'pending' | 'running' | 'complete' | 'failed';
    result?: string;
    files?: string[];
}

// ============================================================================
// Agent Communication Bus
// ============================================================================

export class AgentCommunicationBus {
    private messages: AgentMessage[] = [];
    private agents: Map<AgentRole, AgentState> = new Map();
    private messageHandlers: Map<AgentRole, (msg: AgentMessage) => Promise<AgentMessage | null>> = new Map();
    private logger: StructuredLogger;
    private messageIdCounter = 0;

    constructor(logger: StructuredLogger) {
        this.logger = logger;
    }

    /**
     * Register an agent on the bus
     */
    registerAgent(
        role: AgentRole,
        handler: (msg: AgentMessage) => Promise<AgentMessage | null>
    ): void {
        this.agents.set(role, {
            role,
            busy: false,
            completedTasks: 0,
            failedTasks: 0,
            lastActivity: Date.now(),
        });
        this.messageHandlers.set(role, handler);
        this.logger.info('Agent registered on bus', { role });
    }

    /**
     * Send a message between agents
     */
    async send(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<AgentMessage | null> {
        const fullMessage: AgentMessage = {
            ...message,
            id: `msg_${++this.messageIdCounter}`,
            timestamp: Date.now(),
        };

        this.messages.push(fullMessage);
        this.logger.info('Bus message sent', {
            id: fullMessage.id,
            from: fullMessage.from,
            to: fullMessage.to,
            type: fullMessage.type,
        });

        // Update sender state
        const senderState = this.agents.get(message.from);
        if (senderState) {
            senderState.lastActivity = Date.now();
        }

        // Deliver to recipient
        const handler = this.messageHandlers.get(message.to);
        if (!handler) {
            this.logger.error('No handler for agent', { role: message.to });
            return null;
        }

        const recipientState = this.agents.get(message.to);
        if (recipientState) {
            recipientState.busy = true;
            recipientState.currentTask = message.payload.task;
        }

        try {
            const response = await handler(fullMessage);

            if (recipientState) {
                recipientState.busy = false;
                recipientState.currentTask = undefined;
                recipientState.completedTasks++;
                recipientState.lastActivity = Date.now();
            }

            if (response) {
                response.parentMessageId = fullMessage.id;
                this.messages.push(response);
            }

            return response;
        } catch (error) {
            if (recipientState) {
                recipientState.busy = false;
                recipientState.failedTasks++;
            }

            this.logger.error('Agent message handling failed', {
                agent: message.to,
                error: error instanceof Error ? error.message : 'Unknown',
            });

            return null;
        }
    }

    /**
     * Get conversation history between two agents
     */
    getConversation(agent1: AgentRole, agent2: AgentRole): AgentMessage[] {
        return this.messages.filter(
            m => (m.from === agent1 && m.to === agent2) ||
                 (m.from === agent2 && m.to === agent1)
        );
    }

    /**
     * Get all messages for an agent
     */
    getMessagesFor(role: AgentRole): AgentMessage[] {
        return this.messages.filter(m => m.to === role);
    }

    /**
     * Get current state of all agents
     */
    getAgentStates(): Map<AgentRole, AgentState> {
        return new Map(this.agents);
    }

    /**
     * Get the full message log (for context building)
     */
    getMessageLog(): AgentMessage[] {
        return [...this.messages];
    }

    /**
     * Build a context summary from the message bus
     * This gets fed to agents so they know what's happened
     */
    buildContextSummary(): string {
        if (this.messages.length === 0) return '';

        const lines: string[] = ['## Agent Activity Log\n'];

        for (const msg of this.messages.slice(-20)) { // Last 20 messages
            const time = new Date(msg.timestamp).toISOString().split('T')[1].split('.')[0];
            const arrow = msg.type === 'result' ? '←' : '→';

            let summary = `[${time}] ${msg.from} ${arrow} ${msg.to} (${msg.type})`;

            if (msg.payload.task) {
                summary += `: ${msg.payload.task.slice(0, 100)}`;
            }
            if (msg.payload.issues?.length) {
                summary += ` [${msg.payload.issues.length} issues]`;
            }
            if (msg.payload.files?.length) {
                summary += ` [${msg.payload.files.length} files]`;
            }

            lines.push(summary);
        }

        return lines.join('\n');
    }
}

// ============================================================================
// Coordinator - Routes tasks and manages multi-agent workflows
// ============================================================================

export class AgentCoordinator {
    private bus: AgentCommunicationBus;
    private agent: ICodingAgent;
    private logger: StructuredLogger;
    private toolRenderer: RenderToolCall;
    private streamCb: (chunk: string) => void;

    constructor(
        agent: ICodingAgent,
        logger: StructuredLogger,
        toolRenderer: RenderToolCall,
        streamCb: (chunk: string) => void,
    ) {
        this.agent = agent;
        this.logger = logger;
        this.toolRenderer = toolRenderer;
        this.streamCb = streamCb;
        this.bus = new AgentCommunicationBus(logger);
    }

    /**
     * Plan a multi-agent workflow for a complex task
     */
    planWorkflow(userRequest: string): CoordinatorPlan {
        const steps: CoordinatorStep[] = [];
        const lowerRequest = userRequest.toLowerCase();

        // Detect what agents are needed
        const needsIntegration = /(?:api|integrat|stripe|supabase|auth|payment|database|prisma|drizzle)/i.test(lowerRequest);
        const needsDesign = /(?:design|style|ui|ux|theme|color|layout|responsive)/i.test(lowerRequest);
        const needsBuilder = true; // Always need builder

        // Step 0: Build the core feature
        steps.push({
            agent: 'builder',
            task: userRequest,
            status: 'pending',
        });

        // Step 1: Integration if needed
        if (needsIntegration) {
            steps.push({
                agent: 'integration',
                task: `Implement integrations for: ${userRequest}`,
                dependsOn: [0],
                status: 'pending',
            });
        }

        // Step 2: Design if needed
        if (needsDesign) {
            steps.push({
                agent: 'designer',
                task: `Apply design and styling for: ${userRequest}`,
                dependsOn: needsIntegration ? [0, 1] : [0],
                status: 'pending',
            });
        }

        // Final step: QA validation
        steps.push({
            agent: 'qa',
            task: 'Validate all generated code before preview',
            dependsOn: steps.map((_, i) => i), // Depends on all previous steps
            status: 'pending',
        });

        return {
            steps,
            currentStep: 0,
            status: 'planning',
        };
    }

    /**
     * Execute a planned workflow
     */
    async executeWorkflow(plan: CoordinatorPlan): Promise<{
        success: boolean;
        completedSteps: number;
        totalSteps: number;
        issues: string[];
    }> {
        plan.status = 'executing';
        const issues: string[] = [];

        this.streamCb('\n\n🤖 **Multi-Agent Workflow**\n\n');
        this.streamCb(`Steps planned: ${plan.steps.length}\n\n`);

        for (let i = 0; i < plan.steps.length; i++) {
            const step = plan.steps[i];
            plan.currentStep = i;

            // Check dependencies
            if (step.dependsOn) {
                const allDepsComplete = step.dependsOn.every(
                    depIdx => plan.steps[depIdx].status === 'complete'
                );
                if (!allDepsComplete) {
                    step.status = 'failed';
                    issues.push(`Step ${i} (${step.agent}) skipped: dependencies not met`);
                    continue;
                }
            }

            this.streamCb(`**Step ${i + 1}/${plan.steps.length}:** ${step.agent} — ${step.task.slice(0, 80)}...\n`);
            step.status = 'running';

            // Build context from previous steps
            const previousContext = plan.steps
                .slice(0, i)
                .filter(s => s.status === 'complete' && s.result)
                .map(s => `${s.agent}: ${s.result}`)
                .join('\n');

            const response = await this.bus.send({
                from: 'coordinator',
                to: step.agent,
                type: 'task',
                payload: {
                    task: step.task,
                    context: { previousSteps: previousContext },
                },
            });

            if (response && response.type === 'result') {
                step.status = 'complete';
                step.result = response.payload.result;
                step.files = response.payload.files;
                this.streamCb(`  ✅ Complete\n`);

                // If QA found issues, record them
                if (response.payload.issues?.length) {
                    issues.push(...response.payload.issues);
                    this.streamCb(`  ⚠️ ${response.payload.issues.length} issue(s) noted\n`);
                }
            } else {
                step.status = 'failed';
                issues.push(`${step.agent} failed to complete task`);
                this.streamCb(`  ❌ Failed\n`);
            }
        }

        const completedSteps = plan.steps.filter(s => s.status === 'complete').length;
        plan.status = completedSteps === plan.steps.length ? 'complete' : 'failed';

        this.streamCb(`\n**Result:** ${completedSteps}/${plan.steps.length} steps complete\n`);
        if (issues.length > 0) {
            this.streamCb(`**Issues:** ${issues.length}\n`);
        }

        this.toolRenderer({
            name: 'agent_coordinator',
            status: plan.status === 'complete' ? 'success' : 'error',
            result: `${completedSteps}/${plan.steps.length} steps`,
        });

        return {
            success: plan.status === 'complete',
            completedSteps,
            totalSteps: plan.steps.length,
            issues,
        };
    }

    /**
     * Get the communication bus for registering agent handlers
     */
    getBus(): AgentCommunicationBus {
        return this.bus;
    }
}
