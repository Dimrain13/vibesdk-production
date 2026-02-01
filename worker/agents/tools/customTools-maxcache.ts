/**
 * Custom Tools - Max Cache Version
 * 
 * Aggressive caching configuration for maximum cost savings.
 * Use this for development/testing where freshness is less critical.
 */

// Re-export everything from the base customTools
export * from './customTools';

// The base customTools.ts already includes all tools.
// This file exists for backwards compatibility with imports that 
// reference 'customTools-maxcache'.
//
// To enable aggressive caching, configure the cache with longer TTLs:
// import { AdvancedCache } from '../utils/advancedCache';
// const aggressiveCache = new AdvancedCache({ defaultTTL: 3600000 }); // 1 hour
