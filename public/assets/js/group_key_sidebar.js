function safeStr(v){
  return String(v ?? "").trim();
}

export function normalizeGroupKey(v){
  const s = safeStr(v).toLowerCase();
  if(!s) return "general";

  if(["dashboard","home","core"].includes(s)) return "dashboard";
  if(["access","users","rbac","account"].includes(s)) return "access";
  if(["content","integration","integrations","blogspot","cms"].includes(s)) return "content";
  if(["security","policy"].includes(s)) return "security";
  if(["ops","oncall","incident","incidents"].includes(s)) return "ops";
  if(["data","export","import"].includes(s)) return "data";
  if(["audit","logs"].includes(s)) return "audit";
  if(["settings","config","configuration","plugins","analytics","certificates","projects"].includes(s)) return "settings";

  return s;
}

function inferGroupKey(item){
  const path = safeStr(item?.path).toLowerCase();
  const code = safeStr(item?.code).toLowerCase();
  const label = safeStr(item?.label).toLowerCase();
  const raw = normalizeGroupKey(item?.group_key);

  if(raw && raw !== "general") return raw;

  const text = [path, code, label].join(" ");

  if(text.includes("/dashboard")) return "dashboard";
  if(text.includes("/users") || text.includes("/rbac") || text.includes("user manager")) return "access";
  if(text.includes("/integrations") || text.includes("blogspot") || text.includes("cms")) return "content";
  if(text.includes("/security")) return "security";
  if(text.includes("/ops")) return "ops";
  if(text.includes("/data")) return "data";
  if(text.includes("/audit")) return "audit";
  if(text.includes("/config")) return "settings";
  if(text.includes("/certificates")) return "settings";
  if(text.includes("/projects")) return "settings";

  return "general";
}

function topParentIdMap(items){
  const rows = Array.isArray(items) ? items : [];
  const byId = new Map(rows.map(x => [safeStr(x.id), x]));

  function resolveTop(item){
    let cur = item;
    let guard = 0;
    while(cur && safeStr(cur.parent_id) && byId.has(safeStr(cur.parent_id)) && guard < 20){
      cur = byId.get(safeStr(cur.parent_id));
      guard++;
    }
    return cur || item;
  }

  const out = new Map();
  for(const item of rows){
    out.set(safeStr(item.id), resolveTop(item));
  }
  return out;
}

function buildGroupedItems(items){
  const rows = Array.isArray(items) ? items : [];
  const topMap = topParentIdMap(rows);
  const groups = new Map();

  for(const item of rows){
    const top = topMap.get(safeStr(item.id)) || item;
    const gk = inferGroupKey(top);
    if(!groups.has(gk)) groups.set(gk, []);
    groups.get(gk).push(item);
  }

  return groups;
}

function isActivePath(currentPath, itemPath){
  const a = safeStr(currentPath);
  const b = safeStr(itemPath);
  if(!a || !b) return false;
  if(a === b) return true;
  return b !== "/" && a.startsWith(b + "/");
}

export function findActiveGroup(items, currentPath){
  const grouped = buildGroupedItems(items);
  for(const [groupKey, rows] of grouped.entries()){
    if((rows || []).some(x => isActivePath(currentPath, x?.path))) return groupKey;
  }
  return "dashboard";
}

function buildTree(items){
  const rows = Array.isArray(items) ? items : [];
  const byId = new Map();
  const roots = [];

  for(const row of rows){
    byId.set(safeStr(row.id), { ...row, children: [] });
  }

  for(const row of rows){
    const node = byId.get(safeStr(row.id));
    const pid = safeStr(row.parent_id);
    if(pid && byId.has(pid)) byId.get(pid).children.push(node);
    else roots.push(node);
  }

  function deepSort(list){
    list.sort((a, b) => {
      const sa = Number(a?.sort_order ?? 9999);
      const sb = Number(b?.sort_order ?? 9999);
      if(sa !== sb) return sa - sb;
      return safeStr(a?.label).localeCompare(safeStr(b?.label));
    });
    list.forEach(x => deepSort(x.children || []));
    return list;
  }

  return deepSort(roots);
}

function iconHtml(icon){
  return `<i class="${safeStr(icon || "fa-solid fa-circle-dot")} w-5 text-center"></i>`;
}

function renderNode(node, currentPath, level = 0){
  const active = isActivePath(currentPath, node?.path);
  const hasKids = Array.isArray(node?.children) && node.children.length > 0;

  const btnClass = [
    "groupedNavItem",
    "w-full",
    "flex",
    "items-center",
    "gap-3",
    "px-4",
    "py-2.5",
    "rounded-xl",
    "transition-colors",
    "duration-150",
    "text-slate-600",
    "dark:text-slate-300",
    "hover:bg-slate-50",
    "dark:hover:bg-white/5",
    active ? "sidebar-active" : ""
  ].join(" ");

  const subWrapClass = level > 0 ? "ml-3 pl-3 border-l border-slate-200 dark:border-darkBorder space-y-1 mt-1" : "space-y-1";

  if(!hasKids){
    return `
      <button type="button" class="${btnClass}" data-path="${safeStr(node.path || "/dashboard")}">
        ${iconHtml(node.icon)}
        <span class="font-medium truncate">${safeStr(node.label || node.id || "-")}</span>
      </button>
    `;
  }

  return `
    <div class="groupedNavTree">
      <button type="button" class="${btnClass}" data-path="${safeStr(node.path || "#")}" data-toggle-group="${safeStr(node.id)}">
        ${iconHtml(node.icon || "fa-solid fa-folder")}
        <span class="font-medium truncate flex-1 text-left">${safeStr(node.label || node.id || "-")}</span>
        <i class="fa-solid fa-chevron-down text-[10px] opacity-70"></i>
      </button>
      <div class="${subWrapClass}">
        ${node.children.map(x => renderNode(x, currentPath, level + 1)).join("")}
      </div>
    </div>
  `;
}

export function renderGroupedSidebarHtml({ items, currentPath }){
  const rows = Array.isArray(items) ? items : [];
  const grouped = buildGroupedItems(rows);

  const orderedGroups = [
    "dashboard",
    "access",
    "content",
    "security",
    "ops",
    "data",
    "audit",
    "settings",
    "general"
  ];

  const groupTitles = {
    dashboard: "Dashboard",
    access: "Access",
    content: "Integrations",
    security: "Security",
    ops: "Operations",
    data: "Data",
    audit: "Audit",
    settings: "Configuration",
    general: "General"
  };

  const tree = buildTree(rows);
  const topIds = new Set(tree.map(x => safeStr(x.id)));
  const topNodes = tree.filter(x => topIds.has(safeStr(x.id)));

  const groupTopNodes = new Map();
  for(const gk of orderedGroups) groupTopNodes.set(gk, []);

  for(const node of topNodes){
    const gk = inferGroupKey(node);
    if(!groupTopNodes.has(gk)) groupTopNodes.set(gk, []);
    groupTopNodes.get(gk).push(node);
  }

  return orderedGroups
    .filter(gk => (groupTopNodes.get(gk) || []).length > 0)
    .map(gk => `
      <div class="groupedSidebarSection">
        <div class="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">${groupTitles[gk] || gk}</div>
        <div class="space-y-1">
          ${(groupTopNodes.get(gk) || []).map(node => renderNode(node, currentPath, 0)).join("")}
        </div>
      </div>
    `)
    .join("");
}

export function bindSidebarGroupToggle(root, getExpanded, setExpanded){
  if(!root) return;

  root.querySelectorAll("[data-toggle-group]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const path = safeStr(btn.getAttribute("data-path"));
      const gid = safeStr(btn.getAttribute("data-toggle-group"));
      if(path && path !== "#" && path === location.pathname){
        e.preventDefault();
      }

      const current = Array.isArray(getExpanded?.()) ? getExpanded() : [];
      const set = new Set(current);

      if(set.has(gid)) set.delete(gid);
      else set.add(gid);

      setExpanded?.(Array.from(set));
    });
  });
}
