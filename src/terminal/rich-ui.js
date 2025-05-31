/**
 * Rich Terminal UI for Debo
 * Provides Claude Code-like terminal experience with project summaries, task lists, and diff views
 */

const chalk = require('chalk');
const boxen = require('boxen');
const Table = require('cli-table3');
const diff = require('diff');
const ora = require('ora');
const inquirer = require('inquirer');
const blessed = require('blessed');

class TerminalUI {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.screen = null;
    this.activeSpinners = new Map();
  }

  async init() {
    // Initialize blessed screen for rich UI when needed
    this.setupScreen();
  }

  setupScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Debo - Autonomous Development System'
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      return process.exit(0);
    });
  }

  async showProjectCreation(projectId) {
    console.log(chalk.blue('\n🚀 Project Creation Pipeline Started\n'));
    
    // Show agent assignment
    const agents = [
      { name: 'CTO', task: 'Strategic analysis and architecture planning', status: 'running' },
      { name: 'Solution Architect', task: 'System design and technical decisions', status: 'queued' },
      { name: 'Product Manager', task: 'Feature breakdown and requirements', status: 'queued' },
      { name: 'Engineering Manager', task: 'Sprint planning and coordination', status: 'queued' }
    ];

    await this.showAgentActivity(agents);
    
    // Monitor progress in real-time
    await this.monitorProjectProgress(projectId);
  }

  async showFeatureDevelopment(projectId, taskId) {
    console.log(chalk.blue(`\n⚡ Feature Development Started for ${projectId}\n`));
    
    // Show development pipeline
    const pipeline = [
      { stage: 'Requirements Analysis', agent: 'Business Analyst', status: 'running' },
      { stage: 'Technical Design', agent: 'Solution Architect', status: 'queued' },
      { stage: 'Backend Implementation', agent: 'Backend Developer', status: 'queued' },
      { stage: 'Frontend Implementation', agent: 'Frontend Developer', status: 'queued' },
      { stage: 'Testing', agent: 'QA Engineer', status: 'queued' },
      { stage: 'Quality Review', agent: 'Code Reviewer', status: 'queued' }
    ];

    await this.showDevelopmentPipeline(pipeline);
    
    // Monitor task progress
    await this.monitorTaskProgress(taskId);
  }

  async showProjectStatus(projectId, status) {
    console.log(chalk.cyan(`\n📊 Project Status: ${projectId}\n`));
    
    // Create status box
    const statusBox = boxen(
      this.formatProjectStatusContent(status),
      {
        padding: 1,
        margin: { left: 2 },
        borderStyle: 'round',
        borderColor: 'cyan',
        title: `📋 ${projectId}`,
        titleAlignment: 'center'
      }
    );
    
    console.log(statusBox);
    
    // Show recent activity timeline
    await this.showActivityTimeline(status.recentActivity);
    
    // Show active tasks table
    if (status.activeTasks && status.activeTasks.length > 0) {
      await this.showActiveTasksTable(status.activeTasks);
    }
    
    // Show file changes if any
    if (status.fileChanges && status.fileChanges.length > 0) {
      await this.showFileChanges(status.fileChanges);
    }
  }

  async showAllProjects(projects) {
    if (projects.length === 0) {
      console.log(chalk.yellow('📝 No projects found. Create one with: "Create a new project..."'));
      return;
    }

    console.log(chalk.cyan('\n📋 All Projects\n'));

    const table = new Table({
      head: ['Project', 'Progress', 'Status', 'Active Agents', 'Last Updated'],
      colWidths: [20, 15, 15, 15, 20],
      style: {
        head: ['cyan'],
        border: ['grey']
      }
    });

    projects.forEach(project => {
      const progressBar = this.createProgressBar(project.progress || 0);
      const statusColor = this.getStatusColor(project.status);
      
      table.push([
        project.name,
        progressBar,
        statusColor(project.status || 'unknown'),
        project.activeAgents || 0,
        project.lastUpdated || 'Unknown'
      ]);
    });

    console.log(table.toString());
  }

  async showActiveTasks(tasks) {
    if (tasks.length === 0) {
      console.log(chalk.yellow('✅ No active tasks. All agents are idle.'));
      return;
    }

    console.log(chalk.cyan('\n⚡ Active Tasks\n'));

    const table = new Table({
      head: ['Agent', 'Task', 'Project', 'Status', 'Duration'],
      colWidths: [20, 30, 20, 15, 12],
      style: {
        head: ['cyan'],
        border: ['grey']
      }
    });

    tasks.forEach(task => {
      const statusColor = this.getStatusColor(task.status);
      const duration = this.calculateDuration(task.startedAt);
      
      table.push([
        chalk.blue(task.agentType),
        task.action || task.description,
        task.projectId,
        statusColor(task.status),
        duration
      ]);
    });

    console.log(table.toString());
  }

  async showModels(models) {
    console.log(chalk.cyan('\n🤖 Available Models\n'));

    const table = new Table({
      head: ['Model', 'Type', 'Size', 'Performance', 'Status'],
      colWidths: [25, 15, 12, 15, 12],
      style: {
        head: ['cyan'],
        border: ['grey']
      }
    });

    models.forEach(model => {
      const typeColor = model.type === 'thinking' ? chalk.blue : chalk.green;
      const statusColor = model.status === 'active' ? chalk.green : chalk.yellow;
      
      table.push([
        model.name,
        typeColor(model.type),
        model.size || 'Unknown',
        this.formatPerformance(model.performance),
        statusColor(model.status)
      ]);
    });

    console.log(table.toString());
  }

  async showAgentActivity(agents) {
    const table = new Table({
      head: ['Agent', 'Current Task', 'Status'],
      colWidths: [20, 40, 12],
      style: {
        head: ['yellow'],
        border: ['grey']
      }
    });

    agents.forEach(agent => {
      const statusIcon = agent.status === 'running' ? '🔄' : 
                        agent.status === 'completed' ? '✅' : '⏳';
      const statusColor = this.getStatusColor(agent.status);
      
      table.push([
        chalk.blue(agent.name),
        agent.task,
        statusIcon + ' ' + statusColor(agent.status)
      ]);
    });

    console.log(table.toString());
  }

  async showDevelopmentPipeline(pipeline) {
    console.log(chalk.yellow('\n🔄 Development Pipeline\n'));

    pipeline.forEach((stage, index) => {
      const isActive = stage.status === 'running';
      const isCompleted = stage.status === 'completed';
      const icon = isCompleted ? '✅' : isActive ? '🔄' : '⏳';
      const color = isCompleted ? chalk.green : isActive ? chalk.yellow : chalk.grey;
      
      console.log(`${' '.repeat(index * 2)}${icon} ${color(stage.stage)} (${stage.agent})`);
    });

    console.log('');
  }

  async showActivityTimeline(activities) {
    if (!activities || activities.length === 0) return;

    console.log(chalk.yellow('\n📝 Recent Activity\n'));

    activities.slice(-10).forEach((activity, index) => {
      const time = new Date(activity.timestamp || Date.now()).toLocaleTimeString();
      const icon = this.getActivityIcon(activity.type);
      
      console.log(`${chalk.grey(time)} ${icon} ${activity.description}`);
    });

    console.log('');
  }

  async showActiveTasksTable(tasks) {
    console.log(chalk.yellow('\n⚡ Active Tasks\n'));
    
    const table = new Table({
      head: ['Agent', 'Task', 'Progress', 'ETA'],
      colWidths: [20, 30, 15, 12],
      style: {
        head: ['yellow'],
        border: ['grey']
      }
    });

    tasks.forEach(task => {
      const progressBar = this.createProgressBar(task.progress || 0);
      
      table.push([
        chalk.blue(task.agent),
        task.description,
        progressBar,
        task.eta || 'Unknown'
      ]);
    });

    console.log(table.toString());
  }

  async showFileChanges(changes) {
    console.log(chalk.yellow('\n📝 File Changes\n'));

    for (const change of changes.slice(0, 5)) { // Show max 5 files
      await this.showFileDiff(change);
    }

    if (changes.length > 5) {
      console.log(chalk.grey(`... and ${changes.length - 5} more files\n`));
    }
  }

  async showFileDiff(change) {
    console.log(chalk.cyan(`\n📄 ${change.file}`));
    console.log(chalk.grey('─'.repeat(60)));

    if (change.type === 'new') {
      console.log(chalk.green('+ New file created'));
      if (change.preview) {
        console.log(chalk.green(change.preview.split('\n').slice(0, 5).map(line => `+ ${line}`).join('\n')));
      }
    } else if (change.type === 'modified') {
      if (change.diff) {
        const diffResult = diff.diffLines(change.old || '', change.new || '');
        
        diffResult.forEach(part => {
          const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.grey;
          const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
          
          part.value.split('\n').slice(0, -1).forEach(line => {
            console.log(color(prefix + line));
          });
        });
      }
    } else if (change.type === 'deleted') {
      console.log(chalk.red('- File deleted'));
    }

    console.log('');
  }

  async monitorProjectProgress(projectId) {
    // Create a real-time progress monitor
    const spinner = ora('Monitoring project progress...').start();
    
    const interval = setInterval(async () => {
      try {
        const progress = await this.taskManager.getProjectProgress(projectId);
        
        if (progress.completed) {
          spinner.succeed(`Project ${projectId} creation completed!`);
          clearInterval(interval);
          await this.showProjectSummary(projectId, progress);
        } else {
          spinner.text = `Progress: ${progress.percentage}% - ${progress.currentPhase}`;
        }
      } catch (error) {
        spinner.fail('Error monitoring progress');
        clearInterval(interval);
      }
    }, 2000);

    // Auto-stop after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (spinner.isSpinning) {
        spinner.stop();
      }
    }, 300000);
  }

  async monitorTaskProgress(taskId) {
    const spinner = ora('Monitoring task progress...').start();
    
    const interval = setInterval(async () => {
      try {
        const task = await this.taskManager.getTask(taskId);
        
        if (task.status === 'completed') {
          spinner.succeed('Task completed successfully!');
          clearInterval(interval);
          await this.showTaskResults(task);
        } else if (task.status === 'failed') {
          spinner.fail('Task failed');
          clearInterval(interval);
          console.log(chalk.red(`Error: ${task.error}`));
        } else {
          spinner.text = `${task.agentType}: ${task.action} (${task.status})`;
        }
      } catch (error) {
        spinner.fail('Error monitoring task');
        clearInterval(interval);
      }
    }, 3000);

    // Auto-stop after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (spinner.isSpinning) {
        spinner.stop();
      }
    }, 300000);
  }

  async showProjectSummary(projectId, progress) {
    const summary = boxen(
      chalk.white(`Project: ${projectId}\n`) +
      chalk.green(`✅ Status: ${progress.status}\n`) +
      chalk.blue(`📊 Completion: ${progress.percentage}%\n`) +
      chalk.yellow(`👥 Agents Involved: ${progress.agentsUsed}\n`) +
      chalk.cyan(`⏱️ Duration: ${progress.duration}\n`) +
      chalk.white(`📝 Files Created: ${progress.filesCreated}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'green',
        title: '🎉 Project Summary',
        titleAlignment: 'center'
      }
    );

    console.log(summary);
  }

  async showTaskResults(task) {
    if (task.results && task.results.filesModified) {
      console.log(chalk.green('\n✅ Task Results:\n'));
      
      task.results.filesModified.forEach(file => {
        console.log(chalk.blue(`📄 ${file.path}`));
        console.log(chalk.grey(`   ${file.description}`));
      });
    }
  }

  // Utility methods
  formatProjectStatusContent(status) {
    const progressBar = this.createProgressBar(status.completionPercentage || 0);
    
    return chalk.white('Progress: ') + progressBar + chalk.white(` ${status.completionPercentage || 0}%\n`) +
           chalk.white('Phase: ') + chalk.yellow(status.currentPhase || 'Unknown') + '\n' +
           chalk.white('Active Agents: ') + chalk.blue(status.activeAgents || 0) + '\n' +
           chalk.white('Quality Score: ') + this.formatQualityScore(status.qualityScore || 0) + '\n' +
           chalk.white('Files Modified: ') + chalk.cyan(status.filesModified || 0) + '\n' +
           chalk.white('Tests: ') + chalk.green(`${status.testsPass || 0}/${status.testsTotal || 0} passing`);
  }

  createProgressBar(percentage) {
    const width = 20;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    return chalk.green('█'.repeat(filled)) + chalk.grey('░'.repeat(empty));
  }

  getStatusColor(status) {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return chalk.green;
      case 'running':
      case 'in_progress':
        return chalk.yellow;
      case 'failed':
      case 'error':
        return chalk.red;
      case 'pending':
      case 'queued':
        return chalk.blue;
      default:
        return chalk.grey;
    }
  }

  getActivityIcon(type) {
    switch (type) {
      case 'task_start': return '🚀';
      case 'task_complete': return '✅';
      case 'task_failed': return '❌';
      case 'file_created': return '📄';
      case 'file_modified': return '✏️';
      case 'test_passed': return '🧪';
      case 'deployment': return '🚀';
      default: return '📝';
    }
  }

  formatPerformance(performance) {
    if (!performance) return chalk.grey('Unknown');
    
    const score = performance.score || 0;
    if (score >= 90) return chalk.green('Excellent');
    if (score >= 80) return chalk.yellow('Good');
    if (score >= 70) return chalk.orange('Fair');
    return chalk.red('Poor');
  }

  formatQualityScore(score) {
    if (score >= 90) return chalk.green(score);
    if (score >= 80) return chalk.yellow(score);
    if (score >= 70) return chalk.orange(score);
    return chalk.red(score);
  }

  calculateDuration(startTime) {
    if (!startTime) return 'Unknown';
    
    const start = new Date(startTime);
    const now = new Date();
    const diff = now - start;
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
}

module.exports = { TerminalUI };