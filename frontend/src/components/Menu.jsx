import { useState, useRef, useEffect } from 'react';
// ThreePhaseIconButton for function confirmation state
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

function Menu({
  agent,
  setAgent,
  agents,
  refreshAgents,
  deleteAgent,
  setDeleteAgent,
  handleDeleteAgent,
  agentConfig,
  setAgentConfig,
  expandedServers,
  setExpandedServers,
  onClearHistory
}) {
  const [newAgent, setNewAgent] = useState("");
  const menuRef = useRef(null);
  const prevDeleteAgent = useRef("");
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Agent config is now managed in ChatWindow and passed as prop

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

  const handleDeleteAgentSelect = async (e) => {
    const selected = e.target.value;
    if (selected && selected !== "default" && selected !== prevDeleteAgent.current) {
      if (window.confirm(`Are you sure you want to delete agent '${selected}'?`)) {
        setDeleteAgent(selected);
        await handleDeleteAgent(selected);
      }
      setDeleteAgent("");
      prevDeleteAgent.current = "";
    } else {
      setDeleteAgent(selected);
      prevDeleteAgent.current = selected;
    }
  };

  const toggleExpandServer = (serverName) => {
    setExpandedServers(prev => ({ ...prev, [serverName]: !prev[serverName] }));
  };

  const handleServerAllowedChange = async (serverName, allowed) => {
    setAgentConfig(prev => {
      const updated = { ...prev };
      updated.servers = { ...updated.servers };
      if (updated.servers[serverName]) {
        updated.servers[serverName] = { ...updated.servers[serverName], allowed };
      }
      return updated;
    });
    await fetch(`/agent_config/update_flag?agent=${encodeURIComponent(agent)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        server_name: serverName,
        function_name: '',
        flag_name: 'allowed',
        value: allowed
      }),
    });
  };

  const handleFunctionAllowedChange = async (serverName, functionName, allowed) => {
    setAgentConfig(prev => {
      const updated = { ...prev };
      updated.servers = { ...updated.servers };
      if (updated.servers[serverName] && updated.servers[serverName].functions && updated.servers[serverName].functions[functionName]) {
        updated.servers[serverName].functions = { ...updated.servers[serverName].functions };
        updated.servers[serverName].functions[functionName] = { ...updated.servers[serverName].functions[functionName], allowed };
      }
      return updated;
    });
    await fetch(`/agent_config/update_flag?agent=${encodeURIComponent(agent)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        server_name: serverName,
        function_name: functionName,
        flag_name: 'allowed',
        value: allowed
      }),
    });
  };

  return (
    <div className="menu-container" ref={menuRef}>
      <button className="menu-btn" onClick={async () => { await refreshAgents(); setMenuOpen(m => !m); }} title="Menu">&#8942;</button>
      {menuOpen && (
        <div className="menu-dropdown">
          <ul className="menu-list">
            <li onClick={() => { setMenuOpen(false); onClearHistory(); }}>Clear History</li>
            <li>
              <div className="menu-section-title">Open Agent</div>
              <select className="menu-select" value={agent} onChange={e => handleSelectAgent(e.target.value)}>
                <option value="" disabled>Select agent</option>
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
                {Object.entries(agentConfig.servers || {}).map(([serverName, server]) => (
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
                                await fetch(`/agent_config/update_flag?agent=${encodeURIComponent(agent)}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    server_name: serverName,
                                    function_name: fname,
                                    flag_name: 'confirmed',
                                    value: nextPhase
                                  }),
                                });
                                setAgentConfig(prev => {
                                  const updated = { ...prev };
                                  updated.servers = { ...updated.servers };
                                  if (updated.servers[serverName] && updated.servers[serverName].functions && updated.servers[serverName].functions[fname]) {
                                    updated.servers[serverName].functions = { ...updated.servers[serverName].functions };
                                    updated.servers[serverName].functions[fname] = { ...updated.servers[serverName].functions[fname], confirmed: nextPhase };
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
  );
}

export default Menu;
