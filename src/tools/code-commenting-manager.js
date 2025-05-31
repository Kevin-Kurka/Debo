/**
 * Code Commenting Manager for Debo
 * Automatically generates descriptive headers and TODO lists for all created files
 */

const path = require('path');
const logger = require('../logger.js');

class CodeCommentingManager {
  constructor(llmProvider) {
    this.llmProvider = llmProvider;
    this.commentStyles = this.initializeCommentStyles();
    this.templateStructures = this.initializeTemplateStructures();
  }

  initializeCommentStyles() {
    return {
      javascript: { single: '//', block: { start: '/**', end: ' */' }, line: ' * ' },
      typescript: { single: '//', block: { start: '/**', end: ' */' }, line: ' * ' },
      python: { single: '#', block: { start: '"""', end: '"""' }, line: '' },
      java: { single: '//', block: { start: '/**', end: ' */' }, line: ' * ' },
      css: { single: '', block: { start: '/**', end: ' */' }, line: ' * ' },
      html: { single: '', block: { start: '<!--', end: '-->' }, line: ' ' },
      sql: { single: '--', block: { start: '/*', end: '*/' }, line: ' * ' },
      yaml: { single: '#', block: null, line: '' },
      json: { single: '', block: null, line: '' }, // JSON doesn't support comments
      markdown: { single: '', block: { start: '<!--', end: '-->' }, line: ' ' }
    };
  }

  initializeTemplateStructures() {
    return {
      component: {
        sections: ['Purpose', 'Props/Parameters', 'Usage Example', 'Dependencies', 'TODO'],
        priority: ['Purpose', 'TODO']
      },
      utility: {
        sections: ['Purpose', 'Parameters', 'Returns', 'Usage Example', 'TODO'],
        priority: ['Purpose', 'TODO']
      },
      service: {
        sections: ['Purpose', 'Responsibilities', 'Dependencies', 'Configuration', 'TODO'],
        priority: ['Purpose', 'TODO']
      },
      model: {
        sections: ['Purpose', 'Schema', 'Relationships', 'Validations', 'TODO'],
        priority: ['Purpose', 'TODO']
      },
      test: {
        sections: ['Test Coverage', 'Test Cases', 'Setup Requirements', 'TODO'],
        priority: ['Test Coverage', 'TODO']
      },
      config: {
        sections: ['Configuration Purpose', 'Environment Variables', 'Default Values', 'TODO'],
        priority: ['Configuration Purpose', 'TODO']
      }
    };
  }

  async generateFileHeader(filePath, fileContent, context = {}) {
    const fileExtension = this.getFileExtension(filePath);
    const fileType = this.determineFileType(filePath, fileContent);
    const commentStyle = this.commentStyles[fileExtension] || this.commentStyles.javascript;

    // Don't add comments to JSON files
    if (fileExtension === 'json') {
      return { header: '', todos: [], summary: 'JSON file - no comments added' };
    }

    // Generate comprehensive file analysis
    const analysis = await this.analyzeFileContent(filePath, fileContent, context);
    
    // Create structured header
    const header = await this.createFileHeader(analysis, commentStyle, fileType);
    
    // Extract TODOs for terminal feedback
    const todos = this.extractTodosFromHeader(header);
    
    // Create summary for terminal display
    const summary = this.createTerminalSummary(analysis, todos);

    return {
      header,
      todos,
      summary,
      analysis
    };
  }

  async analyzeFileContent(filePath, fileContent, context) {
    const analysisPrompt = `
Analyze this file and provide comprehensive information for documentation:

FILE PATH: ${filePath}
CONTEXT: ${JSON.stringify(context)}
CONTENT PREVIEW:
${fileContent.substring(0, 2000)}

Provide detailed analysis including:
1. PRIMARY PURPOSE - What does this file do? (1-2 sentences)
2. FILE TYPE - component/utility/service/model/test/config/other
3. KEY FEATURES - Main capabilities and features (3-5 points)
4. DEPENDENCIES - What external libraries, files, or services does it depend on?
5. CONFIGURATION - Any configuration or environment variables needed
6. USAGE EXAMPLE - How would someone use this file/class/function?
7. TODO ITEMS - What needs to be completed, improved, or added? (5-10 specific items)
8. TECHNICAL NOTES - Any important implementation details or considerations

Return as JSON:
{
  "purpose": "Clear description of file purpose",
  "fileType": "component|utility|service|model|test|config|other",
  "keyFeatures": ["feature 1", "feature 2", ...],
  "dependencies": ["dependency 1", "dependency 2", ...],
  "configuration": ["config item 1", "config item 2", ...],
  "usageExample": "Code example or description",
  "todoItems": ["TODO item 1", "TODO item 2", ...],
  "technicalNotes": ["note 1", "note 2", ...],
  "complexity": "low|medium|high"
}`;

    try {
      const response = await this.llmProvider.generateResponse(analysisPrompt, 'thinking');
      const analysis = JSON.parse(response);
      
      // Validate and sanitize the analysis
      return this.validateAnalysis(analysis);
    } catch (error) {
      logger.error('Failed to analyze file content:', error);
      return this.createFallbackAnalysis(filePath, fileContent);
    }
  }

  validateAnalysis(analysis) {
    // Ensure all required fields exist with sensible defaults
    return {
      purpose: analysis.purpose || 'Purpose not determined',
      fileType: analysis.fileType || 'other',
      keyFeatures: Array.isArray(analysis.keyFeatures) ? analysis.keyFeatures : [],
      dependencies: Array.isArray(analysis.dependencies) ? analysis.dependencies : [],
      configuration: Array.isArray(analysis.configuration) ? analysis.configuration : [],
      usageExample: analysis.usageExample || 'Usage example not available',
      todoItems: Array.isArray(analysis.todoItems) ? analysis.todoItems : ['Review and complete implementation'],
      technicalNotes: Array.isArray(analysis.technicalNotes) ? analysis.technicalNotes : [],
      complexity: analysis.complexity || 'medium'
    };
  }

  createFallbackAnalysis(filePath, fileContent) {
    const fileName = path.basename(filePath);
    const extension = this.getFileExtension(filePath);
    
    return {
      purpose: `${fileName} - Implementation file for project functionality`,
      fileType: 'other',
      keyFeatures: ['Core functionality implementation'],
      dependencies: this.extractBasicDependencies(fileContent),
      configuration: [],
      usageExample: `Import and use functions/classes from ${fileName}`,
      todoItems: [
        'Add comprehensive documentation',
        'Implement error handling',
        'Add unit tests',
        'Optimize performance',
        'Add validation logic'
      ],
      technicalNotes: [`${extension.toUpperCase()} implementation file`],
      complexity: 'medium'
    };
  }

  extractBasicDependencies(content) {
    const dependencies = [];
    
    // JavaScript/TypeScript imports
    const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      importMatches.forEach(match => {
        const dep = match.match(/from\s+['"]([^'"]+)['"]/);
        if (dep) dependencies.push(dep[1]);
      });
    }

    // Require statements
    const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g);
    if (requireMatches) {
      requireMatches.forEach(match => {
        const dep = match.match(/require\(['"]([^'"]+)['"]\)/);
        if (dep) dependencies.push(dep[1]);
      });
    }

    // Python imports
    const pythonImports = content.match(/^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm);
    if (pythonImports) {
      pythonImports.forEach(match => {
        const dep = match.match(/(?:from\s+(\S+)|import\s+(\S+))/);
        if (dep) dependencies.push(dep[1] || dep[2]);
      });
    }

    return [...new Set(dependencies)].slice(0, 10); // Unique and limited
  }

  async createFileHeader(analysis, commentStyle, fileType) {
    const template = this.templateStructures[fileType] || this.templateStructures.utility;
    
    if (!commentStyle.block) {
      // Use single-line comments for languages that don't support block comments
      return this.createSingleLineHeader(analysis, commentStyle, template);
    }

    // Create block comment header
    let header = commentStyle.block.start + '\n';
    
    // File title and purpose
    header += `${commentStyle.line}${path.basename(analysis.filePath || 'Unknown File')}\n`;
    header += `${commentStyle.line}\n`;
    header += `${commentStyle.line}PURPOSE:\n`;
    header += `${commentStyle.line}${analysis.purpose}\n`;
    header += `${commentStyle.line}\n`;

    // Key features
    if (analysis.keyFeatures.length > 0) {
      header += `${commentStyle.line}KEY FEATURES:\n`;
      analysis.keyFeatures.forEach(feature => {
        header += `${commentStyle.line}• ${feature}\n`;
      });
      header += `${commentStyle.line}\n`;
    }

    // Dependencies
    if (analysis.dependencies.length > 0) {
      header += `${commentStyle.line}DEPENDENCIES:\n`;
      analysis.dependencies.slice(0, 5).forEach(dep => {
        header += `${commentStyle.line}• ${dep}\n`;
      });
      header += `${commentStyle.line}\n`;
    }

    // Configuration
    if (analysis.configuration.length > 0) {
      header += `${commentStyle.line}CONFIGURATION:\n`;
      analysis.configuration.slice(0, 3).forEach(config => {
        header += `${commentStyle.line}• ${config}\n`;
      });
      header += `${commentStyle.line}\n`;
    }

    // Usage example
    if (analysis.usageExample && analysis.usageExample !== 'Usage example not available') {
      header += `${commentStyle.line}USAGE EXAMPLE:\n`;
      const exampleLines = analysis.usageExample.split('\n');
      exampleLines.slice(0, 5).forEach(line => {
        header += `${commentStyle.line}${line}\n`;
      });
      header += `${commentStyle.line}\n`;
    }

    // TODO items
    if (analysis.todoItems.length > 0) {
      header += `${commentStyle.line}TODO:\n`;
      analysis.todoItems.slice(0, 10).forEach((todo, index) => {
        header += `${commentStyle.line}${index + 1}. ${todo}\n`;
      });
      header += `${commentStyle.line}\n`;
    }

    // Technical notes
    if (analysis.technicalNotes.length > 0) {
      header += `${commentStyle.line}TECHNICAL NOTES:\n`;
      analysis.technicalNotes.slice(0, 3).forEach(note => {
        header += `${commentStyle.line}• ${note}\n`;
      });
      header += `${commentStyle.line}\n`;
    }

    // Footer
    header += `${commentStyle.line}Generated by Debo Autonomous Development System\n`;
    header += `${commentStyle.line}Last updated: ${new Date().toISOString()}\n`;
    header += commentStyle.block.end + '\n\n';

    return header;
  }

  createSingleLineHeader(analysis, commentStyle, template) {
    const comment = commentStyle.single;
    let header = '';

    // File title and purpose
    header += `${comment} ================================================================\n`;
    header += `${comment} ${path.basename(analysis.filePath || 'Unknown File')}\n`;
    header += `${comment} ================================================================\n`;
    header += `${comment}\n`;
    header += `${comment} PURPOSE: ${analysis.purpose}\n`;
    header += `${comment}\n`;

    // Key features
    if (analysis.keyFeatures.length > 0) {
      header += `${comment} KEY FEATURES:\n`;
      analysis.keyFeatures.slice(0, 3).forEach(feature => {
        header += `${comment} • ${feature}\n`;
      });
      header += `${comment}\n`;
    }

    // TODO items (priority for single-line)
    if (analysis.todoItems.length > 0) {
      header += `${comment} TODO:\n`;
      analysis.todoItems.slice(0, 5).forEach((todo, index) => {
        header += `${comment} ${index + 1}. ${todo}\n`;
      });
      header += `${comment}\n`;
    }

    header += `${comment} Generated by Debo - ${new Date().toLocaleDateString()}\n`;
    header += `${comment} ================================================================\n\n`;

    return header;
  }

  extractTodosFromHeader(header) {
    const todoMatches = header.match(/(?:TODO:|TODO ITEMS?:)([\s\S]*?)(?:\n\s*(?:\*\/|-->|$)|\n\s*[A-Z][A-Z\s]*:)/i);
    
    if (!todoMatches) return [];

    const todoSection = todoMatches[1];
    const todoItems = [];

    // Extract numbered or bulleted todo items
    const itemMatches = todoSection.match(/(?:^\s*(?:\*\s*)?(?:\d+\.|\•)\s*(.+)$)/gm);
    
    if (itemMatches) {
      itemMatches.forEach(match => {
        const cleanItem = match.replace(/^\s*(?:\*\s*)?(?:\d+\.|\•)\s*/, '').trim();
        if (cleanItem) {
          todoItems.push(cleanItem);
        }
      });
    }

    return todoItems;
  }

  createTerminalSummary(analysis, todos) {
    return {
      purpose: analysis.purpose,
      fileType: analysis.fileType,
      complexity: analysis.complexity,
      featureCount: analysis.keyFeatures.length,
      dependencyCount: analysis.dependencies.length,
      todoCount: todos.length,
      keyFeatures: analysis.keyFeatures.slice(0, 3),
      priorityTodos: todos.slice(0, 5)
    };
  }

  async addHeaderToFile(filePath, fileContent, context = {}) {
    const result = await this.generateFileHeader(filePath, fileContent, context);
    
    // Combine header with existing content
    const finalContent = result.header + fileContent;
    
    return {
      content: finalContent,
      header: result.header,
      todos: result.todos,
      summary: result.summary,
      analysis: result.analysis
    };
  }

  async updateExistingHeader(filePath, fileContent, context = {}) {
    // Check if file already has a header
    const hasHeader = this.detectExistingHeader(fileContent);
    
    if (hasHeader) {
      // Remove existing header and add new one
      const contentWithoutHeader = this.removeExistingHeader(fileContent);
      return await this.addHeaderToFile(filePath, contentWithoutHeader, context);
    } else {
      // Add header to file that doesn't have one
      return await this.addHeaderToFile(filePath, fileContent, context);
    }
  }

  detectExistingHeader(content) {
    // Look for existing Debo-generated headers
    const deboHeaderPatterns = [
      /Generated by Debo/i,
      /Debo Autonomous Development System/i,
      /PURPOSE:/i,
      /TODO:/i
    ];

    return deboHeaderPatterns.some(pattern => pattern.test(content.substring(0, 1000)));
  }

  removeExistingHeader(content) {
    // Remove existing block comment header
    const blockCommentEnd = content.search(/\*\/\s*\n/);
    if (blockCommentEnd !== -1) {
      return content.substring(blockCommentEnd + 3);
    }

    // Remove existing single-line comment header
    const lines = content.split('\n');
    let headerEndIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('//') || line.startsWith('#')) {
        headerEndIndex = i + 1;
      } else if (line === '') {
        continue; // Skip empty lines
      } else {
        break; // Found actual content
      }
    }

    return lines.slice(headerEndIndex).join('\n');
  }

  getFileExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase().substring(1);
    
    // Map extensions to supported comment styles
    const extensionMap = {
      'js': 'javascript',
      'jsx': 'javascript', 
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'css': 'css',
      'scss': 'css',
      'sass': 'css',
      'html': 'html',
      'htm': 'html',
      'sql': 'sql',
      'yml': 'yaml',
      'yaml': 'yaml',
      'json': 'json',
      'md': 'markdown',
      'markdown': 'markdown'
    };

    return extensionMap[ext] || 'javascript';
  }

  determineFileType(filePath, content) {
    const fileName = path.basename(filePath).toLowerCase();
    const content_lower = content.toLowerCase();

    // Determine file type based on name patterns and content
    if (fileName.includes('component') || fileName.includes('.comp.') || content_lower.includes('component')) {
      return 'component';
    }
    if (fileName.includes('util') || fileName.includes('helper') || fileName.includes('lib')) {
      return 'utility';
    }
    if (fileName.includes('service') || fileName.includes('api') || content_lower.includes('service')) {
      return 'service';
    }
    if (fileName.includes('model') || fileName.includes('schema') || content_lower.includes('schema')) {
      return 'model';
    }
    if (fileName.includes('test') || fileName.includes('spec') || content_lower.includes('describe(')) {
      return 'test';
    }
    if (fileName.includes('config') || fileName === 'index.js' || fileName === 'main.js') {
      return 'config';
    }

    return 'utility'; // Default type
  }

  // Public API methods for terminal feedback
  formatTerminalFeedback(summary, todos) {
    const feedback = {
      fileInfo: {
        purpose: summary.purpose,
        type: summary.fileType,
        complexity: summary.complexity,
        features: summary.featureCount,
        dependencies: summary.dependencyCount
      },
      todos: {
        total: summary.todoCount,
        priority: todos.slice(0, 5)
      },
      keyFeatures: summary.keyFeatures
    };

    return feedback;
  }

  async generateInlineComments(code, language = 'javascript') {
    const prompt = `
Add helpful inline comments to this ${language} code.
Focus on:
1. Explaining complex logic
2. Clarifying variable purposes
3. Describing function/method behavior
4. Warning about potential issues

Original code:
${code}

Return the same code with strategic inline comments added. Don't over-comment obvious things.
`;

    try {
      const commentedCode = await this.llmProvider.generateResponse(prompt, 'fast');
      return commentedCode;
    } catch (error) {
      logger.error('Failed to generate inline comments:', error);
      return code; // Return original code if commenting fails
    }
  }

  async generateClassDocumentation(classCode, language = 'javascript') {
    const prompt = `
Generate comprehensive documentation for this ${language} class:

${classCode}

Provide:
1. Class purpose and responsibilities
2. Constructor parameters
3. Public method descriptions
4. Usage examples
5. Important notes

Format as a documentation comment block appropriate for ${language}.
`;

    try {
      const documentation = await this.llmProvider.generateResponse(prompt, 'thinking');
      return documentation;
    } catch (error) {
      logger.error('Failed to generate class documentation:', error);
      return null;
    }
  }
}

module.exports = { CodeCommentingManager };