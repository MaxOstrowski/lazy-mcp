import React, { useState } from 'react';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState([]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages([...messages, { sender: 'user', text: input }]);
    setLogs([...logs, `Sent: ${input}`]);
    setInput('');
    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const data = await response.json();
      setMessages((msgs) => [...msgs, { sender: 'api', text: data.reply }]);
      setLogs((lgs) => [...lgs, `Received: ${data.reply}`]);
    } catch (err) {
      setLogs((lgs) => [...lgs, `Error: ${err.message}`]);
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
      <div className="log-window">
        <div className="logs">
          <h4>Logs</h4>
          {logs.map((log, idx) => (
            <div key={idx} className="log-entry">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
