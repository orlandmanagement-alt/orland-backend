export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function inspect(item_kind, item_id){
    const q = new URLSearchParams();
    q.set("item_kind", item_kind);
    q.set("item_id", item_id);
    return await Orland.api("/api/blogspot/diff_inspect?" + q.toString());
  }

  async function resolve(payload){
    return await Orland.api("/api/blogspot/conflict_resolve", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function badge(kind, text){
    const map = {
      amber: "bg-amber-100 text-amber-700",
      cyan: "bg-cyan-100 text-cyan-700",
      rose: "bg-rose-100 text-rose-700",
      sky: "bg-sky-100 text-sky-700",
      violet: "bg-violet-100 text-violet-700",
      emerald: "bg-emerald-100 text-emerald-700",
      slate: "bg-slate-100 text-slate-700"
    };
    return `<span class="px-2 py-1 rounded-full text-[11px] font-black ${map[kind] || map.slate}">${esc(text)}</span>`;
  }

  function renderSideCard(title, item, remote = false){
    if(!item){
      return `
        <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
          <div class="text-sm font-extrabold">${esc(title)}</div>
          <div class="mt-3 text-sm text-slate-500">No data.</div>
        </div>
      `;
    }

    return `
      <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
        <div class="text-sm font-extrabold">${esc(title)}</div>
        <div class="mt-3 flex gap-2 flex-wrap">
          ${badge(item.item_kind === "post" ? "amber" : "cyan", item.item_kind || "-")}
          ${badge(item.status === "published" ? "emerald" : "slate", item.status || "-")}
          ${remote ? badge("sky", "remote") : badge("violet", "local")}
        </div>
        <div class="mt-4 space-y-2 text-sm text-slate-600">
          <div><span class="font-bold">ID:</span> ${esc(item.id || "-")}</div>
          <div><span class="font-bold">External:</span> ${esc(item.external_id || "-")}</div>
          <div><span class="font-bold">Title:</span> ${esc(item.title || "-")}</div>
          <div><span class="font-bold">URL:</span> ${esc(item.url || "-")}</div>
          <div><span class="font-bold">Updated:</span> ${esc(fmtTs(item.updated_at))}</div>
        </div>
      </div>
    `;
  }

  function renderDiff(diff){
    if(!diff){
      return `<div class="text-sm text-slate-500">No diff data.</div>`;
    }

    return `
      <div class="space-y-3">
        <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
          <div class="flex gap-2 flex-wrap">
            ${badge(diff.different_count > 0 ? "rose" : "emerald", `different=${diff.different_count}`)}
            ${badge("sky", diff.resolution_hint || "-")}
          </div>
        </div>

        ${(Array.isArray(diff.fields) ? diff.fields : []).map(f => `
          <div class="rounded-2xl border ${f.equal ? "border-emerald-200" : "border-rose-200"} p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="text-sm font-extrabold">${esc(f.field)}</div>
              ${f.equal ? badge("emerald", "equal") : badge("rose", "different")}
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-4">
              <pre class="text-[11px] whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 rounded-2xl p-3 overflow-auto">${esc(JSON.stringify(f.local, null, 2))}</pre>
              <pre class="text-[11px] whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 rounded-2xl p-3 overflow-auto">${esc(JSON.stringify(f.remote, null, 2))}</pre>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  return {
    title: "Blogspot Conflict Resolver",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Local vs Remote Diff</div>
                <div class="text-sm text-slate-500 mt-1">Inspect drift/conflict between local CMS item and Blogger remote item.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnPosts" class="px-4 py-3 rounded-2xl border border-amber-200 text-amber-700 font-black text-sm">
                  <i class="fa-solid fa-pen mr-2"></i>Posts
                </button>
                <button id="btnPages" class="px-4 py-3 rounded-2xl border border-cyan-200 text-cyan-700 font-black text-sm">
                  <i class="fa-solid fa-file-lines mr-2"></i>Pages
                </button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Item Kind</label>
                <select id="fKind" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="post">post</option>
                  <option value="page">page</option>
                </select>
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm font-bold text-slate-500 mb-2">Item ID</label>
                <input id="fItemId" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="post_xxx / page_xxx">
              </div>
              <div class="flex items-end">
                <button id="btnInspect" class="w-full px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Inspect Diff</button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div id="localBox"></div>
            <div id="remoteBox"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Diff Result</div>
            <div id="diffBox" class="mt-4"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-xl font-extrabold">Conflict Resolver</div>
                <div class="text-sm text-slate-500 mt-1">Choose how to resolve this conflict.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnKeepLocal" class="px-4 py-2.5 rounded-2xl border border-amber-200 text-amber-700 font-black text-sm">Keep Local</button>
                <button id="btnPullRemote" class="px-4 py-2.5 rounded-2xl border border-sky-200 text-sky-700 font-black text-sm">Pull Remote</button>
                <button id="btnMarkResolved" class="px-4 py-2.5 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">Mark Resolved</button>
              </div>
            </div>
            <pre id="actionBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let CURRENT = null;

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function doInspect(){
        const item_kind = String(q("fKind").value || "").trim();
        const item_id = String(q("fItemId").value || "").trim();

        if(!item_kind || !item_id){
          setMsg("error", "Item kind dan item id wajib diisi.");
          return;
        }

        setMsg("muted", "Inspecting diff...");
        const r = await inspect(item_kind, item_id);
        CURRENT = r;
        q("actionBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          q("localBox").innerHTML = renderSideCard("Local", null, false);
          q("remoteBox").innerHTML = renderSideCard("Remote", null, true);
          q("diffBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          setMsg("error", "Inspect failed: " + (r.data?.error || r.status));
          return;
        }

        q("localBox").innerHTML = renderSideCard("Local Item", r.data?.local, false);
        q("remoteBox").innerHTML = renderSideCard("Remote Item", r.data?.remote, true);
        q("diffBox").innerHTML = renderDiff(r.data?.diff);

        if(r.data?.remote_deleted){
          setMsg("error", "Remote item missing.");
        }else{
          setMsg("success", "Diff inspection loaded.");
        }
      }

      async function doResolve(resolver){
        if(!CURRENT || CURRENT.status !== "ok"){
          setMsg("error", "Inspect diff first.");
          return;
        }

        const item_kind = CURRENT.data?.local?.item_kind || "";
        const item_id = CURRENT.data?.local?.id || "";
        if(!item_kind || !item_id){
          setMsg("error", "Current item invalid.");
          return;
        }

        const note = window.prompt(`Resolver ${resolver} note:`) || "";
        setMsg("muted", "Resolving conflict...");
        const r = await resolve({ item_kind, item_id, resolver, note });
        q("actionBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Resolve failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Conflict resolved.");
        await doInspect();
      }

      q("btnReload").onclick = doInspect;
      q("btnInspect").onclick = doInspect;
      q("btnKeepLocal").onclick = ()=>doResolve("keep_local");
      q("btnPullRemote").onclick = ()=>doResolve("pull_remote");
      q("btnMarkResolved").onclick = ()=>doResolve("mark_resolved");
      q("btnPosts").onclick = ()=>Orland.navigate("/integrations/blogspot/posts");
      q("btnPages").onclick = ()=>Orland.navigate("/integrations/blogspot/pages");

      q("localBox").innerHTML = renderSideCard("Local Item", null, false);
      q("remoteBox").innerHTML = renderSideCard("Remote Item", null, true);
      q("diffBox").innerHTML = `<div class="text-sm text-slate-500">No diff loaded.</div>`;
    }
  };
}
