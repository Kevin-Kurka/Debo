/**
 * Unified Orchestrator Service
 * Replaces 4 separate orchestrators with a single adaptive orchestrator
 * using strategy pattern for different workflow types
 */

import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';
import { ErrorHandler, PerformanceMonitor, CryptoUtils } from '../utils/shared-utilities.js';

const logger = createLogger('UnifiedOrchestratorService');

class UnifiedOrchestratorService extends EventEmitter {
    constructor(databaseService, agentExecutionEngine, llmRequestManager, memoryManager) {
        super();
        this.db = databaseService;
        this.agentEngine = agentExecutionEngine;
        this.llm = llmRequestManager;
        this.memory = memoryManager;
        
        // Strategy registry for different workflow types
        this.strategies = new Map();
        this.activeWorkflows = new Map();
        this.workflowQueue = [];
        
        // Configuration
        this.config = {
            maxConcurrentWorkflows: 10,
            workflowTimeout: 1800000, // 30 minutes
            strategyTimeout: 300000, // 5 minutes
            retryAttempts: 3,
            enableMetrics: true
        };
        
        // Metrics
        this.metrics = {
            workflowsStarted: 0,
            workflowsCompleted: 0,
            workflowsFailed: 0,
            averageWorkflowTime: 0,
            strategiesUsed: new Map(),
            queuedWorkflows: 0
        };
        
        // Initialize built-in strategies
        this.initializeStrategies();
    }

    async initialize() {
        logger.info('Initializing Unified Orchestrator Service...');
        
        try {
            // Validate dependencies
            this.validateDependencies();
            
            // Register event handlers
            this.setupEventHandlers();
            
            // Start workflow processing
            this.startWorkflowProcessing();
            
            logger.info('Unified Orchestrator Service initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize Unified Orchestrator Service:', error);
            throw error;
        }
    }

    // Strategy Management
    initializeStrategies() {
        // Software Development Strategy
        this.registerStrategy('software_development', new SoftwareDevelopmentStrategy(this));
        
        // Business Operations Strategy
        this.registerStrategy('business_operations', new BusinessOperationsStrategy(this));
        
        // Truth Finding Strategy
        this.registerStrategy('truth_finding', new TruthFindingStrategy(this));
        
        // Fortune 500 Strategy
        this.registerStrategy('fortune500', new Fortune500Strategy(this));
        
        // Generic Strategy (fallback)
        this.registerStrategy('generic', new GenericStrategy(this));
        
        logger.info(`Initialized ${this.strategies.size} orchestration strategies`);
    }

    registerStrategy(name, strategy) {
        this.strategies.set(name, strategy);
        logger.debug(`Registered strategy: ${name}`);
    }

    getStrategy(name) {
        return this.strategies.get(name);
    }

    // Main orchestration entry point
    async orchestrate(request, options = {}) {
        const workflowId = CryptoUtils.generateTimeBasedId('workflow');
        
        try {
            PerformanceMonitor.startTimer(`workflow_${workflowId}`);
            this.metrics.workflowsStarted++;
            
            // Create workflow context
            const context = await this.createWorkflowContext(workflowId, request, options);
            
            // Analyze request and select strategy
            const strategy = await this.selectStrategy(request, context);
            
            // Execute workflow using selected strategy
            const result = await this.executeWorkflow(workflowId, strategy, context);
            
            // Record completion metrics
            const timing = PerformanceMonitor.endTimer(`workflow_${workflowId}`);
            this.updateWorkflowMetrics(strategy.name, timing.duration, true);
            
            this.metrics.workflowsCompleted++;
            this.emit('workflowCompleted', { workflowId, result, timing });
            
            return result;
            
        } catch (error) {
            this.metrics.workflowsFailed++;
            const errorResult = await ErrorHandler.handleWithRecovery(
                error,
                { workflowId, request, options },
                this.recoverWorkflow.bind(this)
            );
            
            this.emit('workflowFailed', { workflowId, error, errorResult });
            throw error;
        } finally {
            this.activeWorkflows.delete(workflowId);
        }
    }

    // Strategy Selection Logic
    async selectStrategy(request, context) {
        logger.debug('Analyzing request to select optimal strategy...');
        
        // Analyze request content using LLM
        const analysisPrompt = `Analyze this request and determine the best orchestration strategy:

Request: ${request}
Context: ${JSON.stringify(context, null, 2)}

Available strategies:
- software_development: For coding, technical tasks, development projects
- business_operations: For business processes, financial operations, HR tasks
- truth_finding: For research, fact-checking, evidence verification
- fortune500: For complex multi-department corporate operations
- generic: For general tasks that don't fit other categories

Respond with just the strategy name:`;

        try {
            const response = await this.llm.request(analysisPrompt, {
                model: 'fast',
                temperature: 0.1,
                maxTokens: 50
            });
            
            const suggestedStrategy = response.content.trim().toLowerCase();
            
            // Validate and return strategy
            if (this.strategies.has(suggestedStrategy)) {
                logger.info(`Selected strategy: ${suggestedStrategy}`);
                return this.strategies.get(suggestedStrategy);
            }
            
        } catch (error) {
            logger.warn('Failed to analyze request for strategy selection:', error);
        }
        
        // Fallback to pattern matching
        const fallbackStrategy = this.selectStrategyByPatterns(request);
        logger.info(`Using fallback strategy: ${fallbackStrategy.name}`);
        return fallbackStrategy;
    }

    selectStrategyByPatterns(request) {
        const requestLower = request.toLowerCase();
        
        // Software development patterns
        if (this.matchesPatterns(requestLower, [
            'code', 'develop', 'build', 'program', 'api', 'database', 'frontend', 'backend',
            'javascript', 'python', 'node', 'react', 'git', 'deploy', 'test'
        ])) {
            return this.strategies.get('software_development');
        }
        
        // Business operations patterns
        if (this.matchesPatterns(requestLower, [
            'budget', 'finance', 'hr', 'sales', 'marketing', 'operations', 'strategy',
            'revenue', 'profit', 'employee', 'customer', 'business', 'report'
        ])) {
            return this.strategies.get('business_operations');
        }
        
        // Truth finding patterns
        if (this.matchesPatterns(requestLower, [
            'research', 'verify', 'fact', 'truth', 'evidence', 'source', 'investigate',
            'analyze', 'credibility', 'legal', 'dispute', 'argument'
        ])) {
            return this.strategies.get('truth_finding');
        }
        
        // Fortune 500 patterns
        if (this.matchesPatterns(requestLower, [
            'enterprise', 'corporate', 'ceo', 'cfo', 'executive', 'board', 'department',
            'quarterly', 'annual', 'stakeholder', 'governance', 'compliance'
        ])) {
            return this.strategies.get('fortune500');
        }
        
        // Default to generic strategy
        return this.strategies.get('generic');
    }

    matchesPatterns(text, patterns) {
        return patterns.some(pattern => text.includes(pattern));
    }

    // Workflow Execution
    async executeWorkflow(workflowId, strategy, context) {
        logger.info(`Executing workflow ${workflowId} using ${strategy.name} strategy`);
        
        // Add to active workflows
        this.activeWorkflows.set(workflowId, {
            id: workflowId,
            strategy: strategy.name,
            startTime: Date.now(),
            context,
            status: 'running'
        });
        
        try {
            // Execute strategy with timeout
            const result = await ErrorHandler.withTimeout(
                strategy.execute(context),
                this.config.strategyTimeout,
                `Strategy ${strategy.name} execution timed out`
            );
            
            // Store workflow result
            await this.storeWorkflowResult(workflowId, result);
            
            return result;
            
        } catch (error) {
            // Update workflow status
            const workflow = this.activeWorkflows.get(workflowId);
            if (workflow) {
                workflow.status = 'failed';
                workflow.error = error.message;
            }
            
            throw error;
        }
    }

    // Context Creation
    async createWorkflowContext(workflowId, request, options) {
        return {
            workflowId,
            request,
            options,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            services: {
                db: this.db,
                agentEngine: this.agentEngine,
                llm: this.llm,
                memory: this.memory
            },
            // Add any global context data
            globalContext: await this.getGlobalContext()
        };
    }

    async getGlobalContext() {
        try {
            return {
                systemConfig: await this.db.system.getConfig('global_config', {}),
                activeAgents: await this.db.agents.listActiveAgents(),
                systemMetrics: this.memory.getMemoryStatus()
            };
        } catch (error) {
            logger.warn('Failed to get global context:', error);
            return {};
        }
    }

    // Workflow Processing Queue
    startWorkflowProcessing() {
        setInterval(() => {
            this.processWorkflowQueue();
        }, 1000); // Process queue every second
    }

    async processWorkflowQueue() {
        if (this.workflowQueue.length === 0) return;
        if (this.activeWorkflows.size >= this.config.maxConcurrentWorkflows) return;
        
        const workflow = this.workflowQueue.shift();
        if (workflow) {
            try {
                await this.orchestrate(workflow.request, workflow.options);
            } catch (error) {
                logger.error(`Queued workflow failed:`, error);
            }
        }
    }

    queueWorkflow(request, options = {}) {
        const queueEntry = {
            id: CryptoUtils.generateTimeBasedId('queued'),
            request,
            options,
            queuedAt: Date.now()
        };
        
        this.workflowQueue.push(queueEntry);
        this.metrics.queuedWorkflows++;
        
        logger.info(`Workflow queued: ${queueEntry.id}`);
        return queueEntry.id;
    }

    // Error Recovery
    async recoverWorkflow(error, context) {
        logger.info(`Attempting workflow recovery for ${context.workflowId}...`);
        
        try {
            // Try to recover with generic strategy if original failed
            if (context.strategy !== 'generic') {
                const genericStrategy = this.strategies.get('generic');
                const result = await genericStrategy.execute(context);
                
                return {
                    success: true,
                    result,
                    recoveryMethod: 'generic_strategy_fallback'
                };
            }
            
            // If generic strategy also failed, try minimal execution
            const minimalResult = await this.executeMinimalWorkflow(context);
            
            return {
                success: true,
                result: minimalResult,
                recoveryMethod: 'minimal_execution'
            };
            
        } catch (recoveryError) {
            return {
                success: false,
                error: recoveryError.message,
                originalError: error.message
            };
        }
    }

    async executeMinimalWorkflow(context) {
        return {
            status: 'partial_completion',
            message: 'Workflow completed with minimal functionality due to errors',
            context: context.workflowId,
            timestamp: new Date().toISOString()
        };
    }

    // Data Management
    async storeWorkflowResult(workflowId, result) {
        try {
            await this.db.system.setConfig(`workflow_result:${workflowId}`, {
                workflowId,
                result,
                timestamp: new Date().toISOString(),
                ttl: 86400 // 24 hours
            });
        } catch (error) {
            logger.error(`Failed to store workflow result for ${workflowId}:`, error);
        }
    }

    // Metrics and Monitoring
    updateWorkflowMetrics(strategyName, duration, success) {
        // Update strategy usage
        const strategyCount = this.metrics.strategiesUsed.get(strategyName) || 0;
        this.metrics.strategiesUsed.set(strategyName, strategyCount + 1);
        
        // Update average workflow time
        const totalWorkflows = this.metrics.workflowsCompleted + this.metrics.workflowsFailed;
        this.metrics.averageWorkflowTime = 
            (this.metrics.averageWorkflowTime * (totalWorkflows - 1) + duration) / totalWorkflows;
    }

    // Event Handlers
    setupEventHandlers() {
        this.agentEngine.on('executionCompleted', (execution) => {
            this.emit('agentExecutionCompleted', execution);
        });
        
        this.agentEngine.on('executionFailed', (execution, error) => {
            this.emit('agentExecutionFailed', { execution, error });
        });
        
        this.memory.on('memoryWarning', (warning) => {
            logger.warn('Memory warning during orchestration:', warning);
        });
    }

    // Dependency Validation
    validateDependencies() {
        const required = ['db', 'agentEngine', 'llm', 'memory'];
        const missing = required.filter(dep => !this[dep]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required dependencies: ${missing.join(', ')}`);
        }
    }

    // Public API
    getActiveWorkflows() {
        return Array.from(this.activeWorkflows.values());
    }

    getWorkflowStatus(workflowId) {
        return this.activeWorkflows.get(workflowId) || null;
    }

    getMetrics() {
        return {
            ...this.metrics,
            activeWorkflowsCount: this.activeWorkflows.size,
            queueLength: this.workflowQueue.length,
            strategiesRegistered: this.strategies.size,
            strategiesUsed: Object.fromEntries(this.metrics.strategiesUsed)
        };
    }

    // Shutdown
    async shutdown() {
        logger.info('Shutting down Unified Orchestrator Service...');
        
        // Wait for active workflows to complete
        const activeWorkflowIds = Array.from(this.activeWorkflows.keys());
        if (activeWorkflowIds.length > 0) {
            logger.info(`Waiting for ${activeWorkflowIds.length} active workflows to complete...`);
            
            const timeout = setTimeout(() => {
                logger.warn('Workflow shutdown timeout, forcing termination');
            }, 30000);
            
            while (this.activeWorkflows.size > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            clearTimeout(timeout);
        }
        
        // Clear queue
        this.workflowQueue.length = 0;
        
        logger.info('Unified Orchestrator Service shutdown complete');
    }
}

// Strategy Base Class
class OrchestrationStrategy {
    constructor(orchestrator, name) {
        this.orchestrator = orchestrator;
        this.name = name;
    }

    async execute(context) {
        throw new Error('Strategy execute method must be implemented');
    }
}

// Software Development Strategy
class SoftwareDevelopmentStrategy extends OrchestrationStrategy {
    constructor(orchestrator) {
        super(orchestrator, 'software_development');
    }

    async execute(context) {
        const { request, services } = context;
        
        logger.info('Executing software development workflow...');
        
        // Analyze the development request
        const analysis = await this.analyzeRequest(request, services.llm);
        
        // Create development plan
        const plan = await this.createDevelopmentPlan(analysis, services);
        
        // Execute development tasks
        const results = await this.executeDevelopmentTasks(plan, services);
        
        return {
            strategy: this.name,
            analysis,
            plan,
            results,
            deliverables: results.deliverables || [],
            timestamp: new Date().toISOString()
        };
    }

    async analyzeRequest(request, llm) {
        const prompt = `Analyze this software development request:

${request}

Provide analysis in this format:
- Project Type: [web app/api/library/tool/etc]
- Technologies: [list of technologies needed]
- Complexity: [simple/medium/complex]
- Timeline: [estimated time]
- Key Features: [list of main features]
- Dependencies: [external dependencies needed]`;

        const response = await llm.request(prompt, {
            model: 'thinking',
            temperature: 0.3
        });

        return {
            raw: response.content,
            timestamp: new Date().toISOString()
        };
    }

    async createDevelopmentPlan(analysis, services) {
        // Create a development plan with phases and tasks
        return {
            phases: [
                { name: 'Planning', status: 'completed' },
                { name: 'Implementation', status: 'pending' },
                { name: 'Testing', status: 'pending' },
                { name: 'Deployment', status: 'pending' }
            ],
            createdAt: new Date().toISOString()
        };
    }

    async executeDevelopmentTasks(plan, services) {
        // Execute development tasks using agent engine
        const tasks = [
            { agentId: 'backend_developer', description: 'Implement backend logic' },
            { agentId: 'frontend_developer', description: 'Create user interface' },
            { agentId: 'qa_engineer', description: 'Test implementation' }
        ];

        const results = await services.agentEngine.executeBatch(tasks);
        
        return {
            taskResults: results,
            deliverables: [],
            completedAt: new Date().toISOString()
        };
    }
}

// Business Operations Strategy
class BusinessOperationsStrategy extends OrchestrationStrategy {
    constructor(orchestrator) {
        super(orchestrator, 'business_operations');
    }

    async execute(context) {
        const { request, services } = context;
        
        logger.info('Executing business operations workflow...');
        
        // Route to appropriate business departments
        const departments = await this.identifyDepartments(request, services.llm);
        
        // Execute business processes
        const results = await this.executeBusinessProcesses(departments, request, services);
        
        return {
            strategy: this.name,
            departments,
            results,
            recommendations: results.recommendations || [],
            timestamp: new Date().toISOString()
        };
    }

    async identifyDepartments(request, llm) {
        const prompt = `Identify which business departments should handle this request:

${request}

Available departments: Finance, HR, Sales, Marketing, Operations, Legal, IT, Strategy

Respond with a list of relevant departments:`;

        const response = await llm.request(prompt, {
            model: 'fast',
            temperature: 0.2
        });

        return response.content.split(',').map(d => d.trim());
    }

    async executeBusinessProcesses(departments, request, services) {
        const tasks = departments.map(dept => ({
            agentId: `${dept.toLowerCase()}_manager`,
            description: `Handle ${dept} aspects of: ${request}`
        }));

        const results = await services.agentEngine.executeBatch(tasks);
        
        return {
            departmentResults: results,
            recommendations: [],
            completedAt: new Date().toISOString()
        };
    }
}

// Truth Finding Strategy
class TruthFindingStrategy extends OrchestrationStrategy {
    constructor(orchestrator) {
        super(orchestrator, 'truth_finding');
    }

    async execute(context) {
        const { request, services } = context;
        
        logger.info('Executing truth finding workflow...');
        
        // Execute truth finding agents in sequence
        const truthSeekerResult = await services.agentEngine.execute('truth_seeker', {
            description: `Find primary sources for: ${request}`
        });
        
        const credibilityResult = await services.agentEngine.execute('credibility_agent', {
            description: `Assess credibility of sources found for: ${request}`
        });
        
        const trialResult = await services.agentEngine.execute('trial_by_fire', {
            description: `Present arguments for and against: ${request}`
        });

        return {
            strategy: this.name,
            truthSeekerResult,
            credibilityResult,
            trialResult,
            verdict: this.synthesizeVerdict(truthSeekerResult, credibilityResult, trialResult),
            timestamp: new Date().toISOString()
        };
    }

    synthesizeVerdict(truthResult, credibilityResult, trialResult) {
        return {
            summary: 'Truth finding analysis completed',
            confidence: 'medium',
            sources: [],
            arguments: {
                for: [],
                against: []
            }
        };
    }
}

// Fortune 500 Strategy
class Fortune500Strategy extends OrchestrationStrategy {
    constructor(orchestrator) {
        super(orchestrator, 'fortune500');
    }

    async execute(context) {
        const { request, services } = context;
        
        logger.info('Executing Fortune 500 enterprise workflow...');
        
        // CEO analysis first
        const ceoAnalysis = await services.agentEngine.execute('ceo', {
            description: `Analyze from CEO perspective: ${request}`
        });
        
        // Delegate to C-suite based on analysis
        const csuiteTasks = await this.createCSuiteTasks(ceoAnalysis, request);
        const csuiteResults = await services.agentEngine.executeBatch(csuiteTasks);
        
        // Execute department-level tasks
        const departmentTasks = await this.createDepartmentTasks(csuiteResults, request);
        const departmentResults = await services.agentEngine.executeBatch(departmentTasks);

        return {
            strategy: this.name,
            ceoAnalysis,
            csuiteResults,
            departmentResults,
            executiveSummary: this.createExecutiveSummary(ceoAnalysis, csuiteResults, departmentResults),
            timestamp: new Date().toISOString()
        };
    }

    async createCSuiteTasks(ceoAnalysis, request) {
        return [
            { agentId: 'cfo', description: `Financial analysis of: ${request}` },
            { agentId: 'coo', description: `Operational analysis of: ${request}` },
            { agentId: 'cto', description: `Technical analysis of: ${request}` }
        ];
    }

    async createDepartmentTasks(csuiteResults, request) {
        return [
            { agentId: 'finance_manager', description: `Execute financial aspects of: ${request}` },
            { agentId: 'operations_manager', description: `Execute operational aspects of: ${request}` }
        ];
    }

    createExecutiveSummary(ceoAnalysis, csuiteResults, departmentResults) {
        return {
            overview: 'Enterprise analysis completed',
            keyFindings: [],
            recommendations: [],
            nextSteps: [],
            createdAt: new Date().toISOString()
        };
    }
}

// Generic Strategy (Fallback)
class GenericStrategy extends OrchestrationStrategy {
    constructor(orchestrator) {
        super(orchestrator, 'generic');
    }

    async execute(context) {
        const { request, services } = context;
        
        logger.info('Executing generic workflow...');
        
        // Simple single-agent execution
        const result = await services.agentEngine.execute('general_assistant', {
            description: request
        });

        return {
            strategy: this.name,
            result,
            timestamp: new Date().toISOString()
        };
    }
}

export default UnifiedOrchestratorService;
export {
    OrchestrationStrategy,
    SoftwareDevelopmentStrategy,
    BusinessOperationsStrategy,
    TruthFindingStrategy,
    Fortune500Strategy,
    GenericStrategy
};