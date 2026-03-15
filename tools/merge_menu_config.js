const fs = require("fs");
const path = require("path");

const basePath = path.join(process.cwd(), "tools", "menu_sync_config.json");
const suggestedPath = path.join(process.cwd(), "tools", "menu_sync_suggested.json");
const outPath = path.join(process.cwd(), "tools", "menu_sync_merged.json");

function readJson(file){
  if(!fs.existsSync(file)){
    throw new Error("file not found: " + file);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normArr(v){
  return Array.isArray(v) ? v : [];
}

function keyTriplet(item){
  return {
    id: String(item?.id || "").trim(),
    code: String(item?.code || "").trim(),
    path: String(item?.path || "").trim()
  };
}

function addUnique(target, item, seen, sourceLabel){
  const k = keyTriplet(item);

  if(!k.id || !k.code || !k.path){
    return {
      added: false,
      reason: "missing_key",
      source: sourceLabel,
      item
    };
  }

  if(seen.ids.has(k.id)){
    return {
      added: false,
      reason: "duplicate_id",
      source: sourceLabel,
      value: k.id,
      item
    };
  }

  if(seen.codes.has(k.code)){
    return {
      added: false,
      reason: "duplicate_code",
      source: sourceLabel,
      value: k.code,
      item
    };
  }

  if(seen.paths.has(k.path)){
    return {
      added: false,
      reason: "duplicate_path",
      source: sourceLabel,
      value: k.path,
      item
    };
  }

  target.push(item);
  seen.ids.add(k.id);
  seen.codes.add(k.code);
  seen.paths.add(k.path);

  return {
    added: true,
    source: sourceLabel,
    item
  };
}

function sortMenus(arr){
  return [...arr].sort((a, b) => {
    const sa = Number(a?.sort_order || 0);
    const sb = Number(b?.sort_order || 0);
    if(sa !== sb) return sa - sb;
    return String(a?.path || "").localeCompare(String(b?.path || ""));
  });
}

function main(){
  const base = readJson(basePath);
  const suggested = readJson(suggestedPath);

  const out = {
    generated_from: {
      base: path.relative(process.cwd(), basePath),
      suggested: path.relative(process.cwd(), suggestedPath)
    },
    generated_at: new Date().toISOString(),
    notes: [
      "Base config has priority over suggested config",
      "Duplicates by id/code/path are skipped from suggested config",
      "Review before replacing tools/menu_sync_config.json"
    ],
    parents: [],
    children: []
  };

  const seenParents = { ids:new Set(), codes:new Set(), paths:new Set() };
  const seenChildren = { ids:new Set(), codes:new Set(), paths:new Set() };

  const report = {
    parents: { added_base: 0, added_suggested: 0, skipped: [] },
    children: { added_base: 0, added_suggested: 0, skipped: [] }
  };

  for(const item of normArr(base.parents)){
    const r = addUnique(out.parents, item, seenParents, "base.parents");
    if(r.added) report.parents.added_base += 1;
    else report.parents.skipped.push(r);
  }

  for(const item of normArr(suggested.parents)){
    const r = addUnique(out.parents, item, seenParents, "suggested.parents");
    if(r.added) report.parents.added_suggested += 1;
    else report.parents.skipped.push(r);
  }

  for(const item of normArr(base.children)){
    const r = addUnique(out.children, item, seenChildren, "base.children");
    if(r.added) report.children.added_base += 1;
    else report.children.skipped.push(r);
  }

  for(const item of normArr(suggested.children)){
    const r = addUnique(out.children, item, seenChildren, "suggested.children");
    if(r.added) report.children.added_suggested += 1;
    else report.children.skipped.push(r);
  }

  out.parents = sortMenus(out.parents);
  out.children = sortMenus(out.children);

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  const reportPath = path.join(process.cwd(), "tools", "menu_sync_merge_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("[OK] wrote:", outPath);
  console.log("[OK] wrote:", reportPath);
  console.log("[INFO] parents base added:", report.parents.added_base);
  console.log("[INFO] parents suggested added:", report.parents.added_suggested);
  console.log("[INFO] children base added:", report.children.added_base);
  console.log("[INFO] children suggested added:", report.children.added_suggested);
  console.log("[INFO] parent skipped:", report.parents.skipped.length);
  console.log("[INFO] child skipped:", report.children.skipped.length);
}

main();
