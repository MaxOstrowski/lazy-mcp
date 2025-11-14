import React from 'react';

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

export default LogWindow;
