export const GROUP_ORDER = [
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

export const GROUP_LABELS = {
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

export function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return GROUP_ORDER.includes(x) ? x : "settings";
}

export function groupLabel(v){
  return GROUP_LABELS[normalizeGroupKey(v)] || "Settings";
}

export function groupItems(items){
  const rows = Array.isArray(items) ? items : [];
  const bucket = new Map();

  for(const key of GROUP_ORDER){
    bucket.set(key, []);
  }

  for(const row of rows){
    const key = normalizeGroupKey(row?.group_key);
    if(!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push({
      ...row,
      group_key: key,
      sort_order: Number(row?.sort_order ?? 9999),
      label: String(row?.label || ""),
      path: String(row?.path || "/"),
      id: String(row?.id || ""),
      code: String(row?.code || ""),
      icon: String(row?.icon || "")
    });
  }

  for(const arr of bucket.values()){
    arr.sort((a, b)=>{
      const sa = Number(a.sort_order ?? 9999);
      const sb = Number(b.sort_order ?? 9999);
      if(sa !== sb) return sa - sb;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });
  }

  return GROUP_ORDER.map(key => ({
    group_key: key,
    group_label: groupLabel(key),
    items: bucket.get(key) || []
  })).filter(section => section.items.length > 0);
}

export function findActiveGroup(items, currentPath){
  const path = String(currentPath || "").trim() || "/";
  const rows = Array.isArray(items) ? items : [];
  const found = rows.find(x => String(x?.path || "") === path);
  return found ? normalizeGroupKey(found.group_key) : "";
}

export function isParent(item, allItems){
  const id = String(item?.id || "");
  if(!id) return false;
  return (Array.isArray(allItems) ? allItems : []).some(x => String(x?.parent_id || "") === id);
}

export function buildTree(items){
  const rows = Array.isArray(items) ? items : [];
  const byId = new Map();
  const roots = [];

  for(const row of rows){
    byId.set(String(row.id), {
      ...row,
      id: String(row.id),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      children: []
    });
  }

  for(const row of byId.values()){
    if(row.parent_id && byId.has(row.parent_id)){
      byId.get(row.parent_id).children.push(row);
    }else{
      roots.push(row);
    }
  }

  const sortFn = (a, b)=>{
    const sa = Number(a.sort_order ?? 9999);
    const sb = Number(b.sort_order ?? 9999);
    if(sa !== sb) return sa - sb;
    return String(a.label || "").localeCompare(String(b.label || ""));
  };

  const walk = (nodes)=>{
    nodes.sort(sortFn);
    for(const node of nodes){
      walk(node.children || []);
    }
  };
  walk(roots);

  return roots;
}

export function renderGroupedSidebarHtml({
  items = [],
  currentPath = "/",
  expandedGroups = [],
  onPathPrefix = ""
} = {}){
  const allItems = Array.isArray(items) ? items : [];
  const activePath = String(currentPath || "/");
  const sections = groupItems(allItems);
  const expanded = new Set(
    (Array.isArray(expandedGroups) ? expandedGroups : []).map(normalizeGroupKey)
  );

  const renderNode = (node, depth = 0)=>{
    const isActive = String(node.path || "") === activePath;
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const pad = 14 + (depth * 14);

    return `
      <div class="sidebar-node">
        <a
          href="${onPathPrefix}${node.path || "/"}"
          data-path="${node.path || "/"}"
          class="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition border ${
            isActive
              ? "bg-primary text-white border-primary"
              : "border-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200"
          }"
          style="padding-left:${pad}px"
        >
          <i class="${node.icon || "fa-solid fa-circle-dot"} text-[13px] shrink-0"></i>
          <span class="truncate">${node.label || node.id || "Menu"}</span>
        </a>
        ${hasChildren ? `
          <div class="mt-1 space-y-1">
            ${node.children.map(child => renderNode(child, depth + 1)).join("")}
          </div>
        ` : ``}
      </div>
    `;
  };

  return sections.map(section => {
    const isOpen = expanded.has(section.group_key);
    const tree = buildTree(section.items);

    return `
      <section class="sidebar-group rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter overflow-hidden" data-group-key="${section.group_key}">
        <button
          type="button"
          class="sidebar-group-toggle w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
          data-group-key="${section.group_key}"
        >
          <div class="min-w-0">
            <div class="text-xs font-black uppercase tracking-wide text-slate-500">${section.group_label}</div>
            <div class="text-[11px] text-slate-400 mt-1">${section.items.length} menu</div>
          </div>
          <i class="fa-solid ${isOpen ? "fa-chevron-up" : "fa-chevron-down"} text-slate-400 text-xs"></i>
        </button>
        <div class="${isOpen ? "" : "hidden "}sidebar-group-body px-3 pb-3 space-y-1">
          ${tree.map(node => renderNode(node, 0)).join("")}
        </div>
      </section>
    `;
  }).join("");
}

export function bindSidebarGroupToggle(root, getExpanded, setExpanded){
  if(!root) return;

  root.querySelectorAll(".sidebar-group-toggle").forEach(btn => {
    btn.onclick = ()=>{
      const key = normalizeGroupKey(btn.getAttribute("data-group-key"));
      const now = new Set((getExpanded?.() || []).map(normalizeGroupKey));
      if(now.has(key)) now.delete(key);
      else now.add(key);
      setExpanded?.(Array.from(now));
    };
  });
}
