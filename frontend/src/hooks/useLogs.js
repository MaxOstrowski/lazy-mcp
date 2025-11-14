import { useState, useCallback } from 'react';

export function useLogs(agent) {
  const [logs, setLogs] = useState([]);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch(`/logs?agent=${encodeURIComponent(agent)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setLogs(prevLogs =>
        Array.isArray(data.logs)
          ? [...prevLogs, ...data.logs]
          : [...prevLogs, { level: 'ERROR', message: 'Backend logs not available', time: '' }]
      );
    } catch (err) {
      setLogs([{ level: 'ERROR', message: `Error fetching logs: ${err.message}`, time: '' }]);
    }
  }, [agent]);

  return { logs, setLogs, fetchLogs };
}
