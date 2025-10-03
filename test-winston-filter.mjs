#!/usr/bin/env node

/**
 * Test to understand how Winston level filtering works
 */

import winston from 'winston';

console.log('🔍 Testing Winston level filtering mechanism...\n');

const logger = winston.createLogger({
  level: 'warn',
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

console.log('Logger level:', logger.level);
console.log('Transport level:', logger.transports[0].level);

console.log('\nCalling logger methods:');
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warn message');
logger.error('Error message');

console.log('\nDone!');
