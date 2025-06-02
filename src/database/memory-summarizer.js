import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class MemorySummarizer {
  constructor(taskManager, llmProvider) {
    this.taskManager = taskManager;
    this.llmProvider = llmProvider;
    this.config = {
      maxMemorySize: 100 * 1024 * 1024, // 100MB
      maxItemAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      compressionThreshold: 10 * 1024 * 1024, // 10MB
      summaryInterval: 6 * 60 * 60 * 1000, // 6 hours
      priorityDecayRate: 0.95, // Daily decay
      topicSimilarityThreshold: 0.8
    };
    this.compressionTimer = null;
    this.topicClusters = new Map();
    this.summaryCache = new Map();
  }

  async init() {
    // Load existing summaries and topic clusters
    await this.loadExistingSummaries();
    await this.loadTopicClusters();
    
    // Start automatic compression cycle
    this.startCompressionCycle();
    
    logger.info('Memory Summarizer initialized');
  }

  /**
   * Start automatic memory compression cycle
   */
  startCompressionCycle() {
    this.compressionTimer = setInterval(async () => {
      try {
        await this.performAutomaticCompression();
      } catch (error) {
        logger.error('Automatic compression failed:', error);
      }
    }, this.config.summaryInterval);
  }

  /**
   * Perform automatic memory compression
   */
  async performAutomaticCompression() {
    logger.info('Starting automatic memory compression...');
    
    const stats = await this.analyzeMemoryUsage();
    
    if (stats.totalSize > this.config.compressionThreshold) {
      await this.compressOldData();
    }
    
    await this.consolidateRedundantData();
    await this.updateTopicClusters();
    await this.decayPriorities();
    
    logger.info('Memory compression completed', { 
      beforeSize: stats.totalSize,
      afterSize: await this.calculateTotalSize()
    });
  }

  /**
   * Analyze current memory usage patterns
   */
  async analyzeMemoryUsage() {
    const keys = await this.taskManager.keys('*');
    let totalSize = 0;
    const keyStats = new Map();
    const ageStats = new Map();
    
    for (const key of keys) {
      try {
        const data = await this.taskManager.getData(key);
        const size = Buffer.byteLength(data || '', 'utf8');
        totalSize += size;
        
        const keyType = this.categorizeKey(key);
        keyStats.set(keyType, (keyStats.get(keyType) || 0) + size);
        
        // Get data age
        const ttl = await this.taskManager.ttl(key);
        const age = ttl > 0 ? 'temporary' : 'permanent';
        ageStats.set(age, (ageStats.get(age) || 0) + size);
        
      } catch (error) {
        logger.warn(`Failed to analyze key ${key}:`, error);
      }
    }
    
    return {
      totalSize,
      keyStats: Object.fromEntries(keyStats),
      ageStats: Object.fromEntries(ageStats),
      keyCount: keys.length
    };
  }

  /**
   * Compress old data by topic
   */
  async compressOldData() {
    const cutoffDate = new Date(Date.now() - this.config.maxItemAge);
    const candidateKeys = await this.findCompressionCandidates(cutoffDate);
    
    // Group candidates by topic
    const topicGroups = await this.groupByTopic(candidateKeys);
    
    // Compress each topic group
    for (const [topic, keys] of topicGroups.entries()) {
      if (keys.length > 1) {
        await this.compressTopicGroup(topic, keys);
      }
    }
  }

  /**
   * Find keys that are candidates for compression
   */
  async findCompressionCandidates(cutoffDate) {
    const keys = await this.taskManager.keys('*');
    const candidates = [];
    
    for (const key of keys) {
      // Skip already compressed data
      if (key.startsWith('summary:') || key.startsWith('compressed:')) {
        continue;
      }
      
      try {
        const metadata = await this.getKeyMetadata(key);
        if (metadata.created && new Date(metadata.created) < cutoffDate) {
          candidates.push({ key, metadata });
        }
      } catch (error) {
        // If we can't get metadata, consider it old
        candidates.push({ key, metadata: {} });
      }
    }
    
    return candidates;
  }

  /**
   * Group keys by topic similarity
   */
  async groupByTopic(candidates) {
    const topicGroups = new Map();
    
    for (const candidate of candidates) {
      const topic = await this.extractTopic(candidate.key, candidate.metadata);
      
      if (!topicGroups.has(topic)) {
        topicGroups.set(topic, []);
      }
      topicGroups.get(topic).push(candidate.key);
    }
    
    return topicGroups;
  }

  /**
   * Compress a group of related data by topic
   */
  async compressTopicGroup(topic, keys) {
    try {
      // Collect all data for the topic
      const dataItems = [];
      for (const key of keys) {
        const data = await this.taskManager.getData(key);
        if (data) {
          dataItems.push({
            key,
            data: typeof data === 'string' ? data : JSON.stringify(data),
            timestamp: await this.getKeyTimestamp(key)
          });
        }
      }
      
      if (dataItems.length === 0) return;
      
      // Generate topic summary using LLM
      const summary = await this.generateTopicSummary(topic, dataItems);
      
      // Store compressed summary
      const summaryKey = `summary:${topic}:${Date.now()}`;
      await this.taskManager.setData(summaryKey, JSON.stringify({
        topic,
        summary,
        originalKeys: keys,
        compressedAt: new Date().toISOString(),
        itemCount: dataItems.length,
        originalSize: dataItems.reduce((sum, item) => sum + item.data.length, 0)
      }));
      
      // Remove original keys
      for (const key of keys) {
        await this.taskManager.del(key);
      }
      
      logger.info(`Compressed topic group: ${topic}`, {
        itemCount: dataItems.length,
        originalKeys: keys.length
      });
      
    } catch (error) {
      logger.error(`Failed to compress topic group ${topic}:`, error);
    }
  }

  /**
   * Generate summary for a topic group using LLM
   */
  async generateTopicSummary(topic, dataItems) {
    const prompt = `You are a data summarization expert. Analyze the following data items related to "${topic}" and create a comprehensive but concise summary.

Focus on:
1. Key patterns and trends
2. Important decisions and outcomes
3. Critical events and milestones
4. Relationships between items
5. Performance metrics and results

Data items (${dataItems.length} total):
${dataItems.map((item, index) => 
  `${index + 1}. [${item.timestamp}] ${item.key}\n${item.data.substring(0, 500)}${item.data.length > 500 ? '...' : ''}`
).join('\n\n')}

Provide a structured summary that preserves the most important information while reducing data size by at least 70%.`;

    try {
      const response = await this.llmProvider.generateResponse(prompt, {
        model: 'fast', // Use fast model for summarization
        maxTokens: 1000,
        temperature: 0.3
      });
      
      return response.content || 'Summary generation failed';
    } catch (error) {
      logger.error('LLM summarization failed:', error);
      return this.createFallbackSummary(topic, dataItems);
    }
  }

  /**
   * Create fallback summary without LLM
   */
  createFallbackSummary(topic, dataItems) {
    const summary = {
      topic,
      itemCount: dataItems.length,
      timeRange: {
        start: Math.min(...dataItems.map(item => new Date(item.timestamp).getTime())),
        end: Math.max(...dataItems.map(item => new Date(item.timestamp).getTime()))
      },
      keyPatterns: this.extractKeyPatterns(dataItems.map(item => item.key)),
      dataTypes: this.analyzeDataTypes(dataItems),
      sizeSummary: {
        totalChars: dataItems.reduce((sum, item) => sum + item.data.length, 0),
        avgSize: Math.round(dataItems.reduce((sum, item) => sum + item.data.length, 0) / dataItems.length)
      }
    };
    
    return `Automated summary for ${topic}:\n${JSON.stringify(summary, null, 2)}`;
  }

  /**
   * Consolidate redundant data
   */
  async consolidateRedundantData() {
    const keys = await this.taskManager.keys('*');
    const duplicateGroups = await this.findDuplicateData(keys);
    
    for (const group of duplicateGroups) {
      if (group.length > 1) {
        await this.mergeDuplicateData(group);
      }
    }
  }

  /**
   * Find duplicate or very similar data
   */
  async findDuplicateData(keys) {
    const dataMap = new Map();
    const duplicateGroups = [];
    
    for (const key of keys) {
      try {
        const data = await this.taskManager.getData(key);
        if (!data) continue;
        
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        const hash = this.generateContentHash(dataStr);
        
        if (!dataMap.has(hash)) {
          dataMap.set(hash, []);
        }
        dataMap.get(hash).push({ key, data: dataStr });
        
      } catch (error) {
        logger.warn(`Failed to check duplicate for key ${key}:`, error);
      }
    }
    
    // Find groups with multiple items
    for (const group of dataMap.values()) {
      if (group.length > 1) {
        duplicateGroups.push(group);
      }
    }
    
    return duplicateGroups;
  }

  /**
   * Merge duplicate data items
   */
  async mergeDuplicateData(duplicates) {
    // Keep the most recent item
    const sortedDuplicates = duplicates.sort((a, b) => {
      const timeA = this.extractTimestampFromKey(a.key);
      const timeB = this.extractTimestampFromKey(b.key);
      return timeB - timeA;
    });
    
    const keeper = sortedDuplicates[0];
    const toRemove = sortedDuplicates.slice(1);
    
    // Create consolidated entry
    const consolidatedKey = `consolidated:${keeper.key}`;
    const consolidatedData = {
      data: keeper.data,
      duplicateKeys: toRemove.map(item => item.key),
      consolidatedAt: new Date().toISOString(),
      originalKey: keeper.key
    };
    
    await this.taskManager.setData(consolidatedKey, JSON.stringify(consolidatedData));
    
    // Remove duplicates
    for (const item of toRemove) {
      await this.taskManager.del(item.key);
    }
    
    // Replace original with reference
    await this.taskManager.setData(keeper.key, `__CONSOLIDATED_REF__:${consolidatedKey}`);
    
    logger.info(`Consolidated ${duplicates.length} duplicate items for ${keeper.key}`);
  }

  /**
   * Update topic clusters for better organization
   */
  async updateTopicClusters() {
    const keys = await this.taskManager.keys('*');
    const newClusters = new Map();
    
    for (const key of keys) {
      const topic = await this.extractTopic(key);
      if (!newClusters.has(topic)) {
        newClusters.set(topic, []);
      }
      newClusters.get(topic).push(key);
    }
    
    // Update clusters with significant changes
    for (const [topic, keys] of newClusters.entries()) {
      const existingCluster = this.topicClusters.get(topic);
      if (!existingCluster || this.hasSignificantChange(existingCluster, keys)) {
        this.topicClusters.set(topic, {
          keys,
          lastUpdated: new Date().toISOString(),
          size: keys.length
        });
      }
    }
    
    // Persist updated clusters
    await this.saveTopicClusters();
  }

  /**
   * Decay priority scores over time
   */
  async decayPriorities() {
    const priorityKeys = await this.taskManager.keys('priority:*');
    
    for (const key of priorityKeys) {
      try {
        const priority = parseFloat(await this.taskManager.getData(key));
        const newPriority = priority * this.config.priorityDecayRate;
        
        if (newPriority < 0.1) {
          // Remove very low priority items
          await this.taskManager.del(key);
          const dataKey = key.replace('priority:', '');
          await this.taskManager.del(dataKey);
        } else {
          await this.taskManager.setData(key, newPriority.toString());
        }
      } catch (error) {
        logger.warn(`Failed to decay priority for ${key}:`, error);
      }
    }
  }

  /**
   * Retrieve summarized data by topic
   */
  async getSummaryByTopic(topic) {
    const summaryKey = `summary:${topic}:*`;
    const summaryKeys = await this.taskManager.keys(summaryKey);
    
    if (summaryKeys.length === 0) {
      return null;
    }
    
    // Get the most recent summary
    const latestKey = summaryKeys.sort().pop();
    const summaryData = await this.taskManager.getData(latestKey);
    
    return summaryData ? JSON.parse(summaryData) : null;
  }

  /**
   * Search through summarized data
   */
  async searchSummaries(query, options = {}) {
    const summaryKeys = await this.taskManager.keys('summary:*');
    const results = [];
    
    for (const key of summaryKeys) {
      try {
        const summaryData = JSON.parse(await this.taskManager.getData(key));
        
        if (this.matchesQuery(summaryData, query)) {
          results.push({
            key,
            topic: summaryData.topic,
            summary: summaryData.summary,
            relevance: this.calculateRelevance(summaryData, query),
            compressedAt: summaryData.compressedAt,
            itemCount: summaryData.itemCount
          });
        }
      } catch (error) {
        logger.warn(`Failed to search summary ${key}:`, error);
      }
    }
    
    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    
    return options.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Get memory usage statistics
   */
  async getMemoryStats() {
    const stats = await this.analyzeMemoryUsage();
    const summaryKeys = await this.taskManager.keys('summary:*');
    const consolidatedKeys = await this.taskManager.keys('consolidated:*');
    
    return {
      ...stats,
      compressionStats: {
        summaries: summaryKeys.length,
        consolidated: consolidatedKeys.length,
        lastCompression: await this.taskManager.getData('last_compression_time')
      },
      topicClusters: this.topicClusters.size,
      memoryEfficiency: this.calculateMemoryEfficiency(stats)
    };
  }

  // Helper methods
  categorizeKey(key) {
    if (key.startsWith('project:')) return 'projects';
    if (key.startsWith('task:')) return 'tasks';
    if (key.startsWith('agent:')) return 'agents';
    if (key.startsWith('summary:')) return 'summaries';
    if (key.startsWith('consolidated:')) return 'consolidated';
    return 'other';
  }

  async getKeyMetadata(key) {
    try {
      const data = await this.taskManager.getData(key);
      if (typeof data === 'string' && data.startsWith('{')) {
        const parsed = JSON.parse(data);
        return {
          created: parsed.created || parsed.timestamp || parsed.createdAt,
          type: parsed.type,
          size: Buffer.byteLength(data, 'utf8')
        };
      }
    } catch (error) {
      // Ignore parsing errors
    }
    
    return {
      size: Buffer.byteLength(data || '', 'utf8')
    };
  }

  async extractTopic(key, metadata = {}) {
    // Extract topic from key structure
    const parts = key.split(':');
    if (parts.length > 1) {
      return parts[0];
    }
    
    // Extract from metadata
    if (metadata.type) {
      return metadata.type;
    }
    
    return 'general';
  }

  async getKeyTimestamp(key) {
    const metadata = await this.getKeyMetadata(key);
    return metadata.created || new Date().toISOString();
  }

  generateContentHash(content) {
    // Simple hash function for content deduplication
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  extractTimestampFromKey(key) {
    const timestampMatch = key.match(/(\d{13})/); // 13-digit timestamp
    return timestampMatch ? parseInt(timestampMatch[1]) : Date.now();
  }

  extractKeyPatterns(keys) {
    const patterns = new Map();
    keys.forEach(key => {
      const pattern = key.replace(/\d+/g, 'N').replace(/[a-f0-9-]{32,}/g, 'ID');
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });
    return Object.fromEntries(patterns);
  }

  analyzeDataTypes(dataItems) {
    const types = new Map();
    dataItems.forEach(item => {
      try {
        JSON.parse(item.data);
        types.set('json', (types.get('json') || 0) + 1);
      } catch {
        types.set('text', (types.get('text') || 0) + 1);
      }
    });
    return Object.fromEntries(types);
  }

  hasSignificantChange(existingCluster, newKeys) {
    if (!existingCluster) return true;
    
    const sizeDiff = Math.abs(existingCluster.keys.length - newKeys.length);
    const sizeChangePercent = sizeDiff / existingCluster.keys.length;
    
    return sizeChangePercent > 0.2; // 20% change threshold
  }

  matchesQuery(summaryData, query) {
    const searchText = `${summaryData.topic} ${summaryData.summary}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }

  calculateRelevance(summaryData, query) {
    const text = `${summaryData.topic} ${summaryData.summary}`.toLowerCase();
    const queryLower = query.toLowerCase();
    
    let relevance = 0;
    if (summaryData.topic.toLowerCase().includes(queryLower)) relevance += 2;
    if (text.includes(queryLower)) relevance += 1;
    
    // Boost newer summaries
    const age = Date.now() - new Date(summaryData.compressedAt).getTime();
    const ageFactor = Math.max(0, 1 - (age / this.config.maxItemAge));
    
    return relevance * (1 + ageFactor);
  }

  calculateMemoryEfficiency(stats) {
    const compressionRatio = stats.keyStats.summaries || 0;
    const totalUsage = stats.totalSize;
    const efficiency = compressionRatio / totalUsage;
    
    return Math.min(1, efficiency * 100); // Percentage
  }

  async calculateTotalSize() {
    const stats = await this.analyzeMemoryUsage();
    return stats.totalSize;
  }

  async loadExistingSummaries() {
    try {
      const summaryKeys = await this.taskManager.keys('summary:*');
      for (const key of summaryKeys) {
        const data = await this.taskManager.getData(key);
        if (data) {
          const summary = JSON.parse(data);
          this.summaryCache.set(key, summary);
        }
      }
    } catch (error) {
      logger.error('Failed to load existing summaries:', error);
    }
  }

  async loadTopicClusters() {
    try {
      const clustersData = await this.taskManager.getData('topic_clusters');
      if (clustersData) {
        const clusters = JSON.parse(clustersData);
        this.topicClusters = new Map(Object.entries(clusters));
      }
    } catch (error) {
      logger.error('Failed to load topic clusters:', error);
    }
  }

  async saveTopicClusters() {
    try {
      const clustersObj = Object.fromEntries(this.topicClusters);
      await this.taskManager.setData('topic_clusters', JSON.stringify(clustersObj));
    } catch (error) {
      logger.error('Failed to save topic clusters:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.compressionTimer) {
      clearInterval(this.compressionTimer);
      this.compressionTimer = null;
    }
    
    this.topicClusters.clear();
    this.summaryCache.clear();
  }
}