import React from 'react';
import { useAgent } from '../context/AgentContext';
import './AgentSelector.css';

function AgentSelector() {
  const { selectedAgent, setSelectedAgent } = useAgent();

  const agents = [
    { id: 'e1', name: 'E1', description: 'Fast & reliable', icon: '⚡' },
    { id: 'e1_5', name: 'E1.5', description: 'Thorough', icon: '🔍' },
    { id: 'e2', name: 'E2', description: 'Expert-level', icon: '🎯' }
  ];

  return (
    <div className="agent-selector">
      <label>Agent:</label>
      <select 
        value={selectedAgent} 
        onChange={(e) => setSelectedAgent(e.target.value)}
        className="agent-dropdown"
      >
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.icon} {agent.name} - {agent.description}
          </option>
        ))}
      </select>
    </div>
  );
}

export default AgentSelector;
