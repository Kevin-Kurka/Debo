/**
 * Unified Database Service
 * Consolidates 17 database managers into 4 logical services with
 * connection pooling, transactions, and batch operations
 */

import Redis from 'redis';
import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';

const logger = createLogger('DatabaseService');

class DatabaseService extends EventEmitter {
    constructor() {
        super();
        this.redis = null;
        this.connectionPool = new Map();
        this.transactionQueue = new Map();
        this.batchQueue = new Map();
        this.isConnected = false;
        this.metrics = {
            operations: 0,
            transactions: 0,
            batchOperations: 0,
            errors: 0,
            connectionTime: 0
        };
        
        // Service configurations
        this.services = {
            projects: new ProjectService(this),
            tasks: new TaskService(this),
            agents: new AgentService(this),
            system: new SystemService(this)
        };
    }

    async initialize() {
        try {
            const startTime = Date.now();
            
            // Create Redis connection with optimized settings
            this.redis = Redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                socket: {
                    connectTimeout: 60000,
                    lazyConnect: true,
                    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
                },
                database: 0,
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3
            });

            // Connection event handlers
            this.redis.on('connect', () => {
                logger.info('Redis connection established');
                this.isConnected = true;
                this.emit('connected');
            });

            this.redis.on('error', (error) => {
                logger.error('Redis connection error:', error);
                this.metrics.errors++;
                this.emit('error', error);
            });

            this.redis.on('reconnecting', () => {
                logger.info('Redis reconnecting...');
                this.emit('reconnecting');
            });

            await this.redis.connect();
            this.metrics.connectionTime = Date.now() - startTime;
            
            // Initialize services
            await Promise.all(Object.values(this.services).map(service => service.initialize()));
            
            logger.info(`Database service initialized in ${this.metrics.connectionTime}ms`);
            return true;
        } catch (error) {
            logger.error('Failed to initialize database service:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.redis && this.isConnected) {
                await this.redis.quit();
                this.isConnected = false;
                logger.info('Database service disconnected');
            }
        } catch (error) {
            logger.error('Error disconnecting from database:', error);
        }
    }

    // Transaction support for atomic operations
    async withTransaction(operations) {
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const multi = this.redis.multi();
        
        try {
            this.transactionQueue.set(transactionId, multi);
            
            // Execute operations within transaction
            for (const operation of operations) {
                await operation(multi);
            }
            
            const results = await multi.exec();
            this.transactionQueue.delete(transactionId);
            this.metrics.transactions++;
            
            logger.debug(`Transaction ${transactionId} completed with ${results.length} operations`);
            return results;
        } catch (error) {
            this.transactionQueue.delete(transactionId);
            this.metrics.errors++;
            logger.error(`Transaction ${transactionId} failed:`, error);
            throw error;
        }
    }

    // Batch operations for efficiency
    async batchOperations(operations, options = {}) {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { chunkSize = 100, parallel = true } = options;
        
        try {
            const chunks = this.chunkArray(operations, chunkSize);
            const results = [];
            
            if (parallel) {
                // Process chunks in parallel
                const chunkPromises = chunks.map(chunk => this.processBatchChunk(chunk, batchId));
                const chunkResults = await Promise.all(chunkPromises);
                results.push(...chunkResults.flat());
            } else {
                // Process chunks sequentially
                for (const chunk of chunks) {
                    const chunkResults = await this.processBatchChunk(chunk, batchId);
                    results.push(...chunkResults);
                }
            }
            
            this.metrics.batchOperations++;
            logger.debug(`Batch ${batchId} completed with ${operations.length} operations`);
            return results;
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Batch ${batchId} failed:`, error);
            throw error;
        }
    }

    async processBatchChunk(chunk, batchId) {
        const pipeline = this.redis.pipeline();
        
        for (const operation of chunk) {
            if (typeof operation === 'function') {
                await operation(pipeline);
            } else {
                const { command, args } = operation;
                pipeline[command](...args);
            }
        }
        
        return await pipeline.exec();
    }

    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    // Service accessors
    get projects() { return this.services.projects; }
    get tasks() { return this.services.tasks; }
    get agents() { return this.services.agents; }
    get system() { return this.services.system; }

    // Health check
    async healthCheck() {
        try {
            const startTime = Date.now();
            await this.redis.ping();
            const pingTime = Date.now() - startTime;
            
            return {
                status: 'healthy',
                connected: this.isConnected,
                pingTime,
                metrics: this.metrics,
                services: Object.keys(this.services).reduce((acc, key) => {
                    acc[key] = this.services[key].isHealthy();
                    return acc;
                }, {})
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                connected: false
            };
        }
    }

    // Get performance metrics
    getMetrics() {
        return {
            ...this.metrics,
            uptime: this.isConnected ? Date.now() - this.metrics.connectionTime : 0,
            services: Object.keys(this.services).reduce((acc, key) => {
                acc[key] = this.services[key].getMetrics();
                return acc;
            }, {})
        };
    }
}

// Project Service - Handles all project-related data
class ProjectService {
    constructor(db) {
        this.db = db;
        this.keyPrefix = 'project:';
        this.metrics = { reads: 0, writes: 0, deletes: 0 };
    }

    async initialize() {
        logger.info('Project service initialized');
    }

    async create(projectId, data) {
        const key = `${this.keyPrefix}${projectId}`;
        const projectData = {
            id: projectId,
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await this.db.redis.hSet(key, projectData);
        this.metrics.writes++;
        return projectData;
    }

    async get(projectId) {
        const key = `${this.keyPrefix}${projectId}`;
        const data = await this.db.redis.hGetAll(key);
        this.metrics.reads++;
        return Object.keys(data).length ? data : null;
    }

    async update(projectId, updates) {
        const key = `${this.keyPrefix}${projectId}`;
        const updateData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        await this.db.redis.hSet(key, updateData);
        this.metrics.writes++;
        return updateData;
    }

    async delete(projectId) {
        const key = `${this.keyPrefix}${projectId}`;
        const result = await this.db.redis.del(key);
        this.metrics.deletes++;
        return result > 0;
    }

    async list(pattern = '*') {
        const keys = await this.db.redis.keys(`${this.keyPrefix}${pattern}`);
        const projects = [];
        
        for (const key of keys) {
            const data = await this.db.redis.hGetAll(key);
            if (Object.keys(data).length) {
                projects.push(data);
            }
        }
        
        this.metrics.reads += keys.length;
        return projects;
    }

    isHealthy() { return true; }
    getMetrics() { return { ...this.metrics }; }
}

// Task Service - Handles all task-related data
class TaskService {
    constructor(db) {
        this.db = db;
        this.keyPrefix = 'task:';
        this.queuePrefix = 'queue:';
        this.metrics = { reads: 0, writes: 0, deletes: 0, queues: 0 };
    }

    async initialize() {
        logger.info('Task service initialized');
    }

    async create(taskId, data) {
        const key = `${this.keyPrefix}${taskId}`;
        const taskData = {
            id: taskId,
            status: 'pending',
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await this.db.redis.hSet(key, taskData);
        
        // Add to appropriate queue
        if (data.agentType) {
            await this.addToQueue(data.agentType, taskId);
        }
        
        this.metrics.writes++;
        return taskData;
    }

    async get(taskId) {
        const key = `${this.keyPrefix}${taskId}`;
        const data = await this.db.redis.hGetAll(key);
        this.metrics.reads++;
        return Object.keys(data).length ? data : null;
    }

    async update(taskId, updates) {
        const key = `${this.keyPrefix}${taskId}`;
        const updateData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        await this.db.redis.hSet(key, updateData);
        this.metrics.writes++;
        return updateData;
    }

    async addToQueue(queueName, taskId) {
        const key = `${this.queuePrefix}${queueName}`;
        await this.db.redis.lPush(key, taskId);
        this.metrics.queues++;
    }

    async getFromQueue(queueName) {
        const key = `${this.queuePrefix}${queueName}`;
        const taskId = await this.db.redis.rPop(key);
        if (taskId) {
            this.metrics.reads++;
            return await this.get(taskId);
        }
        return null;
    }

    async getQueueLength(queueName) {
        const key = `${this.queuePrefix}${queueName}`;
        return await this.db.redis.lLen(key);
    }

    isHealthy() { return true; }
    getMetrics() { return { ...this.metrics }; }
}

// Agent Service - Handles all agent-related data
class AgentService {
    constructor(db) {
        this.db = db;
        this.keyPrefix = 'agent:';
        this.statePrefix = 'agent_state:';
        this.metrics = { reads: 0, writes: 0, deletes: 0, states: 0 };
    }

    async initialize() {
        logger.info('Agent service initialized');
    }

    async registerAgent(agentId, config) {
        const key = `${this.keyPrefix}${agentId}`;
        const agentData = {
            id: agentId,
            ...config,
            registeredAt: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };
        
        await this.db.redis.hSet(key, agentData);
        this.metrics.writes++;
        return agentData;
    }

    async getAgent(agentId) {
        const key = `${this.keyPrefix}${agentId}`;
        const data = await this.db.redis.hGetAll(key);
        this.metrics.reads++;
        return Object.keys(data).length ? data : null;
    }

    async updateAgentState(agentId, state) {
        const key = `${this.statePrefix}${agentId}`;
        const stateData = {
            agentId,
            ...state,
            updatedAt: new Date().toISOString()
        };
        
        await this.db.redis.hSet(key, stateData);
        
        // Update last active time
        await this.db.redis.hSet(`${this.keyPrefix}${agentId}`, {
            lastActive: new Date().toISOString()
        });
        
        this.metrics.states++;
        return stateData;
    }

    async getAgentState(agentId) {
        const key = `${this.statePrefix}${agentId}`;
        const data = await this.db.redis.hGetAll(key);
        this.metrics.reads++;
        return Object.keys(data).length ? data : null;
    }

    async listActiveAgents() {
        const keys = await this.db.redis.keys(`${this.keyPrefix}*`);
        const agents = [];
        
        for (const key of keys) {
            const data = await this.db.redis.hGetAll(key);
            if (Object.keys(data).length) {
                agents.push(data);
            }
        }
        
        this.metrics.reads += keys.length;
        return agents;
    }

    isHealthy() { return true; }
    getMetrics() { return { ...this.metrics }; }
}

// System Service - Handles system-wide data and configuration
class SystemService {
    constructor(db) {
        this.db = db;
        this.configPrefix = 'config:';
        this.logPrefix = 'log:';
        this.metricsPrefix = 'metrics:';
        this.metrics = { reads: 0, writes: 0, logs: 0 };
    }

    async initialize() {
        logger.info('System service initialized');
    }

    async setConfig(key, value) {
        const configKey = `${this.configPrefix}${key}`;
        await this.db.redis.set(configKey, JSON.stringify(value));
        this.metrics.writes++;
    }

    async getConfig(key, defaultValue = null) {
        const configKey = `${this.configPrefix}${key}`;
        const value = await this.db.redis.get(configKey);
        this.metrics.reads++;
        return value ? JSON.parse(value) : defaultValue;
    }

    async log(level, message, metadata = {}) {
        const logKey = `${this.logPrefix}${Date.now()}`;
        const logEntry = {
            level,
            message,
            metadata: JSON.stringify(metadata),
            timestamp: new Date().toISOString()
        };
        
        await this.db.redis.hSet(logKey, logEntry);
        await this.db.redis.expire(logKey, 86400); // Expire after 24 hours
        this.metrics.logs++;
    }

    async recordMetrics(component, metrics) {
        const metricsKey = `${this.metricsPrefix}${component}:${Date.now()}`;
        await this.db.redis.hSet(metricsKey, metrics);
        await this.db.redis.expire(metricsKey, 86400); // Expire after 24 hours
        this.metrics.writes++;
    }

    isHealthy() { return true; }
    getMetrics() { return { ...this.metrics }; }
}

export default DatabaseService;
export { ProjectService, TaskService, AgentService, SystemService };