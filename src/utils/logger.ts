// Client-side logger that forwards all console logs, warnings, and errors to Vite dev server terminal
// and attaches global error / unhandledrejection handlers for immediate visibility.

export function initLogger() {
  // Global uncaught error listener
  window.addEventListener('error', (event) => {
    const errorDetails = event.error
      ? { message: event.error.message, stack: event.error.stack, name: event.error.name }
      : { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno };
    console.error('[全局未捕获异常 / Uncaught Error]', errorDetails);
  });

  // Global unhandled promise rejection listener
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorDetails = reason instanceof Error
      ? { message: reason.message, stack: reason.stack, name: reason.name }
      : reason;
    console.error('[全局未捕获 Promise Rejection]', errorDetails);
  });

  const hot = import.meta.hot;
  if (!hot) return;

  const methods = ['log', 'warn', 'error', 'info', 'debug'] as const;

  methods.forEach((type) => {
    const original = console[type];
    console[type] = (...args: any[]) => {
      original.apply(console, args);
      try {
        const serializedArgs = args.map((arg) => {
          if (arg instanceof Error) {
            return {
              name: arg.name,
              message: arg.message,
              stack: arg.stack,
            };
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
        hot.send('terminal:log', { type, args: serializedArgs });
      } catch {
        // Avoid crash during serialization
      }
    };
  });

  console.log('✨ [Verso] 客户端日志与报错捕获已启动');
}

