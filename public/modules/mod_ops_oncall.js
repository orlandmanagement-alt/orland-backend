export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  const fmt = (n)=>{
    try{ return new Intl.NumberFormat("id-ID").format(Number(n||0)); }
    catch{ return String(n||0); }
  };

  async function apiGroups(){
    return await Orland.api("/api/oncall/groups");
  }

  async function apiSaveGroup(payload){
    return await Orland.api("/api/oncall/groups", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function apiRoster(group_id){
    return await Orland.api("/api/oncall/roster?group_id=" + encodeURIComponent(group_id));
  }

  async function apiRosterSave(payload){
    return await Orland.api("/api/oncall/roster", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function apiUsers(q=""){
    return await Orland.api("/api/users/options?q=" + encodeURIComponent(q) + "&limit=20");
  }

  return {
    title:"Oncall",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xl font-extrabold text-slate-900 dark:text-white">Oncall Manager</div>
              <div class="text-sm text-slate-500">Kelola oncall groups dan roster sesuai schema D1 saat ini.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnReload" class="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                Reload
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-[11px] text-slate-500 font-bold">Total Groups</div>
              <div id="kGroups" class="text-2xl font-black mt-1">—</div>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-[11px] text-slate-500 font-bold">Total Members</div>
              <div id="kMembers" class="text-2xl font-black mt-1">—</div>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-[11px] text-slate-500 font-bold">Active Members</div>
              <div id="kActiveMembers" class="text-2xl font-black mt-1">—</div>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-[11px] text-slate-500 font-bold">Selected Group</div>
              <div id="kSelected" class="text-sm font-black mt-2 truncate">—</div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div class="xl:col-span-1 space-y-4">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="text-sm font-extrabold">Create / Edit Group</div>

                <div class="mt-4 space-y-3">
                  <input type="hidden" id="g_id">

                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Name</label>
                    <input id="g_name" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Primary Ops">
                  </div>

                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Rotation</label>
                    <select id="g_rotation" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                      <option value="daily">daily</option>
                      <option value="weekly" selected>weekly</option>
                      <option value="monthly">monthly</option>
                    </select>
                  </div>

                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Timezone</label>
                    <input id="g_timezone" value="UTC" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                  </div>

                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Week Start</label>
                    <select id="g_week_start" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                      <option value="monday" selected>monday</option>
                      <option value="sunday">sunday</option>
                    </select>
                  </div>
                </div>

                <div class="mt-4 flex gap-2 flex-wrap">
                  <button id="btnGroupSave" class="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white">Save Group</button>
                  <button id="btnGroupReset" class="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder">Reset</button>
                </div>

                <div id="groupMsg" class="mt-3 text-xs"></div>
              </div>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="text-sm font-extrabold">Groups</div>
                    <div class="text-[11px] text-slate-500">Pilih group untuk edit roster.</div>
                  </div>
                  <div id="groupsInfo" class="text-[11px] text-slate-500">—</div>
                </div>

                <div id="groupsBox" class="mt-4 space-y-3"></div>
              </div>
            </div>

            <div class="xl:col-span-2 space-y-4">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="text-sm font-extrabold">Selected Group Detail</div>
                <div id="selBox" class="mt-3 text-xs text-slate-500">No group selected.</div>
              </div>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="text-sm font-extrabold">Add / Update Roster</div>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                  <div class="md:col-span-2 relative">
                    <label class="text-[11px] font-bold text-slate-500">Search User</label>
                    <input id="u_search" autocomplete="off" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Nama atau email">
                    <input type="hidden" id="r_user_id">
                    <div id="u_pick_label" class="mt-2 text-[11px] text-slate-500">Belum ada user dipilih</div>
                    <div id="u_results" class="hidden absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-xl max-h-64 overflow-auto"></div>
                  </div>

                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Sort Order</label>
                    <input id="r_sort_order" type="number" value="0" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                  </div>

                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Active</label>
                    <select id="r_active" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                      <option value="1" selected>Yes</option>
                      <option value="0">No</option>
                    </select>
                  </div>
                </div>

                <div class="mt-4 flex gap-2 flex-wrap">
                  <button id="btnRosterSave" class="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white">Save Member</button>
                  <div id="rosterMsg" class="text-xs self-center"></div>
                </div>
              </div>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="text-sm font-extrabold">Roster</div>
                    <div class="text-[11px] text-slate-500">Member oncall untuk group terpilih.</div>
                  </div>
                  <div id="rosterInfo" class="text-[11px] text-slate-500">—</div>
                </div>

                <div id="rosterBox" class="mt-4 space-y-3"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);

      let GROUPS = [];
      let ROSTER = [];
      let SELECTED = null;
      let USER_RESULTS = [];
      let searchTimer = null;

      function resetGroupForm(){
        q("g_id").value = "";
        q("g_name").value = "";
        q("g_rotation").value = "weekly";
        q("g_timezone").value = "UTC";
        q("g_week_start").value = "monday";
      }

      function resetUserPicker(){
        q("u_search").value = "";
        q("r_user_id").value = "";
        q("u_pick_label").textContent = "Belum ada user dipilih";
        q("u_results").innerHTML = "";
        q("u_results").classList.add("hidden");
        USER_RESULTS = [];
      }

      function renderUserResults(){
        const box = q("u_results");
        if(!USER_RESULTS.length){
          box.innerHTML = `<div class="px-3 py-2 text-xs text-slate-500">No users found</div>`;
          box.classList.remove("hidden");
          return;
        }

        box.innerHTML = USER_RESULTS.map(u => `
          <button type="button" class="uItem w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 border-b last:border-b-0 border-slate-100 dark:border-darkBorder"
            data-id="${esc(u.id)}"
            data-name="${esc(u.display_name || "")}"
            data-email="${esc(u.email_norm || "")}">
            <div class="text-xs font-black">${esc(u.display_name || u.email_norm || u.id)}</div>
            <div class="text-[11px] text-slate-500 mt-1">${esc(u.email_norm || "")}</div>
          </button>
        `).join("");
        box.classList.remove("hidden");

        box.querySelectorAll(".uItem").forEach(btn=>{
          btn.onclick = ()=>{
            const id = btn.getAttribute("data-id") || "";
            const nm = btn.getAttribute("data-name") || "";
            const em = btn.getAttribute("data-email") || "";
            q("r_user_id").value = id;
            q("u_pick_label").textContent = (nm || em || id) + (em && nm !== em ? " (" + em + ")" : "");
            q("u_results").classList.add("hidden");
          };
        });
      }

      async function searchUsersNow(text){
        const r = await apiUsers(text);
        if(r.status !== "ok"){
          USER_RESULTS = [];
          renderUserResults();
          return;
        }
        USER_RESULTS = Array.isArray(r.data?.items) ? r.data.items : [];
        renderUserResults();
      }

      function renderKpis(){
        q("kGroups").textContent = fmt(GROUPS.length);
        const totalMembers = GROUPS.reduce((a,g)=>a + Number(g.member_count || 0), 0);
        const totalActive = GROUPS.reduce((a,g)=>a + Number(g.active_member_count || 0), 0);
        q("kMembers").textContent = fmt(totalMembers);
        q("kActiveMembers").textContent = fmt(totalActive);
        q("kSelected").textContent = SELECTED ? (SELECTED.name || SELECTED.id) : "—";
      }

      function renderGroups(){
        q("groupsInfo").textContent = GROUPS.length + " group(s)";

        if(!GROUPS.length){
          q("groupsBox").innerHTML = `<div class="text-xs text-slate-500">No groups.</div>`;
          return;
        }

        q("groupsBox").innerHTML = GROUPS.map(g => `
          <button data-id="${esc(g.id)}" class="groupRow w-full text-left rounded-xl border border-slate-200 dark:border-darkBorder p-3 hover:bg-slate-50 dark:hover:bg-white/5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">${esc(g.name || "Unnamed Group")}</div>
                <div class="text-[11px] text-slate-500 mt-1">
                  rotation: ${esc(g.rotation || "-")} • tz: ${esc(g.timezone || "UTC")} • week_start: ${esc(g.week_start || "monday")}
                </div>
              </div>
              <div class="text-[11px] text-slate-500 shrink-0">
                ${fmt(g.active_member_count || 0)}/${fmt(g.member_count || 0)}
              </div>
            </div>
          </button>
        `).join("");

        q("groupsBox").querySelectorAll(".groupRow").forEach(btn=>{
          btn.onclick = async ()=>{
            const id = btn.getAttribute("data-id");
            SELECTED = GROUPS.find(x => String(x.id) === String(id)) || null;
            fillGroupForm();
            renderSelected();
            renderKpis();
            await loadRoster();
          };
        });
      }

      function fillGroupForm(){
        if(!SELECTED) return;
        q("g_id").value = SELECTED.id || "";
        q("g_name").value = SELECTED.name || "";
        q("g_rotation").value = SELECTED.rotation || "weekly";
        q("g_timezone").value = SELECTED.timezone || "UTC";
        q("g_week_start").value = SELECTED.week_start || "monday";
      }

      function renderSelected(){
        if(!SELECTED){
          q("selBox").innerHTML = `No group selected.`;
          return;
        }

        q("selBox").innerHTML = `
          <div class="space-y-3">
            <div class="text-sm font-extrabold">${esc(SELECTED.name || "-")}</div>
            <div class="text-[11px] text-slate-500">Group ID: ${esc(SELECTED.id || "-")}</div>
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-[11px] text-slate-500">Rotation</div>
                <div class="text-xs font-black mt-1">${esc(SELECTED.rotation || "-")}</div>
              </div>
              <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-[11px] text-slate-500">Timezone</div>
                <div class="text-xs font-black mt-1">${esc(SELECTED.timezone || "-")}</div>
              </div>
              <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-[11px] text-slate-500">Week Start</div>
                <div class="text-xs font-black mt-1">${esc(SELECTED.week_start || "-")}</div>
              </div>
              <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-[11px] text-slate-500">Members</div>
                <div class="text-xs font-black mt-1">${fmt(SELECTED.active_member_count || 0)} active / ${fmt(SELECTED.member_count || 0)} total</div>
              </div>
            </div>
          </div>
        `;
      }

      function renderRoster(){
        if(!SELECTED){
          q("rosterInfo").textContent = "No group selected";
          q("rosterBox").innerHTML = `<div class="text-xs text-slate-500">Select a group first.</div>`;
          return;
        }

        q("rosterInfo").textContent = ROSTER.length + " member(s)";

        if(!ROSTER.length){
          q("rosterBox").innerHTML = `<div class="text-xs text-slate-500">No roster members.</div>`;
          return;
        }

        q("rosterBox").innerHTML = ROSTER.map(m => `
          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">${esc(m.display_name || m.email_norm || m.user_id)}</div>
                <div class="text-[11px] text-slate-500 mt-1">
                  user_id: ${esc(m.user_id || "-")} • sort: ${esc(m.sort_order)} • active: ${String(Number(m.active||0)===1 ? "yes" : "no")}
                </div>
              </div>
              <div class="flex gap-2 shrink-0">
                <button class="btnEdit px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder" data-user="${esc(m.user_id)}" data-sort="${esc(m.sort_order)}" data-active="${esc(m.active)}" data-name="${esc(m.display_name || m.email_norm || m.user_id)}" data-email="${esc(m.email_norm || "")}">
                  Edit
                </button>
                <button class="btnDel px-3 py-2 rounded-xl text-xs font-black border border-red-200 text-red-700 hover:bg-red-50" data-id="${esc(m.id)}">
                  Remove
                </button>
              </div>
            </div>
          </div>
        `).join("");

        q("rosterBox").querySelectorAll(".btnEdit").forEach(btn=>{
          btn.onclick = ()=>{
            q("r_user_id").value = btn.getAttribute("data-user") || "";
            q("r_sort_order").value = btn.getAttribute("data-sort") || "0";
            q("r_active").value = String(btn.getAttribute("data-active") || "1");
            const nm = btn.getAttribute("data-name") || "";
            const em = btn.getAttribute("data-email") || "";
            q("u_pick_label").textContent = (nm || em || q("r_user_id").value) + (em && nm !== em ? " (" + em + ")" : "");
            q("rosterMsg").className = "text-xs text-slate-500 self-center";
            q("rosterMsg").textContent = "Loaded into form.";
          };
        });

        q("rosterBox").querySelectorAll(".btnDel").forEach(btn=>{
          btn.onclick = async ()=>{
            if(!confirm("Remove this roster member?")) return;
            const r = await apiRosterSave({
              action:"remove",
              id: btn.getAttribute("data-id")
            });
            if(r.status !== "ok"){
              q("rosterMsg").className = "text-xs text-red-500 self-center";
              q("rosterMsg").textContent = "Remove failed: " + r.status;
              return;
            }
            q("rosterMsg").className = "text-xs text-emerald-600 self-center";
            q("rosterMsg").textContent = "Member removed.";
            await reloadAll(true);
          };
        });
      }

      async function loadRoster(){
        if(!SELECTED){
          ROSTER = [];
          renderRoster();
          return;
        }
        const r = await apiRoster(SELECTED.id);
        if(r.status !== "ok"){
          ROSTER = [];
          renderRoster();
          return;
        }
        ROSTER = Array.isArray(r.data?.items) ? r.data.items : [];
        renderRoster();
      }

      async function reloadAll(keepSelected=false){
        const g = await apiGroups();
        if(g.status !== "ok"){
          q("groupsBox").innerHTML = `<div class="text-xs text-red-500">Failed: ${esc(g.status)}</div>`;
          return;
        }

        GROUPS = Array.isArray(g.data?.items) ? g.data.items : [];

        if(keepSelected && SELECTED){
          SELECTED = GROUPS.find(x => String(x.id) === String(SELECTED.id)) || null;
        }else if(!SELECTED && GROUPS.length){
          SELECTED = GROUPS[0];
        }

        renderGroups();
        renderSelected();
        renderKpis();
        await loadRoster();
      }

      q("btnReload").onclick = ()=>reloadAll(true);

      q("btnGroupReset").onclick = ()=>{
        SELECTED = null;
        resetGroupForm();
        resetUserPicker();
        renderSelected();
        renderKpis();
        loadRoster();
      };

      q("btnGroupSave").onclick = async ()=>{
        const msg = q("groupMsg");
        msg.className = "mt-3 text-xs text-slate-500";
        msg.textContent = "Saving...";

        const id = q("g_id").value.trim();
        const payload = {
          action: id ? "update" : "create",
          id,
          name: q("g_name").value.trim(),
          rotation: q("g_rotation").value.trim(),
          timezone: q("g_timezone").value.trim(),
          week_start: q("g_week_start").value.trim()
        };

        const r = await apiSaveGroup(payload);
        if(r.status !== "ok"){
          msg.className = "mt-3 text-xs text-red-500";
          msg.textContent = "Save failed: " + r.status;
          return;
        }

        msg.className = "mt-3 text-xs text-emerald-600";
        msg.textContent = id ? "Group updated." : "Group created.";
        await reloadAll(false);
      };

      q("u_search").addEventListener("input", ()=>{
        const val = q("u_search").value.trim();
        q("r_user_id").value = "";
        q("u_pick_label").textContent = val ? "Searching..." : "Belum ada user dipilih";

        clearTimeout(searchTimer);
        if(!val){
          q("u_results").classList.add("hidden");
          q("u_results").innerHTML = "";
          USER_RESULTS = [];
          return;
        }

        searchTimer = setTimeout(async ()=>{
          await searchUsersNow(val);
        }, 250);
      });

      q("u_search").addEventListener("focus", async ()=>{
        const val = q("u_search").value.trim();
        if(val){
          await searchUsersNow(val);
        }
      });

      document.addEventListener("click", (e)=>{
        const wrap = q("u_results");
        const input = q("u_search");
        if(!wrap.contains(e.target) && e.target !== input){
          wrap.classList.add("hidden");
        }
      });

      q("btnRosterSave").onclick = async ()=>{
        const msg = q("rosterMsg");
        if(!SELECTED){
          msg.className = "text-xs text-red-500 self-center";
          msg.textContent = "Select a group first.";
          return;
        }

        if(!q("r_user_id").value){
          msg.className = "text-xs text-red-500 self-center";
          msg.textContent = "Select a user first.";
          return;
        }

        msg.className = "text-xs text-slate-500 self-center";
        msg.textContent = "Saving...";

        const r = await apiRosterSave({
          action:"upsert",
          group_id: SELECTED.id,
          user_id: q("r_user_id").value,
          sort_order: Number(q("r_sort_order").value || 0),
          active: Number(q("r_active").value || 0)
        });

        if(r.status !== "ok"){
          msg.className = "text-xs text-red-500 self-center";
          msg.textContent = "Save failed: " + r.status;
          return;
        }

        msg.className = "text-xs text-emerald-600 self-center";
        msg.textContent = "Roster saved.";
        resetUserPicker();
        await reloadAll(true);
      };

      resetGroupForm();
      resetUserPicker();
      await reloadAll(false);
    }
  };
}
