// client/src/lib/queueProcessor.ts

import { orchestratorState } from './agentOrchestrator';
import { developmentAgent } from './agents/developmentAgent';

export interface PhaseStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  request: string;
  error?: string;
}

class QueueProcessor {
  private isProcessing = false;
  private currentPhase: PhaseStatus | null = null;
  private phaseHistory: PhaseStatus[] = [];
  private subscribers: Set<(status: PhaseStatus | null) => void> = new Set();

  constructor() {
    // Auto-start processing on initialization
    this.startProcessing();
  }

  /**
   * Subscribe to phase status updates
   */
  subscribe(callback: (status: PhaseStatus | null) => void): () => void {
    this.subscribers.add(callback);
    // Immediately send current status
    callback(this.currentPhase);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of status change
   */
  private notify() {
    this.subscribers.forEach(callback => callback(this.currentPhase));
  }

  /**
   * Get current phase status
   */
  getCurrentPhase(): PhaseStatus | null {
    return this.currentPhase;
  }

  /**
   * Get all phase history
   */
  getPhaseHistory(): PhaseStatus[] {
    return this.phaseHistory;
  }

  /**
   * Check if queue has items to process
   */
  private hasQueuedItems(): boolean {
    const state = orchestratorState.getState();
    return state.queuedRequests.length > 0;
  }

  /**
   * Start the queue processing loop
   */
  async startProcessing() {
    // Prevent multiple processing loops
    if (this.isProcessing) {
      console.log('[QueueProcessor] Already processing queue');
      return;
    }

    this.isProcessing = true;
    console.log('[QueueProcessor] Started queue processing');

    // Continuous processing loop
    while (this.isProcessing) {
      try {
        if (this.hasQueuedItems()) {
          await this.processNextItem();
        } else {
          // No items in queue, wait a bit before checking again
          await this.sleep(2000); // Check every 2 seconds
        }
      } catch (error) {
        console.error('[QueueProcessor] Error in processing loop:', error);
        // Continue processing even if one item fails
        await this.sleep(5000); // Wait longer on error
      }
    }
  }

  /**
   * Process the next item in the queue
   */
  private async processNextItem() {
    const state = orchestratorState.getState();
    
    if (state.queuedRequests.length === 0) {
      return;
    }

    // Dequeue first item
    const request = state.queuedRequests[0];
    
    // Create phase status
    const phaseId = `phase-${Date.now()}`;
    this.currentPhase = {
      id: phaseId,
      status: 'processing',
      startedAt: new Date(),
      request: request
    };

    // Notify subscribers
    this.notify();

    console.log(`[QueueProcessor] Processing request: ${request}`);

    try {
      // Remove from queue
      orchestratorState.setState({
        queuedRequests: state.queuedRequests.slice(1)
      });

      // Execute the development agent with this request
      const result = await developmentAgent.execute({
        userMessage: request,
        conversationHistory: state.conversationHistory,
        currentBlueprint: state.currentBlueprint,
        projectContext: state.projectContext
      });

      // Update state with result
      orchestratorState.setState({
        currentBlueprint: result.blueprint,
        conversationHistory: [
          ...state.conversationHistory,
          { role: 'user', content: request },
          { role: 'assistant', content: result.response }
        ],
        completedPhases: [
          ...state.completedPhases,
          {
            id: phaseId,
            request: request,
            response: result.response,
            completedAt: new Date()
          }
        ]
      });

      // Mark phase as completed
      this.currentPhase = {
        ...this.currentPhase,
        status: 'completed',
        completedAt: new Date()
      };

      this.phaseHistory.push(this.currentPhase);
      console.log(`[QueueProcessor] Completed phase: ${phaseId}`);

    } catch (error) {
      console.error('[QueueProcessor] Error processing request:', error);
      
      // Mark phase as failed
      this.currentPhase = {
        ...this.currentPhase,
        status: 'failed',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.phaseHistory.push(this.currentPhase);

      // Optionally: re-queue failed items or handle differently
      // For now, we'll just log and continue
    } finally {
      // Clear current phase after a short delay so UI can show completion
      await this.sleep(1000);
      this.currentPhase = null;
      this.notify();
    }
  }

  /**
   * Stop processing queue
   */
  stopProcessing() {
    console.log('[QueueProcessor] Stopping queue processing');
    this.isProcessing = false;
  }

  /**
   * Manually trigger processing of next item (for testing)
   */
  async processNext() {
    if (!this.hasQueuedItems()) {
      console.log('[QueueProcessor] No items in queue');
      return;
    }
    await this.processNextItem();
  }

  /**
   * Clear all queued items
   */
  clearQueue() {
    const state = orchestratorState.getState();
    orchestratorState.setState({
      queuedRequests: []
    });
    console.log('[QueueProcessor] Cleared queue');
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    const state = orchestratorState.getState();
    return {
      queueLength: state.queuedRequests.length,
      isProcessing: this.isProcessing,
      currentPhase: this.currentPhase,
      completedPhases: state.completedPhases.length
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const queueProcessor = new QueueProcessor();

// Export for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).queueProcessor = queueProcessor;
}
