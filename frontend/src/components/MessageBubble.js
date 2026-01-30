import React from 'react';
import './MessageBubble.css';

function MessageBubble({ message }) {
  const { role, content, timestamp, metadata } = message;

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`message-bubble ${role}`}>
      <div className="message-header">
        <span className="message-role">
          {role === 'user' ? 'You' : role === 'assistant' ? 'Agent' : 'System'}
        </span>
        <span className="message-time">{formatTime(timestamp)}</span>
      </div>

      <div className="message-content">
        <p>{content}</p>
      </div>

      {metadata && (
        <div className="message-metadata">
          <span className="metadata-item">
            Session: {metadata.session_id?.substring(0, 8)}
          </span>
          {metadata.duration && (
            <span className="metadata-item">
              {metadata.duration.toFixed(2)}s
            </span>
          )}
          {metadata.tokens && (
            <span className="metadata-item">
              {metadata.tokens} tokens
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageBubble;
