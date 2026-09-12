#!/usr/bin/env bash

# Application Launcher
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR" || exit 1

echo "=================================================="
echo "✨ CostCraft App Launcher"
echo "📂 Project: $PROJECT_DIR"
echo "=================================================="

# Check runner (prefer bun, fallback to npm)
if command -v bun >/dev/null 2>&1; then
  RUNNER="bun"
else
  RUNNER="npm"
fi

exec $RUNNER run dev "$@"
