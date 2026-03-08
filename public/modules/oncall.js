(function(){
  const Orland = window.Orland;

  Orland.registerModule("oncall", {
    async mount(host, ctx){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">On-Call Schedule</h2>
              <div class="text-xs text-slate-500">Groups + Members</div>
            </div>
            <div class="flex gap-2">
              <button id="btnReload" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Reload</button>
              <button id="btnCreateGroup" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Create Group</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
              <div class="text-sm font-bold mb-3">Groups</div>
              <div id="groups"></div>
            </div>

            <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
              <div class="flex items-center justify-between">
                <div class="text-sm font-bold">Members</div>
                <button id="btnAddMember" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Add Member</button>
              </div>
              <div class="text-[10px] text-slate-500 mt-1">Select group first.</div>
              <div class="mt-3 overflow-x-auto">
                <table class="w-full text-left text-xs whitespace-nowrap">
                  <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                    <tr><th class="py-2">User</th><th class="py-2">Sort</th><th class="py-2">Active</th><th class="py-2 text-right">Action</th></tr>
                  </thead>
                  <tbody id="members"></tbody>
                </table>
              </div>
            </div>
          </div>

          <details class="text-[11px] text-slate-500">
            <summary>Debug</summary>
            <pre id="dbg" class="whitespace-pre-wrap"></pre>
          </details>
        </div>
      `;

      const dbg = document.getElementById("dbg");
      let selectedGroup = null;
      let groupRows = [];

      async function load(){
        const r = await ctx.api("/api/oncall/groups");
        if(dbg) dbg.textContent = JSON.stringify(r,null,2);
        if(r.status!=="ok"){ ctx.toast(r.status,"error"); return; }
        groupRows = r.data.rows||[];
        renderGroups();
        if(!selectedGroup && groupRows[0]) selectedGroup = groupRows[0].id;
        if(selectedGroup) await loadMembers(selectedGroup);
      }

      function renderGroups(){
        const box = document.getElementById("groups");
        box.innerHTML = groupRows.map(g=>`
          <button class="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-darkBorder mb-2 hover:bg-slate-50 dark:hover:bg-white/5 ${g.id===selectedGroup?'bg-slate-50 dark:bg-white/5':''}" data-id="${ctx.esc(g.id)}">
            <div class="font-bold text-slate-900 dark:text-white">${ctx.esc(g.name)}</div>
            <div class="text-[10px] text-slate-500">rotation: ${ctx.esc(g.rotation)} • tz: ${ctx.esc(g.timezone)} • week_start: ${ctx.esc(g.week_start||"monday")}</div>
          </button>
        `).join("");
        box.querySelectorAll("button[data-id]").forEach(b=>{
          b.onclick = async ()=>{
            selectedGroup = b.getAttribute("data-id");
            renderGroups();
            await loadMembers(selectedGroup);
          };
        });
      }

      async function loadMembers(group_id){
        const r = await ctx.api("/api/oncall/members?group_id="+encodeURIComponent(group_id));
        if(dbg) dbg.textContent = JSON.stringify(r,null,2);
        const body = document.getElementById("members");
        if(r.status!=="ok"){ body.innerHTML = `<tr><td class="py-2 text-danger" colspan="4">${ctx.esc(r.status)}</td></tr>`; return; }
        body.innerHTML = (r.data.rows||[]).map(m=>`
          <tr class="border-b border-slate-100 dark:border-darkBorder">
            <td class="py-2">
              <div class="font-bold">${ctx.esc(m.display_name||"")}</div>
              <div class="text-[10px] text-slate-500">${ctx.esc(m.email_norm||m.user_id||"")}</div>
            </td>
            <td class="py-2">${ctx.esc(String(m.sort_order||0))}</td>
            <td class="py-2">${Number(m.active||0)?'yes':'no'}</td>
            <td class="py-2 text-right">
              <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-xs btnToggle" data-id="${ctx.esc(m.id)}" data-active="${ctx.esc(String(m.active||0))}">Toggle</button>
            </td>
          </tr>
        `).join("");

        body.querySelectorAll(".btnToggle").forEach(b=>{
          b.onclick = async ()=>{
            const id=b.getAttribute("data-id");
            const cur=Number(b.getAttribute("data-active")||"0");
            const rr=await ctx.api("/api/oncall/members",{method:"PUT",body:JSON.stringify({id,active:cur?0:1})});
            if(dbg) dbg.textContent = JSON.stringify(rr,null,2);
            ctx.toast(rr.status, rr.status==="ok"?"success":"error");
            if(rr.status==="ok") loadMembers(group_id);
          };
        });
      }

      document.getElementById("btnReload").onclick = load;

      document.getElementById("btnCreateGroup").onclick = async ()=>{
        const name = prompt("Group name:","Ops")||"";
        if(!name.trim()) return;
        const rotation = prompt("rotation (weekly/daily):","weekly")||"weekly";
        const timezone = prompt("timezone:","UTC")||"UTC";
        const week_start = prompt("week_start (monday/sunday):","monday")||"monday";
        const rr = await ctx.api("/api/oncall/groups",{method:"POST",body:JSON.stringify({name,rotation,timezone,week_start})});
        if(dbg) dbg.textContent = JSON.stringify(rr,null,2);
        ctx.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") load();
      };

      document.getElementById("btnAddMember").onclick = async ()=>{
        if(!selectedGroup) return ctx.toast("Select group first","error");
        const user_id = prompt("user_id (UUID from users table):","");
        if(!user_id) return;
        const sort_order = Number(prompt("sort_order:", "0")||"0");
        const rr = await ctx.api("/api/oncall/members",{method:"POST",body:JSON.stringify({group_id:selectedGroup,user_id,sort_order,active:1})});
        if(dbg) dbg.textContent = JSON.stringify(rr,null,2);
        ctx.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") loadMembers(selectedGroup);
      };

      await load();
    }
  });
})();
