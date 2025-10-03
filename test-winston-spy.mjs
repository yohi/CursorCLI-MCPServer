#!/usr/bin/env node

/**
 * Test Winston with proper spying on the log method
 */

import winston from 'winston';

console.log('🔍 Testing Winston spying mechanism...\n');

const capturedLogs = [];
const transport = new winston.transports.Console({
  log(info, callback) {
    capturedLogs.push(info);
    callback();
  }
});

const logger = winston.createLogger({
  level: 'warn',
  transports: [transport]
});

console.log('Test: Logger with level=warn');
logger.debug('Debug - should be suppressed');
logger.info('Info - should be suppressed');
logger.warn('Warn - should appear');
logger.error('Error - should appear');

console.log(`\nCaptured ${capturedLogs.length} logs:`);
capturedLogs.forEach((log, i) => {
  console.log(`  ${i + 1}. level=${log.level}, message=${log.message}`);
});

console.log('\n✅ Test complete!');
