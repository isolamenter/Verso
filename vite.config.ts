import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

function terminalLogger(): Plugin {
  return {
    name: 'terminal-logger',
    apply: 'serve',
    configureServer(server) {
      const handleLog = (data: { type: 'log' | 'warn' | 'error' | 'info' | 'debug'; args: unknown[] }) => {
        if (!data || !data.type) return;
        const colorMap: Record<string, string> = {
          log: '\x1b[36m', // Cyan
          info: '\x1b[34m', // Blue
          warn: '\x1b[33m', // Yellow
          error: '\x1b[31m', // Red
          debug: '\x1b[90m', // Gray
        };
        const color = colorMap[data.type] || '\x1b[36m';
        const reset = '\x1b[0m';
        const tag = `${color}[Browser ${data.type.toUpperCase()}]${reset}`;

        const formattedArgs = (data.args || []).map((arg) => {
          if (arg && typeof arg === 'object') {
            if ('stack' in (arg as any) && (arg as any).stack) {
              return `${(arg as any).name || 'Error'}: ${(arg as any).message || ''}\n${(arg as any).stack}`;
            }
            if ('message' in (arg as any)) {
              return `${(arg as any).name || 'Error'}: ${(arg as any).message}`;
            }
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return arg;
        });

        if (data.type === 'error') {
          console.error(tag, ...formattedArgs);
        } else if (data.type === 'warn') {
          console.warn(tag, ...formattedArgs);
        } else {
          console.log(tag, ...formattedArgs);
        }
      };

      server.ws.on('terminal:log', handleLog);
      if (server.hot) {
        server.hot.on('terminal:log', handleLog);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    terminalLogger(),
  ],
})
