export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm font-bold">Blogspot API Settings</div>
        <div class="text-xs text-slate-500">Simpan akun Blogger (blog_id + api_key / oauth config) di D1</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <div class="flex flex-wrap gap-2">
          <button id="btnReload" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Reload</button>
          <button id="btnCreate" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white hover:opacity-90">Create</button>
        </div>

        <div class="text-xs font-bold">Accounts</div>
        <div id="tbl" class="text-[12px] text-slate-500">Loading…</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <div class="text-xs font-bold">Edit / Create</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input id="id" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="id (auto)" disabled>
          <input id="label" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="label">
          <input id="blog_id" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="blog_id (required)">
          <select id="status" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
        <textarea id="cfg" class="w-full h-40 text-[11px] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">{}</textarea>
        <div class="flex flex-wrap gap-2">
          <button id="btnSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Save</button>
          <button id="btnDelete" class="text-xs px-3 py-2 rounded-lg bg-danger text-white hover:opacity-90">Delete</button>
          <button id="btnClear" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Clear Form</button>
        </div>

        <details>
          <summary class="text-xs text-slate-500">Debug</summary>
          <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
        </details>
      </div>
    </div>
  `;

  const el = (id)=>document.getElementById(id);
  const setForm = (x)=>{
    el("id").value = x?.id || "";
    el("label").value = x?.label || "";
    el("blog_id").value = x?.blog_id || "";
    el("status").value = x?.status || "active";
    el("cfg").value = x?.config_json || "{}";
  };
  const clearForm = ()=>setForm({});

  async function load(){
    const r = await api("/api/integrations/blogspot/account");
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }
    const rows = r.data.accounts || [];
    el("tbl").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="text-slate-500">
            <tr><th class="text-left py-2">Label</th><th class="text-left py-2">blog_id</th><th class="text-left py-2">status</th><th class="text-right py-2">Action</th></tr>
          </thead>
          <tbody>
            ${rows.map(x=>`
              <tr class="border-t border-slate-100 dark:border-darkBorder">
                <td class="py-2 font-semibold">${x.label||""}</td>
                <td class="py-2"><code>${x.blog_id||""}</code></td>
                <td class="py-2">${x.status||""}</td>
                <td class="py-2 text-right">
                  <button class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300" data-pick='${encodeURIComponent(JSON.stringify(x))}'>Edit</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    el("tbl").querySelectorAll("[data-pick]").forEach(b=>{
      b.onclick = ()=>{
        const x = JSON.parse(decodeURIComponent(b.getAttribute("data-pick")));
        setForm(x);
      };
    });
  }

  el("btnReload").onclick = load;
  el("btnCreate").onclick = ()=>{ clearForm(); toast("Fill form then Save","info"); };

  el("btnSave").onclick = async ()=>{
    const id = el("id").value.trim();
    const label = el("label").value.trim();
    const blog_id = el("blog_id").value.trim();
    const status = el("status").value;
    const cfg = el("cfg").value || "{}";
    try{ JSON.parse(cfg); }catch{ toast("config_json invalid JSON","error"); return; }
    if(!blog_id) return toast("blog_id required","error");

    const payload = { label, blog_id, status, config_json: cfg };
    const r = id
      ? await api("/api/integrations/blogspot/account", { method:"PUT", body: JSON.stringify({ id, ...payload }) })
      : await api("/api/integrations/blogspot/account", { method:"POST", body: JSON.stringify(payload) });

    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ await load(); if(!id) clearForm(); }
  };

  el("btnDelete").onclick = async ()=>{
    const id = el("id").value.trim();
    if(!id) return toast("Pick account first","error");
    if(!confirm("Delete account & cached data?")) return;

    const r = await api("/api/integrations/blogspot/account?id="+encodeURIComponent(id), { method:"DELETE" });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ clearForm(); await load(); }
  };

  el("btnClear").onclick = clearForm;

  await load();
}
