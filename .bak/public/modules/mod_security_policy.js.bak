export default function(Orland){
  const esc = (s)=>String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");

  function toast(msg, type = "info"){
    const host = document.getElementById("toast-host");
    if(!host){
      alert(msg);
      return;
    }
    const d = document.createElement("div");
    d.className = "fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    d.innerHTML = `<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(d);
    setTimeout(()=>d.remove(), 2800);
  }

  async function load(){
    return await Orland.api("/api/security/policy");
  }

  async function save(payload){
    return await Orland.api("/api/security/policy", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  function asNum(v, d){
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  return {
    title: "Security Policy",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-5xl">
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4 lg:p-5">
            <div class="flex flex-wrap justify-between items-center gap-3">
              <div>
                <div class="text-xl font-extrabold">Security Policy</div>
                <div class="text-sm text-slate-500 mt-1">Persisted in D1 table <code>system_settings</code>.</div>
              </div>
              <div class="flex gap-2">
                <button id="btnReload" class="px-4 py-2.5 rounded-2xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnSave" class="px-4 py-2.5 rounded-2xl text-xs font-black bg-primary text-white hover:opacity-90">
                  <i class="fa-solid fa-floppy-disk mr-2"></i>Save
                </button>
              </div>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>

            <div class="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-lg font-extrabold mb-3">Rate Limit</div>
                <label class="flex items-center gap-2 text-sm font-semibold">
                  <input id="rl_enabled" type="checkbox" class="rounded">
                  <span>enabled</span>
                </label>

                <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div class="text-xs text-slate-500 mb-1">window_sec</div>
                    <input id="rl_window" type="number" class="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20">
                  </div>
                  <div>
                    <div class="text-xs text-slate-500 mb-1">max_requests</div>
                    <input id="rl_max" type="number" class="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20">
                  </div>
                </div>

                <div class="text-xs text-slate-500 mt-3">
                  Middleware sensitif akan baca policy ini dari D1.
                </div>
              </div>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-lg font-extrabold mb-3">Account Lock Policy</div>
                <label class="flex items-center gap-2 text-sm font-semibold">
                  <input id="lk_enabled" type="checkbox" class="rounded">
                  <span>enabled</span>
                </label>

                <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div class="text-xs text-slate-500 mb-1">max_fail</div>
                    <input id="lk_fail" type="number" class="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20">
                  </div>
                  <div>
                    <div class="text-xs text-slate-500 mb-1">lock_minutes</div>
                    <input id="lk_min" type="number" class="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20">
                  </div>
                </div>

                <div class="mt-4 text-sm">
                  <div class="text-xs text-slate-500 mb-1">exclude_roles (comma)</div>
                  <input id="lk_ex" class="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20" placeholder="super_admin">
                </div>
              </div>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 xl:col-span-2">
                <div class="text-lg font-extrabold mb-3">Security Headers</div>
                <label class="flex items-center gap-2 text-sm font-semibold">
                  <input id="hd_enabled" type="checkbox" class="rounded">
                  <span>enabled</span>
                </label>
                <div class="text-xs text-slate-500 mt-3">
                  Jika enabled, middleware API akan menambah header no-store, nosniff, frame guard, dan referrer policy.
                </div>
              </div>
            </div>

            <pre id="out" class="mt-4 text-[10px] bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-darkBorder rounded-xl p-3 overflow-auto hidden"></pre>
          </div>
        </div>
      `;

      const out = host.querySelector("#out");
      const msg = host.querySelector("#msg");

      function setMsg(kind, text){
        msg.className = "mt-4 text-sm";
        if(kind === "error") msg.classList.add("text-red-500");
        else if(kind === "success") msg.classList.add("text-emerald-600");
        else msg.classList.add("text-slate-500");
        msg.textContent = text;
      }

      function fill(v){
        host.querySelector("#rl_enabled").checked = !!v?.rate_limit?.enabled;
        host.querySelector("#rl_window").value = String(v?.rate_limit?.window_sec ?? 60);
        host.querySelector("#rl_max").value = String(v?.rate_limit?.max_requests ?? 120);

        host.querySelector("#lk_enabled").checked = !!v?.lock_policy?.enabled;
        host.querySelector("#lk_fail").value = String(v?.lock_policy?.max_fail ?? 6);
        host.querySelector("#lk_min").value = String(v?.lock_policy?.lock_minutes ?? 15);
        host.querySelector("#lk_ex").value = String((v?.lock_policy?.exclude_roles || ["super_admin"]).join(","));

        host.querySelector("#hd_enabled").checked = !!v?.headers?.enabled;
      }

      function read(){
        return {
          rate_limit: {
            enabled: host.querySelector("#rl_enabled").checked ? 1 : 0,
            window_sec: Math.max(1, asNum(host.querySelector("#rl_window").value, 60)),
            max_requests: Math.max(1, asNum(host.querySelector("#rl_max").value, 120))
          },
          lock_policy: {
            enabled: host.querySelector("#lk_enabled").checked ? 1 : 0,
            max_fail: Math.max(1, asNum(host.querySelector("#lk_fail").value, 6)),
            lock_minutes: Math.max(1, asNum(host.querySelector("#lk_min").value, 15)),
            exclude_roles: String(host.querySelector("#lk_ex").value || "super_admin")
              .split(",")
              .map(s => s.trim())
              .filter(Boolean)
          },
          headers: {
            enabled: host.querySelector("#hd_enabled").checked ? 1 : 0
          }
        };
      }

      async function reload(){
        setMsg("muted", "Loading...");
        out.classList.add("hidden");

        const r = await load();
        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + r.status);
          toast("Load failed: " + r.status, "error");
          return;
        }

        fill(r.data?.value || {});
        setMsg("success", "Loaded.");
      }

      host.querySelector("#btnReload").onclick = reload;

      host.querySelector("#btnSave").onclick = async ()=>{
        const payload = read();
        setMsg("muted", "Saving...");

        const r = await save(payload);
        out.classList.remove("hidden");
        out.textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Save failed: " + r.status);
          toast("Save failed: " + r.status, "error");
          return;
        }

        fill(r.data?.value || payload);
        setMsg("success", "Saved.");
        toast("Security policy saved.", "success");
      };

      await reload();
    }
  };
}
