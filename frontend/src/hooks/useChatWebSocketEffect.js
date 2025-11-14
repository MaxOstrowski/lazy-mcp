import { useEffect } from 'react';

export function useChatWebSocketEffect(ws, agent, setMessages, setLastTokensUsed, setAccumTokens, setToolCallPending, setToolCallResolve) {
  useEffect(() => {
    if (!ws.current) return;
    ws.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (Array.isArray(data.reply)) {
        setMessages(msgs => [
          ...msgs,
          ...data.reply.map(msg => ({ role: 'assistant', content: msg })),
        ]);
      }
      if (typeof data.tokens_used === 'number') {
        setLastTokensUsed(data.tokens_used);
        setAccumTokens(accum => accum + data.tokens_used);
      }
      if (data.tool_call_pending) {
        setToolCallPending(data.tool_call_pending);
        await new Promise((resolve) => setToolCallResolve(() => resolve));
      }
    };
  }, [ws, agent, setMessages, setLastTokensUsed, setAccumTokens, setToolCallPending, setToolCallResolve]);
}
