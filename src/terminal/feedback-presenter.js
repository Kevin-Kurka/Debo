/**
 * Terminal Feedback Presenter for Debo
 * Presents code comments, TODOs, and development progress in user-friendly terminal format
 */

const chalk = require('chalk');
const boxen = require('boxen');
const Table = require('cli-table3');
const ora = require('ora');

class TerminalFeedbackPresenter {
  constructor() {
    this.activeSpinners = new Map();
    this.feedbackQueue = [];
    this.isPresenting = false;
  }

  async presentFileCreation(filePath, commentingResult, confidence) {
    console.log(chalk.cyan(`\n📄 Created: ${filePath}`));
    
    // Show confidence level
    const confidenceColor = confidence >= 90 ? chalk.green : confidence >= 70 ? chalk.yellow : chalk.red;
    console.log(`${chalk.blue('Confidence:')} ${confidenceColor(confidence + '%')}`);
    
    // Present file analysis
    await this.presentFileAnalysis(commentingResult.analysis);
    
    // Present TODO items
    if (commentingResult.todos.length > 0) {
      await this.presentTodoItems(filePath, commentingResult.todos);
    }
    
    // Show key features
    if (commentingResult.analysis.keyFeatures.length > 0) {
      await this.presentKeyFeatures(commentingResult.analysis.keyFeatures);
    }
  }

  async presentFileAnalysis(analysis) {
    const analysisBox = boxen(
      chalk.white(`Purpose: ${analysis.purpose}\n\n`) +
      chalk.blue(`Type: ${analysis.fileType}\n`) +
      chalk.yellow(`Complexity: ${analysis.complexity}\n`) +
      chalk.green(`Features: ${analysis.keyFeatures.length}\n`) +
      chalk.cyan(`Dependencies: ${analysis.dependencies.length}`),
      {
        padding: 1,
        margin: { left: 2 },
        borderStyle: 'round',
        borderColor: 'blue',
        title: '📋 File Analysis',
        titleAlignment: 'center'
      }
    );
    
    console.log(analysisBox);
  }

  async presentTodoItems(filePath, todos) {
    console.log(chalk.yellow('\n📝 TODO Items:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    todos.slice(0, 8).forEach((todo, index) => {
      const priority = this.assessTodoPriority(todo);
      const priorityIcon = this.getPriorityIcon(priority);
      const priorityColor = this.getPriorityColor(priority);
      
      console.log(`${priorityIcon} ${chalk.white(`${index + 1}.`)} ${priorityColor(todo)}`);
    });
    
    if (todos.length > 8) {
      console.log(chalk.gray(`   ... and ${todos.length - 8} more items`));
    }
    
    console.log('');
  }

  async presentKeyFeatures(features) {
    console.log(chalk.green('\n✨ Key Features:'));
    console.log(chalk.gray('─'.repeat(30)));
    
    features.slice(0, 5).forEach(feature => {
      console.log(`${chalk.green('•')} ${chalk.white(feature)}`);
    });
    
    console.log('');
  }

  async presentConfidenceEvaluation(taskId, evaluation) {
    const confidenceColor = evaluation.confidencePercentage >= 90 ? 'green' : 
                           evaluation.confidencePercentage >= 70 ? 'yellow' : 'red';
    
    console.log(chalk.blue(`\n🎯 Confidence Evaluation: ${taskId}`));
    console.log(chalk.gray('═'.repeat(60)));
    
    // Overall confidence
    console.log(`${chalk.white('Overall Confidence:')} ${chalk[confidenceColor](evaluation.confidencePercentage + '%')}`);
    
    // Criteria breakdown
    if (evaluation.criteriaScores) {
      console.log(chalk.white('\nCriteria Breakdown:'));
      
      const table = new Table({
        head: ['Criterion', 'Score', 'Status'],
        colWidths: [20, 10, 15],
        style: {
          head: ['cyan'],
          border: ['grey']
        }
      });

      Object.entries(evaluation.criteriaScores).forEach(([criterion, score]) => {
        const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
        const status = score >= 80 ? '✅ Good' : score >= 60 ? '⚠️ Fair' : '❌ Needs Work';
        
        table.push([
          chalk.white(criterion.replace(/_/g, ' ').toUpperCase()),
          scoreColor(score + '%'),
          status
        ]);
      });

      console.log(table.toString());
    }
    
    // Threshold status
    if (evaluation.meetsThreshold) {
      console.log(chalk.green('\n✅ Meets confidence threshold - approved for implementation'));
    } else {
      console.log(chalk.red('\n❌ Below confidence threshold - requires improvement'));
    }
  }

  async presentFeedbackLoop(feedback) {
    if (feedback.approved) {
      console.log(chalk.green('\n✅ Task Approved'));
      return;
    }

    console.log(chalk.yellow('\n🔄 Feedback Loop Activated'));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(`${chalk.red('Current Confidence:')} ${feedback.confidencePercentage}%`);
    console.log(`${chalk.blue('Required Threshold:')} ${feedback.threshold}%`);
    
    // Areas for improvement
    if (feedback.areasForImprovement.length > 0) {
      console.log(chalk.yellow('\n📊 Areas Needing Improvement:'));
      
      feedback.areasForImprovement.forEach(area => {
        const scoreColor = area.score >= 60 ? chalk.yellow : chalk.red;
        console.log(`  ${chalk.red('•')} ${chalk.white(area.criterion)}: ${scoreColor(area.score + '%')}`);
      });
    }
    
    // Improvement suggestions
    if (feedback.suggestions.length > 0) {
      console.log(chalk.cyan('\n💡 Improvement Suggestions:'));
      
      feedback.suggestions.forEach((suggestion, index) => {
        console.log(`\n${chalk.cyan(`${index + 1}.`)} ${chalk.white(suggestion.criterion.toUpperCase())}`);
        console.log(`   ${chalk.gray('Issue:')} ${suggestion.issue}`);
        console.log(`   ${chalk.green('Solution:')} ${suggestion.solution}`);
        if (suggestion.bestPractice) {
          console.log(`   ${chalk.blue('Best Practice:')} ${suggestion.bestPractice}`);
        }
      });
    }
    
    // Next steps
    if (feedback.nextSteps) {
      const actionColor = feedback.nextSteps.priority === 'high' ? chalk.red : 
                         feedback.nextSteps.priority === 'medium' ? chalk.yellow : chalk.green;
      
      console.log(chalk.white('\n🎯 Next Steps:'));
      console.log(`   ${actionColor('Action:')} ${feedback.nextSteps.action.replace(/_/g, ' ')}`);
      console.log(`   ${chalk.gray('Reason:')} ${feedback.nextSteps.reason}`);
      console.log(`   ${chalk.blue('Priority:')} ${actionColor(feedback.nextSteps.priority.toUpperCase())}`);
    }
  }

  async presentErrorTracking(errorId, errorInfo, solutionProposal) {
    console.log(chalk.red(`\n🚨 Error Tracked: ${errorId}`));
    console.log(chalk.gray('═'.repeat(60)));
    
    // Error details
    console.log(`${chalk.white('Type:')} ${chalk.yellow(errorInfo.errorType)}`);
    console.log(`${chalk.white('Severity:')} ${this.getSeverityDisplay(errorInfo.severity)}`);
    console.log(`${chalk.white('Message:')} ${chalk.gray(errorInfo.errorMessage)}`);
    
    if (errorInfo.occurrenceCount > 1) {
      console.log(`${chalk.white('Occurrences:')} ${chalk.red(errorInfo.occurrenceCount)} times`);
    }
    
    // Solution proposal status
    if (solutionProposal) {
      console.log(chalk.blue('\n🔧 Solution Proposal:'));
      
      if (solutionProposal.allowed) {
        console.log(chalk.green('✅ Solution approved for implementation'));
      } else {
        console.log(chalk.red('❌ Solution blocked:'));
        console.log(`   ${chalk.gray('Reason:')} ${solutionProposal.reason}`);
        
        if (solutionProposal.recommendation) {
          console.log(`   ${chalk.cyan('Recommendation:')} ${solutionProposal.recommendation.action}`);
          console.log(`   ${chalk.gray('Details:')} ${solutionProposal.recommendation.reason}`);
        }
        
        if (solutionProposal.previousAttempts) {
          console.log(`   ${chalk.yellow('Previous Attempts:')} ${solutionProposal.previousAttempts.length}`);
        }
      }
    }
  }

  async presentSolutionResult(solutionId, result, feedback) {
    const resultColor = result === 'success' ? chalk.green : 
                       result === 'partial' ? chalk.yellow : chalk.red;
    const resultIcon = result === 'success' ? '✅' : 
                      result === 'partial' ? '⚠️' : '❌';
    
    console.log(`\n${resultIcon} ${chalk.blue('Solution Result:')} ${resultColor(result.toUpperCase())}`);
    
    if (feedback.performance) {
      console.log(`${chalk.white('Performance Impact:')} ${feedback.performance}`);
    }
    
    if (feedback.sideEffects) {
      console.log(`${chalk.yellow('Side Effects:')} ${feedback.sideEffects}`);
    }
    
    if (feedback.testResults) {
      console.log(`${chalk.green('Tests:')} ${feedback.testResults}`);
    }
  }

  async presentTaskProgress(task, progress) {
    const spinner = ora({
      text: `${task.agentType}: ${task.action}`,
      color: 'cyan'
    });
    
    this.activeSpinners.set(task.id, spinner);
    spinner.start();
    
    // Update spinner with progress
    setInterval(() => {
      if (progress.completed) {
        spinner.succeed(`${task.agentType}: ${task.action} completed`);
        this.activeSpinners.delete(task.id);
      } else {
        spinner.text = `${task.agentType}: ${task.action} (${progress.percentage}%)`;
      }
    }, 1000);
  }

  async presentProjectSummary(projectId, summary) {
    console.log(chalk.cyan(`\n📊 Project Summary: ${projectId}`));
    console.log(chalk.gray('═'.repeat(60)));
    
    const summaryBox = boxen(
      chalk.white(`Status: ${summary.status}\n`) +
      chalk.blue(`Progress: ${this.createProgressBar(summary.progress)}${summary.progress}%\n`) +
      chalk.green(`Files Created: ${summary.filesCreated}\n`) +
      chalk.yellow(`Active Agents: ${summary.activeAgents}\n`) +
      chalk.cyan(`Quality Score: ${summary.qualityScore}/100\n`) +
      chalk.white(`Duration: ${summary.duration}`),
      {
        padding: 1,
        margin: { left: 2 },
        borderStyle: 'double',
        borderColor: 'cyan',
        title: '📈 Progress',
        titleAlignment: 'center'
      }
    );
    
    console.log(summaryBox);
    
    // Recent activity
    if (summary.recentActivity && summary.recentActivity.length > 0) {
      console.log(chalk.yellow('\n📝 Recent Activity:'));
      summary.recentActivity.slice(-5).forEach(activity => {
        const timeAgo = this.getTimeAgo(activity.timestamp);
        console.log(`${chalk.gray(timeAgo)} ${this.getActivityIcon(activity.type)} ${activity.description}`);
      });
    }
    
    // Active TODOs across project
    if (summary.activeTodos && summary.activeTodos.length > 0) {
      console.log(chalk.blue('\n📋 Active TODOs:'));
      summary.activeTodos.slice(0, 5).forEach((todo, index) => {
        console.log(`${chalk.blue(`${index + 1}.`)} ${todo.description} ${chalk.gray(`(${todo.file})`)}`);
      });
    }
  }

  // Utility methods
  assessTodoPriority(todo) {
    const lowPriorityWords = ['documentation', 'comment', 'cleanup', 'refactor'];
    const mediumPriorityWords = ['test', 'validation', 'optimization', 'performance'];
    const highPriorityWords = ['security', 'error', 'bug', 'critical', 'fix', 'implement'];
    
    const todoLower = todo.toLowerCase();
    
    if (highPriorityWords.some(word => todoLower.includes(word))) return 'high';
    if (mediumPriorityWords.some(word => todoLower.includes(word))) return 'medium';
    if (lowPriorityWords.some(word => todoLower.includes(word))) return 'low';
    
    return 'medium'; // Default
  }

  getPriorityIcon(priority) {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚫';
    }
  }

  getPriorityColor(priority) {
    switch (priority) {
      case 'high': return chalk.red;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.green;
      default: return chalk.white;
    }
  }

  getSeverityDisplay(severity) {
    switch (severity) {
      case 'critical': return chalk.red.bold('🔥 CRITICAL');
      case 'high': return chalk.red('🔴 HIGH');
      case 'medium': return chalk.yellow('🟡 MEDIUM');
      case 'low': return chalk.green('🟢 LOW');
      default: return chalk.gray('⚫ UNKNOWN');
    }
  }

  createProgressBar(percentage) {
    const width = 20;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + ' ';
  }

  getActivityIcon(type) {
    const icons = {
      file_created: '📄',
      file_modified: '✏️',
      task_started: '🚀',
      task_completed: '✅',
      error_found: '🚨',
      error_fixed: '🔧',
      test_passed: '🧪',
      deployment: '🚀',
      code_review: '👀'
    };
    
    return icons[type] || '📝';
  }

  getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return time.toLocaleDateString();
  }

  // Queue management for concurrent feedback
  queueFeedback(feedbackType, data) {
    this.feedbackQueue.push({ type: feedbackType, data, timestamp: Date.now() });
    
    if (!this.isPresenting) {
      this.processFeedbackQueue();
    }
  }

  async processFeedbackQueue() {
    this.isPresenting = true;
    
    while (this.feedbackQueue.length > 0) {
      const feedback = this.feedbackQueue.shift();
      
      try {
        switch (feedback.type) {
          case 'file_creation':
            await this.presentFileCreation(feedback.data.filePath, feedback.data.result, feedback.data.confidence);
            break;
          case 'confidence_evaluation':
            await this.presentConfidenceEvaluation(feedback.data.taskId, feedback.data.evaluation);
            break;
          case 'feedback_loop':
            await this.presentFeedbackLoop(feedback.data);
            break;
          case 'error_tracking':
            await this.presentErrorTracking(feedback.data.errorId, feedback.data.error, feedback.data.proposal);
            break;
          case 'solution_result':
            await this.presentSolutionResult(feedback.data.solutionId, feedback.data.result, feedback.data.feedback);
            break;
          case 'task_progress':
            await this.presentTaskProgress(feedback.data.task, feedback.data.progress);
            break;
          case 'project_summary':
            await this.presentProjectSummary(feedback.data.projectId, feedback.data.summary);
            break;
        }
        
        // Small delay between feedback items
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(chalk.red('Error presenting feedback:'), error);
      }
    }
    
    this.isPresenting = false;
  }

  // Public API methods
  async showFileCreation(filePath, commentingResult, confidence) {
    this.queueFeedback('file_creation', { filePath, result: commentingResult, confidence });
  }

  async showConfidenceEvaluation(taskId, evaluation) {
    this.queueFeedback('confidence_evaluation', { taskId, evaluation });
  }

  async showFeedbackLoop(feedback) {
    this.queueFeedback('feedback_loop', feedback);
  }

  async showErrorTracking(errorId, errorInfo, solutionProposal) {
    this.queueFeedback('error_tracking', { errorId, error: errorInfo, proposal: solutionProposal });
  }

  async showSolutionResult(solutionId, result, feedback) {
    this.queueFeedback('solution_result', { solutionId, result, feedback });
  }

  async showTaskProgress(task, progress) {
    this.queueFeedback('task_progress', { task, progress });
  }

  async showProjectSummary(projectId, summary) {
    this.queueFeedback('project_summary', { projectId, summary });
  }

  stopAllSpinners() {
    for (const [taskId, spinner] of this.activeSpinners) {
      spinner.stop();
    }
    this.activeSpinners.clear();
  }
}

module.exports = { TerminalFeedbackPresenter };