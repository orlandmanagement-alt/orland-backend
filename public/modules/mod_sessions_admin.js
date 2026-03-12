export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
  const fmt = (v)=>!v ? "-" : new Date(Number(v) * 1000).toLocaleString("id-ID");

  async function findUsers(q){
    return await Orland.api("/api/users/options?q=" + encodeURIComponent(q || ""));
  }
  async function loadUserSessions(userId){
    return await Orland.api("/api/admin/sessions?user_id=" + encodeURIComponent(userId));
  }
  async function revokeOne(sid){
    return await Orland.api("/api/admin/sessions/revoke", {
      method:"POST",
      body: JSON.stringify({ sid })
    });
  }
  async function revokeAll(user_id){
    return await Orland.api("/api/admin/sessions/revoke-all", {
      method:"POST",
      body: JSON.stringify({ user_id })
    });
  }
  async function rotateVersion(user_id){
    return await Orland.api("/api/admin/sessions/rotate-version", {
      method:"POST",
      body: JSON.stringify({ user_id, revoke_sessions: true })
    });
  }

  return {
    title:"Admin Session Control",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">Admin Session Control</div>
            <div class="text-sm text-slate-500 mt-1">Inspect, revoke, dan rotate session version user.</div>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <input id="qUser" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari user id / email / nama">
              <button id="btnSearch" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Search</button>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Users</div>
              <div id="userList" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Sessions</div>
                <div class="flex gap-2 flex-wrap">
                  <button id="btnRevokeAll" class="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-black" disabled>Revoke All</button>
                  <button id="btnRotateVersion" class="px-3 py-2 rounded-xl border border-amber-200 text-amber-700 text-xs font-black" disabled>Rotate Version</button>
                </div>
              </div>
              <div id="sessionBox" class="mt-4 text-sm text-slate-500">Pilih user.</div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let SELECTED_USER = null;

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
            const id = String(btn.getAttribute("data-id") || "");
            await openUser(id);
          };
        });
      }

      async function openUser(userId){
        setMsg("muted", "Loading sessions...");
        const r = await loadUserSessions(userId);
        if(r.status !== "ok"){
          q("sessionBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          q("btnRevokeAll").disabled = true;
          q("btnRotateVersion").disabled = true;
          setMsg("error", "Load failed.");
          return;
        }

        SELECTED_USER = r.data?.user || null;
        q("btnRevokeAll").disabled = !SELECTED_USER;
        q("btnRotateVersion").disabled = !SELECTED_USER;

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        q("sessionBox").innerHTML = `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 mb-4">
            <div class="font-black text-sm">${esc(SELECTED_USER.display_name || SELECTED_USER.email_norm || SELECTED_USER.id)}</div>
            <div class="mt-1 text-xs text-slate-500">${esc(SELECTED_USER.email_norm || "-")}</div>
            <div class="mt-1 text-[11px] text-slate-400">session version: ${esc(SELECTED_USER.session_version || 1)}</div>
          </div>
          <div class="space-y-3">
            ${items.length ? items.map(x => `
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <div class="font-black text-sm">Session</div>
                      ${x.revoked_at ? `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">revoked</span>` : `<span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">active</span>`}
                    </div>
                    <div class="mt-2 text-xs text-slate-500 space-y-1">
                      <div>sid: ${esc(x.id)}</div>
                      <div>created: ${esc(fmt(x.created_at))}</div>
                      <div>expires: ${esc(fmt(x.expires_at))}</div>
                      <div>last seen: ${esc(fmt(x.last_seen_at))}</div>
                      <div>session version: ${esc(x.session_version)}</div>
                    </div>
                  </div>
                  <div class="shrink-0">
                    ${!x.revoked_at ? `<button class="btnRevokeOne px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-black" data-sid="${esc(x.id)}">Revoke</button>` : ``}
                  </div>
                </div>
              </div>
            `).join("") : `<div class="text-sm text-slate-500">No sessions.</div>`}
          </div>
        `;

        q("sessionBox").querySelectorAll(".btnRevokeOne").forEach(btn => {
          btn.onclick = async ()=>{
            const sid = String(btn.getAttribute("data-sid") || "");
            setMsg("muted", "Revoking session...");
            const rr = await revokeOne(sid);
            if(rr.status !== "ok"){
              setMsg("error", "Revoke failed: " + (rr.data?.message || rr.status));
              return;
            }
            setMsg("success", "Session revoked.");
            await openUser(SELECTED_USER.id);
          };
        });

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

      q("btnRevokeAll").onclick = async ()=>{
        if(!SELECTED_USER) return;
        setMsg("muted", "Revoking all sessions...");
        const r = await revokeAll(SELECTED_USER.id);
        if(r.status !== "ok"){
          setMsg("error", "Revoke all failed: " + (r.data?.message || r.status));
          return;
        }
        setMsg("success", "All sessions revoked.");
        await openUser(SELECTED_USER.id);
      };

      q("btnRotateVersion").onclick = async ()=>{
        if(!SELECTED_USER) return;
        setMsg("muted", "Rotating session version...");
        const r = await rotateVersion(SELECTED_USER.id);
        if(r.status !== "ok"){
          setMsg("error", "Rotate failed: " + (r.data?.message || r.status));
          return;
        }
        setMsg("success", "Session version rotated.");
        await openUser(SELECTED_USER.id);
      };

      await searchUsers();
    }
  };
}
