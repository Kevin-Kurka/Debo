# Debo - Open Source AI Enterprise System 🚀
*"My grandmama gave me that chain!" - Local AI agents that work for YOU*

<div align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/open--source-100%25-brightgreen.svg" alt="Open Source">
  <img src="https://img.shields.io/badge/runs--locally-✓-blue.svg" alt="Local">
</div>

## What is Debo?

**Open source AI enterprise system** with **54 specialized agents** that run entirely on YOUR machine. No data leaves your environment unless YOU want it to. Complete privacy, total control.

• **100% Open Source** - MIT licensed, inspect every line of code
• **Runs Locally** - All 54 agents operate on your hardware via Ollama
• **Reach Out When Needed** - Agents can access web/APIs only when you permit
• **Your Data Stays Yours** - Everything stored in your local Redis instance
• **No Vendor Lock-in** - Use any LLM provider or stay completely local

## 🔒 Privacy-First Design

```bash
# Everything runs locally by default
┌─────────────────────────────────────┐
│ YOUR MACHINE (Complete Privacy)     │
├─────────────────────────────────────┤
│ ✓ 54 AI Agents (Local Ollama)      │
│ ✓ Redis Database (Your Data)       │
│ ✓ All Processing (Local CPU/GPU)   │
│ ✓ No External Dependencies         │
└─────────────────────────────────────┘
           │
           │ (Only when YOU choose)
           ▼
┌─────────────────────────────────────┐
│ EXTERNAL (Optional)                 │
├─────────────────────────────────────┤
│ ? Web Research (if requested)       │
│ ? API Calls (if configured)        │
│ ? Cloud LLMs (if you want)         │
└─────────────────────────────────────┘
```

## ⚡ Installation (One Command)

```bash
curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash
```

This installs everything locally:
• **Ollama** with enterprise AI models
• **Redis** for your private data storage
• **54 Business Agents** ready to work
• **Zero external dependencies** required

## 🏢 Your Local AI Workforce

• **54 Business Agents** - Complete Fortune 500 structure on YOUR machine
• **Natural Language Interface** - Just talk to them normally  
• **Cross-Department Collaboration** - Agents work together locally
• **Optional External Access** - Reach out to web/APIs only when needed
• **Complete Transparency** - Inspect and modify every agent's code
• **Any Domain** - Technical, financial, legal, operational tasks

## 🚀 How to Use

After installation, everything runs locally through the `debo` command:

```bash
# All processing happens on YOUR machine
debo "create a REST API with authentication"
debo "analyze our Q3 financials" 
debo "design an employee onboarding process"
debo "research market trends in renewable energy"  # Only this reaches out if configured
```

## 🎯 Open Source Advantages

• **Complete Control** - Modify any agent, add custom capabilities
• **Privacy Guaranteed** - Your data never leaves your machine
• **Cost Effective** - No per-request charges, no usage limits
• **Always Available** - No internet required for core functionality
• **Transparent** - See exactly what each agent is doing
• **Extensible** - Add new agents, integrate your tools

## 🏗️ Local Architecture

```
Your Machine (Completely Private)
├── CEO Agent (Strategic Analysis)
├── C-Suite (8 Executive Agents)
│   ├── CFO - Financial Strategy
│   ├── COO - Operations  
│   ├── CTO - Technology
│   ├── CMO - Marketing
│   ├── CHRO - Human Resources
│   ├── CLO - Legal
│   └── CRO - Revenue
│
└── Departments (46 Specialist Agents)
    ├── Finance (8 agents)
    ├── Engineering (11 agents) 
    ├── Legal (6 agents)
    ├── Sales (6 agents)
    ├── Marketing (6 agents)
    ├── Operations (6 agents)
    └── HR (6 agents)

All powered by YOUR local Ollama instance
```

## 🔧 System Requirements

• **Node.js** 18+ 
• **8GB RAM** minimum (16GB recommended)
• **20GB disk space** for models
• **macOS/Linux** (Windows WSL2 supported)
• **Internet** only for initial setup and optional external access

## 🌐 When Agents Reach Out (Optional)

Agents only access external resources when:
• You explicitly request web research
• You configure API integrations  
• You enable cloud LLM providers

Examples:
```bash
# Stays completely local
debo "create a node.js API server"

# Will reach out for current information (with your permission)
debo "research the latest cybersecurity trends"
debo "get current stock prices for our portfolio"
```

## 📊 Performance Stats

• **Startup Time**: <5 seconds
• **Local Processing**: Real-time parallel execution
• **Memory Usage**: Optimized with auto-cleanup
• **Zero External Costs** - After initial setup
• **Unlimited Usage** - No rate limits or quotas

## 🛠️ Customization

```bash
# Add your own agents
debo "create a custom agent for inventory management"

# Modify existing agents  
vim src/agents/fortune500-roles.js

# Configure external access
vim .env  # Set API keys only if you want external access
```

## 🆘 Quick Help

```bash
# Check what's running locally
debo "system status"

# See agent activity  
debo "show me what all agents are working on"

# Health check
npm run health

# Clean restart
npm run clean && npm start
```

## 🔓 Open Source Benefits

✅ **MIT Licensed** - Use commercially, modify freely  
✅ **No Vendor Lock-in** - Your system, your rules  
✅ **Community Driven** - Contribute improvements  
✅ **Transparent** - Every algorithm visible  
✅ **Privacy First** - Data stays on your machine  
✅ **Cost Effective** - No subscription fees  

## 🎬 Why "Debo"?

Because this system takes over ALL your business tasks while respecting YOUR ownership. Local processing, open source code, your data stays yours.

*"That's MY enterprise system, running on MY machine!"* 

---

## 🚀 Get Started

```bash
curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash
```

**Your local AI workforce is waiting. Private, powerful, and completely under your control.** 🔒⚡

---

<div align="center">
  <p><strong>Open Source • Privacy First • Runs Locally</strong></p>
  <p>
    <a href="https://github.com/Kevin-Kurka/Debo/issues">Report Issues</a> •
    <a href="https://github.com/Kevin-Kurka/Debo/discussions">Community</a> •
    <a href="LICENSE">MIT License</a>
  </p>
</div>