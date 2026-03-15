#!/data/data/com.termux/files/usr/bin/bash
set -e

DB_PATH="${DB_PATH:-./.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite}"

echo "=========================================="
echo "CLIENT / TALENT / PROJECT DB AUDIT"
echo "DB_PATH=$DB_PATH"
echo "=========================================="

echo ""
echo "== TABLE PRESENCE CHECK =="
sqlite3 $DB_PATH < database/audit/001_table_presence_check.sql

echo ""
echo "== COLUMN CHECK HINT =="
cat database/audit/002_project_workflow_column_check.txt

echo ""
echo "Run these manually if needed:"
echo "sqlite3 \$DB_PATH"
echo ".read database/audit/001_table_presence_check.sql"
echo ""
echo "Then run:"
cat database/audit/002_project_workflow_column_check.txt
