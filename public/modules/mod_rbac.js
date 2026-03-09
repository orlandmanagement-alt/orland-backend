export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  async function bundle(){ return await Orland.api("/api/rbac/bundle"); }
  async function save(role_id, menu_ids){
    return await Orland.api("/api/role-menus/set", { method:"POST", body: JSON.stringify({ role_id, menu_ids }) });
  }

  return {
    title: "RBAC Manager",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
          <div class="text-lg font-black">RBAC Manager</div>
          <div class="text-xs text-slate-500 mt-1">Assign menus ke role (role_menus).</div>

          <div class="mt-4 flex gap-2">
            <button id="btnSave" class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black">Save</button>
            <button id="btnReload" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Reload</button>
          </div>

          <div class="mt-4">
            <div class="text-[11px] font-black text-slate-500 mb-2">ROLE</div>
            <select id="roleSel" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs"></select>
          </div>

          <div class="mt-4">
            <div class="text-[11px] font-black text-slate-500 mb-2">MENUS</div>
            <div id="menuList" class="space-y-2"></div>
          </div>

          <div class="mt-4 text-xs text-red-500" id="msg"></div>
        </div>
      `;

      const roleSel = host.querySelector("#roleSel");
      const menuList = host.querySelector("#menuList");
      const msg = host.querySelector("#msg");

      let data = null;
      let picked = new Set();

      async function load(){
        msg.textContent = "";
        menuList.innerHTML = "Loading…";
        const r = await bundle();
        if(r.status!=="ok"){
          msg.textContent = "Failed: " + r.status;
          menuList.innerHTML = `<pre class="text-[11px] whitespace-pre-wrap">${esc(JSON.stringify(r.data||{},null,2))}</pre>`;
          return;
        }
        data = r.data;
        const roles = data.roles||[];
        const menus = data.menus||[];
        const rm = data.role_menus||[];

        roleSel.innerHTML = roles.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
        const currentRole = roleSel.value;

        function selectedMenuIdsFor(role_id){
          return new Set(rm.filter(x=>String(x.role_id)===String(role_id)).map(x=>String(x.menu_id)));
        }

        function renderMenus(role_id){
          picked = selectedMenuIdsFor(role_id);
          menuList.innerHTML = menus.map(m=>{
            const on = picked.has(String(m.id));
            return `
              <label class="flex items-center gap-3 p-2 rounded-xl border border-slate-200 dark:border-darkBorder">
                <input type="checkbox" data-mid="${esc(m.id)}" ${on?"checked":""} />
                <div class="min-w-0">
                  <div class="text-xs font-black truncate">${esc(m.label||m.code||m.id)}</div>
                  <div class="text-[11px] text-slate-500 truncate">${esc(m.path||"/")}</div>
                </div>
              </label>
            `;
          }).join("");

          menuList.querySelectorAll("input[type=checkbox]").forEach(ch=>{
            ch.onchange = ()=>{
              const mid = ch.getAttribute("data-mid");
              if(ch.checked) picked.add(mid);
              else picked.delete(mid);
            };
          });
        }

        roleSel.onchange = ()=> renderMenus(roleSel.value);
        renderMenus(currentRole);
      }

      host.querySelector("#btnReload").onclick = load;

      host.querySelector("#btnSave").onclick = async ()=>{
        msg.textContent = "";
        const role_id = roleSel.value;
        const menu_ids = Array.from(picked);
        const r = await save(role_id, menu_ids);
        if(r.status!=="ok"){
          msg.textContent = "Failed: " + r.status;
          return;
        }
        msg.style.color = "#10b981";
        msg.textContent = "Saved.";
        setTimeout(()=>{ msg.textContent=""; msg.style.color=""; }, 1200);
        await load();
      };

      await load();
    }
  };
}
