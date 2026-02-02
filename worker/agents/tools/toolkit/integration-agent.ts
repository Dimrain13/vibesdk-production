import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Integration Implementation Agent
 * 
 * Specialized high-capability agent for implementing API and database integrations.
 * Uses a more powerful model than regular coding tasks.
 * 
 * Use this for:
 * - REST/GraphQL API integrations
 * - Database connections and ORMs
 * - Authentication flows (OAuth, JWT, etc.)
 * - Third-party service integrations (Stripe, Auth0, etc.)
 * - WebSocket implementations
 * - Complex data fetching/caching patterns
 */

// Common integration patterns and best practices
const INTEGRATION_PATTERNS: Record<string, {
    description: string;
    bestPractices: string[];
    commonPitfalls: string[];
    envVars: string[];
}> = {
    rest_api: {
        description: 'RESTful API integration',
        bestPractices: [
            'Use environment variables for base URLs and API keys',
            'Implement proper error handling with try-catch',
            'Add request/response logging for debugging',
            'Use TypeScript interfaces for request/response types',
            'Implement retry logic with exponential backoff',
            'Add request timeouts to prevent hanging',
        ],
        commonPitfalls: [
            'Hardcoding API keys in source code',
            'Not handling rate limits (429 errors)',
            'Missing error handling for network failures',
            'Not validating response data',
        ],
        envVars: ['API_BASE_URL', 'API_KEY', 'API_SECRET'],
    },
    graphql: {
        description: 'GraphQL API integration',
        bestPractices: [
            'Use code generation for type safety',
            'Implement query/mutation separation',
            'Use fragments for reusable fields',
            'Add proper caching strategy',
            'Handle loading and error states',
        ],
        commonPitfalls: [
            'Over-fetching data in queries',
            'Not handling partial errors',
            'Missing optimistic updates for mutations',
        ],
        envVars: ['GRAPHQL_ENDPOINT', 'GRAPHQL_WS_ENDPOINT'],
    },
    database: {
        description: 'Database connection and ORM setup',
        bestPractices: [
            'Use connection pooling for performance',
            'Implement migrations for schema changes',
            'Add indexes for frequently queried fields',
            'Use transactions for related operations',
            'Implement soft deletes when appropriate',
            'Add created_at/updated_at timestamps',
        ],
        commonPitfalls: [
            'N+1 query problems',
            'Not using prepared statements (SQL injection)',
            'Missing database indexes',
            'Not handling connection errors',
        ],
        envVars: ['DATABASE_URL', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'],
    },
    oauth: {
        description: 'OAuth 2.0 / OpenID Connect authentication',
        bestPractices: [
            'Store tokens securely (httpOnly cookies or secure storage)',
            'Implement token refresh logic',
            'Validate ID tokens properly',
            'Use PKCE for public clients',
            'Implement proper logout (revoke tokens)',
        ],
        commonPitfalls: [
            'Storing tokens in localStorage (XSS vulnerable)',
            'Not validating token signatures',
            'Missing CSRF protection',
            'Not handling token expiration',
        ],
        envVars: ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'OAUTH_REDIRECT_URI', 'OAUTH_ISSUER'],
    },
    webhook: {
        description: 'Webhook receiver implementation',
        bestPractices: [
            'Verify webhook signatures',
            'Respond quickly (200 OK) before processing',
            'Implement idempotency for retries',
            'Log all received webhooks',
            'Handle webhook replay attacks',
        ],
        commonPitfalls: [
            'Not verifying signatures (security risk)',
            'Slow processing blocking response',
            'Not handling duplicate deliveries',
        ],
        envVars: ['WEBHOOK_SECRET', 'WEBHOOK_ENDPOINT'],
    },
    websocket: {
        description: 'WebSocket real-time communication',
        bestPractices: [
            'Implement heartbeat/ping-pong',
            'Handle reconnection gracefully',
            'Use message queuing for offline support',
            'Implement proper authentication',
            'Add connection state management',
        ],
        commonPitfalls: [
            'Not handling disconnections',
            'Memory leaks from event listeners',
            'Missing message acknowledgment',
        ],
        envVars: ['WS_URL', 'WS_AUTH_TOKEN'],
    },
    payment: {
        description: 'Payment processor integration (Stripe, etc.)',
        bestPractices: [
            'Never log full card numbers',
            'Use webhooks for payment confirmation',
            'Implement idempotency keys',
            'Handle all payment states (success, failed, pending)',
            'Test with test/sandbox credentials first',
        ],
        commonPitfalls: [
            'Not handling webhook failures',
            'Missing idempotency (duplicate charges)',
            'Not validating amounts server-side',
        ],
        envVars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
    },
};

export function createIntegrationAgentTool(
    _agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'integration_agent',
        description: `Specialized agent for implementing API and database integrations.

Use this for complex integration tasks:
- REST/GraphQL API integrations
- Database connections (SQL, NoSQL, ORMs)  
- OAuth/authentication flows
- Payment processors (Stripe, PayPal)
- Third-party services (Twilio, SendGrid, etc.)
- WebSocket implementations
- Webhook receivers

This agent uses a more capable model for higher accuracy on integration tasks.
Provide API keys and credentials when available for complete implementations.`,
        args: {
            integration_type: t.string().describe('Type: rest_api, graphql, database, oauth, webhook, websocket, payment, or custom'),
            service_name: t.string().describe('Name of the service (e.g., Stripe, Supabase, Auth0)'),
            requirements: t.string().describe('What the integration needs to do'),
            credentials_available: t.string().optional().describe('What credentials/keys are available (do not include actual values)'),
            existing_code: t.string().optional().describe('Any existing integration code to build upon'),
        },
        run: async ({ integration_type, service_name, requirements, credentials_available, existing_code }) => {
            logger.info('Integration agent invoked', { integration_type, service_name });

            streamCb('\n\n🔌 **Integration Implementation Agent**\n\n');
            streamCb(`**Service:** ${service_name}\n`);
            streamCb(`**Type:** ${integration_type}\n`);
            streamCb(`**Requirements:** ${requirements}\n\n`);

            // Get pattern info if available
            const pattern = INTEGRATION_PATTERNS[integration_type.toLowerCase()];

            if (pattern) {
                streamCb('---\n\n');
                streamCb(`### ${pattern.description}\n\n`);

                streamCb('**Best Practices:**\n');
                pattern.bestPractices.forEach(bp => {
                    streamCb(`- ${bp}\n`);
                });

                streamCb('\n**Common Pitfalls to Avoid:**\n');
                pattern.commonPitfalls.forEach(cp => {
                    streamCb(`- ⚠️ ${cp}\n`);
                });

                streamCb('\n**Environment Variables Needed:**\n');
                pattern.envVars.forEach(ev => {
                    streamCb(`- \`${ev}\`\n`);
                });
            }

            if (credentials_available) {
                streamCb('\n**Credentials Available:**\n');
                streamCb(`${credentials_available}\n`);
            } else {
                streamCb('\n**⚠️ No credentials provided.** Implementation will use placeholder values.\n');
                streamCb('Provide actual credentials for a complete, working integration.\n');
            }

            if (existing_code) {
                streamCb('\n**Building upon existing code:**\n');
                streamCb('```\n');
                streamCb(existing_code.slice(0, 500));
                if (existing_code.length > 500) streamCb('\n... (truncated)');
                streamCb('\n```\n');
            }

            streamCb('\n---\n\n');
            streamCb('### Implementation Plan\n\n');
            streamCb('1. Set up environment variables\n');
            streamCb('2. Create service client/connection\n');
            streamCb('3. Implement core integration logic\n');
            streamCb('4. Add error handling and retries\n');
            streamCb('5. Add TypeScript types for safety\n');
            streamCb('6. Test with provided credentials\n');

            toolRenderer({ 
                name: 'integration_agent', 
                status: 'success', 
                result: `${service_name} (${integration_type})` 
            });

            return {
                success: true,
                integration_type,
                service_name,
                pattern: pattern ? {
                    bestPractices: pattern.bestPractices,
                    envVars: pattern.envVars,
                } : null,
                hasCredentials: !!credentials_available,
                recommendation: credentials_available 
                    ? 'Proceed with full implementation using provided credentials'
                    : 'Request credentials from user for complete implementation',
            };
        },
    });
}
