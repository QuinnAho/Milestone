# MILESTONE — Local-First, Event-Driven Task Manager

![MILESTONE](https://img.shields.io/badge/Status-Active-brightgreen) ![Platform](https://img.shields.io/badge/Platform-Desktop-blue) ![Tech](https://img.shields.io/badge/Tech-Electron%20%2B%20React-lightblue)

A modern desktop application that transforms any repository into a controlled, event-driven task management environment. Built with **Electron + React**, this tool operates entirely locally, combining machine-readable prompts, structured documentation, and project architecture into a cohesive system. It reduces token usage for AI prompts, enforces safety with Git, and provides a clean way to track project implementation and status.

## Vision & Architecture

This system works as a **local-first, event-driven task manager** that layers directly over your repository. The desktop app acts as a **control center**: it points to a repository, initializes an `ai/` directory, and listens for user actions such as creating tasks, running provider CLIs (OpenAI, Claude, etc.), or triggering QA checks.

The goal is not to replicate a cloud-based issue tracker but to enable **focused, controlled development sessions** (“vibe coding”) where tasks, prompts, and results live in the repo. The web view or snapshot is mainly for higher-level reporting, giving managers or stakeholders a clear project status without requiring them to interact with the dev environment.

### Core Architecture
```
Repository Root/
├── ai/
│   ├── tasks/                  # Individual task containers
│   │   └── <task-id>/
│   │       ├── progress.ndjson # Append-only event log
│   │       └── artifacts/      # Run outputs & QA results
│   ├── milestones/             # Archived milestones
│   │   └── <milestone-name>/
│   │       ├── <task-id>/
│   │       ├── README.md       # Milestone summary
│   │       └── manifest.json   # Machine-readable data
│   ├── progress.json           # Computed project snapshot
│   └── config/
│       └── providers.json      # AI provider configurations
└── [your project files]
```

### Event-Driven Foundation
Every action produces events (e.g., `task.created`, `run.finished`, `qa.result`) that are appended to `progress.ndjson`. The repo itself becomes the database. A small engine consumes these events, builds a state snapshot (`progress.json`), and enforces safety by using Git to whitelist changes and revert anything unexpected.

## Key Features

### Clean Desktop UI
- Professional dark theme with minimal distractions
- Visual progress indicators and project health status
- Card-based agile board: Backlog → In Progress → Review → Done
- Real-time updates driven by repo state

### AI Provider Integration
- Support for multiple providers (OpenAI, Claude, custom)
- Dry-run mode to preview AI-generated changes
- Git-backed safety: automatic rollback of unapproved changes

### Quality Assurance & Safety
- Automated build/test/lint checks
- All outputs stored under `artifacts/`
- Git-based whitelist and rollback protection

### Milestone Management
- Pack completed tasks into versioned milestones
- AI-generated summaries and machine-readable manifests
- Clean dashboard by archiving completed work

## Development and Usage

### Installation
```bash
git clone <repository-url>
cd milestone
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Using the Application
1. **Initialize Repository**: Select a repo, create `ai/` directory
2. **Create Tasks**: Add tasks with descriptive IDs and titles
3. **Run AI Providers**: Execute prompts, preview or apply changes
4. **Run QA**: Validate builds/tests/lint automatically
5. **Pack Milestones**: Archive completed tasks for clean reporting

## Technical Details
- **Append-only event logs** for complete history
- **Computed state snapshots** for fast UI rendering
- **Git integration** for safety and rollback
- **Configurable providers** via `ai/config/providers.json`

## Future Roadmap
- Optional real-time collaboration (multi-user)
- Plugin architecture for custom workflows
- Optional cloud sync for multi-device use
- Advanced analytics and progress insights

## Privacy & Security
- Local-first architecture — no central server
- All data stays in the repository
- Full audit trail of operations

---

Built for developers who want focus, control, and transparent project status — not a SaaS issue tracker.
