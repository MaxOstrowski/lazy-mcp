import { useState, useEffect, useRef, useCallback } from 'react';
import SplitPane from 'react-split-pane';

function ChatWindow({ messages, input, setInput, sendMessage, messagesEndRef, onClearHistory, agent, setAgent, agents, refreshAgents, deleteAgent, setDeleteAgent, handleDeleteAgent }) {
  // Toggle allowed flag for a function
  const handleFunctionAllowedChange = async (serverName, functionName, allowed) => {
    const updated = { ...servers };
    if (updated[serverName] && updated[serverName].functions && updated[serverName].functions[functionName]) {
      updated[serverName].functions[functionName].allowed = allowed;
      setServers(updated);
      // PATCH to backend to persist change
      await fetch(`/servers/update_flag?agent=${encodeURIComponent(agent)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_name: serverName,
          function_name: functionName,
          flag_name: 'allowed',
          value: allowed
        }),
      });
    }
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [servers, setServers] = useState({});
  const [expandedServers, setExpandedServers] = useState({});

  // Fetch servers when menu opens or agent changes
  useEffect(() => {
    if (menuOpen) {
      fetch(`/servers?agent=${encodeURIComponent(agent)}`)
        .then(res => res.json())
        .then(data => setServers(data.servers || {}));
    }
  }, [menuOpen, agent]);

  // Toggle expand/collapse for a server
  const toggleExpandServer = (serverName) => {
    setExpandedServers(prev => ({ ...prev, [serverName]: !prev[serverName] }));
  };

  // Toggle allowed flag for a server
  const handleServerAllowedChange = async (serverName, allowed) => {
    const updated = { ...servers };
    if (updated[serverName]) {
      updated[serverName].allowed = allowed;
      setServers(updated);
      // PATCH to backend to persist change
      await fetch(`/servers/update_flag?agent=${encodeURIComponent(agent)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_name: serverName,
          function_name: '',
          flag_name: 'allowed',
          value: allowed
        }),
      });
    }
  };
  const [newAgent, setNewAgent] = useState("");
  const menuRef = useRef(null);
  const prevDeleteAgent = useRef("");
  // Handle delete agent selection with confirmation
  const handleDeleteAgentSelect = async (e) => {
    const selected = e.target.value;
    if (selected && selected !== "default" && selected !== prevDeleteAgent.current) {
      // Show confirmation popup
      if (window.confirm(`Are you sure you want to delete agent '${selected}'?`)) {
        setDeleteAgent(selected);
        await handleDeleteAgent(selected);
      }
      setDeleteAgent("");
      prevDeleteAgent.current = ""; // Reset so confirmation shows again next time
    } else {
      setDeleteAgent(selected);
      prevDeleteAgent.current = selected;
    }
  };

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
      <div className="agent-header">
        Agent: <span className="agent-name">{agent}</span>
      </div>
      <div className="chat-header">
        <div className="menu-container" ref={menuRef}>
          <button className="menu-btn" onClick={async () => { await refreshAgents(); setMenuOpen(m => !m); }} title="Menu">&#8942;</button>
          {menuOpen && (
              <div className="menu-dropdown">
                <button onClick={() => { setMenuOpen(false); onClearHistory(); }}>Clear History</button>
                <div className="menu-divider" />
                <div className="menu-section">
                  <div className="menu-section-title">Open Agent</div>
                  <select className="menu-select" value={agent} onChange={e => handleSelectAgent(e.target.value)}>
                    {agents.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <span className="menu-agent-gap" />
                  <input
                    className="menu-input menu-input-wide"
                    type="text"
                    value={newAgent}
                    onChange={e => setNewAgent(e.target.value)}
                    onKeyDown={handleNewAgentKeyDown}
                    placeholder="New agent name (Enter to switch)"
                  />
                </div>
                <div className="menu-divider" />
                <div className="menu-section">
                  <div className="menu-section-title">Delete Agent</div>
                  <select className="menu-select" value={deleteAgent} onChange={handleDeleteAgentSelect}>
                    <option value="">Select agent</option>
                    {agents.filter(a => a !== "default").map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="menu-divider" />
                <div className="menu-section">
                  <div className="menu-section-title">Servers</div>
                  <div className="servers-list">
                    {Object.entries(servers).map(([serverName, server]) => (
                      <div key={serverName} className="server-item">
                        <div className="server-label-row">
                          <input
                            type="checkbox"
                            checked={server.allowed !== false}
                            onChange={e => handleServerAllowedChange(serverName, e.target.checked)}
                            onClick={e => e.stopPropagation()}
                          />
                          <span
                            className="server-name clickable-server"
                            onClick={() => toggleExpandServer(serverName)}
                          >
                            {serverName}
                          </span>
                          <span
                            className="server-expand-toggle"
                            onClick={e => { e.stopPropagation(); toggleExpandServer(serverName); }}
                          >
                            {expandedServers[serverName] ? '▼' : '▶'}
                          </span>
                        </div>
                        {expandedServers[serverName] && server.functions && (
                          <ul className="server-functions">
                            {Object.entries(server.functions).map(([fname, f]) => (
                              <li key={fname} className="function-item">
                                <input
                                  type="checkbox"
                                  checked={f.allowed !== false}
                                  onChange={e => handleFunctionAllowedChange(serverName, fname, e.target.checked)}
                                  className="function-checkbox"
                                />
                                <span className="function-name" title={f.description || ''}>{fname}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
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
  const [deleteAgent, setDeleteAgent] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [agent, setAgent] = useState('default');
  const [agents, setAgents] = useState(['default']);
  const messagesEndRef = useRef(null);
  // Tool call confirmation modal state
  const [toolCallPending, setToolCallPending] = useState(null);
  const [toolCallResolve, setToolCallResolve] = useState(null);
  // (moved below to avoid redeclaration)

  // Delete selected agent (now takes agentName as argument)
  const handleDeleteAgent = async (agentName) => {
    if (!agentName || agentName === "default") return;
    try {
      const response = await fetch(`/agent?agent=${encodeURIComponent(agentName)}`, { method: 'DELETE' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.agents)) {
          setAgents(data.agents);
          // If the current agent was deleted, switch to default or first available
          if (agentName === agent) {
            setAgent(data.agents.find(a => a !== agentName) || "default");
          }
        } else {
          // fallback: refetch
          await fetchAgents();
        }
      }
    } catch (err) {
      // Optionally show error
    }
  };

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

  const ws = useRef(null);
  useEffect(() => {
    ws.current = new WebSocket(`ws://${window.location.hostname}:8000/chat`);
    ws.current.onopen = () => {};
    ws.current.onclose = () => {};
    ws.current.onerror = () => {};
    ws.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (Array.isArray(data.reply)) {
        setMessages(msgs => [
          ...msgs,
          ...data.reply.map(msg => ({ role: 'assistant', content: msg })),
        ]);
      }
      if (data.tool_call_pending) {
        setToolCallPending(data.tool_call_pending);
        await new Promise((resolve) => setToolCallResolve(() => resolve));
      }
    };
    return () => { ws.current && ws.current.close(); };
  }, []);

  // Tool call confirmation modal
  const handleToolCallConfirm = (confirmationState) => {
    if (ws.current && toolCallPending) {
      ws.current.send(JSON.stringify({ tool_call_confirmed: confirmationState }));
      setToolCallPending(null);
      if (toolCallResolve) {
        toolCallResolve();
        setToolCallResolve(null);
      }
    }
  };

  const sendMessage = e => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages(msgs => [...msgs, { role: 'user', content: input }]);
    ws.current.send(JSON.stringify({ agent, message: input }));
    setInput('');
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
        className="split-pane-full"
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
          deleteAgent={deleteAgent}
          setDeleteAgent={setDeleteAgent}
          handleDeleteAgent={handleDeleteAgent}
        />
        <LogWindow logs={logs} />
      </SplitPane>
      {toolCallPending && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Tool Call Permission</h3>
            <p><b>Name:</b> {toolCallPending.name}</p>
            <p><b>Description:</b> {toolCallPending.description}</p>
            <div><b>Arguments:</b> <pre>{toolCallPending.args}</pre></div>
            <div className="modal-confirm-label">
              <label><b>Confirmation Option:</b></label>
            </div>
            <button onClick={() => handleToolCallConfirm('always_ask')}>Confirm</button>
            <button onClick={() => handleToolCallConfirm('always_confirmed')}>Always confirm</button>
            <button onClick={() => handleToolCallConfirm('always_rejected')}>Always Reject</button>
            <button onClick={() => handleToolCallConfirm('reject')}>Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
