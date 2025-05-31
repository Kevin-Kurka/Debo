import fs from 'fs-extra';
import path from 'path';
import logger from '../logger.js';

export class TemplateManager {
  constructor() {
    this.templatesDir = path.join(process.cwd(), 'templates');
    this.defaultTemplates = {
      'react': {
        name: 'React Application',
        description: 'Modern React app with hooks and functional components',
        stack: ['react', 'vite', 'tailwind', 'react-router']
      },
      'next': {
        name: 'Next.js Full-Stack',
        description: 'Next.js 14 with App Router, TypeScript, and Tailwind',
        stack: ['next', 'typescript', 'tailwind', 'prisma']
      },
      'vue': {
        name: 'Vue 3 Application',
        description: 'Vue 3 with Composition API and Vite',
        stack: ['vue', 'vite', 'pinia', 'vue-router']
      },
      'express': {
        name: 'Express API',
        description: 'RESTful API with Express, MongoDB, and JWT auth',
        stack: ['express', 'mongodb', 'jwt', 'joi']
      },
      'fastapi': {
        name: 'FastAPI Backend',
        description: 'Python FastAPI with async support and automatic docs',
        stack: ['python', 'fastapi', 'sqlalchemy', 'pydantic']
      },
      'fullstack': {
        name: 'MERN Stack',
        description: 'MongoDB, Express, React, Node.js full-stack app',
        stack: ['mongodb', 'express', 'react', 'node']
      }
    };
  }

  async init() {
    await fs.ensureDir(this.templatesDir);
    await this.createDefaultTemplates();
    logger.info('Template Manager initialized');
  }

  async createDefaultTemplates() {
    for (const [key, config] of Object.entries(this.defaultTemplates)) {
      const templatePath = path.join(this.templatesDir, key);
      if (!await fs.pathExists(templatePath)) {
        await this.createTemplate(key, config);
      }
    }
  }

  async createTemplate(templateName, config) {
    const templatePath = path.join(this.templatesDir, templateName);
    await fs.ensureDir(templatePath);

    switch (templateName) {
      case 'react':
        await this.createReactTemplate(templatePath, config);
        break;
      case 'next':
        await this.createNextTemplate(templatePath, config);
        break;
      case 'vue':
        await this.createVueTemplate(templatePath, config);
        break;
      case 'express':
        await this.createExpressTemplate(templatePath, config);
        break;
      case 'fastapi':
        await this.createFastAPITemplate(templatePath, config);
        break;
      case 'fullstack':
        await this.createFullStackTemplate(templatePath, config);
        break;
    }

    // Save template config
    await fs.writeJSON(path.join(templatePath, 'template.json'), {
      ...config,
      created: new Date().toISOString()
    });
  }

  async createReactTemplate(templatePath, config) {
    const files = {
      'package.json': {
        name: '{{projectName}}',
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          test: 'vitest',
          lint: 'eslint src --ext js,jsx'
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          'react-router-dom': '^6.8.0',
          axios: '^1.3.0'
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.0.0',
          vite: '^4.3.0',
          tailwindcss: '^3.3.0',
          autoprefixer: '^10.4.14',
          postcss: '^8.4.24',
          eslint: '^8.38.0',
          'eslint-plugin-react': '^7.32.2',
          vitest: '^0.30.0'
        }
      },
      'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
      'src/main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)`,
      'src/App.jsx': `import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import Layout from './components/Layout'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Layout>
  )
}

export default App`,
      'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      'src/components/Layout.jsx': `import { Link } from 'react-router-dom'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <Link to="/" className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900">
                Home
              </Link>
              <Link to="/about" className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900">
                About
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

export default Layout`,
      'src/pages/Home.jsx': `function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Welcome to {{projectName}}</h1>
      <p className="mt-4 text-gray-600">Your React application is ready!</p>
    </div>
  )
}

export default Home`,
      'src/pages/About.jsx': `function About() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">About</h1>
      <p className="mt-4 text-gray-600">This is a React application built with Vite and Tailwind CSS.</p>
    </div>
  )
}

export default About`,
      'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
      'postcss.config.js': `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
      '.eslintrc.cjs': `module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react'],
  rules: {
    'react/prop-types': 'off',
  },
}`,
      '.gitignore': `node_modules
.DS_Store
dist
dist-ssr
*.local
.env
.env.local
.env.production`,
      'README.md': `# {{projectName}}

A modern React application built with Vite and Tailwind CSS.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- ⚡️ Vite for fast development
- ⚛️ React 18 with hooks
- 🎨 Tailwind CSS for styling
- 🚦 React Router for navigation
- 📦 Component-based architecture
- 🧪 Vitest for testing
- 📝 ESLint for code quality

## Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build
- \`npm test\` - Run tests
- \`npm run lint\` - Lint code

## Project Structure

\`\`\`
src/
  ├── components/     # Reusable components
  ├── pages/         # Page components
  ├── hooks/         # Custom React hooks
  ├── utils/         # Utility functions
  ├── App.jsx        # Main app component
  └── main.jsx       # Entry point
\`\`\`
`
    };

    // Create directory structure
    const dirs = ['src/components', 'src/pages', 'src/hooks', 'src/utils', 'public'];
    for (const dir of dirs) {
      await fs.ensureDir(path.join(templatePath, dir));
    }

    // Write files
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(templatePath, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      
      if (typeof content === 'object') {
        await fs.writeJSON(fullPath, content, { spaces: 2 });
      } else {
        await fs.writeFile(fullPath, content);
      }
    }
  }

  async createNextTemplate(templatePath, config) {
    const files = {
      'package.json': {
        name: '{{projectName}}',
        version: '1.0.0',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
          'type-check': 'tsc'
        },
        dependencies: {
          next: '^14.0.0',
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@prisma/client': '^5.0.0',
          'tailwindcss': '^3.3.0'
        },
        devDependencies: {
          '@types/node': '^20.0.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          typescript: '^5.0.0',
          prisma: '^5.0.0',
          autoprefixer: '^10.4.14',
          postcss: '^8.4.24',
          eslint: '^8.0.0',
          'eslint-config-next': '^14.0.0'
        }
      },
      'tsconfig.json': {
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: {
            '@/*': ['./src/*']
          }
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules']
      },
      'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig`,
      'app/layout.tsx': `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '{{projectName}}',
  description: 'Built with Next.js 14',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`,
      'app/page.tsx': `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to {{projectName}}</h1>
      <p className="mt-4 text-lg text-gray-600">
        Get started by editing app/page.tsx
      </p>
    </main>
  )
}`,
      'app/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      '.env.example': `DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"`,
      'prisma/schema.prisma': `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}`,
      'README.md': `# {{projectName}}

A full-stack Next.js 14 application with TypeScript, Tailwind CSS, and Prisma.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- 🚀 Next.js 14 with App Router
- 📝 TypeScript for type safety
- 🎨 Tailwind CSS for styling
- 🗄️ Prisma for database ORM
- 🔐 Environment variables support
- 📱 Responsive design

## Database Setup

1. Copy \`.env.example\` to \`.env\`
2. Update DATABASE_URL in \`.env\`
3. Run \`npx prisma migrate dev\`

## Project Structure

\`\`\`
app/              # App router pages and layouts
components/       # Reusable components
lib/             # Utility functions and libraries
prisma/          # Database schema and migrations
public/          # Static assets
\`\`\`
`
    };

    // Create directory structure
    const dirs = ['app', 'components', 'lib', 'prisma', 'public'];
    for (const dir of dirs) {
      await fs.ensureDir(path.join(templatePath, dir));
    }

    // Write files
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(templatePath, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      
      if (typeof content === 'object') {
        await fs.writeJSON(fullPath, content, { spaces: 2 });
      } else {
        await fs.writeFile(fullPath, content);
      }
    }
  }

  async createExpressTemplate(templatePath, config) {
    const files = {
      'package.json': {
        name: '{{projectName}}',
        version: '1.0.0',
        main: 'src/index.js',
        scripts: {
          start: 'node src/index.js',
          dev: 'nodemon src/index.js',
          test: 'jest',
          lint: 'eslint src'
        },
        dependencies: {
          express: '^4.18.0',
          cors: '^2.8.5',
          helmet: '^7.0.0',
          'express-rate-limit': '^6.7.0',
          mongoose: '^7.0.0',
          bcryptjs: '^2.4.3',
          jsonwebtoken: '^9.0.0',
          joi: '^17.8.0',
          dotenv: '^16.0.0',
          winston: '^3.8.0'
        },
        devDependencies: {
          nodemon: '^3.0.0',
          jest: '^29.0.0',
          supertest: '^6.3.0',
          eslint: '^8.0.0'
        }
      },
      'src/index.js': `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/{{projectName}}')
  .then(() => {
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(\`Server running on port \${PORT}\`);
    });
  })
  .catch(err => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;`,
      'src/routes/index.js': `const router = require('express').Router();
const authRoutes = require('./auth');
const userRoutes = require('./users');
const { authenticate } = require('../middleware/auth');

router.use('/auth', authRoutes);
router.use('/users', authenticate, userRoutes);

module.exports = router;`,
      'src/routes/auth.js': `const router = require('express').Router();
const { register, login } = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

module.exports = router;`,
      'src/controllers/authController.js': `const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, name });
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    
    res.status(201).json({ token, user: { id: user._id, email, name } });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login };`,
      'src/models/User.js': `const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);`,
      'src/middleware/auth.js': `const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = verified.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticate };`,
      'src/middleware/validation.js': `const Joi = require('joi');

const validateRegister = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).required()
  });
  
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  
  next();
};

const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });
  
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  
  next();
};

module.exports = { validateRegister, validateLogin };`,
      'src/middleware/errorHandler.js': `const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.name === 'MongoError' && err.code === 11000) {
    return res.status(400).json({ error: 'Duplicate key error' });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
};

module.exports = { errorHandler };`,
      'src/utils/logger.js': `const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: '{{projectName}}' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

module.exports = logger;`,
      '.env.example': `PORT=3000
MONGODB_URI=mongodb://localhost:27017/{{projectName}}
JWT_SECRET=your-secret-key-here
NODE_ENV=development`,
      '.gitignore': `node_modules
.env
.DS_Store
logs
dist
coverage`,
      'README.md': `# {{projectName}}

Express.js REST API with MongoDB, JWT authentication, and best practices.

## Getting Started

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

## Features

- 🔐 JWT Authentication
- 📝 Request validation with Joi
- 🗄️ MongoDB with Mongoose
- 🔒 Security with Helmet
- ⚡ Rate limiting
- 📊 Logging with Winston
- 🧪 Testing with Jest

## API Endpoints

### Authentication
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login user

### Users
- GET /api/users - Get all users (protected)
- GET /api/users/:id - Get user by ID (protected)

## Environment Variables

See \`.env.example\` for required environment variables.

## Testing

\`\`\`bash
npm test
\`\`\`
`
    };

    // Create directory structure
    const dirs = [
      'src/routes',
      'src/controllers', 
      'src/models',
      'src/middleware',
      'src/utils',
      'tests',
      'logs'
    ];
    
    for (const dir of dirs) {
      await fs.ensureDir(path.join(templatePath, dir));
    }

    // Write files
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(templatePath, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      
      if (typeof content === 'object') {
        await fs.writeJSON(fullPath, content, { spaces: 2 });
      } else {
        await fs.writeFile(fullPath, content);
      }
    }
  }

  async createVueTemplate(templatePath, config) {
    // Vue template already implemented in executor
    // This is a placeholder for consistency
  }

  async createFastAPITemplate(templatePath, config) {
    const files = {
      'requirements.txt': `fastapi==0.104.0
uvicorn[standard]==0.24.0
sqlalchemy==2.0.0
pydantic==2.4.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
alembic==1.12.0
pytest==7.4.0
httpx==0.25.0`,
      'main.py': `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.v1.api import api_router
from app.db.database import engine, Base

# Create tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up...")
    yield
    # Shutdown
    print("Shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "healthy"}`,
      'app/__init__.py': '',
      'app/core/__init__.py': '',
      'app/core/config.py': `from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "{{projectName}}"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = "sqlite:///./{{projectName}}.db"
    
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"

settings = Settings()`,
      'app/api/__init__.py': '',
      'app/api/v1/__init__.py': '',
      'app/api/v1/api.py': `from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, items

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(items.router, prefix="/items", tags=["items"])`,
      'app/api/v1/endpoints/__init__.py': '',
      'app/api/v1/endpoints/auth.py': `from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.db.database import get_db
from app.schemas.token import Token
from app.schemas.user import UserCreate, User
from app.crud import user as crud_user

router = APIRouter()

@router.post("/register", response_model=User)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    user = crud_user.create_user(db, user=user_in)
    return user

@router.post("/login", response_model=Token)
def login(form_data: UserCreate, db: Session = Depends(get_db)):
    user = crud_user.authenticate_user(db, email=form_data.email, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}`,
      'app/models/__init__.py': '',
      'app/models/user.py': `from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from app.db.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())`,
      'app/schemas/__init__.py': '',
      'app/schemas/user.py': `from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserInDBBase(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    hashed_password: str`,
      'app/db/__init__.py': '',
      'app/db/database.py': `from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()`,
      'app/core/security.py': `from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt`,
      '.env.example': `PROJECT_NAME={{projectName}}
DATABASE_URL=sqlite:///./{{projectName}}.db
SECRET_KEY=your-secret-key-here
BACKEND_CORS_ORIGINS=["http://localhost:3000"]`,
      'README.md': `# {{projectName}}

Modern Python API built with FastAPI, SQLAlchemy, and Pydantic.

## Getting Started

\`\`\`bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload
\`\`\`

## Features

- ⚡ FastAPI for high performance
- 🔐 JWT authentication
- 📝 Automatic API documentation
- 🗄️ SQLAlchemy ORM
- ✅ Pydantic data validation
- 🧪 Pytest for testing
- 🔄 Alembic for migrations

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

\`\`\`
app/
  ├── api/          # API endpoints
  ├── core/         # Core functionality
  ├── crud/         # Database operations
  ├── db/           # Database config
  ├── models/       # SQLAlchemy models
  └── schemas/      # Pydantic schemas
\`\`\`
`
    };

    // Create directory structure
    const dirs = [
      'app/api/v1/endpoints',
      'app/core',
      'app/crud',
      'app/db',
      'app/models',
      'app/schemas',
      'tests'
    ];
    
    for (const dir of dirs) {
      await fs.ensureDir(path.join(templatePath, dir));
    }

    // Write files
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(templatePath, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content);
    }
  }

  async createFullStackTemplate(templatePath, config) {
    // Create both backend and frontend
    await fs.ensureDir(path.join(templatePath, 'backend'));
    await fs.ensureDir(path.join(templatePath, 'frontend'));
    
    // Use Express template for backend
    await this.createExpressTemplate(path.join(templatePath, 'backend'), config);
    
    // Use React template for frontend
    await this.createReactTemplate(path.join(templatePath, 'frontend'), config);
    
    // Add root files
    const rootFiles = {
      'package.json': {
        name: '{{projectName}}',
        version: '1.0.0',
        scripts: {
          'dev': 'concurrently "npm run dev:backend" "npm run dev:frontend"',
          'dev:backend': 'cd backend && npm run dev',
          'dev:frontend': 'cd frontend && npm run dev',
          'install:all': 'npm install && cd backend && npm install && cd ../frontend && npm install',
          'build': 'cd frontend && npm run build',
          'start': 'cd backend && npm start'
        },
        devDependencies: {
          concurrently: '^8.0.0'
        }
      },
      'README.md': `# {{projectName}}

Full-stack MERN application with Express backend and React frontend.

## Getting Started

\`\`\`bash
npm run install:all
npm run dev
\`\`\`

Backend runs on http://localhost:3000
Frontend runs on http://localhost:3001

## Features

### Backend
- Express.js REST API
- MongoDB with Mongoose
- JWT Authentication
- Request validation

### Frontend
- React with Vite
- Tailwind CSS
- React Router
- Axios for API calls

## Project Structure

\`\`\`
backend/          # Express API
frontend/         # React application
\`\`\`
`
    };

    for (const [filePath, content] of Object.entries(rootFiles)) {
      const fullPath = path.join(templatePath, filePath);
      if (typeof content === 'object') {
        await fs.writeJSON(fullPath, content, { spaces: 2 });
      } else {
        await fs.writeFile(fullPath, content);
      }
    }
  }

  async scaffoldProject(projectPath, templateName, variables = {}) {
    const templatePath = path.join(this.templatesDir, templateName);
    
    if (!await fs.pathExists(templatePath)) {
      throw new Error(`Template "${templateName}" not found`);
    }

    // Copy template to project
    await fs.copy(templatePath, projectPath);

    // Replace variables in all files
    await this.replaceVariables(projectPath, variables);

    logger.info(`Project scaffolded from template: ${templateName}`);
    return true;
  }

  async replaceVariables(projectPath, variables) {
    const defaultVars = {
      projectName: path.basename(projectPath),
      ...variables
    };

    const files = await this.getAllFiles(projectPath);
    
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.ico')) {
        continue; // Skip binary files
      }

      let content = await fs.readFile(file, 'utf-8');
      let modified = false;

      for (const [key, value] of Object.entries(defaultVars)) {
        const placeholder = `{{${key}}}`;
        if (content.includes(placeholder)) {
          content = content.replace(new RegExp(placeholder, 'g'), value);
          modified = true;
        }
      }

      if (modified) {
        await fs.writeFile(file, content);
      }
    }
  }

  async getAllFiles(dir, files = []) {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        await this.getAllFiles(fullPath, files);
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  getAvailableTemplates() {
    return Object.entries(this.defaultTemplates).map(([key, config]) => ({
      key,
      ...config
    }));
  }

  async detectBestTemplate(requirements) {
    const keywords = requirements.toLowerCase();
    
    if (keywords.includes('react') && keywords.includes('next')) {
      return 'next';
    } else if (keywords.includes('react')) {
      return 'react';
    } else if (keywords.includes('vue')) {
      return 'vue';
    } else if (keywords.includes('api') || keywords.includes('backend')) {
      if (keywords.includes('python') || keywords.includes('fastapi')) {
        return 'fastapi';
      }
      return 'express';
    } else if (keywords.includes('full-stack') || keywords.includes('fullstack')) {
      return 'fullstack';
    }
    
    // Default to React for frontend projects
    return 'react';
  }
}

export default TemplateManager;