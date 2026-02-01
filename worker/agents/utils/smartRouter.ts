/**
 * Smart Router
 * 
 * Routes requests to appropriate models based on complexity and cost.
 */

export type ModelTier = 'fast' | 'balanced' | 'powerful';

export interface ModelConfig {
    name: string;
    tier: ModelTier;
    costPer1kTokens: number;
    maxTokens: number;
    capabilities: string[];
}

export interface RoutingDecision {
    model: string;
    tier: ModelTier;
    reason: string;
    estimatedCost: number;
}

// Model configurations
const MODELS: Record<string, ModelConfig> = {
    'gpt-4o-mini': {
        name: 'gpt-4o-mini',
        tier: 'fast',
        costPer1kTokens: 0.00015,
        maxTokens: 16384,
        capabilities: ['chat', 'simple_tasks', 'formatting'],
    },
    'gpt-4o': {
        name: 'gpt-4o',
        tier: 'balanced',
        costPer1kTokens: 0.005,
        maxTokens: 128000,
        capabilities: ['chat', 'coding', 'analysis', 'complex_reasoning'],
    },
    'gpt-4-turbo': {
        name: 'gpt-4-turbo',
        tier: 'powerful',
        costPer1kTokens: 0.01,
        maxTokens: 128000,
        capabilities: ['chat', 'coding', 'analysis', 'complex_reasoning', 'long_context'],
    },
};

// Task complexity indicators
const COMPLEX_INDICATORS = [
    'debug',
    'refactor',
    'architect',
    'design pattern',
    'optimize',
    'security',
    'performance',
    'algorithm',
    'data structure',
];

const SIMPLE_INDICATORS = [
    'format',
    'rename',
    'typo',
    'comment',
    'simple',
    'quick',
    'basic',
];

export class SmartRouter {
    private _defaultTier: ModelTier = 'balanced';
    private models: Record<string, ModelConfig>;

    constructor(customModels?: Record<string, ModelConfig>) {
        this.models = customModels ?? MODELS;
    }

    /**
     * Analyze task complexity
     */
    analyzeComplexity(task: string): { score: number; factors: string[] } {
        const lowerTask = task.toLowerCase();
        const factors: string[] = [];
        let score = 0.5; // Start at medium

        // Check for complexity indicators
        for (const indicator of COMPLEX_INDICATORS) {
            if (lowerTask.includes(indicator)) {
                score += 0.1;
                factors.push(`Complex: ${indicator}`);
            }
        }

        // Check for simplicity indicators
        for (const indicator of SIMPLE_INDICATORS) {
            if (lowerTask.includes(indicator)) {
                score -= 0.1;
                factors.push(`Simple: ${indicator}`);
            }
        }

        // Check task length (longer = potentially more complex)
        if (task.length > 500) {
            score += 0.1;
            factors.push('Long task description');
        } else if (task.length < 100) {
            score -= 0.1;
            factors.push('Short task description');
        }

        // Clamp score between 0 and 1
        score = Math.max(0, Math.min(1, score));

        return { score, factors };
    }

    /**
     * Route a task to the appropriate model
     */
    route(task: string, options?: { preferTier?: ModelTier; maxCost?: number }): RoutingDecision {
        const { score, factors } = this.analyzeComplexity(task);

        // Determine tier based on complexity
        let tier: ModelTier;
        if (options?.preferTier) {
            tier = options.preferTier;
        } else if (score < 0.3) {
            tier = 'fast';
        } else if (score > 0.7) {
            tier = 'powerful';
        } else {
            tier = 'balanced';
        }

        // Find model for tier
        const model = Object.values(this.models).find(m => m.tier === tier);
        if (!model) {
            // Fallback to balanced
            const fallback = Object.values(this.models).find(m => m.tier === 'balanced');
            return {
                model: fallback?.name ?? 'gpt-4o',
                tier: 'balanced',
                reason: 'Fallback to balanced tier',
                estimatedCost: 0,
            };
        }

        // Estimate cost (rough estimate based on task length)
        const estimatedTokens = Math.ceil(task.length / 4) * 2; // Input + output estimate
        const estimatedCost = (estimatedTokens / 1000) * model.costPer1kTokens;

        // Check cost constraint
        if (options?.maxCost && estimatedCost > options.maxCost) {
            // Downgrade to cheaper tier
            const cheaperModel = Object.values(this.models)
                .filter(m => m.costPer1kTokens < model.costPer1kTokens)
                .sort((a, b) => b.costPer1kTokens - a.costPer1kTokens)[0];

            if (cheaperModel) {
                return {
                    model: cheaperModel.name,
                    tier: cheaperModel.tier,
                    reason: `Downgraded due to cost constraint (was ${tier})`,
                    estimatedCost: (estimatedTokens / 1000) * cheaperModel.costPer1kTokens,
                };
            }
        }

        return {
            model: model.name,
            tier,
            reason: factors.length > 0 ? factors.join(', ') : 'Default routing',
            estimatedCost,
        };
    }

    /**
     * Get available models
     */
    getModels(): ModelConfig[] {
        return Object.values(this.models);
    }

    /**
     * Set default tier
     */
    setDefaultTier(tier: ModelTier): void {
        this._defaultTier = tier;
    }

    /**
     * Get default tier
     */
    getDefaultTier(): ModelTier {
        return this._defaultTier;
    }
}

// Singleton instance
export const smartRouter = new SmartRouter();
