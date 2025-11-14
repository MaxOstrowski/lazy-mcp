
import SplitPane from 'react-split-pane';
import ChatWindow from './components/ChatWindow';
import LogWindow from './components/LogWindow';
import ToolCallModal from './components/ToolCallModal';
import { useAgents } from './hooks/useAgents';
import { useChatHistory } from './hooks/useChatHistory';
import { useLogs } from './hooks/useLogs';
import { useToolCallWebSocket } from './hooks/useToolCallWebSocket';
import React, { useState, useEffect, useRef, useCallback } from 'react';

function App() {
  // Use custom hooks for state and logic
  const { agent, setAgent, agents, setAgents, fetchAgents, handleDeleteAgent } = useAgents('default');
  const { messages, setMessages, fetchHistory } = useChatHistory(agent);
  const { logs, setLogs, fetchLogs } = useLogs(agent);
  const [input, setInput] = useState('');
  const [deleteAgent, setDeleteAgent] = useState("");
  const messagesEndRef = useRef(null);
  const [toolCallPending, setToolCallPending] = useState(null);
  const [toolCallResolve, setToolCallResolve] = useState(null);
  const ws = useToolCallWebSocket(agent, setMessages, setToolCallPending, setToolCallResolve);

  useEffect(() => {
    fetchAgents();
    fetchHistory('default');
  }, []);

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
      <ToolCallModal toolCallPending={toolCallPending} handleToolCallConfirm={handleToolCallConfirm} />
    </div>
  );
}

export default App;
