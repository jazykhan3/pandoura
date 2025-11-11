# Pandaura – PLC Logic Management System

**Milestone 2 Complete** ✅

A modern, web-based PLC logic management system for safe testing and deployment of industrial control logic.

## Current Status

- ✅ **Milestone 1**: Complete UI shell with routing, theming, and layout
- ✅ **Milestone 2**: Functional logic editor, sync engine, simulator, and tag integration
- ⏳ **Milestone 3**: Planned — Version control, safety checks, rollback

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Tech Stack

### Core
- React 19.1.1 + TypeScript
- Vite (build tool)
- Tailwind CSS (custom Pandaura theme)
- Framer Motion (transitions)
- Zustand (state management)

### Milestone 2 Additions
- Monaco Editor (code editing with ST syntax)
- WebSocket (real-time sync simulation)
- Lucide React (icons)
- Radix UI primitives (tooltips, scroll areas)

## Features

### ✅ Logic Editor (Milestone 2)
- Full-featured ST (Structured Text) code editor
- Syntax highlighting with custom ST language definition
- Real-time validation and linting
- Tag autocomplete from Tag Database
- Save/load with persistence
- Breakpoint support for debugging
- Send to Shadow runtime
- Multi-file management

### ✅ Live Sync Engine (Milestone 2)
- WebSocket-based real-time synchronization
- Bi-directional tag streaming (shadow ↔ live)
- Conflict detection and resolution UI
- Latency monitoring (target <20ms)
- Event logging with timestamps
- Push to shadow/live with safety checks

### ✅ Simulator (Milestone 2)
- Safe testing environment for logic
- Run/Pause/Step/Stop controls
- Digital and analog I/O controls
- Real-time trace logging
- Breakpoint integration
- Execution speed control (0.5x to 10x)
- Log export (.log file download)

### ✅ Tag Database (Milestone 2)
- Tag CRUD operations
- Search and filter
- Sync to shadow runtime
- Extended tag model (source, metadata, units)
- Integration with editor autocomplete

### ✅ Shadow Runtime (Milestone 2)
- Overview with live process mirror
- Sync Console with conflict resolution
- Simulator integration
- Runtime health metrics
- Connection status monitoring

## Structure

```
src/
  components/
    Layout.tsx              # Sidebar, Topbar, Workspace, StatusBar
    MonacoEditor.tsx        # ST code editor with syntax highlighting
    SyncConsole.tsx         # Real-time sync UI
    Simulator.tsx           # Logic simulator UI
    Card.tsx                # Reusable card component
    StatusIndicator.tsx     # Connection status indicators
  pages/
    Dashboard.tsx           # Overview and activity
    ShadowRuntime.tsx       # Shadow runtime with tabs (Overview/Sync/Simulator)
    TagDatabase.tsx         # Tag management and sync
    LogicEditor.tsx         # Full logic editing experience
    Deploy.tsx              # Deployment history
    SettingsPage.tsx        # Configuration
  store/
    uiStore.ts              # UI state (active route)
    logicStore.ts           # Logic files, validation, save/load
    syncStore.ts            # Sync status, events, conflicts
    simulatorStore.ts       # Simulator state, I/O, logs
    tagStore.ts             # Tag database caching
  services/
    api.ts                  # REST API calls (dummy mode)
    websocket.ts            # WebSocket sync service (mock)
  types/
    index.ts                # TypeScript definitions
  data/
    mockData.ts             # Sample data for development
```

## Documentation

- **[MILESTONE-2-README.md](./MILESTONE-2-README.md)** — Complete technical documentation
- **[MILESTONE-2-USER-GUIDE.md](./MILESTONE-2-USER-GUIDE.md)** — Step-by-step user walkthroughs
- **[MILESTONE-1-CHECKLIST.md](./MILESTONE-1-CHECKLIST.md)** — Milestone 1 completion checklist

## Design System

- **Primary accent**: #FF6A00 (orange — sidebar, buttons, highlights)
- **Background**: #FFFFFF
- **Surface**: #F9FAFB
- **Text**: #1A1A1A
- **Borders**: #E5E7EB
- **Status colors**: Green (success), Amber (warning), Red (error), Blue (info)
- **Animations**: 250ms fade/slide via Framer Motion
- **Responsive**: Down to 1366×768

## Backend Note

**Milestone 2 uses dummy API responses** that simulate a backend at `localhost:8000`. No actual backend server is required.

All features are fully functional with:
- Simulated API delays (300-1200ms)
- Mock WebSocket with real-time events
- In-memory state management
- localStorage persistence

To connect to a real backend (Milestone 3), set `DUMMY_MODE = false` in `/src/services/api.ts`.

## Development

```bash
npm run dev      # Start dev server (port 5173)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Testing Milestone 2

### Quick Demo

1. **Logic Editor**: Open → Load Temperature_Control.st → Edit → Validate → Save → Send to Shadow
2. **Simulator**: Run in Simulator → Adjust Temperature_PV slider → Watch Heater_Output respond
3. **Sync Console**: View real-time tag updates → Wait for conflict → Resolve with Keep Shadow/Live
4. **Tag Database**: Click Sync to Shadow → Return to editor → Use tag autocomplete

See [User Guide](./MILESTONE-2-USER-GUIDE.md) for detailed walkthroughs.

## Key Achievements

| Feature | Milestone 1 | Milestone 2 |
|---------|-------------|-------------|
| UI Shell & Layout | ✅ | ✅ |
| Monaco Code Editor | — | ✅ |
| ST Syntax Highlighting | — | ✅ |
| Save/Load Logic | — | ✅ |
| Validation & Linting | — | ✅ |
| Tag Autocomplete | — | ✅ |
| WebSocket Sync | — | ✅ |
| Conflict Resolution | — | ✅ |
| Simulator | — | ✅ |
| Breakpoint Debugging | — | ✅ |
| Tag Database Integration | — | ✅ |

**All Milestone 2 acceptance criteria met** ✅

## Roadmap

### Milestone 3 (Planned)
- Full version control with snapshots
- Advanced safety checks for live deployment
- Enhanced diff view (line-by-line)
- Vendor-specific exporters (Rockwell/Siemens/Beckhoff)
- Real SQLite backend integration
- Rollback capabilities
- Multi-project workspace
- Deployment history and audit trail

## Troubleshooting

**Monaco Editor import errors**: Fixed — uses correct imports from `@monaco-editor/react`

**Tags not in autocomplete**: Go to Tag Database → Click "Sync to Shadow"

**Simulator not running**: Ensure logic file is open → Click "Run in Simulator" → Go to Shadow Runtime > Simulator tab

**Sync shows disconnected**: Refresh page — WebSocket auto-reconnects after 5 seconds

See [MILESTONE-2-README.md](./MILESTONE-2-README.md) for complete troubleshooting guide.

## License

Proprietary — Pandaura PLC Logic Management System

---

**Built for industrial automation engineers** 🏭
