# Debo - "My grandmama gave me that chain!" 🤖

<div align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg" alt="Node">
  <img src="https://img.shields.io/badge/redis-%3E%3D6.0-red.svg" alt="Redis">
</div>

<br>

> *"What bike? THAT'S MY BIKE, PUNK!"* - Debo
> 
> This system will take your development tasks and make them its own. But instead of stealing bikes, it's commandeering your entire SDLC. 

## 🚴 What's Debo?

Remember when you had to actually *write* code? When you had to *think* about architecture? When deployment meant more than just saying "deploy this"? Yeah, Debo's takes all that. 

```bash
# Old way (3 months ago)
mkdir my-app && cd my-app && npm init && npm install express && ...
... boiler plate
... boiler plate
... boiler plate
... some code
... boiler plate
... bug fixes
... boiler plate
... you anit got no job smokey
... boiler plate
... boiler plate
...
...
...

# Debo way
debo "build me a distributed cache with consistent hashing, but make it web-scale"
```

That's it. Natural language. No more Stack Overflow archaeology. No more reading docs written by people who clearly hate you.

## 🏃‍♂️ One-Line Installation (Because We're Not Savages)

```bash
curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash
```

*Manual Process --> "You got knocked the f**k out!"* 

## 🧠 The Architecture

Debo implements a hierarchical multi-agent system that mirrors a Fortune 500 engineering org. Think Conway's Law, but intentional:

```
CTO (Thinking Agent)
├── Engineering Manager (Resource allocation via Hungarian algorithm)
├── Solution Architect (Designs with SOLID principles baked in)
└── Product Manager (Converts your rambling into actual requirements)
    │
    └── Fast Execution Layer (Execution Agents)
        ├── Backend Dev (Implements without the "clever" code)
        ├── Frontend Dev (No, it won't use 47 npm packages for left-pad)
        ├── QA Engineer (Catches the edge cases you forgot)
        └── DevOps (Deploys without crying)
```

Each agent maintains its own context window, implements backpressure, and yes, we're using Redis for state management because we're not masochists.

## 💬 Natural Language Interface (The Only Interface That Matters)

Stop writing YAML. Stop memorizing CLI flags. Just talk to it like you you talk to a jr dev that the boss hired because he has 5 fancy degrees and 0 expirence:

```bash
# Project creation
debo "spin up a websocket server with JWT auth and rate limiting"

# Feature addition  
debo "add a Redis-backed session store with sliding window expiration"

# Debugging
debo "why is my API returning 500s after exactly 1024 requests?"

# Deployment
debo "deploy this to prod but run the integration tests first"
```

*"You want some of this too, old man?"* - SELECT FROM WHERE...

## 🛠️ Under the Hood (For the Curious)

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

*"Playing with my money is like playing with my emotions"* - Every developer about their code

## 🔧 Configuration

Debo respects `$HOME/.deborc` for the cultured:

```bash
# .deborc
export DEBO_LLM_PROVIDER=ollama  # or openai if you're feeling spendy
export DEBO_THINKING_MODEL= [dynamic selection]
export DEBO_FAST_MODEL=[dynamic selection]
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

Because, this system:
- Takes what it wants (your development tasks)
- Doesn't ask permission (autonomous execution)
- Gets things done (usually by force)
- Has your bike now (and your entire development workflow)

*"Shut up. There's a lot you don't know about me, Craig."*

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

Remember: With great automation comes great unemployment... Debo doesn't judge your spaghetti code, it just rewrites it while you sleep.


Now stop reading and start delegating. Debo's got work to do.

```bash
# Your move, chief
debo "show me what you got"
```
