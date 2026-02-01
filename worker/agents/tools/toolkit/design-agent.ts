import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Design Agent Tool
 * 
 * Provides UI/UX design guidelines and recommendations.
 * Returns design presets based on app type.
 */

// Design presets for different app types
const DESIGN_PRESETS: Record<string, {
    colors: Record<string, string>;
    typography: Record<string, string>;
    guidelines: string[];
}> = {
    saas: {
        colors: {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            accent: '#f59e0b',
            background: '#0f172a',
            surface: '#1e293b',
            text: '#f8fafc',
            muted: '#94a3b8',
        },
        typography: {
            h1: 'text-4xl sm:text-5xl lg:text-6xl font-bold',
            h2: 'text-2xl sm:text-3xl font-semibold',
            body: 'text-base',
            small: 'text-sm text-muted-foreground',
        },
        guidelines: [
            'Use consistent spacing with Tailwind utilities',
            'Implement dark mode as default for SaaS apps',
            'Add micro-animations for interactive elements',
            'Use glass-morphism for cards (backdrop-blur)',
        ],
    },
    ecommerce: {
        colors: {
            primary: '#059669',
            secondary: '#0891b2',
            accent: '#f97316',
            background: '#ffffff',
            surface: '#f8fafc',
            text: '#0f172a',
            muted: '#64748b',
        },
        typography: {
            h1: 'text-3xl sm:text-4xl lg:text-5xl font-bold',
            h2: 'text-xl sm:text-2xl font-semibold',
            body: 'text-base',
            small: 'text-sm text-gray-500',
        },
        guidelines: [
            'Prioritize product imagery and clear CTAs',
            'Use trust signals (reviews, security badges)',
            'Implement sticky cart/checkout elements',
            'Ensure fast loading with image optimization',
        ],
    },
    portfolio: {
        colors: {
            primary: '#f97316',
            secondary: '#ec4899',
            accent: '#14b8a6',
            background: '#18181b',
            surface: '#27272a',
            text: '#fafafa',
            muted: '#a1a1aa',
        },
        typography: {
            h1: 'text-5xl sm:text-6xl lg:text-7xl font-black',
            h2: 'text-2xl sm:text-3xl font-bold',
            body: 'text-base leading-relaxed',
            small: 'text-sm text-zinc-400',
        },
        guidelines: [
            'Make bold typography choices',
            'Add scroll-triggered animations',
            'Create unique hover states',
            'Use asymmetric layouts for visual interest',
        ],
    },
    dashboard: {
        colors: {
            primary: '#3b82f6',
            secondary: '#6366f1',
            accent: '#10b981',
            background: '#030712',
            surface: '#111827',
            text: '#f9fafb',
            muted: '#9ca3af',
        },
        typography: {
            h1: 'text-3xl font-bold',
            h2: 'text-xl font-semibold',
            body: 'text-sm',
            small: 'text-xs text-gray-400',
        },
        guidelines: [
            'Use data visualization (charts, graphs)',
            'Implement collapsible sidebar navigation',
            'Add real-time update indicators',
            'Create clear information hierarchy',
        ],
    },
};

export function createDesignAgentTool(
    _agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'design_agent',
        description: `UI/UX design recommendations and guidelines.

Use this tool for:
- Getting design presets for app types (saas, ecommerce, portfolio, dashboard)
- Color palette recommendations
- Typography guidelines
- Component styling suggestions

Returns static design guidelines - does not modify code directly.`,
        args: {
            app_type: t.string().describe('Type of app: saas, ecommerce, portfolio, dashboard, or custom'),
            specific_request: t.string().optional().describe('Specific design question or request'),
            current_issues: t.string().optional().describe('Current design issues to address'),
        },
        run: async ({ app_type, specific_request, current_issues }) => {
            logger.info('Design agent invoked', { app_type, specific_request });

            streamCb('\n\n🎨 **Design Agent**\n\n');

            const preset = DESIGN_PRESETS[app_type.toLowerCase()];

            if (preset) {
                streamCb(`## ${app_type.toUpperCase()} Design Preset\n\n`);

                streamCb('### Color Palette\n');
                for (const [name, color] of Object.entries(preset.colors)) {
                    streamCb(`- **${name}:** \`${color}\`\n`);
                }

                streamCb('\n### Typography\n');
                for (const [name, classes] of Object.entries(preset.typography)) {
                    streamCb(`- **${name}:** \`${classes}\`\n`);
                }

                streamCb('\n### Guidelines\n');
                preset.guidelines.forEach(guideline => {
                    streamCb(`- ${guideline}\n`);
                });

                if (specific_request) {
                    streamCb(`\n### Specific Recommendation\n`);
                    streamCb(`For "${specific_request}":\n`);
                    streamCb(`Apply the ${app_type} preset above and ensure consistency with the design system.\n`);
                }

                if (current_issues) {
                    streamCb(`\n### Addressing Issues\n`);
                    streamCb(`Issues mentioned: ${current_issues}\n`);
                    streamCb(`Recommendation: Review against the guidelines above and ensure color/typography consistency.\n`);
                }

                toolRenderer({ name: 'design_agent', status: 'success', result: app_type });

                return {
                    success: true,
                    app_type,
                    preset: {
                        colors: preset.colors,
                        typography: preset.typography,
                        guidelines: preset.guidelines,
                    },
                };
            }

            // Custom or unknown app type
            streamCb('## Custom Design Recommendations\n\n');
            streamCb('For custom app types, consider:\n\n');
            streamCb('### General Guidelines\n');
            streamCb('- Define a clear color hierarchy (primary, secondary, accent)\n');
            streamCb('- Use consistent spacing (4px/8px grid system)\n');
            streamCb('- Implement responsive typography\n');
            streamCb('- Add hover/focus states to interactive elements\n');
            streamCb('- Use Tailwind CSS utilities for consistency\n');

            if (specific_request) {
                streamCb(`\n### For "${specific_request}":\n`);
                streamCb('Consider the user flow and prioritize clarity over decoration.\n');
            }

            toolRenderer({ name: 'design_agent', status: 'success', result: 'custom' });

            return {
                success: true,
                app_type: 'custom',
                message: 'Custom design recommendations provided',
                available_presets: Object.keys(DESIGN_PRESETS),
            };
        },
    });
}
