/**
 * Testing Agent - Optimized Version
 * 
 * Testing agent with optimized execution.
 */

// Re-export the base testing agent
export { createTestingAgentTool } from './testing-agent';

// The base testing-agent.ts provides all functionality.
// This file exists for backwards compatibility.
//
// Note: Testing results should generally NOT be cached
// as they need to reflect the current state of the code.
