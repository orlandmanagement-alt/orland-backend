export default function(Orland){
  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  function toast(msg,type="info"){
    const host=document.getElementById("toast-host");
    if(!host){alert(msg);return;}
    const d=document.createElement("div");
    d.className="fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    d.innerHTML=`<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(d); setTimeout(()=>d.remove(),2800);
  }

  async function listGroups(){ return await Orland.api("/api/oncall/groups"); }
  async function createGroup(name){ return await Orland.api("/api/oncall/groups",{method:"POST",body:JSON.stringify({name})}); }
  async function delGroup(id){ return await Orland.api("/api/oncall/groups?id="+encodeURIComponent(id),{method:"DELETE"}); }

  async function listMembers(group_id){ return await Orland.api("/api/oncall/members?group_id="+encodeURIComponent(group_id)); }
  async function addMember(group_id, user_id){ return await Orland.api("/api/oncall/members",{method:"POST",body:JSON.stringify({group_id,user_id})}); }
  async function delMember(id){ return await Orland.api("/api/oncall/members?id="+encodeURIComponent(id),{method:"DELETE"}); }

  return {
    title:"On-Call Schedule",
    async mount(host){
      host.innerHTML=`
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-base font-bold">On-Call Groups</div>
              <div class="text-xs text-slate-500 mt-1">Create groups & select.</div>
            </div>
            <button id="btnNew" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
              <i class="fa-solid fa-plus mr-2"></i>New
            </button>
          </div>
          <div id="groups" class="mt-3 space-y-2"></div>
        </div>

        <div class="lg:col-span-2 bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-base font-bold">Members</div>
              <div class="text-xs text-slate-500 mt-1">Add member by <code>user_id</code>.</div>
            </div>
            <div class="flex gap-2">
              <input id="inpUser" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="user_id UUID">
              <button id="btnAdd" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Add</button>
            </div>
          </div>

          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                <tr><th class="py-3 pr-3">member_id</th><th class="py-3 pr-3">user_id</th><th class="py-3 text-right">Action</th></tr>
              </thead>
              <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
            </table>
          </div>
        </div>
      </div>`;

      const groupsBox=host.querySelector("#groups");
      const tb=host.querySelector("#tb");
      const inpUser=host.querySelector("#inpUser");
      let curGroup=null;
      let groups=[];

      async function renderGroups(){
        groupsBox.innerHTML=`<div class="text-xs text-slate-500">Loading…</div>`;
        const r=await listGroups();
        if(r.status!=="ok"){ groupsBox.innerHTML=`<div class="text-xs text-red-400">Failed: ${esc(r.status)}</div>`; return; }
        groups=r.data?.groups||[];
        if(!groups.length){
          groupsBox.innerHTML=`<div class="text-xs text-slate-500">No groups</div>`;
          tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="3">Select group</td></tr>`;
          return;
        }
        if(!curGroup) curGroup=groups[0].id;

        groupsBox.innerHTML=groups.map(g=>{
          const active=(g.id===curGroup);
          return `
            <button class="w-full text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder ${active?"bg-primary/10 text-primary": "hover:bg-slate-50 dark:hover:bg-white/5"}" data-gid="${esc(g.id)}">
              <div class="text-xs font-bold">${esc(g.name||g.id)}</div>
              <div class="text-[10px] text-slate-500">${esc(g.id)}</div>
            </button>
          `;
        }).join("");

        groupsBox.querySelectorAll("button[data-gid]").forEach(b=>{
          b.onclick=async ()=>{
            curGroup=b.getAttribute("data-gid");
            await renderMembers();
            await renderGroups();
          };
        });

        // delete by long press alternative: just add confirm button for selected
        const sel = groups.find(x=>x.id===curGroup);
        if(sel){
          const del=document.createElement("button");
          del.className="w-full mt-3 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-danger/10 text-danger";
          del.innerHTML=`<i class="fa-solid fa-trash mr-2"></i>Delete Selected Group`;
          del.onclick=async ()=>{
            if(!confirm("Delete group?")) return;
            const rr=await delGroup(curGroup);
            toast(rr.status, rr.status==="ok"?"success":"error");
            if(rr.status==="ok"){ curGroup=null; await renderGroups(); await renderMembers(); }
          };
          groupsBox.appendChild(del);
        }
      }

      async function renderMembers(){
        if(!curGroup){
          tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="3">Select group</td></tr>`;
          return;
        }
        tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="3">Loading…</td></tr>`;
        const r=await listMembers(curGroup);
        if(r.status!=="ok"){ tb.innerHTML=`<tr><td class="py-4 text-red-400" colspan="3">Failed: ${esc(r.status)}</td></tr>`; return; }
        const rows=r.data?.members||[];
        if(!rows.length){ tb.innerHTML=`<tr><td class="py-4 text-slate-500" colspan="3">No members</td></tr>`; return; }
        tb.innerHTML=rows.map(x=>`
          <tr>
            <td class="py-3 pr-3 text-slate-500"><code>${esc(x.id||"")}</code></td>
            <td class="py-3 pr-3"><code>${esc(x.user_id||"")}</code></td>
            <td class="py-3 text-right">
              <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-danger/10 text-danger" data-del="${esc(x.id)}">Remove</button>
            </td>
          </tr>
        `).join("");

        tb.querySelectorAll("button[data-del]").forEach(b=>{
          b.onclick=async ()=>{
            const id=b.getAttribute("data-del");
            if(!confirm("Remove member?")) return;
            const rr=await delMember(id);
            toast(rr.status, rr.status==="ok"?"success":"error");
            if(rr.status==="ok") renderMembers();
          };
        });
      }

      host.querySelector("#btnNew").onclick=async ()=>{
        const name=prompt("Group name:", "Primary Oncall");
        if(!name) return;
        const rr=await createGroup(name);
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok"){ curGroup=null; await renderGroups(); await renderMembers(); }
      };

      host.querySelector("#btnAdd").onclick=async ()=>{
        if(!curGroup) return toast("Select group first","error");
        const uid=String(inpUser.value||"").trim();
        if(!uid) return toast("user_id required","error");
        const rr=await addMember(curGroup, uid);
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok"){ inpUser.value=""; renderMembers(); }
      };

      await renderGroups();
      await renderMembers();
    }
  };
}
