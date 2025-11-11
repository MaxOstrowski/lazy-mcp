import React, { useState, useEffect, useRef, useCallback } from 'react';
import SplitPane from 'react-split-pane';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false); // Start minimized
  const messagesEndRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    // Use PyWebView API instead of fetch
    if (window.pywebview) {
      const logs = await window.pywebview.api.get_logs();
      setLogs(logs);
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
    if (window.pywebview) {
      const reply = await window.pywebview.api.chat(input);
      setMessages(msgs => [
        ...msgs,
        ...reply.map(msg => ({ sender: 'api', text: msg })),
      ]);
      await fetchLogs();
    }
  };

  return (
    <div className="container">
      <SplitPane
        split="horizontal"
        minSize={50}
        defaultSize={logsOpen ? 200 : 0}
        size={logsOpen ? undefined : 0}
        onChange={size => setLogsOpen(size > 0)}
      >
        <div className="chat-window">
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
        <div className="log-window" style={{ display: logsOpen ? 'block' : 'none' }}>
          <button onClick={() => setLogsOpen(false)} style={{ float: 'right' }}>Minimize</button>
          <div className="logs">
            <h4>Logs</h4>
            {logs.map((log, idx) => (
              <div key={idx} className={`log-entry log-${log.level ? log.level.toLowerCase() : 'info'}`}>
                <b>[{log.level}]</b> {log.time}: {log.message}
              </div>
            ))}
          </div>
        </div>
      </SplitPane>
      {!logsOpen && (
        <button onClick={() => setLogsOpen(true)} style={{ position: 'absolute', bottom: 10, right: 10 }}>
          Show Logs
        </button>
      )}
    </div>
  );
}

export default App;
