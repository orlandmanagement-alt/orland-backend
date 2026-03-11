const GROUP_ORDER = [
  "dashboard",
  "access",
  "users",
  "security",
  "content",
  "ops",
  "data",
  "settings",
  "audit"
];

const GROUP_LABELS = {
  dashboard: "Dashboard",
  access: "Access Control",
  users: "Users",
  security: "Security",
  content: "Content",
  ops: "Operations",
  data: "Data",
  settings: "Settings",
  audit: "Audit"
};

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return GROUP_ORDER.includes(x) ? x : "settings";
}

function groupLabel(v){
  return GROUP_LABELS[normalizeGroupKey(v)] || "Settings";
}

export default function(Orland){
  async function apiLoad(){
    return await Orland.api("/api/registry");
  }

  return {
    title:"Registry",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold ui-title-gradient">Registry</div>
                <div class="text-slate-500 mt-1">Search module/menu registry by category and keyword.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3">
              <input id="qSearch" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari label / path / id / code / group">
              <select id="qGroup" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                <option value="">All categories</option>
              </select>
            </div>

            <div id="chips" class="mt-4 flex flex-wrap gap-2"></div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-xl font-extrabold">Registry Items</div>
                <div class="text-xs text-slate-500 mt-1">Grouped by category using group_key.</div>
              </div>
              <div id="metaInfo" class="text-xs text-slate-500"></div>
            </div>

            <div id="listBox" class="mt-5 space-y-4"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let ITEMS = [];
      let GROUPS = [];

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderGroupFilter(){
        q("qGroup").innerHTML = `<option value="">All categories</option>` + GROUP_ORDER.map(key => `
          <option value="${esc(key)}">${esc(groupLabel(key))}</option>
        `).join("");
      }

      function renderChips(){
        const counts = new Map();
        for(const key of GROUP_ORDER) counts.set(key, 0);
        for(const item of ITEMS){
          const key = normalizeGroupKey(item.group_key);
          counts.set(key, Number(counts.get(key) || 0) + 1);
        }

        q("chips").innerHTML = `
          <button class="chipBtn px-3 py-2 rounded-xl border text-xs font-black ${!q("qGroup").value ? "border-primary text-primary" : "border-slate-200 dark:border-darkBorder"}" data-group="">
            All (${ITEMS.length})
          </button>
          ${GROUP_ORDER.map(key => `
            <button class="chipBtn px-3 py-2 rounded-xl border text-xs font-black ${q("qGroup").value === key ? "border-primary text-primary" : "border-slate-200 dark:border-darkBorder"}" data-group="${esc(key)}">
              ${esc(groupLabel(key))} (${esc(counts.get(key) || 0)})
            </button>
          `).join("")}
        `;

        q("chips").querySelectorAll(".chipBtn").forEach(btn => {
          btn.onclick = ()=>{
            q("qGroup").value = String(btn.getAttribute("data-group") || "");
            renderChips();
            renderList();
          };
        });
      }

      function filteredItems(){
        const kw = String(q("qSearch").value || "").trim().toLowerCase();
        const gk = String(q("qGroup").value || "").trim();

        return ITEMS.filter(x => {
          const gx = normalizeGroupKey(x.group_key);
          const hay = [
            x.id, x.code, x.label, x.path, x.parent_id, gx, groupLabel(gx)
          ].join(" ").toLowerCase();

          const okKw = !kw || hay.includes(kw);
          const okGroup = !gk || gx === gk;
          return okKw && okGroup;
        });
      }

      function renderList(){
        const rows = filteredItems();
        const grouped = GROUP_ORDER.map(key => ({
          key,
          label: groupLabel(key),
          items: rows.filter(x => normalizeGroupKey(x.group_key) === key)
        })).filter(x => x.items.length);

        q("metaInfo").textContent = `${rows.length} visible / ${ITEMS.length} total`;

        if(!rows.length){
          q("listBox").innerHTML = `<div class="text-sm text-slate-500">No registry data.</div>`;
          return;
        }

        q("listBox").innerHTML = grouped.map(section => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder overflow-hidden">
            <div class="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-darkBorder">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="font-black text-sm">${esc(section.label)}</div>
                <div class="text-[11px] text-slate-500">${esc(section.items.length)} item</div>
              </div>
            </div>

            <div class="p-3 space-y-3">
              ${section.items.map(item => `
                <button class="registryRow w-full text-left rounded-2xl border border-slate-200 dark:border-darkBorder p-4 hover:bg-slate-50 dark:hover:bg-white/5" data-path="${esc(item.path || "/")}">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <i class="${esc(item.icon || "fa-solid fa-circle-dot")} text-slate-400"></i>
                        <div class="font-extrabold text-sm">${esc(item.label || item.id || "Menu")}</div>
                        <span class="px-2 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black">${esc(normalizeGroupKey(item.group_key))}</span>
                      </div>
                      <div class="mt-2 text-xs text-slate-500 space-y-1">
                        <div>path: ${esc(item.path || "-")}</div>
                        <div>id: ${esc(item.id || "-")} • code: ${esc(item.code || "-")}</div>
                        <div>parent: ${esc(item.parent_id || "root")}</div>
                      </div>
                    </div>
                    <div class="shrink-0">
                      <span class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Open</span>
                    </div>
                  </div>
                </button>
              `).join("")}
            </div>
          </div>
        `).join("");

        q("listBox").querySelectorAll(".registryRow").forEach(btn => {
          btn.onclick = ()=>{
            const path = String(btn.getAttribute("data-path") || "").trim();
            if(path) Orland.navigate(path);
          };
        });
      }

      async function load(){
        setMsg("muted", "Loading...");
        const r = await apiLoad();

        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + r.status);
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        GROUPS = Array.isArray(r.data?.groups) ? r.data.groups : [];
        renderGroupFilter();
        renderChips();
        renderList();
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = load;
      q("qSearch").oninput = ()=>{ renderChips(); renderList(); };
      q("qGroup").onchange = ()=>{ renderChips(); renderList(); };

      await load();
    }
  };
}
