#!/bin/bash

# ── Aura Display — Auto Update Script ────────────────────────────
# Called by both the hotfix timer and the release timer.
# Checks the latest commit's tag to decide whether to apply it:
#
#   hotfix-*  → applied by the hotfix timer (every 30 min)
#   release-* → applied by the release timer (Wednesday 4AM)
#   no tag    → treated as a release
#
# Usage:
#   update.sh hotfix   (called by aura-hotfix.timer)
#   update.sh release  (called by aura-update.timer)

MODE="${1:-release}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend/Aura"
BACKEND_DIR="$PROJECT_DIR/backend"
SERVICE_NAME="smart-desk-display"
LOG_FILE="/var/log/aura-update.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$MODE] $1" | tee -a "$LOG_FILE"
}

log "Checking for updates..."

cd "$PROJECT_DIR"

# Fetch latest commits and tags from GitHub
git fetch --tags origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)

if [ "$LOCAL" = "$REMOTE" ]; then
  log "Already up to date."
  exit 0
fi

# Get the tag on the latest remote commit (empty string if no tag)
LATEST_TAG=$(git tag --points-at "$REMOTE" | head -n 1)

log "Remote commit: $REMOTE"
log "Tag: ${LATEST_TAG:-none}"

# Decide whether this timer should apply this update
if [ "$MODE" = "hotfix" ]; then
  # Hotfix timer only applies commits tagged hotfix-*
  if [[ "$LATEST_TAG" != hotfix-* ]]; then
    log "Not a hotfix tag — skipping. Will be applied on Wednesday."
    exit 0
  fi
else
  # Release timer applies anything NOT tagged as a hotfix
  # (hotfixes would already have been applied by the hotfix timer)
  if [[ "$LATEST_TAG" == hotfix-* ]]; then
    log "Hotfix already handled — skipping."
    exit 0
  fi
fi

log "Applying update..."
git pull origin master

log "Rebuilding frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build

log "Restarting backend service..."
systemctl restart "$SERVICE_NAME"

log "Update complete (${LATEST_TAG:-untagged})."
