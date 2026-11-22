#!/bin/zsh
# Installs (or reinstalls) a macOS launchd job that runs scripts/sync-scheduled.sh every 10 minutes
# (and once at load), so new AuraService movies and fresh numbers reach the site without anyone running
# `npm run sync`. WHISTLE_BUILD=1 makes each run also rebuild dist/, so `astro preview` (and anything
# else serving the build) stays current, not just the dev server. A sync + build takes ~5 seconds.
#
#   scripts/install-sync-schedule.sh             # install and start
#   scripts/install-sync-schedule.sh --uninstall # stop and remove
#
# Log: ~/Library/Logs/whistle-sync.log. Needs .env with an AuraService admin login (see README).

set -eu
LABEL=ing.whistle.sync
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="${0:A:h:h}"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true

if [[ "${1:-}" == --uninstall ]]; then
  rm -f "$PLIST"
  echo "Removed $LABEL."
  exit 0
fi

NODE_DIR="$(dirname "$(command -v node)")"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
chmod +x "$REPO/scripts/sync-scheduled.sh"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$REPO/scripts/sync-scheduled.sh</string></array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$NODE_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>WHISTLE_BUILD</key><string>1</string>
  </dict>
  <key>StartInterval</key><integer>600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/whistle-sync.launchd.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/whistle-sync.launchd.log</string>
</dict>
</plist>
EOF

launchctl bootstrap "$DOMAIN" "$PLIST"
echo "Installed $LABEL: syncs and rebuilds every 10 minutes. Log: ~/Library/Logs/whistle-sync.log"
[[ -f "$REPO/.env" ]] || echo "Note: $REPO/.env is missing. Add AURA_USERNAME/AURA_PASSWORD (an admin) or every run will fail."
