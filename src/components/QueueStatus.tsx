// client/src/components/QueueStatus.tsx

import React, { useEffect, useState } from 'react';
import { queueProcessor, PhaseStatus } from '../lib/queueProcessor';
import { orchestratorState } from '../lib/agentOrchestrator';

export const QueueStatus: React.FC = () => {
  const [currentPhase, setCurrentPhase] = useState<PhaseStatus | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    // Subscribe to phase updates
    const unsubscribe = queueProcessor.subscribe((phase) => {
      setCurrentPhase(phase);
    });

    // Poll for queue length updates
    const interval = setInterval(() => {
      const status = queueProcessor.getQueueStatus();
      setQueueLength(status.queueLength);
      setCompletedCount(status.completedPhases);
    }, 1000);

    // Initial load
    const status = queueProcessor.getQueueStatus();
    setQueueLength(status.queueLength);
    setCompletedCount(status.completedPhases);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Don't show anything if there's no activity
  if (!currentPhase && queueLength === 0) {
    return null;
  }

  return (
    <div className="queue-status-container">
      {/* Current Phase Processing */}
      {currentPhase && (
        <div className={`current-phase phase-${currentPhase.status}`}>
          <div className="phase-header">
            <div className="phase-spinner">
              {currentPhase.status === 'processing' && (
                <div className="spinner"></div>
              )}
              {currentPhase.status === 'completed' && (
                <span className="checkmark">✓</span>
              )}
              {currentPhase.status === 'failed' && (
                <span className="error-mark">✗</span>
              )}
            </div>
            <div className="phase-info">
              <div className="phase-status">
                {currentPhase.status === 'processing' && 'Processing...'}
                {currentPhase.status === 'completed' && 'Completed'}
                {currentPhase.status === 'failed' && 'Failed'}
              </div>
              <div className="phase-request">{currentPhase.request}</div>
            </div>
          </div>
          {currentPhase.error && (
            <div className="phase-error">{currentPhase.error}</div>
          )}
        </div>
      )}

      {/* Queue Information */}
      {queueLength > 0 && (
        <div className="queue-info">
          <div className="queue-count">
            <span className="queue-number">{queueLength}</span>
            <span className="queue-label">
              {queueLength === 1 ? 'request' : 'requests'} in queue
            </span>
          </div>
        </div>
      )}

      {/* Completed Phases Counter */}
      <div className="completed-info">
        <span className="completed-count">{completedCount}</span>
        <span className="completed-label">phases completed</span>
      </div>

      <style jsx>{`
        .queue-status-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 16px;
          min-width: 300px;
          max-width: 400px;
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .current-phase {
          margin-bottom: 12px;
          padding: 12px;
          border-radius: 8px;
          background: #f8f9fa;
        }

        .phase-processing {
          border-left: 4px solid #ff8c42;
        }

        .phase-completed {
          border-left: 4px solid #4caf50;
        }

        .phase-failed {
          border-left: 4px solid #f44336;
        }

        .phase-header {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .phase-spinner {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #ff8c42;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .checkmark {
          color: #4caf50;
          font-size: 20px;
          font-weight: bold;
        }

        .error-mark {
          color: #f44336;
          font-size: 20px;
          font-weight: bold;
        }

        .phase-info {
          flex: 1;
        }

        .phase-status {
          font-weight: 600;
          font-size: 14px;
          color: #333;
          margin-bottom: 4px;
        }

        .phase-request {
          font-size: 13px;
          color: #666;
          line-height: 1.4;
        }

        .phase-error {
          margin-top: 8px;
          padding: 8px;
          background: #ffebee;
          border-radius: 4px;
          font-size: 12px;
          color: #c62828;
        }

        .queue-info {
          padding: 8px 12px;
          background: #fff3e0;
          border-radius: 6px;
          margin-bottom: 8px;
        }

        .queue-count {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .queue-number {
          font-weight: 700;
          font-size: 18px;
          color: #ff8c42;
        }

        .queue-label {
          font-size: 13px;
          color: #666;
        }

        .completed-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid #e0e0e0;
          font-size: 12px;
          color: #999;
        }

        .completed-count {
          font-weight: 600;
          color: #4caf50;
        }
      `}</style>
    </div>
  );
};

export default QueueStatus;
