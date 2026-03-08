export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-2 justify-between">
        <div>
          <div class="text-sm font-bold">On-Call Schedule</div>
          <div class="text-xs text-slate-500">Groups + Members (rotation metadata)</div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button id="btnReload" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Reload</button>
          <button id="btnNewGroup" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white">New Group</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-2">
          <div class="text-xs font-bold">Groups</div>
          <div id="groups" class="text-[12px] text-slate-500">Loading…</div>

          <div class="mt-3 space-y-2">
            <div class="text-xs font-bold">Edit / Create Group</div>
            <input id="gid" disabled class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2 w-full" placeholder="id">
            <input id="gname" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2 w-full" placeholder="name">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input id="grot" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="rotation" value="weekly">
              <input id="gtz" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="timezone" value="UTC">
              <select id="gws" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
                <option value="monday" selected>monday</option>
                <option value="sunday">sunday</option>
              </select>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnSaveGroup" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Save</button>
              <button id="btnDelGroup" class="text-xs px-3 py-2 rounded-lg bg-danger text-white">Delete</button>
              <button id="btnClearGroup" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Clear</button>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-2">
          <div class="flex items-center justify-between">
            <div class="text-xs font-bold">Members</div>
            <button id="btnAddMember" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white">Add Member</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input id="m_user" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="user_id">
            <input id="m_sort" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="sort_order" value="0">
            <select id="m_active" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
              <option value="1" selected>active</option>
              <option value="0">inactive</option>
            </select>
          </div>

          <div id="members" class="text-[12px] text-slate-500">Pick a group…</div>

          <details><summary class="text-xs text-slate-500">Debug</summary><pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre></details>
        </div>
      </div>
    </div>
  `;

  const el=(id)=>document.getElementById(id);
  let currentGroup = "";

  const clearGroup=()=>{
    el("gid").value=""; el("gname").value=""; el("grot").value="weekly"; el("gtz").value="UTC"; el("gws").value="monday";
    currentGroup="";
    el("members").textContent="Pick a group…";
  };

  async function loadGroups(){
    const r = await api("/api/ops/oncall-groups");
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }
    const rows=r.data.rows||[];
    el("groups").innerHTML = `
      <div class="space-y-2">
        ${rows.map(g=>`
          <div class="border border-slate-200 dark:border-darkBorder rounded-lg p-2 flex items-center justify-between">
            <div>
              <div class="text-xs font-bold">${g.name}</div>
              <div class="text-[10px] text-slate-500"><code>${g.id}</code> • ${g.rotation} • ${g.timezone} • ${g.week_start}</div>
            </div>
            <div class="flex gap-2">
              <button class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300" data-pick='${encodeURIComponent(JSON.stringify(g))}'>Select</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    el("groups").querySelectorAll("[data-pick]").forEach(b=>{
      b.onclick=async ()=>{
        const g = JSON.parse(decodeURIComponent(b.getAttribute("data-pick")));
        el("gid").value=g.id; el("gname").value=g.name; el("grot").value=g.rotation; el("gtz").value=g.timezone; el("gws").value=g.week_start;
        currentGroup=g.id;
        await loadMembers();
      };
    });
  }

  async function loadMembers(){
    if(!currentGroup){ el("members").textContent="Pick a group…"; return; }
    const r = await api("/api/ops/oncall-members?group_id="+encodeURIComponent(currentGroup));
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }
    const rows=r.data.rows||[];
    el("members").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="text-slate-500"><tr><th class="text-left py-2">User</th><th class="text-left py-2">Sort</th><th class="text-left py-2">Active</th><th class="text-right py-2">Action</th></tr></thead>
          <tbody>
            ${rows.map(x=>`
              <tr class="border-t border-slate-100 dark:border-darkBorder">
                <td class="py-2">
                  <div class="font-semibold">${x.display_name||""}</div>
                  <div class="text-[10px] text-slate-500"><code>${x.user_id}</code> • ${x.email_norm||""}</div>
                </td>
                <td class="py-2">${x.sort_order}</td>
                <td class="py-2">${x.active? "1":"0"}</td>
                <td class="py-2 text-right">
                  <button class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300" data-del="${x.id}">Remove</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    el("members").querySelectorAll("[data-del]").forEach(b=>{
      b.onclick=async ()=>{
        const id=b.getAttribute("data-del");
        if(!confirm("Remove member?")) return;
        const rr = await api("/api/ops/oncall-members?id="+encodeURIComponent(id), { method:"DELETE" });
        toast(rr.status, rr.status==="ok"?"success":"error");
        await loadMembers();
      };
    });
  }

  el("btnReload").onclick = async ()=>{ await loadGroups(); await loadMembers(); };
  el("btnNewGroup").onclick = ()=>{ clearGroup(); toast("Fill group then Save","info"); };
  el("btnClearGroup").onclick = clearGroup;

  el("btnSaveGroup").onclick = async ()=>{
    const id = el("gid").value.trim();
    const payload = {
      id: id || null,
      name: el("gname").value.trim(),
      rotation: el("grot").value.trim() || "weekly",
      timezone: el("gtz").value.trim() || "UTC",
      week_start: el("gws").value
    };
    if(!payload.name) return toast("name required","error");

    const r = id
      ? await api("/api/ops/oncall-groups", { method:"PUT", body: JSON.stringify(payload) })
      : await api("/api/ops/oncall-groups", { method:"POST", body: JSON.stringify(payload) });

    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ await loadGroups(); if(!id){ clearGroup(); } }
  };

  el("btnDelGroup").onclick = async ()=>{
    const id = el("gid").value.trim();
    if(!id) return toast("Pick group first","error");
    if(!confirm("Delete group + members? (super_admin only)")) return;
    const r = await api("/api/ops/oncall-groups?id="+encodeURIComponent(id), { method:"DELETE" });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ clearGroup(); await loadGroups(); }
  };

  el("btnAddMember").onclick = async ()=>{
    if(!currentGroup) return toast("Pick group first","error");
    const user_id = el("m_user").value.trim();
    if(!user_id) return toast("user_id required","error");
    const payload = {
      group_id: currentGroup,
      user_id,
      sort_order: Number(el("m_sort").value||0),
      active: Number(el("m_active").value||1)
    };
    const r = await api("/api/ops/oncall-members", { method:"POST", body: JSON.stringify(payload) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ el("m_user").value=""; await loadMembers(); }
  };

  clearGroup();
  await loadGroups();
}
