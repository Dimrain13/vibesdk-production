import { 
    AgentActionKey, 
    AgentConfig, 
    AgentConstraintConfig, 
    AIModels,
    AllModels,
    LiteModels,
    RegularModels,
} from "./config.types";
import { env } from 'cloudflare:workers';

//======================================================================================
// COMMON CONFIGS - Shared across all configurations
//======================================================================================
const COMMON_AGENT_CONFIGS = {
    screenshotAnalysis: {
        name: AIModels.DISABLED,
        reasoning_effort: 'medium' as const,
        max_tokens: 8000,
        temperature: 0.7,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    realtimeCodeFixer: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        reasoning_effort: 'low' as const,
        max_tokens: 32000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    fastCodeFixer: {
        name: AIModels.DISABLED,
        reasoning_effort: undefined,
        max_tokens: 64000,
        temperature: 0.0,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
} as const;

//======================================================================================
// BALANCED CONFIG (RECOMMENDED) - Best price/performance ratio
// Uses: Claude for precision tasks, Gemini for volume tasks
// Estimated cost: ~$0.15-0.40 per app generation
//
// TEMPERATURE GUIDE:
// 0.0-0.3 = Deterministic (code fixes, debugging)
// 0.4-0.6 = Balanced (planning, conversation)
// 0.7-1.0 = Creative (blueprints, brainstorming)
//======================================================================================
const BALANCED_AGENT_CONFIG: AgentConfig = {
    ...COMMON_AGENT_CONFIGS,
    
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 2000,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
        temperature: 0.3,
    },
    
    blueprint: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'high',
        max_tokens: 20000,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
        temperature: 1.0,
    },
    
    projectSetup: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'medium',
        max_tokens: 48000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    
    phaseGeneration: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 0.6,
        fallbackModel: AIModels.OPENAI_5_MINI,
    },
    
    firstPhaseImplementation: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'medium',
        max_tokens: 48000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    
    phaseImplementation: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'medium',
        max_tokens: 48000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    
    conversationalResponse: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'medium',
        max_tokens: 4000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    
    deepDebugger: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'high',
        max_tokens: 12000,
        temperature: 0.3,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    
    fileRegeneration: {
        name: AIModels.CLAUDE_4_5_HAIKU,
        reasoning_effort: 'low',
        max_tokens: 16000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    
    agenticProjectBuilder: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'high',
        max_tokens: 8000,
        temperature: 0.6,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
};

//======================================================================================
// BUDGET CONFIG - Maximum cost savings
// Uses: Gemini for everything
// Estimated cost: ~$0.02-0.08 per app generation
//======================================================================================
const BUDGET_AGENT_CONFIG: AgentConfig = {
    ...COMMON_AGENT_CONFIGS,
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 2000,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
        temperature: 0.3,
    },
    blueprint: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'medium',
        max_tokens: 16000,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
        temperature: 0.9,
    },
    projectSetup: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    phaseGeneration: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        reasoning_effort: 'low',
        max_tokens: 8000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    firstPhaseImplementation: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'medium',
        max_tokens: 32000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    phaseImplementation: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    conversationalResponse: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        reasoning_effort: 'low',
        max_tokens: 2000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    deepDebugger: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 0.3,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    fileRegeneration: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        reasoning_effort: 'low',
        max_tokens: 16000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    agenticProjectBuilder: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 0.6,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
};

//======================================================================================
// PREMIUM CONFIG - Maximum quality for production/client work
// Uses: Claude Opus/Sonnet for critical tasks
// Estimated cost: ~$0.80-2.50 per app generation
//======================================================================================
const PREMIUM_AGENT_CONFIG: AgentConfig = {
    ...COMMON_AGENT_CONFIGS,
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH,
        max_tokens: 2000,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
        temperature: 0.3,
    },
    blueprint: {
        name: AIModels.CLAUDE_4_5_OPUS,
        reasoning_effort: 'high',
        max_tokens: 32000,
        fallbackModel: AIModels.CLAUDE_4_SONNET,
        temperature: 1.0,
    },
    projectSetup: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'high',
        max_tokens: 48000,
        temperature: 0.4,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    phaseGeneration: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'high',
        max_tokens: 16000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    firstPhaseImplementation: {
        name: AIModels.CLAUDE_4_5_OPUS,
        reasoning_effort: 'high',
        max_tokens: 64000,
        temperature: 0.4,
        fallbackModel: AIModels.CLAUDE_4_SONNET,
    },
    phaseImplementation: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'high',
        max_tokens: 64000,
        temperature: 0.4,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    conversationalResponse: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'medium',
        max_tokens: 4000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    deepDebugger: {
        name: AIModels.CLAUDE_4_5_OPUS,
        reasoning_effort: 'high',
        max_tokens: 16000,
        temperature: 0.2,
        fallbackModel: AIModels.CLAUDE_4_SONNET,
    },
    fileRegeneration: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'medium',
        max_tokens: 32000,
        temperature: 0.1,
        fallbackModel: AIModels.CLAUDE_4_5_HAIKU,
    },
    agenticProjectBuilder: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'high',
        max_tokens: 16000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
};

//======================================================================================
// CONFIG SELECTION
// Set AGENT_CONFIG_MODE in wrangler.jsonc vars to switch:
// "AGENT_CONFIG_MODE": "balanced" | "budget" | "premium"
//======================================================================================
type ConfigMode = 'balanced' | 'budget' | 'premium';

function getAgentConfig(): AgentConfig {
    const mode = (env.AGENT_CONFIG_MODE as ConfigMode) || 'balanced';
    
    switch (mode) {
        case 'budget':
            return BUDGET_AGENT_CONFIG;
        case 'premium':
            return PREMIUM_AGENT_CONFIG;
        case 'balanced':
        default:
            return BALANCED_AGENT_CONFIG;
    }
}

export const AGENT_CONFIG: AgentConfig = getAgentConfig();


export const AGENT_CONSTRAINTS: Map<AgentActionKey, AgentConstraintConfig> = new Map([
    ['fastCodeFixer', {
        allowedModels: new Set(AllModels),
        enabled: true,
    }],
    ['realtimeCodeFixer', {
        allowedModels: new Set(AllModels),
        enabled: true,
    }],
    ['fileRegeneration', {
        allowedModels: new Set(AllModels),
        enabled: true,
    }],
    ['phaseGeneration', {
        allowedModels: new Set(AllModels),
        enabled: true,
    }],
    ['projectSetup', {
        allowedModels: new Set(AllModels),
        enabled: true,
    }],
    ['conversationalResponse', {
        allowedModels: new Set(AllModels),
        enabled: true,
    }],
    ['templateSelection', {
        allowedModels: new Set(AllModels),
        enabled: true,
    }],
]);
