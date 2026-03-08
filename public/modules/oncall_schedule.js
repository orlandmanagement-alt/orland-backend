export default function OncallScheduleModule(ctx){
  const { api, toast, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">On-Call Schedule</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Groups + members rotation list</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
        <button id="btnAddGroup" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90"><i class="fa-solid fa-plus mr-1"></i>Group</button>
        <button id="btnAddMember" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5"><i class="fa-solid fa-user-plus mr-1"></i>Member</button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm p-4">
        <div class="text-xs font-bold text-slate-900 dark:text-white mb-3">Groups</div>
        <div id="groups"></div>
      </div>

      <div class="lg:col-span-2 bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-bold text-slate-900 dark:text-white">Members</div>
          <div class="text-[11px] text-slate-500">Selected group: <code id="selGroup">—</code></div>
        </div>
        <div id="members"></div>
      </div>
    </div>

    <details class="mt-5">
      <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
      <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
    </details>
  `;

  let groups = [];
  let selectedGroupId = "";

  function renderGroups(){
    const box = el.querySelector("#groups");
    if(!groups.length){
      box.innerHTML = `<div class="text-xs text-slate-500">No groups</div>`;
      return;
    }
    box.innerHTML = groups.map(g=>`
      <button class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder mb-2 hover:bg-slate-50 dark:hover:bg-white/5 ${selectedGroupId===g.id?'bg-slate-50 dark:bg-white/5':''}" data-id="${g.id}">
        <div class="font-bold text-slate-900 dark:text-white">${g.name}</div>
        <div class="text-[11px] text-slate-500">${g.rotation} • ${g.timezone} • week_start=${g.week_start||"monday"}</div>
      </button>
    `).join("");

    box.querySelectorAll("button[data-id]").forEach(b=>{
      b.onclick = async ()=>{
        selectedGroupId = b.getAttribute("data-id");
        el.querySelector("#selGroup").textContent = selectedGroupId;
        renderGroups();
        await loadMembers();
      };
    });
  }

  async function loadGroups(){
    const r = await api("/api/oncall/groups");
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    if(r.status !== "ok"){
      toast("groups failed: "+r.status,"error");
      return;
    }
    groups = r.data?.groups || [];
    if(!selectedGroupId && groups.length) selectedGroupId = groups[0].id;
    el.querySelector("#selGroup").textContent = selectedGroupId || "—";
    renderGroups();
  }

  async function loadMembers(){
    if(!selectedGroupId){
      el.querySelector("#members").innerHTML = `<div class="text-xs text-slate-500">Select group</div>`;
      return;
    }
    const r = await api("/api/oncall/members?group_id="+encodeURIComponent(selectedGroupId));
    const out = el.querySelector("#out").textContent || "";
    el.querySelector("#out").textContent = out + "\n\n" + JSON.stringify({ members:r },null,2);

    if(r.status !== "ok"){
      el.querySelector("#members").innerHTML = `<div class="text-xs text-slate-500">Failed: ${r.status}</div>`;
      return;
    }

    const rows = r.data?.members || [];
    el.querySelector("#members").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">User</th>
              <th class="px-4 py-3 font-semibold">Sort</th>
              <th class="px-4 py-3 font-semibold">Active</th>
              <th class="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(x=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3">
                  <div class="font-bold text-slate-900 dark:text-white">${x.display_name||"-"}</div>
                  <div class="text-[11px] text-slate-500">${x.email_norm||""}</div>
                  <div class="text-[11px] text-slate-500">user_id: <code>${x.user_id||""}</code></div>
                </td>
                <td class="px-4 py-3"><input data-sort="${x.id}" value="${x.sort_order||0}" class="w-20 px-2 py-1 rounded border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark"></td>
                <td class="px-4 py-3">
                  <input type="checkbox" data-active="${x.id}" ${Number(x.active||0)===1?"checked":""}>
                </td>
                <td class="px-4 py-3 text-right">
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-white/5 btnSave" data-id="${x.id}">Save</button>
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-white/5 btnDel" data-id="${x.id}">Del</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    el.querySelectorAll(".btnSave").forEach(b=>b.onclick = async ()=>{
      const id = b.getAttribute("data-id");
      const sort = Number(el.querySelector(`input[data-sort="${id}"]`)?.value||0);
      const active = !!el.querySelector(`input[data-active="${id}"]`)?.checked;
      const rr = await api("/api/oncall/members", { method:"PUT", body: JSON.stringify({ id, sort_order: sort, active }) });
      toast(rr.status, rr.status==="ok"?"success":"error");
      if(rr.status==="ok") loadMembers();
    });
    el.querySelectorAll(".btnDel").forEach(b=>b.onclick = async ()=>{
      const id = b.getAttribute("data-id");
      if(!confirm("Delete member?")) return;
      const rr = await api("/api/oncall/members?id="+encodeURIComponent(id), { method:"DELETE" });
      toast(rr.status, rr.status==="ok"?"success":"error");
      if(rr.status==="ok") loadMembers();
    });
  }

  async function addGroup(){
    const name = prompt("Group name:","Ops Primary")||"";
    if(!name.trim()) return;
    const rotation = prompt("rotation (weekly):","weekly")||"weekly";
    const timezone = prompt("timezone (UTC):","UTC")||"UTC";
    const week_start = prompt("week_start (monday):","monday")||"monday";
    const rr = await api("/api/oncall/groups", { method:"POST", body: JSON.stringify({ name, rotation, timezone, week_start }) });
    toast(rr.status, rr.status==="ok"?"success":"error");
    if(rr.status==="ok"){ await loadGroups(); await loadMembers(); }
  }

  async function addMember(){
    if(!selectedGroupId) return toast("Select group first","error");
    const user_id = prompt("user_id (UUID):","")||"";
    if(!user_id.trim()) return;
    const sort_order = Number(prompt("sort_order:","0")||"0");
    const rr = await api("/api/oncall/members", { method:"POST", body: JSON.stringify({ group_id:selectedGroupId, user_id, sort_order, active:true }) });
    toast(rr.status, rr.status==="ok"?"success":"error");
    if(rr.status==="ok") loadMembers();
  }

  async function reloadAll(){
    await loadGroups();
    await loadMembers();
  }

  return {
    mount(host){
      setBreadcrumb("/ ops / oncall");
      host.innerHTML="";
      host.appendChild(el);

      el.querySelector("#btnReload").onclick = reloadAll;
      el.querySelector("#btnAddGroup").onclick = addGroup;
      el.querySelector("#btnAddMember").onclick = addMember;

      reloadAll();
    }
  };
}
