import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Integration Playbook Tool
 * 
 * Provides integration guides for third-party APIs and services.
 * Returns static playbooks - does not implement code directly.
 */

// Integration playbooks database
const PLAYBOOKS: Record<string, {
    name: string;
    description: string;
    requirements: string[];
    steps: string[];
    code_example: string;
    env_vars: string[];
    common_issues: string[];
}> = {
    stripe: {
        name: 'Stripe Payments',
        description: 'Payment processing with Stripe',
        requirements: [
            'Stripe account (https://stripe.com)',
            'Stripe API keys (publishable + secret)',
            'Webhook endpoint for events',
        ],
        steps: [
            'Install stripe package: npm install stripe',
            'Add STRIPE_SECRET_KEY to environment',
            'Create checkout session endpoint',
            'Handle webhook events for payment confirmation',
            'Implement frontend checkout redirect',
        ],
        code_example: `// Backend: Create checkout session
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post('/api/checkout', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: req.body.items,
    mode: 'payment',
    success_url: \`\${process.env.APP_URL}/success\`,
    cancel_url: \`\${process.env.APP_URL}/cancel\`,
  });
  res.json({ sessionId: session.id });
});`,
        env_vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
        common_issues: [
            'Webhook signature verification failures',
            'Test vs live key confusion',
            'Missing idempotency keys for retries',
        ],
    },
    supabase: {
        name: 'Supabase',
        description: 'Backend-as-a-Service with PostgreSQL',
        requirements: [
            'Supabase account (https://supabase.com)',
            'Project URL and anon key',
            'Database schema setup',
        ],
        steps: [
            'Install supabase-js: npm install @supabase/supabase-js',
            'Add SUPABASE_URL and SUPABASE_ANON_KEY to environment',
            'Initialize Supabase client',
            'Set up Row Level Security (RLS) policies',
            'Implement authentication if needed',
        ],
        code_example: `// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Query data
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId);`,
        env_vars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'],
        common_issues: [
            'RLS policies blocking queries',
            'Missing service role key for admin operations',
            'Realtime subscription setup',
        ],
    },
    openai: {
        name: 'OpenAI API',
        description: 'GPT and DALL-E integration',
        requirements: [
            'OpenAI account (https://platform.openai.com)',
            'API key with billing enabled',
            'Usage limits configured',
        ],
        steps: [
            'Install openai package: npm install openai',
            'Add OPENAI_API_KEY to environment',
            'Initialize OpenAI client',
            'Implement chat completion or image generation',
            'Add error handling for rate limits',
        ],
        code_example: `// Chat completion
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: userMessage },
  ],
});`,
        env_vars: ['OPENAI_API_KEY'],
        common_issues: [
            'Rate limiting (429 errors)',
            'Token limit exceeded',
            'API key billing not enabled',
        ],
    },
    firebase: {
        name: 'Firebase',
        description: 'Authentication, Firestore, and hosting',
        requirements: [
            'Firebase project (https://console.firebase.google.com)',
            'Firebase config object',
            'Service account for admin SDK',
        ],
        steps: [
            'Install firebase: npm install firebase',
            'Add Firebase config to environment',
            'Initialize Firebase app',
            'Set up authentication providers',
            'Configure Firestore security rules',
        ],
        code_example: `// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const auth = getAuth(app);`,
        env_vars: ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID'],
        common_issues: [
            'Security rules blocking access',
            'Auth state persistence issues',
            'CORS errors with custom domains',
        ],
    },
    twilio: {
        name: 'Twilio SMS/Voice',
        description: 'SMS and voice communications',
        requirements: [
            'Twilio account (https://www.twilio.com)',
            'Account SID and Auth Token',
            'Twilio phone number',
        ],
        steps: [
            'Install twilio: npm install twilio',
            'Add Twilio credentials to environment',
            'Initialize Twilio client',
            'Implement send SMS function',
            'Set up webhook for incoming messages',
        ],
        code_example: `// Send SMS
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

await client.messages.create({
  body: 'Hello from your app!',
  from: process.env.TWILIO_PHONE_NUMBER,
  to: recipientNumber,
});`,
        env_vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
        common_issues: [
            'Phone number format validation',
            'Geographic restrictions',
            'Webhook URL configuration',
        ],
    },
};

export function createIntegrationPlaybookTool(
    _agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'integration_playbook',
        description: `Get integration guides for third-party APIs and services.

Available integrations:
- stripe: Payment processing
- supabase: Backend-as-a-Service
- openai: AI/GPT integration
- firebase: Auth, database, hosting
- twilio: SMS and voice

Returns step-by-step guides with code examples.
Does not implement code directly - you must apply the playbook.`,
        args: {
            integration: t.string().describe('Integration name: stripe, supabase, openai, firebase, twilio'),
            specific_question: t.string().optional().describe('Specific question about the integration'),
        },
        run: async ({ integration, specific_question }) => {
            logger.info('Integration playbook requested', { integration });

            streamCb('\n\n📚 **Integration Playbook**\n\n');

            const playbook = PLAYBOOKS[integration.toLowerCase()];

            if (playbook) {
                streamCb(`## ${playbook.name}\n\n`);
                streamCb(`${playbook.description}\n\n`);

                streamCb('### Requirements\n');
                playbook.requirements.forEach(req => {
                    streamCb(`- ${req}\n`);
                });

                streamCb('\n### Environment Variables\n');
                playbook.env_vars.forEach(envVar => {
                    streamCb(`- \`${envVar}\`\n`);
                });

                streamCb('\n### Setup Steps\n');
                playbook.steps.forEach((step, i) => {
                    streamCb(`${i + 1}. ${step}\n`);
                });

                streamCb('\n### Code Example\n');
                streamCb('```typescript\n');
                streamCb(playbook.code_example);
                streamCb('\n```\n');

                streamCb('\n### Common Issues\n');
                playbook.common_issues.forEach(issue => {
                    streamCb(`- ${issue}\n`);
                });

                if (specific_question) {
                    streamCb(`\n### Your Question\n`);
                    streamCb(`Q: ${specific_question}\n`);
                    streamCb(`Refer to the documentation and common issues above for guidance.\n`);
                }

                toolRenderer({ 
                    name: 'integration_playbook', 
                    status: 'success', 
                    result: integration 
                });

                return {
                    success: true,
                    integration,
                    playbook: {
                        name: playbook.name,
                        requirements: playbook.requirements,
                        env_vars: playbook.env_vars,
                        steps: playbook.steps,
                    },
                };
            }

            // Integration not found
            streamCb(`Integration "${integration}" not found.\n\n`);
            streamCb('### Available Integrations\n');
            Object.entries(PLAYBOOKS).forEach(([key, value]) => {
                streamCb(`- **${key}**: ${value.description}\n`);
            });

            toolRenderer({ 
                name: 'integration_playbook', 
                status: 'success', 
                result: 'list' 
            });

            return {
                success: false,
                message: `Integration "${integration}" not found`,
                available: Object.keys(PLAYBOOKS),
            };
        },
    });
}
