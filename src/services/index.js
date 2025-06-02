/**
 * Optimized Services Index
 * Centralized service exports for the new optimized architecture
 */

import logger from '../logger.js';

// Core Services
export { default as DatabaseService } from './database-service.js';
export { default as AgentExecutionEngine } from './agent-execution-engine.js';
export { default as LLMRequestManager } from './llm-request-manager.js';
export { default as MemoryManager } from './memory-manager.js';
export { default as UnifiedOrchestratorService } from './unified-orchestrator-service.js';

// Network Services
export { default as WebSocketService } from './websocket-service.js';
export { default as DashboardService } from './dashboard-service.js';

// Service Factory for easy initialization
export class ServiceFactory {
    static async createOptimizedServices() {
        // Import services dynamically to avoid circular dependencies
        const { default: DatabaseService } = await import('./database-service.js');
        const { default: AgentExecutionEngine } = await import('./agent-execution-engine.js');
        const { default: LLMRequestManager } = await import('./llm-request-manager.js');
        const { default: MemoryManager } = await import('./memory-manager.js');
        const { default: UnifiedOrchestratorService } = await import('./unified-orchestrator-service.js');
        const { default: WebSocketService } = await import('./websocket-service.js');
        const { default: DashboardService } = await import('./dashboard-service.js');
        
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
        
        // Initialize network services (optional - can be enabled/disabled)
        let webSocketService = null;
        let dashboardService = null;
        
        try {
            webSocketService = new WebSocketService();
            await webSocketService.initialize();
        } catch (error) {
            logger.warn('WebSocket service initialization failed:', error.message);
        }
        
        try {
            dashboardService = new DashboardService();
            await dashboardService.initialize();
        } catch (error) {
            logger.warn('Dashboard service initialization failed:', error.message);
        }
        
        return {
            database: databaseService,
            llmRequest: llmRequestManager,
            memory: memoryManager,
            agentExecution: agentExecutionEngine,
            orchestrator: unifiedOrchestrator,
            webSocket: webSocketService,
            dashboard: dashboardService
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