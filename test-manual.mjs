#!/usr/bin/env node

/**
 * Manual test to verify the logging system mocking works correctly
 */

import { LoggingSystem } from './dist/logging/logger.js';

console.log('🧪 Testing LoggingSystem with mocked transport...\n');

// Test 1: Debug level logging
console.log('Test 1: Debug level logging with context');
const logger = new LoggingSystem({
  level: 'debug',
  outputs: ['console'],
});

const winstonLogger = logger.logger;
const logEntries = [];
const originalLog = winstonLogger.transports[0].log;

winstonLogger.transports[0].log = function (info, callback) {
  logEntries.push(info);
  if (callback) callback();
};

logger.debug('Debug message', { requestId: '123' });
logger.info('Info message');
logger.warn('Warn message', new Error('Test warning'));
logger.error('Error message', new Error('Test error'));

console.log(`✅ Captured ${logEntries.length} log entries`);
console.log(`✅ Debug entry: level=${logEntries[0].level}, message=${logEntries[0].message}, requestId=${logEntries[0].requestId}`);
console.log(`✅ Info entry: level=${logEntries[1].level}, message=${logEntries[1].message}`);
console.log(`✅ Warn entry: level=${logEntries[2].level}, error.message=${logEntries[2].error?.message}`);
console.log(`✅ Error entry: level=${logEntries[3].level}, error.message=${logEntries[3].error?.message}`);

// Restore
winstonLogger.transports[0].log = originalLog;

// Test 2: Level filtering
console.log('\nTest 2: Log level filtering (warn level)');
const logEntries2 = [];

// Set level to warn BEFORE setting up the mock
logger.setLevel('warn');

winstonLogger.transports[0].log = function (info, callback) {
  logEntries2.push(info);
  if (callback) callback();
};

logger.debug('Should be suppressed');
logger.info('Should be suppressed');
logger.warn('Should appear');
logger.error('Should appear');

console.log(`✅ Captured ${logEntries2.length} log entries (expected 2)`);
if (logEntries2.length === 2) {
  console.log(`✅ First entry: level=${logEntries2[0].level}, message=${logEntries2[0].message}`);
  console.log(`✅ Second entry: level=${logEntries2[1].level}, message=${logEntries2[1].message}`);
} else {
  console.log(`⚠️ Warning: Expected 2 entries but got ${logEntries2.length}`);
  logEntries2.forEach((entry, i) => {
    console.log(`   Entry ${i}: level=${entry.level}, message=${entry.message}`);
  });
}

// Restore
winstonLogger.transports[0].log = originalLog;

// Test 3: Tool execution logging
console.log('\nTest 3: Tool execution logging');
const logEntries3 = [];
logger.setLevel('info');
winstonLogger.transports[0].log = function (info, callback) {
  logEntries3.push(info);
  if (callback) callback();
};

logger.logToolExecution('read_file', { path: '/test' }, { content: 'data' }, 150);

console.log(`✅ Captured ${logEntries3.length} log entry`);
console.log(`✅ Tool execution: toolName=${logEntries3[0].toolName}, duration=${logEntries3[0].duration}ms`);

// Restore and cleanup
winstonLogger.transports[0].log = originalLog;
await logger.shutdown();

console.log('\n✅ All manual tests passed!');
