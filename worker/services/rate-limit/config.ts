export enum RateLimitStore {
	DURABLE_OBJECT = 'durable_object',
}

export interface RateLimitConfig {
	enabled: boolean;
	store: RateLimitStore;
	limit: number;
	period: number; // in seconds
	dailyLimit?: number;
	excludeBYOKUsers?: boolean;
}

export type RateLimitConfigKey = 'agentRequest' | 'auth' | 'llmCalls' | 'appCreation';

export const rateLimitConfigs: Record<RateLimitConfigKey, RateLimitConfig> = {
	agentRequest: {
		enabled: true,
		store: RateLimitStore.DURABLE_OBJECT,
		limit: 100,
		period: 60, // 1 minute
	},
	auth: {
		enabled: true,
		store: RateLimitStore.DURABLE_OBJECT,
		limit: 10,
		period: 60, // 1 minute
	},
	llmCalls: {
		enabled: false,  // DISABLED for self-hosted
		store: RateLimitStore.DURABLE_OBJECT,
		limit: 500,
		period: 2 * 60 * 60, // 2 hour
		dailyLimit: 1700,
		excludeBYOKUsers: true,
	},
	appCreation: {
		enabled: false,  // DISABLED for self-hosted
		store: RateLimitStore.DURABLE_OBJECT,
		limit: 10,
		dailyLimit: 10,
		period: 4 * 60 * 60, // 4 hour
	},
};
