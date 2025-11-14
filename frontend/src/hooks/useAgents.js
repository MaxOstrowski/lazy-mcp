import { useState, useCallback } from 'react';

export function useAgents(initialAgent = 'default') {
  const [agent, setAgent] = useState(initialAgent);
  const [agents, setAgents] = useState([initialAgent]);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/agents');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      let data = await response.json();
      if (Array.isArray(data)) {
        if (agent && !data.includes(agent)) {
          data = [agent, ...data];
        }
        setAgents(data);
      }
    } catch (err) {
      setAgents(['default']);
    }
  }, [agent]);

  const handleDeleteAgent = async (agentName) => {
    if (!agentName || agentName === 'default') return;
    try {
      const response = await fetch(`/agent?agent=${encodeURIComponent(agentName)}`, { method: 'DELETE' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.agents)) {
          setAgents(data.agents);
          if (agentName === agent) {
            setAgent(data.agents.find(a => a !== agentName) || 'default');
          }
        } else {
          await fetchAgents();
        }
      }
    } catch (err) {
      // Optionally show error
    }
  };

  return { agent, setAgent, agents, setAgents, fetchAgents, handleDeleteAgent };
}
