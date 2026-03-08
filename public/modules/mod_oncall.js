export async function mount(ctx){
  const { host, api, toast } = ctx;
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  host.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="text-sm font-bold">On-Call Schedule</div>
          <div class="text-xs text-slate-500">Groups: <code>/api/ops/oncall/groups</code> • Members: <code>/api/ops/oncall/members</code></div>
        </div>
        <div class="flex gap-2">
          <button id="btnReload" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
          <button id="btnNewGroup" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">New Group</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder text-xs font-bold">Groups</div>
          <div id="grp" class="p-3 text-xs text-slate-500">Loading…</div>
        </div>

        <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder text-xs font-bold">Members</div>
          <div id="mem" class="p-3 text-xs text-slate-500">Select a group…</div>
        </div>
      </div>

      <details>
        <summary class="text-xs text-slate-500">Debug</summary>
        <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
      </details>
    </div>
  `;

  const $ = (id)=>document.getElementById(id);
  let selectedGroupId = null;

  async function loadGroups(){
    const g = await api("/api/ops/oncall/groups");
    $("dbg").textContent = JSON.stringify(g,null,2);

    if(g.status!=="ok"){ $("grp").textContent="Failed: "+g.status; return; }
    const rows = g.data.rows || [];

    $("grp").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="text-slate-500">
            <tr><th class="py-2 pr-3">Name</th><th class="py-2 pr-3">TZ</th><th class="py-2 pr-3">Rotation</th><th class="py-2 pr-3 text-right">Action</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(r=>`
              <tr class="${selectedGroupId===r.id ? "bg-slate-50 dark:bg-white/5":""}">
                <td class="py-2 pr-3 font-bold">${esc(r.name)}</td>
                <td class="py-2 pr-3">${esc(r.timezone)}</td>
                <td class="py-2 pr-3">${esc(r.rotation)}</td>
                <td class="py-2 pr-1 text-right">
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-sel="${r.id}">Open</button>
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-del="${r.id}">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    host.querySelectorAll("[data-sel]").forEach(b=>b.onclick=async ()=>{
      selectedGroupId = b.dataset.sel;
      await loadGroups();
      await loadMembers();
    });
    host.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>delGroup(b.dataset.del));
  }

  async function loadMembers(){
    if(!selectedGroupId){ $("mem").textContent="Select a group…"; return; }
    const m = await api("/api/ops/oncall/members?group_id="+encodeURIComponent(selectedGroupId));
    $("dbg").textContent = JSON.stringify(m,null,2);

    if(m.status!=="ok"){ $("mem").textContent="Failed: "+m.status; return; }
    const rows = m.data.rows || [];

    $("mem").innerHTML = `
      <div class="flex gap-2 mb-3">
        <button id="btnAddMember" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Add Member</button>
        <button id="btnSortHint" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Hint</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="text-slate-500">
            <tr><th class="py-2 pr-3">User</th><th class="py-2 pr-3">Active</th><th class="py-2 pr-3">Sort</th><th class="py-2 pr-3 text-right">Action</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(r=>`
              <tr>
                <td class="py-2 pr-3">
                  <div class="font-bold">${esc(r.display_name||"-")}</div>
                  <div class="text-[10px] text-slate-500">${esc(r.email_norm||r.user_id||"")}</div>
                </td>
                <td class="py-2 pr-3">${r.active ? "1" : "0"}</td>
                <td class="py-2 pr-3">${esc(r.sort_order)}</td>
                <td class="py-2 pr-1 text-right">
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-toggle="${r.id}" data-active="${r.active}">${r.active? "Disable":"Enable"}</button>
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-sort="${r.id}" data-cur="${r.sort_order}">Sort</button>
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-rm="${r.id}">Remove</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    $("#btnAddMember").onclick = addMember;
    $("#btnSortHint").onclick = ()=>alert("sort_order kecil tampil lebih atas (0,1,2...).");

    host.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>toggleMember(b.dataset.toggle, b.dataset.active));
    host.querySelectorAll("[data-sort]").forEach(b=>b.onclick=()=>sortMember(b.dataset.sort, b.dataset.cur));
    host.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>removeMember(b.dataset.rm));
  }

  async function addMember(){
    const user_id = prompt("user_id (copy dari users table):", "") || "";
    if(!user_id.trim()) return;
    const sort_order = Number(prompt("sort_order (0..):","0")||"0");
    const r = await api("/api/ops/oncall/members", { method:"POST", body: JSON.stringify({ group_id:selectedGroupId, user_id, sort_order, active:1 }) });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await loadMembers();
  }

  async function toggleMember(id, active){
    const cur = String(active)==="1" || String(active)==="true";
    const r = await api("/api/ops/oncall/members", { method:"PUT", body: JSON.stringify({ id, active: cur?0:1 }) });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await loadMembers();
  }

  async function sortMember(id, cur){
    const so = Number(prompt("new sort_order:", String(cur||"0"))||String(cur||"0"));
    const r = await api("/api/ops/oncall/members", { method:"PUT", body: JSON.stringify({ id, sort_order: so }) });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await loadMembers();
  }

  async function removeMember(id){
    if(!confirm("Remove member?")) return;
    const r = await api("/api/ops/oncall/members?id="+encodeURIComponent(id), { method:"DELETE" });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await loadMembers();
  }

  async function delGroup(id){
    if(!confirm("Delete group? (members deleted too)")) return;
    const r = await api("/api/ops/oncall/groups?id="+encodeURIComponent(id), { method:"DELETE" });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(selectedGroupId===id) selectedGroupId=null;
    await loadGroups();
    await loadMembers();
  }

  $("#btnReload").onclick = async ()=>{ await loadGroups(); await loadMembers(); };
  $("#btnNewGroup").onclick = async ()=>{
    const name = prompt("Group name:", "Primary Oncall") || "";
    if(!name.trim()) return;
    const timezone = prompt("Timezone:", "UTC") || "UTC";
    const rotation = prompt("Rotation:", "weekly") || "weekly";
    const week_start = prompt("Week start:", "monday") || "monday";
    const r = await api("/api/ops/oncall/groups", { method:"POST", body: JSON.stringify({ name, timezone, rotation, week_start }) });
    $("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    await loadGroups();
  };

  await loadGroups();
  await loadMembers();
}
