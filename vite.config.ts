import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function terminalLogger(): Plugin {
  return {
    name: 'terminal-logger',
    apply: 'serve',
    configureServer(server) {
      server.ws.on('terminal:log', (data: { type: 'log' | 'warn' | 'error' | 'info' | 'debug'; args: unknown[] }) => {
        const colorMap: Record<string, string> = {
          log: '\x1b[36m', // Cyan
          info: '\x1b[34m', // Blue
          warn: '\x1b[33m', // Yellow
          error: '\x1b[31m', // Red
          debug: '\x1b[90m', // Gray
        }
        const color = colorMap[data.type] || '\x1b[36m'
        const reset = '\x1b[0m'
        const tag = `${color}[Browser ${data.type.toUpperCase()}]${reset}`

        if (data.type === 'error') {
          console.error(tag, ...data.args)
        } else if (data.type === 'warn') {
          console.warn(tag, ...data.args)
        } else {
          console.log(tag, ...data.args)
        }
      })
    },
    transformIndexHtml(_html) {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: `
            if (import.meta.hot) {
              const methods = ['log', 'warn', 'error', 'info', 'debug'];
              methods.forEach((type) => {
                const original = console[type];
                console[type] = (...args) => {
                  original.apply(console, args);
                  try {
                    const serializedArgs = args.map((arg) => {
                      if (arg instanceof Error) {
                        return { message: arg.message, stack: arg.stack };
                      }
                      if (typeof arg === 'function') {
                        return arg.toString();
                      }
                      if (typeof arg === 'object' && arg !== null) {
                        try {
                          return JSON.parse(JSON.stringify(arg));
                        } catch {
                          return String(arg);
                        }
                      }
                      return arg;
                    });
                    import.meta.hot.send('terminal:log', { type, args: serializedArgs });
                  } catch {}
                };
              });
            }
          `,
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    terminalLogger(),
  ],
})


