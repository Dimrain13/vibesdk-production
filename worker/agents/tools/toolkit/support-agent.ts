import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from 'worker/agents/operations/UserConversationProcessor';

/**
 * Support Agent Tool
 * 
 * Handles platform-related queries, capabilities questions, and user support.
 * Does not make code changes - provides information and guidance only.
 */

interface SupportResponse {
    category: string;
    answer: string;
    relatedTopics?: string[];
    actionRequired?: boolean;
    actionDetails?: string;
}

// Knowledge base for common questions
const SUPPORT_KNOWLEDGE: Record<string, SupportResponse> = {
    // Capabilities
    'what can you do': {
        category: 'capabilities',
        answer: `I'm an AI coding agent that can help you build full-stack web applications. Here's what I can do:

**Development:**
- Generate React + TypeScript applications
- Debug and fix runtime errors
- Implement new features
- Refactor existing code

**Tools Available:**
- \`queue_request\`: Queue feature/bug fix requests
- \`deep_debug\`: Autonomous debugging assistant
- \`testing_agent\`: Automated testing
- \`design_agent\`: UI/UX recommendations
- \`integration_playbook\`: 3rd party API guides
- \`web_search\`: Search for documentation
- \`deploy_preview\`: Deploy your app

**Project Management:**
- Git version control
- Blueprint/requirements editing
- Project renaming`,
        relatedTopics: ['How to request features', 'How to fix bugs', 'Available integrations'],
    },
    
    'how to deploy': {
        category: 'deployment',
        answer: `To deploy your application:

**Preview Deployment:**
1. Your app automatically deploys to a preview URL during development
2. Use \`deploy_preview\` tool to manually trigger redeployment
3. Preview URLs are temporary and for testing only

**Production Deployment:**
1. Click the "Deploy to Cloudflare" button in the UI
2. This deploys to Cloudflare Workers for permanent hosting
3. You'll get a production URL after deployment

**Export Options:**
- Click "Export to GitHub" to save your code to a repository
- You can then deploy from GitHub to other platforms`,
        relatedTopics: ['Cloudflare Workers', 'GitHub export', 'Custom domains'],
    },

    'github': {
        category: 'version_control',
        answer: `**GitHub Integration:**

**Export to GitHub:**
1. Click "Export to GitHub" button in the preview panel
2. Authenticate with GitHub if prompted
3. Choose repository name and visibility
4. Code will be pushed to your GitHub account

**Save Progress:**
- Use \`git commit\` tool to save your work locally
- Use \`git log\` to view commit history
- Changes are tracked automatically

**Note:** Direct push from this platform requires the Export feature. The internal git is for version history, not GitHub sync.`,
        relatedTopics: ['Git commands', 'Version history', 'Code export'],
    },

    'rollback': {
        category: 'version_control',
        answer: `**Rolling Back Changes:**

**View History:**
\`\`\`
git log (shows recent commits)
git show <commit-id> (view specific commit)
\`\`\`

**Rollback Options:**
1. **Soft Rollback:** Use \`regenerate_file\` to revert specific files
2. **View Previous:** Use \`git show\` with \`includeDiff=true\` to see old code
3. **Full Reset:** Available but risky - resets to specific commit

**Recommendation:** For major rollbacks, export to GitHub first, then use GitHub's version history.`,
        relatedTopics: ['Git commands', 'Version history', 'Safe practices'],
    },

    'api keys': {
        category: 'security',
        answer: `**API Keys & Secrets:**

**Current Limitation:**
I cannot directly manage or store API keys for security reasons.

**Workarounds:**
1. **Environment Variables:** After exporting to GitHub, add keys as environment variables in your deployment platform
2. **Integration Playbook:** Use \`integration_playbook\` tool to get guidance on which keys you need
3. **Local Development:** Add keys to your local .env file after export

**Security Best Practices:**
- Never commit API keys to code
- Use environment variables
- Rotate keys regularly
- Use different keys for dev/prod`,
        relatedTopics: ['Security', 'Environment variables', 'Integrations'],
    },

    'error help': {
        category: 'debugging',
        answer: `**Getting Help with Errors:**

**For Active Bugs:**
Use \`deep_debug\` tool - it will:
1. Analyze your code
2. Check runtime errors
3. Apply fixes automatically
4. Report what was changed

**For Persistent Issues:**
Use \`troubleshoot_agent\` tool for deep RCA:
1. Investigates root cause
2. Analyzes multiple sources
3. Provides recommendations
4. You implement the fixes

**Quick Tips:**
- Share error messages when reporting bugs
- Mention what you were doing when it happened
- Try refreshing the preview first`,
        relatedTopics: ['Debugging', 'Common errors', 'Troubleshooting'],
    },

    'pricing': {
        category: 'platform',
        answer: `**Platform Information:**

For pricing, billing, and account-related questions, please refer to:
- Cloudflare dashboard for Workers pricing
- Platform documentation for usage limits

**Usage Notes:**
- Preview deployments are temporary
- Production deployments count toward Workers usage
- AI model costs vary by complexity

For specific billing questions, contact platform support directly.`,
        relatedTopics: ['Account', 'Limits', 'Support'],
    },

    'limitations': {
        category: 'capabilities',
        answer: `**Current Limitations:**

**What I Cannot Do:**
- Store/manage API keys directly
- Access external databases without credentials
- Modify wrangler.jsonc or package.json
- Download entire codebase (use GitHub export)
- Access private/authenticated websites
- Run long-duration processes (>2 min timeout)

**What I'm Limited In:**
- Image generation requires specific tools
- Some integrations need API keys you provide
- Complex backend logic may need iteration

**Workarounds:**
- Export to GitHub for full control
- Use integration playbooks for API setup
- Break complex requests into phases`,
        relatedTopics: ['Capabilities', 'Workarounds', 'Best practices'],
    },
};

export function createSupportAgentTool(
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'support_agent',
        description: `Platform support and capabilities assistant.

Use this tool for:
- Questions about what the platform can do
- How to deploy, export, or manage projects
- GitHub integration questions
- API keys and security guidance
- Error help and debugging guidance
- Rollback and version control questions
- Platform limitations and workarounds

This tool provides information only - it does not make code changes.`,
        args: {
            query: t.string().describe('The support question or topic'),
        },
        run: async ({ query }) => {
            logger.info('Support agent query', { query });

            streamCb(`\n💬 **Support Agent**\n\n`);

            const queryLower = query.toLowerCase();
            
            // Find matching knowledge base entry
            let bestMatch: SupportResponse | null = null;
            let matchedKey = '';
            
            for (const [key, value] of Object.entries(SUPPORT_KNOWLEDGE)) {
                if (queryLower.includes(key) || key.split(' ').every(word => queryLower.includes(word))) {
                    bestMatch = value;
                    matchedKey = key;
                    break;
                }
            }

            // Check for specific keywords
            if (!bestMatch) {
                if (queryLower.includes('deploy') || queryLower.includes('host')) {
                    bestMatch = SUPPORT_KNOWLEDGE['how to deploy'];
                    matchedKey = 'deployment';
                } else if (queryLower.includes('github') || queryLower.includes('export')) {
                    bestMatch = SUPPORT_KNOWLEDGE['github'];
                    matchedKey = 'github';
                } else if (queryLower.includes('rollback') || queryLower.includes('revert') || queryLower.includes('undo')) {
                    bestMatch = SUPPORT_KNOWLEDGE['rollback'];
                    matchedKey = 'rollback';
                } else if (queryLower.includes('key') || queryLower.includes('secret') || queryLower.includes('credential')) {
                    bestMatch = SUPPORT_KNOWLEDGE['api keys'];
                    matchedKey = 'api keys';
                } else if (queryLower.includes('error') || queryLower.includes('bug') || queryLower.includes('fix')) {
                    bestMatch = SUPPORT_KNOWLEDGE['error help'];
                    matchedKey = 'error help';
                } else if (queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('billing')) {
                    bestMatch = SUPPORT_KNOWLEDGE['pricing'];
                    matchedKey = 'pricing';
                } else if (queryLower.includes('limit') || queryLower.includes('cannot') || queryLower.includes("can't")) {
                    bestMatch = SUPPORT_KNOWLEDGE['limitations'];
                    matchedKey = 'limitations';
                } else if (queryLower.includes('what') && (queryLower.includes('do') || queryLower.includes('can'))) {
                    bestMatch = SUPPORT_KNOWLEDGE['what can you do'];
                    matchedKey = 'capabilities';
                }
            }

            if (bestMatch) {
                streamCb(`**Topic:** ${bestMatch.category}\n\n`);
                streamCb(bestMatch.answer);
                streamCb('\n\n');

                if (bestMatch.relatedTopics && bestMatch.relatedTopics.length > 0) {
                    streamCb(`**Related Topics:** ${bestMatch.relatedTopics.join(', ')}\n`);
                }

                if (bestMatch.actionRequired) {
                    streamCb(`\n⚠️ **Action Required:** ${bestMatch.actionDetails}\n`);
                }

                toolRenderer({ name: 'support_agent', status: 'success', result: matchedKey });

                return {
                    success: true,
                    category: bestMatch.category,
                    matched_topic: matchedKey,
                    related_topics: bestMatch.relatedTopics,
                };
            }

            // No match found - provide general help
            streamCb(`I don't have specific information about "${query}", but here are some things I can help with:\n\n`);
            
            const topics = [
                '- **Capabilities:** What I can do for you',
                '- **Deployment:** How to deploy your app',
                '- **GitHub:** Exporting and version control',
                '- **API Keys:** Security and integrations',
                '- **Debugging:** Getting help with errors',
                '- **Limitations:** What I cannot do',
            ];
            
            topics.forEach(topic => streamCb(`${topic}\n`));
            
            streamCb(`\nTry asking about one of these topics, or describe your question in more detail.\n`);

            toolRenderer({ name: 'support_agent', status: 'success', result: 'general_help' });

            return {
                success: true,
                category: 'general',
                message: 'No specific match found - provided general help',
                available_topics: Object.keys(SUPPORT_KNOWLEDGE),
            };
        },
    });
}
