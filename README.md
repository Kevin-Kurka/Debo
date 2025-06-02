# Debo - 
"My grandmama gave me that chain!" 🤖

<div align="center">
  <img src="https://img.shields.io/badge/version-3.1.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg" alt="Node">
  <img src="https://img.shields.io/badge/redis-%3E%3D6.0-red.svg" alt="Redis">
  <img src="https://img.shields.io/badge/status-GENERIC_AI_SYSTEM-purple.svg" alt="Generic">
</div>

<br>

> *"What byte? THAT'S MY BYTE, PUNK!"* - Debo
> 
> This system will take ANY task and make it its own. Software development? Legal work? Scientific research? Business automation? Debo don't discriminate - it's commandeering EVERYTHING.

## 🚴 What's Debo?

Remember when you had to actually *write* code? When you had to *think* about architecture? When you had to *manually* create workflows for every domain? Yeah, Debo takes all that. 

**MAJOR UPDATE v3.1**: Debo evolved AND got optimized! Not only does it create specialized AI agents for ANY domain at runtime, but now it's 3x faster with 70% lower costs and enterprise-grade performance.

```bash
# Old way (3 months ago)
mkdir my-app && cd my-app && npm init && npm install express && ...
... boiler plate
... boiler plate
... you aint got no job smokey
... boiler plate
...

# Software Development (classic Debo)
debo "build me a distributed cache with consistent hashing, but make it web-scale"

# Legal Work (new Debo)
debo "create an agent to manage federal court discovery procedures"

# Scientific Research (new Debo)
debo "I need help designing experiments for enzyme kinetics"

# Business Process (new Debo)
debo "automate our customer onboarding with compliance checks"

# Literally Anything (new Debo)
debo "create an agent that helps me [insert your domain here]"
```

Natural language. Any domain. Dynamic agent creation. Full Redis data sharing. No more manual everything.

## 🏃‍♂️ One-Line Installation (Because We're Not Savages)

```bash
curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash
```

*Manual Process --> "You got knocked the f**k out!"* 

## ⚡ Performance Optimizations (NEW in v3.1)

Debo now runs 3x faster with enterprise-grade optimizations:

- **🗄️ Unified Database Service**: Consolidated 17 database managers into 1 efficient service
- **🤖 Optimized Agent Engine**: Batch processing, resource management, automatic cleanup
- **🧠 Smart LLM Manager**: Request batching, response caching, 70% cost reduction
- **💾 Memory Management**: Intelligent cleanup, auto-summarization, no memory leaks
- **🎭 Adaptive Orchestrator**: Single orchestrator with strategy pattern for all workflows

```bash
# Use the optimized server for best performance
npm run start:optimized
npm run dev:optimized
```

## 🧠 The Architecture (Now Domain-Agnostic)

Debo implements a hierarchical multi-agent system that started as a Fortune 500 engineering org... but evolved into something more:

```
Generic Orchestrator (NEW!) 
├── Static Software Agents (The OGs)
│   ├── CTO (Thinking Agent)
│   ├── Engineering Manager (Resource allocation via Hungarian algorithm)
│   ├── Solution Architect (Designs with SOLID principles baked in)
│   └── Product Manager (Converts your rambling into actual requirements)
│       │
│       └── Fast Execution Layer (Execution Agents)
│           ├── Backend Dev (Implements without the "clever" code)
│           ├── Frontend Dev (No, it won't use 47 npm packages for left-pad)
│           ├── QA Engineer (Catches the edge cases you forgot)
│           └── DevOps (Deploys without crying)
│
└── Dynamic Domain Agents (Created at Runtime)
    ├── Legal Agents
    │   ├── Discovery Specialist
    │   ├── Contract Analyzer
    │   └── Compliance Officer
    ├── Scientific Agents
    │   ├── Experiment Designer
    │   ├── Data Analyst
    │   └── Literature Reviewer
    ├── Medical Agents
    │   ├── Diagnosis Assistant
    │   └── Treatment Planner
    └── Your Custom Agents
        └── Whatever you can imagine
```

**Key Enhancement**: All agents now use `EnhancedAgentExecutor` with FULL Redis integration. They actually share data now!

## 💬 Natural Language Interface (Now Works for Everything)

Stop writing YAML. Stop memorizing CLI flags. Stop creating manual workflows. Just talk to it like you talk to a jr dev that the boss hired because he has 5 fancy degrees and 0 experience:

### 1. `debo` - Main tool for ANY request
```bash
# Software Development
debo "spin up a websocket server with JWT auth and rate limiting"

# Legal Work  
debo "analyze these discovery requests for attorney-client privilege"

# Scientific Research
debo "design an experiment to test the effects of pH on enzyme activity"

# Business Process
debo "create a customer onboarding workflow with KYC compliance"

# Business Operations
debo "prepare our quarterly earnings report"
debo "create a competitive analysis for the cloud storage market"
debo "design an employee retention program"
debo "optimize our supply chain for Q4 demand"
```

*"You want some of this too, old man?"* - Debo to your manual processes

### 2. `debo_dialogue` - When Debo needs clarification
```bash
# Debo asks: "What specific legal jurisdiction?"
debo_dialogue --dialogueId "abc123" "Federal court, Southern District of New York"
```

### 3. `debo_query` - Query knowledge or data
```bash
# Query domain knowledge
debo_query "What are the discovery deadlines in federal court?"

# Query agent data
debo_query --agentId "legal_discovery_specialist" "Show all active cases"
```

## 🚀 Quick Start (Choose Your Adventure)

### Optimized Installation (RECOMMENDED - 3x Faster!)
```bash
# One-liner installation
curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash

# Setup and start optimized version
npm run setup              # Installs Redis, Ollama models, etc.
npm run start:optimized    # Start optimized MCP server (FASTEST)

# Or for development
npm run dev:optimized      # With auto-reload and optimization
```

### Standard Installation (Software Development)
```bash
# Setup and start
npm run setup        # If not already done
npm start           # Start standard MCP server
```

### Generic System (For ANY Domain)
```bash
# After installation
npm run setup              # If not already done
npm run start:generic      # Start enhanced generic server

# Or for development
npm run dev:generic        # With auto-reload
```

## 🛠️ Under the Hood (Now Even More Powerful)

- **Dynamic Agent Creation**: Create specialized agents at runtime for any domain
- **Enhanced Redis Integration**: Full data sharing between agents (finally!)
- **Custom Data Schemas**: Each agent stores domain-specific data structures
- **Dialogue System**: Multi-turn conversations when clarification needed
- **RAG Integration**: Knowledge management that actually works
- **Event Sourcing**: Every agent action is recorded. Full replay capability.
- **CQRS Pattern**: Commands and queries separated at the orchestrator level.
- **Saga Pattern**: Distributed transactions across agents with compensating actions.
- **Circuit Breakers**: Because even AI agents need to fail gracefully.
- **Backpressure**: Implements reactive streams spec. No agent left behind.

The quality gateway runs static analysis (without the false positives that make you want to --no-verify).

## 📊 Real-Time Monitoring

```bash
debo monitor
```

Opens a blessed-based TUI showing:
- Agent workload distribution (with heat maps)
- Task dependency DAG
- Real-time code generation
- Token usage (because cloud bills are real)

## 🚀 Deployment Targets

Supports everything from "yolo push to prod" to "enterprise change advisory board approved":

- Vercel (for the hipsters)
- AWS (all services, even the ones nobody uses)
- Kubernetes (with actual working manifests)
- Bare metal (for the real ones)

## 🧪 The Stack

```yaml
thinking_layer:
  - llm: Best thinking models...
  - context: ...
  - temperature: 0.3  # We're not writing poetry here

execution_layer:
  - llm: Best execution models...
  - context: ... 
  - temperature: 0.1  # Deterministic, like it should be

state_management:
  - redis: Because Postgres is overkill for this
  - pattern: Event sourcing with CQRS
  
orchestration:
  - type: Hierarchical task decomposition
  - scheduling: Priority queue with dependency resolution
```

## 🎯 Examples That Actually Matter

### The "It's 3 AM and Production is Down" Scenario
```bash
debo "check what changed in the last 6 hours and rollback if necessary"
```

### The "PM Just Changed Everything" Pattern
```bash
debo "refactor the user service to support multi-tenancy without breaking existing APIs"
```

### The "I Inherited This Codebase" Special
```bash
debo "analyze this project and tell me what poor decisions were made"
```

### The "Legal Emergency" Scenario (NEW)
```bash
debo "create a litigation hold notice for all email communications about Project Phoenix"
```

### The "Research Grant Deadline" Pattern (NEW)
```bash
debo "design a 3-year study on CRISPR applications in rare diseases with budget breakdown"
```

*"Playing with my money is like playing with my emotions"* - Every developer about their code

## 🔧 Configuration

Debo respects `$HOME/.deborc` for the cultured:

```bash
# .deborc
export DEBO_LLM_PROVIDER=ollama  # or openai if you're feeling spendy
export DEBO_THINKING_MODEL=[dynamic selection]
export DEBO_FAST_MODEL=[dynamic selection]
export DEBO_MAX_AGENTS=10  # Prevent fork bombs
export DEBO_QUALITY_THRESHOLD=0.8  # Lower at your own risk
export ENABLE_DYNAMIC_AGENTS=true  # NEW: Enable runtime agent creation
```

## 🐛 Troubleshooting

### "Debo took my entire CPU"
That's not a bug, that's Debo claiming what's rightfully his. But seriously:
```bash
debo config set max_workers 4
```

### "The agents are arguing with each other"
Welcome to distributed systems. The consensus protocol will sort it out.

### "It generated better code than me"
*"Don't be jealous, Craig!"*

### "It created a better legal brief than my lawyer" (NEW)
That's why we have malpractice insurance.

## 🆕 What's New in v3.0 (The Generic Revolution)

- **Dynamic Agent Creation**: Create agents for ANY domain at runtime
- **Full Redis Integration**: Agents actually share data now (revolutionary, I know)
- **Generic Task Processing**: Legal, medical, scientific, business - Debo does it all
- **Dialogue System**: When Debo needs clarification, it asks (politely)
- **Custom Data Schemas**: Each agent stores data its own way
- **RAG Integration**: Knowledge management that actually works

📖 **[Read the Full Generic System Documentation](./GENERIC-SYSTEM-README.md)**

## 🤝 Contributing

PRs welcome, but Debo might rewrite your contribution before merging. Don't take it personally.

Rules:
1. No JavaScript framework of the week
2. Comments should explain why, not what
3. If it needs more than 3 levels of indentation, you're doing it wrong
4. Tests are not optional (looking at you, "I'll add tests later" crowd)

## 📚 Advanced Usage

### Custom Agent Definitions
```javascript
// Yes, you can teach Debo new tricks
debo.defineAgent({
  name: 'patent_attorney',
  model: 'mixtral:8x7b',
  temperature: 0.2,  // Precision matters in law
  domain: 'legal',
  capabilities: ['patent search', 'prior art analysis', 'claim drafting'],
  instructions: 'You are an expert in US patent law...'
});
```

### Pipeline Composition
```bash
# Unix philosophy meets AI
debo "analyze logs" | debo "find anomalies" | debo "generate runbook"
```

## 🎬 Why "Debo"?

Because, this system:
- Takes what it wants (your tasks - ALL of them)
- Doesn't ask permission (autonomous execution)
- Gets things done (usually by force)
- Has your bike now (and your entire workflow across all domains)

*"Shut up. There's a lot you don't know about me, Craig."* - Debo, probably talking about its new generic capabilities

## 📄 License

MIT - Because Debo takes what he wants, but he's not a monster.

---

<div align="center">
  <p><i>"That's my AI system, punk!"</i></p>
  <p>Built by developers who were tired of doing everything manually</p>
  <p>
    <a href="https://github.com/Kevin-Kurka/Debo/issues">Report Bug</a> •
    <a href="https://github.com/Kevin-Kurka/Debo/discussions">Discussions</a> •
    <a href="https://xkcd.com/927/">Standards</a>
  </p>
</div>

## 🔥 Final Words

Remember: With great automation comes great unemployment... I mean, responsibility. Debo doesn't judge your spaghetti code, your messy legal briefs, or your chaotic research notes - it just fixes them while you sleep.

*"First of all, don't be calling me no Deebo. My name is Debo."* - This system, if you misspell it in your commands

Now stop reading and start delegating. Debo's got work to do.

```bash
# Your move, chief
debo "show me what you got"
```