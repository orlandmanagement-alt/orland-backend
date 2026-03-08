(function(){
  const M = window.Orland?.Modules, API = window.Orland?.API;
  if(!M || !API) return;

  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  M.register("/ops/oncall", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">On-Call Schedule</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Groups & members (admin/super_admin can edit).</p>
          </div>
          <div class="flex gap-2">
            <button id="btnNewGroup" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold"><i class="fa-solid fa-plus mr-2"></i>New Group</button>
            <button id="btnReload" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold dark:bg-white dark:text-slate-900"><i class="fa-solid fa-rotate mr-2"></i>Reload</button>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="text-xs font-bold mb-2">Groups</div>
              <div id="groups"></div>
            </div>
            <div>
              <div class="text-xs font-bold mb-2">Members</div>
              <div id="members"></div>
            </div>
          </div>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="dbg" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    const dbg = document.getElementById("dbg");
    let groups=[], members=[];

    async function load(){
      const r = await API.req("/api/ops/oncall");
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok") return;

      groups = r.data.groups || [];
      members = r.data.members || [];

      render();
    }

    function render(){
      document.getElementById("groups").innerHTML = `
        <div class="space-y-2">
          ${groups.map(g=>`
            <div class="p-3 rounded-lg border border-slate-200 dark:border-darkBorder bg-slate-50/50 dark:bg-black/20">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-bold text-slate-900 dark:text-white truncate">${esc(g.name)}</div>
                  <div class="text-[10px] text-slate-500">rotation: ${esc(g.rotation)} • tz: ${esc(g.timezone)} • week_start: ${esc(g.week_start||"monday")}</div>
                  <div class="text-[10px] text-slate-500">id: ${esc(g.id)}</div>
                </div>
                <button class="btnEditGroup px-2 py-1 rounded bg-slate-100 dark:bg-darkBorder text-xs" data-id="${esc(g.id)}">Edit</button>
              </div>
            </div>
          `).join("")}
        </div>
      `;

      document.querySelectorAll(".btnEditGroup").forEach(b=>{
        b.onclick = async ()=>{
          const id = b.getAttribute("data-id");
          const g = groups.find(x=>x.id===id);
          if(!g) return;
          const name = prompt("name:", g.name) ?? g.name;
          const rotation = prompt("rotation (weekly/daily):", g.rotation) ?? g.rotation;
          const timezone = prompt("timezone:", g.timezone) ?? g.timezone;
          const week_start = prompt("week_start (monday/sunday):", g.week_start||"monday") ?? (g.week_start||"monday");
          const rr = await API.req("/api/ops/oncall",{method:"PUT", body: JSON.stringify({ kind:"update_group", id, name, rotation, timezone, week_start })});
          dbg.textContent = JSON.stringify(rr,null,2);
          alert(rr.status);
          await load();
        };
      });

      document.getElementById("members").innerHTML = `
        <div class="space-y-2">
          <button id="btnAddMember" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold w-full">
            <i class="fa-solid fa-user-plus mr-2"></i>Add Member
          </button>
          ${members.map(m=>`
            <div class="p-3 rounded-lg border border-slate-200 dark:border-darkBorder bg-slate-50/50 dark:bg-black/20">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-bold text-slate-900 dark:text-white truncate">user_id: ${esc(m.user_id)}</div>
                  <div class="text-[10px] text-slate-500">group_id: ${esc(m.group_id)} • order: ${esc(m.sort_order)} • active: ${esc(m.active)}</div>
                  <div class="text-[10px] text-slate-500">id: ${esc(m.id)}</div>
                </div>
                <div class="flex gap-2">
                  <button class="btnToggle px-2 py-1 rounded bg-slate-100 dark:bg-darkBorder text-xs" data-id="${esc(m.id)}" data-active="${esc(m.active)}">Toggle</button>
                  <button class="btnDel px-2 py-1 rounded bg-slate-100 dark:bg-darkBorder text-xs" data-id="${esc(m.id)}">Del</button>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `;

      document.getElementById("btnAddMember").onclick = async ()=>{
        const group_id = prompt("group_id (copy from group):","") || "";
        const user_id = prompt("user_id (from users table):","") || "";
        const sort_order = Number(prompt("sort_order:","0")||"0");
        if(!group_id || !user_id) return alert("group_id & user_id required");
        const rr = await API.req("/api/ops/oncall",{method:"POST", body: JSON.stringify({ kind:"add_member", group_id, user_id, sort_order })});
        dbg.textContent = JSON.stringify(rr,null,2);
        alert(rr.status);
        await load();
      };

      document.querySelectorAll(".btnToggle").forEach(b=>{
        b.onclick = async ()=>{
          const id=b.getAttribute("data-id");
          const active=b.getAttribute("data-active")==="1" ? "0":"1";
          const rr = await API.req("/api/ops/oncall",{method:"PUT", body: JSON.stringify({ kind:"toggle_member", id, active })});
          dbg.textContent = JSON.stringify(rr,null,2);
          alert(rr.status);
          await load();
        };
      });

      document.querySelectorAll(".btnDel").forEach(b=>{
        b.onclick = async ()=>{
          const id=b.getAttribute("data-id");
          if(!confirm("Remove member?")) return;
          const rr = await API.req("/api/ops/oncall",{method:"PUT", body: JSON.stringify({ kind:"remove_member", id })});
          dbg.textContent = JSON.stringify(rr,null,2);
          alert(rr.status);
          await load();
        };
      });
    }

    document.getElementById("btnNewGroup").onclick = async ()=>{
      const name = prompt("Group name:","Ops Primary") || "";
      if(!name.trim()) return;
      const rotation = prompt("rotation (weekly/daily):","weekly") || "weekly";
      const timezone = prompt("timezone:","UTC") || "UTC";
      const week_start = prompt("week_start (monday/sunday):","monday") || "monday";
      const r = await API.req("/api/ops/oncall",{method:"POST", body: JSON.stringify({ kind:"create_group", name, rotation, timezone, week_start })});
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
      await load();
    };

    document.getElementById("btnReload").onclick = load;

    await load();
  });
})();
