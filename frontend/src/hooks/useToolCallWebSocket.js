import { useRef, useEffect } from 'react';

export function useToolCallWebSocket(agent, setMessages, setToolCallPending, setToolCallResolve) {
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
  }, [agent, setMessages, setToolCallPending, setToolCallResolve]);

  return ws;
}
