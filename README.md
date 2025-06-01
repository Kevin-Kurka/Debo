# Debo - "My grandmama gave me that chain!" 🤖

<div align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg" alt="Node">
  <img src="https://img.shields.io/badge/redis-%3E%3D6.0-red.svg" alt="Redis">
  <img src="https://img.shields.io/badge/status-GENERIC_AI_SYSTEM-purple.svg" alt="Generic">
</div>

<br>

> *"What bike? THAT'S MY BIKE, PUNK!"* - Debo
> 
> Just like Debo from Friday, this system will take ANY task and make it its own. Software? Legal? Scientific? Business? Debo don't discriminate. 

## 🚴 What's Debo?

**MAJOR UPDATE**: Debo isn't just for coding anymore. It's a generic AI system that creates specialized agents for ANY domain at runtime.

```bash
# Software Development (classic Debo)
debo "build me a distributed cache with consistent hashing"

# Legal Discovery (new Debo)
debo "create an agent to manage federal court discovery procedures"

# Scientific Research (new Debo)
debo "I need help designing experiments for enzyme kinetics"

# Business Process (new Debo)
debo "automate our customer onboarding with compliance checks"

# Literally Anything (new Debo)
debo "create an agent that helps me [insert your domain here]"
```

Natural language. Any domain. Dynamic agent creation. Full Redis data sharing.

## 🏃‍♂️ One-Line Installation (Because We're Not Savages)

```bash
curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash
```

*"You got knocked the f*** out!"* - Your manual deployment process after meeting Debo

## 🧠 The Architecture (Now With Dynamic Agents)

Debo now implements BOTH static agents (for software) AND dynamic agents (for everything else):

```
Generic Orchestrator (NEW!)
├── Static Software Agents (Original)
│   ├── CTO, Engineering Manager, Architects
│   └── Developers, QA, DevOps
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

## 💬 Natural Language Interface (Now Domain-Agnostic)

Three powerful tools at your disposal:

### 1. `debo` - Main tool for ANY request
```bash
# Software Development
debo "build a websocket server with JWT auth"

# Legal Work
debo "analyze these discovery requests for privilege"

# Scientific Research  
debo "design an experiment to test drug efficacy"

# Business Process
debo "create a customer onboarding workflow"

# Agent Creation
debo "create an agent that specializes in tax preparation"
```

### 2. `debo_dialogue` - Continue conversations
```bash
# When Debo needs clarification
debo_dialogue --dialogueId "abc123" "Yes, it should handle federal and state taxes"
```

### 3. `debo_query` - Query knowledge or data
```bash
# Query domain knowledge
debo_query "What are the discovery deadlines in federal court?"

# Query agent data
debo_query --agentId "legal_discovery_specialist" "Show all active cases"
```

## 🚀 Quick Start (Choose Your Adventure)

### Standard Installation (Software Development)
```bash
# One-liner installation
curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash

# Setup and start
npm run setup        # Installs Redis, Ollama models, etc.
npm start           # Start standard MCP server
```

### Generic System (NEW - For ANY Domain)
```bash
# After installation
npm run setup              # If not already done
npm run start:generic      # Start enhanced generic server

# Or for development
npm run dev:generic        # With auto-reload
```

## 🛠️ Under the Hood (Now Even Better)

- **Dynamic Agent Creation**: Create specialized agents at runtime
- **Enhanced Redis Integration**: Full data sharing between agents (finally!)
- **Custom Data Schemas**: Each agent can define domain-specific structures
- **Dialogue System**: Multi-turn conversations for clarification
- **RAG Integration**: Knowledge management across domains
- **Event Sourcing**: Every agent action recorded
- **CQRS Pattern**: Commands and queries separated
- **Saga Pattern**: Distributed transactions with compensating actions

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
  - llm: qwen2.5:14b
  - context: 32k tokens
  - temperature: 0.3  # We're not writing poetry here

execution_layer:
  - llm: qwen2.5:7b
  - context: 8k tokens  
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

*"Playing with my money is like playing with my emotions"* - Every developer about their code

## 🔧 Configuration

Debo respects `$HOME/.deborc` for the cultured:

```bash
# .deborc
export DEBO_LLM_PROVIDER=ollama  # or openai if you're feeling spendy
export DEBO_THINKING_MODEL=qwen2.5:14b
export DEBO_FAST_MODEL=qwen2.5:7b
export DEBO_MAX_AGENTS=10  # Prevent fork bombs
export DEBO_QUALITY_THRESHOLD=0.8  # Lower at your own risk
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
  name: 'chaos_engineer',
  model: 'mixtral:8x7b',
  temperature: 0.9,  // Living dangerously
  instructions: 'Break things responsibly'
});
```

### Pipeline Composition
```bash
# Unix philosophy meets AI
debo "analyze logs" | debo "find anomalies" | debo "generate runbook"
```

## 🎬 Why "Debo"?

Because just like the character, this system:
- Takes what it wants (your development tasks)
- Doesn't ask permission (autonomous execution)
- Gets things done (usually by force)
- Has your bike now (and your entire development workflow)

*"Shut up. There's a lot you don't know about me, Craig."* - Debo, probably talking about its advanced ML capabilities

## 📄 License

MIT - Because Debo takes what he wants, but he's not a monster.

---

<div align="center">
  <p><i>"That's my development system, punk!"</i></p>
  <p>Built by developers who were tired of developing</p>
  <p>
    <a href="https://github.com/Kevin-Kurka/Debo/issues">Report Bug</a> •
    <a href="https://github.com/Kevin-Kurka/Debo/discussions">Discussions</a> •
    <a href="https://xkcd.com/927/">Standards</a>
  </p>
</div>

## 🔥 Final Words

Remember: With great automation comes great unemployment... I mean, responsibility. Debo doesn't judge your spaghetti code, it just rewrites it while you sleep.

*"First of all, don't be calling me no Deebo. My name is Debo."* - This system, if you misspell it in your commands

Now stop reading and start delegating. Debo's got work to do.

```bash
# Your move, chief
debo "show me what you got"
```