import React, { useState, useEffect } from 'react';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logWidth, setLogWidth] = useState(40); // px, hidden by default
  const minLogWidth = 40;
  const maxLogWidth = 400;
  const handleDrag = (e) => {
    e.preventDefault();
    document.body.style.cursor = 'ew-resize';
    const startX = e.clientX;
    const startWidth = logWidth;
    function onMove(ev) {
      let newWidth = startWidth - (ev.clientX - startX); // Invert direction
      if (newWidth < minLogWidth) newWidth = minLogWidth;
      if (newWidth > maxLogWidth) newWidth = maxLogWidth;
      setLogWidth(newWidth);
      setShowLogs(newWidth > minLogWidth);
    }
    function onUp() {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const handleClick = () => {
    if (showLogs) {
      setLogWidth(minLogWidth);
      setShowLogs(false);
    } else {
      setLogWidth(300);
      setShowLogs(true);
    }
  };

  // Fetch logs from backend
  const fetchLogs = async () => {
    try {
      const response = await fetch('/logs');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data.logs)) {
        setLogs((prevLogs) => [...prevLogs, ...data.logs]);
      } else {
        setLogs((prevLogs) => [...prevLogs, { level: "ERROR", message: "Backend logs not available", time: "" }]);
      }
    } catch (err) {
      setLogs([{ level: "ERROR", message: `Error fetching logs: ${err.message}`, time: "" }]);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages([...messages, { sender: 'user', text: input }]);
    setInput('');
    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const data = await response.json();
      if (Array.isArray(data.reply)) {
        setMessages((msgs) => [
          ...msgs,
          ...data.reply.map((msg) => ({ sender: 'api', text: msg }))
        ]);
      } else {
        throw new Error('API reply is not a list of messages');
      }
      await fetchLogs(); // Update logs after sending/receiving
    } catch (err) {
      setLogs([`Error: ${err.message}`]);
    }
  };

  return (
    <div className="container">
      <div className="chat-window">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={msg.sender === 'user' ? 'user-msg' : 'api-msg'}>
              <b>{msg.sender}:</b> {msg.text}
            </div>
          ))}
        </div>
        <form className="input-form" onSubmit={sendMessage}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            autoFocus
          />
          <button type="submit">Send</button>
        </form>
      </div>
      <div
        className="log-resize-handle"
        onMouseDown={handleDrag}
        onClick={handleClick}
        title={showLogs ? 'Hide logs (click) or resize (drag)' : 'Show logs (click) or resize (drag)'}
      >
        <div className="log-handle-marker" />
      </div>
      <div
        className="log-window"
        style={{ width: logWidth, minWidth: logWidth, maxWidth: logWidth }}
      >
        {showLogs && (
          <div className="logs">
            <h4>Logs</h4>
            {logs.map((log, idx) => (
              typeof log === 'string' ? (
                <div key={idx} className="log-entry">{log}</div>
              ) : (
                <div key={idx} className={`log-entry log-${log.level ? log.level.toLowerCase() : 'info'}`}>
                  <b>[{log.level}]</b> {log.time}: {log.message}
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
