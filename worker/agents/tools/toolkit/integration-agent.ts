import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { ICodingAgent } from '../../services/interfaces/ICodingAgent';
import { RenderToolCall } from '../../operations/UserConversationProcessor';
import { FileConceptType } from 'worker/agents/schemas';

/**
 * Integration Agent (Generative)
 * 
 * Specialized agent for implementing API and database integrations.
 * Unlike the old version that just streamed advice, this agent:
 * 1. Crawls live documentation when available
 * 2. Uses the integration registry for proven patterns
 * 3. Actually generates implementation files via agent.generateFiles()
 * 4. Creates env templates and type definitions
 * 
 * REPLACES: integration-agent.ts (advice-only version)
 */

// ============================================================================
// Integration Registry - Proven patterns with real code templates
// ============================================================================

interface IntegrationEntry {
    name: string;
    description: string;
    sdkPackage: string;
    additionalPackages?: string[];
    authPattern: 'secret_key_header' | 'bearer_token' | 'api_key_query' | 'oauth2' | 'connection_string' | 'project_config';
    envVars: Record<string, string>; // key -> description
    docsUrl: string;
    webhookSupport: boolean;
    fileTemplates: IntegrationFileTemplate[];
}

interface IntegrationFileTemplate {
    path: string;
    description: string;
    template: string; // Code template with {{PLACEHOLDERS}}
}

const INTEGRATION_REGISTRY: Record<string, IntegrationEntry> = {
    stripe: {
        name: 'Stripe Payments',
        description: 'Payment processing, subscriptions, and billing',
        sdkPackage: 'stripe',
        authPattern: 'secret_key_header',
        envVars: {
            'STRIPE_SECRET_KEY': 'Stripe secret API key (sk_test_... or sk_live_...)',
            'STRIPE_PUBLISHABLE_KEY': 'Stripe publishable key for frontend (pk_test_... or pk_live_...)',
            'STRIPE_WEBHOOK_SECRET': 'Webhook signing secret (whsec_...)',
        },
        docsUrl: 'https://docs.stripe.com/api',
        webhookSupport: true,
        fileTemplates: [
            {
                path: 'src/lib/stripe.ts',
                description: 'Stripe client initialization and utility functions',
                template: `import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

export default stripe;

/**
 * Create a Stripe Checkout session
 */
export async function createCheckoutSession(params: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  metadata?: Record<string, string>;
}) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer: params.customerId,
    metadata: params.metadata,
  });
}

/**
 * Create a subscription checkout session
 */
export async function createSubscriptionSession(params: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
}) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer: params.customerId,
  });
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}

/**
 * Get customer by ID
 */
export async function getCustomer(customerId: string) {
  return stripe.customers.retrieve(customerId);
}

/**
 * Create a new customer
 */
export async function createCustomer(params: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}) {
  return stripe.customers.create(params);
}`,
            },
        ],
    },

    supabase: {
        name: 'Supabase',
        description: 'Backend-as-a-Service with PostgreSQL, Auth, Storage, and Realtime',
        sdkPackage: '@supabase/supabase-js',
        authPattern: 'project_config',
        envVars: {
            'SUPABASE_URL': 'Supabase project URL (https://xxx.supabase.co)',
            'SUPABASE_ANON_KEY': 'Supabase anon/public key for client-side access',
            'SUPABASE_SERVICE_KEY': 'Supabase service role key for server-side admin operations',
        },
        docsUrl: 'https://supabase.com/docs/reference/javascript/introduction',
        webhookSupport: false,
        fileTemplates: [
            {
                path: 'src/lib/supabase.ts',
                description: 'Supabase client initialization for client and server',
                template: `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Client-side Supabase client (uses anon key, respects RLS)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-side Supabase client (uses service key, bypasses RLS)
 * Only use in API routes / server functions
 */
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY is required for server-side operations');
  }
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Type-safe query helper
 */
export async function query<T>(
  table: string,
  options?: {
    select?: string;
    filter?: Record<string, unknown>;
    limit?: number;
    order?: { column: string; ascending?: boolean };
  }
) {
  let q = supabase.from(table).select(options?.select || '*');

  if (options?.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      q = q.eq(key, value);
    }
  }

  if (options?.order) {
    q = q.order(options.order.column, { ascending: options.order.ascending ?? true });
  }

  if (options?.limit) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data as T[];
}`,
            },
        ],
    },

    auth0: {
        name: 'Auth0',
        description: 'Authentication and authorization platform',
        sdkPackage: '@auth0/nextjs-auth0',
        additionalPackages: ['@auth0/auth0-react'],
        authPattern: 'oauth2',
        envVars: {
            'AUTH0_SECRET': 'Long random string for session encryption (use `openssl rand -hex 32`)',
            'AUTH0_BASE_URL': 'Your application base URL (http://localhost:3000)',
            'AUTH0_ISSUER_BASE_URL': 'Auth0 tenant URL (https://your-tenant.auth0.com)',
            'AUTH0_CLIENT_ID': 'Auth0 application client ID',
            'AUTH0_CLIENT_SECRET': 'Auth0 application client secret',
        },
        docsUrl: 'https://auth0.com/docs/quickstarts/webapp',
        webhookSupport: false,
        fileTemplates: [
            {
                path: 'src/lib/auth.ts',
                description: 'Auth0 configuration and helper functions',
                template: `// Auth0 configuration
export const auth0Config = {
  domain: process.env.AUTH0_ISSUER_BASE_URL?.replace('https://', '') || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
  audience: process.env.AUTH0_AUDIENCE,
};

/**
 * Check if user is authenticated (client-side)
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('auth_token');
}

/**
 * Get auth headers for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return token ? { Authorization: \`Bearer \${token}\` } : {};
}`,
            },
        ],
    },

    clerk: {
        name: 'Clerk',
        description: 'Drop-in authentication with prebuilt UI components',
        sdkPackage: '@clerk/nextjs',
        additionalPackages: ['@clerk/themes'],
        authPattern: 'project_config',
        envVars: {
            'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY': 'Clerk publishable key (pk_test_... or pk_live_...)',
            'CLERK_SECRET_KEY': 'Clerk secret key (sk_test_... or sk_live_...)',
            'NEXT_PUBLIC_CLERK_SIGN_IN_URL': 'Sign-in page route (e.g., /sign-in)',
            'NEXT_PUBLIC_CLERK_SIGN_UP_URL': 'Sign-up page route (e.g., /sign-up)',
        },
        docsUrl: 'https://clerk.com/docs/quickstarts/react',
        webhookSupport: true,
        fileTemplates: [
            {
                path: 'src/lib/clerk.ts',
                description: 'Clerk auth utilities and middleware helpers',
                template: `/**
 * Clerk Auth Utilities
 * 
 * Wrap your app with <ClerkProvider> in your root layout.
 * Use <SignInButton>, <SignUpButton>, <UserButton> components.
 */

export const clerkConfig = {
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
  signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in',
  signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up',
  afterSignInUrl: '/',
  afterSignUpUrl: '/',
};

/**
 * Protected routes configuration
 * Add paths that require authentication
 */
export const protectedRoutes = [
  '/dashboard(.*)',
  '/api/protected(.*)',
  '/settings(.*)',
];

/**
 * Public routes that don't require authentication
 */
export const publicRoutes = [
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/public(.*)',
  '/api/webhooks(.*)',
];`,
            },
        ],
    },

    resend: {
        name: 'Resend',
        description: 'Email API for developers',
        sdkPackage: 'resend',
        authPattern: 'secret_key_header',
        envVars: {
            'RESEND_API_KEY': 'Resend API key (re_...)',
            'RESEND_FROM_EMAIL': 'Verified sender email (e.g., noreply@yourdomain.com)',
        },
        docsUrl: 'https://resend.com/docs/send-with-nextjs',
        webhookSupport: true,
        fileTemplates: [
            {
                path: 'src/lib/email.ts',
                description: 'Email sending utilities with Resend',
                template: `import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Send a transactional email
 */
export async function sendEmail(params: SendEmailParams) {
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
    reply_to: params.replyTo,
  });

  if (error) {
    console.error('Failed to send email:', error);
    throw new Error(\`Email send failed: \${error.message}\`);
  }

  return data;
}

/**
 * Send a welcome email
 */
export async function sendWelcomeEmail(to: string, name: string) {
  return sendEmail({
    to,
    subject: 'Welcome!',
    html: \`<h1>Welcome, \${name}!</h1><p>Thanks for signing up.</p>\`,
  });
}`,
            },
        ],
    },

    prisma: {
        name: 'Prisma ORM',
        description: 'Type-safe database ORM with migrations',
        sdkPackage: 'prisma',
        additionalPackages: ['@prisma/client'],
        authPattern: 'connection_string',
        envVars: {
            'DATABASE_URL': 'Database connection string (postgresql://user:pass@host:5432/db)',
        },
        docsUrl: 'https://www.prisma.io/docs/getting-started/quickstart',
        webhookSupport: false,
        fileTemplates: [
            {
                path: 'src/lib/db.ts',
                description: 'Prisma client singleton',
                template: `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Prisma client singleton — prevents multiple instances in development
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;`,
            },
        ],
    },

    drizzle: {
        name: 'Drizzle ORM',
        description: 'Lightweight TypeScript ORM with SQL-like query builder',
        sdkPackage: 'drizzle-orm',
        additionalPackages: ['drizzle-kit'],
        authPattern: 'connection_string',
        envVars: {
            'DATABASE_URL': 'Database connection string',
        },
        docsUrl: 'https://orm.drizzle.team/docs/get-started',
        webhookSupport: false,
        fileTemplates: [
            {
                path: 'src/lib/db.ts',
                description: 'Drizzle client setup',
                template: `import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export default db;`,
            },
        ],
    },

    twilio: {
        name: 'Twilio',
        description: 'SMS, voice, and communication APIs',
        sdkPackage: 'twilio',
        authPattern: 'secret_key_header',
        envVars: {
            'TWILIO_ACCOUNT_SID': 'Twilio Account SID (AC...)',
            'TWILIO_AUTH_TOKEN': 'Twilio Auth Token',
            'TWILIO_PHONE_NUMBER': 'Twilio phone number (+1234567890)',
        },
        docsUrl: 'https://www.twilio.com/docs/sms/quickstart/node',
        webhookSupport: true,
        fileTemplates: [
            {
                path: 'src/lib/twilio.ts',
                description: 'Twilio SMS client',
                template: `import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

/**
 * Send an SMS message
 */
export async function sendSMS(to: string, body: string) {
  return client.messages.create({
    body,
    from: fromNumber,
    to,
  });
}

/**
 * Send a verification code via SMS
 */
export async function sendVerificationCode(to: string, code: string) {
  return sendSMS(to, \`Your verification code is: \${code}\`);
}`,
            },
        ],
    },

    openai: {
        name: 'OpenAI',
        description: 'GPT, DALL-E, and Whisper APIs',
        sdkPackage: 'openai',
        authPattern: 'bearer_token',
        envVars: {
            'OPENAI_API_KEY': 'OpenAI API key (sk-...)',
        },
        docsUrl: 'https://platform.openai.com/docs/quickstart',
        webhookSupport: false,
        fileTemplates: [
            {
                path: 'src/lib/openai.ts',
                description: 'OpenAI client with chat and image generation',
                template: `import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;

/**
 * Chat completion
 */
export async function chat(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: { model?: string; temperature?: number; maxTokens?: number }
) {
  const completion = await openai.chat.completions.create({
    model: options?.model ?? 'gpt-4o-mini',
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1000,
  });
  return completion.choices[0]?.message?.content ?? '';
}

/**
 * Generate an image with DALL-E
 */
export async function generateImage(prompt: string, size: '1024x1024' | '1792x1024' = '1024x1024') {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size,
  });
  return response.data[0]?.url;
}`,
            },
        ],
    },

    sentry: {
        name: 'Sentry',
        description: 'Error tracking and performance monitoring',
        sdkPackage: '@sentry/react',
        additionalPackages: ['@sentry/node'],
        authPattern: 'project_config',
        envVars: {
            'SENTRY_DSN': 'Sentry Data Source Name (https://xxx@xxx.ingest.sentry.io/xxx)',
            'SENTRY_AUTH_TOKEN': 'Sentry auth token for source maps (optional)',
        },
        docsUrl: 'https://docs.sentry.io/platforms/javascript/guides/react/',
        webhookSupport: true,
        fileTemplates: [
            {
                path: 'src/lib/sentry.ts',
                description: 'Sentry initialization',
                template: `import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not set, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });
}

export { Sentry };`,
            },
        ],
    },
};

// ============================================================================
// Helper: Generate .env.example content
// ============================================================================

function generateEnvExample(entries: Record<string, string>): string {
    let content = '# Integration Environment Variables\n';
    content += '# Copy this file to .env and fill in your values\n\n';
    for (const [key, description] of Object.entries(entries)) {
        content += `# ${description}\n`;
        content += `${key}=\n\n`;
    }
    return content;
}

// ============================================================================
// Main Tool
// ============================================================================

export function createIntegrationAgentTool(
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'integration_agent',
        description: `Specialized agent for implementing API and service integrations.
This agent GENERATES ACTUAL CODE FILES — not just advice.

For known services, it uses proven integration patterns from a built-in registry.
For unknown services, it generates boilerplate based on the integration type.

Known services: ${Object.keys(INTEGRATION_REGISTRY).join(', ')}

Use this for:
- REST/GraphQL API integrations
- Database connections (Prisma, Drizzle, Supabase)
- Authentication (Auth0, Clerk, custom OAuth)
- Payment processing (Stripe)
- Email (Resend, SendGrid)
- Error tracking (Sentry)
- Any third-party service integration

This agent will:
1. Look up proven patterns from the integration registry
2. Generate implementation files using agent.generateFiles()
3. Create .env.example with required variables
4. Provide setup instructions`,
        args: {
            service_name: t.string().describe('Service to integrate (e.g., stripe, supabase, auth0, clerk, prisma, resend, twilio, openai, sentry)'),
            requirements: t.string().describe('What the integration needs to do (e.g., "Accept payments with checkout sessions and handle webhooks")'),
            target_directory: t.string().optional().describe('Where to place files (default: src/lib/)'),
            additional_context: t.string().optional().describe('Any existing code patterns, framework details, or constraints'),
        },
        run: async ({ service_name, requirements, target_directory, additional_context }) => {
            const normalizedName = service_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            logger.info('Integration agent (generative) invoked', { service_name: normalizedName, requirements });

            streamCb('\n\n🔌 **Integration Agent**\n\n');
            streamCb(`**Service:** ${service_name}\n`);
            streamCb(`**Requirements:** ${requirements}\n\n`);

            // Look up in registry
            const entry = INTEGRATION_REGISTRY[normalizedName];

            if (entry) {
                return await generateFromRegistry(
                    entry, requirements, target_directory, additional_context,
                    agent, logger, toolRenderer, streamCb
                );
            }

            // Unknown service — generate generic integration
            return await generateGenericIntegration(
                service_name, requirements, target_directory, additional_context,
                agent, logger, toolRenderer, streamCb
            );
        },
    });
}

/**
 * Generate integration from a known registry entry
 */
async function generateFromRegistry(
    entry: IntegrationEntry,
    requirements: string,
    targetDir: string | undefined,
    additionalContext: string | undefined,
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void,
) {
    streamCb(`✅ Found **${entry.name}** in integration registry\n\n`);

    // Show what will be generated
    streamCb('**Packages to install:**\n');
    const allPackages = [entry.sdkPackage, ...(entry.additionalPackages || [])];
    streamCb(`\`npm install ${allPackages.join(' ')}\`\n\n`);

    streamCb('**Environment variables needed:**\n');
    for (const [key, desc] of Object.entries(entry.envVars)) {
        streamCb(`- \`${key}\` — ${desc}\n`);
    }

    streamCb('\n**Generating implementation files...**\n\n');

    // Build file concepts for generation
    const basePath = targetDir || 'src/lib';
    const fileConcepts: FileConceptType[] = [];
    const detailedRequirements: string[] = [
        `Integrate ${entry.name}: ${entry.description}`,
        `User requirements: ${requirements}`,
        `SDK package: ${entry.sdkPackage}`,
        `Auth pattern: ${entry.authPattern}`,
        `Environment variables: ${Object.keys(entry.envVars).join(', ')}`,
    ];

    if (entry.webhookSupport) {
        detailedRequirements.push(`Include webhook handling with signature verification`);
    }

    if (additionalContext) {
        detailedRequirements.push(`Additional context: ${additionalContext}`);
    }

    // Add template files as concepts
    for (const tmpl of entry.fileTemplates) {
        const adjustedPath = targetDir ? tmpl.path.replace('src/lib/', `${targetDir}/`) : tmpl.path;
        fileConcepts.push({
            path: adjustedPath,
            purpose: tmpl.description,
            changes: null,
        });
        detailedRequirements.push(
            `File "${adjustedPath}" should implement: ${tmpl.description}. ` +
            `Use this as a starting pattern:\n${tmpl.template}`
        );
    }

    // Add env example file
    fileConcepts.push({
        path: '.env.example',
        purpose: `Environment variable template for ${entry.name} integration`,
        changes: null,
    });
    detailedRequirements.push(
        `File ".env.example" should contain:\n${generateEnvExample(entry.envVars)}`
    );

    // Add types file if complex integration
    if (entry.webhookSupport || Object.keys(entry.envVars).length > 2) {
        const typesPath = `${basePath}/${normalizeForPath(entry.name)}-types.ts`;
        fileConcepts.push({
            path: typesPath,
            purpose: `TypeScript type definitions for ${entry.name} integration`,
            changes: null,
        });
        detailedRequirements.push(
            `File "${typesPath}" should export TypeScript interfaces/types for the ${entry.name} integration ` +
            `including request/response types, configuration types, and any webhook event types.`
        );
    }

    // Generate the actual files
    try {
        const result = await agent.generateFiles(
            `${entry.name} Integration`,
            `Implement ${entry.name} integration: ${requirements}`,
            detailedRequirements,
            fileConcepts,
        );

        streamCb(`\n✅ **Generated ${result.files.length} files:**\n`);
        for (const file of result.files) {
            streamCb(`- \`${file.path}\`\n`);
        }

        // Install packages
        streamCb(`\n📦 **Installing packages...**\n`);
        try {
            await agent.execCommands(
                [`npm install ${allPackages.join(' ')} --save`],
                true,
                30000
            );
            streamCb(`✅ Installed: ${allPackages.join(', ')}\n`);
        } catch {
            streamCb(`⚠️ Auto-install failed. Run manually: \`npm install ${allPackages.join(' ')}\`\n`);
        }

        streamCb('\n---\n');
        streamCb(`\n📚 **Documentation:** ${entry.docsUrl}\n`);

        toolRenderer({
            name: 'integration_agent',
            status: 'success',
            result: `${entry.name}: ${result.files.length} files generated`,
        });

        return {
            success: true,
            service: entry.name,
            files_generated: result.files.map(f => f.path),
            packages: allPackages,
            env_vars: Object.keys(entry.envVars),
            docs_url: entry.docsUrl,
            webhook_support: entry.webhookSupport,
        };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Integration file generation failed', { service: entry.name, error: errMsg });

        streamCb(`\n❌ **Error generating files:** ${errMsg}\n`);
        streamCb(`\nFalling back to template code. You can manually create the files using the templates above.\n`);

        toolRenderer({
            name: 'integration_agent',
            status: 'error',
            result: errMsg,
        });

        return {
            success: false,
            service: entry.name,
            error: errMsg,
            packages: allPackages,
            env_vars: Object.keys(entry.envVars),
            docs_url: entry.docsUrl,
            fallback_templates: entry.fileTemplates.map(t => ({
                path: t.path,
                code: t.template,
            })),
        };
    }
}

/**
 * Generate a generic integration for unknown services
 */
async function generateGenericIntegration(
    serviceName: string,
    requirements: string,
    targetDir: string | undefined,
    additionalContext: string | undefined,
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void,
) {
    streamCb(`⚡ "${serviceName}" not in registry — generating custom integration\n\n`);
    streamCb(`**Available pre-built integrations:** ${Object.keys(INTEGRATION_REGISTRY).join(', ')}\n\n`);

    const basePath = targetDir || 'src/lib';
    const safeName = normalizeForPath(serviceName);

    const fileConcepts: FileConceptType[] = [
        {
            path: `${basePath}/${safeName}.ts`,
            purpose: `${serviceName} client initialization and utility functions`,
            changes: null,
        },
        {
            path: '.env.example',
            purpose: `Environment variable template for ${serviceName}`,
            changes: null,
        },
    ];

    const detailedRequirements = [
        `Create a ${serviceName} integration.`,
        `Requirements: ${requirements}`,
        `Create a clean, typed client module at ${basePath}/${safeName}.ts`,
        `Use environment variables for all secrets/credentials (never hardcode)`,
        `Include proper error handling with try-catch`,
        `Add JSDoc comments for all exported functions`,
        `Include TypeScript types for all parameters and return values`,
        `Add retry logic for network requests`,
        `Create .env.example with all required variables`,
    ];

    if (additionalContext) {
        detailedRequirements.push(`Additional context: ${additionalContext}`);
    }

    try {
        streamCb('**Generating implementation files...**\n\n');

        const result = await agent.generateFiles(
            `${serviceName} Integration`,
            `Custom integration for ${serviceName}: ${requirements}`,
            detailedRequirements,
            fileConcepts,
        );

        streamCb(`\n✅ **Generated ${result.files.length} files:**\n`);
        for (const file of result.files) {
            streamCb(`- \`${file.path}\`\n`);
        }

        toolRenderer({
            name: 'integration_agent',
            status: 'success',
            result: `${serviceName}: ${result.files.length} files generated`,
        });

        return {
            success: true,
            service: serviceName,
            files_generated: result.files.map(f => f.path),
            custom: true,
        };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Generic integration generation failed', { service: serviceName, error: errMsg });

        streamCb(`\n❌ **Error:** ${errMsg}\n`);
        toolRenderer({ name: 'integration_agent', status: 'error', result: errMsg });

        return {
            success: false,
            service: serviceName,
            error: errMsg,
        };
    }
}

/**
 * Convert a service name to a safe file path segment
 */
function normalizeForPath(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
