import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class CodeDocumentationManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
  }

  // Comment Templates
  getCommentTemplate(fileType, componentType) {
    const templates = {
      javascript: {
        file: `/**
 * @file {fileName}
 * @description {description}
 * @author {agentRole} Agent
 * @created {date}
 * @modified {date}
 * 
 * PURPOSE:
 * {purpose}
 * 
 * DEPENDENCIES:
 * {dependencies}
 * 
 * TODO:
 * {todos}
 */`,
        function: `/**
 * {functionName}
 * @description {description}
 * @param {paramType} {paramName} - {paramDescription}
 * @returns {returnType} {returnDescription}
 * @throws {errorType} {errorDescription}
 * 
 * TODO:
 * {todos}
 */`,
        class: `/**
 * {className}
 * @class
 * @description {description}
 * 
 * RESPONSIBILITIES:
 * {responsibilities}
 * 
 * COLLABORATORS:
 * {collaborators}
 * 
 * TODO:
 * {todos}
 */`
      },
      python: {
        file: `"""
{fileName}

DESCRIPTION:
{description}

AUTHOR: {agentRole} Agent
CREATED: {date}
MODIFIED: {date}

PURPOSE:
{purpose}

DEPENDENCIES:
{dependencies}

TODO:
{todos}
"""`,
        function: `"""
{functionName}

{description}

Args:
    {args}

Returns:
    {returns}

Raises:
    {raises}

TODO:
{todos}
"""`,
        class: `"""
{className}

{description}

Attributes:
    {attributes}

Methods:
    {methods}

TODO:
{todos}
"""`
      },
      react: {
        component: `/**
 * {componentName} Component
 * 
 * PURPOSE:
 * {purpose}
 * 
 * PROPS:
 * {props}
 * 
 * STATE:
 * {state}
 * 
 * HOOKS:
 * {hooks}
 * 
 * TODO:
 * {todos}
 * 
 * @component
 * @example
 * {example}
 */`
      }
    };

    return templates[fileType]?.[componentType] || templates.javascript.file;
  }

  // TODO Management
  async createTODO(projectId, todo) {
    await this.taskManager.ensureConnection();
    const todoId = uuidv4();
    
    const todoData = {
      id: todoId,
      projectId,
      taskId: todo.taskId || '',
      filePath: todo.filePath,
      lineNumber: todo.lineNumber || 0,
      type: todo.type || 'feature', // feature, bug, refactor, optimize, security
      priority: todo.priority || 'medium',
      description: todo.description,
      assignedTo: todo.assignedTo || 'unassigned',
      createdBy: todo.createdBy || 'system',
      createdAt: new Date().toISOString(),
      dueDate: todo.dueDate || null,
      status: 'pending',
      context: JSON.stringify(todo.context || {}),
      dependencies: JSON.stringify(todo.dependencies || [])
    };
    
    // Store TODO
    await this.redis.hSet(`todo:${todoId}`, todoData);
    
    // Index by project
    await this.redis.sAdd(`project:${projectId}:todos`, todoId);
    
    // Index by file
    await this.redis.sAdd(`file:${todo.filePath}:todos`, todoId);
    
    // Add to priority queue
    const score = this.calculateTODOPriority(todo.priority);
    await this.redis.zAdd(`todo_queue:${projectId}`, { score, value: todoId });
    
    logger.info(`Created TODO: ${todoId} in ${todo.filePath}`);
    return todoId;
  }

  // File Documentation Generation
  async generateFileDocumentation(file) {
    const documentation = {
      header: await this.generateFileHeader(file),
      imports: await this.documentImports(file.imports),
      functions: await this.documentFunctions(file.functions),
      classes: await this.documentClasses(file.classes),
      exports: await this.documentExports(file.exports),
      todos: await this.extractTODOs(file)
    };
    
    return this.formatDocumentation(documentation, file.type);
  }

  async generateFileHeader(file) {
    const template = this.getCommentTemplate(file.type, 'file');
    
    const header = template
      .replace('{fileName}', file.name)
      .replace('{description}', file.description || 'No description provided')
      .replace('{agentRole}', file.createdBy || 'Unknown')
      .replace(/{date}/g, new Date().toISOString().split('T')[0])
      .replace('{purpose}', file.purpose || 'TODO: Add purpose')
      .replace('{dependencies}', this.formatDependencies(file.dependencies))
      .replace('{todos}', this.formatTODOs(file.todos));
    
    return header;
  }

  async documentImports(imports) {
    if (!imports || imports.length === 0) return '';
    
    const documented = imports.map(imp => {
      return `// ${imp.name} - ${imp.purpose || 'TODO: Document import purpose'}`;
    });
    
    return documented.join('\n');
  }

  async documentFunctions(functions) {
    if (!functions || functions.length === 0) return [];
    
    const documented = [];
    
    for (const func of functions) {
      const template = this.getCommentTemplate(func.language || 'javascript', 'function');
      
      const doc = template
        .replace('{functionName}', func.name)
        .replace('{description}', func.description || 'TODO: Add function description')
        .replace('{paramType}', func.params?.[0]?.type || 'any')
        .replace('{paramName}', func.params?.[0]?.name || 'param')
        .replace('{paramDescription}', func.params?.[0]?.description || 'TODO: Document parameter')
        .replace('{returnType}', func.returnType || 'any')
        .replace('{returnDescription}', func.returnDescription || 'TODO: Document return value')
        .replace('{errorType}', func.throws?.[0]?.type || 'Error')
        .replace('{errorDescription}', func.throws?.[0]?.description || 'TODO: Document errors')
        .replace('{todos}', this.formatTODOs(func.todos));
      
      documented.push({
        name: func.name,
        documentation: doc,
        code: func.code
      });
    }
    
    return documented;
  }

  // TODO File Generation
  async generateTODOFile(projectId) {
    await this.taskManager.ensureConnection();
    
    const todos = await this.getProjectTODOs(projectId);
    const grouped = this.groupTODOsByFile(todos);
    
    let content = `# TODO List for Project ${projectId}
Generated: ${new Date().toISOString()}
Total TODOs: ${todos.length}

## Summary
- Critical: ${todos.filter(t => t.priority === 'critical').length}
- High: ${todos.filter(t => t.priority === 'high').length}
- Medium: ${todos.filter(t => t.priority === 'medium').length}
- Low: ${todos.filter(t => t.priority === 'low').length}

## TODOs by File
`;
    
    for (const [filePath, fileTodos] of Object.entries(grouped)) {
      content += `\n### ${filePath}\n`;
      
      for (const todo of fileTodos) {
        content += `- [ ] **[${todo.priority.toUpperCase()}]** Line ${todo.lineNumber}: ${todo.description}`;
        if (todo.assignedTo !== 'unassigned') {
          content += ` (Assigned to: ${todo.assignedTo})`;
        }
        if (todo.dueDate) {
          content += ` (Due: ${todo.dueDate})`;
        }
        content += '\n';
      }
    }
    
    return content;
  }

  // Code Comment Enforcement
  async enforceComments(code, fileType, requirements) {
    const missingComments = [];
    
    // Check file header
    if (!this.hasFileHeader(code)) {
      missingComments.push({
        type: 'file_header',
        line: 1,
        required: true,
        template: this.getCommentTemplate(fileType, 'file')
      });
    }
    
    // Check function comments
    const functions = this.extractFunctions(code, fileType);
    for (const func of functions) {
      if (!this.hasFunctionComment(func, code)) {
        missingComments.push({
          type: 'function',
          name: func.name,
          line: func.line,
          required: true,
          template: this.getCommentTemplate(fileType, 'function')
        });
      }
    }
    
    // Check class comments
    const classes = this.extractClasses(code, fileType);
    for (const cls of classes) {
      if (!this.hasClassComment(cls, code)) {
        missingComments.push({
          type: 'class',
          name: cls.name,
          line: cls.line,
          required: true,
          template: this.getCommentTemplate(fileType, 'class')
        });
      }
    }
    
    // Check for TODOs
    const todos = this.extractInlineTODOs(code);
    
    return {
      isValid: missingComments.length === 0,
      missingComments,
      todos,
      suggestions: this.generateCommentSuggestions(missingComments)
    };
  }

  // Inline TODO Extraction
  extractInlineTODOs(code) {
    const todoPattern = /(?:\/\/|#|\/\*)\s*TODO:?\s*(.+?)(?:\*\/|$)/gim;
    const todos = [];
    let match;
    
    const lines = code.split('\n');
    
    while ((match = todoPattern.exec(code)) !== null) {
      const lineNumber = code.substring(0, match.index).split('\n').length;
      
      todos.push({
        description: match[1].trim(),
        lineNumber,
        context: lines[lineNumber - 1].trim(),
        type: this.categorizeTODO(match[1])
      });
    }
    
    return todos;
  }

  categorizeTODO(description) {
    const keywords = {
      feature: ['implement', 'add', 'create', 'feature'],
      bug: ['fix', 'bug', 'issue', 'problem'],
      refactor: ['refactor', 'cleanup', 'reorganize', 'improve'],
      optimize: ['optimize', 'performance', 'speed', 'efficiency'],
      security: ['security', 'vulnerability', 'auth', 'permission']
    };
    
    const lowerDesc = description.toLowerCase();
    
    for (const [type, words] of Object.entries(keywords)) {
      if (words.some(word => lowerDesc.includes(word))) {
        return type;
      }
    }
    
    return 'feature';
  }

  // Progress Tracking via Comments
  async updateProgressComments(projectId, filePath, progress) {
    const progressComment = `/**
 * PROGRESS UPDATE: ${new Date().toISOString()}
 * 
 * COMPLETED:
 * ${progress.completed.map(item => `✓ ${item}`).join('\n * ')}
 * 
 * IN PROGRESS:
 * ${progress.inProgress.map(item => `⏳ ${item}`).join('\n * ')}
 * 
 * REMAINING:
 * ${progress.remaining.map(item => `○ ${item}`).join('\n * ')}
 * 
 * BLOCKERS:
 * ${progress.blockers.map(item => `⚠️ ${item}`).join('\n * ')}
 * 
 * NEXT STEPS:
 * ${progress.nextSteps.map(item => `→ ${item}`).join('\n * ')}
 */`;
    
    await this.redis.hSet(`progress:${projectId}:${filePath}`, {
      comment: progressComment,
      updatedAt: new Date().toISOString(),
      completed: JSON.stringify(progress.completed),
      inProgress: JSON.stringify(progress.inProgress),
      remaining: JSON.stringify(progress.remaining)
    });
    
    return progressComment;
  }

  // Documentation Quality Metrics
  async analyzeDocumentationQuality(projectId) {
    const files = await this.getProjectFiles(projectId);
    const metrics = {
      totalFiles: files.length,
      documentedFiles: 0,
      totalFunctions: 0,
      documentedFunctions: 0,
      totalClasses: 0,
      documentedClasses: 0,
      totalTODOs: 0,
      resolvedTODOs: 0,
      coverageScore: 0,
      qualityScore: 0
    };
    
    for (const file of files) {
      const analysis = await this.analyzeFileDocumentation(file);
      
      if (analysis.hasFileHeader) metrics.documentedFiles++;
      metrics.totalFunctions += analysis.totalFunctions;
      metrics.documentedFunctions += analysis.documentedFunctions;
      metrics.totalClasses += analysis.totalClasses;
      metrics.documentedClasses += analysis.documentedClasses;
      metrics.totalTODOs += analysis.todos.length;
      metrics.resolvedTODOs += analysis.todos.filter(t => t.status === 'resolved').length;
    }
    
    // Calculate scores
    metrics.coverageScore = this.calculateCoverageScore(metrics);
    metrics.qualityScore = this.calculateQualityScore(metrics);
    
    return metrics;
  }

  calculateCoverageScore(metrics) {
    const weights = {
      files: 0.2,
      functions: 0.4,
      classes: 0.4
    };
    
    const coverage = {
      files: metrics.totalFiles > 0 ? metrics.documentedFiles / metrics.totalFiles : 0,
      functions: metrics.totalFunctions > 0 ? metrics.documentedFunctions / metrics.totalFunctions : 0,
      classes: metrics.totalClasses > 0 ? metrics.documentedClasses / metrics.totalClasses : 0
    };
    
    return Object.entries(weights).reduce((score, [metric, weight]) => {
      return score + (coverage[metric] * weight * 100);
    }, 0);
  }

  // Helper Methods
  calculateTODOPriority(priority) {
    const priorityScores = {
      critical: 1000,
      high: 100,
      medium: 10,
      low: 1
    };
    
    return Date.now() + (priorityScores[priority] || 10);
  }

  formatDependencies(dependencies) {
    if (!dependencies || dependencies.length === 0) {
      return '- None';
    }
    
    return dependencies.map(dep => `- ${dep.name}: ${dep.purpose || 'TODO: Document dependency'}`).join('\n');
  }

  formatTODOs(todos) {
    if (!todos || todos.length === 0) {
      return '- None';
    }
    
    return todos.map(todo => `- [${todo.priority}] ${todo.description}`).join('\n');
  }

  groupTODOsByFile(todos) {
    const grouped = {};
    
    for (const todo of todos) {
      if (!grouped[todo.filePath]) {
        grouped[todo.filePath] = [];
      }
      grouped[todo.filePath].push(todo);
    }
    
    // Sort TODOs within each file by line number
    for (const filePath in grouped) {
      grouped[filePath].sort((a, b) => a.lineNumber - b.lineNumber);
    }
    
    return grouped;
  }

  hasFileHeader(code) {
    // Check for file header comment at the beginning
    const headerPattern = /^(?:\/\*\*[\s\S]*?\*\/|"""[\s\S]*?"""|'''[\s\S]*?''')/;
    return headerPattern.test(code.trim());
  }

  hasFunctionComment(func, code) {
    // Check if function has documentation comment
    const lines = code.split('\n');
    const funcLine = func.line - 1;
    
    if (funcLine > 0) {
      const prevLine = lines[funcLine - 1].trim();
      return prevLine.includes('/**') || prevLine.includes('"""') || prevLine.includes("'''");
    }
    
    return false;
  }

  hasClassComment(cls, code) {
    // Similar to function comment check
    return this.hasFunctionComment(cls, code);
  }

  extractFunctions(code, fileType) {
    const functions = [];
    const patterns = {
      javascript: /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=]*)=>)/g,
      python: /def\s+(\w+)\s*\(/g
    };
    
    const pattern = patterns[fileType] || patterns.javascript;
    let match;
    const lines = code.split('\n');
    
    while ((match = pattern.exec(code)) !== null) {
      const name = match[1] || match[2];
      const lineNumber = code.substring(0, match.index).split('\n').length;
      
      functions.push({
        name,
        line: lineNumber,
        content: lines[lineNumber - 1]
      });
    }
    
    return functions;
  }

  extractClasses(code, fileType) {
    const classes = [];
    const patterns = {
      javascript: /class\s+(\w+)/g,
      python: /class\s+(\w+)(?:\(|:)/g
    };
    
    const pattern = patterns[fileType] || patterns.javascript;
    let match;
    const lines = code.split('\n');
    
    while ((match = pattern.exec(code)) !== null) {
      const name = match[1];
      const lineNumber = code.substring(0, match.index).split('\n').length;
      
      classes.push({
        name,
        line: lineNumber,
        content: lines[lineNumber - 1]
      });
    }
    
    return classes;
  }

  generateCommentSuggestions(missingComments) {
    return missingComments.map(missing => {
      return {
        type: missing.type,
        location: missing.line,
        suggestion: `Add ${missing.type} documentation`,
        template: missing.template,
        autoFixable: true
      };
    });
  }

  async getProjectTODOs(projectId) {
    await this.taskManager.ensureConnection();
    
    const todoIds = await this.redis.sMembers(`project:${projectId}:todos`);
    const todos = [];
    
    for (const todoId of todoIds) {
      const todo = await this.redis.hGetAll(`todo:${todoId}`);
      if (todo) {
        todos.push({
          ...todo,
          context: JSON.parse(todo.context || '{}'),
          dependencies: JSON.parse(todo.dependencies || '[]')
        });
      }
    }
    
    return todos;
  }

  async getProjectFiles(projectId) {
    // This would interface with the file system or version control
    // For now, returning placeholder
    return [];
  }

  async analyzeFileDocumentation(file) {
    // Analyze individual file documentation
    return {
      hasFileHeader: false,
      totalFunctions: 0,
      documentedFunctions: 0,
      totalClasses: 0,
      documentedClasses: 0,
      todos: []
    };
  }
}