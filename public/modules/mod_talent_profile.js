export async function mount(ctx){
  const { host, api } = ctx;
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const $ = (id)=>document.getElementById(id);

  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-bold">Talent Profile</div>
          <div class="text-xs text-slate-500 mt-1">Save to D1: <code>talent_profiles</code> • Photos: R2</div>
        </div>
        <button id="tpReload" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
      </div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Gender</div>
          <select id="tpGender" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="">—</option>
            <option value="male">male</option>
            <option value="female">female</option>
            <option value="other">other</option>
          </select>
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Date of birth</div>
          <input id="tpDob" type="date" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Location</div>
          <input id="tpLocation" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="Jakarta">
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Height (cm)</div>
          <input id="tpHeight" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="168">
        </div>

        <div class="md:col-span-2">
          <div class="text-[11px] text-slate-500 font-bold mb-1">Categories (comma)</div>
          <input id="tpCats" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="Modeling, Acting">
        </div>
      </div>

      <div class="mt-4 flex gap-2">
        <button id="tpSave" class="text-xs px-4 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Save</button>
        <div id="tpMeta" class="text-[11px] text-slate-500 self-center">—</div>
      </div>

      <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        ${photoCard("headshot","Headshot")}
        ${photoCard("side","Side View")}
        ${photoCard("full","Full Height")}
      </div>

      <details class="mt-4">
        <summary class="text-[11px] text-slate-500">Debug last response</summary>
        <pre id="tpDebug" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
      </details>
    </div>
  `;

  function photoCard(kind, title){
    return `
      <div class="border border-slate-200 dark:border-darkBorder rounded-xl p-3">
        <div class="text-xs font-bold mb-2">${esc(title)}</div>
        <div class="text-[11px] text-slate-500 mb-2"><code id="k_${kind}">-</code></div>
        <input id="f_${kind}" type="file" accept="image/png,image/jpeg,image/webp" class="block w-full text-xs">
        <button id="u_${kind}" class="mt-2 w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Upload</button>
      </div>
    `;
  }

  async function load(){
    const r = await api("/api/talent/profile");
    $("tpDebug").textContent = JSON.stringify(r,null,2);
    if(r.status !== "ok"){
      $("tpMeta").textContent = "Failed: "+r.status;
      return;
    }
    const p = r.data.profile;
    $("tpGender").value = p.gender || "";
    $("tpDob").value = p.dob || "";
    $("tpLocation").value = p.location || "";
    $("tpHeight").value = p.height_cm==null ? "" : String(p.height_cm);
    $("tpCats").value = Array.isArray(p.categories) ? p.categories.join(", ") : "";
    $("tpMeta").textContent = `score=${p.score_int||0} • profile=${p.profile_percent||0}%`;

    $("k_headshot").textContent = p.photos?.headshot_key || "-";
    $("k_side").textContent = p.photos?.side_key || "-";
    $("k_full").textContent = p.photos?.full_key || "-";
  }

  async function save(){
    const gender = $("tpGender").value || "";
    const dob = $("tpDob").value || "";
    const location = ($("tpLocation").value||"").trim();
    const height_cm = ($("tpHeight").value||"").trim();
    const cats = ($("tpCats").value||"").split(",").map(s=>s.trim()).filter(Boolean);

    const r = await api("/api/talent/profile", {
      method:"PUT",
      body: JSON.stringify({
        gender, dob, location,
        height_cm: height_cm ? Number(height_cm) : null,
        categories: cats
      })
    });
    $("tpDebug").textContent = JSON.stringify(r,null,2);
    if(r.status==="ok"){
      $("tpMeta").textContent = `Saved • profile=${r.data.profile_percent}%`;
      await load();
    }else{
      $("tpMeta").textContent = "Failed: "+r.status;
    }
  }

  async function upload(kind){
    const input = $("f_"+kind);
    const file = input.files && input.files[0];
    if(!file){ $("tpMeta").textContent = "Choose file first"; return; }

    // init
    const init = await api("/api/talent/photos/init", {
      method:"POST",
      body: JSON.stringify({ kind, filename:file.name, content_type:file.type || "image/jpeg" })
    });
    $("tpDebug").textContent = JSON.stringify(init,null,2);
    if(init.status!=="ok"){ $("tpMeta").textContent="Init failed: "+init.status; return; }

    const key = init.data.object_key;
    const needProxy = !!init.data.need_put_proxy;

    if(!needProxy && init.data.upload_url){
      const put = await fetch(init.data.upload_url, { method:"PUT", body:file, headers:{ "content-type": file.type||"image/jpeg" } });
      if(!put.ok){ $("tpMeta").textContent="Upload failed: "+put.status; return; }
    }else{
      // safe fallback
      const put = await fetch(`/api/talent/photos/put?key=${encodeURIComponent(key)}`, { method:"PUT", body:file, headers:{ "content-type": file.type||"image/jpeg" }, credentials:"include" });
      const out = await put.json().catch(()=>null);
      if(!put.ok || !out || out.status!=="ok"){ $("tpMeta").textContent="Proxy upload failed"; $("tpDebug").textContent=JSON.stringify(out,null,2); return; }
    }

    // commit
    const commit = await api("/api/talent/photos/commit", {
      method:"POST",
      body: JSON.stringify({ kind, object_key: key })
    });
    $("tpDebug").textContent = JSON.stringify({ init, commit },null,2);
    if(commit.status==="ok"){
      $("tpMeta").textContent = `Uploaded ${kind}`;
      await load();
    }else{
      $("tpMeta").textContent = "Commit failed: "+commit.status;
    }
  }

  $("tpReload").onclick = load;
  $("tpSave").onclick = save;

  ["headshot","side","full"].forEach(k=>{
    $("u_"+k).onclick = ()=>upload(k);
  });

  await load();
}
