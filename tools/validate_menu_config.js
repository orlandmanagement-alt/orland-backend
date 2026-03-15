const fs = require("fs");
const path = require("path");

const cfgPath = path.join(process.cwd(), "tools", "menu_sync_config.json");

function readJson(file){
  if(!fs.existsSync(file)){
    throw new Error("file not found: " + file);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function arr(v){
  return Array.isArray(v) ? v : [];
}

function s(v){
  return String(v ?? "").trim();
}

function pushIssue(list, type, where, message, extra = {}){
  list.push({ type, where, message, ...extra });
}

function main(){
  const cfg = readJson(cfgPath);
  const parents = arr(cfg.parents);
  const children = arr(cfg.children);
  const all = [...parents, ...children];

  const errors = [];
  const warnings = [];

  const requiredFields = ["id", "code", "label", "path", "sort_order", "icon"];

  for(const item of all){
    const where = item.id || item.code || item.path || "unknown";

    for(const f of requiredFields){
      if(!s(item[f])){
        pushIssue(errors, "error", where, `missing required field: ${f}`);
      }
    }

    if(!Array.isArray(item.roles)){
      pushIssue(errors, "error", where, "roles must be array");
    } else if(item.roles.length === 0){
      pushIssue(warnings, "warning", where, "roles array is empty");
    }

    if(item.parent_id != null && !s(item.parent_id)){
      pushIssue(warnings, "warning", where, "parent_id is blank string; use null instead");
    }

    if(!s(item.path).startsWith("/")){
      pushIssue(warnings, "warning", where, "path should start with /", { path: item.path });
    }

    if(Number.isNaN(Number(item.sort_order))){
      pushIssue(errors, "error", where, "sort_order must be numeric", { sort_order: item.sort_order });
    }
  }

  function checkDup(field){
    const map = new Map();
    for(const item of all){
      const key = s(item[field]);
      if(!key) continue;
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(item.id || item.code || item.path);
    }
    for(const [k, ids] of map.entries()){
      if(ids.length > 1){
        pushIssue(errors, "error", field, `duplicate ${field}: ${k}`, { items: ids });
      }
    }
  }

  checkDup("id");
  checkDup("code");
  checkDup("path");

  const parentIds = new Set(parents.map(x => s(x.id)).filter(Boolean));

  for(const child of children){
    const where = child.id || child.code || child.path || "unknown";
    const pid = s(child.parent_id);
    if(!pid){
      pushIssue(warnings, "warning", where, "child has no parent_id");
      continue;
    }
    if(!parentIds.has(pid)){
      pushIssue(errors, "error", where, `parent_id not found: ${pid}`);
    }
  }

  const pathToItem = new Map();
  for(const item of all){
    const p = s(item.path);
    if(p) pathToItem.set(p, item);
  }

  for(const item of all){
    const where = item.id || item.code || item.path || "unknown";
    const p = s(item.path);
    if(!p || p === "/") continue;

    const parts = p.split("/").filter(Boolean);
    if(parts.length > 1){
      const parentPath = "/" + parts.slice(0, -1).join("/");
      if(!pathToItem.has(parentPath)){
        pushIssue(warnings, "warning", where, `path parent not found in config: ${parentPath}`);
      }
    }
  }

  const sortMap = new Map();
  for(const item of all){
    const so = Number(item.sort_order);
    const key = String(so);
    if(!sortMap.has(key)) sortMap.set(key, []);
    sortMap.get(key).push(item.id || item.code || item.path);
  }
  for(const [sortOrder, ids] of sortMap.entries()){
    if(ids.length > 1){
      pushIssue(warnings, "warning", "sort_order", `duplicate sort_order: ${sortOrder}`, { items: ids });
    }
  }

  const report = {
    file: path.relative(process.cwd(), cfgPath),
    checked_at: new Date().toISOString(),
    counts: {
      parents: parents.length,
      children: children.length,
      total: all.length,
      errors: errors.length,
      warnings: warnings.length
    },
    errors,
    warnings
  };

  const outPath = path.join(process.cwd(), "tools", "menu_sync_validation_report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("[OK] wrote:", outPath);
  console.log("[INFO] parents:", parents.length);
  console.log("[INFO] children:", children.length);
  console.log("[INFO] total:", all.length);
  console.log("[INFO] errors:", errors.length);
  console.log("[INFO] warnings:", warnings.length);

  if(errors.length){
    console.log("[RESULT] INVALID");
    process.exitCode = 2;
  } else {
    console.log("[RESULT] VALID");
  }
}

main();
