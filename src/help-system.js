import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';

export class HelpSystem {
  constructor() {
    this.commands = this.initializeCommands();
    this.examples = this.initializeExamples();
    this.workflows = this.initializeWorkflows();
  }

  initializeCommands() {
    return {
      // Core Commands
      create: {
        name: 'create',
        description: 'Create a new project with intelligent scaffolding',
        usage: 'debo create <project-name> "<requirements>" [stack]',
        args: [
          { name: 'project-name', required: true, description: 'Name of your project' },
          { name: 'requirements', required: true, description: 'Natural language description of what you want to build' },
          { name: 'stack', required: false, description: 'Technology stack (react, next, vue, express, fastapi, fullstack)' }
        ],
        examples: [
          'debo create todo-app "Build a task management app with user auth" react',
          'debo create api-service "REST API for inventory management" express'
        ],
        category: 'project'
      },
      
      develop: {
        name: 'develop',
        description: 'Add new features to existing project',
        usage: 'debo develop <project-name> "<feature-description>"',
        args: [
          { name: 'project-name', required: true, description: 'Name of existing project' },
          { name: 'feature-description', required: true, description: 'What feature to add' }
        ],
        examples: [
          'debo develop todo-app "Add drag and drop to reorder tasks"',
          'debo develop api-service "Add pagination to all endpoints"'
        ],
        category: 'development'
      },
      
      status: {
        name: 'status',
        description: 'Check project development status',
        usage: 'debo status <project-name>',
        args: [
          { name: 'project-name', required: true, description: 'Project to check' }
        ],
        examples: [
          'debo status todo-app'
        ],
        category: 'monitoring'
      },
      
      deploy: {
        name: 'deploy',
        description: 'Deploy project to cloud provider',
        usage: 'debo deploy <project-name> <environment> [provider]',
        args: [
          { name: 'project-name', required: true, description: 'Project to deploy' },
          { name: 'environment', required: true, description: 'Target environment (production, staging, development)' },
          { name: 'provider', required: false, description: 'Deployment provider (vercel, netlify, heroku, aws, docker)' }
        ],
        examples: [
          'debo deploy todo-app production vercel',
          'debo deploy api-service staging docker'
        ],
        category: 'deployment'
      },
      
      maintain: {
        name: 'maintain',
        description: 'Run maintenance tasks on project',
        usage: 'debo maintain <project-name> "<tasks>"',
        args: [
          { name: 'project-name', required: true, description: 'Project to maintain' },
          { name: 'tasks', required: true, description: 'Comma-separated maintenance tasks' }
        ],
        examples: [
          'debo maintain todo-app "update dependencies, fix security vulnerabilities"',
          'debo maintain api-service "optimize database queries, add indexes"'
        ],
        category: 'maintenance'
      },
      
      analyze: {
        name: 'analyze',
        description: 'Analyze project quality and performance',
        usage: 'debo analyze <project-name>',
        args: [
          { name: 'project-name', required: true, description: 'Project to analyze' }
        ],
        examples: [
          'debo analyze todo-app'
        ],
        category: 'quality'
      },
      
      // Utility Commands
      list: {
        name: 'list',
        description: 'List all projects',
        usage: 'debo list',
        args: [],
        examples: ['debo list'],
        category: 'utility'
      },
      
      tasks: {
        name: 'tasks',
        description: 'View active development tasks',
        usage: 'debo tasks [project-name]',
        args: [
          { name: 'project-name', required: false, description: 'Filter by project' }
        ],
        examples: [
          'debo tasks',
          'debo tasks todo-app'
        ],
        category: 'monitoring'
      },
      
      logs: {
        name: 'logs',
        description: 'View development logs',
        usage: 'debo logs [project-name] [lines]',
        args: [
          { name: 'project-name', required: false, description: 'Filter by project' },
          { name: 'lines', required: false, description: 'Number of lines to show' }
        ],
        examples: [
          'debo logs',
          'debo logs todo-app 100'
        ],
        category: 'monitoring'
      },
      
      agents: {
        name: 'agents',
        description: 'View agent activity and workload',
        usage: 'debo agents',
        args: [],
        examples: ['debo agents'],
        category: 'monitoring'
      },
      
      monitor: {
        name: 'monitor',
        description: 'Open real-time monitoring dashboard',
        usage: 'debo monitor [project-name]',
        args: [
          { name: 'project-name', required: false, description: 'Project to monitor' }
        ],
        examples: [
          'debo monitor',
          'debo monitor todo-app'
        ],
        category: 'monitoring'
      },
      
      help: {
        name: 'help',
        description: 'Show help information',
        usage: 'debo help [command]',
        args: [
          { name: 'command', required: false, description: 'Get detailed help for specific command' }
        ],
        examples: [
          'debo help',
          'debo help create'
        ],
        category: 'utility'
      }
    };
  }

  initializeExamples() {
    return {
      'Quick Start': [
        {
          title: 'Create a React Todo App',
          commands: [
            'debo create my-todo "Todo app with categories and due dates" react',
            'debo develop my-todo "Add user authentication with JWT"',
            'debo develop my-todo "Add real-time collaboration"',
            'debo deploy my-todo production vercel'
          ]
        },
        {
          title: 'Build an API Service',
          commands: [
            'debo create user-api "RESTful API for user management" express',
            'debo develop user-api "Add email verification"',
            'debo develop user-api "Add role-based permissions"',
            'debo analyze user-api'
          ]
        }
      ],
      'Common Workflows': [
        {
          title: 'Full-Stack Application',
          commands: [
            'debo create ecommerce "E-commerce platform with cart and payments" fullstack',
            'debo develop ecommerce "Add product search with filters"',
            'debo develop ecommerce "Integrate Stripe payments"',
            'debo maintain ecommerce "optimize performance, update dependencies"'
          ]
        }
      ]
    };
  }

  initializeWorkflows() {
    return {
      'development': {
        title: 'Development Workflow',
        steps: [
          '1. Create project: debo create <name> "<requirements>"',
          '2. Monitor progress: debo monitor <name>',
          '3. Add features: debo develop <name> "<feature>"',
          '4. Check quality: debo analyze <name>',
          '5. Deploy: debo deploy <name> production'
        ]
      },
      'maintenance': {
        title: 'Maintenance Workflow',
        steps: [
          '1. Check status: debo status <project>',
          '2. Analyze issues: debo analyze <project>',
          '3. Run maintenance: debo maintain <project> "<tasks>"',
          '4. Verify fixes: debo analyze <project>'
        ]
      }
    };
  }

  showGeneralHelp() {
    console.clear();
    
    // Show banner
    console.log(chalk.cyan(figlet.textSync('DEBO', {
      font: 'Standard',
      horizontalLayout: 'default'
    })));
    
    console.log(chalk.gray('Autonomous Development System v2.0.0\n'));
    
    // Overview
    const overview = boxen(
      chalk.white('Debo is an AI-powered development system that automates the entire software development lifecycle.\n\n') +
      chalk.gray('• Natural language project creation\n') +
      chalk.gray('• Automated code generation\n') +
      chalk.gray('• Intelligent testing and quality assurance\n') +
      chalk.gray('• One-command deployment\n'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: '📦 Overview',
        titleAlignment: 'center'
      }
    );
    console.log(overview);
    
    // Commands by category
    const categories = {
      project: { title: '🚀 Project Management', commands: [] },
      development: { title: '💻 Development', commands: [] },
      deployment: { title: '🌐 Deployment', commands: [] },
      monitoring: { title: '📊 Monitoring', commands: [] },
      maintenance: { title: '🔧 Maintenance', commands: [] },
      quality: { title: '✅ Quality', commands: [] },
      utility: { title: '🛠️ Utilities', commands: [] }
    };
    
    // Group commands by category
    Object.values(this.commands).forEach(cmd => {
      if (categories[cmd.category]) {
        categories[cmd.category].commands.push(cmd);
      }
    });
    
    // Display each category
    Object.values(categories).forEach(category => {
      if (category.commands.length > 0) {
        console.log(chalk.yellow(`\n${category.title}`));
        category.commands.forEach(cmd => {
          console.log(
            chalk.green(`  ${cmd.name.padEnd(12)}`),
            chalk.white(cmd.description)
          );
        });
      }
    });
    
    // Quick start
    console.log(chalk.yellow('\n🎯 Quick Start'));
    console.log(chalk.gray('  1. Create a project:  ') + chalk.white('debo create my-app "Description of your app"'));
    console.log(chalk.gray('  2. Monitor progress:  ') + chalk.white('debo monitor my-app'));
    console.log(chalk.gray('  3. Deploy when ready: ') + chalk.white('debo deploy my-app production'));
    
    // Footer
    console.log(chalk.gray('\nFor detailed help on any command, run: ') + chalk.white('debo help <command>'));
    console.log(chalk.gray('Real-time monitoring available at: ') + chalk.white('http://localhost:3001'));
    console.log(chalk.gray('Documentation: ') + chalk.white('https://github.com/Kevin-Kurka/Debo\n'));
  }

  showCommandHelp(commandName) {
    const cmd = this.commands[commandName];
    
    if (!cmd) {
      console.log(chalk.red(`Unknown command: ${commandName}`));
      console.log(chalk.gray('Run "debo help" to see all available commands'));
      return;
    }
    
    console.clear();
    
    // Command header
    console.log(chalk.cyan.bold(`\n${cmd.name.toUpperCase()}`));
    console.log(chalk.white(cmd.description));
    console.log(chalk.gray('─'.repeat(50)));
    
    // Usage
    console.log(chalk.yellow('\nUsage:'));
    console.log(`  ${chalk.white(cmd.usage)}`);
    
    // Arguments
    if (cmd.args.length > 0) {
      console.log(chalk.yellow('\nArguments:'));
      cmd.args.forEach(arg => {
        const required = arg.required ? chalk.red('*') : chalk.gray('(optional)');
        console.log(`  ${chalk.green(arg.name.padEnd(20))} ${required} ${chalk.gray(arg.description)}`);
      });
    }
    
    // Examples
    if (cmd.examples.length > 0) {
      console.log(chalk.yellow('\nExamples:'));
      cmd.examples.forEach(example => {
        console.log(`  ${chalk.white(example)}`);
      });
    }
    
    // Related commands
    const related = Object.values(this.commands)
      .filter(c => c.category === cmd.category && c.name !== cmd.name)
      .slice(0, 3);
    
    if (related.length > 0) {
      console.log(chalk.yellow('\nRelated Commands:'));
      related.forEach(rel => {
        console.log(`  ${chalk.green(rel.name.padEnd(12))} ${chalk.gray(rel.description)}`);
      });
    }
    
    console.log();
  }

  showExamples() {
    console.clear();
    console.log(chalk.cyan.bold('\nDEBO EXAMPLES'));
    console.log(chalk.gray('─'.repeat(50)));
    
    Object.entries(this.examples).forEach(([category, examples]) => {
      console.log(chalk.yellow(`\n${category}:`));
      
      examples.forEach(example => {
        console.log(chalk.white(`\n  ${example.title}`));
        example.commands.forEach((cmd, index) => {
          console.log(chalk.gray(`    ${index + 1}. `) + chalk.green(cmd));
        });
      });
    });
    
    console.log();
  }

  showWorkflows() {
    console.clear();
    console.log(chalk.cyan.bold('\nDEBO WORKFLOWS'));
    console.log(chalk.gray('─'.repeat(50)));
    
    Object.values(this.workflows).forEach(workflow => {
      console.log(chalk.yellow(`\n${workflow.title}:`));
      workflow.steps.forEach(step => {
        console.log(chalk.white(`  ${step}`));
      });
    });
    
    console.log();
  }

  showInteractiveHelp() {
    // This would launch an interactive help browser
    // For now, show general help
    this.showGeneralHelp();
  }

  formatCommandUsage(command) {
    const cmd = this.commands[command];
    if (!cmd) return null;
    
    return {
      usage: cmd.usage,
      description: cmd.description,
      examples: cmd.examples
    };
  }

  getCommandSuggestions(partial) {
    return Object.keys(this.commands)
      .filter(cmd => cmd.startsWith(partial))
      .slice(0, 5);
  }

  validateCommand(commandName, args) {
    const cmd = this.commands[commandName];
    if (!cmd) {
      return { valid: false, error: `Unknown command: ${commandName}` };
    }
    
    const requiredArgs = cmd.args.filter(arg => arg.required);
    if (args.length < requiredArgs.length) {
      return {
        valid: false,
        error: `Missing required arguments. Usage: ${cmd.usage}`
      };
    }
    
    return { valid: true };
  }
}

export default HelpSystem;