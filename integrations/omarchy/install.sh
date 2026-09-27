#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
destination="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/plugins/trolley.game"
python -c 'from PySide6.QtWebEngineWidgets import QWebEngineView' || {
  echo 'Install the desktop dependencies first: omarchy pkg add pyside6 qt6-webengine' >&2
  exit 1
}
if [[ -e "$destination" ]]; then
  echo "Already installed at $destination. Copy updated files there after reviewing them." >&2
  exit 1
fi
mkdir -p -- "$destination"
cp -- "$source_dir/manifest.json" "$source_dir/Service.qml" "$source_dir/Widget.qml" "$source_dir/popup.py" "$destination/"
omarchy-shell shell rescanPlugins
omarchy plugin enable trolley.game
printf '%s\n' 'Trolley enabled. Set its url in the bar settings to your deployed game origin.'
