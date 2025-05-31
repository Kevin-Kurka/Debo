import { agentConfig } from './roles.js';
import logger from '../logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';
import FileSystemManager from '../tools/file-system-manager.js';
import DevOpsAutomation from './devops-automation.js';

const execAsync = promisify(exec);

export class AgentExecutor {
  constructor(llmProvider, toolManager) {
    this.llmProvider = llmProvider;
    this.toolManager = toolManager;
    this.projectPaths = new Map();
    this.fileSystemManager = new FileSystemManager();
    this.devOpsAutomation = new DevOpsAutomation(this.fileSystemManager);
  }

  async init() {
    await this.fileSystemManager.init();
    logger.info('Agent Executor initialized');
  }

  async executeTask(agentType, action, data) {
    logger.info(`Executing ${agentType} task: ${action}`);
    
    try {
      // Get LLM response for the task
      const llmResponse = await this.llmProvider.generateResponse(
        this.buildTaskPrompt(action, data),
        agentType,
        data
      );

      // Execute agent-specific logic
      const actionResults = await this.executeAgentAction(agentType, action, data, llmResponse);

      // Store deliverables in database
      await this.storeDeliverables(agentType, action, data, actionResults);

      return {
        action,
        agentType,
        llmResponse: llmResponse.content,
        actionResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Task execution failed for ${agentType}:${action}`, error);
      throw error;
    }
  }

  buildTaskPrompt(action, data) {
    const prompts = {
      analyze_project_requirements: `Analyze the following project requirements and create a strategic plan:
        
        Project: ${data.projectName}
        Requirements: ${data.requirements}
        Technology Stack: ${data.stack}
        
        Provide a comprehensive analysis including:
        - Technical feasibility assessment
        - Resource requirements
        - Risk analysis
        - Recommended architecture approach
        - Team structure and responsibilities`,

      design_system_architecture: `Design the system architecture for this project:
        
        Project ID: ${data.projectId}
        Requirements: Based on CTO analysis (${data.ctoTaskId})
        
        Create:
        - High-level system architecture
        - Database schema design
        - API structure
        - Technology stack recommendations
        - Deployment architecture`,

      implement_backend_logic: `Implement backend logic for this feature:
        
        Project ID: ${data.projectId}
        Feature: ${data.featureRequest || 'Based on requirements'}
        
        Generate:
        - API endpoints
        - Database models
        - Business logic
        - Error handling
        - Unit tests`,

      implement_frontend_components: `Implement frontend components:
        
        Project ID: ${data.projectId}
        Feature: ${data.featureRequest || 'Based on requirements'}
        
        Create:
        - React/Vue components
        - State management
        - API integration
        - Responsive design
        - Component tests`,

      create_feature_tests: `Create comprehensive tests:
        
        Project ID: ${data.projectId}
        Feature: ${data.featureRequest || 'Based on requirements'}
        
        Generate:
        - Unit tests
        - Integration tests
        - E2E test scenarios
        - Test data setup
        - Validation criteria`,

      deploy_application: `Deploy the application:
        
        Project ID: ${data.projectId}
        Environment: ${data.deploymentConfig}
        
        Execute:
        - Build optimization
        - Environment setup
        - Deployment pipeline
        - Health checks
        - Monitoring setup`,

      scan_code_changes: `Perform security scan:
        
        Project ID: ${data.projectId}
        Code Changes: ${JSON.stringify(data.codeChanges)}
        
        Analyze:
        - Vulnerability assessment
        - Security best practices
        - Dependency security
        - Code injection risks
        - Compliance checks`
    };

    return prompts[action] || `Execute ${action} for project ${data.projectId}`;
  }

  async executeAgentAction(agentType, action, data, llmResponse) {
    const projectPath = await this.ensureProjectPath(data.projectId, data.projectName);
    
    switch (agentType) {
      case 'cto':
        return await this.executeCTOAction(action, data, llmResponse, projectPath);
      case 'solution_architect':
        return await this.executeArchitectAction(action, data, llmResponse, projectPath);
      case 'backend_dev':
        return await this.executeBackendAction(action, data, llmResponse, projectPath);
      case 'frontend_dev':
        return await this.executeFrontendAction(action, data, llmResponse, projectPath);
      case 'qa_engineer':
        return await this.executeQAAction(action, data, llmResponse, projectPath);
      case 'devops':
        return await this.executeDevOpsAction(action, data, llmResponse, projectPath);
      case 'security':
        return await this.executeSecurityAction(action, data, llmResponse, projectPath);
      default:
        return await this.executeGenericAction(action, data, llmResponse, projectPath);
    }
  }

  async ensureProjectPath(projectId, projectName) {
    if (this.projectPaths.has(projectId)) {
      return this.projectPaths.get(projectId);
    }

    const projectPath = await this.fileSystemManager.ensureProjectDirectory(projectId, projectName);
    this.projectPaths.set(projectId, projectPath);
    
    return projectPath;
  }

  async executeCTOAction(action, data, llmResponse, projectPath) {
    switch (action) {
      case 'analyze_project_requirements':
        return await this.createProjectPlan(data, llmResponse, projectPath);
      case 'analyze_feature_request':
        return await this.createFeaturePlan(data, llmResponse, projectPath);
      default:
        return { analysis: llmResponse.content };
    }
  }

  async createProjectPlan(data, llmResponse, projectPath) {
    // Auto-detect stack if not specified or is 'auto-detect'
    let stack = data.stack;
    if (!stack || stack === 'auto-detect') {
      stack = await this.fileSystemManager.templateManager.detectBestTemplate(data.requirements);
      logger.info(`Auto-detected stack: ${stack}`);
    }
    
    const planContent = `# Project Plan: ${data.projectName}

## Requirements Analysis
${data.requirements}

## Technology Stack
${stack}

## CTO Strategic Analysis
${llmResponse.content}

## Generated: ${new Date().toISOString()}
`;

    const planFile = await this.fileSystemManager.writeFile(projectPath, 'project-plan.md', planContent);
    
    // Initialize project structure using templates
    await this.initializeProjectStructure(projectPath, stack);
    
    // Analyze the created project
    const projectAnalysis = await this.fileSystemManager.analyzeProject(projectPath);
    
    return {
      planFile,
      projectStructure: 'initialized',
      projectAnalysis,
      templateUsed: stack,
      recommendations: this.extractRecommendations(llmResponse.content)
    };
  }

  async initializeProjectStructure(projectPath, stack) {
    switch (stack) {
      case 'next.js':
        await this.createNextJSStructure(projectPath);
        break;
      case 'vue':
        await this.createVueStructure(projectPath);
        break;
      case 'node':
        await this.createNodeStructure(projectPath);
        break;
      default:
        await this.createGenericStructure(projectPath);
    }
  }

  async createNextJSStructure(projectPath) {
    const structure = {
      'package.json': JSON.stringify({
        name: path.basename(projectPath),
        version: '1.0.0',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          test: 'jest'
        },
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        }
      }, null, 2),
      'next.config.js': 'module.exports = { reactStrictMode: true }',
      'pages/index.js': `export default function Home() {
  return <div>Welcome to ${path.basename(projectPath)}</div>
}`,
      'pages/api/health.js': `export default function handler(req, res) {
  res.status(200).json({ status: 'healthy' })
}`,
      'README.md': `# ${path.basename(projectPath)}\n\nNext.js application`
    };

    for (const [file, content] of Object.entries(structure)) {
      const filePath = path.join(projectPath, file);
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content);
    }
  }

  async executeBackendAction(action, data, llmResponse, projectPath) {
    switch (action) {
      case 'implement_backend_logic':
        return await this.generateBackendCode(data, llmResponse, projectPath);
      case 'setup_project_structure':
        return await this.setupBackendStructure(data, llmResponse, projectPath);
      default:
        return { code: llmResponse.content };
    }
  }

  async generateBackendCode(data, llmResponse, projectPath) {
    // Extract files from LLM response
    const files = this.fileSystemManager.extractCodeFromLLMResponse(llmResponse);
    const generatedFiles = [];

    // If no files extracted with new method, try legacy code blocks
    if (Object.keys(files).length === 0) {
      const codeBlocks = this.extractCodeBlocks(llmResponse.content);
      
      for (const block of codeBlocks) {
        if (block.language === 'javascript' || block.language === 'js') {
          const fileName = this.generateFileName(block.code, 'js');
          files[`api/${fileName}`] = block.code;
        }
      }
    }

    // Write all files
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = await this.fileSystemManager.writeFile(projectPath, relativePath, content);
      generatedFiles.push(fullPath);
    }

    return {
      apiEndpoints: generatedFiles,
      filesCreated: generatedFiles.length,
      files: Object.keys(files)
    };
  }

  async setupBackendStructure(data, llmResponse, projectPath) {
    // Extract any custom structure from LLM response
    const files = this.fileSystemManager.extractCodeFromLLMResponse(llmResponse);
    
    // If no specific files, create default backend structure
    if (Object.keys(files).length === 0) {
      const defaultStructure = {
        'src/routes/index.js': `const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

module.exports = router;`,
        'src/models/index.js': '// Database models',
        'src/controllers/index.js': '// Business logic controllers',
        'src/middleware/auth.js': `module.exports = (req, res, next) => {
  // Authentication middleware
  next();
};`,
        'src/utils/logger.js': `module.exports = {
  info: console.log,
  error: console.error,
  warn: console.warn
};`,
        'tests/api.test.js': `describe('API Tests', () => {
  test('Health check', () => {
    expect(true).toBe(true);
  });
});`
      };
      
      await this.fileSystemManager.writeFiles(projectPath, defaultStructure);
      return {
        structure: 'default',
        filesCreated: Object.keys(defaultStructure).length
      };
    }
    
    // Write custom structure
    const generatedFiles = [];
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = await this.fileSystemManager.writeFile(projectPath, relativePath, content);
      generatedFiles.push(fullPath);
    }
    
    return {
      structure: 'custom',
      filesCreated: generatedFiles.length,
      files: generatedFiles
    };
  }

  extractCodeBlocks(content) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    return blocks;
  }

  generateFileName(code, extension) {
    // Simple heuristic to generate meaningful file names
    const lines = code.split('\n');
    for (const line of lines) {
      if (line.includes('function ') || line.includes('const ') || line.includes('class ')) {
        const nameMatch = line.match(/(?:function|const|class)\s+(\w+)/);
        if (nameMatch) {
          return `${nameMatch[1]}.${extension}`;
        }
      }
    }
    return `generated-${Date.now()}.${extension}`;
  }

  async storeDeliverables(agentType, action, data, results) {
    const config = agentConfig[agentType];
    if (!config || !config.deliverables) return;

    const { database: dbDeliverables, code: codeDeliverables } = config.deliverables;

    // Store database deliverables
    if (dbDeliverables) {
      for (const deliverable of dbDeliverables) {
        await this.toolManager.taskManager.redis.hSet(
          `deliverable:${data.projectId}:${deliverable}`,
          {
            agentType,
            action,
            content: JSON.stringify(results),
            timestamp: new Date().toISOString()
          }
        );
      }
    }

    // Log code deliverables
    if (codeDeliverables && results.filesCreated) {
      await this.toolManager.taskManager.redis.hSet(
        `code_deliverables:${data.projectId}`,
        {
          agentType,
          action,
          filesCreated: results.filesCreated,
          timestamp: new Date().toISOString()
        }
      );
    }
  }

  extractRecommendations(content) {
    const lines = content.split('\n');
    const recommendations = [];
    
    for (const line of lines) {
      if (line.toLowerCase().includes('recommend') || 
          line.toLowerCase().includes('suggest') ||
          line.includes('•') || line.includes('-')) {
        recommendations.push(line.trim());
      }
    }
    
    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  async executeArchitectAction(action, data, llmResponse, projectPath) {
    switch (action) {
      case 'design_system_architecture':
        return await this.generateArchitectureDesign(data, llmResponse, projectPath);
      default:
        return await this.executeGenericAction(action, data, llmResponse, projectPath);
    }
  }

  async generateArchitectureDesign(data, llmResponse, projectPath) {
    const files = this.fileSystemManager.extractCodeFromLLMResponse(llmResponse);
    const generatedFiles = [];

    // Ensure we have architecture docs
    if (Object.keys(files).length === 0) {
      files['docs/architecture.md'] = llmResponse.content;
    }

    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = await this.fileSystemManager.writeFile(projectPath, relativePath, content);
      generatedFiles.push(fullPath);
    }

    return {
      designDocs: generatedFiles,
      filesCreated: generatedFiles.length
    };
  }

  async executeFrontendAction(action, data, llmResponse, projectPath) {
    switch (action) {
      case 'implement_frontend_components':
        return await this.generateFrontendCode(data, llmResponse, projectPath);
      default:
        return await this.executeGenericAction(action, data, llmResponse, projectPath);
    }
  }

  async generateFrontendCode(data, llmResponse, projectPath) {
    const files = this.fileSystemManager.extractCodeFromLLMResponse(llmResponse);
    const generatedFiles = [];

    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = await this.fileSystemManager.writeFile(projectPath, relativePath, content);
      generatedFiles.push(fullPath);
    }

    return {
      components: generatedFiles,
      filesCreated: generatedFiles.length,
      files: Object.keys(files)
    };
  }

  async executeQAAction(action, data, llmResponse, projectPath) {
    switch (action) {
      case 'create_feature_tests':
        return await this.generateTests(data, llmResponse, projectPath);
      default:
        return await this.executeGenericAction(action, data, llmResponse, projectPath);
    }
  }

  async generateTests(data, llmResponse, projectPath) {
    const files = this.fileSystemManager.extractCodeFromLLMResponse(llmResponse);
    const generatedFiles = [];

    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = await this.fileSystemManager.writeFile(projectPath, relativePath, content);
      generatedFiles.push(fullPath);
    }

    return {
      testFiles: generatedFiles,
      filesCreated: generatedFiles.length
    };
  }

  async executeDevOpsAction(action, data, llmResponse, projectPath) {
    switch (action) {
      case 'deploy_application':
        return await this.deployApplication(data, llmResponse, projectPath);
      default:
        return await this.executeGenericAction(action, data, llmResponse, projectPath);
    }
  }

  async deployApplication(data, llmResponse, projectPath) {
    // Extract deployment configuration from LLM response
    const deploymentConfig = this.extractDeploymentConfig(llmResponse.content);
    const environment = data.deploymentConfig || deploymentConfig.environment || 'production';
    const provider = deploymentConfig.provider || data.provider || 'auto';

    // Use DevOps automation for deployment
    const deploymentResult = await this.devOpsAutomation.deployProject(
      projectPath,
      environment,
      { provider, ...deploymentConfig }
    );

    // Generate deployment report
    await this.devOpsAutomation.generateDeploymentReport(
      projectPath,
      [deploymentResult]
    );

    // Extract any additional files from LLM response
    const files = this.fileSystemManager.extractCodeFromLLMResponse(llmResponse);
    const generatedFiles = [];
    
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = await this.fileSystemManager.writeFile(projectPath, relativePath, content);
      generatedFiles.push(fullPath);
    }

    return {
      deploymentResult,
      configFiles: generatedFiles,
      filesCreated: generatedFiles.length,
      deploymentUrl: deploymentResult.url,
      provider: deploymentResult.provider,
      status: deploymentResult.status
    };
  }

  extractDeploymentConfig(content) {
    const config = {
      environment: 'production',
      provider: null
    };

    // Look for environment mentions
    if (content.toLowerCase().includes('staging')) {
      config.environment = 'staging';
    } else if (content.toLowerCase().includes('development')) {
      config.environment = 'development';
    }

    // Look for provider mentions
    const providers = ['vercel', 'netlify', 'heroku', 'aws', 'docker'];
    for (const provider of providers) {
      if (content.toLowerCase().includes(provider)) {
        config.provider = provider;
        break;
      }
    }

    // Extract any JSON configuration
    try {
      const jsonMatch = content.match(/{[^}]+"deploy[^}]+}/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        Object.assign(config, parsed);
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }

    return config;
  }

  extractDeploymentCommands(content) {
    const commands = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('npm ') || 
          line.trim().startsWith('docker ') ||
          line.trim().startsWith('kubectl ')) {
        commands.push(line.trim());
      }
    }
    
    return commands;
  }

  async executeSecurityAction(action, data, llmResponse, projectPath) {
    switch (action) {
      case 'scan_code_changes':
        return await this.performSecurityScan(data, llmResponse, projectPath);
      default:
        return await this.executeGenericAction(action, data, llmResponse, projectPath);
    }
  }

  async performSecurityScan(data, llmResponse, projectPath) {
    return {
      vulnerabilities: this.extractVulnerabilities(llmResponse.content),
      recommendations: this.extractRecommendations(llmResponse.content),
      scanReport: llmResponse.content
    };
  }

  extractVulnerabilities(content) {
    const vulnerabilities = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes('vulnerability') || 
          line.toLowerCase().includes('security') ||
          line.toLowerCase().includes('risk')) {
        vulnerabilities.push(line.trim());
      }
    }
    
    return vulnerabilities;
  }

  async executeGenericAction(action, data, llmResponse, projectPath) {
    // Try to extract and write any files from the response
    const files = this.fileSystemManager.extractCodeFromLLMResponse(llmResponse);
    const generatedFiles = [];

    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = await this.fileSystemManager.writeFile(projectPath, relativePath, content);
      generatedFiles.push(fullPath);
    }

    return {
      action,
      response: llmResponse.content,
      projectPath,
      filesCreated: generatedFiles.length,
      files: generatedFiles,
      timestamp: new Date().toISOString()
    };
  }

  async createVueStructure(projectPath) {
    const structure = {
      'package.json': JSON.stringify({
        name: path.basename(projectPath),
        version: '1.0.0',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview'
        },
        dependencies: {
          vue: '^3.3.0'
        },
        devDependencies: {
          '@vitejs/plugin-vue': '^4.0.0',
          vite: '^4.0.0'
        }
      }, null, 2),
      'vite.config.js': `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()]
})`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${path.basename(projectPath)}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`,
      'src/main.js': `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')`,
      'src/App.vue': `<template>
  <div>
    <h1>Welcome to ${path.basename(projectPath)}</h1>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>`,
      'README.md': `# ${path.basename(projectPath)}\n\nVue.js application`
    };

    await this.fileSystemManager.writeFiles(projectPath, structure);
  }

  async createNodeStructure(projectPath) {
    const structure = {
      'package.json': JSON.stringify({
        name: path.basename(projectPath),
        version: '1.0.0',
        main: 'index.js',
        scripts: {
          start: 'node index.js',
          dev: 'nodemon index.js',
          test: 'jest'
        },
        dependencies: {
          express: '^4.18.0'
        },
        devDependencies: {
          nodemon: '^3.0.0',
          jest: '^29.0.0'
        }
      }, null, 2),
      'index.js': `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ${path.basename(projectPath)}' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
      'README.md': `# ${path.basename(projectPath)}\n\nNode.js Express application`,
      '.gitignore': 'node_modules\n.env\ndist\n.DS_Store'
    };

    await this.fileSystemManager.writeFiles(projectPath, structure);
  }

  async createGenericStructure(projectPath) {
    const structure = {
      'README.md': `# ${path.basename(projectPath)}\n\nProject description`,
      '.gitignore': 'node_modules\n.env\ndist\n.DS_Store',
      'src/index.js': '// Main entry point\n',
      'package.json': JSON.stringify({
        name: path.basename(projectPath),
        version: '1.0.0',
        main: 'src/index.js',
        scripts: {
          start: 'node src/index.js',
          test: 'echo "Error: no test specified" && exit 1'
        }
      }, null, 2)
    };

    await this.fileSystemManager.writeFiles(projectPath, structure);
  }
}