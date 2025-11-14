import { useState, useCallback } from 'react';

export function useChatHistory(agent) {
  const [messages, setMessages] = useState([]);

  const fetchHistory = useCallback(async (selectedAgent = agent) => {
    try {
      const response = await fetch(`/history?agent=${encodeURIComponent(selectedAgent)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err) {
      setMessages([]);
    }
  }, [agent]);

  return { messages, setMessages, fetchHistory };
}
