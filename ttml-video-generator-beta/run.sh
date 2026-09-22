#!/usr/bin/env bash
# Transparent Karaoke Video Generator Launcher
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

PYTHON_BIN="$(which python3)"
if [ -z "$PYTHON_BIN" ]; then
  PYTHON_BIN="/usr/bin/python3"
fi

"$PYTHON_BIN" "$DIR/app.py" "$@"
