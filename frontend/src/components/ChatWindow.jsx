import { useState, useEffect } from 'react';
import Menu from './Menu';

function ChatWindow({ messages, input, setInput, sendMessage, messagesEndRef, onClearHistory, agent, setAgent, agents, refreshAgents, deleteAgent, setDeleteAgent, handleDeleteAgent, lastTokensUsed, accumTokens }) {
	const [agentConfig, setAgentConfig] = useState({ description: '', servers: {} });
	const [expandedServers, setExpandedServers] = useState({});

	// Fetch agent description on mount and whenever agent changes
	useEffect(() => {
		async function fetchAgentConfig() {
			try {
				const res = await fetch(`/agent_config?agent=${encodeURIComponent(agent)}`);
				if (res.ok) {
					const data = await res.json();
					setAgentConfig(data);
				} else {
					setAgentConfig({ description: '', servers: {} });
				}
			} catch {
				setAgentConfig({ description: '', servers: {} });
			}
		}
		fetchAgentConfig();
	}, [agent]);

	return (
		<div className="chat-window">
			<div className="agent-header">
				<span className="agent-label">Agent:</span>
				<span className="agent-name" title={agentConfig.description || "No description"}>
					{agent}
							 {agent === 'default' && (
								 <button
									 className="agent-reset-btn"
									 title="Reset default agent"
									 onClick={async () => {
										 try {
											 const res = await fetch('/reset_default', { method: 'POST' });
											 if (res.ok) {
												 const data = await res.json();
												   setAgentConfig(data);
												   setAgent('default');
												   if (typeof setInput === 'function') setInput('');
												   if (typeof setMessages === 'function') setMessages([]);
												   if (typeof onClearHistory === 'function') onClearHistory();
											 }
										 } catch {}
									 }}
								 >
									 &#x21bb; Reset
								 </button>
							 )}
				</span>
			</div>
			<div className="chat-header">
				<Menu
					agent={agent}
					setAgent={setAgent}
					agents={agents}
					refreshAgents={refreshAgents}
					deleteAgent={deleteAgent}
					setDeleteAgent={setDeleteAgent}
					handleDeleteAgent={handleDeleteAgent}
					agentConfig={agentConfig}
					setAgentConfig={setAgentConfig}
					expandedServers={expandedServers}
					setExpandedServers={setExpandedServers}
					onClearHistory={onClearHistory}
				/>
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

export default ChatWindow;
