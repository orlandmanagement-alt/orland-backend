const fs = require("fs");
const path = require("path");

const registryCandidates = [
  path.join(process.cwd(), "functions", "api", "registry.js"),
  path.join(process.cwd(), "functions", "api", "Registry.js")
];

const outPath = path.join(process.cwd(), "tools", "menu_sync_suggested.json");

function titleFromPath(p){
  const clean = String(p || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if(!clean) return "Home";

  return clean
    .split("/")
    .filter(Boolean)
    .map(seg => seg
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, m => m.toUpperCase())
    )
    .join(" / ");
}

function iconGuess(p){
  const s = String(p || "").toLowerCase();
  if(s.includes("certificate")) return "fa-solid fa-certificate";
  if(s.includes("archive")) return "fa-solid fa-box-archive";
  if(s.includes("finish")) return "fa-solid fa-flag-checkered";
  if(s.includes("project")) return "fa-solid fa-diagram-project";
  if(s.includes("talent")) return "fa-solid fa-star";
  if(s.includes("client")) return "fa-solid fa-building";
  if(s.includes("user")) return "fa-solid fa-users";
  if(s.includes("blogspot")) return "fa-brands fa-blogger";
  if(s.includes("analytics")) return "fa-solid fa-chart-line";
  if(s.includes("config")) return "fa-solid fa-sliders";
  if(s.includes("security")) return "fa-solid fa-shield-halved";
  if(s.includes("menu")) return "fa-solid fa-sitemap";
  return "fa-solid fa-folder";
}

function codeFromPath(p){
  return String(p || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/[\/-]+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase() || "root";
}

function idFromPath(p){
  return "m_auto_" + codeFromPath(p);
}

function isPublicPath(p){
  const s = String(p || "").toLowerCase();
  return (
    s.startsWith("/certificate/view") ||
    s.startsWith("/certificate/verify") ||
    s.startsWith("/talent/public") ||
    s === "/" ||
    s.includes("/public")
  );
}

function rolesForPath(p){
  const s = String(p || "").toLowerCase();

  if(s.includes("/certificates/templates")) return ["super_admin"];
  if(s.includes("/certificates/issue")) return ["super_admin", "admin", "staff"];
  if(s.includes("/projects/finish-bulk")) return ["super_admin", "admin", "staff"];
  if(s.includes("/projects/archive-view")) return ["super_admin", "admin", "staff"];
  if(s.includes("/config")) return ["super_admin", "admin"];
  if(s.includes("/rbac")) return ["super_admin", "admin"];
  if(s.includes("/security")) return ["super_admin", "admin", "staff"];
  if(s.includes("/ops")) return ["super_admin", "admin", "staff"];
  if(s.includes("/users")) return ["super_admin", "admin"];
  return ["super_admin", "admin", "staff"];
}

function parentPathOf(p){
  const parts = String(p || "").split("/").filter(Boolean);
  if(parts.length <= 1) return null;
  return "/" + parts.slice(0, -1).join("/");
}

function findRegistryPath(){
  for(const f of registryCandidates){
    if(fs.existsSync(f)) return f;
  }
  throw new Error("registry.js / Registry.js not found in functions/api");
}

function parsePaths(content){
  const set = new Set();

  const pathMapRegex = /["'](\/[^"']+)["']\s*:\s*["'](\/modules\/[^"']+)["']/g;
  let m;
  while((m = pathMapRegex.exec(content)) !== null){
    set.add(m[1]);
  }

  return Array.from(set).sort((a,b) => a.localeCompare(b));
}

function main(){
  const registryPath = findRegistryPath();
  const content = fs.readFileSync(registryPath, "utf8");
  const allPaths = parsePaths(content);

  const internalPaths = allPaths.filter(p => !isPublicPath(p));

  const parentSet = new Map();
  for(const p of internalPaths){
    const parent = parentPathOf(p);
    if(parent && !isPublicPath(parent)){
      parentSet.set(parent, {
        id: idFromPath(parent),
        code: codeFromPath(parent),
        label: titleFromPath(parent),
        path: parent,
        parent_id: parentPathOf(parent) ? idFromPath(parentPathOf(parent)) : null,
        sort_order: 100,
        icon: iconGuess(parent),
        group_key: "system",
        roles: rolesForPath(parent)
      });
    }
  }

  const children = internalPaths.map((p, i) => ({
    id: idFromPath(p),
    code: codeFromPath(p),
    label: titleFromPath(p),
    path: p,
    parent_id: parentPathOf(p) ? idFromPath(parentPathOf(p)) : null,
    sort_order: 200 + i,
    icon: iconGuess(p),
    group_key: "system",
    roles: rolesForPath(p)
  }));

  const parentIdsUsedByChildren = new Set(children.map(x => x.parent_id).filter(Boolean));
  const parents = Array.from(parentSet.values())
    .filter(x => parentIdsUsedByChildren.has(x.id))
    .sort((a,b) => a.path.localeCompare(b.path));

  const out = {
    generated_from: path.relative(process.cwd(), registryPath),
    generated_at: new Date().toISOString(),
    notes: [
      "Review this file before copying into tools/menu_sync_config.json",
      "Public routes were excluded automatically",
      "Sort orders are draft values and may need cleanup"
    ],
    parents,
    children
  };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  console.log("[OK] registry source:", registryPath);
  console.log("[OK] total paths found:", allPaths.length);
  console.log("[OK] internal paths:", internalPaths.length);
  console.log("[OK] parents suggested:", parents.length);
  console.log("[OK] children suggested:", children.length);
  console.log("[OK] wrote:", outPath);
}

main();
