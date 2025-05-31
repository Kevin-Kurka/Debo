import { exec } from 'child_process';
import { promisify } from 'util';
import { RAGSystem } from '../tools/rag.js';

const execAsync = promisify(exec);

export class DependencyAnalyst {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.ragSystem = new RAGSystem();
  }

  async reviewDependency(packageName, version, projectId) {
    // 1. Check deprecation status
    const deprecationCheck = await this.checkDeprecation(packageName, version);
    if (deprecationCheck.deprecated) {
      return { approved: false, reason: 'Package is deprecated', alternatives: deprecationCheck.alternatives };
    }

    // 2. Analyze compatibility
    const compatibilityCheck = await this.analyzeCompatibility(packageName, version, projectId);
    if (compatibilityCheck.conflicts.length > 0) {
      return { approved: false, reason: 'Compatibility conflicts', conflicts: compatibilityCheck.conflicts };
    }

    // 3. Index documentation
    await this.indexDocumentation(packageName, version);

    // 4. Store approval
    await this.taskManager.redis.hSet(`dependency_approval:${projectId}:${packageName}`, {
      packageName, version, status: 'approved', reviewedAt: new Date().toISOString()
    });

    return { approved: true, documentationIndexed: true };
  }

  async checkDeprecation(packageName, version) {
    try {
      const { stdout } = await execAsync(`npm view ${packageName}@${version} deprecated`);
      if (stdout.trim()) {
        // Get alternatives
        const alternatives = await this.findAlternatives(packageName);
        return { deprecated: true, reason: stdout.trim(), alternatives };
      }
      return { deprecated: false };
    } catch (error) {
      return { deprecated: false, error: error.message };
    }
  }

  async analyzeCompatibility(packageName, version, projectId) {
    const conflicts = [];
    const existingDeps = await this.taskManager.redis.sMembers(`project:${projectId}:dependencies`);
    
    for (const depId of existingDeps) {
      const dep = await this.taskManager.redis.hGetAll(`dependency:${depId}`);
      const conflict = await this.checkPeerDependencies(packageName, version, dep.name, dep.version);
      if (conflict) conflicts.push(conflict);
    }

    return { conflicts, compatible: conflicts.length === 0 };
  }

  async indexDocumentation(packageName, version) {
    try {
      // Get documentation from npm
      const { stdout } = await execAsync(`npm view ${packageName}@${version} readme`);
      
      // Extract best practices and patterns
      const patterns = this.extractCodePatterns(stdout);
      const bestPractices = this.extractBestPractices(stdout);

      // Store in database with vectors
      await this.taskManager.redis.hSet(`doc:${packageName}:${version}`, {
        packageName, version, documentation: stdout, 
        bestPractices: JSON.stringify(bestPractices),
        patterns: JSON.stringify(patterns),
        indexedAt: new Date().toISOString()
      });

      // Add to RAG system
      await this.ragSystem.addDocument(stdout, { type: 'documentation', package: packageName, version });

    } catch (error) {
      console.error(`Documentation indexing failed for ${packageName}:`, error);
    }
  }

  extractCodePatterns(documentation) {
    const patterns = [];
    const codeBlocks = documentation.match(/```[\s\S]*?```/g) || [];
    
    codeBlocks.forEach(block => {
      if (block.includes('import') || block.includes('require')) {
        patterns.push({ type: 'import', code: block });
      }
      if (block.includes('function') || block.includes('=>')) {
        patterns.push({ type: 'usage', code: block });
      }
    });

    return patterns;
  }

  extractBestPractices(documentation) {
    const practices = [];
    const sections = documentation.split('\n');
    
    sections.forEach(line => {
      if (line.toLowerCase().includes('best practice') || 
          line.toLowerCase().includes('recommended') ||
          line.toLowerCase().includes('should')) {
        practices.push(line.trim());
      }
    });

    return practices;
  }

  async findAlternatives(packageName) {
    try {
      const { stdout } = await execAsync(`npm search ${packageName} --json`);
      const results = JSON.parse(stdout);
      return results.slice(0, 3).map(pkg => ({ name: pkg.name, description: pkg.description }));
    } catch {
      return [];
    }
  }
}
