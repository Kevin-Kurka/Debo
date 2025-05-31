/**
 * Model Evolution System for Debo
 * Automatically discovers, evaluates, and upgrades AI models based on performance and ratings
 */

const axios = require('axios');
const { execSync } = require('child_process');
const logger = require('../logger.js');

class ModelEvolution {
  constructor(llmProvider) {
    this.llmProvider = llmProvider;
    this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.currentModels = {
      thinking: 'qwen2.5:14b',
      fast: 'qwen2.5:7b',
      vision: 'qwen2.5-vl:32b',
      reasoning: 'deepseek-r1:1.5b'
    };
    this.modelDatabase = new Map();
    this.performanceHistory = new Map();
    this.evaluationQueue = [];
  }

  async init() {
    await this.loadCurrentModels();
    await this.initializeModelDatabase();
    
    // Start periodic model discovery
    this.startPeriodicDiscovery();
    
    logger.info('Model Evolution system initialized');
  }

  async loadCurrentModels() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`);
      const installedModels = response.data.models || [];
      
      // Update current models list
      for (const model of installedModels) {
        this.modelDatabase.set(model.name, {
          name: model.name,
          size: model.size,
          installed: true,
          performance: await this.getModelPerformance(model.name),
          lastUsed: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to load current models:', error);
    }
  }

  async initializeModelDatabase() {
    // Initialize with known high-performance models
    const knownModels = [
      {
        name: 'qwen2.5:72b',
        type: 'thinking',
        description: 'Large reasoning model for complex tasks',
        minRam: '48GB',
        performance: { reasoning: 95, speed: 60, efficiency: 70 }
      },
      {
        name: 'llama3.3:70b',
        type: 'thinking', 
        description: 'Meta\'s latest large language model',
        minRam: '40GB',
        performance: { reasoning: 92, speed: 65, efficiency: 75 }
      },
      {
        name: 'deepseek-r1:7b',
        type: 'reasoning',
        description: 'Optimized reasoning model',
        minRam: '8GB',
        performance: { reasoning: 88, speed: 85, efficiency: 90 }
      },
      {
        name: 'qwen2.5-coder:32b',
        type: 'coding',
        description: 'Specialized coding model',
        minRam: '20GB',
        performance: { coding: 94, speed: 75, efficiency: 80 }
      },
      {
        name: 'mistral-nemo:12b',
        type: 'fast',
        description: 'Fast general-purpose model',
        minRam: '8GB',
        performance: { speed: 95, reasoning: 80, efficiency: 88 }
      }
    ];

    knownModels.forEach(model => {
      this.modelDatabase.set(model.name, {
        ...model,
        installed: false,
        discoveredAt: new Date().toISOString()
      });
    });
  }

  async checkForUpgrades() {
    logger.info('Checking for model upgrades...');
    
    const upgrades = [];
    
    // Check each current model for better alternatives
    for (const [role, currentModel] of Object.entries(this.currentModels)) {
      const alternatives = await this.findBetterModels(currentModel, role);
      
      if (alternatives.length > 0) {
        const best = alternatives[0];
        const confidence = await this.calculateUpgradeConfidence(currentModel, best.name);
        
        if (confidence > 0.8) {
          upgrades.push({
            role,
            current: currentModel,
            new: best.name,
            confidence,
            improvements: best.improvements
          });
        }
      }
    }

    // Discover new models from Ollama library
    const newModels = await this.discoverNewModels();
    
    // Evaluate promising new models
    for (const newModel of newModels) {
      if (await this.shouldEvaluateModel(newModel)) {
        this.evaluationQueue.push(newModel);
      }
    }

    return upgrades;
  }

  async discoverNewModels() {
    try {
      // Use web search to find trending models
      const trendingModels = await this.searchTrendingModels();
      
      // Check Ollama library for new models
      const ollamaModels = await this.fetchOllamaLibrary();
      
      // Combine and deduplicate
      const allModels = [...trendingModels, ...ollamaModels];
      const uniqueModels = this.deduplicateModels(allModels);
      
      // Filter for new models not in our database
      return uniqueModels.filter(model => !this.modelDatabase.has(model.name));
      
    } catch (error) {
      logger.error('Failed to discover new models:', error);
      return [];
    }
  }

  async searchTrendingModels() {
    // Use RAG to search for model performance data
    const searchQueries = [
      'best open source LLM models 2024',
      'fastest inference AI models',
      'highest performing coding models',
      'ollama model benchmarks',
      'hugging face leaderboard top models'
    ];

    const models = [];
    
    for (const query of searchQueries) {
      try {
        const results = await this.performWebSearch(query);
        const extractedModels = await this.extractModelInfo(results);
        models.push(...extractedModels);
      } catch (error) {
        logger.error(`Search failed for query: ${query}`, error);
      }
    }

    return models;
  }

  async performWebSearch(query) {
    // This would integrate with a web search API or RAG system
    // For now, return mock data
    return {
      results: [
        {
          title: 'Best AI Models 2024',
          content: 'Qwen2.5:72B shows excellent reasoning capabilities...',
          url: 'https://example.com/models'
        }
      ]
    };
  }

  async extractModelInfo(searchResults) {
    const extractionPrompt = `
Extract AI model information from these search results:
${JSON.stringify(searchResults, null, 2)}

Look for:
- Model names and versions
- Performance benchmarks
- Specialized capabilities (coding, reasoning, vision)
- Memory requirements
- Speed comparisons

Return JSON array of models with format:
[{
  "name": "model-name:version",
  "type": "thinking|fast|coding|vision|reasoning",
  "performance": {"metric": score},
  "requirements": "memory/compute needs",
  "source": "where found"
}]`;

    try {
      const response = await this.llmProvider.generateResponse(extractionPrompt, 'fast');
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to extract model info:', error);
      return [];
    }
  }

  async fetchOllamaLibrary() {
    try {
      // In a real implementation, this would fetch from Ollama's API
      // For now, return a curated list of new models to check
      return [
        {
          name: 'qwen2.5:72b-instruct',
          type: 'thinking',
          size: '40GB',
          description: 'Latest Qwen model with improved reasoning'
        },
        {
          name: 'deepseek-coder-v2:33b',
          type: 'coding',
          size: '19GB',
          description: 'Advanced coding model with better code generation'
        }
      ];
    } catch (error) {
      logger.error('Failed to fetch Ollama library:', error);
      return [];
    }
  }

  async findBetterModels(currentModel, role) {
    const alternatives = [];
    
    for (const [name, model] of this.modelDatabase) {
      if (model.type === role && name !== currentModel) {
        const comparison = await this.compareModels(currentModel, name);
        
        if (comparison.isBetter) {
          alternatives.push({
            name,
            ...model,
            improvements: comparison.improvements,
            score: comparison.score
          });
        }
      }
    }

    // Sort by score descending
    return alternatives.sort((a, b) => b.score - a.score);
  }

  async compareModels(current, candidate) {
    const currentPerf = this.getModelPerformance(current);
    const candidatePerf = this.getModelPerformance(candidate);
    
    if (!currentPerf || !candidatePerf) {
      return { isBetter: false, score: 0 };
    }

    const improvements = {};
    let totalImprovement = 0;
    let metrics = 0;

    for (const [metric, currentScore] of Object.entries(currentPerf)) {
      if (candidatePerf[metric]) {
        const improvement = candidatePerf[metric] - currentScore;
        if (improvement > 0) {
          improvements[metric] = improvement;
          totalImprovement += improvement;
        }
        metrics++;
      }
    }

    const averageImprovement = metrics > 0 ? totalImprovement / metrics : 0;
    const isBetter = averageImprovement > 5; // Require at least 5 point improvement

    return {
      isBetter,
      score: averageImprovement,
      improvements
    };
  }

  async calculateUpgradeConfidence(currentModel, newModel) {
    const factors = {
      performanceGain: 0,
      reliability: 0,
      compatibility: 0,
      resourceEfficiency: 0,
      userReports: 0
    };

    // Calculate performance gain confidence
    const comparison = await this.compareModels(currentModel, newModel);
    factors.performanceGain = Math.min(comparison.score / 20, 1); // Normalize to 0-1

    // Check reliability (based on model age and stability reports)
    const modelAge = await this.getModelAge(newModel);
    factors.reliability = modelAge > 30 ? 0.9 : 0.6; // Prefer models that have been around

    // Check compatibility
    factors.compatibility = await this.checkCompatibility(newModel);

    // Resource efficiency
    const resourceComparison = await this.compareResourceUsage(currentModel, newModel);
    factors.resourceEfficiency = resourceComparison;

    // User reports and benchmarks
    factors.userReports = await this.getUserReportsScore(newModel);

    // Weight the factors
    const weights = {
      performanceGain: 0.3,
      reliability: 0.25,
      compatibility: 0.2,
      resourceEfficiency: 0.15,
      userReports: 0.1
    };

    let confidence = 0;
    for (const [factor, value] of Object.entries(factors)) {
      confidence += value * weights[factor];
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  async performUpgrade(upgrade) {
    logger.info(`Upgrading ${upgrade.role} model from ${upgrade.current} to ${upgrade.new}`);

    try {
      // Download new model
      await this.downloadModel(upgrade.new);
      
      // Test new model
      const testResults = await this.testModel(upgrade.new, upgrade.role);
      
      if (testResults.success) {
        // Update configuration
        this.currentModels[upgrade.role] = upgrade.new;
        await this.updateLLMProviderConfig();
        
        // Record performance
        this.recordModelPerformance(upgrade.new, testResults.performance);
        
        // Remove old model if no longer needed
        await this.cleanupOldModel(upgrade.current);
        
        logger.info(`Successfully upgraded ${upgrade.role} model to ${upgrade.new}`);
        return { success: true };
      } else {
        logger.error(`Model test failed for ${upgrade.new}:`, testResults.error);
        return { success: false, error: testResults.error };
      }
    } catch (error) {
      logger.error(`Upgrade failed for ${upgrade.new}:`, error);
      return { success: false, error: error.message };
    }
  }

  async downloadModel(modelName) {
    const command = `ollama pull ${modelName}`;
    
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Downloading model: ${modelName}`);
        execSync(command, { stdio: 'inherit' });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async testModel(modelName, role) {
    const testPrompts = {
      thinking: [
        'Explain the concept of recursion in programming',
        'Analyze the pros and cons of different software architectures'
      ],
      fast: [
        'Write a simple function to reverse a string',
        'What is the capital of France?'
      ],
      coding: [
        'Write a React component for a todo list',
        'Implement a binary search algorithm in Python'
      ],
      reasoning: [
        'If all roses are flowers and some flowers fade quickly, what can we conclude?',
        'Solve this logic puzzle: A man lives on the 20th floor...'
      ]
    };

    try {
      const prompts = testPrompts[role] || testPrompts.fast;
      const results = [];

      for (const prompt of prompts) {
        const startTime = Date.now();
        const response = await this.llmProvider.generateResponseWithModel(prompt, modelName);
        const duration = Date.now() - startTime;

        const quality = await this.evaluateResponseQuality(prompt, response, role);
        
        results.push({
          prompt,
          duration,
          quality,
          responseLength: response.length
        });
      }

      const avgQuality = results.reduce((sum, r) => sum + r.quality, 0) / results.length;
      const avgSpeed = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      return {
        success: avgQuality > 70 && avgSpeed < 30000, // Quality > 70 and Speed < 30s
        performance: {
          quality: avgQuality,
          speed: avgSpeed,
          efficiency: (avgQuality / avgSpeed) * 1000
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async evaluateResponseQuality(prompt, response, role) {
    const evaluationPrompt = `
Rate the quality of this AI response on a scale of 0-100:

Prompt: ${prompt}
Response: ${response}
Model Role: ${role}

Consider:
- Accuracy and correctness
- Relevance to the prompt
- Clarity and coherence
- Completeness
- ${role === 'coding' ? 'Code correctness and best practices' : 'Logical reasoning'}

Return only a number 0-100:`;

    try {
      const rating = await this.llmProvider.generateResponse(evaluationPrompt, 'fast');
      const score = parseInt(rating.match(/\d+/)?.[0] || '0');
      return Math.min(Math.max(score, 0), 100);
    } catch (error) {
      return 50; // Default score if evaluation fails
    }
  }

  startPeriodicDiscovery() {
    // Run model discovery daily
    setInterval(async () => {
      try {
        await this.checkForUpgrades();
        await this.processEvaluationQueue();
      } catch (error) {
        logger.error('Periodic model discovery failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    logger.info('Started periodic model discovery');
  }

  async processEvaluationQueue() {
    if (this.evaluationQueue.length === 0) return;

    logger.info(`Processing ${this.evaluationQueue.length} models in evaluation queue`);

    const model = this.evaluationQueue.shift();
    
    try {
      // Download and test the model
      await this.downloadModel(model.name);
      const testResults = await this.testModel(model.name, model.type);
      
      // Add to database with performance data
      this.modelDatabase.set(model.name, {
        ...model,
        installed: true,
        performance: testResults.performance,
        evaluatedAt: new Date().toISOString()
      });

      logger.info(`Evaluated model ${model.name}: ${testResults.success ? 'passed' : 'failed'}`);
    } catch (error) {
      logger.error(`Failed to evaluate model ${model.name}:`, error);
    }
  }

  // Utility methods
  getModelPerformance(modelName) {
    const model = this.modelDatabase.get(modelName);
    return model?.performance || null;
  }

  async shouldEvaluateModel(model) {
    // Don't evaluate if already in database
    if (this.modelDatabase.has(model.name)) return false;
    
    // Don't evaluate models that are too large for system
    const systemRam = await this.getSystemRam();
    if (model.minRam && this.parseRamRequirement(model.minRam) > systemRam) {
      return false;
    }
    
    // Evaluate models that show promise
    return model.performance && Object.values(model.performance).some(score => score > 85);
  }

  deduplicateModels(models) {
    const seen = new Set();
    return models.filter(model => {
      if (seen.has(model.name)) return false;
      seen.add(model.name);
      return true;
    });
  }

  parseRamRequirement(ramString) {
    const match = ramString.match(/(\d+)(GB|MB)/i);
    if (!match) return 0;
    
    const amount = parseInt(match[1]);
    const unit = match[2].toUpperCase();
    
    return unit === 'GB' ? amount : amount / 1024;
  }

  async getSystemRam() {
    try {
      const output = execSync('free -m', { encoding: 'utf8' });
      const match = output.match(/Mem:\s+(\d+)/);
      return match ? parseInt(match[1]) / 1024 : 8; // Default to 8GB
    } catch {
      return 8; // Default to 8GB if can't determine
    }
  }

  recordModelPerformance(modelName, performance) {
    if (!this.performanceHistory.has(modelName)) {
      this.performanceHistory.set(modelName, []);
    }
    
    this.performanceHistory.get(modelName).push({
      ...performance,
      timestamp: new Date().toISOString()
    });
  }

  async updateLLMProviderConfig() {
    // Update the LLM provider with new model configuration
    await this.llmProvider.updateModelConfig(this.currentModels);
  }

  async cleanupOldModel(modelName) {
    try {
      // Only remove if not used by other roles
      const stillUsed = Object.values(this.currentModels).includes(modelName);
      if (!stillUsed) {
        execSync(`ollama rm ${modelName}`);
        logger.info(`Removed old model: ${modelName}`);
      }
    } catch (error) {
      logger.warn(`Failed to remove old model ${modelName}:`, error);
    }
  }

  // Mock methods for testing (replace with real implementations)
  async getModelAge(modelName) {
    return 60; // Default to 60 days
  }

  async checkCompatibility(modelName) {
    return 0.9; // Default high compatibility
  }

  async compareResourceUsage(current, candidate) {
    return 0.8; // Default good efficiency
  }

  async getUserReportsScore(modelName) {
    return 0.8; // Default good user reports
  }
}

module.exports = { ModelEvolution };