import React from 'react';
import './Header.css';

function Header({ theme, toggleTheme }) {
  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-title">
          <span className="logo">⚡</span>
          Emergent Clone
        </h1>
      </div>

      <div className="header-right">
        <button onClick={toggleTheme} className="theme-toggle">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}

export default Header;
