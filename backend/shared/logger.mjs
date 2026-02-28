const STAGE = process.env.STAGE || 'dev';

function format(level, message, data = {}) {
  return JSON.stringify({
    level,
    message,
    stage: STAGE,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

export const logger = {
  info(message, data) {
    console.log(format('INFO', message, data));
  },
  warn(message, data) {
    console.warn(format('WARN', message, data));
  },
  error(message, data) {
    console.error(format('ERROR', message, data));
  },
  debug(message, data) {
    if (STAGE === 'dev') {
      console.debug(format('DEBUG', message, data));
    }
  },
};
