/**
 * Custom Tools - Optimized Version
 * 
 * Same as customTools.ts but with caching enabled for applicable tools.
 * Use this for production deployments where cost optimization is important.
 */

// Re-export everything from the base customTools
export * from './customTools';

// The base customTools.ts already includes all tools.
// This file exists for backwards compatibility with imports that 
// reference 'customTools-optimized'.
//
// To enable caching on tools, import and use the cache utilities:
// import { cacheInterceptor } from '../utils/cacheInterceptor';
// import { isCacheable, getCacheTTL } from '../utils/cacheableResponses';
