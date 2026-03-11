import { esc } from "../../assets/js/orland_ui.js";

export default function(Orland){
  function toast(msg,type="info"){
    const host=document.getElementById("toast-host");
    if(!host){alert(msg);return;}
    const d=document.createElement("div");
    d.className="fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    d.innerHTML=`<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(d); setTimeout(()=>d.remove(),2800);
  }

  async function load(){ return await Orland.api("/api/security/policy"); }
  async function save(payload){
    return await Orland.api("/api/security/policy",{ method:"POST", body: JSON.stringify(payload) });
  }

  return {
    title:"Security Policy",
    async mount(host){
      host.innerHTML=`
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5 max-w-6xl">
        <div class="flex flex-wrap justify-between items-center gap-3">
          <div>
            <div class="text-base font-bold">Security Policy</div>
            <div class="text-xs text-slate-500 mt-1">Persisted in D1 table <code>system_settings</code>.</div>
          </div>
          <div class="flex gap-2">
            <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <i class="fa-solid fa-rotate mr-2"></i>Reload
            </button>
            <button id="btnSave" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
              <i class="fa-solid fa-floppy-disk mr-2"></i>Save
            </button>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="text-sm font-bold mb-2">Rate Limit</div>
            <label class="flex items-center gap-2 text-xs"><input id="rl_enabled" type="checkbox" class="rounded"> enabled</label>
            <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><div class="text-[10px] text-slate-500 mb-1">window_sec</div><input id="rl_window" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20"></div>
              <div><div class="text-[10px] text-slate-500 mb-1">max_requests</div><input id="rl_max" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20"></div>
            </div>
            <div class="text-[10px] text-slate-500 mt-2">Nilai ini jadi source of truth policy keamanan API.</div>
          </div>

          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="text-sm font-bold mb-2">Account Lock Policy</div>
            <label class="flex items-center gap-2 text-xs"><input id="lk_enabled" type="checkbox" class="rounded"> enabled</label>
            <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><div class="text-[10px] text-slate-500 mb-1">max_fail</div><input id="lk_fail" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20"></div>
              <div><div class="text-[10px] text-slate-500 mb-1">lock_minutes</div><input id="lk_min" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20"></div>
            </div>
            <div class="mt-3 text-xs">
              <div class="text-[10px] text-slate-500 mb-1">exclude_roles (comma)</div>
              <input id="lk_ex" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20" placeholder="super_admin">
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-4 lg:col-span-2">
            <div class="text-sm font-bold mb-2">Security Headers</div>
            <label class="flex items-center gap-2 text-xs"><input id="hd_enabled" type="checkbox" class="rounded"> enabled</label>
            <div class="text-[10px] text-slate-500 mt-2">Mode policy enterprise untuk standardisasi response security headers.</div>
          </div>
        </div>

        <pre id="out" class="mt-4 text-[10px] bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-darkBorder rounded-xl p-3 overflow-auto hidden"></pre>
      </div>`;

      const out=host.querySelector("#out");
      function fill(v){
        host.querySelector("#rl_enabled").checked = !!v?.rate_limit?.enabled;
        host.querySelector("#rl_window").value = String(v?.rate_limit?.window_sec ?? 60);
        host.querySelector("#rl_max").value = String(v?.rate_limit?.max_requests ?? 120);

        host.querySelector("#lk_enabled").checked = !!v?.lock_policy?.enabled;
        host.querySelector("#lk_fail").value = String(v?.lock_policy?.max_fail ?? 6);
        host.querySelector("#lk_min").value = String(v?.lock_policy?.lock_minutes ?? 15);
        host.querySelector("#lk_ex").value = String((v?.lock_policy?.exclude_roles||["super_admin"]).join(","));

        host.querySelector("#hd_enabled").checked = !!v?.headers?.enabled;
      }
      function read(){
        return {
          rate_limit:{
            enabled: host.querySelector("#rl_enabled").checked?1:0,
            window_sec: Number(host.querySelector("#rl_window").value||60),
            max_requests: Number(host.querySelector("#rl_max").value||120),
          },
          lock_policy:{
            enabled: host.querySelector("#lk_enabled").checked?1:0,
            max_fail: Number(host.querySelector("#lk_fail").value||6),
            lock_minutes: Number(host.querySelector("#lk_min").value||15),
            exclude_roles: String(host.querySelector("#lk_ex").value||"super_admin").split(",").map(s=>s.trim()).filter(Boolean)
          },
          headers:{ enabled: host.querySelector("#hd_enabled").checked?1:0 }
        };
      }

      async function reload(){
        out.classList.add("hidden");
        const r=await load();
        if(r.status!=="ok"){ toast(r.status,"error"); return; }
        fill(r.data?.value||{});
      }

      host.querySelector("#btnReload").onclick=reload;
      host.querySelector("#btnSave").onclick=async ()=>{
        const payload = read();
        const r=await save(payload);
        out.classList.remove("hidden");
        out.textContent=JSON.stringify(r,null,2);
        toast(r.status, r.status==="ok"?"success":"error");
      };

      await reload();
    }
  };
}
