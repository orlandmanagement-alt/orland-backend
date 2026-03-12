export default function(Orland){
  async function loadPolicy(){
    return await Orland.api("/api/menu-policies");
  }
  async function savePolicy(payload){
    return await Orland.api("/api/menu-policies", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"Protected Menu Policy",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-5xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">Protected Menu Policy</div>
            <div class="text-sm text-slate-500 mt-1">Lindungi menu kritikal dari delete atau perubahan path/parent/group.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <form id="form" class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5 space-y-4">
            <label class="flex items-center gap-3"><input type="checkbox" name="enabled"><span class="font-semibold">Policy enabled</span></label>
            <label class="flex items-center gap-3"><input type="checkbox" name="deny_delete"><span class="font-semibold">Deny delete</span></label>
            <label class="flex items-center gap-3"><input type="checkbox" name="deny_path_change"><span class="font-semibold">Deny path change</span></label>
            <label class="flex items-center gap-3"><input type="checkbox" name="deny_parent_change"><span class="font-semibold">Deny parent change</span></label>
            <label class="flex items-center gap-3"><input type="checkbox" name="deny_group_change"><span class="font-semibold">Deny group change</span></label>

            <div>
              <div class="text-sm font-bold text-slate-500 mb-2">Protected Menu IDs (one per line)</div>
              <textarea name="protected_menu_ids" rows="10" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm"></textarea>
            </div>

            <div>
              <div class="text-sm font-bold text-slate-500 mb-2">Protected Paths (one per line)</div>
              <textarea name="protected_paths" rows="10" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm"></textarea>
            </div>

            <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save Policy</button>
          </form>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      const form = q("form");

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function render(){
        setMsg("muted", "Loading policy...");
        const r = await loadPolicy();
        if(r.status !== "ok"){
          setMsg("error", "Load failed.");
          return;
        }

        const v = r.data?.value || {};
        form.enabled.checked = !!v.enabled;
        form.deny_delete.checked = !!v.deny_delete;
        form.deny_path_change.checked = !!v.deny_path_change;
        form.deny_parent_change.checked = !!v.deny_parent_change;
        form.deny_group_change.checked = !!v.deny_group_change;
        form.protected_menu_ids.value = Array.isArray(v.protected_menu_ids) ? v.protected_menu_ids.join("\n") : "";
        form.protected_paths.value = Array.isArray(v.protected_paths) ? v.protected_paths.join("\n") : "";
        setMsg("success", "Loaded.");
      }

      form.onsubmit = async (ev)=>{
        ev.preventDefault();
        setMsg("muted", "Saving...");
        const payload = {
          enabled: form.enabled.checked ? 1 : 0,
          deny_delete: form.deny_delete.checked ? 1 : 0,
          deny_path_change: form.deny_path_change.checked ? 1 : 0,
          deny_parent_change: form.deny_parent_change.checked ? 1 : 0,
          deny_group_change: form.deny_group_change.checked ? 1 : 0,
          protected_menu_ids: form.protected_menu_ids.value.split("\n").map(x => x.trim()).filter(Boolean),
          protected_paths: form.protected_paths.value.split("\n").map(x => x.trim()).filter(Boolean)
        };
        const r = await savePolicy(payload);
        if(r.status !== "ok"){
          setMsg("error", "Save failed.");
          return;
        }
        setMsg("success", "Policy saved.");
      };

      await render();
    }
  };
}
