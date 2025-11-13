
import React, { useState, useEffect, useRef, useCallback } from 'react';
import SplitPane from 'react-split-pane';

function ChatWindow({ messages, input, setInput, sendMessage, messagesEndRef, onClearHistory, agent, setAgent, agents, refreshAgents }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [newAgent, setNewAgent] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
        setShowAgentInput(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);


  const handleSelectAgent = async (name) => {
    setAgent(name);
    setMenuOpen(false);
    await refreshAgents();
  };

  const handleNewAgentKeyDown = async (e) => {
    if (e.key === 'Enter' && newAgent.trim()) {
      setAgent(newAgent.trim());
      setMenuOpen(false);
      setNewAgent("");
      await refreshAgents();
    }
  };

  return (
    <div className="chat-window">
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.2em', padding: '8px 0', background: '#f7f7f7', borderBottom: '1px solid #eee' }}>
        Agent: <span style={{ color: '#2a7ae2' }}>{agent}</span>
      </div>
      <div className="chat-header">
        <div className="menu-container" ref={menuRef}>
          <button className="menu-btn" onClick={async () => { await refreshAgents(); setMenuOpen(m => !m); }} title="Menu">&#8942;</button>
          {menuOpen && (
            <div className="menu-dropdown">
              <button onClick={() => { setMenuOpen(false); onClearHistory(); }}>Clear History</button>
              <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
              <div style={{ padding: '0 8px 8px 8px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Open Agent</div>
                <select value={agent} onChange={e => handleSelectAgent(e.target.value)} style={{ width: '100%' }}>
                  {agents.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newAgent}
                  onChange={e => setNewAgent(e.target.value)}
                  onKeyDown={handleNewAgentKeyDown}
                  placeholder="New agent name (Enter to switch)"
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role === 'user' ? 'user-msg' : 'api-msg'}>
            <b>{msg.role}:</b> {msg.content}
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
  const [agent, setAgent] = useState('default');
  const [agents, setAgents] = useState(['default']);
  const messagesEndRef = useRef(null);

  // Fetch agent list
  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/agents');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      let data = await response.json();
      if (Array.isArray(data)) {
        // If current agent is not in the list, add it manually
        if (agent && !data.includes(agent)) {
          data = [agent, ...data];
        }
        setAgents(data);
      }
    } catch (err) {
      setAgents(['default']);
    }
  }, [agent]);

  // Fetch chat history for current agent
  const fetchHistory = useCallback(async (selectedAgent = agent) => {
    try {
      const response = await fetch(`/history?agent=${encodeURIComponent(selectedAgent)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err) {
      setLogs([{ level: 'ERROR', message: `Error fetching history: ${err.message}`, time: '' }]);
    }
  }, [agent]);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch(`/logs?agent=${encodeURIComponent(agent)}`);
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
  }, [agent]);

  // On mount, fetch agents and history
  useEffect(() => {
    fetchAgents();
    fetchHistory('default');
  }, []);

  // When agent changes, fetch history
  useEffect(() => {
    fetchHistory(agent);
  }, [agent, fetchHistory]);

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
    setMessages(msgs => [...msgs, { role: 'user', content: input }]);
    setInput('');
    try {
      const response = await fetch(`/chat?agent=${encodeURIComponent(agent)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const data = await response.json();
      if (Array.isArray(data.reply)) {
        setMessages(msgs => [
          ...msgs,
          ...data.reply.map(msg => ({ role: 'assistant', content: msg })),
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
      const response = await fetch(`/clear_history?agent=${encodeURIComponent(agent)}`, { method: 'POST' });
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
          agent={agent}
          setAgent={setAgent}
          agents={agents}
          refreshAgents={fetchAgents}
        />
        <LogWindow logs={logs} />
      </SplitPane>
    </div>
  );
}

export default App;
