export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadUser(userId){
    return await Orland.api("/api/user-roles?user_id=" + encodeURIComponent(userId));
  }

  async function saveUserRoles(payload){
    return await Orland.api("/api/user-roles/set", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function findUsers(q){
    return await Orland.api("/api/users/options?q=" + encodeURIComponent(q || ""));
  }

  function badge(roleId){
    const s = String(roleId || "");
    if(["role_super_admin","role_security_admin"].includes(s)){
      return `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">${esc(s)}</span>`;
    }
    return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(s)}</span>`;
  }

  return {
    title: "User Role Assignment",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-6xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">User Role Assignment</div>
                <div class="text-sm text-slate-500 mt-1">Integrasi assignment role user dengan protected role policy.</div>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <input id="qUser" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari user id / email / nama">
              <button id="btnSearch" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Search</button>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">User Results</div>
              <div id="userList" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Role Editor</div>
              <div id="editorBox" class="mt-4 text-sm text-slate-500">Pilih user terlebih dahulu.</div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let SELECTED_USER_ID = "";
      let CURRENT_DATA = null;

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else if(kind === "warning") q("msg").classList.add("text-amber-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderUsers(items){
        if(!items.length){
          q("userList").innerHTML = `<div class="text-sm text-slate-500">No users found.</div>`;
          return;
        }

        q("userList").innerHTML = items.map(u => `
          <button class="userRow w-full text-left rounded-2xl border border-slate-200 dark:border-darkBorder p-4 hover:bg-slate-50 dark:hover:bg-white/5" data-id="${esc(u.id)}">
            <div class="font-black text-sm">${esc(u.display_name || u.email_norm || u.id)}</div>
            <div class="mt-1 text-xs text-slate-500">${esc(u.email_norm || "-")}</div>
            <div class="mt-1 text-[11px] text-slate-400">${esc(u.id)}</div>
          </button>
        `).join("");

        q("userList").querySelectorAll(".userRow").forEach(btn => {
          btn.onclick = async ()=>{
            SELECTED_USER_ID = String(btn.getAttribute("data-id") || "");
            await openUser(SELECTED_USER_ID);
          };
        });
      }

      function renderEditor(data){
        CURRENT_DATA = data;
        const user = data.user || {};
        const role_ids = Array.isArray(data.role_ids) ? data.role_ids : [];
        const all_roles = Array.isArray(data.all_roles) ? data.all_roles : [];
        const selected = new Set(role_ids);

        q("editorBox").innerHTML = `
          <div class="space-y-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-lg font-extrabold">${esc(user.display_name || user.email_norm || user.id)}</div>
              <div class="mt-1 text-sm text-slate-500">${esc(user.email_norm || "-")}</div>
              <div class="mt-1 text-[11px] text-slate-400">${esc(user.id || "-")}</div>
              <div class="mt-3 flex gap-2 flex-wrap">
                ${(role_ids.length ? role_ids : ["no role"]).map(badge).join("")}
              </div>
            </div>

            <form id="roleAssignForm" class="space-y-4">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-sm font-bold text-slate-500 mb-3">Assign Roles</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  ${all_roles.map(r => `
                    <label class="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-darkBorder px-3 py-3 text-sm">
                      <input class="roleCheck" type="checkbox" value="${esc(r.id)}" ${selected.has(r.id) ? "checked" : ""}>
                      <div>
                        <div class="font-semibold">${esc(r.name)}</div>
                        <div class="text-[11px] text-slate-400">${esc(r.id)}</div>
                      </div>
                    </label>
                  `).join("")}
                </div>
              </div>

              <div class="flex gap-2 flex-wrap">
                <button type="button" id="btnCheckAll" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Check All</button>
                <button type="button" id="btnClearAll" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Clear All</button>
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save Roles</button>
              </div>
            </form>
          </div>
        `;

        const form = q("roleAssignForm");
        q("btnCheckAll").onclick = ()=> form.querySelectorAll(".roleCheck").forEach(x => x.checked = true);
        q("btnClearAll").onclick = ()=> form.querySelectorAll(".roleCheck").forEach(x => x.checked = false);

        form.onsubmit = async (ev)=>{
          ev.preventDefault();
          const nextRoleIds = Array.from(form.querySelectorAll(".roleCheck")).filter(x => x.checked).map(x => x.value);
          setMsg("muted", "Saving role assignment...");
          const r = await saveUserRoles({
            user_id: user.id,
            role_ids: nextRoleIds
          });

          if(r.status !== "ok"){
            setMsg("error", "Save failed: " + (r.data?.message || r.status));
            return;
          }

          setMsg("success", "Role assignment saved.");
          await openUser(user.id);
        };
      }

      async function openUser(userId){
        setMsg("muted", "Loading user roles...");
        const r = await loadUser(userId);
        if(r.status !== "ok"){
          q("editorBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed: " + (r.data?.message || r.status));
          return;
        }
        renderEditor(r.data || {});
        setMsg("success", "Loaded.");
      }

      async function searchUsers(){
        const r = await findUsers(q("qUser").value.trim());
        if(r.status !== "ok"){
          q("userList").innerHTML = `<div class="text-sm text-red-500">Search failed.</div>`;
          return;
        }
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        renderUsers(items);
      }

      q("btnSearch").onclick = searchUsers;
      q("qUser").addEventListener("keydown", (e)=>{ if(e.key === "Enter") searchUsers(); });

      await searchUsers();
    }
  };
}
