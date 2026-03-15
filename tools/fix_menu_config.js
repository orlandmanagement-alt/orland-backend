const fs = require("fs");
const path = require("path");

const inPath = path.join(process.cwd(), "tools", "menu_sync_config.json");
const outPath = path.join(process.cwd(), "tools", "menu_sync_config_fixed.json");

function readJson(file){
  if(!fs.existsSync(file)) throw new Error("file not found: " + file);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function clone(v){
  return JSON.parse(JSON.stringify(v));
}

function arr(v){
  return Array.isArray(v) ? v : [];
}

function s(v){
  return String(v ?? "").trim();
}

function hasId(items, id){
  return items.some(x => s(x.id) === s(id));
}

function hasPath(items, p){
  return items.some(x => s(x.path) === s(p));
}

function nextSort(items, startAt){
  const used = new Set(items.map(x => Number(x.sort_order || 0)));
  let n = Number(startAt || 100);
  while(used.has(n)) n += 1;
  return n;
}

function main(){
  const cfg = readJson(inPath);
  const out = clone(cfg);

  out.parents = arr(out.parents);
  out.children = arr(out.children);

  const all = [...out.parents, ...out.children];

  // 1. Add /projects parent if missing
  if(!hasId(out.parents, "m_projects_root") && !hasPath(all, "/projects")){
    out.parents.push({
      id: "m_projects_root",
      code: "projects",
      label: "Projects",
      path: "/projects",
      parent_id: null,
      sort_order: 109,
      icon: "fa-solid fa-diagram-project",
      group_key: "system",
      roles: ["super_admin", "admin", "staff"]
    });
  }

  // 2. Make project archive root a child of /projects parent
  for(const p of out.parents){
    if(s(p.id) === "m_proj_archive_root"){
      p.parent_id = "m_projects_root";
    }
  }

  // 3. Normalize sort orders to avoid collisions
  const desiredOrder = [
    "m_projects_root",
    "m_cert_root",
    "m_cert_templates",
    "m_cert_issue",
    "m_proj_archive_root",
    "m_proj_finish_bulk",
    "m_proj_archive_view"
  ];

  let sortBase = 109;
  const taken = new Set();

  function assignSort(item, fallbackStep){
    if(!item) return;
    while(taken.has(sortBase)) sortBase += 1;
    item.sort_order = sortBase;
    taken.add(sortBase);
    sortBase += (fallbackStep || 1);
  }

  for(const id of desiredOrder){
    const item = [...out.parents, ...out.children].find(x => s(x.id) === id);
    assignSort(item, 1);
  }

  for(const item of [...out.parents, ...out.children]){
    if(!taken.has(Number(item.sort_order || 0))){
      let n = nextSort([...out.parents, ...out.children], 200);
      while(taken.has(n)) n += 1;
      item.sort_order = n;
      taken.add(n);
    }
  }

  out.parents.sort((a,b) => Number(a.sort_order||0) - Number(b.sort_order||0) || s(a.path).localeCompare(s(b.path)));
  out.children.sort((a,b) => Number(a.sort_order||0) - Number(b.sort_order||0) || s(a.path).localeCompare(s(b.path)));

  out.generated_at = new Date().toISOString();
  out.notes = [
    "Auto fixed from menu_sync_config.json",
    "Added /projects parent if missing",
    "Moved project archive root under /projects",
    "Re-numbered sort_order to reduce collisions"
  ];

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  console.log("[OK] wrote:", outPath);
  console.log("[INFO] parents:", out.parents.length);
  console.log("[INFO] children:", out.children.length);
}

main();
