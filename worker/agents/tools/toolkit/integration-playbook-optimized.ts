/**
 * Integration Playbook - Optimized Version
 * 
 * Integration playbook with response caching.
 */

// Re-export the base integration playbook
export { createIntegrationPlaybookTool } from './integration-playbook';

// The base integration-playbook.ts provides all functionality.
// This file exists for backwards compatibility.
//
// Integration guides are static and highly cacheable.
// The base tool's responses can be cached at the interceptor level.
