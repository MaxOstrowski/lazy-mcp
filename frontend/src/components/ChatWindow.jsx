import React from 'react';
import { useState, useEffect, useRef } from 'react';

function ChatWindow({ messages, input, setInput, sendMessage, messagesEndRef, onClearHistory, agent, setAgent, agents, refreshAgents, deleteAgent, setDeleteAgent, handleDeleteAgent, lastTokensUsed, accumTokens }) {
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
        <span className="agent-label">Agent:</span> <span className="agent-name" title={servers[agent]?.description || servers[agent]?.desc || "No description"}>{agent}</span>
      </div>
      <div className="chat-header">
        <div className="menu-container" ref={menuRef}>
          <button className="menu-btn" onClick={async () => { await refreshAgents(); setMenuOpen(m => !m); }} title="Menu">&#8942;</button>
          {menuOpen && (
              <div className="menu-dropdown">
                <ul className="menu-list">
                  <li onClick={() => { setMenuOpen(false); onClearHistory(); }}>Clear History</li>
                  <li>
                    <div className="menu-section-title">Open Agent</div>
                    <select className="menu-select" value={agent} onChange={e => handleSelectAgent(e.target.value)}>
                      {agents.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    <input
                      className="menu-select"
                      type="text"
                      value={newAgent}
                      onChange={e => setNewAgent(e.target.value)}
                      onKeyDown={handleNewAgentKeyDown}
                      placeholder="New agent name (Hit Enter)"
                    />
                  </li>
                  <li>
                    <div className="menu-section-title">Delete Agent</div>
                    <select className="menu-select" value={deleteAgent} onChange={handleDeleteAgentSelect}>
                      <option value="">Select agent</option>
                      {agents.filter(a => a !== "default").map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </li>
                  <li>
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
                                  <ThreePhaseIconButton
                                    phase={f.confirmed || 'always_confirmed'}
                                    onClick={async () => {
                                      const nextPhase =
                                        f.confirmed === 'always_confirmed' ? 'always_ask' :
                                        f.confirmed === 'always_ask' ? 'always_rejected' : 'always_confirmed';
                                      // PATCH to backend to persist change
                                      await fetch(`/servers/update_flag?agent=${encodeURIComponent(agent)}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          server_name: serverName,
                                          function_name: fname,
                                          flag_name: 'confirmed',
                                          value: nextPhase
                                        }),
                                      });
                                      // Update local state
                                      setServers(prev => {
                                        const updated = { ...prev };
                                        if (updated[serverName] && updated[serverName].functions && updated[serverName].functions[fname]) {
                                          updated[serverName].functions[fname].confirmed = nextPhase;
                                        }
                                        return updated;
                                      });
                                    }}
                                  />
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </li>
                </ul>
              </div>
          )}
        </div>
      </div>
      <div className="messages">
        <div className="messages-scroll-area">
          {messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? 'user-msg' : 'api-msg'}>
              <b>{msg.role}:</b> {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <form className="input-form" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          autoFocus
        />
        <div className="send-btn-container">
          <button type="submit">Send</button>
          <div className="token-counter" title="Tokens used: (last request/total)">
            <span
              className={
                lastTokensUsed < 1500
                  ? 'token-green'
                  : lastTokensUsed > 10000
                  ? 'token-red'
                  : 'token-orange'
              }
            >
              {lastTokensUsed}
            </span>
            /{accumTokens}
          </div>
        </div>
      </form>
    </div>
  );
}

function ThreePhaseIconButton({ phase, onClick }) {
  const icon = phase === 'always_confirmed' ? '✔' : phase === 'always_ask' ? '?' : '✖';
  const color = phase === 'always_confirmed' ? 'green' : phase === 'always_ask' ? 'orange' : 'red';
  const title = phase === 'always_confirmed' ? 'Always Confirmed' : phase === 'always_ask' ? 'Always Ask' : 'Always Reject';
  return (
    <span
      className="three-phase-icon"
      style={{ color, marginLeft: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2em' }}
      title={title}
      onClick={onClick}
    >
      {icon}
    </span>
  );
}

export default ChatWindow;
