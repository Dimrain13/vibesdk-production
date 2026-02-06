// client/src/lib/agentOrchestrator.ts - UPDATED VERSION

// Add this import at the top
import { queueProcessor } from './queueProcessor';

// ... rest of your existing imports and code ...

/**
 * Queue a request for later processing
 * This now automatically triggers processing
 */
export function queueRequest(request: string): void {
  const state = orchestratorState.getState();
  
  console.log('[Orchestrator] Queuing request:', request);
  
  // Add to queue
  orchestratorState.setState({
    queuedRequests: [...state.queuedRequests, request]
  });

  // The queueProcessor will automatically pick this up
  // No need to manually trigger - it's polling the queue
  
  console.log('[Orchestrator] Request queued. Current queue length:', 
              state.queuedRequests.length + 1);
}

/**
 * Get current processing status
 */
export function getProcessingStatus() {
  return queueProcessor.getQueueStatus();
}

/**
 * Clear all queued requests (emergency stop)
 */
export function clearQueue() {
  queueProcessor.clearQueue();
}

/**
 * Get current phase being processed
 */
export function getCurrentPhase() {
  return queueProcessor.getCurrentPhase();
}

/**
 * Get phase history
 */
export function getPhaseHistory() {
  return queueProcessor.getPhaseHistory();
}

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).orchestrator = {
    queueRequest,
    getProcessingStatus,
    clearQueue,
    getCurrentPhase,
    getPhaseHistory,
    getState: () => orchestratorState.getState()
  };
}

// ... rest of your existing code ...
