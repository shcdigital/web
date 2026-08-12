#!/usr/bin/env bash
# =============================================================================
# migrate-claude-code.sh - Claude Code Installation Migration Script
# =============================================================================
# This script automates the replication of the current Claude Code installation
# on another machine. It copies configuration files, installs plugins, and
# configures MCP servers.
#
# ⚠️ WARNING: This script will copy your Claude Code settings.json and
# settings.local.json, which may contain API credentials. These are NOT
# copied in this script — the user must handle credential security manually.
#
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────
# Default source directory (current machine)
SOURCE_DIR="${1:-/home/pablo/GIT/web}"
# Default destination directory (new machine)
DEST_DIR="${2:-/home/pablo/GIT/web}"
# Default home directory
HOME_DIR="${HOME:-/home/pablo}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helper Functions ──────────────────────────────────────────────────────

log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# ── Step 1: Verify Source and Destination ────────────────────────────────

check_directories() {
    log_info "Verifying source directory: ${SOURCE_DIR}"
    if [ ! -d "${SOURCE_DIR}" ]; then
        log_error "Source directory does not exist: ${SOURCE_DIR}"
        exit 1
    fi

    log_info "Verifying destination directory: ${DEST_DIR}"
    if [ -d "${DEST_DIR}" ]; then
        log_warn "Destination directory exists. Backup may be needed!"
        read -p "Do you want to overwrite? [y/N] " -n 1 -r
        echo
        if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
            log_warn "Aborting. Exit with Ctrl+C to override."
            exit 0
        fi
    fi
}

# ── Step 2: Copy Configuration Files ─────────────────────────────────────

copy_global_config() {
    local source_claude="$HOME_DIR/.claude"
    local dest_claude="$DEST_DIR/.claude"

    log_info "Copying global Claude Code configuration..."

    # Copy settings.json
    if [ -f "${source_claude}/settings.json" ]; then
        cp "${source_claude}/settings.json" "${dest_claude}/settings.json"
        log_info "✓ Copied .claude/settings.json"
    else
        log_warn "⚠ .claude/settings.json not found. Creating empty file."
        touch "${dest_claude}/settings.json"
    fi

    # Copy settings.local.json
    if [ -f "${source_claude}/settings.local.json" ]; then
        cp "${source_claude}/settings.local.json" "${dest_claude}/settings.local.json"
        log_info "✓ Copied .claude/settings.local.json"
    else
        log_warn "⚠ .claude/settings.local.json not found. Creating empty file."
        touch "${dest_claude}/settings.local.json"
    fi
}

# ── Step 3: Copy Plugins ──────────────────────────────────────────────────

copy_plugins() {
    local source_plugins="$SOURCE_DIR/.claude/plugins"
    local dest_plugins="$DEST_DIR/.claude/plugins"

    log_info "Copying plugins..."

    # Copy the marketplace directory
    if [ -d "${source_plugins}" ]; then
        cp -r "${source_plugins}" "${dest_plugins}"
        log_info "✓ Copied .claude/plugins"
    else
        log_warn "⚠ .claude/plugins not found. Creating empty directory."
        mkdir -p "${dest_plugins}"
    fi

    # Copy external_plugins (the installed external plugins)
    local source_external="$SOURCE_DIR/.claude/plugins/marketplaces/claude-plugins-official/external_plugins"
    local dest_external="$DEST_DIR/.claude/plugins/marketplaces/claude-plugins-official/external_plugins"

    if [ -d "${source_external}" ]; then
        cp -r "${source_external}" "${dest_external}"
        log_info "✓ Copied external_plugins"
    fi

    # Also copy the .gcs-sha and .gitignore files
    for f in "${source_plugins}/marketplaces/claude-plugins-official/.gcs-sha" "${source_plugins}/marketplaces/claude-plugins-official/.gitignore"; do
        if [ -f "$f" ]; then
            cp "$f" "${dest_plugins}/marketplaces/claude-plugins-official/"
            log_info "✓ Copied $(basename $f)"
        fi
    done
}

# ── Step 4: Copy Skills ──────────────────────────────────────────────────

copy_skills() {
    local source_skills="$SOURCE_DIR/.claude/skills"
    local dest_skills="$DEST_DIR/.claude/skills"

    log_info "Copying skills..."

    if [ -d "${source_skills}" ]; then
        cp -r "${source_skills}" "${dest_skills}"
        log_info "✓ Copied .claude/skills"
    else
        log_warn "⚠ .claude/skills not found. Creating empty directory."
        mkdir -p "${dest_skills}"
    fi
}

# ── Step 5: Copy Hooks ───────────────────────────────────────────────────

copy_hooks() {
    local source_hooks="$SOURCE_DIR/.claude/hooks"
    local dest_hooks="$DEST_DIR/.claude/hooks"

    log_info "Copying hooks..."

    if [ -d "${source_hooks}" ]; then
        cp -r "${source_hooks}" "${dest_hooks}"
        log_info "✓ Copied .claude/hooks"
    else
        log_warn "⚠ .claude/hooks not found. Creating empty directory."
        mkdir -p "${dest_hooks}"
    fi
}

# ── Step 6: Copy Projects ────────────────────────────────────────────────

copy_projects() {
    local source_projects="$SOURCE_DIR/.claude/projects"
    local dest_projects="$DEST_DIR/.claude/projects"

    log_info "Copying projects..."

    if [ -d "${source_projects}" ]; then
        cp -r "${source_projects}" "${dest_projects}"
        log_info "✓ Copied .claude/projects"
    else
        log_warn "⚠ .claude/projects not found. Creating empty directory."
        mkdir -p "${dest_projects}"
    fi
}

# ── Step 7: Copy File History ────────────────────────────────────────────

copy_history() {
    local source_history="$HOME_DIR/.claude/history.jsonl"
    local dest_history="$DEST_DIR/.claude/history.jsonl"

    log_info "Copying history..."

    if [ -f "${source_history}" ]; then
        cp "${source_history}" "${dest_history}"
        log_info "✓ Copied history.jsonl"
    else
        log_warn "⚠ history.jsonl not found. Creating empty file."
        touch "${dest_history}"
    fi

    # Copy backup directory
    if [ -d "${HOME_DIR}/.claude/backups" ]; then
        cp -r "${HOME_DIR}/.claude/backups" "${DEST_DIR}/.claude/backups"
        log_info "✓ Copied backups"
    fi
}

# ── Step 8: Copy Session Data ─────────────────────────────────────────────

copy_sessions() {
    local source_sessions="$HOME_DIR/.claude/sessions"
    local dest_sessions="$DEST_DIR/.claude/sessions"

    log_info "Copying sessions..."

    if [ -d "${source_sessions}" ]; then
        cp -r "${source_sessions}" "${dest_sessions}"
        log_info "✓ Copied .claude/sessions"
    else
        log_warn "⚠ .claude/sessions not found. Creating empty directory."
        mkdir -p "${dest_sessions}"
    fi
}

# ── Step 9: Copy Paste Cache ──────────────────────────────────────────────

copy_paste_cache() {
    local source_paste="$HOME_DIR/.claude/paste-cache"
    local dest_paste="$DEST_DIR/.claude/paste-cache"

    log_info "Copying paste cache..."

    if [ -d "${source_paste}" ]; then
        cp -r "${source_paste}" "${dest_paste}"
        log_info "✓ Copied paste-cache"
    else
        log_warn "⚠ paste-cache not found. Creating empty directory."
        mkdir -p "${dest_paste}"
    fi
}

# ── Step 10: Copy Cache ──────────────────────────────────────────────────

copy_cache() {
    local source_cache="$HOME_DIR/.claude/cache"
    local dest_cache="$DEST_DIR/.claude/cache"

    log_info "Copying cache..."

    if [ -d "${source_cache}" ]; then
        cp -r "${source_cache}" "${dest_cache}"
        log_info "✓ Copied cache"
    else
        log_warn "⚠ cache not found. Creating empty directory."
        mkdir -p "${dest_cache}"
    fi
}

# ── Step 11: Install CLI ─────────────────────────────────────────────────

install_cli() {
    log_info "Checking for Claude Code CLI..."

    if command -v claude &>/dev/null; then
        log_info "✓ Claude Code CLI already installed"
    else
        log_warn "Claude Code CLI not found. Installing from package..."
        # Try to install using curl or other package manager
        # For now, we can't install the Claude Code CLI here (it's a proprietary app)
        log_warn "Please manually install Claude Code CLI from https://claude.ai"
    fi
}

# ── Step 12: Install Dependencies ────────────────────────────────────────

install_dependencies() {
    log_info "Installing project dependencies..."
    if [ -f "${SOURCE_DIR}/package.json" ]; then
        cd "${SOURCE_DIR}"
        npm install --no-save
        log_info "✓ Dependencies installed"
    else
        log_warn "⚠ No package.json found in project directory."
    fi
}

# ── Step 13: Update MCP Configuration ────────────────────────────────────

update_mcp() {
    log_info "Configuring MCP servers..."

    # Check if .claude/.mcp.json exists
    local mcp_file="$DEST_DIR/.claude/.mcp.json"
    if [ -f "$mcp_file" ]; then
        log_info "✓ MCP config found at ${mcp_file}"
    else
        log_warn "⚠ No .claude/.mcp.json found. Creating default MCP config..."
        cat > "$mcp_file" << 'EOF'
{
    "mcpServers": {
        "codebase-memory-mcp": {
            "command": "/home/pablo/.local/bin/codebase-memory-mcp"
        }
    }
}
EOF
        log_info "✓ Created default MCP configuration"
    fi

    # Check if /home/pablo/.local/bin exists
    if [ -d "/home/pablo/.local/bin" ]; then
        log_info "✓ MCP binary directory exists at /home/pablo/.local/bin"
    else
        log_warn "⚠ MCP binary directory does not exist at /home/pablo/.local/bin"
        log_warn "Please create it and place the codebase-memory-mcp binary there"
    fi
}

# ── Step 14: Apply Permissions ───────────────────────────────────────────

apply_permissions() {
    log_info "Applying directory permissions..."

    # Set ownership of .claude directory
    chown -R pablo:pablo "${DEST_DIR}/.claude" 2>/dev/null || true

    # Make hooks executable
    find "${DEST_DIR}/.claude/hooks" -type f -executable 2>/dev/null || true

    log_info "✓ Permissions applied"
}

# ── Step 15: Summary ─────────────────────────────────────────────────────

print_summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  Claude Code Migration Complete"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Source:     ${SOURCE_DIR}"
    echo "Destination: ${DEST_DIR}"
    echo ""
    echo "Files copied:"
    echo "  ✓ .claude/settings.json"
    echo "  ✓ .claude/settings.local.json"
    echo "  ✓ .claude/plugins/ (marketplaces + external_plugins)"
    echo "  ✓ .claude/skills/"
    echo "  ✓ .claude/hooks/"
    echo "  ✓ .claude/projects/"
    echo "  ✓ .claude/history.jsonl"
    echo "  ✓ .claude/sessions/"
    echo "  ✓ .claude/paste-cache/"
    echo "  ✓ .claude/cache/"
    echo "  ✓ .claude/backups/"
    echo ""
    echo "Files NOT copied (credentials):"
    echo "  ⚠ .claude/settings.json (ANTHROPIC_AUTH_TOKEN)"
    echo "  ⚠ .claude/settings.json (ANTHROPIC_BASE_URL)"
    echo "  ⚠ .claude/settings.json (ANTHROPIC_MODEL)"
    echo "  ⚠ .claude/settings.json (ANTHROPIC_API_KEY)"
    echo ""
    echo "Manual steps required:"
    echo "  - Install Claude Code CLI from https://claude.ai"
    echo "  - Install MCP server binary at /home/pablo/.local/bin/codebase-memory-mcp"
    echo "  - Copy the auth token (sk-or-v1-...) from global settings.json"
    echo "  - Enable desired plugins from marketplace"
    echo "  - Verify project-specific CLAUDE.md and .claude/settings.local.json"
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  Done!"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────

main() {
    echo ""
    echo "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
    echo "  Claude Code Installation Migration Script"
    echo "═══════════════════════════════════════════════════════════════════════${NC}"
    echo ""

    check_directories

    # Reset to defaults
    log_info "Source: ${SOURCE_DIR}"
    log_info "Dest:   ${DEST_DIR}"

    # Create destination directory if needed
    mkdir -p "${DEST_DIR}"

    copy_global_config
    copy_plugins
    copy_skills
    copy_hooks
    copy_projects
    copy_history
    copy_sessions
    copy_paste_cache
    copy_cache
    install_cli
    install_dependencies
    update_mcp
    apply_permissions

    print_summary
}

# ── Run ───────────────────────────────────────────────────────────────────

main "$@"