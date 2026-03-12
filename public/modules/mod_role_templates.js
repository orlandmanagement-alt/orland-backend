export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadTemplates(){
    return await Orland.api("/api/access/role-templates");
  }

  async function loadRoles(){
    return await Orland.api("/api/roles");
  }

  async function cloneRole(payload){
    return await Orland.api("/api/access/role-clone", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"Role Templates + Clone",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">Role Templates + Clone</div>
            <div class="text-sm text-slate-500 mt-1">Buat role baru dari template atau clone role existing.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Create from Template</div>
              <div id="tplBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Clone Existing Role</div>
              <form id="cloneForm" class="mt-4 space-y-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">Source Role</label>
                  <select name="source_role_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold"></select>
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">New Role ID</label>
                  <input name="new_role_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="role_custom_ops">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">New Role Name</label>
                  <input name="new_role_name" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="custom_ops">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">Description</label>
                  <input name="description" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Clone from existing role">
                </div>
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Clone Role</button>
              </form>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function render(){
        setMsg("muted", "Loading templates...");
        const [t, r] = await Promise.all([loadTemplates(), loadRoles()]);

        if(t.status !== "ok" || r.status !== "ok"){
          setMsg("error", "Load failed.");
          return;
        }

        const templates = Array.isArray(t.data?.items) ? t.data.items : [];
        const roles = Array.isArray(r.data?.items) ? r.data.items : [];

        q("cloneForm").source_role_id.innerHTML = roles.map(x => `
          <option value="${esc(x.id)}">${esc(x.name)} (${esc(x.id)})</option>
        `).join("");

        q("tplBox").innerHTML = templates.map(tpl => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="font-black text-sm">${esc(tpl.name)}</div>
            <div class="text-sm text-slate-500 mt-2">${esc(tpl.description || "-")}</div>
            <div class="mt-3 text-xs text-slate-500">${(tpl.suggested_menu_codes || []).map(esc).join(", ")}</div>
            <form class="tplForm mt-4 grid grid-cols-1 gap-3" data-template-id="${esc(tpl.id)}">
              <input type="hidden" name="menu_codes" value="${esc(JSON.stringify(tpl.suggested_menu_codes || []))}">
              <input name="new_role_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="role_${esc(tpl.role_name)}">
              <input name="new_role_name" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="${esc(tpl.role_name)}">
              <input name="description" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Template based role">
              <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Create from Template</button>
            </form>
          </div>
        `).join("");

        q("tplBox").querySelectorAll(".tplForm").forEach(form => {
          form.onsubmit = async (ev)=>{
            ev.preventDefault();
            const payload = {
              mode: "template",
              new_role_id: String(form.new_role_id.value || "").trim(),
              new_role_name: String(form.new_role_name.value || "").trim(),
              description: String(form.description.value || "").trim(),
              menu_codes: JSON.parse(String(form.menu_codes.value || "[]"))
            };
            setMsg("muted", "Creating role from template...");
            const rr = await cloneRole(payload);
            if(rr.status !== "ok"){
              setMsg("error", "Create failed: " + (rr.data?.message || rr.status));
              return;
            }
            setMsg("success", "Role created from template.");
            await render();
          };
        });

        q("cloneForm").onsubmit = async (ev)=>{
          ev.preventDefault();
          const form = q("cloneForm");
          const payload = {
            mode: "clone_role",
            source_role_id: String(form.source_role_id.value || "").trim(),
            new_role_id: String(form.new_role_id.value || "").trim(),
            new_role_name: String(form.new_role_name.value || "").trim(),
            description: String(form.description.value || "").trim()
          };
          setMsg("muted", "Cloning role...");
          const rr = await cloneRole(payload);
          if(rr.status !== "ok"){
            setMsg("error", "Clone failed: " + (rr.data?.message || rr.status));
            return;
          }
          form.reset();
          setMsg("success", "Role cloned.");
          await render();
        };

        setMsg("success", "Loaded.");
      }

      await render();
    }
  };
}
