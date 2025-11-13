
import React, { useState, useEffect, useRef, useCallback } from 'react';
import SplitPane from 'react-split-pane';

function ChatWindow({ messages, input, setInput, sendMessage, messagesEndRef, onClearHistory }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="menu-container" ref={menuRef}>
          <button className="menu-btn" onClick={() => setMenuOpen(m => !m)} title="Menu">&#8942;</button>
          {menuOpen && (
            <div className="menu-dropdown">
              <button onClick={() => { setMenuOpen(false); onClearHistory(); }}>Clear History</button>
            </div>
          )}
        </div>
      </div>
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.sender === 'user' ? 'user-msg' : 'api-msg'}>
            <b>{msg.sender}:</b> {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="input-form" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          autoFocus
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

function LogWindow({ logs }) {
  return (
    <div className="log-window">
      <div className="logs">
        <h4>Logs</h4>
        {logs.map((log, idx) =>
          typeof log === 'string' ? (
            <div key={idx} className="log-entry">{log}</div>
          ) : (
            <div key={idx} className={`log-entry log-${log.level ? log.level.toLowerCase() : 'info'}`}>
              <b>[{log.level}]</b> {log.time}: {log.message}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState([]);
  const messagesEndRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('/logs');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setLogs(prevLogs =>
        Array.isArray(data.logs)
          ? [...prevLogs, ...data.logs]
          : [...prevLogs, { level: 'ERROR', message: 'Backend logs not available', time: '' }]
      );
    } catch (err) {
      setLogs([{ level: 'ERROR', message: `Error fetching logs: ${err.message}`, time: '' }]);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async e => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages(msgs => [...msgs, { sender: 'user', text: input }]);
    setInput('');
    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const data = await response.json();
      if (Array.isArray(data.reply)) {
        setMessages(msgs => [
          ...msgs,
          ...data.reply.map(msg => ({ sender: 'api', text: msg })),
        ]);
      } else {
        throw new Error('API reply is not a list of messages');
      }
      await fetchLogs();
    } catch (err) {
      setLogs([{ level: 'ERROR', message: `Error: ${err.message}`, time: '' }]);
    }
  };

  const handleClearHistory = async () => {
    try {
      const response = await fetch('/clear_history', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setMessages([]);
      } else {
        setLogs([{ level: 'ERROR', message: 'Failed to clear history', time: '' }]);
      }
    } catch (err) {
      setLogs([{ level: 'ERROR', message: `Error clearing history: ${err.message}`, time: '' }]);
    }
  };

  return (
    <div className="container">
      <SplitPane
        split="vertical"
        minSize={300}
        defaultSize="100%"
        style={{ height: '100vh' }}
        pane2Style={{ transition: 'width 0.2s', height: '100%' }}
      >
        <ChatWindow
          messages={messages}
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
          messagesEndRef={messagesEndRef}
          onClearHistory={handleClearHistory}
        />
        <LogWindow logs={logs} />
      </SplitPane>
    </div>
  );
}

export default App;
