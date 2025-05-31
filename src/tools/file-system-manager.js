import fs from 'fs-extra';
import path from 'path';
import logger from '../logger.js';
import TemplateManager from './template-manager.js';

export class FileSystemManager {
  constructor() {
    this.projectsRoot = path.join(process.cwd(), 'projects');
    this.templatesRoot = path.join(process.cwd(), 'templates');
    this.templateManager = new TemplateManager();
  }

  async init() {
    await fs.ensureDir(this.projectsRoot);
    await fs.ensureDir(this.templatesRoot);
    await this.templateManager.init();
    logger.info('FileSystemManager initialized');
  }

  async ensureProjectDirectory(projectId, projectName) {
    const projectPath = path.join(this.projectsRoot, projectName || projectId);
    await fs.ensureDir(projectPath);
    return projectPath;
  }

  async writeFile(projectPath, relativePath, content) {
    const fullPath = path.join(projectPath, relativePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
    logger.info(`File written: ${fullPath}`);
    return fullPath;
  }

  async writeFiles(projectPath, files) {
    const writtenFiles = [];
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = await this.writeFile(projectPath, relativePath, content);
      writtenFiles.push(fullPath);
    }
    return writtenFiles;
  }

  async readFile(projectPath, relativePath) {
    const fullPath = path.join(projectPath, relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async fileExists(projectPath, relativePath) {
    const fullPath = path.join(projectPath, relativePath);
    return await fs.pathExists(fullPath);
  }

  async listFiles(projectPath, pattern = '**/*') {
    const glob = (await import('glob')).glob;
    const files = await glob(pattern, {
      cwd: projectPath,
      nodir: true,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
    });
    return files;
  }

  async copyTemplate(templateName, projectPath) {
    const templatePath = path.join(this.templatesRoot, templateName);
    if (await fs.pathExists(templatePath)) {
      await fs.copy(templatePath, projectPath);
      logger.info(`Template ${templateName} copied to ${projectPath}`);
      return true;
    }
    return false;
  }

  async createProjectStructure(projectPath, structure) {
    for (const [dir, files] of Object.entries(structure)) {
      const dirPath = path.join(projectPath, dir);
      await fs.ensureDir(dirPath);
      
      if (typeof files === 'object' && !Array.isArray(files)) {
        for (const [fileName, content] of Object.entries(files)) {
          await this.writeFile(projectPath, path.join(dir, fileName), content);
        }
      }
    }
  }

  extractCodeFromLLMResponse(llmResponse) {
    const files = {};
    const content = typeof llmResponse === 'string' ? llmResponse : llmResponse.content;
    
    // Extract file blocks marked with <<<filename>>> ... <<<>>>
    const fileBlockRegex = /<<<(.+?)>>>\s*([\s\S]*?)<<<>>>/g;
    let match;
    
    while ((match = fileBlockRegex.exec(content)) !== null) {
      const filename = match[1].trim();
      const fileContent = match[2].trim();
      files[filename] = fileContent;
    }
    
    // If no file blocks found, extract code blocks with filenames
    if (Object.keys(files).length === 0) {
      const codeBlockRegex = /```(?:(\w+)\s+)?(?:filename:\s*)?([^\n]+)?\n([\s\S]*?)```/g;
      
      while ((match = codeBlockRegex.exec(content)) !== null) {
        const language = match[1] || 'text';
        const filename = match[2]?.trim();
        const code = match[3].trim();
        
        if (filename) {
          files[filename] = code;
        } else {
          // Try to infer filename from code content
          const inferredName = this.inferFileName(code, language);
          if (inferredName) {
            files[inferredName] = code;
          }
        }
      }
    }
    
    return files;
  }

  inferFileName(code, language) {
    const lines = code.split('\n').slice(0, 10); // Check first 10 lines
    
    // Look for class/function/component names
    for (const line of lines) {
      // React components
      if (line.match(/export\s+(default\s+)?function\s+(\w+)/)) {
        const match = line.match(/function\s+(\w+)/);
        return `${match[1]}.${this.getExtension(language)}`;
      }
      
      // Classes
      if (line.match(/class\s+(\w+)/)) {
        const match = line.match(/class\s+(\w+)/);
        return `${match[1]}.${this.getExtension(language)}`;
      }
      
      // Exports
      if (line.match(/export\s+(const|let|var)\s+(\w+)/)) {
        const match = line.match(/export\s+(?:const|let|var)\s+(\w+)/);
        return `${match[1]}.${this.getExtension(language)}`;
      }
    }
    
    return null;
  }

  getExtension(language) {
    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      jsx: 'jsx',
      tsx: 'tsx',
      python: 'py',
      java: 'java',
      css: 'css',
      html: 'html',
      json: 'json',
      yaml: 'yaml',
      yml: 'yml',
      markdown: 'md',
      md: 'md'
    };
    
    return extensions[language.toLowerCase()] || 'txt';
  }

  async analyzeProject(projectPath) {
    const files = await this.listFiles(projectPath);
    
    const analysis = {
      totalFiles: files.length,
      fileTypes: {},
      directories: new Set(),
      hasTests: false,
      hasPackageJson: false,
      hasReadme: false
    };
    
    for (const file of files) {
      const ext = path.extname(file);
      analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;
      
      const dir = path.dirname(file);
      if (dir !== '.') {
        analysis.directories.add(dir);
      }
      
      if (file.includes('test') || file.includes('spec')) {
        analysis.hasTests = true;
      }
      
      if (file === 'package.json') {
        analysis.hasPackageJson = true;
      }
      
      if (file.toLowerCase() === 'readme.md') {
        analysis.hasReadme = true;
      }
    }
    
    analysis.directories = Array.from(analysis.directories);
    return analysis;
  }

  async scaffoldFromTemplate(projectPath, templateName, variables = {}) {
    await this.templateManager.scaffoldProject(projectPath, templateName, variables);
    logger.info(`Project scaffolded at ${projectPath} using template ${templateName}`);
  }

  async detectAndScaffold(projectPath, requirements, projectName) {
    const templateName = await this.templateManager.detectBestTemplate(requirements);
    const variables = {
      projectName: projectName || path.basename(projectPath)
    };
    
    await this.scaffoldFromTemplate(projectPath, templateName, variables);
    return templateName;
  }

  getAvailableTemplates() {
    return this.templateManager.getAvailableTemplates();
  }
}

export default FileSystemManager;