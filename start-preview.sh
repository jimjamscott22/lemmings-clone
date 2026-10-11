#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d "dist" ]]; then
  echo "No production build was found. Run 'npm run build' before starting the preview server." >&2
  exit 1
fi

npm run preview
