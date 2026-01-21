#!/bin/bash

###############################################################################
# YouTube Cookie Refresh - Bash Wrapper Script
#
# This script is designed to be called by cron for automated cookie refresh.
# It handles directory navigation, environment setup, and logging.
#
# Usage:
#   ./refresh-cookies.sh
#
# Cron example (runs daily at 3 AM):
#   0 3 * * * /path/to/linkiz-music-BE/scripts/refresh-cookies.sh >> /path/to/linkiz-music-BE/logs/cron.log 2>&1
###############################################################################

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/cron.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Main execution
log "=========================================="
log "Cookie Refresh Cron Job Started"
log "=========================================="
log "Project directory: $PROJECT_DIR"

# Change to project directory
cd "$PROJECT_DIR" || {
    log "ERROR: Failed to change to project directory"
    exit 1
}

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    log "ERROR: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    log "WARNING: node_modules not found, running npm install..."
    npm install
    if [ $? -ne 0 ]; then
        log "ERROR: npm install failed"
        exit 1
    fi
fi

# Check if accounts.json exists
if [ ! -f "config/accounts.json" ]; then
    log "ERROR: config/accounts.json not found"
    log "Please create the config file from accounts.json.example"
    exit 1
fi

# Run the Node.js script with Xvfb (virtual display)
# This is required because Google blocks headless browsers
# Xvfb creates a virtual X11 display for the browser to run in
log "Running cookie refresh script with Xvfb..."

# Check if xvfb-run is available
if command -v xvfb-run &> /dev/null; then
    xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" node scripts/refresh-cookies.js
else
    log "WARNING: xvfb-run not found, trying without virtual display..."
    log "Install with: sudo apt install xvfb"
    node scripts/refresh-cookies.js
fi

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    log "Cookie refresh completed successfully"

    # Run validation test
    log "Running cookie validation test..."
    node scripts/test-cookies.js

    if [ $? -eq 0 ]; then
        log "Cookie validation PASSED"
    else
        log "WARNING: Cookie validation FAILED"
    fi
else
    log "ERROR: Cookie refresh failed with exit code $EXIT_CODE"
fi

log "=========================================="
log "Cookie Refresh Cron Job Finished"
log "=========================================="
log ""

exit $EXIT_CODE
