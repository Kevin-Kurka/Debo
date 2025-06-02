/**
 * Optimized Services Index
 * Centralized service exports for the new optimized architecture
 */

// Core Services
export { default as DatabaseService } from './database-service.js';
export { default as AgentExecutionEngine } from './agent-execution-engine.js';
export { default as LLMRequestManager } from './llm-request-manager.js';
export { default as MemoryManager } from './memory-manager.js';
export { default as UnifiedOrchestratorService } from './unified-orchestrator-service.js';

// Service Factory for easy initialization
export class ServiceFactory {
    static async createOptimizedServices() {
        // Initialize database service first
        const databaseService = new DatabaseService();
        await databaseService.initialize();
        
        // Initialize LLM request manager with database
        const llmRequestManager = new LLMRequestManager(null, databaseService); // LLM provider will be injected
        await llmRequestManager.initialize();
        
        // Initialize memory manager
        const memoryManager = new MemoryManager(databaseService, llmRequestManager);
        await memoryManager.initialize();
        
        // Initialize agent execution engine
        const agentExecutionEngine = new AgentExecutionEngine(databaseService, llmRequestManager);
        await agentExecutionEngine.initialize();
        
        // Initialize unified orchestrator
        const unifiedOrchestrator = new UnifiedOrchestratorService(
            databaseService,
            agentExecutionEngine,
            llmRequestManager,
            memoryManager
        );
        await unifiedOrchestrator.initialize();
        
        return {
            database: databaseService,
            llmRequest: llmRequestManager,
            memory: memoryManager,
            agentExecution: agentExecutionEngine,
            orchestrator: unifiedOrchestrator
        };
    }
    
    static async createLegacyServices() {
        // Compatibility layer for existing code
        const services = await this.createOptimizedServices();
        
        // Create aliases for legacy components
        return {
            ...services,
            // Legacy aliases
            taskManager: services.database.tasks,
            projectManager: services.database.projects,
            agentManager: services.database.agents,
            unifiedOrchestrator: services.orchestrator
        };
    }
}

export default ServiceFactory;