# AI Task Dashboard — Local-First, Event-Driven Task Manager

![AI Task Dashboard](https://img.shields.io/badge/Status-Active-brightgreen) ![Platform](https://img.shields.io/badge/Platform-Desktop-blue) ![Tech](https://img.shields.io/badge/Tech-Electron%20%2B%20React-lightblue)

A modern desktop application that transforms any repository into an intelligent, event-driven task management system. Built with **Electron + React** and featuring a sleek dark theme, this tool operates entirely locally while providing enterprise-grade task tracking and AI integration.

## 🎯 **Vision & Architecture**

This system works as a **local-first, event-driven task manager** that sits directly on top of your repo. The desktop app acts as the **control center**: it points at a repository, initializes an `ai/` directory, and listens for user actions like creating tasks, running provider CLIs (OpenAI, Claude, etc.), or triggering QA checks.

### **Core Architecture**

```
Repository Root/
├── ai/                           # Task management directory
│   ├── tasks/                    # Individual task containers
│   │   └── <task-id>/
│   │       ├── progress.ndjson   # Append-only event log
│   │       └── artifacts/        # Run outputs & QA results
│   ├── progress.json             # Current state snapshot
│   └── config/
│       └── providers.json        # AI provider configurations
└── [your project files]
```

### **Event-Driven Foundation**

Every action produces **events** (like `task.created`, `run.finished`, `qa.result`) that are appended to an **append-only log** (`progress.ndjson`), making **the repo itself the database**. A small "engine" service consumes these events, computes a current state snapshot (`progress.json`), and enforces safety by using **Git to whitelist file changes** and revert anything unexpected.

## 🚀 **Key Features**

### **🎨 Modern Dark Theme UI**
- **Sleek Interface**: Professional dark theme with Inter font
- **Animated Theme Toggle**: Smooth sun/moon scrolling animation
- **Circular Progress**: Visual completion indicators with color coding
- **Responsive Design**: Clean card-based layout with proper spacing

### **📊 Agile Board Visualization**
The UI renders state as a **lightweight agile board**, showing tasks across columns:
- **Backlog** → **In Progress** → **Review** → **Done**
- **Live Status Indicators**: Green/Yellow/Red project health
- **Real-time Updates**: Reflects current repository state
- **Task Management**: Create, track, and organize development tasks

### **🤖 AI Provider Integration**
- **Multi-Provider Support**: OpenAI, Claude, and extensible architecture
- **Dry Run Mode**: Preview changes before execution
- **Safety First**: Git-backed change whitelisting and auto-revert
- **CLI Integration**: Seamless provider command execution

### **🔍 Quality Assurance**
- **Automated QA Checks**: Build, test, and lint verification
- **Audit Trail**: All logs and results saved under `artifacts/`
- **Safety Enforcement**: Automatic rollback of unexpected changes

## 🏁 **Quick Start**

### **Installation**
```bash
# Clone and install dependencies
git clone <repository-url>
cd milestone
npm install
```

### **Development**
```bash
# Start development server (Vite + Electron)
npm run dev
```

### Console Streaming (Dev)
- The Electron main-process logs stream into the renderer via `console:output`.
- In the devtools console, you can subscribe:
  - `window.aidash.onConsoleOutput((e) => console.log('[main]', e.level, e.message))`
- Provider/run output streams over `ai:output`:
  - `window.aidash.onAIOutput((e) => console.log('[provider]', e.type, e.data))`

### Interactive Provider Sessions
- Start Claude/Codex interactively in the repo root and stream live logs:
  - `const { session } = await window.aidash.startProviderInteractive('<repo-path>', { provider: 'claude', prompt: 'Read task from ai/tasks and implement…' })`
  - `window.aidash.onAIOutput((e) => console.log('[session]', e.session, e.type, e.data))`
- Send input/approval to the running CLI:
  - `window.aidash.procWrite(session, 'y\n')`  // approve
  - `window.aidash.procWrite(session, 'n\n')`  // reject
  - `window.aidash.procKill(session)`          // terminate

Notes
- To avoid duplicate logs, the preload ensures only one active `ai:output`/`console:output` listener at a time.
- ANSI/TTY noise (`[?2004h`, cursor codes) is stripped from streamed logs for readability.

### External PowerShell Mode (Windows)
- Launch a separate PowerShell window, change directory to the repo, and pipe the prompt to the provider CLI:
  - `await window.aidash.startProviderExternal('<repo-path>', { provider: 'codex', prompt: 'Read task from ai/tasks and implement…' })`
- This opens an interactive console you can approve/deny directly in PowerShell.
- Artifacts (including the prompt) are saved under `artifacts/<task>/TIMESTAMP/`.

### **Production Build**
```bash
# Build desktop application
npm run build
```

## 🎮 **Using the Application**

### **1. Initialize Repository**
- Launch the desktop app
- Select your project repository path
- Click **Initialize** to create the `ai/` directory structure

### **2. Create Tasks**
- Enter a **Task ID** (e.g., `FEAT-0001`)
- Add a **descriptive title**
- Click **Add Task** to create the task container

### **3. Run AI Providers**
- Select provider: **Claude** or **OpenAI**
- Enter your prompt or requirements
- Choose **Dry Run** for preview or execute directly
- Monitor results in the execution log

### **4. Quality Assurance**
- Click **Run QA** to execute build, test, and lint checks
- View results in the terminal-style output
- All artifacts are automatically saved for audit

### **5. Track Progress**
- Monitor the **circular progress indicator** for completion percentage
- View tasks across the **Kanban board columns**
- Check **status indicators** (Green/Yellow/Red) for project health

## 🛠 **Technical Details**

### **Event System**
- **Append-Only Logging**: Immutable event history in `progress.ndjson`
- **State Snapshots**: Computed views in `progress.json`
- **Event Types**: `task.created`, `run.started`, `run.finished`, `qa.result`, etc.

### **Safety Mechanisms**
- **Git Integration**: Automatic change tracking and whitelisting
- **Rollback Protection**: Revert unexpected file modifications
- **Audit Trail**: Complete history of all operations

### **Provider Architecture**
- **CLI Integration**: Shell execution within repository context
- **Extensible Design**: Easy addition of new AI providers
- **Configuration**: Customizable via `ai/config/providers.json`
- **Authentication**: Handled by individual provider CLIs

## 🔧 **Configuration**

### **Provider Setup**
Providers are configured through their respective CLI tools:
```bash
# Claude setup
claude configure

# OpenAI setup
openai auth login
```

### **Custom Providers**
Add new providers by modifying `ai/config/providers.json`:
```json
{
  "providers": {
    "custom-ai": {
      "command": "custom-ai-cli",
      "args": ["--prompt", "{prompt}", "--task", "{taskId}"]
    }
  }
}
```

## 📁 **Directory Structure**

```
milestone/
├── electron/                 # Electron main process
│   ├── main.js              # Application entry point
│   └── preload.js           # IPC bridge
├── renderer/                # React frontend
│   ├── src/
│   │   ├── main.jsx         # Main application component
│   │   └── styles/
│   │       └── theme.css    # Dark theme styling
│   ├── index.html           # Application shell
│   └── vite.config.js       # Vite configuration
├── src/                     # Core engine
│   └── engine/
│       └── api.js           # Task management API
└── package.json             # Dependencies and scripts
```

## 🌟 **Future Roadmap**

This **local-first, event-driven** model supports exciting future enhancements:

- **Real-time Collaboration**: Multi-user support while maintaining local-first principles
- **Plugin Architecture**: Third-party extensions and custom workflows
- **Cloud Sync**: Optional repository synchronization across devices
- **Advanced Analytics**: Deep insights into development patterns and productivity
- **Integration Hub**: Connect with external tools (Jira, GitHub, Slack)

## 🔒 **Privacy & Security**

- **Local-First**: All data stays on your machine
- **No Central Server**: Complete independence from external services
- **Git Integration**: Leverages existing version control for safety
- **Audit Trail**: Complete transparency of all operations

## 📝 **Notes**

- **Git Recommended**: Full safety features require a Git repository
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Zero Configuration**: Works out of the box with sensible defaults
- **Extensible**: Designed for easy customization and extension

---

**Built with ❤️ for developers who value local-first, event-driven workflows**
