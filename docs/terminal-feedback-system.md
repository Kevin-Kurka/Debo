# Debo Terminal Feedback System

## Overview

The Terminal Feedback System provides real-time, verbose visibility into all Debo operations. It displays parallel agent activities, database operations, and detailed progress tracking in an interactive terminal UI.

## Features

### 1. **Multiple View Modes**
- **Parallel View**: Shows all active agents side by side
- **Sequential View**: Shows one agent at a time with detailed logs
- **Summary View**: High-level overview of all operations

### 2. **Real-time Updates**
- Live progress bars for each agent
- Database operation logging
- Task status tracking
- Agent activity monitoring

### 3. **Interactive Controls**
- Keyboard shortcuts for navigation
- Layout switching
- Log clearing
- Help system

## Usage

### Running with Terminal UI

```bash
# Start Debo with terminal UI enabled
npm run start:ui

# Development mode with terminal UI
npm run dev:ui

# Run the demo
npm run test:ui
```

### Environment Variables

- `DEBO_TERMINAL_UI=true` - Enable terminal UI
- `DEBO_TERMINAL_MODE=true` - Run in dedicated terminal mode

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Switch to Parallel view |
| `2` | Switch to Sequential view |
| `3` | Switch to Summary view |
| `↑/k` | Scroll up |
| `↓/j` | Scroll down |
| `PgUp` | Page up |
| `PgDown` | Page down |
| `c` | Clear logs |
| `v` | Toggle verbose mode |
| `h/?` | Show help |
| `q/Ctrl+C` | Quit |

## Architecture

### Components

1. **TerminalFeedbackSystem** (`src/terminal-feedback-system.js`)
   - Main controller for the terminal UI
   - Manages layouts and event handling
   - Coordinates updates between components

2. **TerminalProgressManager** (`src/terminal-progress-manager.js`)
   - Manages multiple progress bars
   - Handles concurrent operations
   - Provides smooth updates without flicker

3. **TerminalLayouts** (`src/terminal-layouts.js`)
   - Defines different layout configurations
   - Manages blessed UI components
   - Handles layout switching

4. **TerminalEventFormatter** (`src/terminal-event-formatter.js`)
   - Formats events for display
   - Provides color coding and icons
   - Handles text wrapping and truncation

### Integration Points

1. **Task Manager Integration**
   - Reports database operations
   - Emits task status events
   - Tracks agent activities

2. **Enhanced Executor Integration**
   - Reports agent progress
   - Shows available data
   - Displays objectives and next steps

## Event Flow

```
Agent Activity → Task Manager → Feedback System → Terminal UI
                      ↓
              Database Operations
```

## Display Elements

### Agent Activity Box
Shows for each active agent:
- Agent role and status
- Current task
- Objective
- Progress bar
- Available data
- Next steps
- Recent activities

### Database Operations Box
Shows real-time database operations:
- Operation type (read/write/update/delete)
- Table name
- Key
- Agent performing operation
- Success/failure status

### Progress Bars
- Multiple concurrent progress bars
- Agent name and task
- Percentage complete
- ETA calculation
- Color-coded status

## Customization

### Adding New Agent Types

Update the role colors in `TerminalEventFormatter`:
```javascript
this.roleColors = {
  'new_role': 'color',
  // ...
};
```

### Custom Status Icons

Modify the icon mappings in `TerminalEventFormatter`:
```javascript
getRoleIcon(role) {
  const icons = {
    'new_role': '🆕',
    // ...
  };
}
```

## Performance Considerations

- Updates are batched to prevent flicker
- Maximum number of visible progress bars is limited
- Old completed tasks are automatically cleaned up
- Log buffer has a maximum size to prevent memory issues

## Troubleshooting

### Terminal UI Not Showing
- Ensure `DEBO_TERMINAL_UI=true` is set
- Check that blessed is installed: `npm install blessed`
- Verify terminal supports Unicode

### Display Issues
- Try different terminal emulators
- Ensure terminal size is sufficient (minimum 80x24)
- Check for conflicting terminal applications

### Performance Issues
- Reduce update frequency in `startUpdateLoop()`
- Limit number of concurrent progress bars
- Clear logs periodically with `c` key

## Future Enhancements

1. **Metrics Dashboard**
   - Real-time performance metrics
   - Success/failure rates
   - Average execution times

2. **Log Export**
   - Save logs to file
   - Filter and search capabilities
   - Log replay functionality

3. **Remote Monitoring**
   - WebSocket integration
   - Browser-based UI option
   - Multi-user support

4. **Enhanced Visualizations**
   - Dependency graphs
   - Task flow diagrams
   - Resource utilization charts