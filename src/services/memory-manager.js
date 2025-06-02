/**
 * Memory Manager Service
 * Implements intelligent memory management with automatic cleanup,
 * summarization, and resource monitoring to prevent memory leaks
 */

import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';

const logger = createLogger('MemoryManager');

class MemoryManager extends EventEmitter {
    constructor(databaseService, llmRequestManager) {
        super();
        this.db = databaseService;
        this.llm = llmRequestManager;
        
        // Memory limits and thresholds
        this.config = {
            maxMemoryUsage: 512 * 1024 * 1024, // 512MB
            warningThreshold: 0.8, // 80% of max
            criticalThreshold: 0.9, // 90% of max
            cleanupInterval: 300000, // 5 minutes
            summarizationInterval: 3600000, // 1 hour
            maxDataAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            maxInactiveAge: 24 * 60 * 60 * 1000, // 24 hours
            compressionRatio: 0.3 // Target 30% of original size after compression
        };
        
        // Runtime tracking
        this.memoryTracking = {
            inMemoryMaps: new Set(),
            dataStructures: new Map(),
            activeConnections: new Set(),
            temporaryData: new Map(),
            lastCleanup: null,
            lastSummarization: null
        };
        
        // Metrics
        this.metrics = {
            currentMemoryUsage: 0,
            peakMemoryUsage: 0,
            dataStructuresCount: 0,
            cleanupsPerformed: 0,
            summarizationsPerformed: 0,
            dataPurged: 0,
            compressionsSaved: 0,
            lastMemoryCheck: null
        };
        
        // Active intervals
        this.intervals = {
            cleanup: null,
            summarization: null,
            monitoring: null
        };
        
        this.initialize();
    }

    async initialize() {
        logger.info('Initializing Memory Manager...');
        
        try {
            // Start monitoring and cleanup processes
            this.startMemoryMonitoring();
            this.startPeriodicCleanup();
            this.startPeriodicSummarization();
            
            // Register global memory tracking
            this.setupGlobalMemoryTracking();
            
            // Perform initial memory assessment
            await this.performInitialAssessment();
            
            logger.info('Memory Manager initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize Memory Manager:', error);
            throw error;
        }
    }

    // Core memory monitoring
    startMemoryMonitoring() {
        this.intervals.monitoring = setInterval(() => {
            this.checkMemoryUsage();
        }, 30000); // Check every 30 seconds
    }

    checkMemoryUsage() {
        const memUsage = process.memoryUsage();
        this.metrics.currentMemoryUsage = memUsage.heapUsed;
        this.metrics.lastMemoryCheck = Date.now();
        
        if (memUsage.heapUsed > this.metrics.peakMemoryUsage) {
            this.metrics.peakMemoryUsage = memUsage.heapUsed;
        }
        
        const usageRatio = memUsage.heapUsed / this.config.maxMemoryUsage;
        
        if (usageRatio > this.config.criticalThreshold) {
            this.emit('memoryкритical', { usage: memUsage, ratio: usageRatio });
            this.performEmergencyCleanup();
        } else if (usageRatio > this.config.warningThreshold) {
            this.emit('memoryWarning', { usage: memUsage, ratio: usageRatio });
            this.performPreventiveCleanup();
        }
        
        logger.debug(`Memory usage: ${Math.round(usageRatio * 100)}% (${this.formatBytes(memUsage.heapUsed)})`);
    }

    // Periodic cleanup processes
    startPeriodicCleanup() {
        this.intervals.cleanup = setInterval(() => {
            this.performScheduledCleanup();
        }, this.config.cleanupInterval);
    }

    async performScheduledCleanup() {
        logger.info('Performing scheduled memory cleanup...');
        
        try {
            const cleanupStats = {
                dataStructuresRemoved: 0,
                temporaryDataCleared: 0,
                connectionsReleased: 0,
                memoryFreed: 0
            };
            
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Clean up expired temporary data
            cleanupStats.temporaryDataCleared = await this.cleanupTemporaryData();
            
            // Clean up inactive data structures
            cleanupStats.dataStructuresRemoved = await this.cleanupDataStructures();
            
            // Release inactive connections
            cleanupStats.connectionsReleased = await this.cleanupConnections();
            
            // Clean up Redis data
            await this.cleanupRedisData();
            
            // Force garbage collection
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            cleanupStats.memoryFreed = initialMemory - finalMemory;
            
            this.metrics.cleanupsPerformed++;
            this.memoryTracking.lastCleanup = Date.now();
            
            this.emit('cleanupCompleted', cleanupStats);
            logger.info(`Cleanup completed. Freed ${this.formatBytes(cleanupStats.memoryFreed)}`);
            
        } catch (error) {
            logger.error('Error during scheduled cleanup:', error);
        }
    }

    async performPreventiveCleanup() {
        logger.warn('Performing preventive memory cleanup due to high usage...');
        
        // More aggressive cleanup
        await this.cleanupTemporaryData();
        await this.cleanupDataStructures(true); // Force cleanup
        await this.compressInMemoryData();
        
        if (global.gc) {
            global.gc();
        }
    }

    async performEmergencyCleanup() {
        logger.error('Performing emergency memory cleanup due to critical usage!');
        
        // Most aggressive cleanup
        await this.clearAllTemporaryData();
        await this.releaseAllNonEssentialData();
        await this.compressAllData();
        
        // Force multiple GC cycles
        if (global.gc) {
            for (let i = 0; i < 3; i++) {
                global.gc();
                await this.delay(100);
            }
        }
        
        this.emit('emergencyCleanup', { timestamp: Date.now() });
    }

    // Data structure management
    registerDataStructure(id, dataStructure, metadata = {}) {
        this.memoryTracking.dataStructures.set(id, {
            data: dataStructure,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 0,
            metadata
        });
        
        this.metrics.dataStructuresCount++;
        
        // If it's a Map or Set, track it specially
        if (dataStructure instanceof Map || dataStructure instanceof Set) {
            this.memoryTracking.inMemoryMaps.add(dataStructure);
        }
    }

    accessDataStructure(id) {
        const entry = this.memoryTracking.dataStructures.get(id);
        if (entry) {
            entry.lastAccessed = Date.now();
            entry.accessCount++;
            return entry.data;
        }
        return null;
    }

    unregisterDataStructure(id) {
        const entry = this.memoryTracking.dataStructures.get(id);
        if (entry) {
            // Remove from special tracking
            if (entry.data instanceof Map || entry.data instanceof Set) {
                this.memoryTracking.inMemoryMaps.delete(entry.data);
            }
            
            this.memoryTracking.dataStructures.delete(id);
            this.metrics.dataStructuresCount--;
            return true;
        }
        return false;
    }

    async cleanupDataStructures(force = false) {
        const now = Date.now();
        const toRemove = [];
        let removed = 0;
        
        for (const [id, entry] of this.memoryTracking.dataStructures) {
            const age = now - entry.lastAccessed;
            const shouldRemove = force || 
                age > this.config.maxInactiveAge ||
                (entry.accessCount === 0 && age > 60000); // Remove unused after 1 minute
            
            if (shouldRemove) {
                toRemove.push(id);
            }
        }
        
        for (const id of toRemove) {
            if (this.unregisterDataStructure(id)) {
                removed++;
            }
        }
        
        logger.debug(`Cleaned up ${removed} inactive data structures`);
        return removed;
    }

    // Temporary data management
    storeTemporaryData(key, data, ttl = 300000) { // 5 minutes default
        this.memoryTracking.temporaryData.set(key, {
            data,
            expiresAt: Date.now() + ttl,
            createdAt: Date.now()
        });
    }

    getTemporaryData(key) {
        const entry = this.memoryTracking.temporaryData.get(key);
        if (entry) {
            if (Date.now() > entry.expiresAt) {
                this.memoryTracking.temporaryData.delete(key);
                return null;
            }
            return entry.data;
        }
        return null;
    }

    async cleanupTemporaryData() {
        const now = Date.now();
        const toRemove = [];
        
        for (const [key, entry] of this.memoryTracking.temporaryData) {
            if (now > entry.expiresAt) {
                toRemove.push(key);
            }
        }
        
        for (const key of toRemove) {
            this.memoryTracking.temporaryData.delete(key);
        }
        
        logger.debug(`Cleaned up ${toRemove.length} expired temporary data entries`);
        return toRemove.length;
    }

    async clearAllTemporaryData() {
        const count = this.memoryTracking.temporaryData.size;
        this.memoryTracking.temporaryData.clear();
        logger.warn(`Cleared all ${count} temporary data entries`);
        return count;
    }

    // Data compression and summarization
    startPeriodicSummarization() {
        this.intervals.summarization = setInterval(() => {
            this.performDataSummarization();
        }, this.config.summarizationInterval);
    }

    async performDataSummarization() {
        logger.info('Performing data summarization...');
        
        try {
            const summarizationStats = {
                projectsSummarized: 0,
                tasksSummarized: 0,
                agentDataSummarized: 0,
                spaceSaved: 0
            };
            
            // Summarize old project data
            summarizationStats.projectsSummarized = await this.summarizeProjects();
            
            // Summarize completed tasks
            summarizationStats.tasksSummarized = await this.summarizeTasks();
            
            // Summarize agent execution history
            summarizationStats.agentDataSummarized = await this.summarizeAgentData();
            
            this.metrics.summarizationsPerformed++;
            this.memoryTracking.lastSummarization = Date.now();
            
            this.emit('summarizationCompleted', summarizationStats);
            logger.info(`Summarization completed: ${JSON.stringify(summarizationStats)}`);
            
        } catch (error) {
            logger.error('Error during data summarization:', error);
        }
    }

    async summarizeProjects() {
        try {
            const projects = await this.db.projects.list();
            const oldProjects = projects.filter(p => 
                Date.now() - new Date(p.createdAt).getTime() > this.config.maxDataAge
            );
            
            let summarized = 0;
            
            for (const project of oldProjects) {
                if (project.status === 'completed' || project.status === 'archived') {
                    const summary = await this.createProjectSummary(project);
                    await this.db.projects.update(project.id, {
                        summarized: true,
                        summary,
                        originalData: null // Remove detailed data
                    });
                    summarized++;
                }
            }
            
            return summarized;
        } catch (error) {
            logger.error('Error summarizing projects:', error);
            return 0;
        }
    }

    async summarizeTasks() {
        try {
            // Get completed tasks older than threshold
            const tasks = await this.db.tasks.list ? await this.db.tasks.list() : [];
            const oldTasks = tasks.filter(t => 
                t.status === 'completed' &&
                Date.now() - new Date(t.createdAt).getTime() > this.config.maxDataAge
            );
            
            let summarized = 0;
            
            for (const task of oldTasks) {
                const summary = await this.createTaskSummary(task);
                await this.db.tasks.update(task.id, {
                    summarized: true,
                    summary,
                    result: null, // Remove detailed results
                    executionLogs: null
                });
                summarized++;
            }
            
            return summarized;
        } catch (error) {
            logger.error('Error summarizing tasks:', error);
            return 0;
        }
    }

    async summarizeAgentData() {
        try {
            const agents = await this.db.agents.listActiveAgents();
            let summarized = 0;
            
            for (const agent of agents) {
                const state = await this.db.agents.getAgentState(agent.id);
                if (state && this.shouldSummarizeAgentState(state)) {
                    const summary = await this.createAgentStateSummary(state);
                    await this.db.agents.updateAgentState(agent.id, {
                        summarized: true,
                        summary,
                        detailedHistory: null
                    });
                    summarized++;
                }
            }
            
            return summarized;
        } catch (error) {
            logger.error('Error summarizing agent data:', error);
            return 0;
        }
    }

    // LLM-powered summarization
    async createProjectSummary(project) {
        try {
            const prompt = `Summarize this project data concisely:
Project: ${project.name}
Description: ${project.description}
Status: ${project.status}
Key metrics and outcomes should be preserved.
Provide a 2-3 sentence summary:`;
            
            const response = await this.llm.request(prompt, {
                model: 'fast',
                temperature: 0.3,
                maxTokens: 150
            });
            
            return response.content;
        } catch (error) {
            return `Project ${project.name} (${project.status}) - Auto-summarized on ${new Date().toISOString()}`;
        }
    }

    async createTaskSummary(task) {
        try {
            const prompt = `Summarize this task execution:
Task: ${task.description}
Agent: ${task.agentId}
Status: ${task.status}
Result: ${task.result ? task.result.substring(0, 500) : 'No result'}
Provide a 1-2 sentence summary:`;
            
            const response = await this.llm.request(prompt, {
                model: 'fast',
                temperature: 0.3,
                maxTokens: 100
            });
            
            return response.content;
        } catch (error) {
            return `Task completed by ${task.agentId} on ${new Date(task.completedAt).toISOString()}`;
        }
    }

    async createAgentStateSummary(state) {
        try {
            const prompt = `Summarize this agent's recent activity:
Agent: ${state.agentId}
Recent tasks: ${JSON.stringify(state.recentTasks || [])}
Performance metrics: ${JSON.stringify(state.metrics || {})}
Provide a brief summary of key activities and performance:`;
            
            const response = await this.llm.request(prompt, {
                model: 'fast',
                temperature: 0.3,
                maxTokens: 100
            });
            
            return response.content;
        } catch (error) {
            return `Agent activity summary for ${state.agentId} as of ${new Date().toISOString()}`;
        }
    }

    // Helper methods for summarization decisions
    shouldSummarizeAgentState(state) {
        const age = Date.now() - new Date(state.updatedAt).getTime();
        return age > this.config.maxDataAge && !state.summarized;
    }

    // In-memory data compression
    async compressInMemoryData() {
        let compressed = 0;
        
        for (const map of this.memoryTracking.inMemoryMaps) {
            if (map.size > 100) { // Only compress large collections
                const originalSize = map.size;
                await this.compressMapData(map);
                compressed += originalSize - map.size;
            }
        }
        
        this.metrics.compressionsSaved += compressed;
        logger.debug(`Compressed ${compressed} data structure entries`);
        return compressed;
    }

    async compressMapData(map) {
        // Remove least recently used entries if map is too large
        if (map.size > 1000) {
            const entries = Array.from(map.entries());
            const toKeep = entries.slice(-500); // Keep last 500 entries
            map.clear();
            toKeep.forEach(([key, value]) => map.set(key, value));
        }
    }

    async compressAllData() {
        // Aggressive compression for emergency situations
        for (const map of this.memoryTracking.inMemoryMaps) {
            const targetSize = Math.floor(map.size * this.config.compressionRatio);
            if (map.size > targetSize) {
                const entries = Array.from(map.entries());
                const toKeep = entries.slice(-targetSize);
                map.clear();
                toKeep.forEach(([key, value]) => map.set(key, value));
            }
        }
    }

    // Redis data cleanup
    async cleanupRedisData() {
        try {
            // Clean up expired keys
            const expiredKeys = await this.findExpiredKeys();
            if (expiredKeys.length > 0) {
                await this.db.redis.del(...expiredKeys);
                logger.debug(`Cleaned up ${expiredKeys.length} expired Redis keys`);
            }
            
            // Clean up old log entries
            await this.cleanupOldLogs();
            
        } catch (error) {
            logger.error('Error cleaning up Redis data:', error);
        }
    }

    async findExpiredKeys() {
        // This would need to be implemented based on your key naming conventions
        // For now, return empty array
        return [];
    }

    async cleanupOldLogs() {
        try {
            const logKeys = await this.db.redis.keys('log:*');
            const oldThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
            const toDelete = [];
            
            for (const key of logKeys) {
                const timestamp = parseInt(key.split(':')[1]);
                if (timestamp && timestamp < oldThreshold) {
                    toDelete.push(key);
                }
            }
            
            if (toDelete.length > 0) {
                await this.db.redis.del(...toDelete);
                logger.debug(`Cleaned up ${toDelete.length} old log entries`);
            }
        } catch (error) {
            logger.error('Error cleaning up old logs:', error);
        }
    }

    // Connection management
    async cleanupConnections() {
        let released = 0;
        
        for (const connection of this.memoryTracking.activeConnections) {
            if (this.shouldReleaseConnection(connection)) {
                this.memoryTracking.activeConnections.delete(connection);
                released++;
            }
        }
        
        return released;
    }

    shouldReleaseConnection(connection) {
        // Implement connection release logic based on your needs
        return false;
    }

    async releaseAllNonEssentialData() {
        // Release all non-critical data structures
        const nonEssential = [];
        
        for (const [id, entry] of this.memoryTracking.dataStructures) {
            if (!entry.metadata.essential) {
                nonEssential.push(id);
            }
        }
        
        for (const id of nonEssential) {
            this.unregisterDataStructure(id);
        }
        
        logger.warn(`Released ${nonEssential.length} non-essential data structures`);
    }

    // Initial assessment
    async performInitialAssessment() {
        logger.info('Performing initial memory assessment...');
        
        const memUsage = process.memoryUsage();
        const assessment = {
            initialMemoryUsage: memUsage.heapUsed,
            heapSize: memUsage.heapTotal,
            externalMemory: memUsage.external,
            buffers: memUsage.arrayBuffers,
            timestamp: Date.now()
        };
        
        this.metrics.currentMemoryUsage = memUsage.heapUsed;
        this.metrics.peakMemoryUsage = memUsage.heapUsed;
        
        logger.info(`Initial memory assessment: ${this.formatBytes(memUsage.heapUsed)} used`);
        return assessment;
    }

    // Global memory tracking setup
    setupGlobalMemoryTracking() {
        // Track uncaught memory leaks
        process.on('warning', (warning) => {
            if (warning.name === 'MaxListenersExceededWarning') {
                logger.warn('Potential memory leak detected:', warning.message);
                this.emit('memoryLeakWarning', warning);
            }
        });
        
        // Monitor unhandled rejections that might cause leaks
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection (potential memory leak):', reason);
            this.emit('unhandledRejection', { reason, promise });
        });
    }

    // Utility methods
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public API
    getMemoryStatus() {
        const memUsage = process.memoryUsage();
        return {
            current: this.formatBytes(memUsage.heapUsed),
            peak: this.formatBytes(this.metrics.peakMemoryUsage),
            percentage: (memUsage.heapUsed / this.config.maxMemoryUsage) * 100,
            dataStructures: this.metrics.dataStructuresCount,
            temporaryData: this.memoryTracking.temporaryData.size,
            lastCleanup: this.memoryTracking.lastCleanup,
            metrics: this.metrics
        };
    }

    getDetailedMetrics() {
        return {
            ...this.metrics,
            tracking: {
                dataStructuresCount: this.memoryTracking.dataStructures.size,
                inMemoryMapsCount: this.memoryTracking.inMemoryMaps.size,
                temporaryDataCount: this.memoryTracking.temporaryData.size,
                activeConnectionsCount: this.memoryTracking.activeConnections.size
            },
            system: process.memoryUsage()
        };
    }

    // Shutdown and cleanup
    async shutdown() {
        logger.info('Shutting down Memory Manager...');
        
        // Clear all intervals
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        
        // Perform final cleanup
        await this.performScheduledCleanup();
        
        // Clear tracking data
        this.memoryTracking.dataStructures.clear();
        this.memoryTracking.temporaryData.clear();
        this.memoryTracking.inMemoryMaps.clear();
        this.memoryTracking.activeConnections.clear();
        
        logger.info('Memory Manager shutdown complete');
    }
}

export default MemoryManager;