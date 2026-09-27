#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' 'Trolley needs PySide6 and QtWebEngine to open the game.'
read -r -p 'Install pyside6 and qt6-webengine with omarchy pkg add? [y/N] ' answer
case "$answer" in
  y|Y|yes|YES) ;;
  *) exit 1 ;;
esac

if omarchy pkg add pyside6 qt6-webengine &&
  python -c 'from PySide6.QtWebEngineWidgets import QWebEngineView'; then
  printf '%s\n' 'Dependencies ready. Click Trolley in the bar to play.'
else
  printf '%s\n' 'Setup failed. Check the error above, then click Trolley to retry.' >&2
  read -r -p 'Press Enter to close. ' || true
  exit 1
fi
