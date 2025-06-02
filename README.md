# Debo - Open Source AI Enterprise System 🚀
*"My grandmama gave me that chain!" - Local AI agents that work for YOU*

<div align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/open--source-100%25-brightgreen.svg" alt="Open Source">
  <img src="https://img.shields.io/badge/runs--locally-✓-blue.svg" alt="Local">
  <img src="https://img.shields.io/badge/dynamic--ports-✓-green.svg" alt="Dynamic Ports">
  <img src="https://img.shields.io/badge/zero--conflicts-✓-orange.svg" alt="Zero Conflicts">
</div>

## What is Debo?

**Production-ready AI enterprise system** with **54 specialized agents** that run entirely on YOUR machine. Featuring automatic port management, zero-conflict installation, and enterprise-grade reliability.

### 🎯 **Core Features**
• **100% Open Source** - MIT licensed, inspect every line of code  
• **Runs Locally** - All 54 agents operate on your hardware via Ollama  
• **Smart Port Management** - Zero conflicts with automatic port assignment  
• **Enterprise Architecture** - Fortune 500 agent structure with quality gates  
• **Privacy First** - Your data never leaves your machine unless you choose  
• **Production Ready** - Built-in monitoring, health checks, and error recovery

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

## ⚡ Installation (One Command - Zero Conflicts)

```bash
curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash
```

### 🛠️ **What Gets Installed Automatically:**
• **Dynamic Port Management** - Never conflicts with existing services  
• **Ollama + AI Models** - Local enterprise-grade AI (qwen2.5:7b, qwen2.5:14b)  
• **Redis Database** - Your private local data storage  
• **54 Business Agents** - Complete Fortune 500 enterprise structure  
• **Web Dashboard** - Real-time monitoring at `http://localhost:8400`  
• **WebSocket Services** - Live status updates and notifications  

### ✅ **Installation Features:**
- **Zero Port Conflicts** - Automatically finds available ports  
- **Multiple Installations** - Run several instances without issues  
- **Development Friendly** - Works alongside any existing services  
- **Instant Feedback** - Real-time progress with clear error messages

## 🏢 Your Local AI Workforce

• **54 Business Agents** - Complete Fortune 500 structure on YOUR machine
• **Natural Language Interface** - Just talk to them normally  
• **Cross-Department Collaboration** - Agents work together locally
• **Optional External Access** - Reach out to web/APIs only when needed
• **Complete Transparency** - Inspect and modify every agent's code
• **Any Domain** - Technical, financial, legal, operational tasks

## 🚀 How to Use

After installation, everything runs locally with zero configuration needed:

```bash
# Check system status and ports
debo health
debo ports
debo status

# All processing happens on YOUR machine
debo "create a REST API with authentication"
debo "analyze our Q3 financials" 
debo "design an employee onboarding process"
debo "research market trends in renewable energy"  # Only this reaches out if configured

# Monitor in real-time
open http://localhost:8400  # Web dashboard (port auto-assigned)
```

### 🔧 **Available Commands:**
```bash
debo health     # System health check
debo ports      # Show port assignments  
debo status     # Detailed system status
debo dashboard  # Launch terminal dashboard
debo analyze    # Analyze existing codebase
```

## 🎯 Why Choose Debo?

### **🏢 For Enterprises**
• **Complete Control** - Modify any agent, add custom capabilities  
• **Zero Vendor Lock-in** - Run entirely on your infrastructure  
• **Cost Effective** - No per-request charges, no usage limits  
• **Compliance Ready** - Data never leaves your environment  
• **Scalable Architecture** - Enterprise-grade patterns and practices  

### **👨‍💻 For Developers**  
• **Smart Port Management** - Never breaks your development environment  
• **Real-time Monitoring** - Web dashboard + terminal interface  
• **Quality Gates** - Built-in confidence scoring and validation  
• **Error Recovery** - Anti-circular error logic prevents infinite loops  
• **Extensible** - Add new agents, integrate your tools  

### **🚀 For Teams**
• **Collaborative** - Multiple users, zero conflicts  
• **Transparent** - See exactly what each agent is doing  
• **Always Available** - No internet required for core functionality  
• **Production Ready** - Built-in health checks and monitoring

## 🏗️ Production Architecture

```
Your Machine (Zero Conflicts, Auto-Configured)
├── 🌐 Network Layer (Dynamic Ports)
│   ├── MCP Server (8000-8099 range)
│   ├── WebSocket (8100-8199 range)  
│   ├── Dashboard (8400-8499 range)
│   └── Port Manager (conflict detection)
│
├── 🤖 AI Agent Layer (54 Agents)
│   ├── CEO Agent (Strategic Analysis)
│   ├── C-Suite (8 Executive Agents)
│   │   ├── CFO, COO, CTO, CMO, CHRO, CLO, CRO
│   └── Departments (46 Specialist Agents)
│       ├── Finance (8), Engineering (11), Legal (6)
│       ├── Sales (6), Marketing (6), Operations (6), HR (6)
│
├── 💾 Data Layer
│   ├── Redis (Local persistence)
│   ├── Ollama (AI models: qwen2.5:7b, 14b)
│   └── File System (Projects, logs, cache)
│
└── 🛡️ Quality Layer
    ├── Confidence Scoring (90%+ threshold)
    ├── Error Recovery (Anti-circular logic)
    ├── Health Monitoring (Real-time)
    └── Performance Metrics (Dashboard)

All services auto-configure ports to avoid conflicts
```

## 🔧 System Requirements

• **Node.js** 18+ (auto-installed if missing)  
• **8GB RAM** minimum (16GB recommended for best performance)  
• **20GB disk space** for AI models and data  
• **macOS/Linux** (Windows WSL2 supported)  
• **Internet** only for initial setup and optional external access  
• **No port configuration needed** - automatic port management  

### 🚦 **Status Indicators:**
- ✅ **Green**: Service running on assigned port  
- 🟡 **Yellow**: Service starting/port assignment in progress  
- ❌ **Red**: Service failed/port conflict detected (auto-recovery)  
- 🔵 **Blue**: Service available but not started

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

## 📊 Performance & Reliability

### **⚡ Performance Stats**
• **Startup Time**: <5 seconds with dynamic port assignment  
• **Local Processing**: Real-time parallel execution across 54 agents  
• **Memory Usage**: Optimized with auto-cleanup and monitoring  
• **Zero External Costs** - After initial setup, no ongoing fees  
• **Unlimited Usage** - No rate limits, quotas, or restrictions  

### **🛡️ Reliability Features**
• **Auto Port Recovery** - Reassigns ports if conflicts detected  
• **Health Monitoring** - Continuous system health checks  
• **Error Recovery** - Anti-circular logic prevents infinite loops  
• **Quality Gates** - 90%+ confidence threshold for all outputs  
• **Graceful Shutdown** - Clean service termination and port release

## 🛠️ Customization

```bash
# Add your own agents
debo "create a custom agent for inventory management"

# Modify existing agents  
vim src/agents/fortune500-roles.js

# Configure external access
vim .env  # Set API keys only if you want external access
```

## 🆘 Quick Help & Troubleshooting

```bash
# System diagnostics
debo health          # Complete system health check
debo ports           # Show all port assignments
debo status          # Detailed system status

# Monitoring
debo dashboard       # Terminal dashboard
open http://localhost:8400  # Web dashboard (port auto-detected)

# Common fixes
npm run clean        # Clean Redis data and restart
debo ports           # Check for port conflicts
npm run setup        # Reconfigure system

# Advanced
export DEBUG_TESTS=1 npm test    # Debug mode testing
tail -f logs/debo.log           # Real-time log monitoring
```

### 🔧 **Troubleshooting Guide**
| Issue | Solution |
|-------|----------|
| Port conflicts | Run `debo ports` - system auto-reassigns |
| Startup hangs | Check `debo health` - Redis/Ollama status |
| Service errors | Check web dashboard for real-time status |
| Memory issues | Run `npm run clean` to clear Redis cache |

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

## 🚀 Get Started (Zero Configuration)

```bash
# One command installs everything with smart port management
curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash

# Verify installation 
debo health && debo ports

# Start creating
debo "build me a REST API with authentication and user management"
```

### 🎯 **What Happens Next:**
1. **Auto-Detection** - System finds available ports automatically
2. **Clean Install** - No conflicts with your existing services  
3. **Instant Ready** - 54 agents ready to work in under 5 minutes
4. **Web Dashboard** - Real-time monitoring at assigned port
5. **Production Ready** - Enterprise-grade reliability from day one

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