# Dive AI Agent 🤿

![GitHub stars](https://img.shields.io/github/stars/OpenAgentPlatform/Dive?style=social)
![GitHub forks](https://img.shields.io/github/forks/OpenAgentPlatform/Dive?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/OpenAgentPlatform/Dive?style=social)
![GitHub repo size](https://img.shields.io/github/repo-size/OpenAgentPlatform/Dive)
![GitHub language count](https://img.shields.io/github/languages/count/OpenAgentPlatform/Dive)
![GitHub top language](https://img.shields.io/github/languages/top/OpenAgentPlatform/Dive)
![GitHub last commit](https://img.shields.io/github/last-commit/OpenAgentPlatform/Dive?color=red)
![Hits](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2FOpenAgentPlatform%2FDive&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=hits&edge_flat=false)

Dive is an open-source AI Agent desktop application that seamlessly integrates any Tools Call-supported LLM with frontend MCP Server—part of the Open Agent Platform initiative.

## Features

- Universal LLM Support: Compatible with ChatGPT O3-mini, Deepseek V3, Sonnet3.5v2, and local Ollama models
- Cross-Platform: Available for Windows, MacOS, and Linux
- Model Context Protocol: Enabling seamless AI agent integration
- Upcoming Features: Prompt Schedule and OpenAgentPlatform MarketPlace


## Table of Contents

- [Development Requirements](#development-requirements)
- [Development](#development)
  - [Install dependencies](#install-dependencies)
  - [Start development server](#start-development-server)
- [Build for production](#build-for-production)
  - [Cross-platform Build for Windows](#cross-platform-build-for-windows)
- [Scripts](#scripts)
- [Package Scripts](#package-scripts)
- [MCP Server Setup](#mcp-server-setup)
  - [1. Add New MCP Server via GUI](#1-add-new-mcp-server-via-gui)
  - [2. Edit config.json directly](#2-edit-configjson-directly)
  - [3. Using Config Editor](#3-using-config-editor)
  - [4. Custom Scripts](#4-custom-scripts)
- [Project Architecture](#project-architecture)

## Development Requirements

- Node.js LTS+

## Development

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev:electron
```

## Build for production

```bash
npm run package
```

### Cross-platform Build for Windows

If you are on macOS or Linux and want to build for Windows:

1. Download Windows Node.js binary
```bash
npm run download-node:win-x64
```

2. Build using Docker
```bash
./scripts/docker/build-win.sh
```

## Scripts

- `dev` - Start Vite development server
- `dev:electron` - Start Electron development server
- `build` - Build web assets
- `build:electron` - Build Electron application
- `download-node:win-x64` - Download Windows Node.js binary for cross-platform build

## Package Scripts

- `package` - Create application directory
- `package:windows` - Create Windows distributable package
- `package:linux` - Create Linux distributable package
- `docker:build-win` - Build Windows version using Docker

## MCP Server Setup

After first launch, you can find the `config.json` file in these locations:

- macOS: `~/Library/Preferences/dive`
- Windows: `C:\Users\USERNAME\AppData\Local\Dive\Data`
- Linux: `~/.config/dive`

There are four ways to configure MCP servers:

### 1. Add New MCP Server via GUI

1. Click the menu button in the top-left corner to open the sidebar
2. Click "MCP Server Management" at the bottom
3. Click the "Add MCP Server" button
4. Paste your MCP server configuration in JSON format
5. Click "Save" to add the new server

Example configuration:
```json
{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"]
    }
  }
}
```

### 2. Edit config.json directly

You can edit the `config.json` file directly in the above locations following each MCP server's documentation.

### 3. Using Config Editor

1. Click the menu button in the top-left corner to open the sidebar
2. Click "MCP Server Management" at the bottom
3. Click the "Edit Config" button on the page

### 4. Custom Scripts

You can add your own MCP server scripts in the `.dive/scripts` directory in your home folder, then update the `config.json` accordingly.

Example:

1. Create a new file `echo.js` in `~/.dive/scripts`
2. Update `config.json`:

```json
{
  "mcpServers": {
    "echo": {
      "enabled": true,
      "command": "node",
      "args": [
        "echo.js"
      ]
    }
  }
}
```

## Project Architecture

```
src/
├── atoms/              # Global state management
│   ├── configState.ts    # Model configuration state
│   ├── interfaceState.ts # UI interface state
│   └── historyState.ts   # Chat history state
│
├── components/         # Reusable UI components
│   ├── ModelConfigForm  # Model settings form
│   ├── Toast           # Toast notifications
│   └── Header          # App header
│
├── views/             # Page components
│   ├── Chat/           # Chat interface
│   ├── Setup/          # Initial setup
│   └── Welcome/        # Welcome page
│
├── styles/            # SCSS stylesheets
│   ├── components/     # Component styles
│   └── pages/         # Page-specific styles
│
└── hooks/             # Custom React hooks

electron/
├── main/             # Main process
│   └── index.ts       # Main entry
└── preload/          # Preload scripts
    └── index.ts       # Bridge between main and renderer

services/            # Backend services
```
