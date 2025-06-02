#!/usr/bin/env node

/**
 * Debo Demo Script
 * Showcases the AI workforce in action with real-time agent activity
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { setTimeout } from 'timers/promises';
import readline from 'readline';

// Demo scenarios to showcase
const DEMOS = [
    {
        title: "Web Application Development",
        command: 'create "e-commerce-platform"',
        description: "Build a modern e-commerce platform with user authentication, product catalog, shopping cart, and payment integration",
        agents: [
            { role: 'CTO', action: 'Analyzing technical requirements and architecture needs' },
            { role: 'Solution Architect', action: 'Designing microservices architecture with React frontend' },
            { role: 'Backend Developer', action: 'Implementing REST API with Node.js and Express' },
            { role: 'Frontend Developer', action: 'Building responsive UI with React and Tailwind CSS' },
            { role: 'Database Architect', action: 'Designing PostgreSQL schema for products and orders' },
            { role: 'Security Engineer', action: 'Implementing JWT authentication and HTTPS' },
            { role: 'QA Engineer', action: 'Writing unit and integration tests' },
            { role: 'DevOps Engineer', action: 'Creating Docker containers and CI/CD pipeline' }
        ]
    },
    {
        title: "Financial Analysis & Reporting",
        command: 'analyze "quarterly-metrics"',
        description: "Analyze Q4 performance metrics and create executive dashboard with revenue trends and growth projections",
        agents: [
            { role: 'CFO', action: 'Reviewing financial objectives and KPIs' },
            { role: 'Financial Analyst', action: 'Analyzing revenue streams and cost centers' },
            { role: 'Data Scientist', action: 'Building predictive models for Q1 projections' },
            { role: 'Business Analyst', action: 'Identifying growth opportunities and risks' },
            { role: 'UI/UX Designer', action: 'Creating interactive dashboard mockups' },
            { role: 'Frontend Developer', action: 'Implementing real-time charts with D3.js' },
            { role: 'Technical Writer', action: 'Documenting insights and recommendations' }
        ]
    },
    {
        title: "AI-Powered Customer Support",
        command: 'develop "ai-assistant"',
        description: "Add an AI-powered customer support chatbot with natural language processing and knowledge base integration",
        agents: [
            { role: 'Product Manager', action: 'Defining chatbot features and user stories' },
            { role: 'ML Engineer', action: 'Training NLP model on support ticket data' },
            { role: 'Backend Developer', action: 'Building WebSocket server for real-time chat' },
            { role: 'Frontend Developer', action: 'Creating chat widget with typing indicators' },
            { role: 'Data Engineer', action: 'Setting up knowledge base vector database' },
            { role: 'QA Engineer', action: 'Testing conversation flows and edge cases' },
            { role: 'Customer Success', action: 'Validating responses match support standards' }
        ]
    },
    {
        title: "Enterprise Security Audit",
        command: 'maintain "security-audit"',
        description: "Perform comprehensive security audit, identify vulnerabilities, and implement fixes across all systems",
        agents: [
            { role: 'CISO', action: 'Establishing security audit scope and priorities' },
            { role: 'Security Engineer', action: 'Running vulnerability scans on infrastructure' },
            { role: 'Penetration Tester', action: 'Attempting SQL injection and XSS attacks' },
            { role: 'Backend Developer', action: 'Patching identified security vulnerabilities' },
            { role: 'DevOps Engineer', action: 'Updating firewall rules and SSL certificates' },
            { role: 'Compliance Officer', action: 'Ensuring GDPR and SOC 2 compliance' },
            { role: 'Technical Writer', action: 'Updating security documentation and policies' }
        ]
    }
];

// Agent activity simulator
class AgentSimulator {
    constructor() {
        this.activeAgents = [];
        this.completedAgents = [];
        this.lines = [];
    }

    addAgent(agent) {
        this.activeAgents.push({
            ...agent,
            progress: 0,
            status: 'working'
        });
    }

    update() {
        this.activeAgents.forEach(agent => {
            // Simulate progress
            agent.progress += Math.random() * 15;
            
            // Check if completed
            if (agent.progress >= 100) {
                agent.progress = 100;
                agent.status = 'completed';
                this.completedAgents.push(agent);
            }
        });
        
        // Remove completed agents
        this.activeAgents = this.activeAgents.filter(a => a.status !== 'completed');
    }

    display() {
        console.clear();
        
        // Header
        console.log(chalk.cyan.bold('\nDebo AI Workforce in Action'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log('');
        
        // Active agents
        if (this.activeAgents.length > 0) {
            console.log(chalk.yellow.bold('Active Agents:'));
            this.activeAgents.forEach(agent => {
                const progressBar = this.getProgressBar(agent.progress);
                const statusIcon = '⚡';
                console.log(`  ${statusIcon} ${chalk.cyan(agent.role.padEnd(20))} ${progressBar} ${Math.round(agent.progress)}%`);
                console.log(`     ${chalk.gray(agent.action)}`);
                console.log('');
            });
        }
        
        // Completed agents
        if (this.completedAgents.length > 0) {
            console.log(chalk.green.bold('\nCompleted:'));
            this.completedAgents.slice(-5).forEach(agent => {
                console.log(`  ✓ ${chalk.green(agent.role)} - ${chalk.gray(agent.action)}`);
            });
        }
        
        // Stats
        console.log(chalk.gray('\n─'.repeat(60)));
        console.log(chalk.white(`Active: ${this.activeAgents.length} | Completed: ${this.completedAgents.length} | Total: ${this.activeAgents.length + this.completedAgents.length}`));
    }

    getProgressBar(progress) {
        const width = 20;
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    }
}

// ASCII Art Banner
function showBanner() {
    console.clear();
    console.log(chalk.cyan.bold(`
    ██████╗ ███████╗██████╗  ██████╗ 
    ██╔══██╗██╔════╝██╔══██╗██╔═══██╗
    ██║  ██║█████╗  ██████╔╝██║   ██║
    ██║  ██║██╔══╝  ██╔══██╗██║   ██║
    ██████╔╝███████╗██████╔╝╚██████╔╝
    ╚═════╝ ╚══════╝╚═════╝  ╚═════╝ 
    `));
    console.log(chalk.gray('    Enterprise AI Workforce Demo\n'));
}

// Execute a demo with realistic agent simulation
async function runDemo(demo, index) {
    console.clear();
    console.log(chalk.bold.blue(`\nDemo ${index + 1}: ${demo.title}`));
    console.log(chalk.gray(`${demo.description}\n`));
    console.log(chalk.yellow('Command:'), chalk.white(`debo ${demo.command}`));
    console.log(chalk.gray('\nPress any key to start...'));
    
    // Wait for keypress
    await waitForKeypress();
    
    // Initialize agent simulator
    const simulator = new AgentSimulator();
    
    // Add agents progressively
    let agentIndex = 0;
    const agentInterval = setInterval(() => {
        if (agentIndex < demo.agents.length) {
            simulator.addAgent(demo.agents[agentIndex]);
            agentIndex++;
        }
    }, 1500);
    
    // Update display
    const displayInterval = setInterval(() => {
        simulator.update();
        simulator.display();
    }, 200);
    
    // Wait for all agents to complete
    while (simulator.activeAgents.length > 0 || agentIndex < demo.agents.length) {
        await setTimeout(100);
    }
    
    // Final display
    clearInterval(agentInterval);
    clearInterval(displayInterval);
    simulator.display();
    
    // Show results
    await setTimeout(1000);
    console.log(chalk.green.bold('\n\nDemo Completed Successfully!'));
    console.log(chalk.white('\nDeliverables:'));
    
    // Demo-specific results
    if (demo.title.includes('Web Application')) {
        console.log(chalk.gray('  • API endpoints: 24 REST endpoints created'));
        console.log(chalk.gray('  • Frontend components: 18 React components'));
        console.log(chalk.gray('  • Database schema: 12 tables with migrations'));
        console.log(chalk.gray('  • Test coverage: 87% with 156 tests passing'));
        console.log(chalk.gray('  • Docker setup: 3 containers (app, db, cache)'));
    } else if (demo.title.includes('Financial')) {
        console.log(chalk.gray('  • Revenue analysis: 15% YoY growth identified'));
        console.log(chalk.gray('  • Cost optimization: $2.3M savings opportunities'));
        console.log(chalk.gray('  • Dashboard: 8 interactive visualizations'));
        console.log(chalk.gray('  • Predictions: Q1 forecast with 92% confidence'));
        console.log(chalk.gray('  • Report: 47-page executive summary'));
    } else if (demo.title.includes('AI-Powered')) {
        console.log(chalk.gray('  • NLP model: 94% intent recognition accuracy'));
        console.log(chalk.gray('  • Knowledge base: 1,200 articles indexed'));
        console.log(chalk.gray('  • Response time: <100ms average latency'));
        console.log(chalk.gray('  • Chat widget: Responsive on all devices'));
        console.log(chalk.gray('  • Integration: Connected to Zendesk & Slack'));
    } else if (demo.title.includes('Security')) {
        console.log(chalk.gray('  • Vulnerabilities found: 23 (7 critical)'));
        console.log(chalk.gray('  • Patches applied: All critical issues fixed'));
        console.log(chalk.gray('  • Compliance: GDPR, SOC 2, ISO 27001 ready'));
        console.log(chalk.gray('  • Penetration test: Passed with A+ rating'));
        console.log(chalk.gray('  • Documentation: Security policies updated'));
    }
    
    console.log(chalk.gray('\n  Press any key to continue...'));
    await waitForKeypress();
}

// Wait for keypress helper
function waitForKeypress() {
    return new Promise(resolve => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            resolve();
        });
    });
}

// Main menu
async function showMenu() {
    console.clear();
    showBanner();
    
    console.log(chalk.bold.cyan('Select a demo:\n'));
    
    DEMOS.forEach((demo, index) => {
        console.log(chalk.white(`  ${index + 1}. ${demo.title}`));
        console.log(chalk.gray(`     ${demo.description.substring(0, 60)}...\n`));
    });
    
    console.log(chalk.white(`  5. Run all demos`));
    console.log(chalk.white(`  0. Exit\n`));
    
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question(chalk.yellow('Enter your choice: '), (answer) => {
            rl.close();
            resolve(parseInt(answer));
        });
    });
}

// Main demo runner
async function main() {
    let running = true;
    
    while (running) {
        const choice = await showMenu();
        
        if (choice === 0) {
            running = false;
        } else if (choice >= 1 && choice <= 4) {
            await runDemo(DEMOS[choice - 1], choice - 1);
        } else if (choice === 5) {
            // Run all demos
            for (let i = 0; i < DEMOS.length; i++) {
                await runDemo(DEMOS[i], i);
            }
        }
    }
    
    // Exit message
    console.clear();
    showBanner();
    console.log(chalk.green.bold('Thank you for exploring Debo!\n'));
    console.log(chalk.white('To use Debo in your own projects:\n'));
    console.log(chalk.cyan('  curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash'));
    console.log(chalk.cyan('  debo "your project requirements here"\n'));
    console.log(chalk.gray('Learn more: https://github.com/Kevin-Kurka/Debo'));
    console.log(chalk.gray('Report issues: https://github.com/Kevin-Kurka/Debo/issues\n'));
    
    process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\nError:'), error.message);
    process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nExiting demo...'));
    process.exit(0);
});

// Run the demo
main().catch(console.error);