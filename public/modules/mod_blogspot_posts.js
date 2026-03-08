export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm font-bold">Manage Posts</div>
        <div class="text-xs text-slate-500">Saat ini pakai cache D1 (manual create/edit). Sync ke Blogger bisa ditambah setelah API key/OAuth fix.</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input id="account_id" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="account_id (blogspot account id)">
          <input id="q" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="search title/slug">
          <button id="btnLoad" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Load</button>
        </div>
        <div id="tbl" class="text-[12px] text-slate-500">—</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <div class="text-xs font-bold">Edit / Create</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input id="id" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="id (auto)" disabled>
          <input id="external_id" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="external_id (optional)">
          <input id="title" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="title">
          <input id="slug" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="slug">
          <select id="status" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
          <input id="tags" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder='tags_json (e.g. ["a","b"])'>
        </div>
        <textarea id="html" class="w-full h-44 text-[11px] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="content_html"></textarea>
        <div class="flex gap-2 flex-wrap">
          <button id="btnSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Save</button>
          <button id="btnDel" class="text-xs px-3 py-2 rounded-lg bg-danger text-white hover:opacity-90">Delete</button>
          <button id="btnClear" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Clear</button>
        </div>
        <details><summary class="text-xs text-slate-500">Debug</summary><pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre></details>
      </div>
    </div>
  `;

  const el=(id)=>document.getElementById(id);
  const clear=()=>{
    el("id").value=""; el("external_id").value=""; el("title").value=""; el("slug").value="";
    el("status").value="draft"; el("tags").value="[]"; el("html").value="";
  };
  const fill=(x)=>{
    el("id").value=x.id||""; el("external_id").value=x.external_id||"";
    el("title").value=x.title||""; el("slug").value=x.slug||"";
    el("status").value=x.status||"draft"; el("tags").value=x.tags_json||"[]";
    el("html").value=x.content_html||"";
  };

  async function load(){
    const account_id = el("account_id").value.trim();
    const q = el("q").value.trim();
    const r = await api("/api/integrations/blogspot/posts?account_id="+encodeURIComponent(account_id)+"&q="+encodeURIComponent(q)+"&limit=100");
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }
    const rows = r.data.rows||[];
    el("tbl").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="text-slate-500"><tr><th class="text-left py-2">Title</th><th class="text-left py-2">Slug</th><th class="text-left py-2">Status</th><th class="text-right py-2">Action</th></tr></thead>
          <tbody>
            ${rows.map(x=>`
              <tr class="border-t border-slate-100 dark:border-darkBorder">
                <td class="py-2 font-semibold">${x.title||""}</td>
                <td class="py-2"><code>${x.slug||""}</code></td>
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
        fill(x);
      };
    });
  }

  el("btnLoad").onclick = load;
  el("btnClear").onclick = clear;

  el("btnSave").onclick = async ()=>{
    const account_id = el("account_id").value.trim();
    if(!account_id) return toast("account_id required","error");

    const id = el("id").value.trim();
    const payload = {
      id: id || null,
      account_id,
      external_id: el("external_id").value.trim() || null,
      title: el("title").value.trim(),
      slug: el("slug").value.trim(),
      status: el("status").value,
      tags_json: el("tags").value.trim() || "[]",
      content_html: el("html").value || "",
      content_text: ""
    };
    if(!payload.title) return toast("title required","error");
    try{ JSON.parse(payload.tags_json); }catch{ return toast("tags_json invalid","error"); }

    const r = await api("/api/integrations/blogspot/posts", { method:"POST", body: JSON.stringify(payload) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ await load(); }
  };

  el("btnDel").onclick = async ()=>{
    const id = el("id").value.trim();
    if(!id) return toast("Pick row first","error");
    if(!confirm("Delete cached post row?")) return;
    const r = await api("/api/integrations/blogspot/posts?id="+encodeURIComponent(id), { method:"DELETE" });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ clear(); await load(); }
  };

  clear();
}
