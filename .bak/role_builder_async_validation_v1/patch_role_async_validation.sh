#!/data/data/com.termux/files/usr/bin/sh
set -u

TARGET=""
for f in \
  public/modules/mod_role_builder.js \
  public/modules/mod_roles.js \
  public/modules/mod_rbac_roles.js
do
  if [ -f "$f" ]; then
    TARGET="$f"
    break
  fi
done

if [ -z "$TARGET" ]; then
  echo "SKIP: role builder module tidak ditemukan."
  echo "Cari salah satu file ini:"
  echo "  public/modules/mod_role_builder.js"
  echo "  public/modules/mod_roles.js"
  echo "  public/modules/mod_rbac_roles.js"
  exit 0
fi

cp "$TARGET" ".bak/role_builder_async_validation_v1/$(basename "$TARGET").bak"

echo "TARGET: $TARGET"

TMP1="$(mktemp)"
TMP2="$(mktemp)"
TMP3="$(mktemp)"
TMP4="$(mktemp)"

cleanup() {
  rm -f "$TMP1" "$TMP2" "$TMP3" "$TMP4"
}
trap cleanup EXIT

# 1) Tambah import async validator jika belum ada
if ! grep -q 'async_field_validation.js' "$TARGET"; then
  awk '
  BEGIN{done=0}
  {
    print $0
    if(done==0 && $0 ~ /orland_ui\.js/){
      print "import { afvCreateEngine } from \"../../assets/js/async_field_validation.js\";"
      done=1
    }
  }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"
  echo "OK: import afvCreateEngine ditambahkan"
else
  echo "SKIP: import afvCreateEngine sudah ada"
fi

# 2) Tambah helper validationHint / clearAsyncState / setInlineError jika belum ada
if ! grep -q 'function validationHint(name, hintText)' "$TARGET"; then
  awk '
  BEGIN{done=0}
  {
    if(done==0 && $0 ~ /function renderList\(\)/){
      print "      function validationHint(name, hintText){"
      print "        return `"
      print "          <div class=\"text-xs text-slate-500 mt-2\" data-fve-hint-for=\"${esc(name)}\">${esc(hintText || \"\")}</div>"
      print "          <div class=\"text-xs text-red-500 mt-2 hidden\" data-fve-error-for=\"${esc(name)}\"></div>"
      print "          <div class=\"fve-state hidden mt-2\" data-fve-state-for=\"${esc(name)}\"></div>"
      print "        `;"
      print "      }"
      print ""
      print "      function clearAsyncState(form, name){"
      print "        const input = form.querySelector(`[name=\"${CSS.escape(String(name))}\"]`);"
      print "        const error = form.querySelector(`[data-fve-error-for=\"${CSS.escape(String(name))}\"]`);"
      print "        const state = form.querySelector(`[data-fve-state-for=\"${CSS.escape(String(name))}\"]`);"
      print "        input?.classList.remove(\"is-valid\", \"is-invalid\", \"is-warning\", \"is-checking\");"
      print "        if(error){"
      print "          error.textContent = \"\";"
      print "          error.classList.add(\"hidden\");"
      print "        }"
      print "        if(state){"
      print "          state.textContent = \"\";"
      print "          state.className = \"fve-state hidden mt-2\";"
      print "        }"
      print "      }"
      print ""
      print "      function setInlineError(form, name, message){"
      print "        const input = form.querySelector(`[name=\"${CSS.escape(String(name))}\"]`);"
      print "        const error = form.querySelector(`[data-fve-error-for=\"${CSS.escape(String(name))}\"]`);"
      print "        const state = form.querySelector(`[data-fve-state-for=\"${CSS.escape(String(name))}\"]`);"
      print "        input?.classList.remove(\"is-valid\", \"is-warning\", \"is-checking\");"
      print "        input?.classList.add(\"is-invalid\");"
      print "        if(error){"
      print "          error.textContent = String(message || \"\");"
      print "          error.classList.remove(\"hidden\");"
      print "        }"
      print "        if(state){"
      print "          state.textContent = \"Invalid\";"
      print "          state.className = \"fve-state is-invalid mt-2\";"
      print "        }"
      print "      }"
      print ""
      done=1
    }
    print $0
  }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"
  echo "OK: helper async validation ditambahkan"
else
  echo "SKIP: helper async validation sudah ada"
fi

# 3) Sisipkan inline hint untuk field id jika belum ada
if ! grep -q 'data-fve-hint-for="\${esc(name)}"' "$TARGET"; then
  :
fi

if ! grep -q 'validationHint("id"' "$TARGET"; then
  sed '/name="id"/{
    n
  }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"

  awk '
  BEGIN{done=0}
  {
    print $0
    if(done==0 && $0 ~ /name="id"/){
      print "                ${validationHint(\"id\", row.id ? \"ID existing role. Read-only saat edit.\" : \"Minimal 2 karakter. Live check ke backend.\")}"
      done=1
    }
  }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"
  echo "OK: hint field id ditambahkan"
else
  echo "SKIP: hint field id sudah ada"
fi

# 4) Sisipkan inline hint untuk field name atau code jika belum ada
if ! grep -q 'validationHint("name"' "$TARGET"; then
  if grep -q 'name="name"' "$TARGET"; then
    awk '
    BEGIN{done=0}
    {
      print $0
      if(done==0 && $0 ~ /name="name"/){
        print "                ${validationHint(\"name\", \"Role name harus unik. Live check ke backend.\")}"
        done=1
      }
    }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"
    echo "OK: hint field name ditambahkan"
  elif grep -q 'name="code"' "$TARGET"; then
    awk '
    BEGIN{done=0}
    {
      print $0
      if(done==0 && $0 ~ /name="code"/){
        print "                ${validationHint(\"code\", \"Role code harus unik. Live check ke backend.\")}"
        done=1
      }
    }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"
    echo "OK: hint field code ditambahkan"
  else
    echo "SKIP: field name/code tidak ditemukan"
  fi
else
  echo "SKIP: hint field name sudah ada"
fi

# 5) Tambah form fallback jika belum ada dan pattern umum ditemukan
if ! grep -q 'const form = q("roleForm") || q("formRole") || q("frmRole") || host.querySelector("form");' "$TARGET"; then
  if grep -q 'q("btnCancelRole")' "$TARGET"; then
    awk '
    BEGIN{done=0}
    {
      if(done==0 && $0 ~ /q\("btnCancelRole"\)/){
        print "        const form = q(\"roleForm\") || q(\"formRole\") || q(\"frmRole\") || host.querySelector(\"form\");"
        print ""
        done=1
      }
      print $0
    }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"
    echo "OK: fallback form selector ditambahkan"
  else
    echo "SKIP: anchor btnCancelRole tidak ditemukan"
  fi
else
  echo "SKIP: fallback form selector sudah ada"
fi

# 6) Tambah asyncEngine jika belum ada
if ! grep -q 'const asyncEngine = afvCreateEngine(form' "$TARGET"; then
  if grep -q 'const form = q("roleForm") || q("formRole") || q("frmRole") || host.querySelector("form");' "$TARGET"; then
    awk '
    BEGIN{done=0}
    {
      print $0
      if(done==0 && $0 ~ /const form = q\("roleForm"\) \|\| q\("formRole"\) \|\| q\("frmRole"\) \|\| host\.querySelector\("form"\);/){
        print ""
        print "        const asyncEngine = afvCreateEngine(form, {"
        print "          id: {"
        print "            debounce_ms: 500,"
        print "            min_length: 2,"
        print "            skip_if_empty: true,"
        print "            validate: async (value)=>{"
        print "              if(row.id){"
        print "                return { ok:true, message:\"ID locked\" };"
        print "              }"
        print "              const r = await Orland.api(\"/api/validate/role-code\", {"
        print "                method: \"POST\","
        print "                body: JSON.stringify({"
        print "                  code: value,"
        print "                  exclude_id: \"\""
        print "                })"
        print "              });"
        print "              if(r.status !== \"ok\"){"
        print "                return { ok:false, message:\"Validation request failed\" };"
        print "              }"
        print "              return r.data?.available"
        print "                ? { ok:true, message:\"ID available\" }"
        print "                : { ok:false, used:true, message:\"ID already used\" };"
        print "            }"
        print "          },"
        print "          name: {"
        print "            debounce_ms: 500,"
        print "            min_length: 2,"
        print "            skip_if_empty: true,"
        print "            validate: async (value)=>{"
        print "              const r = await Orland.api(\"/api/validate/role-code\", {"
        print "                method: \"POST\","
        print "                body: JSON.stringify({"
        print "                  code: value,"
        print "                  exclude_id: row?.id || \"\""
        print "                })"
        print "              });"
        print "              if(r.status !== \"ok\"){"
        print "                return { ok:false, message:\"Validation request failed\" };"
        print "              }"
        print "              return r.data?.available"
        print "                ? { ok:true, message:\"Role name available\" }"
        print "                : { ok:false, used:true, message:\"Role name already used\" };"
        print "            }"
        print "          },"
        print "          code: {"
        print "            debounce_ms: 500,"
        print "            min_length: 2,"
        print "            skip_if_empty: true,"
        print "            validate: async (value)=>{"
        print "              const r = await Orland.api(\"/api/validate/role-code\", {"
        print "                method: \"POST\","
        print "                body: JSON.stringify({"
        print "                  code: value,"
        print "                  exclude_id: row?.id || \"\""
        print "                })"
        print "              });"
        print "              if(r.status !== \"ok\"){"
        print "                return { ok:false, message:\"Validation request failed\" };"
        print "              }"
        print "              return r.data?.available"
        print "                ? { ok:true, message:\"Role code available\" }"
        print "                : { ok:false, used:true, message:\"Role code already used\" };"
        print "            }"
        print "          }"
        print "        });"
        print ""
        print "        asyncEngine.bind();"
        print ""
        done=1
      }
    }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"
    echo "OK: asyncEngine ditambahkan"
  else
    echo "SKIP: form anchor untuk asyncEngine tidak ditemukan"
  fi
else
  echo "SKIP: asyncEngine sudah ada"
fi

# 7) Tambah clearAsyncState di submit handler jika belum ada
if ! grep -q 'clearAsyncState(form, "id")' "$TARGET"; then
  awk '
  BEGIN{done=0}
  {
    print $0
    if(done==0 && $0 ~ /form\.onsubmit = async \(ev\)=>\{/){
      print "          clearAsyncState(form, \"id\");"
      print "          clearAsyncState(form, \"name\");"
      print "          clearAsyncState(form, \"code\");"
      done=1
    }
  }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"
  echo "OK: clearAsyncState di submit handler ditambahkan"
else
  echo "SKIP: clearAsyncState submit sudah ada"
fi

# 8) Tambah sync + async validation guard di submit sebelum apiSave
if ! grep -q 'Masih ada unique field role yang bentrok.' "$TARGET"; then
  awk '
  BEGIN{done=0}
  {
    if(done==0 && $0 ~ /setMsg\(host, "#msg", "muted", "Saving\.\.\."\);/){
      print "          const syncErrors = {};"
      print "          const roleId = String(form.id?.value || \"\").trim();"
      print "          const roleName = String(form.name?.value || form.code?.value || \"\").trim();"
      print ""
      print "          if(!roleId) syncErrors.id = \"ID wajib diisi.\";"
      print "          else if(roleId.length < 2) syncErrors.id = \"ID minimal 2 karakter.\";"
      print "          else if(!/^[a-zA-Z0-9_\\-]+$/.test(roleId)) syncErrors.id = \"ID hanya boleh huruf, angka, underscore, dash.\";"
      print ""
      print "          if(!roleName) syncErrors.name = \"Role name wajib diisi.\";"
      print "          else if(roleName.length < 2) syncErrors.name = \"Role name minimal 2 karakter.\";"
      print ""
      print "          if(syncErrors.id) setInlineError(form, \"id\", syncErrors.id);"
      print "          if(syncErrors.name) setInlineError(form, \"name\", syncErrors.name);"
      print ""
      print "          if(Object.keys(syncErrors).length){"
      print "            setMsg(host, \"#msg\", \"error\", \"Periksa field role yang belum valid.\");"
      print "            return;"
      print "          }"
      print ""
      print "          const asyncResult = await asyncEngine.validateAll();"
      print "          const asyncHasError = Object.values(asyncResult).some(x => x && x.ok === false);"
      print ""
      print "          if(asyncHasError){"
      print "            setMsg(host, \"#msg\", \"error\", \"Masih ada unique field role yang bentrok.\");"
      print "            return;"
      print "          }"
      print ""
      print "          if(asyncEngine.isBusy()){"
      print "            setMsg(host, \"#msg\", \"warning\", \"Masih menunggu pengecekan field role.\");"
      print "            return;"
      print "          }"
      print ""
      done=1
    }
    print $0
  }' "$TARGET" > "$TMP1" && mv "$TMP1" "$TARGET"
  echo "OK: guard sync + async validation ditambahkan"
else
  echo "SKIP: guard sync + async validation sudah ada"
fi

echo
echo "=== CHECK RESULT ==="
grep -n 'async_field_validation.js\|validationHint("id"\|validationHint("name"\|validationHint("code"\|const asyncEngine = afvCreateEngine(form\|validate/role-code\|Masih ada unique field role yang bentrok.' "$TARGET" | head -50
echo
echo "DONE"
