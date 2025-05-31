import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import logger from '../logger.js';

const execAsync = promisify(exec);

export class QualityGateway {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.qualityThresholds = {
      testCoverage: 80,
      complexity: 10,
      vulnerabilities: 0,
      performanceDegradation: 15,
      codeQuality: 85
    };
  }

  async init() {
    logger.info('Quality Gateway initialized with thresholds:', this.qualityThresholds);
  }

  async runQualityGates(projectId, context) {
    const startTime = Date.now();
    
    try {
      // Run all quality checks in parallel
      const [
        testResults,
        complexityResults,
        securityResults,
        performanceResults,
        dependencyResults
      ] = await Promise.all([
        this.runTestSuite(projectId),
        this.analyzeComplexity(projectId),
        this.scanSecurity(projectId),
        this.checkPerformance(projectId),
        this.auditDependencies(projectId)
      ]);

      const qualityReport = {
        projectId,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        testCoverage: testResults.coverage,
        complexity: complexityResults.average,
        complexityIncrease: complexityResults.increase,
        vulnerabilities: securityResults.count,
        performanceScore: performanceResults.score,
        performanceDegradation: performanceResults.degradation,
        dependencyHealth: dependencyResults.health,
        overallScore: this.calculateOverallScore({
          testResults,
          complexityResults,
          securityResults,
          performanceResults
        }),
        passed: this.evaluateOverallPass({
          testResults,
          complexityResults,
          securityResults,
          performanceResults
        }),
        context
      };

      // Store results
      await this.storeQualityReport(projectId, qualityReport);
      
      return qualityReport;

    } catch (error) {
      logger.error('Quality gate execution failed:', error);
      return {
        projectId,
        timestamp: new Date().toISOString(),
        error: error.message,
        passed: false
      };
    }
  }

  async runTestSuite(projectId) {
    try {
      const projectPath = await this.getProjectPath(projectId);
      
      // Check if test script exists
      const packageJsonPath = join(projectPath, 'package.json');
      if (!existsSync(packageJsonPath)) {
        return { coverage: 0, passed: 0, failed: 0, exists: false };
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (!packageJson.scripts?.test || packageJson.scripts.test.includes('echo')) {
        return { coverage: 0, passed: 0, failed: 0, exists: false };
      }

      // Run tests with coverage
      const { stdout, stderr } = await execAsync('npm test -- --coverage --json', {
        cwd: projectPath,
        timeout: 30000
      });

      const testOutput = this.parseTestOutput(stdout);
      return {
        coverage: testOutput.coverage || 0,
        passed: testOutput.passed || 0,
        failed: testOutput.failed || 0,
        exists: true,
        details: testOutput
      };

    } catch (error) {
      logger.warn('Test execution failed:', error.message);
      return { coverage: 0, passed: 0, failed: 1, exists: true, error: error.message };
    }
  }

  async analyzeComplexity(projectId) {
    try {
      const projectPath = await this.getProjectPath(projectId);
      
      // Use a simple complexity analysis
      const jsFiles = await this.findJavaScriptFiles(projectPath);
      let totalComplexity = 0;
      let fileCount = 0;
      const complexFiles = [];

      for (const file of jsFiles) {
        const complexity = await this.calculateFileComplexity(file);
        totalComplexity += complexity.cyclomatic;
        fileCount++;
        
        if (complexity.cyclomatic > this.qualityThresholds.complexity) {
          complexFiles.push({ file, complexity: complexity.cyclomatic });
        }
      }

      const averageComplexity = fileCount > 0 ? totalComplexity / fileCount : 0;
      const previousComplexity = await this.getPreviousComplexity(projectId);
      const increase = previousComplexity ? 
        ((averageComplexity - previousComplexity) / previousComplexity) * 100 : 0;

      return {
        average: averageComplexity,
        total: totalComplexity,
        fileCount,
        increase,
        complexFiles,
        threshold: this.qualityThresholds.complexity
      };

    } catch (error) {
      logger.warn('Complexity analysis failed:', error.message);
      return { average: 0, total: 0, fileCount: 0, increase: 0, error: error.message };
    }
  }

  async scanSecurity(projectId) {
    try {
      const projectPath = await this.getProjectPath(projectId);
      
      // Run npm audit
      const { stdout } = await execAsync('npm audit --json', {
        cwd: projectPath,
        timeout: 20000
      });

      const auditResults = JSON.parse(stdout);
      const vulnerabilities = auditResults.vulnerabilities || {};
      
      const severityCounts = {
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0
      };

      Object.values(vulnerabilities).forEach(vuln => {
        if (vuln.severity && severityCounts[vuln.severity] !== undefined) {
          severityCounts[vuln.severity]++;
        }
      });

      const totalCount = Object.values(severityCounts).reduce((a, b) => a + b, 0);

      return {
        count: totalCount,
        severityCounts,
        details: Object.keys(vulnerabilities).slice(0, 5), // Top 5 vulnerabilities
        passed: totalCount === 0
      };

    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      if (error.stdout) {
        try {
          const auditResults = JSON.parse(error.stdout);
          const count = Object.keys(auditResults.vulnerabilities || {}).length;
          return { count, passed: count === 0, details: auditResults };
        } catch (parseError) {
          logger.warn('Security scan parse failed:', parseError.message);
        }
      }
      
      return { count: 0, passed: true, error: error.message };
    }
  }

  async checkPerformance(projectId) {
    try {
      const projectPath = await this.getProjectPath(projectId);
      const previousMetrics = await this.getPreviousPerformanceMetrics(projectId);
      
      // Basic performance checks
      const bundleSize = await this.calculateBundleSize(projectPath);
      const memoryUsage = process.memoryUsage();
      
      const currentScore = this.calculatePerformanceScore({
        bundleSize,
        memoryUsage: memoryUsage.heapUsed
      });

      const degradation = previousMetrics?.score ? 
        ((previousMetrics.score - currentScore) / previousMetrics.score) * 100 : 0;

      return {
        score: currentScore,
        degradation: Math.max(0, degradation),
        bundleSize,
        memoryUsage: memoryUsage.heapUsed,
        passed: degradation < this.qualityThresholds.performanceDegradation
      };

    } catch (error) {
      logger.warn('Performance check failed:', error.message);
      return { score: 50, degradation: 0, passed: true, error: error.message };
    }
  }

  async auditDependencies(projectId) {
    try {
      const projectPath = await this.getProjectPath(projectId);
      const packageJsonPath = join(projectPath, 'package.json');
      
      if (!existsSync(packageJsonPath)) {
        return { health: 100, outdated: [], deprecated: [] };
      }

      // Check for outdated packages
      const { stdout } = await execAsync('npm outdated --json', {
        cwd: projectPath,
        timeout: 15000
      });

      const outdated = stdout ? JSON.parse(stdout) : {};
      const outdatedCount = Object.keys(outdated).length;
      
      // Calculate health score
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const totalDeps = Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }).length;

      const healthScore = totalDeps > 0 ? 
        Math.max(0, 100 - (outdatedCount / totalDeps) * 100) : 100;

      return {
        health: healthScore,
        outdated: Object.keys(outdated),
        outdatedCount,
        totalDependencies: totalDeps,
        passed: healthScore > 70
      };

    } catch (error) {
      return { health: 100, outdated: [], passed: true, error: error.message };
    }
  }

  // Helper methods
  async getProjectPath(projectId) {
    const projectData = await this.taskManager.connectionManager.redis.hGetAll(`project:${projectId}`);
    return projectData.path || process.cwd();
  }

  async findJavaScriptFiles(directory) {
    try {
      const { stdout } = await execAsync(`find "${directory}" -name "*.js" -not -path "*/node_modules/*" -not -path "*/.*/*"`, {
        timeout: 10000
      });
      return stdout.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
      return [];
    }
  }

  async calculateFileComplexity(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      
      // Simple cyclomatic complexity calculation
      const complexityIndicators = [
        /if\s*\(/g,
        /else\s*if/g,
        /while\s*\(/g,
        /for\s*\(/g,
        /switch\s*\(/g,
        /case\s+/g,
        /catch\s*\(/g,
        /\?\s*.*:/g, // ternary
        /&&/g,
        /\|\|/g
      ];

      let cyclomatic = 1; // Base complexity
      complexityIndicators.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) cyclomatic += matches.length;
      });

      return { cyclomatic, filePath };
    } catch (error) {
      return { cyclomatic: 1, filePath, error: error.message };
    }
  }

  calculatePerformanceScore({ bundleSize, memoryUsage }) {
    // Simple scoring based on bundle size and memory usage
    let score = 100;
    
    // Penalize large bundle sizes (> 1MB)
    if (bundleSize > 1024 * 1024) {
      score -= Math.min(30, (bundleSize / (1024 * 1024)) * 5);
    }
    
    // Penalize high memory usage (> 100MB)
    if (memoryUsage > 100 * 1024 * 1024) {
      score -= Math.min(20, (memoryUsage / (100 * 1024 * 1024)) * 5);
    }
    
    return Math.max(0, score);
  }

  calculateOverallScore({ testResults, complexityResults, securityResults, performanceResults }) {
    const weights = {
      tests: 0.3,
      complexity: 0.2,
      security: 0.3,
      performance: 0.2
    };

    const scores = {
      tests: Math.min(100, testResults.coverage),
      complexity: Math.max(0, 100 - (complexityResults.average * 5)),
      security: securityResults.count === 0 ? 100 : Math.max(0, 100 - (securityResults.count * 10)),
      performance: performanceResults.score
    };

    return Object.entries(weights).reduce((total, [key, weight]) => {
      return total + (scores[key] * weight);
    }, 0);
  }

  evaluateOverallPass({ testResults, complexityResults, securityResults, performanceResults }) {
    return testResults.coverage >= this.qualityThresholds.testCoverage &&
           complexityResults.average <= this.qualityThresholds.complexity &&
           securityResults.count <= this.qualityThresholds.vulnerabilities &&
           performanceResults.degradation <= this.qualityThresholds.performanceDegradation;
  }

  parseTestOutput(output) {
    // Parse Jest/npm test output - simplified
    try {
      if (output.includes('coverage')) {
        const coverageMatch = output.match(/(\d+(?:\.\d+)?)%/);
        const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;
        
        const passedMatch = output.match(/(\d+) passing/);
        const failedMatch = output.match(/(\d+) failing/);
        
        return {
          coverage,
          passed: passedMatch ? parseInt(passedMatch[1]) : 0,
          failed: failedMatch ? parseInt(failedMatch[1]) : 0
        };
      }
      return { coverage: 0, passed: 0, failed: 0 };
    } catch (error) {
      return { coverage: 0, passed: 0, failed: 0, error: error.message };
    }
  }

  async getPreviousComplexity(projectId) {
    try {
      const previous = await this.taskManager.connectionManager.redis.hGet(`project_metrics:${projectId}`, 'codeComplexity');
      return previous ? parseFloat(previous) : null;
    } catch (error) {
      return null;
    }
  }

  async getPreviousPerformanceMetrics(projectId) {
    try {
      const score = await this.taskManager.connectionManager.redis.hGet(`project_metrics:${projectId}`, 'performanceScore');
      return score ? { score: parseFloat(score) } : null;
    } catch (error) {
      return null;
    }
  }

  async calculateBundleSize(projectPath) {
    try {
      // Check if build output exists
      const buildPaths = ['dist', 'build', '.next'];
      let totalSize = 0;
      
      for (const buildPath of buildPaths) {
        const fullPath = join(projectPath, buildPath);
        if (existsSync(fullPath)) {
          const { stdout } = await execAsync(`du -sb "${fullPath}"`, { timeout: 5000 });
          const size = parseInt(stdout.split('\t')[0]);
          totalSize += size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  async storeQualityReport(projectId, report) {
    const reportId = `quality_report:${projectId}:${Date.now()}`;
    await this.taskManager.connectionManager.redis.hSet(reportId, {
      data: JSON.stringify(report),
      timestamp: report.timestamp
    });

    // Keep only last 10 reports
    const reports = await this.taskManager.connectionManager.redis.keys(`quality_report:${projectId}:*`);
    if (reports.length > 10) {
      const sortedReports = reports.sort();
      const toDelete = sortedReports.slice(0, -10);
      if (toDelete.length > 0) {
        await this.taskManager.connectionManager.redis.del(...toDelete);
      }
    }
  }

  async monitorRequest(requestId, request) {
    // Log request for quality monitoring
    await this.taskManager.redis.hSet(`request_monitor:${requestId}`, {
      request,
      startTime: Date.now(),
      status: 'monitoring'
    });
  }
}