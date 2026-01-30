import React, { useState, useEffect } from 'react';
import './StatusBar.css';

function StatusBar() {
  const [status, setStatus] = useState({
    connected: false,
    activeAgents: 0
  });

  useEffect(() => {
    const interval = setInterval(fetchStatus, 5000);
    fetchStatus();
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const healthRes = await fetch('/api/health');
      const agentsRes = await fetch('/api/agent/active');
      const health = await healthRes.json();
      const agents = await agentsRes.json();

      setStatus({
        connected: health.status === 'healthy',
        activeAgents: agents.count
      });
    } catch (error) {
      setStatus(prev => ({ ...prev, connected: false }));
    }
  };

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className={`status-indicator ${status.connected ? 'connected' : 'disconnected'}`}>
          ●
        </span>
        <span>{status.connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="status-item">
        <span>🤖 Active Agents: {status.activeAgents}</span>
      </div>

      <div className="status-item ml-auto">
        <span>FastAPI + React + MongoDB</span>
      </div>
    </div>
  );
}

export default StatusBar;
