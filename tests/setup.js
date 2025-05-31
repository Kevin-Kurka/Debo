// Test setup file
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Global test utilities
global.mockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
});

// Mock Redis client for tests
global.mockRedisClient = () => ({
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  hSet: jest.fn().mockResolvedValue(),
  hGetAll: jest.fn().mockResolvedValue({}),
  sAdd: jest.fn().mockResolvedValue(),
  sMembers: jest.fn().mockResolvedValue([]),
  sRem: jest.fn().mockResolvedValue(),
  del: jest.fn().mockResolvedValue(),
  keys: jest.fn().mockResolvedValue([]),
  zRevRange: jest.fn().mockResolvedValue([]),
  zRemRangeByScore: jest.fn().mockResolvedValue(),
  on: jest.fn()
});

// Increase timeout for async tests
jest.setTimeout(10000);

// Suppress console output during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}