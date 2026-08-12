# Claude Code Installation Migration Inventory

## Overview

This document provides a complete inventory of the current Claude Code installation configuration, organized by category. It serves as a reference for migrating the setup to another machine.

## 1. Global Configuration

### ~/.claude/

**settings.local.json**
- Permissions:
  - Allow read access to `//home/pablo/.claude/**`
  - Allow `Bash(mkdir -p /home/pablo/GIT/web/src/i18n)`
  - Allow `Bash(npm install *)`

**settings.json**
- **Model**: `inclusionai/ling-3.0-tiny:free`
- **Anthropic Configuration**:
  - `ANTHROPIC_BASE_URL`: `https://openrouter.ai/api`
  - `ANTHROPIC_AUTH_TOKEN`: `sk-or-v1-<REDACTED>`
  - `ANTHROPIC_API_KEY`: `` (empty)
  - `ANTHROPIC_MODEL`: `openrouter/free`
- **Permissions**:
  - Allow Bash commands for `mkdir -p /home/pablo/GIT/web/src/i18n`
  - Allow `npm install *`

## 2. Project-Specific Configuration

### CLAUDE.md
- Located at `/home/pablo/GIT/web/CLAUDE.md`
- Contains project-specific Claude Code setup instructions

### .claude/
- **settings.local.json** (already covered above)
- **plugins/**
  - Marketplace: `claude-plugins-official` (includes external plugins for Asana, Context7, Discord, FakeChat, Firebase, GitHub, GitLab, Greptile, iMessage, Laravel Boost)
  - Local plugins directory (empty)
- **skills/**
  - `codebase-memory/` with SKILL.md defining the codebase memory skill
- **hooks/**
  - `cbm-code-discovery-gate` - Gate for code discovery
  - `cbm-session-reminder` - Session reminder hook
  - `cbm-subagent-reminder` - Subagent reminder hook
- **cache/**, **downloads/**, **file-history/**, **paste-cache/**, **projects/**, **session-env/**, **sessions/** - auxiliary directories

### MCP Configuration
- **.claude/.mcp.json**:
  - `codebase-memory-mcp` server pointing to `/home/pablo/.local/bin/codebase-memory-mcp`

## 3. Plugins

### Official Marketplace (claude-plugins-official)
- External plugins available:
  - Asana
  - Context7
  - Discord
  - FakeChat
  - Firebase
  - GitHub
  - GitLab
  - Greptile
  - iMessage
  - Laravel Boost

### Installed Plugins (from .claude/plugins/marketplaces/claude-plugins-official/external_plugins/)
- Asana
- Context7
- Discord
- FakeChat
- Firebase
- GitHub
- GitLab
- Greptile
- iMessage
- Laravel Boost

## 4. Skills

### codebase-memory
- Location: `/home/pablo/GIT/web/.claude/skills/codebase-memory/`
- File: `SKILL.md`
- Description: Codebase memory skill for the CLAUDÉ agent

## 5. MCP Servers

- **codebase-memory-mcp**:
  - Command: `/home/pablo/.local/bin/codebase-memory-mcp`
  - Purpose: Accesses the codebase memory MCP skill

## 6. Environment Variables

From `.claude/settings.json`:
- `ANTHROPIC_BASE_URL` = `https://openrouter.ai/api`
- `ANTHROPIC_AUTH_TOKEN` = `sk-or-v1-<REDACTED>`
- `ANTHROPIC_API_KEY` = `` (empty)
- `ANTHROPIC_MODEL` = `openrouter/free`

## 7. Versions

| Component | Version |
|-----------|----------|
| Node.js | 22.23.1 |
| npm | 10.9.8 |
| Claude Code | 2.1.226 |
| Python | (from node_modules) |
| Anthropic Model | openrouter/free |

## 8. Migration Steps Summary

1. **Copy configuration files** from `~/.claude/` and `.claude/` to the new machine
2. **Install dependencies** via `npm install` (as permitted by settings.local.json)
3. **Enable plugins** from the official marketplace (Asana, Discord, GitHub, etc.)
4. **Configure MCP server** at `/home/pablo/.local/bin/codebase-memory-mcp`
5. **Restart Claude Code** to apply changes
6. **Verify connectivity** to Anthropic API endpoints

## 9. Manual Actions Required

- Copy `~/.claude/settings.local.json` and `.claude/settings.json` to the new machine
- Install the official Claude Code CLI if not already present
- Enable desired plugins from the marketplace
- Ensure the MCP server binary is available at `/home/pablo/.local/bin/codebase-memory-mcp`
- Verify Anthropic API credentials are correctly set (token and model)

## 10. Scripts

See `migrate-claude-code.sh` (to be created) for automated deployment.

---
*Generated on 2026-08-12*
*Based on configuration in /home/pablo/GIT/web/*
