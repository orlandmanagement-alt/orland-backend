function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");}

export default function BlogspotPosts(ctx){
  const { api, toast, setBreadcrumb } = ctx;
  const el=document.createElement("div");
  el.innerHTML=`
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Manage Posts</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Stored in D1 (cms_items kind=post)</p>
      </div>
      <div class="flex items-center gap-2">
        <select id="status" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          <option value="">all</option>
          <option value="draft">draft</option>
          <option value="published">published</option>
        </select>
        <input id="q" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs w-56" placeholder="search title/slug">
        <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
        <button id="btnNew" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90"><i class="fa-solid fa-plus mr-1"></i>New</button>
      </div>
    </div>
    <div id="table" class="mt-5"></div>
    <details class="mt-5"><summary class="text-xs text-slate-500 cursor-pointer">Debug</summary><pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre></details>
  `;

  async function load(){
    const q=el.querySelector("#q").value.trim();
    const st=el.querySelector("#status").value.trim();
    const url="/api/integrations/blogspot/posts?limit=80"+(q?("&q="+encodeURIComponent(q)):"")+(st?("&status="+encodeURIComponent(st)):"");
    const r=await api(url);
    el.querySelector("#out").textContent=JSON.stringify(r,null,2);
    if(r.status!=="ok"){ el.querySelector("#table").innerHTML=`<div class="text-xs text-slate-500">Failed: ${esc(r.status)}</div>`; return; }

    const rows=r.data?.rows||[];
    el.querySelector("#table").innerHTML=`
      <div class="overflow-x-auto bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">Title</th>
              <th class="px-4 py-3 font-semibold">Slug</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold">Updated</th>
              <th class="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(x=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3">
                  <div class="font-bold text-slate-900 dark:text-white">${esc(x.title||"")}</div>
                  <div class="text-[11px] text-slate-500">id: <code>${esc(x.id||"")}</code></div>
                </td>
                <td class="px-4 py-3 text-slate-500">${esc(x.slug||"")}</td>
                <td class="px-4 py-3">${esc(x.status||"")}</td>
                <td class="px-4 py-3 text-slate-500">${esc(String(x.updated_at||""))}</td>
                <td class="px-4 py-3 text-right">
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-white/5 btnEdit" data-id="${esc(x.id)}">Edit</button>
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-white/5 btnDel" data-id="${esc(x.id)}">Del</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    el.querySelectorAll(".btnEdit").forEach(b=>b.onclick=()=>edit(b.getAttribute("data-id")));
    el.querySelectorAll(".btnDel").forEach(b=>b.onclick=()=>del(b.getAttribute("data-id")));
  }

  async function create(){
    const title=prompt("Title:","")||"";
    if(!title.trim()) return;
    const slug=prompt("Slug (optional):","")||"";
    const status=prompt("Status (draft/published):","draft")||"draft";
    const content_html=prompt("Content HTML (short):","<p>Hello</p>")||"";
    const r=await api("/api/integrations/blogspot/posts",{method:"POST",body:JSON.stringify({title,slug,status,content_html})});
    el.querySelector("#out").textContent=JSON.stringify(r,null,2);
    toast(r.status,r.status==="ok"?"success":"error");
    if(r.status==="ok") load();
  }

  async function edit(id){
    const title=prompt("New title (blank keep):","") ?? "";
    const slug=prompt("New slug (blank keep):","") ?? "";
    const status=prompt("Status (draft/published) blank keep:","") ?? "";
    const content_html=prompt("Content HTML blank keep:","") ?? "";

    const payload={ id, };
    if(title.trim()) payload.title=title.trim();
    if(slug.trim()) payload.slug=slug.trim();
    if(status.trim()) payload.status=status.trim();
    if(content_html.trim()) payload.content_html=content_html;

    const r=await api("/api/integrations/blogspot/posts",{method:"PUT",body:JSON.stringify(payload)});
    el.querySelector("#out").textContent=JSON.stringify(r,null,2);
    toast(r.status,r.status==="ok"?"success":"error");
    if(r.status==="ok") load();
  }

  async function del(id){
    if(!confirm("Delete post?")) return;
    const r=await api("/api/integrations/blogspot/posts?id="+encodeURIComponent(id),{method:"DELETE"});
    el.querySelector("#out").textContent=JSON.stringify(r,null,2);
    toast(r.status,r.status==="ok"?"success":"error");
    if(r.status==="ok") load();
  }

  return {
    mount(host){
      setBreadcrumb("/ integrations / blogspot / posts");
      host.innerHTML=""; host.appendChild(el);
      el.querySelector("#btnReload").onclick=load;
      el.querySelector("#btnNew").onclick=create;
      el.querySelector("#q").addEventListener("keydown",(e)=>{if(e.key==="Enter") load();});
      el.querySelector("#status").onchange=load;
      load();
    }
  };
}
