import { normalizeGroupKey, groupLabel } from "./group_key_sidebar.js";

const FAV_KEY = "orland_sidebar_favorites_v1";
const RECENT_KEY = "orland_sidebar_recent_v1";
const MAX_RECENT = 12;

function readJson(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  }catch{
    return fallback;
  }
}

function writeJson(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch{}
}

function safeItem(item = {}){
  return {
    id: String(item.id || ""),
    code: String(item.code || ""),
    label: String(item.label || item.id || "-"),
    path: String(item.path || "/"),
    parent_id: item.parent_id ? String(item.parent_id) : null,
    sort_order: Number(item.sort_order ?? 9999),
    icon: String(item.icon || "fa-solid fa-circle-dot"),
    group_key: normalizeGroupKey(item.group_key)
  };
}

export function getFavorites(){
  return readJson(FAV_KEY, []).map(safeItem).filter(x => x.path);
}

export function setFavorites(items){
  writeJson(FAV_KEY, (Array.isArray(items) ? items : []).map(safeItem));
}

export function isFavorite(path){
  const p = String(path || "").trim();
  return getFavorites().some(x => x.path === p);
}

export function toggleFavorite(item){
  const row = safeItem(item);
  const items = getFavorites();
  const idx = items.findIndex(x => x.path === row.path);
  if(idx >= 0){
    items.splice(idx, 1);
  }else{
    items.unshift(row);
  }
  setFavorites(items);
  return items;
}

export function addRecent(item){
  const row = safeItem(item);
  if(!row.path) return [];
  let items = readJson(RECENT_KEY, []).map(safeItem).filter(x => x.path);
  items = items.filter(x => x.path !== row.path);
  items.unshift(row);
  items = items.slice(0, MAX_RECENT);
  writeJson(RECENT_KEY, items);
  return items;
}

export function getRecent(){
  return readJson(RECENT_KEY, []).map(safeItem).filter(x => x.path);
}

export function clearRecent(){
  writeJson(RECENT_KEY, []);
}

export function groupSavedItems(items){
  const rows = Array.isArray(items) ? items : [];
  const bucket = new Map();

  for(const row of rows){
    const key = normalizeGroupKey(row.group_key);
    if(!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push(safeItem(row));
  }

  return Array.from(bucket.entries()).map(([group_key, list]) => ({
    group_key,
    group_label: groupLabel(group_key),
    items: list
  })).sort((a, b) => String(a.group_label).localeCompare(String(b.group_label)));
}

export function renderSavedGroupedSection({
  title = "Favorites",
  sections = [],
  emptyText = "No data.",
  itemClass = "favRecentItem",
  actionLabel = "",
  showClear = false,
  clearId = ""
} = {}){
  const grouped = Array.isArray(sections) ? sections : [];
  return `
    <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between gap-3">
        <div>
          <div class="text-xs font-black uppercase tracking-wide text-slate-500">${title}</div>
          <div class="text-[11px] text-slate-400 mt-1">${grouped.reduce((n, s) => n + (s.items?.length || 0), 0)} item</div>
        </div>
        ${showClear ? `<button id="${clearId}" type="button" class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-[11px] font-black">Clear</button>` : ``}
      </div>
      <div class="p-3 space-y-3">
        ${
          grouped.length
            ? grouped.map(section => `
                <div class="space-y-2">
                  <div class="text-[11px] font-black uppercase tracking-wide text-slate-500">${section.group_label}</div>
                  <div class="space-y-1">
                    ${section.items.map(item => `
                      <div class="rounded-xl border border-slate-200 dark:border-darkBorder px-3 py-2">
                        <div class="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            class="${itemClass} min-w-0 flex-1 text-left"
                            data-path="${item.path}"
                          >
                            <div class="flex items-center gap-2 min-w-0">
                              <i class="${item.icon || "fa-solid fa-circle-dot"} text-[12px] text-slate-400 shrink-0"></i>
                              <span class="truncate text-xs font-semibold">${item.label}</span>
                            </div>
                            <div class="mt-1 text-[10px] text-slate-500 truncate">${item.path}</div>
                          </button>
                          ${actionLabel ? `<span class="text-[10px] font-black text-slate-400 shrink-0">${actionLabel}</span>` : ``}
                        </div>
                      </div>
                    `).join("")}
                  </div>
                </div>
              `).join("")
            : `<div class="text-sm text-slate-500">${emptyText}</div>`
        }
      </div>
    </div>
  `;
}
