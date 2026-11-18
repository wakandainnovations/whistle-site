#!/bin/zsh
# Runs `npm run sync` from the scheduled job (see scripts/install-sync-schedule.sh) and logs the result.
# The dev server picks up the new film files on its own. If the site is served from a build instead,
# set WHISTLE_BUILD=1 in the job and this also runs `npm run build`.
#
# If AuraService is unreachable or the login fails, the sync stops before writing anything, so the site
# keeps the last good data.

set -u
cd "${0:A:h}/.." || exit 1

LOG="${WHISTLE_SYNC_LOG:-$HOME/Library/Logs/whistle-sync.log}"
mkdir -p "${LOG:h}"

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') sync start"
  if npm run --silent sync; then
    result=ok
    if [[ "${WHISTLE_BUILD:-0}" == 1 ]]; then
      npm run --silent build || result="build failed"
    fi
  else
    result="sync failed"
  fi
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') $result"
} >>"$LOG" 2>&1

# Keep the log from growing forever: the last 5000 lines are plenty.
tail -n 5000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"

[[ "$result" == ok ]]
