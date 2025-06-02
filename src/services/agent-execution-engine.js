/**
 * Agent Execution Engine
 * Unified agent executor that replaces AgentExecutor, EnhancedAgentExecutor, 
 * and AgentDatabaseIntegration with optimized batch processing and resource management
 */

import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';

const logger = createLogger('AgentExecutionEngine');

class AgentExecutionEngine extends EventEmitter {
    constructor(databaseService, llmProvider) {
        super();
        this.db = databaseService;
        this.llmProvider = llmProvider;
        this.activeExecutions = new Map();
        this.executionQueue = [];
        this.batchQueue = new Map();
        this.resourceLimits = {
            maxConcurrentExecutions: 10,
            maxQueueSize: 100,
            executionTimeout: 300000, // 5 minutes
            batchSize: 5,
            batchTimeout: 2000 // 2 seconds
        };
        this.metrics = {
            executionsStarted: 0,
            executionsCompleted: 0,
            executionsFailed: 0,
            batchExecutions: 0,
            averageExecutionTime: 0,
            resourceCleanups: 0
        };
        this.isProcessing = false;
        this.cleanupInterval = null;
        
        this.startResourceCleanup();
    }

    async initialize() {
        logger.info('Agent Execution Engine initializing...');
        
        // Verify dependencies
        if (!this.db || !this.llmProvider) {
            throw new Error('Database service and LLM provider are required');
        }
        
        // Start queue processing
        this.startQueueProcessing();
        
        logger.info('Agent Execution Engine initialized successfully');
    }

    // Execute a single agent task
    async execute(agentId, task, options = {}) {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const execution = {
            id: executionId,
            agentId,
            task,
            options,
            startTime: Date.now(),
            status: 'pending'
        };

        try {
            // Check resource limits
            if (this.activeExecutions.size >= this.resourceLimits.maxConcurrentExecutions) {
                throw new Error('Maximum concurrent executions reached');
            }

            this.activeExecutions.set(executionId, execution);
            this.metrics.executionsStarted++;
            
            // Update agent state
            await this.updateAgentState(agentId, {
                status: 'executing',
                currentTask: task.id || task.description,
                executionId,
                startTime: execution.startTime
            });

            execution.status = 'running';
            this.emit('executionStarted', execution);

            // Execute the task
            const result = await this.executeTask(execution);
            
            // Update metrics
            const executionTime = Date.now() - execution.startTime;
            this.updateExecutionMetrics(executionTime);
            
            execution.status = 'completed';
            execution.result = result;
            execution.endTime = Date.now();
            execution.duration = executionTime;

            // Update agent state
            await this.updateAgentState(agentId, {
                status: 'idle',
                lastTask: task.id || task.description,
                lastExecution: executionId,
                lastCompletedAt: new Date().toISOString()
            });

            // Store execution result
            await this.storeExecutionResult(execution);

            this.metrics.executionsCompleted++;
            this.emit('executionCompleted', execution);

            return result;

        } catch (error) {
            execution.status = 'failed';
            execution.error = error.message;
            execution.endTime = Date.now();

            // Update agent state
            await this.updateAgentState(agentId, {
                status: 'error',
                lastError: error.message,
                lastErrorAt: new Date().toISOString()
            });

            this.metrics.executionsFailed++;
            this.emit('executionFailed', execution, error);

            logger.error(`Execution ${executionId} failed:`, error);
            throw error;

        } finally {
            this.activeExecutions.delete(executionId);
            this.cleanup(executionId);
        }
    }

    // Execute multiple tasks in batch for efficiency
    async executeBatch(tasks, options = {}) {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { parallel = true, maxConcurrency = 5 } = options;

        logger.info(`Starting batch execution ${batchId} with ${tasks.length} tasks`);

        try {
            let results;
            
            if (parallel) {
                // Execute tasks in parallel with concurrency limit
                results = await this.executeTasksInParallel(tasks, maxConcurrency);
            } else {
                // Execute tasks sequentially
                results = await this.executeTasksSequentially(tasks);
            }

            this.metrics.batchExecutions++;
            this.emit('batchExecutionCompleted', { batchId, tasks: tasks.length, results });

            logger.info(`Batch execution ${batchId} completed successfully`);
            return results;

        } catch (error) {
            this.emit('batchExecutionFailed', { batchId, error });
            logger.error(`Batch execution ${batchId} failed:`, error);
            throw error;
        }
    }

    async executeTasksInParallel(tasks, maxConcurrency) {
        const results = [];
        const executing = [];

        for (const task of tasks) {
            // Wait if we've reached max concurrency
            if (executing.length >= maxConcurrency) {
                const completed = await Promise.race(executing);
                const index = executing.indexOf(completed);
                executing.splice(index, 1);
                results.push(await completed);
            }

            // Start new execution
            const executionPromise = this.execute(task.agentId, task);
            executing.push(executionPromise);
        }

        // Wait for remaining executions
        const remainingResults = await Promise.all(executing);
        results.push(...remainingResults);

        return results;
    }

    async executeTasksSequentially(tasks) {
        const results = [];
        
        for (const task of tasks) {
            try {
                const result = await this.execute(task.agentId, task);
                results.push(result);
            } catch (error) {
                results.push({ error: error.message, task: task.id });
            }
        }

        return results;
    }

    // Core task execution logic
    async executeTask(execution) {
        const { agentId, task, options } = execution;

        // Get agent configuration
        const agent = await this.db.agents.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        // Prepare execution context
        const context = await this.prepareExecutionContext(agentId, task, options);

        // Generate prompt based on agent type and task
        const prompt = await this.generatePrompt(agent, task, context);

        // Execute with LLM
        const llmResponse = await this.callLLM(agent, prompt, options);

        // Process response based on agent type
        const result = await this.processResponse(agent, llmResponse, context);

        // Store deliverable if required
        if (result.deliverable) {
            await this.storeDeliverable(agentId, task, result.deliverable);
        }

        return result;
    }

    async prepareExecutionContext(agentId, task, options) {
        const context = {
            agentId,
            taskId: task.id,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        };

        // Get agent state and history
        const agentState = await this.db.agents.getAgentState(agentId);
        if (agentState) {
            context.previousState = agentState;
        }

        // Get task dependencies
        if (task.dependencies && task.dependencies.length > 0) {
            context.dependencies = await this.resolveDependencies(task.dependencies);
        }

        // Get project context if available
        if (task.projectId) {
            const project = await this.db.projects.get(task.projectId);
            if (project) {
                context.project = project;
            }
        }

        return context;
    }

    async generatePrompt(agent, task, context) {
        // Get base prompt from agent configuration
        let prompt = agent.instructions || agent.prompt || '';

        // Add task-specific information
        prompt += `\n\nCurrent Task: ${task.description || task.prompt}`;

        // Add context information
        if (context.project) {
            prompt += `\nProject Context: ${context.project.description}`;
        }

        if (context.dependencies) {
            prompt += `\nDependency Results: ${JSON.stringify(context.dependencies, null, 2)}`;
        }

        if (context.previousState) {
            prompt += `\nPrevious State: ${JSON.stringify(context.previousState, null, 2)}`;
        }

        // Add agent-specific instructions
        if (agent.type === 'thinking') {
            prompt += '\n\nProvide detailed reasoning and analysis.';
        } else if (agent.type === 'execution') {
            prompt += '\n\nProvide concrete, actionable results.';
        }

        return prompt;
    }

    async callLLM(agent, prompt, options) {
        const llmConfig = {
            model: agent.model || 'default',
            temperature: agent.temperature || 0.7,
            maxTokens: agent.maxTokens || 2000,
            ...options.llmConfig
        };

        return await this.llmProvider.generateResponse(prompt, llmConfig);
    }

    async processResponse(agent, llmResponse, context) {
        let result = {
            response: llmResponse,
            processed: true,
            timestamp: new Date().toISOString()
        };

        // Agent-specific processing
        if (agent.type === 'code_generator') {
            result = await this.processCodeResponse(llmResponse, context);
        } else if (agent.type === 'file_writer') {
            result = await this.processFileResponse(llmResponse, context);
        } else if (agent.type === 'analyzer') {
            result = await this.processAnalysisResponse(llmResponse, context);
        }

        return result;
    }

    async processCodeResponse(llmResponse, context) {
        // Extract code blocks from response
        const codeBlocks = this.extractCodeBlocks(llmResponse);
        
        return {
            response: llmResponse,
            codeBlocks,
            deliverable: {
                type: 'code',
                content: codeBlocks,
                language: this.detectLanguage(codeBlocks[0]?.code || '')
            },
            processed: true,
            timestamp: new Date().toISOString()
        };
    }

    async processFileResponse(llmResponse, context) {
        // Extract file operations from response
        const files = this.extractFileOperations(llmResponse);
        
        return {
            response: llmResponse,
            files,
            deliverable: {
                type: 'files',
                content: files
            },
            processed: true,
            timestamp: new Date().toISOString()
        };
    }

    async processAnalysisResponse(llmResponse, context) {
        // Extract structured analysis from response
        const analysis = this.extractAnalysis(llmResponse);
        
        return {
            response: llmResponse,
            analysis,
            deliverable: {
                type: 'analysis',
                content: analysis
            },
            processed: true,
            timestamp: new Date().toISOString()
        };
    }

    // Queue management for batch processing
    startQueueProcessing() {
        setInterval(() => {
            this.processBatchQueue();
        }, this.resourceLimits.batchTimeout);
    }

    async processBatchQueue() {
        if (this.isProcessing || this.batchQueue.size === 0) {
            return;
        }

        this.isProcessing = true;
        
        try {
            const batches = Array.from(this.batchQueue.values());
            const readyBatches = batches.filter(batch => 
                batch.tasks.length >= this.resourceLimits.batchSize ||
                Date.now() - batch.createdAt > this.resourceLimits.batchTimeout
            );

            for (const batch of readyBatches) {
                await this.executeBatch(batch.tasks, batch.options);
                this.batchQueue.delete(batch.id);
            }
        } catch (error) {
            logger.error('Error processing batch queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    // Resource management and cleanup
    startResourceCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.performResourceCleanup();
        }, 30000); // Clean up every 30 seconds
    }

    performResourceCleanup() {
        const now = Date.now();
        let cleanedUp = 0;

        // Clean up timed-out executions
        for (const [id, execution] of this.activeExecutions) {
            if (now - execution.startTime > this.resourceLimits.executionTimeout) {
                this.activeExecutions.delete(id);
                this.emit('executionTimeout', execution);
                cleanedUp++;
            }
        }

        // Clean up old batch entries
        for (const [id, batch] of this.batchQueue) {
            if (now - batch.createdAt > this.resourceLimits.batchTimeout * 5) {
                this.batchQueue.delete(id);
                cleanedUp++;
            }
        }

        if (cleanedUp > 0) {
            this.metrics.resourceCleanups++;
            logger.debug(`Cleaned up ${cleanedUp} resources`);
        }
    }

    cleanup(executionId) {
        // Perform any execution-specific cleanup
        this.emit('executionCleanup', executionId);
    }

    // Helper methods
    async updateAgentState(agentId, state) {
        try {
            await this.db.agents.updateAgentState(agentId, state);
        } catch (error) {
            logger.error(`Failed to update agent state for ${agentId}:`, error);
        }
    }

    async storeExecutionResult(execution) {
        try {
            await this.db.tasks.update(execution.task.id, {
                status: execution.status,
                result: JSON.stringify(execution.result),
                executionId: execution.id,
                completedAt: new Date().toISOString()
            });
        } catch (error) {
            logger.error(`Failed to store execution result for ${execution.id}:`, error);
        }
    }

    async storeDeliverable(agentId, task, deliverable) {
        try {
            const deliverableKey = `deliverable:${agentId}:${task.id}:${Date.now()}`;
            await this.db.system.setConfig(deliverableKey, deliverable);
        } catch (error) {
            logger.error(`Failed to store deliverable for ${agentId}:`, error);
        }
    }

    async resolveDependencies(dependencies) {
        const resolved = {};
        
        for (const dep of dependencies) {
            try {
                const task = await this.db.tasks.get(dep);
                if (task && task.result) {
                    resolved[dep] = JSON.parse(task.result);
                }
            } catch (error) {
                logger.error(`Failed to resolve dependency ${dep}:`, error);
            }
        }
        
        return resolved;
    }

    extractCodeBlocks(text) {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const blocks = [];
        let match;
        
        while ((match = codeBlockRegex.exec(text)) !== null) {
            blocks.push({
                language: match[1] || 'text',
                code: match[2].trim()
            });
        }
        
        return blocks;
    }

    extractFileOperations(text) {
        // Simple file operation extraction - can be enhanced
        const fileOpRegex = /(?:create|write|update)\s+file\s+["`']([^"`']+)["`']/gi;
        const operations = [];
        let match;
        
        while ((match = fileOpRegex.exec(text)) !== null) {
            operations.push({
                operation: 'write',
                path: match[1],
                content: '' // Would need more sophisticated parsing
            });
        }
        
        return operations;
    }

    extractAnalysis(text) {
        // Simple analysis extraction - can be enhanced
        return {
            summary: text.substring(0, 200) + '...',
            fullText: text,
            extractedAt: new Date().toISOString()
        };
    }

    detectLanguage(code) {
        if (code.includes('import ') || code.includes('export ')) return 'javascript';
        if (code.includes('def ') || code.includes('import ')) return 'python';
        if (code.includes('#include') || code.includes('int main')) return 'c++';
        return 'text';
    }

    updateExecutionMetrics(executionTime) {
        const count = this.metrics.executionsCompleted;
        this.metrics.averageExecutionTime = 
            (this.metrics.averageExecutionTime * count + executionTime) / (count + 1);
    }

    // Public API methods
    getMetrics() {
        return {
            ...this.metrics,
            activeExecutions: this.activeExecutions.size,
            queueSize: this.executionQueue.length,
            batchQueueSize: this.batchQueue.size
        };
    }

    getStatus() {
        return {
            isRunning: this.isProcessing,
            activeExecutions: this.activeExecutions.size,
            metrics: this.getMetrics()
        };
    }

    async shutdown() {
        logger.info('Shutting down Agent Execution Engine...');
        
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        // Wait for active executions to complete or timeout
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 10000));
        const executionsPromise = Promise.all(Array.from(this.activeExecutions.values()));
        
        await Promise.race([executionsPromise, timeoutPromise]);
        
        logger.info('Agent Execution Engine shutdown complete');
    }
}

export default AgentExecutionEngine;