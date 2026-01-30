import React, { useState, useEffect } from 'react';
import './App.css';
import ChatInterface from './components/ChatInterface';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import { AgentProvider } from './context/AgentContext';

function App() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.body.className = savedTheme;
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.body.className = newTheme;
  };

  return (
    <AgentProvider>
      <div className="app">
        <Header theme={theme} toggleTheme={toggleTheme} />
        <div className="main-content">
          <ChatInterface />
        </div>
        <StatusBar />
      </div>
    </AgentProvider>
  );
}

export default App;
