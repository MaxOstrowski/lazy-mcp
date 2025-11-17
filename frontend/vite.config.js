import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/chat': 'http://localhost:8000',
      '/logs': 'http://localhost:8000',
      '/clear_history': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
      '/agents': 'http://localhost:8000',
      '/agent': 'http://localhost:8000',
      '/agent_config': 'http://localhost:8000',
      '/agent_config/update_flag': 'http://localhost:8000',
      '/reset_default': 'http://localhost:8000',
    },
  },
});
