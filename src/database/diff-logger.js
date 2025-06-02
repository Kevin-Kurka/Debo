import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class DiffLogger {
  constructor(taskManager, llmProvider) {
    this.taskManager = taskManager;
    this.llmProvider = llmProvider;
    this.config = {
      maxDiffHistory: 1000,
      maxDiffSize: 1024 * 1024, // 1MB per diff
      retentionDays: 90,
      compressionThreshold: 100, // Compress after 100 diffs
      snapshotInterval: 24 * 60 * 60 * 1000, // 24 hours
      batchSize: 50
    };
    this.diffQueue = [];
    this.processingInterval = null;
  }

  async init() {
    // Load existing diff metadata
    await this.loadDiffMetadata();
    
    // Start diff processing
    this.startDiffProcessing();
    
    logger.info('Diff Logger initialized');
  }

  /**
   * Log a change with full diff tracking
   */
  async logChange(entityType, entityId, changes, context = {}) {
    const changeId = uuidv4();
    const timestamp = new Date().toISOString();
    
    try {
      // Get previous state for diff calculation
      const previousState = await this.getPreviousState(entityType, entityId);
      const currentState = changes;
      
      // Calculate diff
      const diff = this.calculateDiff(previousState, currentState);
      
      // Create change record
      const changeRecord = {
        id: changeId,
        entityType,
        entityId,
        timestamp,
        changes,
        diff,
        context: {
          user: context.user || 'system',
          operation: context.operation || 'update',
          reason: context.reason || 'automated',
          agent: context.agent || null,
          sessionId: context.sessionId || null,
          ...context
        },
        metadata: {
          size: this.calculateSize(diff),
          complexity: this.calculateComplexity(diff),
          impact: this.calculateImpact(diff, entityType)
        }
      };
      
      // Store change record
      await this.storeChangeRecord(changeRecord);
      
      // Update entity's current state
      await this.updateCurrentState(entityType, entityId, currentState);
      
      // Add to processing queue for analysis
      this.diffQueue.push(changeRecord);
      
      logger.debug(`Change logged: ${entityType}:${entityId}`, {
        changeId,
        operation: context.operation,
        diffSize: changeRecord.metadata.size
      });
      
      return changeId;
      
    } catch (error) {
      logger.error('Failed to log change:', error);
      throw error;
    }
  }

  /**
   * Calculate detailed diff between two states
   */
  calculateDiff(previousState, currentState) {
    if (!previousState) {
      return {
        type: 'create',
        added: currentState,
        removed: null,
        modified: null
      };
    }
    
    const diff = {
      type: 'update',
      added: {},
      removed: {},
      modified: {}
    };
    
    // Deep diff calculation
    this.deepDiff(previousState, currentState, diff, '');
    
    return diff;
  }

  /**
   * Perform deep diff between objects
   */
  deepDiff(oldObj, newObj, diff, path) {
    const oldKeys = new Set(Object.keys(oldObj || {}));
    const newKeys = new Set(Object.keys(newObj || {}));
    
    // Find added keys
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        this.setNestedPath(diff.added, `${path}${key}`, newObj[key]);
      }
    }
    
    // Find removed keys
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        this.setNestedPath(diff.removed, `${path}${key}`, oldObj[key]);
      }
    }
    
    // Find modified keys
    for (const key of newKeys) {
      if (oldKeys.has(key)) {
        const oldValue = oldObj[key];
        const newValue = newObj[key];
        
        if (this.isObject(oldValue) && this.isObject(newValue)) {
          // Recursively diff objects
          this.deepDiff(oldValue, newValue, diff, `${path}${key}.`);
        } else if (!this.isEqual(oldValue, newValue)) {
          this.setNestedPath(diff.modified, `${path}${key}`, {
            from: oldValue,
            to: newValue
          });
        }
      }
    }
  }

  /**
   * Get change history for an entity
   */
  async getChangeHistory(entityType, entityId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      startDate = null,
      endDate = null,
      operations = null
    } = options;
    
    try {
      const changeKey = `changes:${entityType}:${entityId}`;
      const changeIds = await this.taskManager.lrange(changeKey, offset, offset + limit - 1);
      
      const changes = [];
      for (const changeId of changeIds) {
        const changeRecord = await this.getChangeRecord(changeId);
        if (changeRecord) {
          // Apply filters
          if (startDate && new Date(changeRecord.timestamp) < new Date(startDate)) continue;
          if (endDate && new Date(changeRecord.timestamp) > new Date(endDate)) continue;
          if (operations && !operations.includes(changeRecord.context.operation)) continue;
          
          changes.push(changeRecord);
        }
      }
      
      return {
        changes,
        total: await this.taskManager.llen(changeKey),
        hasMore: changes.length === limit
      };
      
    } catch (error) {
      logger.error('Failed to get change history:', error);
      throw error;
    }
  }

  /**
   * Rollback entity to a previous state
   */
  async rollback(entityType, entityId, targetChangeId, options = {}) {
    try {
      // Get target change record
      const targetChange = await this.getChangeRecord(targetChangeId);
      if (!targetChange) {
        throw new Error(`Change record not found: ${targetChangeId}`);
      }
      
      // Verify the change belongs to this entity
      if (targetChange.entityType !== entityType || targetChange.entityId !== entityId) {
        throw new Error('Change record does not match entity');
      }
      
      // Get all changes after the target
      const changesAfter = await this.getChangesAfter(entityType, entityId, targetChange.timestamp);
      
      // Calculate rollback state by reversing changes
      const rollbackState = await this.calculateRollbackState(targetChange, changesAfter);
      
      // Create rollback change record
      const rollbackChangeId = await this.logChange(entityType, entityId, rollbackState, {
        operation: 'rollback',
        reason: `Rollback to change ${targetChangeId}`,
        targetChangeId,
        user: options.user || 'system'
      });
      
      logger.info(`Rollback completed: ${entityType}:${entityId}`, {
        targetChangeId,
        rollbackChangeId,
        changesReversed: changesAfter.length
      });
      
      return {
        rollbackChangeId,
        targetChangeId,
        rollbackState,
        changesReversed: changesAfter.length
      };
      
    } catch (error) {
      logger.error('Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Generate change summary using LLM
   */
  async generateChangeSummary(entityType, entityId, options = {}) {
    try {
      const history = await this.getChangeHistory(entityType, entityId, {
        limit: options.limit || 20
      });
      
      if (history.changes.length === 0) {
        return { summary: 'No changes found', impact: 'none' };
      }
      
      const prompt = this.buildSummaryPrompt(entityType, entityId, history.changes);
      
      const response = await this.llmProvider.generateResponse(prompt, {
        model: 'fast',
        maxTokens: 500,
        temperature: 0.3
      });
      
      const summary = this.parseSummaryResponse(response.content);
      
      // Store summary for future reference
      await this.storeSummary(entityType, entityId, summary);
      
      return summary;
      
    } catch (error) {
      logger.error('Failed to generate change summary:', error);
      return { summary: 'Summary generation failed', impact: 'unknown' };
    }
  }

  /**
   * Compare states between two points in time
   */
  async compareStates(entityType, entityId, fromTimestamp, toTimestamp) {
    try {
      const fromState = await this.getStateAtTime(entityType, entityId, fromTimestamp);
      const toState = await this.getStateAtTime(entityType, entityId, toTimestamp);
      
      const diff = this.calculateDiff(fromState, toState);
      
      return {
        fromTimestamp,
        toTimestamp,
        fromState,
        toState,
        diff,
        changeCount: await this.getChangeCountBetween(entityType, entityId, fromTimestamp, toTimestamp)
      };
      
    } catch (error) {
      logger.error('Failed to compare states:', error);
      throw error;
    }
  }

  /**
   * Get diff statistics for analysis
   */
  async getDiffStatistics(entityType = null, timeRange = null) {
    try {
      const stats = {
        totalChanges: 0,
        entitiesModified: new Set(),
        operationCounts: {},
        impactLevels: {},
        averageChangeSize: 0,
        timeRange: timeRange || { start: null, end: null }
      };
      
      const changeKeys = entityType 
        ? await this.taskManager.keys(`changes:${entityType}:*`)
        : await this.taskManager.keys('changes:*');
      
      let totalSize = 0;
      
      for (const changeKey of changeKeys) {
        const changeIds = await this.taskManager.lrange(changeKey, 0, -1);
        
        for (const changeId of changeIds) {
          const change = await this.getChangeRecord(changeId);
          if (!change) continue;
          
          // Apply time filter
          if (timeRange) {
            const changeTime = new Date(change.timestamp);
            if (timeRange.start && changeTime < new Date(timeRange.start)) continue;
            if (timeRange.end && changeTime > new Date(timeRange.end)) continue;
          }
          
          stats.totalChanges++;
          stats.entitiesModified.add(`${change.entityType}:${change.entityId}`);
          
          // Count operations
          const operation = change.context.operation;
          stats.operationCounts[operation] = (stats.operationCounts[operation] || 0) + 1;
          
          // Count impact levels
          const impact = change.metadata.impact;
          stats.impactLevels[impact] = (stats.impactLevels[impact] || 0) + 1;
          
          totalSize += change.metadata.size;
        }
      }
      
      stats.entitiesModified = stats.entitiesModified.size;
      stats.averageChangeSize = stats.totalChanges > 0 ? totalSize / stats.totalChanges : 0;
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to get diff statistics:', error);
      throw error;
    }
  }

  /**
   * Find related changes across entities
   */
  async findRelatedChanges(changeId, options = {}) {
    try {
      const change = await this.getChangeRecord(changeId);
      if (!change) {
        throw new Error(`Change record not found: ${changeId}`);
      }
      
      const relatedChanges = [];
      const timeWindow = options.timeWindow || 60 * 60 * 1000; // 1 hour
      const changeTime = new Date(change.timestamp);
      
      // Find changes in time window
      const startTime = new Date(changeTime.getTime() - timeWindow);
      const endTime = new Date(changeTime.getTime() + timeWindow);
      
      // Search for related changes
      const allChangeKeys = await this.taskManager.keys('changes:*');
      
      for (const changeKey of allChangeKeys) {
        const changeIds = await this.taskManager.lrange(changeKey, 0, -1);
        
        for (const candidateId of changeIds) {
          if (candidateId === changeId) continue;
          
          const candidate = await this.getChangeRecord(candidateId);
          if (!candidate) continue;
          
          const candidateTime = new Date(candidate.timestamp);
          if (candidateTime < startTime || candidateTime > endTime) continue;
          
          // Check for relationship
          const relationship = this.analyzeRelationship(change, candidate);
          if (relationship.score > 0.3) {
            relatedChanges.push({
              changeId: candidateId,
              change: candidate,
              relationship
            });
          }
        }
      }
      
      // Sort by relationship strength
      relatedChanges.sort((a, b) => b.relationship.score - a.relationship.score);
      
      return relatedChanges.slice(0, options.limit || 10);
      
    } catch (error) {
      logger.error('Failed to find related changes:', error);
      throw error;
    }
  }

  /**
   * Start automatic diff processing
   */
  startDiffProcessing() {
    this.processingInterval = setInterval(async () => {
      if (this.diffQueue.length > 0) {
        const batch = this.diffQueue.splice(0, this.config.batchSize);
        await this.processDiffBatch(batch);
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Process a batch of diffs for analysis
   */
  async processDiffBatch(diffs) {
    try {
      for (const diff of diffs) {
        // Analyze diff for patterns
        await this.analyzeDiffPatterns(diff);
        
        // Check for potential issues
        await this.checkDiffForIssues(diff);
        
        // Update entity metadata
        await this.updateEntityMetadata(diff);
      }
    } catch (error) {
      logger.error('Failed to process diff batch:', error);
    }
  }

  // Helper methods
  async getPreviousState(entityType, entityId) {
    try {
      const stateKey = `state:${entityType}:${entityId}`;
      const state = await this.taskManager.getData(stateKey);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      return null;
    }
  }

  async updateCurrentState(entityType, entityId, state) {
    const stateKey = `state:${entityType}:${entityId}`;
    await this.taskManager.setData(stateKey, JSON.stringify(state));
  }

  async storeChangeRecord(changeRecord) {
    const changeKey = `change:${changeRecord.id}`;
    await this.taskManager.setData(changeKey, JSON.stringify(changeRecord));
    
    // Add to entity's change list
    const entityChangeKey = `changes:${changeRecord.entityType}:${changeRecord.entityId}`;
    await this.taskManager.lpush(entityChangeKey, changeRecord.id);
    
    // Trim to max history
    await this.taskManager.ltrim(entityChangeKey, 0, this.config.maxDiffHistory - 1);
  }

  async getChangeRecord(changeId) {
    try {
      const changeKey = `change:${changeId}`;
      const data = await this.taskManager.getData(changeKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  calculateSize(diff) {
    return Buffer.byteLength(JSON.stringify(diff), 'utf8');
  }

  calculateComplexity(diff) {
    let complexity = 0;
    
    complexity += Object.keys(diff.added || {}).length;
    complexity += Object.keys(diff.removed || {}).length;
    complexity += Object.keys(diff.modified || {}).length;
    
    if (complexity === 0) return 'none';
    if (complexity <= 5) return 'low';
    if (complexity <= 15) return 'medium';
    return 'high';
  }

  calculateImpact(diff, entityType) {
    // Simple impact calculation - can be enhanced
    const changeCount = Object.keys(diff.added || {}).length + 
                       Object.keys(diff.removed || {}).length + 
                       Object.keys(diff.modified || {}).length;
    
    if (changeCount === 0) return 'none';
    if (changeCount <= 3) return 'low';
    if (changeCount <= 10) return 'medium';
    return 'high';
  }

  setNestedPath(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  isEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  async getChangesAfter(entityType, entityId, timestamp) {
    const history = await this.getChangeHistory(entityType, entityId, { limit: 1000 });
    return history.changes.filter(change => 
      new Date(change.timestamp) > new Date(timestamp)
    );
  }

  async calculateRollbackState(targetChange, changesAfter) {
    // Start with the target change state
    let state = { ...targetChange.changes };
    
    // Reverse each subsequent change
    for (const change of changesAfter.reverse()) {
      state = this.reverseChange(state, change.diff);
    }
    
    return state;
  }

  reverseChange(state, diff) {
    // Remove added items
    for (const path of Object.keys(diff.added || {})) {
      this.deleteNestedPath(state, path);
    }
    
    // Restore removed items
    for (const [path, value] of Object.entries(diff.removed || {})) {
      this.setNestedPath(state, path, value);
    }
    
    // Restore modified items
    for (const [path, change] of Object.entries(diff.modified || {})) {
      this.setNestedPath(state, path, change.from);
    }
    
    return state;
  }

  deleteNestedPath(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) return;
      current = current[key];
    }
    
    delete current[keys[keys.length - 1]];
  }

  buildSummaryPrompt(entityType, entityId, changes) {
    return `Analyze the following changes to ${entityType} "${entityId}" and provide a concise summary:

Changes (${changes.length} total):
${changes.slice(0, 10).map((change, index) => 
  `${index + 1}. [${change.timestamp}] ${change.context.operation} by ${change.context.user}
     Impact: ${change.metadata.impact}, Complexity: ${change.metadata.complexity}
     Changes: ${JSON.stringify(change.diff).substring(0, 200)}...`
).join('\n')}

Provide:
1. Overall summary of changes
2. Impact assessment (low/medium/high)
3. Key patterns or trends
4. Potential concerns or risks

Format as JSON with fields: summary, impact, patterns, concerns`;
  }

  parseSummaryResponse(content) {
    try {
      return JSON.parse(content);
    } catch (error) {
      return {
        summary: content,
        impact: 'unknown',
        patterns: [],
        concerns: []
      };
    }
  }

  async storeSummary(entityType, entityId, summary) {
    const summaryKey = `change_summary:${entityType}:${entityId}`;
    const summaryData = {
      ...summary,
      generatedAt: new Date().toISOString()
    };
    await this.taskManager.setData(summaryKey, JSON.stringify(summaryData));
  }

  async getStateAtTime(entityType, entityId, timestamp) {
    const history = await this.getChangeHistory(entityType, entityId, { limit: 1000 });
    
    // Find the latest change before or at the timestamp
    const relevantChanges = history.changes.filter(change => 
      new Date(change.timestamp) <= new Date(timestamp)
    );
    
    if (relevantChanges.length === 0) {
      return null;
    }
    
    // Reconstruct state by applying changes in order
    let state = {};
    for (const change of relevantChanges.reverse()) {
      state = { ...state, ...change.changes };
    }
    
    return state;
  }

  async getChangeCountBetween(entityType, entityId, startTime, endTime) {
    const history = await this.getChangeHistory(entityType, entityId, { limit: 1000 });
    return history.changes.filter(change => {
      const changeTime = new Date(change.timestamp);
      return changeTime >= new Date(startTime) && changeTime <= new Date(endTime);
    }).length;
  }

  analyzeRelationship(change1, change2) {
    let score = 0;
    const reasons = [];
    
    // Same user
    if (change1.context.user === change2.context.user) {
      score += 0.2;
      reasons.push('same_user');
    }
    
    // Same session
    if (change1.context.sessionId === change2.context.sessionId) {
      score += 0.3;
      reasons.push('same_session');
    }
    
    // Same agent
    if (change1.context.agent === change2.context.agent) {
      score += 0.2;
      reasons.push('same_agent');
    }
    
    // Related entity types
    if (this.areRelatedEntityTypes(change1.entityType, change2.entityType)) {
      score += 0.3;
      reasons.push('related_entities');
    }
    
    return { score, reasons };
  }

  areRelatedEntityTypes(type1, type2) {
    const relationships = {
      'project': ['task', 'agent'],
      'task': ['project', 'agent'],
      'agent': ['project', 'task']
    };
    
    return relationships[type1]?.includes(type2) || false;
  }

  async analyzeDiffPatterns(diff) {
    // Placeholder for pattern analysis
    // Could analyze common change patterns, detect anomalies, etc.
  }

  async checkDiffForIssues(diff) {
    // Placeholder for issue detection
    // Could check for data loss, security issues, etc.
  }

  async updateEntityMetadata(diff) {
    // Placeholder for metadata updates
    // Could update change frequency, volatility scores, etc.
  }

  async loadDiffMetadata() {
    // Placeholder for loading existing diff metadata
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.diffQueue.length = 0;
  }
}