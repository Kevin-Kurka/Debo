import { jest } from '@jest/globals';
import { FileSystemManager } from '../../src/tools/file-system-manager.js';
import fs from 'fs-extra';
import path from 'path';

// Mock fs-extra
jest.mock('fs-extra');

describe('FileSystemManager', () => {
  let fileSystemManager;
  let mockTemplateManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs methods
    fs.ensureDir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    fs.readFile.mockResolvedValue('file content');
    fs.pathExists.mockResolvedValue(true);
    fs.copy.mockResolvedValue();
    
    fileSystemManager = new FileSystemManager();
    
    // Mock template manager
    mockTemplateManager = {
      init: jest.fn(),
      scaffoldProject: jest.fn(),
      detectBestTemplate: jest.fn().mockResolvedValue('react'),
      getAvailableTemplates: jest.fn().mockReturnValue([
        { key: 'react', name: 'React Application' },
        { key: 'next', name: 'Next.js Application' }
      ])
    };
    fileSystemManager.templateManager = mockTemplateManager;
  });

  describe('init', () => {
    it('should create necessary directories', async () => {
      await fileSystemManager.init();

      expect(fs.ensureDir).toHaveBeenCalledWith(fileSystemManager.projectsRoot);
      expect(fs.ensureDir).toHaveBeenCalledWith(fileSystemManager.templatesRoot);
      expect(mockTemplateManager.init).toHaveBeenCalled();
    });
  });

  describe('ensureProjectDirectory', () => {
    it('should create project directory and return path', async () => {
      const projectId = 'project1';
      const projectName = 'My Project';
      
      const result = await fileSystemManager.ensureProjectDirectory(projectId, projectName);

      expect(fs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining(projectName)
      );
      expect(result).toContain(projectName);
    });

    it('should use projectId if projectName not provided', async () => {
      const projectId = 'project1';
      
      const result = await fileSystemManager.ensureProjectDirectory(projectId);

      expect(result).toContain(projectId);
    });
  });

  describe('writeFile', () => {
    it('should write file and ensure directory exists', async () => {
      const projectPath = '/projects/test';
      const relativePath = 'src/index.js';
      const content = 'console.log("Hello");';

      const result = await fileSystemManager.writeFile(projectPath, relativePath, content);

      expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname(path.join(projectPath, relativePath)));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(projectPath, relativePath),
        content
      );
      expect(result).toBe(path.join(projectPath, relativePath));
    });
  });

  describe('writeFiles', () => {
    it('should write multiple files', async () => {
      const projectPath = '/projects/test';
      const files = {
        'index.js': 'console.log("index");',
        'utils.js': 'export const util = () => {};',
        'src/app.js': 'const app = {};'
      };

      const result = await fileSystemManager.writeFiles(projectPath, files);

      expect(fs.writeFile).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });
  });

  describe('extractCodeFromLLMResponse', () => {
    it('should extract files marked with <<<filename>>>', () => {
      const llmResponse = `
Here's the code:
<<<index.js>>>
console.log("Hello");
<<<>>>

<<<utils.js>>>
export const util = () => {};
<<<>>>
`;

      const files = fileSystemManager.extractCodeFromLLMResponse(llmResponse);

      expect(files['index.js']).toBe('console.log("Hello");');
      expect(files['utils.js']).toBe('export const util = () => {};');
    });

    it('should extract code blocks with filenames', () => {
      const llmResponse = `
\`\`\`javascript filename: index.js
console.log("Hello");
\`\`\`

\`\`\`js utils.js
export const util = () => {};
\`\`\`
`;

      const files = fileSystemManager.extractCodeFromLLMResponse(llmResponse);

      expect(Object.keys(files)).toHaveLength(2);
    });

    it('should infer filename from code content', () => {
      const llmResponse = `
\`\`\`javascript
export default function HomePage() {
  return <div>Home</div>;
}
\`\`\`
`;

      const files = fileSystemManager.extractCodeFromLLMResponse(llmResponse);

      expect(files['HomePage.js']).toBeDefined();
    });
  });

  describe('inferFileName', () => {
    it('should extract component name from React export', () => {
      const code = `export default function HomePage() {
  return <div>Home</div>;
}`;
      
      const filename = fileSystemManager.inferFileName(code, 'javascript');

      expect(filename).toBe('HomePage.js');
    });

    it('should extract class name', () => {
      const code = `class UserService {
  constructor() {}
}`;
      
      const filename = fileSystemManager.inferFileName(code, 'javascript');

      expect(filename).toBe('UserService.js');
    });

    it('should extract export const name', () => {
      const code = `export const apiClient = axios.create({
  baseURL: '/api'
});`;
      
      const filename = fileSystemManager.inferFileName(code, 'javascript');

      expect(filename).toBe('apiClient.js');
    });

    it('should return null if no name found', () => {
      const code = `console.log("Hello");`;
      
      const filename = fileSystemManager.inferFileName(code, 'javascript');

      expect(filename).toBeNull();
    });
  });

  describe('analyzeProject', () => {
    beforeEach(() => {
      // Mock glob
      jest.spyOn(fileSystemManager, 'listFiles').mockResolvedValue([
        'package.json',
        'README.md',
        'src/index.js',
        'src/components/App.jsx',
        'tests/app.test.js',
        'public/index.html'
      ]);
    });

    it('should analyze project structure', async () => {
      const projectPath = '/projects/test';
      const analysis = await fileSystemManager.analyzeProject(projectPath);

      expect(analysis.totalFiles).toBe(6);
      expect(analysis.hasPackageJson).toBe(true);
      expect(analysis.hasReadme).toBe(true);
      expect(analysis.hasTests).toBe(true);
      expect(analysis.fileTypes['.js']).toBe(2);
      expect(analysis.fileTypes['.jsx']).toBe(1);
      expect(analysis.directories).toContain('src');
      expect(analysis.directories).toContain('tests');
    });
  });

  describe('scaffoldFromTemplate', () => {
    it('should call template manager to scaffold project', async () => {
      const projectPath = '/projects/test';
      const templateName = 'react';
      const variables = { projectName: 'Test Project' };

      await fileSystemManager.scaffoldFromTemplate(projectPath, templateName, variables);

      expect(mockTemplateManager.scaffoldProject).toHaveBeenCalledWith(
        projectPath,
        templateName,
        variables
      );
    });
  });

  describe('detectAndScaffold', () => {
    it('should detect template and scaffold project', async () => {
      const projectPath = '/projects/test';
      const requirements = 'Build a React app with routing';
      const projectName = 'Test App';

      const result = await fileSystemManager.detectAndScaffold(
        projectPath,
        requirements,
        projectName
      );

      expect(mockTemplateManager.detectBestTemplate).toHaveBeenCalledWith(requirements);
      expect(mockTemplateManager.scaffoldProject).toHaveBeenCalledWith(
        projectPath,
        'react',
        { projectName }
      );
      expect(result).toBe('react');
    });
  });

  describe('getExtension', () => {
    it('should return correct extensions', () => {
      expect(fileSystemManager.getExtension('javascript')).toBe('js');
      expect(fileSystemManager.getExtension('typescript')).toBe('ts');
      expect(fileSystemManager.getExtension('python')).toBe('py');
      expect(fileSystemManager.getExtension('unknown')).toBe('txt');
    });
  });
});