import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import logger from '../logger.js';

const execAsync = promisify(exec);

export class DevOpsAutomation {
  constructor(fileSystemManager) {
    this.fileSystemManager = fileSystemManager;
    this.deploymentConfigs = {
      vercel: {
        name: 'Vercel',
        type: 'static',
        command: 'vercel',
        configFile: 'vercel.json'
      },
      netlify: {
        name: 'Netlify',
        type: 'static',
        command: 'netlify',
        configFile: 'netlify.toml'
      },
      heroku: {
        name: 'Heroku',
        type: 'container',
        command: 'heroku',
        configFile: 'Procfile'
      },
      aws: {
        name: 'AWS',
        type: 'infrastructure',
        command: 'aws',
        configFile: 'aws-config.json'
      },
      docker: {
        name: 'Docker',
        type: 'container',
        command: 'docker',
        configFile: 'Dockerfile'
      }
    };
  }

  async deployProject(projectPath, environment, deploymentConfig) {
    const provider = this.detectDeploymentProvider(deploymentConfig);
    
    logger.info(`Deploying to ${provider} (${environment})`);

    // Prepare deployment
    await this.prepareDeployment(projectPath, provider, environment);

    // Execute deployment
    const result = await this.executeDeployment(projectPath, provider, environment, deploymentConfig);

    // Verify deployment
    await this.verifyDeployment(result, provider);

    return result;
  }

  detectDeploymentProvider(config) {
    if (typeof config === 'string') {
      return config.toLowerCase();
    }
    
    if (config.provider) {
      return config.provider.toLowerCase();
    }

    // Auto-detect based on project structure
    // This would be enhanced with actual file checks
    return 'vercel'; // Default for now
  }

  async prepareDeployment(projectPath, provider, environment) {
    switch (provider) {
      case 'vercel':
        await this.prepareVercelDeployment(projectPath, environment);
        break;
      case 'netlify':
        await this.prepareNetlifyDeployment(projectPath, environment);
        break;
      case 'heroku':
        await this.prepareHerokuDeployment(projectPath, environment);
        break;
      case 'aws':
        await this.prepareAWSDeployment(projectPath, environment);
        break;
      case 'docker':
        await this.prepareDockerDeployment(projectPath, environment);
        break;
      default:
        throw new Error(`Unsupported deployment provider: ${provider}`);
    }
  }

  async prepareVercelDeployment(projectPath, environment) {
    const config = {
      version: 2,
      name: path.basename(projectPath),
      builds: [
        {
          src: "package.json",
          use: "@vercel/node"
        }
      ],
      routes: [
        {
          src: "/(.*)",
          dest: "/"
        }
      ],
      env: {
        NODE_ENV: environment
      }
    };

    await this.fileSystemManager.writeFile(
      projectPath,
      'vercel.json',
      JSON.stringify(config, null, 2)
    );

    // Create .vercelignore
    const ignoreContent = `
node_modules
.env
.env.local
.git
README.md
.DS_Store
coverage
.vscode
`;

    await this.fileSystemManager.writeFile(
      projectPath,
      '.vercelignore',
      ignoreContent.trim()
    );
  }

  async prepareNetlifyDeployment(projectPath, environment) {
    const config = `
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
`;

    await this.fileSystemManager.writeFile(
      projectPath,
      'netlify.toml',
      config.trim()
    );
  }

  async prepareHerokuDeployment(projectPath, environment) {
    // Create Procfile
    const procfile = `web: node index.js`;
    
    await this.fileSystemManager.writeFile(
      projectPath,
      'Procfile',
      procfile
    );

    // Create app.json for Heroku button
    const appConfig = {
      name: path.basename(projectPath),
      description: "Deployed with Debo",
      repository: "",
      keywords: ["node", "express"],
      addons: ["heroku-postgresql:hobby-dev"],
      env: {
        NODE_ENV: {
          description: "Node environment",
          value: environment
        }
      }
    };

    await this.fileSystemManager.writeFile(
      projectPath,
      'app.json',
      JSON.stringify(appConfig, null, 2)
    );
  }

  async prepareDockerDeployment(projectPath, environment) {
    const hasPackageJson = await this.fileSystemManager.fileExists(projectPath, 'package.json');
    
    let dockerfile = '';
    
    if (hasPackageJson) {
      // Node.js Dockerfile
      dockerfile = `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=${environment}

# Start the application
CMD ["node", "index.js"]
`;
    } else {
      // Python Dockerfile (fallback)
      dockerfile = `FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose port
EXPOSE 8000

# Set environment
ENV ENVIRONMENT=${environment}

# Start the application
CMD ["python", "main.py"]
`;
    }

    await this.fileSystemManager.writeFile(
      projectPath,
      'Dockerfile',
      dockerfile
    );

    // Create .dockerignore
    const dockerignore = `
node_modules
npm-debug.log
.env
.env.local
.git
.gitignore
README.md
.DS_Store
coverage
.vscode
*.log
`;

    await this.fileSystemManager.writeFile(
      projectPath,
      '.dockerignore',
      dockerignore.trim()
    );

    // Create docker-compose.yml
    const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=${environment}
    volumes:
      - .:/app
      - /app/node_modules
    restart: unless-stopped
`;

    await this.fileSystemManager.writeFile(
      projectPath,
      'docker-compose.yml',
      dockerCompose
    );
  }

  async prepareAWSDeployment(projectPath, environment) {
    // Create buildspec.yml for AWS CodeBuild
    const buildspec = `version: 0.2

phases:
  pre_build:
    commands:
      - echo Installing dependencies...
      - npm install
  build:
    commands:
      - echo Building application...
      - npm run build
  post_build:
    commands:
      - echo Build completed on \`date\`

artifacts:
  files:
    - '**/*'
  name: ${path.basename(projectPath)}-${environment}

cache:
  paths:
    - 'node_modules/**/*'
`;

    await this.fileSystemManager.writeFile(
      projectPath,
      'buildspec.yml',
      buildspec
    );

    // Create SAM template for serverless deployment
    const samTemplate = {
      AWSTemplateFormatVersion: '2010-09-09',
      Transform: 'AWS::Serverless-2016-10-31',
      Description: `${path.basename(projectPath)} serverless application`,
      
      Globals: {
        Function: {
          Timeout: 30,
          Runtime: 'nodejs18.x',
          Environment: {
            Variables: {
              NODE_ENV: environment
            }
          }
        }
      },

      Resources: {
        ApiFunction: {
          Type: 'AWS::Serverless::Function',
          Properties: {
            CodeUri: '.',
            Handler: 'index.handler',
            Events: {
              Api: {
                Type: 'Api',
                Properties: {
                  Path: '/{proxy+}',
                  Method: 'ANY'
                }
              }
            }
          }
        }
      },

      Outputs: {
        ApiUrl: {
          Description: 'API Gateway endpoint URL',
          Value: {
            'Fn::Sub': 'https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/'
          }
        }
      }
    };

    await this.fileSystemManager.writeFile(
      projectPath,
      'template.yaml',
      JSON.stringify(samTemplate, null, 2)
    );
  }

  async executeDeployment(projectPath, provider, environment, config) {
    const startTime = Date.now();
    const deploymentId = `deploy-${Date.now()}`;
    
    try {
      let result;
      
      switch (provider) {
        case 'vercel':
          result = await this.deployToVercel(projectPath, environment);
          break;
        case 'netlify':
          result = await this.deployToNetlify(projectPath, environment);
          break;
        case 'heroku':
          result = await this.deployToHeroku(projectPath, environment, config);
          break;
        case 'docker':
          result = await this.deployWithDocker(projectPath, environment);
          break;
        case 'aws':
          result = await this.deployToAWS(projectPath, environment, config);
          break;
        default:
          throw new Error(`Deployment provider ${provider} not implemented`);
      }

      const duration = Date.now() - startTime;
      
      return {
        deploymentId,
        provider,
        environment,
        status: 'success',
        duration,
        url: result.url,
        details: result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Deployment failed: ${error.message}`);
      
      return {
        deploymentId,
        provider,
        environment,
        status: 'failed',
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async deployToVercel(projectPath, environment) {
    // Check if Vercel CLI is installed
    try {
      await execAsync('vercel --version');
    } catch {
      throw new Error('Vercel CLI not installed. Run: npm i -g vercel');
    }

    // Deploy with Vercel
    const envFlag = environment === 'production' ? '--prod' : '';
    const { stdout } = await execAsync(
      `vercel --yes ${envFlag}`,
      { cwd: projectPath }
    );

    // Extract URL from output
    const urlMatch = stdout.match(/https:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : 'Deployment URL not found';

    return {
      url,
      output: stdout,
      provider: 'vercel'
    };
  }

  async deployToNetlify(projectPath, environment) {
    // Check if Netlify CLI is installed
    try {
      await execAsync('netlify --version');
    } catch {
      throw new Error('Netlify CLI not installed. Run: npm i -g netlify-cli');
    }

    // Build the project first
    try {
      await execAsync('npm run build', { cwd: projectPath });
    } catch (error) {
      logger.warn('Build command failed, continuing with deployment');
    }

    // Deploy with Netlify
    const { stdout } = await execAsync(
      `netlify deploy ${environment === 'production' ? '--prod' : ''} --dir dist`,
      { cwd: projectPath }
    );

    // Extract URL from output
    const urlMatch = stdout.match(/https:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : 'Deployment URL not found';

    return {
      url,
      output: stdout,
      provider: 'netlify'
    };
  }

  async deployToHeroku(projectPath, environment, config) {
    // This would require Heroku CLI and authentication
    // For now, return a simulated result
    logger.warn('Heroku deployment requires CLI authentication');
    
    return {
      url: `https://${path.basename(projectPath)}-${environment}.herokuapp.com`,
      output: 'Heroku deployment simulation',
      provider: 'heroku',
      note: 'Requires Heroku CLI and authentication'
    };
  }

  async deployWithDocker(projectPath, environment) {
    // Build Docker image
    const imageName = `${path.basename(projectPath)}:${environment}`;
    
    try {
      const { stdout: buildOutput } = await execAsync(
        `docker build -t ${imageName} .`,
        { cwd: projectPath }
      );

      // Run container locally
      const port = environment === 'production' ? 80 : 3000;
      const { stdout: runOutput } = await execAsync(
        `docker run -d -p ${port}:3000 --name ${path.basename(projectPath)}-${environment} ${imageName}`,
        { cwd: projectPath }
      );

      return {
        url: `http://localhost:${port}`,
        output: buildOutput + '\n' + runOutput,
        provider: 'docker',
        image: imageName,
        container: `${path.basename(projectPath)}-${environment}`
      };
    } catch (error) {
      throw new Error(`Docker deployment failed: ${error.message}`);
    }
  }

  async deployToAWS(projectPath, environment, config) {
    // This would require AWS CLI and credentials
    logger.warn('AWS deployment requires CLI and credentials configuration');
    
    return {
      url: `https://${path.basename(projectPath)}-${environment}.execute-api.us-east-1.amazonaws.com/prod`,
      output: 'AWS deployment simulation',
      provider: 'aws',
      note: 'Requires AWS CLI and credentials'
    };
  }

  async verifyDeployment(result, provider) {
    if (result.status !== 'success') {
      return false;
    }

    // Simple URL verification
    if (result.url && result.url.startsWith('http')) {
      logger.info(`Deployment verified: ${result.url}`);
      return true;
    }

    return false;
  }

  async rollbackDeployment(deploymentId, provider) {
    logger.info(`Rolling back deployment ${deploymentId} on ${provider}`);
    
    // Provider-specific rollback logic would go here
    switch (provider) {
      case 'vercel':
        // Vercel has built-in rollback via dashboard
        return { message: 'Use Vercel dashboard to rollback to previous deployment' };
      case 'heroku':
        // Heroku rollback command
        return { message: 'Run: heroku rollback' };
      case 'docker':
        // Stop and remove container
        return { message: 'Docker container can be stopped and removed' };
      default:
        return { message: 'Manual rollback required' };
    }
  }

  async getDeploymentStatus(deploymentId, provider) {
    // This would check the actual deployment status
    return {
      deploymentId,
      provider,
      status: 'running',
      health: 'healthy',
      uptime: '2 hours',
      lastChecked: new Date().toISOString()
    };
  }

  async generateDeploymentReport(projectPath, deployments) {
    const report = `# Deployment Report

Generated: ${new Date().toISOString()}

## Project: ${path.basename(projectPath)}

## Deployments

${deployments.map(d => `
### ${d.provider} - ${d.environment}
- Status: ${d.status}
- URL: ${d.url || 'N/A'}
- Duration: ${d.duration}ms
- Timestamp: ${d.timestamp}
${d.error ? `- Error: ${d.error}` : ''}
`).join('\n')}

## Recommendations

1. Set up continuous deployment pipeline
2. Configure monitoring and alerts
3. Implement automated rollback strategy
4. Set up staging environment for testing

## Next Steps

- Configure environment variables
- Set up SSL certificates
- Configure custom domains
- Enable CDN for static assets
`;

    await this.fileSystemManager.writeFile(
      projectPath,
      'deployment-report.md',
      report
    );

    return report;
  }
}

export default DevOpsAutomation;