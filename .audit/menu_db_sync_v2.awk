BEGIN{
  FS="|"
  while((getline line < ".audit/17_registry_guess_map.txt") > 0){
    split(line, a, "|")
    regPath[a[1]] = a[2]
    regMod[a[1]]  = a[3]
  }

  print "=== MENU DB vs REGISTRY EXACT REPORT ===" > ".audit/21_menu_db_exact_report.txt"
  print "ID|CODE|DB_PATH|EXPECTED_PATH|MODULE|STATUS|NOTE" >> ".audit/21_menu_db_exact_report.txt"

  print "-- MENU DB EXACT FIX CANDIDATES" > ".audit/22_menu_db_exact_fix.sql"
  print "-- Review before execute." >> ".audit/22_menu_db_exact_fix.sql"
}

function trim(s){
  gsub(/^[ \t\r\n]+/, "", s)
  gsub(/[ \t\r\n]+$/, "", s)
  return s
}

function escsql(s){
  gsub(/\047/, "\047\047", s)
  return s
}

{
  line = $0

  # lewati header / noise
  if(line ~ /^===/) next
  if(line ~ /^id[ \t]+code[ \t]+label[ \t]+path/) next
  if(line ~ /^SELECT /) next
  if(line ~ /^Paste output/) next
  if(line ~ /^Recommended command:/) next
  if(line ~ /^wrangler d1 execute/) next
  if(trim(line) == "") next

  # normalisasi multi-space/tab jadi pipe
  gsub(/\t+/, "|", line)
  gsub(/  +/, "|", line)

  n = split(line, a, "|")
  if(n < 4) next

  id   = trim(a[1])
  code = trim(a[2])
  label= trim(a[3])
  path = trim(a[4])

  if(id == "id" || code == "code") next
  if(code == "" || code == "<null>") next

  dbPath = path
  if(dbPath == "<null>" || dbPath == "") dbPath = "/"

  expected = regPath[code]
  module   = regMod[code]

  if(expected == ""){
    print id "|" code "|" dbPath "|-|-|NO_RULE|code_not_in_registry_guess" >> ".audit/21_menu_db_exact_report.txt"
    next
  }

  if(module != ""){
    modFile = "public" module
    cmd = "test -f \"" modFile "\""
    modOk = (system(cmd) == 0 ? "OK" : "MISS")
  } else {
    modOk = "MISS"
  }

  if(dbPath == expected){
    print id "|" code "|" dbPath "|" expected "|" module "|" modOk "|synced" >> ".audit/21_menu_db_exact_report.txt"
  } else {
    print id "|" code "|" dbPath "|" expected "|" module "|" modOk "|path_mismatch" >> ".audit/21_menu_db_exact_report.txt"
    print "UPDATE menus SET path='\047" escsql(expected) "\047 WHERE id='\047" escsql(id) "\047 AND code='\047" escsql(code) "\047;" >> ".audit/22_menu_db_exact_fix.sql"
  }
}

END{
  synced = 0
  mismatch = 0
  norule = 0
  missmod = 0

  while((getline line < ".audit/21_menu_db_exact_report.txt") > 0){
    if(line ~ /\|synced$/) synced++
    if(line ~ /\|path_mismatch$/) mismatch++
    if(line ~ /\|NO_RULE\|code_not_in_registry_guess$/) norule++
    if(line ~ /\|MISS\|/) missmod++
  }

  print "MENU DB EXACT SUMMARY" > ".audit/23_menu_db_exact_summary.txt"
  print "" >> ".audit/23_menu_db_exact_summary.txt"
  print "Synced rows          : " synced >> ".audit/23_menu_db_exact_summary.txt"
  print "Path mismatch rows   : " mismatch >> ".audit/23_menu_db_exact_summary.txt"
  print "No registry rule     : " norule >> ".audit/23_menu_db_exact_summary.txt"
  print "Module file missing  : " missmod >> ".audit/23_menu_db_exact_summary.txt"
  print "" >> ".audit/23_menu_db_exact_summary.txt"
  print "FILES" >> ".audit/23_menu_db_exact_summary.txt"
  print "- .audit/21_menu_db_exact_report.txt" >> ".audit/23_menu_db_exact_summary.txt"
  print "- .audit/22_menu_db_exact_fix.sql" >> ".audit/23_menu_db_exact_summary.txt"
  print "- .audit/23_menu_db_exact_summary.txt" >> ".audit/23_menu_db_exact_summary.txt"
}
