/**
 * Design Agent - Cached Version
 * 
 * Design agent with response caching for repeated queries.
 */

// Re-export the base design agent
export { createDesignAgentTool } from './design-agent';

// The base design-agent.ts provides all functionality.
// This file exists for backwards compatibility.
//
// Design recommendations are static and highly cacheable.
// The base tool's responses can be cached at the interceptor level.
