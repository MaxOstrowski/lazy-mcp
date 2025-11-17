import React from 'react';

function ToolCallModal({ toolCallPending, handleToolCallConfirm }) {
  if (!toolCallPending) return null;
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Tool Call Permission</h3>
        <p><b>Name:</b> {toolCallPending.name}</p>
        <p><b>Description:</b> {toolCallPending.description}</p>
        <div><b>Arguments:</b> <pre>{toolCallPending.args}</pre></div>
        <div className="modal-confirm-label">
          <label><b>Confirmation Option:</b></label>
        </div>
        <button onClick={() => handleToolCallConfirm('always_ask')}>
          <span className="token-orange toolcall-icon">?</span>
          Confirm
        </button>
        <button onClick={() => handleToolCallConfirm('always_confirmed')}>
          <span className="token-green toolcall-icon">✔</span>
          Always confirm
        </button>
        <button onClick={() => handleToolCallConfirm('always_rejected')}>
          <span className="token-red toolcall-icon">✖</span>
          Always Reject
        </button>
        <button onClick={() => handleToolCallConfirm('reject')}>
          <span className="token-red toolcall-icon">✖</span>
          Reject
        </button>
      </div>
    </div>
  );
}

export default ToolCallModal;
