export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`\x1b[36m[INFO]\x1b[0m ${message}`, ...args);
  },

  warn: (message: string, ...args: any[]) => {
    console.log(`\x1b[33m[WARN]\x1b[0m ${message}`, ...args);
  },

  error: (message: string, ...args: any[]) => {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`, ...args);
  },

  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG === 'true') {
      console.log(`\x1b[35m[DEBUG]\x1b[0m ${message}`, ...args);
    }
  },

  success: (message: string, ...args: any[]) => {
    console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`, ...args);
  },
};
