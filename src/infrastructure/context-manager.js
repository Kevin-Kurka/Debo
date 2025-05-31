import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

/**
 * ContextManager
 * 
 * PURPOSE:
 * Dynamically manages LLM context windows and memory to optimize performance.
 * Keeps all state in Redis and provides LLMs with only task-relevant information.
 * 
 * RESPONSIBILITIES:
 * - Context window optimization based on model capabilities
 * - Intelligent information filtering and prioritization
 * - Memory state management in Redis
 * - Context compression and summarization
 * 
 * TODO:
 * - None
 */
export class ContextManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
    
    // Model capabilities database
    this.modelCapabilities = {
      'qwen2.5:7b': {
        contextWindow: 32768,
        tokensPerSecond: 50,
        type: 'fast',
        temperature: 0.0
      },
      'qwen2.5:14b': {
        contextWindow: 32768,
        tokensPerSecond: 25,
        type: 'thinking',
        temperature: 0.0
      },
      'deepseek-r1:1.5b': {
        contextWindow: 4096,
        tokensPerSecond: 100,
        type: 'fast',
        temperature: 0.0
      },
      'devstral:latest': {
        contextWindow: 32768,
        tokensPerSecond: 30,
        type: 'fast',
        temperature: 0.0
      }
    };
  }

  async buildTaskContext(agentId, task, model) {
    await this.taskManager.ensureConnection();
    
    const contextId = uuidv4();
    const modelCaps = this.modelCapabilities[model] || this.modelCapabilities['qwen2.5:7b'];
    
    // Calculate available context space (reserve 1000 tokens for response)
    const maxContextTokens = modelCaps.contextWindow - 1000;
    
    // Build context in priority order
    const context = {
      id: contextId,
      agentId,
      taskId: task.id,
      model,
      maxTokens: maxContextTokens,
      sections: []
    };
    
    // 1. Essential task information (highest priority)
    await this.addTaskInformation(context, task);
    
    // 2. Project context (filtered)
    await this.addProjectContext(context, task.projectId);
    
    // 3. Agent expertise and examples
    await this.addAgentExpertise(context, agentId, task.requiredRole);
    
    // 4. Dependencies and documentation (RAG)
    await this.addRelevantDocumentation(context, task);
    
    // 5. Previous similar tasks (if space)
    await this.addSimilarTaskExamples(context, task);
    
    // 6. Code patterns and templates
    await this.addCodePatterns(context, task);
    
    // Finalize and optimize context
    await this.optimizeContext(context);
    
    // Store context for debugging/analysis
    await this.storeContext(context);
    
    return this.formatContextForLLM(context);
  }

  async addTaskInformation(context, task) {
    const taskInfo = {
      priority: 100,
      section: 'task_definition',
      content: `TASK: ${task.title}

DESCRIPTION:
${task.description}

DELIVERABLES:
${JSON.stringify(task.deliverables, null, 2)}

ACCEPTANCE CRITERIA:
${JSON.stringify(task.acceptanceCriteria, null, 2)}

ESTIMATED TIME: ${task.estimatedTime} minutes
PRIORITY: ${task.priority}`,
      tokens: this.estimateTokens(task.title + task.description)
    };
    
    context.sections.push(taskInfo);
  }

  async addProjectContext(context, projectId) {
    // Get essential project information
    const project = await this.redis.hGetAll(`project:${projectId}`);
    const features = await this.getProjectFeatures(projectId);
    const architecture = await this.getProjectArchitecture(projectId);
    
    const projectInfo = {
      priority: 90,
      section: 'project_context',
      content: `PROJECT: ${project.name}

DESCRIPTION:
${project.description}

TECH STACK:
${architecture?.techStack || 'Not specified'}

CURRENT FEATURES:
${features.map(f => `- ${f.name}: ${f.status}`).join('\n')}

PROJECT STRUCTURE:
${JSON.stringify(project.structure, null, 2)}`,
      tokens: this.estimateTokens(project.name + project.description)
    };
    
    context.sections.push(projectInfo);
  }

  async addAgentExpertise(context, agentId, role) {
    // Get agent-specific expertise and examples
    const expertise = await this.getAgentExpertise(role);
    
    const expertiseInfo = {
      priority: 80,
      section: 'agent_expertise',
      content: `ROLE: ${role}

EXPERTISE:
${expertise.skills.join(', ')}

BEST PRACTICES:
${expertise.bestPractices.map(p => `- ${p}`).join('\n')}

CODE STYLE:
${expertise.codeStyle}

QUALITY STANDARDS:
${expertise.qualityStandards.map(s => `- ${s}`).join('\n')}`,
      tokens: this.estimateTokens(expertise.skills.join(' '))
    };
    
    context.sections.push(expertiseInfo);
  }

  async addRelevantDocumentation(context, task) {
    // Query RAG system for relevant documentation
    const ragResults = await this.taskManager.documentation.queryDocumentation(
      task.description,
      {
        projectId: task.projectId,
        type: task.type,
        maxResults: 3
      }
    );
    
    if (ragResults.results.length > 0) {
      const docInfo = {
        priority: 70,
        section: 'relevant_documentation',
        content: `RELEVANT DOCUMENTATION:

${ragResults.results.map(result => `
${result.title}:
${result.content.map(c => c.content).join('\n')}
`).join('\n')}`,
        tokens: this.estimateTokens(ragResults.summary)
      };
      
      context.sections.push(docInfo);
    }
  }

  async addSimilarTaskExamples(context, task) {
    // Find similar completed tasks
    const similarTasks = await this.findSimilarTasks(task);
    
    if (similarTasks.length > 0) {
      const examplesInfo = {
        priority: 60,
        section: 'similar_examples',
        content: `SIMILAR TASK EXAMPLES:

${similarTasks.slice(0, 2).map(t => `
Task: ${t.title}
Solution approach: ${t.approach}
Key considerations: ${t.considerations}
`).join('\n')}`,
        tokens: this.estimateTokens(similarTasks[0]?.title || '')
      };
      
      context.sections.push(examplesInfo);
    }
  }

  async addCodePatterns(context, task) {
    // Add relevant code patterns and templates
    const patterns = await this.getCodePatterns(task.type, task.requiredRole);
    
    if (patterns.length > 0) {
      const patternsInfo = {
        priority: 50,
        section: 'code_patterns',
        content: `RELEVANT CODE PATTERNS:

${patterns.map(pattern => `
Pattern: ${pattern.name}
Use case: ${pattern.useCase}
Template:
\`\`\`${pattern.language}
${pattern.template}
\`\`\`
`).join('\n')}`,
        tokens: this.estimateTokens(patterns.map(p => p.template).join(' '))
      };
      
      context.sections.push(patternsInfo);
    }
  }

  async optimizeContext(context) {
    // Sort sections by priority
    context.sections.sort((a, b) => b.priority - a.priority);
    
    // Calculate total tokens
    let totalTokens = 0;
    const finalSections = [];
    
    for (const section of context.sections) {
      if (totalTokens + section.tokens <= context.maxTokens) {
        finalSections.push(section);
        totalTokens += section.tokens;
      } else {
        // Try to compress or summarize the section
        const compressed = await this.compressSection(section, context.maxTokens - totalTokens);
        if (compressed) {
          finalSections.push(compressed);
          totalTokens += compressed.tokens;
        }
        break; // Stop adding sections once we're near the limit
      }
    }
    
    context.sections = finalSections;
    context.totalTokens = totalTokens;
    context.efficiency = totalTokens / context.maxTokens;
  }

  async compressSection(section, availableTokens) {
    if (availableTokens < 100) return null; // Not worth compressing
    
    // Summarize the content to fit in available space
    const maxLength = Math.floor(availableTokens * 3.5); // Rough tokens to chars ratio
    const compressed = section.content.substring(0, maxLength);
    
    return {
      ...section,
      content: compressed + '... [truncated]',
      tokens: availableTokens - 10,
      compressed: true
    };
  }

  formatContextForLLM(context) {
    const sections = context.sections.map(section => section.content);
    
    return {
      systemPrompt: this.buildSystemPrompt(context),
      userPrompt: sections.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'),
      metadata: {
        contextId: context.id,
        totalTokens: context.totalTokens,
        efficiency: context.efficiency,
        sections: context.sections.length
      }
    };
  }

  buildSystemPrompt(context) {
    const model = this.modelCapabilities[context.model];
    
    return `You are a ${context.sections.find(s => s.section === 'agent_expertise')?.content.match(/ROLE: (.+)/)?.[1] || 'developer'} working on a software development task.

PERFORMANCE REQUIREMENTS:
- Temperature: ${model.temperature} (NO hallucination - be precise and accurate)
- Context window: ${model.contextWindow} tokens (optimized usage)
- Response type: Production-ready code with mandatory documentation

MANDATORY RESPONSE FORMAT:
1. CONFIDENCE SCORE: X% (your confidence in this solution)
2. REASONING: Brief explanation of your approach
3. IMPLEMENTATION: Complete, documented code
4. TESTING: Suggested test cases
5. CONSIDERATIONS: Potential issues or improvements

QUALITY STANDARDS:
- All code must include comprehensive comments
- Add TODO items for future improvements
- Follow established project patterns
- Ensure error handling and validation
- Write production-ready, maintainable code

If your confidence is below 80%, explain why and suggest alternatives or request clarification.`;
  }

  // Helper Methods
  estimateTokens(text) {
    // Rough estimation: 1 token ≈ 3.5 characters for English
    return Math.ceil(text.length / 3.5);
  }

  async getProjectFeatures(projectId) {
    const featureIds = await this.redis.sMembers(`project:${projectId}:features`);
    const features = [];
    
    for (const featureId of featureIds) {
      const feature = await this.redis.hGetAll(`feature:${featureId}`);
      if (feature) features.push(feature);
    }
    
    return features;
  }

  async getProjectArchitecture(projectId) {
    const architecture = await this.redis.hGetAll(`architecture:${projectId}`);
    return architecture || {};
  }

  async getAgentExpertise(role) {
    const expertise = {
      backend_developer: {
        skills: ['Node.js', 'Express', 'Database Design', 'API Development', 'Authentication'],
        bestPractices: [
          'Use async/await for asynchronous operations',
          'Implement proper error handling and logging',
          'Follow RESTful API design principles',
          'Use input validation and sanitization',
          'Implement proper security measures'
        ],
        codeStyle: 'Clean, modular code with comprehensive comments',
        qualityStandards: [
          'Unit test coverage > 80%',
          'All functions documented',
          'Error handling for all async operations',
          'Input validation for all endpoints'
        ]
      },
      frontend_developer: {
        skills: ['React', 'CSS', 'JavaScript', 'Responsive Design', 'State Management'],
        bestPractices: [
          'Use functional components with hooks',
          'Implement proper state management',
          'Follow accessibility guidelines',
          'Optimize for performance',
          'Use semantic HTML'
        ],
        codeStyle: 'Component-based architecture with clear separation of concerns',
        qualityStandards: [
          'Components are reusable and well-documented',
          'Accessibility compliance (WCAG)',
          'Cross-browser compatibility',
          'Mobile responsiveness'
        ]
      },
      qa_engineer: {
        skills: ['Test Automation', 'Jest', 'Cypress', 'API Testing', 'Performance Testing'],
        bestPractices: [
          'Write comprehensive test cases',
          'Use test-driven development approach',
          'Implement both unit and integration tests',
          'Ensure edge case coverage',
          'Automate regression testing'
        ],
        codeStyle: 'Clear, descriptive test names and comprehensive assertions',
        qualityStandards: [
          'Test coverage > 90%',
          'All user flows tested',
          'Performance benchmarks met',
          'Security vulnerabilities tested'
        ]
      }
    };
    
    return expertise[role] || expertise.backend_developer;
  }

  async findSimilarTasks(task) {
    // Search for similar tasks using keywords and task type
    const keywords = this.extractKeywords(task.description);
    const similarTasks = [];
    
    const taskKeys = await this.redis.keys('task:*');
    for (const key of taskKeys.slice(0, 20)) { // Limit search for performance
      const existingTask = await this.redis.hGetAll(key);
      if (existingTask.status === 'completed' && existingTask.type === task.type) {
        const similarity = this.calculateSimilarity(task.description, existingTask.description);
        if (similarity > 0.6) {
          similarTasks.push({
            ...existingTask,
            similarity
          });
        }
      }
    }
    
    return similarTasks.sort((a, b) => b.similarity - a.similarity);
  }

  extractKeywords(text) {
    const words = text.toLowerCase().match(/\w+/g) || [];
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with']);
    return words.filter(word => word.length > 3 && !stopWords.has(word));
  }

  calculateSimilarity(text1, text2) {
    const keywords1 = new Set(this.extractKeywords(text1));
    const keywords2 = new Set(this.extractKeywords(text2));
    
    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    const union = new Set([...keywords1, ...keywords2]);
    
    return intersection.size / union.size;
  }

  async getCodePatterns(taskType, role) {
    const patterns = {
      backend_development: {
        api_endpoint: {
          name: 'Express API Endpoint',
          useCase: 'RESTful API development',
          language: 'javascript',
          template: `/**
 * {description}
 * @route {method} {path}
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response data
 */
app.{method}('{path}', async (req, res) => {
  try {
    // Input validation
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    // Business logic
    const result = await service.{operation}(value);
    
    // Response
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error in {operation}:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});`
        }
      },
      frontend_development: {
        react_component: {
          name: 'React Functional Component',
          useCase: 'UI component development',
          language: 'javascript',
          template: `/**
 * {ComponentName} Component
 * 
 * PURPOSE:
 * {purpose}
 * 
 * @param {Object} props - Component properties
 * @returns {JSX.Element} Rendered component
 */
import React, { useState, useEffect } from 'react';

const {ComponentName} = ({ ...props }) => {
  const [state, setState] = useState(initialState);
  
  useEffect(() => {
    // Side effects
  }, []);
  
  const handleAction = () => {
    // Event handling
  };
  
  return (
    <div className="component-name">
      {/* Component JSX */}
    </div>
  );
};

export default {ComponentName};`
        }
      }
    };
    
    return Object.values(patterns[taskType] || {});
  }

  async storeContext(context) {
    await this.redis.hSet(`context:${context.id}`, {
      ...context,
      sections: JSON.stringify(context.sections),
      createdAt: new Date().toISOString()
    });
    
    // Store context analytics
    await this.redis.hSet(`context_analytics:${context.agentId}`, {
      lastContextId: context.id,
      totalTokens: context.totalTokens,
      efficiency: context.efficiency,
      updatedAt: new Date().toISOString()
    });
  }

  async clearAgentMemory(agentId) {
    // Clear any cached context for the agent
    const contextKeys = await this.redis.keys(`context:*`);
    for (const key of contextKeys) {
      const context = await this.redis.hGetAll(key);
      if (context.agentId === agentId) {
        await this.redis.del(key);
      }
    }
    
    logger.info(`Cleared memory for agent: ${agentId}`);
  }

  async getContextAnalytics(agentId) {
    const analytics = await this.redis.hGetAll(`context_analytics:${agentId}`);
    return {
      averageTokenUsage: analytics.totalTokens || 0,
      efficiency: analytics.efficiency || 0,
      lastUpdate: analytics.updatedAt
    };
  }
}