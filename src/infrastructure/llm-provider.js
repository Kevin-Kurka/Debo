import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../logger.js';

const execAsync = promisify(exec);

export class LLMProvider {
  constructor() {
    this.ollamaUrl = 'http://localhost:11434';
    this.models = {
      thinking: 'qwen2.5:14b',
      fast: 'qwen2.5:7b',
      vision: 'qwen2.5-vl:32b'
    };
    this.initialized = false;
  }

  async init() {
    try {
      await this.checkOllamaStatus();
      await this.ensureModelsAvailable();
      this.initialized = true;
      logger.info('LLM Provider initialized successfully');
    } catch (error) {
      logger.error('LLM Provider initialization failed:', error);
      throw error;
    }
  }

  async checkOllamaStatus() {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) {
        throw new Error('Ollama not running');
      }
      logger.info('Ollama service is running');
    } catch (error) {
      logger.error('Ollama not available, attempting to start...');
      await this.startOllama();
    }
  }

  async startOllama() {
    try {
      await execAsync('ollama serve &');
      // Wait for service to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.checkOllamaStatus();
    } catch (error) {
      throw new Error('Failed to start Ollama service');
    }
  }

  async ensureModelsAvailable() {
    for (const [type, model] of Object.entries(this.models)) {
      try {
        await this.pullModel(model);
        logger.info(`Model ${model} ready for ${type} tasks`);
      } catch (error) {
        logger.warn(`Failed to pull model ${model}:`, error.message);
      }
    }
  }

  async pullModel(modelName) {
    try {
      await execAsync(`ollama pull ${modelName}`);
    } catch (error) {
      // Model might already exist
      logger.info(`Model ${modelName} already available`);
    }
  }

  async generateResponse(prompt, agentType, context = {}) {
    if (!this.initialized) {
      await this.init();
    }

    const modelType = this.getModelTypeForAgent(agentType);
    const model = this.models[modelType];

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt: this.buildAgentPrompt(prompt, agentType, context),
          stream: false,
          options: {
            temperature: modelType === 'thinking' ? 0.3 : 0.7,
            top_p: 0.9,
            max_tokens: modelType === 'thinking' ? 2048 : 1024
          }
        })
      });

      if (!response.ok) {
        throw new Error(`LLM request failed: ${response.statusText}`);
      }

      const data = await response.json();
      logger.info(`LLM response generated for ${agentType} using ${model}`);
      
      return {
        content: data.response,
        model: model,
        agentType: agentType,
        tokensUsed: data.eval_count || 0
      };

    } catch (error) {
      logger.error(`LLM generation failed for ${agentType}:`, error);
      throw error;
    }
  }

  getModelTypeForAgent(agentType) {
    const thinkingAgents = ['cto', 'engineering_manager', 'product_manager', 'business_analyst', 'solution_architect', 'technical_writer'];
    const fastAgents = ['backend_dev', 'frontend_dev', 'qa_engineer', 'devops', 'security', 'ux_designer'];
    
    if (thinkingAgents.includes(agentType)) {
      return 'thinking';
    } else if (fastAgents.includes(agentType)) {
      return 'fast';
    }
    
    return 'fast'; // Default to fast model
  }

  buildAgentPrompt(basePrompt, agentType, context) {
    const agentInstructions = this.getAgentInstructions(agentType);
    const contextInfo = this.formatContext(context);
    
    return `ROLE: ${agentType.toUpperCase().replace('_', ' ')}

INSTRUCTIONS: ${agentInstructions}

CONTEXT:
${contextInfo}

TASK:
${basePrompt}

RESPONSE FORMAT:
Provide a structured response with:
1. Analysis/Understanding
2. Specific Actions Taken
3. Deliverables Created
4. Next Steps/Dependencies
5. Any Issues or Blockers

Response:`;
  }

  getAgentInstructions(agentType) {
    const instructions = {
      cto: 'Analyze strategic requirements, make architectural decisions, delegate tasks to appropriate teams. Focus on technical feasibility, business impact, and resource allocation.',
      engineering_manager: 'Coordinate development teams, manage sprints, allocate resources, track progress. Ensure delivery timelines and quality standards.',
      product_manager: 'Break down features into user stories, prioritize based on business value, define acceptance criteria, manage product roadmap.',
      business_analyst: 'Gather detailed requirements, define acceptance criteria, create process flows, ensure business needs are met.',
      solution_architect: 'Design scalable system architecture, define technical standards, plan integrations, create technical specifications.',
      backend_dev: 'Implement API endpoints, business logic, database operations. Write clean, testable code with proper error handling.',
      frontend_dev: 'Build responsive UI components, implement client logic, ensure accessibility and performance.',
      qa_engineer: 'Create comprehensive tests, execute test plans, report bugs with reproduction steps, maintain automation.',
      devops: 'Setup infrastructure, deploy applications, monitor performance, maintain CI/CD pipelines.',
      security: 'Scan for vulnerabilities, implement security measures, ensure compliance, review code for security issues.',
      technical_writer: 'Create clear documentation, API references, user guides, maintain documentation accuracy.'
    };
    
    return instructions[agentType] || 'Complete the assigned task with high quality and attention to detail.';
  }

  formatContext(context) {
    let formatted = '';
    
    if (context.projectId) {
      formatted += `Project ID: ${context.projectId}\n`;
    }
    if (context.projectName) {
      formatted += `Project Name: ${context.projectName}\n`;
    }
    if (context.requirements) {
      formatted += `Requirements: ${context.requirements}\n`;
    }
    if (context.stack) {
      formatted += `Technology Stack: ${context.stack}\n`;
    }
    if (context.dependencies) {
      formatted += `Dependencies: ${JSON.stringify(context.dependencies)}\n`;
    }
    
    return formatted || 'No specific context provided.';
  }

  async generateCodeCompletion(code, language, context = {}) {
    const prompt = `Complete this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Context: ${JSON.stringify(context)}

Provide only the completed code without explanations:`;

    const response = await this.generateResponse(prompt, 'backend_dev', context);
    return response.content;
  }

  async generateTests(code, language, testFramework = 'jest') {
    const prompt = `Generate comprehensive unit tests for this ${language} code using ${testFramework}:

\`\`\`${language}
${code}
\`\`\`

Include edge cases and error scenarios. Provide only the test code:`;

    const response = await this.generateResponse(prompt, 'qa_engineer', { language, testFramework });
    return response.content;
  }

  async generateDocumentation(code, language, type = 'api') {
    const prompt = `Generate ${type} documentation for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Format as markdown with clear examples:`;

    const response = await this.generateResponse(prompt, 'technical_writer', { language, type });
    return response.content;
  }
}