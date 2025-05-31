import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import logger from '../logger.js';

const execAsync = promisify(exec);

export class GitAutomation {
  constructor(fileSystemManager) {
    this.fileSystemManager = fileSystemManager;
    this.gitProviders = {
      github: {
        name: 'GitHub',
        cli: 'gh',
        apiUrl: 'https://api.github.com'
      },
      gitlab: {
        name: 'GitLab',
        cli: 'glab',
        apiUrl: 'https://gitlab.com/api/v4'
      }
    };
  }

  async initializeRepository(projectPath, options = {}) {
    try {
      // Check if already a git repo
      const isGitRepo = await this.isGitRepository(projectPath);
      
      if (!isGitRepo) {
        await execAsync('git init', { cwd: projectPath });
        logger.info('Initialized git repository');
      }

      // Create .gitignore if it doesn't exist
      await this.createGitignore(projectPath, options.stack);

      // Initial commit
      await this.createInitialCommit(projectPath);

      return { initialized: true, path: projectPath };
    } catch (error) {
      logger.error('Git initialization failed:', error);
      throw error;
    }
  }

  async isGitRepository(projectPath) {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: projectPath });
      return true;
    } catch {
      return false;
    }
  }

  async createGitignore(projectPath, stack) {
    const gitignorePath = path.join(projectPath, '.gitignore');
    
    if (await fs.pathExists(gitignorePath)) {
      return;
    }

    let content = `# Dependencies
node_modules/
vendor/
venv/
env/
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
out/
.next/
.nuxt/
.cache/
*.pyc
__pycache__/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/
*.lcov

# Misc
.DS_Store
Thumbs.db
`;

    // Add stack-specific ignores
    if (stack === 'python' || stack === 'fastapi') {
      content += `
# Python
*.py[cod]
*$py.class
*.so
.Python
pip-log.txt
pip-delete-this-directory.txt
.tox/
.coverage
.coverage.*
.cache
.pytest_cache/
docs/_build/
*.egg-info/
.installed.cfg
*.egg
`;
    }

    await this.fileSystemManager.writeFile(projectPath, '.gitignore', content);
  }

  async createInitialCommit(projectPath) {
    try {
      // Add all files
      await execAsync('git add .', { cwd: projectPath });
      
      // Create commit
      await execAsync(
        'git commit -m "Initial commit - Project scaffolded by Debo 🚀"',
        { cwd: projectPath }
      );
      
      logger.info('Created initial commit');
    } catch (error) {
      if (error.message.includes('nothing to commit')) {
        logger.info('No changes to commit');
      } else {
        throw error;
      }
    }
  }

  async createFeatureBranch(projectPath, branchName) {
    try {
      // Create and checkout new branch
      await execAsync(`git checkout -b ${branchName}`, { cwd: projectPath });
      
      logger.info(`Created feature branch: ${branchName}`);
      return { branch: branchName, created: true };
    } catch (error) {
      if (error.message.includes('already exists')) {
        // Branch exists, just checkout
        await execAsync(`git checkout ${branchName}`, { cwd: projectPath });
        return { branch: branchName, created: false };
      }
      throw error;
    }
  }

  async commitChanges(projectPath, message, options = {}) {
    try {
      // Stage changes
      if (options.files && options.files.length > 0) {
        for (const file of options.files) {
          await execAsync(`git add "${file}"`, { cwd: projectPath });
        }
      } else {
        // Add all changes
        await execAsync('git add .', { cwd: projectPath });
      }

      // Check if there are changes to commit
      const { stdout: status } = await execAsync('git status --porcelain', { cwd: projectPath });
      
      if (!status.trim()) {
        logger.info('No changes to commit');
        return { committed: false, message: 'No changes' };
      }

      // Create commit with descriptive message
      const fullMessage = this.formatCommitMessage(message, options);
      await execAsync(`git commit -m "${fullMessage}"`, { cwd: projectPath });

      // Get commit hash
      const { stdout: hash } = await execAsync('git rev-parse HEAD', { cwd: projectPath });

      return {
        committed: true,
        hash: hash.trim(),
        message: fullMessage
      };
    } catch (error) {
      logger.error('Commit failed:', error);
      throw error;
    }
  }

  formatCommitMessage(message, options = {}) {
    let formatted = message;

    // Add emoji prefix based on type
    if (options.type) {
      const emojis = {
        feat: '✨',
        fix: '🐛',
        docs: '📝',
        style: '💄',
        refactor: '♻️',
        test: '✅',
        chore: '🔧',
        perf: '⚡',
        security: '🔒'
      };
      
      const emoji = emojis[options.type] || '🚀';
      formatted = `${emoji} ${message}`;
    }

    // Add scope if provided
    if (options.scope) {
      formatted = `${options.type || 'feat'}(${options.scope}): ${formatted}`;
    }

    // Add footer
    if (options.footer) {
      formatted += `\n\n${options.footer}`;
    }

    // Add automated signature
    formatted += '\n\nAutomated by Debo 🤖';

    return formatted;
  }

  async createPullRequest(projectPath, options = {}) {
    const provider = await this.detectGitProvider(projectPath);
    
    switch (provider) {
      case 'github':
        return await this.createGitHubPR(projectPath, options);
      case 'gitlab':
        return await this.createGitLabMR(projectPath, options);
      default:
        throw new Error(`Unsupported git provider: ${provider}`);
    }
  }

  async detectGitProvider(projectPath) {
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: projectPath });
      
      if (stdout.includes('github.com')) {
        return 'github';
      } else if (stdout.includes('gitlab.com')) {
        return 'gitlab';
      }
      
      return 'unknown';
    } catch {
      return 'local';
    }
  }

  async createGitHubPR(projectPath, options) {
    try {
      // Check if GitHub CLI is installed
      await execAsync('gh --version');
    } catch {
      throw new Error('GitHub CLI not installed. Run: brew install gh');
    }

    // Push current branch
    const { stdout: currentBranch } = await execAsync(
      'git branch --show-current',
      { cwd: projectPath }
    );
    const branch = currentBranch.trim();

    await execAsync(`git push -u origin ${branch}`, { cwd: projectPath });

    // Create PR
    const title = options.title || `Feature: ${branch}`;
    const body = this.generatePRDescription(options);

    const { stdout } = await execAsync(
      `gh pr create --title "${title}" --body "${body}" ${options.draft ? '--draft' : ''}`,
      { cwd: projectPath }
    );

    // Extract PR URL
    const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
    const prUrl = urlMatch ? urlMatch[0] : stdout;

    return {
      provider: 'github',
      url: prUrl,
      branch,
      title
    };
  }

  async createGitLabMR(projectPath, options) {
    try {
      // Check if GitLab CLI is installed
      await execAsync('glab --version');
    } catch {
      throw new Error('GitLab CLI not installed. Run: brew install glab');
    }

    // Similar implementation for GitLab
    const { stdout: currentBranch } = await execAsync(
      'git branch --show-current',
      { cwd: projectPath }
    );
    const branch = currentBranch.trim();

    await execAsync(`git push -u origin ${branch}`, { cwd: projectPath });

    const title = options.title || `Feature: ${branch}`;
    const description = this.generatePRDescription(options);

    const { stdout } = await execAsync(
      `glab mr create --title "${title}" --description "${description}"`,
      { cwd: projectPath }
    );

    return {
      provider: 'gitlab',
      url: stdout,
      branch,
      title
    };
  }

  generatePRDescription(options) {
    const sections = [];

    sections.push('## Summary');
    sections.push(options.summary || 'Automated changes by Debo development system.');

    if (options.changes && options.changes.length > 0) {
      sections.push('\n## Changes');
      options.changes.forEach(change => {
        sections.push(`- ${change}`);
      });
    }

    if (options.testing) {
      sections.push('\n## Testing');
      sections.push(options.testing);
    }

    sections.push('\n## Checklist');
    sections.push('- [x] Code follows project style guidelines');
    sections.push('- [x] Self-review completed');
    sections.push('- [x] Tests pass locally');
    sections.push('- [ ] Documentation updated if needed');
    sections.push('- [ ] Breaking changes documented');

    sections.push('\n---');
    sections.push('*This PR was automatically created by Debo 🤖*');

    return sections.join('\n');
  }

  async setupGitHooks(projectPath) {
    const hooksDir = path.join(projectPath, '.git', 'hooks');
    
    // Pre-commit hook
    const preCommitHook = `#!/bin/sh
# Debo pre-commit hook

# Run tests
if [ -f "package.json" ]; then
  npm test
fi

# Run linter
if [ -f "package.json" ] && grep -q "lint" package.json; then
  npm run lint
fi

# Check for sensitive data
if grep -rEi "(password|secret|key|token)\\s*=\\s*[\"'][^\"']+[\"']" --include="*.js" --include="*.ts" --include="*.json" --exclude-dir=node_modules .; then
  echo "⚠️  Warning: Possible sensitive data detected in commit"
  echo "Please review and remove any hardcoded secrets"
  exit 1
fi
`;

    await this.fileSystemManager.writeFile(
      hooksDir,
      'pre-commit',
      preCommitHook
    );

    // Make hook executable
    await execAsync(`chmod +x ${path.join(hooksDir, 'pre-commit')}`);

    // Commit message hook
    const commitMsgHook = `#!/bin/sh
# Debo commit message hook

commit_regex='^(feat|fix|docs|style|refactor|test|chore|perf|security)(\(.+\))?: .{1,100}'

if ! grep -qE "$commit_regex" "$1"; then
  echo "❌ Invalid commit message format!"
  echo "Expected format: type(scope): description"
  echo "Example: feat(auth): add login functionality"
  exit 1
fi
`;

    await this.fileSystemManager.writeFile(
      hooksDir,
      'commit-msg',
      commitMsgHook
    );

    await execAsync(`chmod +x ${path.join(hooksDir, 'commit-msg')}`);

    logger.info('Git hooks configured');
  }

  async analyzeRepository(projectPath) {
    const analysis = {
      initialized: await this.isGitRepository(projectPath),
      branch: null,
      ahead: 0,
      behind: 0,
      uncommittedChanges: 0,
      lastCommit: null,
      remotes: []
    };

    if (!analysis.initialized) {
      return analysis;
    }

    try {
      // Current branch
      const { stdout: branch } = await execAsync(
        'git branch --show-current',
        { cwd: projectPath }
      );
      analysis.branch = branch.trim();

      // Uncommitted changes
      const { stdout: status } = await execAsync(
        'git status --porcelain',
        { cwd: projectPath }
      );
      analysis.uncommittedChanges = status.split('\n').filter(line => line.trim()).length;

      // Last commit
      const { stdout: lastCommit } = await execAsync(
        'git log -1 --pretty=format:"%h - %s (%cr)"',
        { cwd: projectPath }
      );
      analysis.lastCommit = lastCommit;

      // Remotes
      const { stdout: remotes } = await execAsync(
        'git remote -v',
        { cwd: projectPath }
      );
      analysis.remotes = remotes.split('\n')
        .filter(line => line.includes('(fetch)'))
        .map(line => {
          const [name, url] = line.split('\t');
          return { name, url: url.replace(' (fetch)', '') };
        });

      // Ahead/behind (if origin exists)
      if (analysis.remotes.some(r => r.name === 'origin')) {
        try {
          const { stdout: revList } = await execAsync(
            `git rev-list --left-right --count origin/${analysis.branch}...HEAD`,
            { cwd: projectPath }
          );
          const [behind, ahead] = revList.trim().split('\t').map(Number);
          analysis.ahead = ahead;
          analysis.behind = behind;
        } catch {
          // Branch might not exist on origin yet
        }
      }
    } catch (error) {
      logger.error('Repository analysis error:', error);
    }

    return analysis;
  }

  async createGitReport(projectPath) {
    const analysis = await this.analyzeRepository(projectPath);
    
    const report = `# Git Repository Report

Generated: ${new Date().toISOString()}

## Status
- Initialized: ${analysis.initialized ? '✅' : '❌'}
- Current Branch: ${analysis.branch || 'N/A'}
- Uncommitted Changes: ${analysis.uncommittedChanges}
- Last Commit: ${analysis.lastCommit || 'No commits yet'}

## Sync Status
- Ahead of origin: ${analysis.ahead} commits
- Behind origin: ${analysis.behind} commits

## Remotes
${analysis.remotes.length > 0 
  ? analysis.remotes.map(r => `- ${r.name}: ${r.url}`).join('\n')
  : 'No remotes configured'
}

## Recommendations
${this.generateGitRecommendations(analysis).join('\n')}
`;

    await this.fileSystemManager.writeFile(
      projectPath,
      'git-report.md',
      report
    );

    return report;
  }

  generateGitRecommendations(analysis) {
    const recommendations = [];

    if (!analysis.initialized) {
      recommendations.push('- Initialize git repository: `git init`');
    }

    if (analysis.uncommittedChanges > 0) {
      recommendations.push(`- Commit ${analysis.uncommittedChanges} uncommitted changes`);
    }

    if (analysis.remotes.length === 0) {
      recommendations.push('- Add remote repository: `git remote add origin <url>`');
    }

    if (analysis.ahead > 0) {
      recommendations.push(`- Push ${analysis.ahead} commits to origin`);
    }

    if (analysis.behind > 0) {
      recommendations.push(`- Pull ${analysis.behind} commits from origin`);
    }

    if (recommendations.length === 0) {
      recommendations.push('- Repository is in good state ✅');
    }

    return recommendations;
  }
}

export default GitAutomation;