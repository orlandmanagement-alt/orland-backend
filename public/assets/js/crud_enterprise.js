export function ceEsc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

export function ceToolbar({
  title = "CRUD List",
  desc = "",
  searchPlaceholder = "Search...",
  searchValue = "",
  createLabel = "New",
  withCreate = true,
  filtersHtml = "",
  extraRightHtml = ""
} = {}){
  return `
    <div class="crud-shell space-y-4">
      <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
        <div class="crud-toolbar">
          <div class="crud-toolbar-main">
            <div>
              <div class="text-2xl font-extrabold ui-title-gradient">${ceEsc(title)}</div>
              ${desc ? `<div class="text-slate-500 mt-1 text-sm">${ceEsc(desc)}</div>` : ``}
            </div>
          </div>

          <div class="crud-toolbar-actions">
            ${extraRightHtml || ``}
            ${withCreate ? `
              <button id="btnCrudCreate" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
                <i class="fa-solid fa-plus mr-2"></i>${ceEsc(createLabel)}
              </button>
            ` : ``}
          </div>
        </div>

        <div class="crud-toolbar-filters mt-4">
          <div class="crud-search-box">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input id="crudSearchInput" value="${ceEsc(searchValue)}" class="crud-search-input" placeholder="${ceEsc(searchPlaceholder)}">
          </div>
          <div class="crud-filter-slot">
            ${filtersHtml || ``}
          </div>
        </div>
      </div>

      <div id="crudBulkBar" class="hidden crud-bulkbar ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4"></div>

      <div id="crudListBody"></div>

      <div id="crudPagination"></div>
    </div>
  `;
}

export function ceFilterChips(items = [], active = ""){
  return `
    <div class="crud-chip-row">
      ${items.map(x => `
        <button
          type="button"
          class="crud-chip ${String(active) === String(x.value) ? "is-active" : ""}"
          data-chip-value="${ceEsc(x.value)}"
        >
          ${x.icon ? `<i class="${ceEsc(x.icon)} mr-2"></i>` : ``}${ceEsc(x.label)}
        </button>
      `).join("")}
    </div>
  `;
}

export function ceStatsCards(items = []){
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 ui-gap-grid">
      ${items.map(x => `
        <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
          <div class="text-xs font-black text-slate-500 uppercase">${ceEsc(x.label || "-")}</div>
          <div class="text-2xl font-extrabold mt-2">${ceEsc(x.value ?? "0")}</div>
          ${x.hint ? `<div class="text-xs text-slate-500 mt-2">${ceEsc(x.hint)}</div>` : ``}
        </div>
      `).join("")}
    </div>
  `;
}

export function ceTableWrap(innerHtml = ""){
  return `
    <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
      <div class="ui-table-wrap">
        ${innerHtml}
      </div>
    </div>
  `;
}

export function cePagination({
  page = 1,
  pageSize = 10,
  total = 0
} = {}){
  const p = Math.max(1, Number(page || 1));
  const ps = Math.max(1, Number(pageSize || 10));
  const t = Math.max(0, Number(total || 0));
  const pages = Math.max(1, Math.ceil(t / ps));
  const start = t ? ((p - 1) * ps) + 1 : 0;
  const end = Math.min(t, p * ps);

  return `
    <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
      <div class="crud-pagination">
        <div class="crud-pagination-info">
          Showing <b>${start}</b> - <b>${end}</b> of <b>${t}</b>
        </div>
        <div class="crud-pagination-actions">
          <button type="button" id="crudPagePrev" class="crud-page-btn" ${p <= 1 ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-left mr-2"></i>Prev
          </button>
          <div class="crud-page-indicator">Page <b>${p}</b> / <b>${pages}</b></div>
          <button type="button" id="crudPageNext" class="crud-page-btn" ${p >= pages ? "disabled" : ""}>
            Next<i class="fa-solid fa-chevron-right ml-2"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function ceEmptyState({
  title = "No data",
  desc = "Belum ada data untuk ditampilkan.",
  icon = "fa-regular fa-folder-open"
} = {}){
  return `
    <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-8">
      <div class="crud-empty">
        <div class="crud-empty-icon"><i class="${ceEsc(icon)}"></i></div>
        <div class="text-lg font-extrabold mt-4">${ceEsc(title)}</div>
        <div class="text-sm text-slate-500 mt-2">${ceEsc(desc)}</div>
      </div>
    </div>
  `;
}

export function ceLoadingState(label = "Loading..."){
  return `
    <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-8">
      <div class="crud-loading">
        <div class="crud-spinner"></div>
        <div class="text-sm font-black">${ceEsc(label)}</div>
      </div>
    </div>
  `;
}

export function ceBulkBar({
  count = 0,
  actionsHtml = ""
} = {}){
  return `
    <div class="crud-bulkbar-inner">
      <div class="crud-bulkbar-info">
        <i class="fa-solid fa-check-double mr-2"></i>${Number(count || 0)} selected
      </div>
      <div class="crud-bulkbar-actions">
        ${actionsHtml || ``}
      </div>
    </div>
  `;
}

export function ceBindFilterChips(host, onPick){
  host.querySelectorAll("[data-chip-value]").forEach(btn => {
    btn.addEventListener("click", ()=>{
      if(typeof onPick === "function"){
        onPick(btn.getAttribute("data-chip-value") || "");
      }
    });
  });
}

export function ceSelectionModel(items = [], key = "id"){
  const selected = new Set();

  function getId(row){
    return String(row?.[key] ?? "");
  }

  return {
    toggle(row){
      const id = getId(row);
      if(!id) return;
      if(selected.has(id)) selected.delete(id);
      else selected.add(id);
    },
    clear(){
      selected.clear();
    },
    has(row){
      return selected.has(getId(row));
    },
    ids(){
      return Array.from(selected);
    },
    count(){
      return selected.size;
    },
    selectAll(rows = items){
      for(const row of (rows || [])){
        const id = getId(row);
        if(id) selected.add(id);
      }
    }
  };
}
