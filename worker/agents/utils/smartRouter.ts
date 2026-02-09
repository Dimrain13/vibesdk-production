/**
 * Smart Router
 * 
 * Routes requests to appropriate models based on complexity and cost.
 * Updated to use actual model definitions from config.types.ts
 * 
 * REPLACES: utils/smartRouter.ts (stale GPT-4o references)
 */

import { AIModels, AI_MODEL_CONFIG, AIModelConfig, ModelSize } from '../inferutils/config.types';

export type ModelTier = 'fast' | 'balanced' | 'powerful';

export interface RoutingDecision {
    model: string;
    tier: ModelTier;
    reason: string;
    estimatedCreditCost: number;
}

// Map model sizes to tiers
function modelSizeToTier(size: ModelSize): ModelTier {
    switch (size) {
        case ModelSize.LITE: return 'fast';
        case ModelSize.REGULAR: return 'balanced';
        case ModelSize.LARGE: return 'powerful';
        default: return 'balanced';
    }
}

// Task complexity indicators
const COMPLEX_INDICATORS = [
    'debug', 'refactor', 'architect', 'design pattern', 'optimize',
    'security', 'performance', 'algorithm', 'data structure', 'migration',
    'integration', 'authentication', 'oauth', 'webhook', 'database schema',
];

const SIMPLE_INDICATORS = [
    'format', 'rename', 'typo', 'comment', 'simple', 'quick', 'basic',
    'style', 'color', 'text change', 'label',
];

export class SmartRouter {
    private defaultTier: ModelTier = 'balanced';

    /**
     * Analyze task complexity and return a score 0-1
     */
    analyzeComplexity(task: string): { score: number; factors: string[] } {
        const lowerTask = task.toLowerCase();
        const factors: string[] = [];
        let score = 0.5;

        for (const indicator of COMPLEX_INDICATORS) {
            if (lowerTask.includes(indicator)) {
                score += 0.1;
                factors.push(`Complex: ${indicator}`);
            }
        }

        for (const indicator of SIMPLE_INDICATORS) {
            if (lowerTask.includes(indicator)) {
                score -= 0.1;
                factors.push(`Simple: ${indicator}`);
            }
        }

        if (task.length > 500) {
            score += 0.1;
            factors.push('Long task description');
        } else if (task.length < 100) {
            score -= 0.1;
            factors.push('Short task description');
        }

        return { score: Math.max(0, Math.min(1, score)), factors };
    }

    /**
     * Get the best model for a given tier from actual registered models
     */
    private getModelForTier(tier: ModelTier): { modelId: string; config: AIModelConfig } | null {
        const targetSize = tier === 'fast' ? ModelSize.LITE 
            : tier === 'powerful' ? ModelSize.LARGE 
            : ModelSize.REGULAR;

        // Find the cheapest model in the target size category
        let best: { modelId: string; config: AIModelConfig } | null = null;

        for (const [modelId, config] of Object.entries(AI_MODEL_CONFIG)) {
            if (config.size === targetSize) {
                if (!best || config.creditCost < best.config.creditCost) {
                    best = { modelId, config };
                }
            }
        }

        return best;
    }

    /**
     * Route a task to the appropriate model
     */
    route(task: string, options?: { preferTier?: ModelTier; maxCreditCost?: number }): RoutingDecision {
        const { score, factors } = this.analyzeComplexity(task);

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

        const model = this.getModelForTier(tier);
        if (!model) {
            // Fallback
            const fallback = this.getModelForTier('balanced');
            return {
                model: fallback?.modelId || AIModels.GEMINI_2_5_FLASH,
                tier: 'balanced',
                reason: 'Fallback to balanced tier',
                estimatedCreditCost: fallback?.config.creditCost || 1,
            };
        }

        // Check cost constraint
        if (options?.maxCreditCost && model.config.creditCost > options.maxCreditCost) {
            const cheaper = this.getModelForTier('fast');
            if (cheaper && cheaper.config.creditCost <= options.maxCreditCost) {
                return {
                    model: cheaper.modelId,
                    tier: 'fast',
                    reason: `Downgraded from ${tier} due to cost constraint`,
                    estimatedCreditCost: cheaper.config.creditCost,
                };
            }
        }

        return {
            model: model.modelId,
            tier,
            reason: factors.length > 0 ? factors.join(', ') : 'Default routing',
            estimatedCreditCost: model.config.creditCost,
        };
    }

    /**
     * Get all available models grouped by tier
     */
    getModelsByTier(): Record<ModelTier, Array<{ modelId: string; config: AIModelConfig }>> {
        const result: Record<ModelTier, Array<{ modelId: string; config: AIModelConfig }>> = {
            fast: [],
            balanced: [],
            powerful: [],
        };

        for (const [modelId, config] of Object.entries(AI_MODEL_CONFIG)) {
            const tier = modelSizeToTier(config.size);
            result[tier].push({ modelId, config });
        }

        // Sort each tier by cost
        for (const tier of Object.keys(result) as ModelTier[]) {
            result[tier].sort((a, b) => a.config.creditCost - b.config.creditCost);
        }

        return result;
    }

    setDefaultTier(tier: ModelTier): void {
        this.defaultTier = tier;
    }

    getDefaultTier(): ModelTier {
        return this.defaultTier;
    }
}

export const smartRouter = new SmartRouter();
