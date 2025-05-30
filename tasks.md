# DBot Development Tasks

## Phase 1: Core Infrastructure, Stack Selection & Style Onboarding
- [ ] Initialize Redis Stack with JSON/Vector modules
- [ ] Set up multi-project namespace structure  
- [ ] Create project manager with state persistence
- [ ] Set up Ollama with vision-capable model (qwen2.5-vl:32b)
- [ ] Implement tech stack selection interview
- [ ] Build auto-documentation download system
- [ ] Add style onboarding with vision analysis
- [ ] Create stack-specific project templates (Next.js, Vue, Flutter, etc.)
- [ ] Configure MCP server with routing tool

## Phase 2: Feature Management & Analysis
- [ ] Build feature interview system with dynamic questions
- [ ] Implement integration analysis for existing features
- [ ] Create feature merging and suggestion engine
- [ ] Add conflict detection between features
- [ ] Build dependency mapping system
- [ ] Configure feature classification algorithms

## Phase 3: Context-Aware Prompting & Documentation RAG
- [ ] Build tech stack detection system
- [ ] Create feature-specific prompt templates
- [ ] Implement dynamic prompt generation with project context
- [ ] Add clarifying questions for feature decisions
- [ ] Build documentation collection pipeline
- [ ] Implement vector storage in Redis
- [ ] Create semantic search functionality
- [ ] Integrate stack-specific docs into agent prompts
- [ ] Add anti-hallucination verification

## Phase 4: Model Schema Management & Translation
- [ ] Build unified model registry system
- [ ] Implement cross-stack translation (TS/Python/SQL)
- [ ] Create relationship mapping and graph tracking
- [ ] Add model consistency validation
- [ ] Build auto-sync for schema changes
- [ ] Generate migrations and API schemas
- [ ] Add model-aware agent prompting

## Phase 5: Integration & UI
- [ ] Integrate Figma Context MCP
- [ ] Build visual approval workflow
- [ ] Create task dependency management
- [ ] Implement progress tracking
- [ ] Add real-time status updates

## Phase 6: Model Management & GitHub Distribution
- [ ] Create model manager with orchestrator integration
- [ ] Implement dynamic model loading/unloading
- [ ] Add user model management commands
- [ ] Configure default models (DeepSeek-R1, Devstral, Qwen3)
- [ ] Create package.json with install scripts
- [ ] Build setup automation
- [ ] Write installation documentation
- [ ] Configure GitHub Actions for releases
- [ ] Create npx installer package

## Minimal Features for MVP

### Core Files Needed
1. `package.json` - Dependencies and scripts
2. `mcp-server.js` - Main MCP server
3. `orchestrator.py` - Agent coordination
4. `agents/` - Individual agent implementations
5. `docs/` - Documentation pipeline
6. `setup.sh` - Environment setup script

### Essential Components
- Single MCP tool routing to orchestrator
- Basic task decomposition 
- Simple TDD pipeline (test → code → QA)
- Documentation collection for common frameworks
- Redis storage for tasks and docs
- 2-3 parallel agents maximum for MVP

## Phase 7: Advanced Features (Post-MVP)
- [ ] Implement error pattern learning and recovery
- [ ] Add comprehensive logging and monitoring
- [ ] Build Git integration with auto-commits
- [ ] Create performance analytics dashboard
- [ ] Add visual progress tracking
- [ ] Implement custom workflow designer
- [ ] Build approval workflow system
- [ ] Add architecture diagram generation
