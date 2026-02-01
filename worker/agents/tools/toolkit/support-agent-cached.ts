/**
 * Support Agent - Cached Version
 * 
 * Support agent with response caching for common queries.
 */

// Re-export the base support agent
export { createSupportAgentTool } from './support-agent';

// The base support-agent.ts provides all functionality.
// This file exists for backwards compatibility.
//
// Support responses are static and highly cacheable.
// The base tool's responses can be cached at the interceptor level.
