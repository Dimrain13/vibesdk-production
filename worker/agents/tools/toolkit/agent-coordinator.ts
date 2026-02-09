import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';
import { AgentCoordinator, AgentRole } from '../../utils/agentBus';

/**
 * Agent Coordinator Tool
 *
 * Enables Emergent-style multi-agent workflows where the coordinator
 * plans a sequence of steps across specialized agents and executes them
 * with dependency tracking and context passing.
 *
 * The agentic builder can call this for complex tasks that span multiple
 * concerns (e.g., "build a SaaS dashboard with Stripe payments and Auth0 login").
 * Instead of the builder trying to do everything in one LLM loop, the coordinator
 * breaks it into steps: Builder → Integration → Designer → QA.
 *
 * Each agent handler maps to existing tools (integration_agent, design_agent,
 * testing_agent, qa_validation) so this is an orchestration layer, not new
 * agent logic.
 */

export function createAgentCoordinatorTool(
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void,
) {
    // Initialize coordinator
    const coordinator = new AgentCoordinator(agent, logger, toolRenderer, streamCb);
    const bus = coordinator.getBus();

    // ─── Register Agent Handlers ───
    // Each handler maps bus messages to existing tool capabilities

    bus.registerAgent('builder', async (msg) => {
        // Builder = core file generation via agent.generateFiles
        const task = msg.payload.task || '';
        logger.info('Builder agent handling task', { task: task.slice(0, 100) });

        try {
            const result = await agent.generateFiles(
                'Multi-Agent Build Step',
                task,
                [task, msg.payload.context?.previousSteps as string || ''].filter(Boolean),
                [] // Let the phase implementation determine files
            );

            return {
                id: `resp_${msg.id}`,
                from: 'builder' as AgentRole,
                to: msg.from,
                type: 'result',
                payload: {
                    result: `Generated ${result.files.length} files`,
                    files: result.files.map(f => f.path),
                },
                timestamp: Date.now(),
                parentMessageId: msg.id,
            };
        } catch (error) {
            return {
                id: `resp_${msg.id}`,
                from: 'builder' as AgentRole,
                to: msg.from,
                type: 'result',
                payload: {
                    result: 'Build failed',
                    issues: [error instanceof Error ? error.message : 'Unknown error'],
                },
                timestamp: Date.now(),
                parentMessageId: msg.id,
            };
        }
    });

    bus.registerAgent('integration', async (msg) => {
        // Integration = detect and set up service integrations
        const task = msg.payload.task || '';
        logger.info('Integration agent handling task', { task: task.slice(0, 100) });

        // Detect which services are mentioned
        const serviceKeywords: Record<string, string> = {
            stripe: 'stripe', payment: 'stripe', checkout: 'stripe',
            supabase: 'supabase',
            auth0: 'auth0', authentication: 'auth0',
            clerk: 'clerk',
            prisma: 'prisma', database: 'prisma',
            drizzle: 'drizzle',
            resend: 'resend', email: 'resend',
            twilio: 'twilio', sms: 'twilio',
            openai: 'openai', 'gpt': 'openai', ai: 'openai',
            sentry: 'sentry', 'error tracking': 'sentry',
        };

        const lowerTask = task.toLowerCase();
        const detectedServices = new Set<string>();
        for (const [keyword, service] of Object.entries(serviceKeywords)) {
            if (lowerTask.includes(keyword)) {
                detectedServices.add(service);
            }
        }

        const files: string[] = [];
        const issues: string[] = [];

        if (detectedServices.size === 0) {
            return {
                id: `resp_${msg.id}`,
                from: 'integration' as AgentRole,
                to: msg.from,
                type: 'result',
                payload: {
                    result: 'No specific integrations detected',
                    issues: ['Could not identify specific services to integrate. Provide service names explicitly.'],
                },
                timestamp: Date.now(),
                parentMessageId: msg.id,
            };
        }

        // Generate integrations for each detected service
        for (const service of detectedServices) {
            try {
                const result = await agent.generateFiles(
                    `${service} Integration`,
                    `Set up ${service} integration for: ${task}`,
                    [
                        `Integrate ${service} based on requirements: ${task}`,
                        'Use environment variables for all credentials',
                        'Include TypeScript types',
                        'Add error handling',
                    ],
                    [{
                        path: `src/lib/${service}.ts`,
                        purpose: `${service} client and utilities`,
                        changes: null,
                    }]
                );
                files.push(...result.files.map(f => f.path));
            } catch (error) {
                issues.push(`Failed to generate ${service}: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
        }

        return {
            id: `resp_${msg.id}`,
            from: 'integration' as AgentRole,
            to: msg.from,
            type: 'result',
            payload: {
                result: `Set up ${detectedServices.size} integration(s): ${[...detectedServices].join(', ')}`,
                files,
                issues: issues.length > 0 ? issues : undefined,
            },
            timestamp: Date.now(),
            parentMessageId: msg.id,
        };
    });

    bus.registerAgent('designer', async (msg) => {
        // Designer = run analysis and suggest improvements
        // (The actual styling happens via generate_files in the builder)
        const task = msg.payload.task || '';
        logger.info('Designer agent handling task', { task: task.slice(0, 100) });

        return {
            id: `resp_${msg.id}`,
            from: 'designer' as AgentRole,
            to: msg.from,
            type: 'result',
            payload: {
                result: 'Design guidelines applied to generation context',
                suggestion: 'Ensure consistent color palette, responsive layout, and dark mode support',
            },
            timestamp: Date.now(),
            parentMessageId: msg.id,
        };
    });

    bus.registerAgent('qa', async (msg) => {
        // QA = run static analysis + checks
        logger.info('QA agent running validation');

        try {
            const analysis = await agent.runStaticAnalysisCode();
            const runtimeErrors = await agent.fetchRuntimeErrors();

            const issues: string[] = [];

            if (analysis.typecheck?.issues?.length) {
                issues.push(
                    ...analysis.typecheck.issues.slice(0, 5).map(
                        i => `Type error in ${i.filePath}:${i.line}: ${i.message}`
                    )
                );
            }

            if (analysis.lint?.issues?.length) {
                issues.push(
                    ...analysis.lint.issues.slice(0, 5).map(
                        i => `Lint: ${i.filePath}:${i.line}: ${i.message}`
                    )
                );
            }

            if (runtimeErrors?.length) {
                issues.push(
                    ...runtimeErrors.slice(0, 3).map(e => `Runtime: ${e.message}`)
                );
            }

            const passed = issues.length === 0;

            return {
                id: `resp_${msg.id}`,
                from: 'qa' as AgentRole,
                to: msg.from,
                type: 'validation',
                payload: {
                    result: passed ? 'All QA checks passed' : `${issues.length} issues found`,
                    issues: issues.length > 0 ? issues : undefined,
                    severity: passed ? 'low' : issues.length > 5 ? 'critical' : 'medium',
                },
                timestamp: Date.now(),
                parentMessageId: msg.id,
            };
        } catch (error) {
            return {
                id: `resp_${msg.id}`,
                from: 'qa' as AgentRole,
                to: msg.from,
                type: 'validation',
                payload: {
                    result: 'QA check failed to run',
                    issues: [error instanceof Error ? error.message : 'Unknown error'],
                    severity: 'medium',
                },
                timestamp: Date.now(),
                parentMessageId: msg.id,
            };
        }
    });

    bus.registerAgent('debugger', async (msg) => {
        // Debugger = run deep debug on specific issues
        const task = msg.payload.task || '';
        const focusPaths = msg.payload.files;

        try {
            const result = await agent.executeDeepDebug(
                task,
                toolRenderer,
                streamCb,
                focusPaths,
            );

            return {
                id: `resp_${msg.id}`,
                from: 'debugger' as AgentRole,
                to: msg.from,
                type: 'result',
                payload: {
                    result: result.success ? 'Debug resolved' : 'Debug incomplete',
                    issues: result.success ? undefined : ['error' in result ? result.error : 'Unresolved'],
                },
                timestamp: Date.now(),
                parentMessageId: msg.id,
            };
        } catch (error) {
            return {
                id: `resp_${msg.id}`,
                from: 'debugger' as AgentRole,
                to: msg.from,
                type: 'result',
                payload: {
                    result: 'Debug failed',
                    issues: [error instanceof Error ? error.message : 'Unknown'],
                },
                timestamp: Date.now(),
                parentMessageId: msg.id,
            };
        }
    });

    // ─── The Tool ───

    return tool({
        name: 'agent_coordinator',
        description: `Coordinate multi-agent workflows for complex tasks.

Use this when a task involves MULTIPLE concerns that would benefit from 
specialized agents working together:
- Building features that need integrations + design + testing
- Complex refactors that touch many files
- Full-stack features (frontend + backend + database)

The coordinator will:
1. Analyze the task and plan which agents are needed
2. Execute steps in dependency order (Builder → Integration → Designer → QA)
3. Pass context between agents so each knows what others did
4. Run QA validation as the final step

For simple tasks, DON'T use this — just use the individual tools directly.
Reserve this for tasks that clearly span 3+ concerns.`,
        args: {
            task: t.string().describe('The full task description. Be specific about what needs to be built.'),
            agents: t.array(t.string()).optional().describe('Override which agents to use. Default: auto-detect. Options: builder, integration, designer, qa, debugger'),
            skip_qa: t.boolean().optional().describe('Skip the final QA validation step (default: false)'),
        },
        run: async ({ task, agents, skip_qa }) => {
            logger.info('Agent coordinator invoked', { task: task.slice(0, 100) });

            // Plan the workflow
            const plan = coordinator.planWorkflow(task);

            // Filter steps if specific agents requested
            if (agents && agents.length > 0) {
                const allowedRoles = new Set(agents as AgentRole[]);
                // Always keep coordinator-generated qa unless skipped
                if (!skip_qa) allowedRoles.add('qa');

                plan.steps = plan.steps.filter(s => allowedRoles.has(s.agent));
                // Reset dependencies for filtered plan
                plan.steps.forEach((step, i) => {
                    if (step.dependsOn) {
                        step.dependsOn = step.dependsOn.filter(dep => dep < i);
                    }
                });
            }

            // Remove QA if skipped
            if (skip_qa) {
                plan.steps = plan.steps.filter(s => s.agent !== 'qa');
            }

            // Execute
            const result = await coordinator.executeWorkflow(plan);

            return {
                ...result,
                plan: plan.steps.map(s => ({
                    agent: s.agent,
                    task: s.task.slice(0, 100),
                    status: s.status,
                    files: s.files,
                })),
                agentLog: coordinator.getBus().buildContextSummary(),
            };
        },
    });
}
