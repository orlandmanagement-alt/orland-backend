#!/data/data/com.termux/files/usr/bin/sh

OUTDIR=".audit"
mkdir -p "$OUTDIR"

DB_EXPORT="$OUTDIR/16_menu_db_export.txt"
REPORT="$OUTDIR/18_menu_sync_report.txt"
FIXSQL="$OUTDIR/19_menu_sync_fix_candidates.sql"
SUMMARY="$OUTDIR/20_menu_sync_summary.txt"
MAPFILE="$OUTDIR/17_registry_guess_map.txt"

: > "$DB_EXPORT"
: > "$REPORT"
: > "$FIXSQL"

echo '=== MENU DB EXPORT ===' > "$DB_EXPORT"
echo 'Paste output wrangler d1 execute here if needed.' >> "$DB_EXPORT"
echo 'Recommended command:' >> "$DB_EXPORT"
echo 'wrangler d1 execute <DB_NAME> --file=.audit/15_menu_paths_from_db.sql --remote' >> "$DB_EXPORT"

echo '=== MENU SYNC REPORT ===' > "$REPORT"
echo 'PATH|EXPECTED_MODULE|FILE_STATUS|NOTE' >> "$REPORT"

while IFS='|' read -r path module; do
  [ -z "$path" ] && continue
  f="public${module}"
  if [ -f "$f" ]; then
    echo "$path|$module|OK|module_exists" >> "$REPORT"
  else
    echo "$path|$module|MISS|module_file_missing" >> "$REPORT"
  fi
done < "$MAPFILE"

echo >> "$REPORT"
echo '=== PLACEHOLDER USAGE IN REGISTRY ===' >> "$REPORT"
grep -Rhn 'mod_placeholder.js' functions/api functions/api/_core 2>/dev/null | sort >> "$REPORT" || true

echo >> "$REPORT"
echo '=== MENU-LIKE PATHS FOUND IN PROJECT ===' >> "$REPORT"
grep -Rho '"/[^"]*"' functions/api functions/api/_core public/modules public/modules/_core 2>/dev/null \
  | tr -d '"' \
  | grep '^/' \
  | sort -u >> "$REPORT" || true

echo '-- MENU DB SYNC FIX CANDIDATES' > "$FIXSQL"
echo '-- Review manually before execution.' >> "$FIXSQL"
echo '-- Example candidates only:' >> "$FIXSQL"
echo "UPDATE menus SET path='/dashboard' WHERE code='dashboard' AND (path='/' OR path='');" >> "$FIXSQL"
echo "UPDATE menus SET path='/menus' WHERE code='menus' AND path='/menu-builder';" >> "$FIXSQL"
echo "UPDATE menus SET path='/integrations/blogspot/sync' WHERE code='blogspot_sync' AND path!='/integrations/blogspot/sync';" >> "$FIXSQL"
echo "UPDATE menus SET path='/config/analytics' WHERE code='cfg_analytics' AND path!='/config/analytics';" >> "$FIXSQL"
echo "UPDATE menus SET path='/config/plugins' WHERE code='cfg_plugins' AND path!='/config/plugins';" >> "$FIXSQL"
echo "UPDATE menus SET path='/config/otp' WHERE code='cfg_otp' AND path!='/config/otp';" >> "$FIXSQL"
echo "UPDATE menus SET path='/config/verify' WHERE code='cfg_verify' AND path!='/config/verify';" >> "$FIXSQL"
echo "UPDATE menus SET path='/security/policy' WHERE code='security_policy' AND path!='/security/policy';" >> "$FIXSQL"

OK_TOTAL="$(grep -c '|OK|' "$REPORT" 2>/dev/null || true)"
MISS_TOTAL="$(grep -c '|MISS|' "$REPORT" 2>/dev/null || true)"
PLACEHOLDER_TOTAL="$(grep -c 'mod_placeholder.js' "$REPORT" 2>/dev/null || true)"

cat > "$SUMMARY" <<SUM
MENU DB SYNC SUMMARY

Registry guess OK      : $OK_TOTAL
Registry guess missing : $MISS_TOTAL
Placeholder refs       : $PLACEHOLDER_TOTAL

FILES
- .audit/15_menu_paths_from_db.sql
- .audit/16_menu_db_export.txt
- .audit/17_registry_guess_map.txt
- .audit/18_menu_sync_report.txt
- .audit/19_menu_sync_fix_candidates.sql
- .audit/20_menu_sync_summary.txt

NEXT
1. Run the SQL export with wrangler D1.
2. Paste/export result into .audit/16_menu_db_export.txt if you want a second-pass comparison.
3. Review .audit/19_menu_sync_fix_candidates.sql before execution.
SUM

echo
echo '=== MENU DB SYNC SUMMARY ==='
cat "$SUMMARY"
echo
echo '=== MENU SYNC REPORT ==='
cat "$REPORT"
echo
echo '=== SQL FIX CANDIDATES ==='
cat "$FIXSQL"
