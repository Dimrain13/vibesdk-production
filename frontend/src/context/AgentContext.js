import React, { createContext, useContext, useState } from 'react';
import { executeAgent } from '../api/agent';

const AgentContext = createContext();

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider');
  }
  return context;
}

export function AgentProvider({ children }) {
  const [selectedAgent, setSelectedAgent] = useState('e1');
  const [loading, setLoading] = useState(false);
  const userId = 'default-user';

  const sendMessage = async (message) => {
    setLoading(true);
    try {
      const response = await executeAgent({
        user_id: userId,
        request: message,
        tier: selectedAgent
      });
      return response;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    selectedAgent,
    setSelectedAgent,
    sendMessage,
    loading
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}
