export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-bold">Admin Users</div>
          <div class="text-xs text-slate-500 mt-1">CRUD admin/staff • endpoint: <code>/api/users/admin</code></div>
        </div>
        <div class="flex gap-2">
          <button id="uaReload" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
            Reload
          </button>
          <button id="uaOpenCreate" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">
            + Create
          </button>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2 items-center">
        <input id="uaQ" class="text-xs w-64 bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2"
          placeholder="Search email/name (q)" />
        <select id="uaLimit" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="25">25</option>
          <option value="50" selected>50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>
        <button id="uaSearch" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
          Search
        </button>

        <div class="ml-auto text-[11px] text-slate-500" id="uaMeta">—</div>
      </div>

      <div id="uaTable" class="mt-4 overflow-x-auto"></div>
    </div>

    <!-- Create Modal -->
    <div id="uaModal" class="fixed inset-0 z-[9999] hidden">
      <div id="uaModalBg" class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-xl bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl shadow-2xl">
          <div class="p-4 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between">
            <div class="text-sm font-bold">Create Admin/Staff</div>
            <button id="uaModalClose" class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div class="text-[11px] text-slate-500 font-bold mb-1">Email</div>
              <input id="cEmail" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="admin@domain.com" />
            </div>
            <div>
              <div class="text-[11px] text-slate-500 font-bold mb-1">Display Name</div>
              <input id="cName" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="Orland Admin" />
            </div>
            <div>
              <div class="text-[11px] text-slate-500 font-bold mb-1">Role</div>
              <select id="cRole" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <div class="text-[11px] text-slate-500 font-bold mb-1">Password (min 10)</div>
              <input id="cPw" type="password" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="**********" />
            </div>
          </div>

          <div class="p-4 border-t border-slate-200 dark:border-darkBorder flex gap-2 justify-end">
            <button id="uaModalCancel" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              Cancel
            </button>
            <button id="uaCreate" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">
              Create
            </button>
          </div>

          <pre id="uaCreateOut" class="px-4 pb-4 text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
        </div>
      </div>
    </div>
  `;

  const esc = (s) => String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const $ = (id) => document.getElementById(id);

  function openModal(){
    $("uaModal").classList.remove("hidden");
  }
  function closeModal(){
    $("uaModal").classList.add("hidden");
  }

  $("uaOpenCreate").onclick = openModal;
  $("uaModalClose").onclick = closeModal;
  $("uaModalCancel").onclick = closeModal;
  $("uaModalBg").onclick = closeModal;

  $("uaReload").onclick = () => load();
  $("uaSearch").onclick = () => load();
  $("uaQ").addEventListener("keydown",(e)=>{ if(e.key==="Enter") load(); });

  async function load(){
    const q = ($("uaQ").value||"").trim();
    const limit = $("uaLimit").value || "50";
    const url = "/api/users/admin?limit="+encodeURIComponent(limit) + (q?("&q="+encodeURIComponent(q)):"");

    $("uaTable").innerHTML = `<div class="text-xs text-slate-500">Loading…</div>`;
    const r = await api(url);

    if(r.status !== "ok"){
      $("uaTable").innerHTML = `<div class="text-xs text-red-400">Failed: ${esc(r.status)}</div>`;
      $("uaMeta").textContent = "—";
      return;
    }

    const rows = r.data.users || [];
    $("uaMeta").textContent = `${rows.length} users`;

    $("uaTable").innerHTML = `
      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
          <tr>
            <th class="px-4 py-3 font-semibold">User</th>
            <th class="px-4 py-3 font-semibold">Role</th>
            <th class="px-4 py-3 font-semibold">Status</th>
            <th class="px-4 py-3 font-semibold">Last Login</th>
            <th class="px-4 py-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
          ${rows.map(u=>rowHtml(u)).join("")}
        </tbody>
      </table>
    `;

    // bind actions
    document.querySelectorAll("[data-action]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const action = btn.getAttribute("data-action");
        const user_id = btn.getAttribute("data-id");
        if(!action || !user_id) return;

        if(action === "reset_password"){
          const pw = prompt("New password (min 10):");
          if(!pw || pw.length < 10) return toast("Min 10 chars", "error");
          const rr = await api("/api/users/admin", { method:"PUT", body: JSON.stringify({ action, user_id, new_password: pw }) });
          toast(rr.status, rr.status==="ok"?"success":"error");
          return;
        }

        if(action === "disable" && !confirm("Disable this user?")) return;
        if(action === "enable" && !confirm("Enable this user?")) return;
        if(action === "revoke_sessions" && !confirm("Revoke ALL sessions for this user?")) return;

        const rr = await api("/api/users/admin", { method:"PUT", body: JSON.stringify({ action, user_id }) });
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") load();
      });
    });
  }

  function badge(text, kind){
    const cls = {
      ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      bad: "bg-red-500/10 text-red-400 border-red-500/20",
      gray:"bg-slate-500/10 text-slate-400 border-slate-500/20",
    }[kind] || "bg-slate-500/10 text-slate-400 border-slate-500/20";

    return `<span class="inline-flex items-center px-2 py-0.5 rounded-lg border ${cls} text-[11px] font-bold">${esc(text)}</span>`;
  }

  function rowHtml(u){
    const roles = Array.isArray(u.roles) ? u.roles : [];
    const status = String(u.status||"");
    const stBadge = status === "active" ? badge("active","ok") : badge(status,"bad");
    const roleTxt = roles.length ? roles.join(", ") : "-";
    const last = u.last_login_at ? String(u.last_login_at) : "-";

    const canToggle = status === "active" ? "disable" : "enable";
    const toggleLabel = status === "active" ? "Disable" : "Enable";

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
        <td class="px-4 py-3">
          <div class="font-bold text-slate-900 dark:text-white">${esc(u.display_name||"")}</div>
          <div class="text-[11px] text-slate-500">${esc(u.email_norm||"")}</div>
          <div class="text-[11px] text-slate-500">id: <code>${esc(u.id||"")}</code></div>
        </td>
        <td class="px-4 py-3">
          ${badge(roleTxt, roles.includes("super_admin")?"warn":(roles.includes("admin")?"ok":"gray"))}
        </td>
        <td class="px-4 py-3">${stBadge}</td>
        <td class="px-4 py-3 text-slate-500">${esc(last)}</td>
        <td class="px-4 py-3 text-right">
          <div class="inline-flex gap-2 flex-wrap justify-end">
            <button data-action="${canToggle}" data-id="${esc(u.id)}"
              class="text-xs px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              ${toggleLabel}
            </button>
            <button data-action="reset_password" data-id="${esc(u.id)}"
              class="text-xs px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              Reset PW
            </button>
            <button data-action="revoke_sessions" data-id="${esc(u.id)}"
              class="text-xs px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              Revoke
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  $("uaCreate").onclick = async ()=>{
    const email = ($("cEmail").value||"").trim().toLowerCase();
    const display_name = ($("cName").value||"").trim();
    const role = $("cRole").value || "staff";
    const password = $("cPw").value || "";

    if(!email.includes("@")) return toast("Email invalid", "error");
    if(password.length < 10) return toast("Password min 10", "error");

    const r = await api("/api/users/admin", { method:"POST", body: JSON.stringify({ email, display_name, role, password }) });
    $("uaCreateOut").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");

    if(r.status==="ok"){
      $("cEmail").value=""; $("cName").value=""; $("cPw").value=""; $("cRole").value="staff";
      closeModal();
      load();
    }
  };

  await load();
}
