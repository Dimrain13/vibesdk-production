/**
 * Model Configuration Presets
 * These presets allow users to quickly apply recommended settings
 */

import type { ModelConfigUpdate } from '@/api-types';

export type PresetName = 'balanced' | 'budget' | 'premium';

export interface ConfigPreset {
  name: PresetName;
  label: string;
  description: string;
  configs: Record<string, ModelConfigUpdate>;
}

// Model names that map to the AIModels enum in the backend
const Models = {
  GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite-preview-06-17',
  GEMINI_2_5_FLASH: 'gemini-2.5-flash-preview-05-20',
  GEMINI_2_5_PRO: 'gemini-2.5-pro-preview-05-06',
  CLAUDE_4_SONNET: 'claude-sonnet-4-20250514',
  CLAUDE_4_5_HAIKU: 'claude-haiku-4-5-20251218',
  CLAUDE_4_5_OPUS: 'claude-opus-4-5-20251218',
  OPENAI_5_MINI: 'gpt-5-mini',
} as const;

export const CONFIG_PRESETS: ConfigPreset[] = [
  {
    name: 'balanced',
    label: 'Balanced',
    description: 'Best price/performance (~$0.15-0.40/app)',
    configs: {
      templateSelection: {
        modelName: Models.GEMINI_2_5_FLASH_LITE,
        fallbackModel: Models.GEMINI_2_5_FLASH,
        temperature: 0.3,
      },
      blueprint: {
        modelName: Models.CLAUDE_4_SONNET,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 1.0,
        reasoningEffort: 'high',
      },
      projectSetup: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.5,
        reasoningEffort: 'medium',
      },
      phaseGeneration: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.OPENAI_5_MINI,
        temperature: 0.6,
        reasoningEffort: 'medium',
      },
      firstPhaseImplementation: {
        modelName: Models.CLAUDE_4_SONNET,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.5,
        reasoningEffort: 'medium',
      },
      phaseImplementation: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.5,
        reasoningEffort: 'medium',
      },
      conversationalResponse: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.5,
        reasoningEffort: 'medium',
      },
      deepDebugger: {
        modelName: Models.CLAUDE_4_SONNET,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.3,
        reasoningEffort: 'high',
      },
      fileRegeneration: {
        modelName: Models.CLAUDE_4_5_HAIKU,
        fallbackModel: Models.GEMINI_2_5_FLASH,
        temperature: 0.2,
        reasoningEffort: 'low',
      },
      agenticProjectBuilder: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.6,
        reasoningEffort: 'high',
      },
    },
  },
  {
    name: 'budget',
    label: 'Budget',
    description: 'Maximum savings (~$0.02-0.08/app)',
    configs: {
      templateSelection: {
        modelName: Models.GEMINI_2_5_FLASH_LITE,
        fallbackModel: Models.GEMINI_2_5_FLASH,
        temperature: 0.3,
      },
      blueprint: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.9,
        reasoningEffort: 'medium',
      },
      projectSetup: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.5,
        reasoningEffort: 'low',
      },
      phaseGeneration: {
        modelName: Models.GEMINI_2_5_FLASH_LITE,
        fallbackModel: Models.GEMINI_2_5_FLASH,
        temperature: 0.5,
        reasoningEffort: 'low',
      },
      firstPhaseImplementation: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.5,
        reasoningEffort: 'medium',
      },
      phaseImplementation: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.5,
        reasoningEffort: 'low',
      },
      conversationalResponse: {
        modelName: Models.GEMINI_2_5_FLASH_LITE,
        fallbackModel: Models.GEMINI_2_5_FLASH,
        temperature: 0.5,
        reasoningEffort: 'low',
      },
      deepDebugger: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.3,
        reasoningEffort: 'medium',
      },
      fileRegeneration: {
        modelName: Models.GEMINI_2_5_FLASH_LITE,
        fallbackModel: Models.GEMINI_2_5_FLASH,
        temperature: 0.2,
        reasoningEffort: 'low',
      },
      agenticProjectBuilder: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.6,
        reasoningEffort: 'medium',
      },
    },
  },
  {
    name: 'premium',
    label: 'Premium',
    description: 'Maximum quality (~$0.80-2.50/app)',
    configs: {
      templateSelection: {
        modelName: Models.GEMINI_2_5_FLASH,
        fallbackModel: Models.GEMINI_2_5_FLASH,
        temperature: 0.3,
      },
      blueprint: {
        modelName: Models.CLAUDE_4_5_OPUS,
        fallbackModel: Models.CLAUDE_4_SONNET,
        temperature: 1.0,
        reasoningEffort: 'high',
      },
      projectSetup: {
        modelName: Models.CLAUDE_4_SONNET,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.4,
        reasoningEffort: 'high',
      },
      phaseGeneration: {
        modelName: Models.CLAUDE_4_SONNET,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.5,
        reasoningEffort: 'high',
      },
      firstPhaseImplementation: {
        modelName: Models.CLAUDE_4_5_OPUS,
        fallbackModel: Models.CLAUDE_4_SONNET,
        temperature: 0.4,
        reasoningEffort: 'high',
      },
      phaseImplementation: {
        modelName: Models.CLAUDE_4_SONNET,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.4,
        reasoningEffort: 'high',
      },
      conversationalResponse: {
        modelName: Models.CLAUDE_4_SONNET,
        fallbackModel: Models.GEMINI_2_5_FLASH,
        temperature: 0.5,
        reasoningEffort: 'medium',
      },
      deepDebugger: {
        modelName: Models.CLAUDE_4_5_OPUS,
        fallbackModel: Models.CLAUDE_4_SONNET,
        temperature: 0.2,
        reasoningEffort: 'high',
      },
      fileRegeneration: {
        modelName: Models.CLAUDE_4_SONNET,
        fallbackModel: Models.CLAUDE_4_5_HAIKU,
        temperature: 0.1,
        reasoningEffort: 'medium',
      },
      agenticProjectBuilder: {
        modelName: Models.CLAUDE_4_SONNET,
        fallbackModel: Models.GEMINI_2_5_PRO,
        temperature: 0.5,
        reasoningEffort: 'high',
      },
    },
  },
];

export function getPresetByName(name: PresetName): ConfigPreset | undefined {
  return CONFIG_PRESETS.find(p => p.name === name);
}
