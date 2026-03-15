const fs = require("fs");
const path = require("path");

const registryCandidates = [
  path.join(process.cwd(), "functions", "api", "registry.js"),
  path.join(process.cwd(), "functions", "api", "Registry.js")
];

const menusTxtCandidates = [
  path.join(process.cwd(), "menus_dump.txt"),
  path.join(process.cwd(), "db_menus.txt"),
  path.join(process.cwd(), "query_menus.txt")
];

const roleMenusTxtCandidates = [
  path.join(process.cwd(), "role_menus_dump.txt"),
  path.join(process.cwd(), "db_role_menus.txt"),
  path.join(process.cwd(), "query_role_menus.txt")
];

const modulesDir = path.join(process.cwd(), "public", "modules");
const outPath = path.join(process.cwd(), "audit_registry_menu_modules_report.json");

function findFirstExisting(arr){
  for(const f of arr){
    if(fs.existsSync(f)) return f;
  }
  return null;
}

function readTextSafe(file){
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function normalizePath(p){
  let s = String(p || "").trim();
  if(!s) return "";
  if(!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\/+/g, "/");
  if(s.length > 1) s = s.replace(/\/+$/, "");
  return s;
}

function parseRegistry(content){
  const pathMap = {};
  const codeMap = {};
  const usedModules = new Set();

  const pathRegex = /["'](\/[^"']+)["']\s*:\s*["'](\/modules\/[^"']+\.js)["']/g;
  let m;
  while((m = pathRegex.exec(content)) !== null){
    const p = normalizePath(m[1]);
    const mod = String(m[2] || "").trim();
    pathMap[p] = mod;
    usedModules.add(mod);
  }

  const codeRegex = /([a-zA-Z0-9_]+)\s*:\s*["'](\/modules\/[^"']+\.js)["']/g;
  while((m = codeRegex.exec(content)) !== null){
    const code = String(m[1] || "").trim();
    const mod = String(m[2] || "").trim();
    codeMap[code] = mod;
    usedModules.add(mod);
  }

  return { pathMap, codeMap, usedModules: Array.from(usedModules).sort() };
}

function parseMenusDump(content){
  const lines = String(content || "").split(/\r?\n/);
  const rows = [];

  for(const line of lines){
    const t = line.trim();
    if(!t) continue;
    if(t.startsWith("id\t")) continue;
    if(t.startsWith("> ")) continue;
    if(t.startsWith("Response time")) continue;
    if(t.startsWith("Slash commands")) continue;

    const parts = t.split("\t");
    if(parts.length < 4) continue;

    const [id, code, label, rawPath, parent_id, sort_order, icon, created_at, group_key] = parts;
    if(!id || id === "id") continue;

    rows.push({
      id: String(id || "").trim(),
      code: String(code || "").trim(),
      label: String(label || "").trim(),
      path: normalizePath(rawPath || ""),
      parent_id: String(parent_id || "").trim(),
      sort_order: Number(sort_order || 0),
      icon: String(icon || "").trim(),
      created_at: String(created_at || "").trim(),
      group_key: String(group_key || "").trim()
    });
  }

  return rows.filter(x => x.id && x.path);
}

function parseRoleMenusDump(content){
  const lines = String(content || "").split(/\r?\n/);
  const rows = [];

  for(const line of lines){
    const t = line.trim();
    if(!t) continue;
    if(t.startsWith("role_id\t")) continue;
    if(t.startsWith("> ")) continue;
    if(t.startsWith("Response time")) continue;

    const parts = t.split("\t");
    if(parts.length < 3) continue;

    const [role_id, menu_id, created_at] = parts;
    if(!role_id || role_id === "role_id") continue;

    rows.push({
      role_id: String(role_id || "").trim(),
      menu_id: String(menu_id || "").trim(),
      created_at: String(created_at || "").trim()
    });
  }

  return rows.filter(x => x.role_id && x.menu_id);
}

function listModuleFiles(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(x => x.endsWith(".js"))
    .map(x => "/modules/" + x)
    .sort();
}

function main(){
  const registryPath = findFirstExisting(registryCandidates);
  if(!registryPath){
    throw new Error("Registry.js / registry.js not found");
  }

  const registryText = readTextSafe(registryPath);
  const reg = parseRegistry(registryText);

  const menusDumpPath = findFirstExisting(menusTxtCandidates);
  const roleMenusDumpPath = findFirstExisting(roleMenusTxtCandidates);

  const menus = parseMenusDump(readTextSafe(menusDumpPath));
  const roleMenus = parseRoleMenusDump(readTextSafe(roleMenusDumpPath));
  const moduleFiles = listModuleFiles(modulesDir);

  const menuPathSet = new Set(menus.map(x => x.path));
  const menuIdSet = new Set(menus.map(x => x.id));
  const regPathSet = new Set(Object.keys(reg.pathMap));
  const regModuleSet = new Set(reg.usedModules);
  const moduleFileSet = new Set(moduleFiles);

  const menu_not_in_registry = menus
    .filter(x => !regPathSet.has(x.path))
    .map(x => ({ id: x.id, code: x.code, path: x.path, label: x.label }))
    .sort((a,b) => a.path.localeCompare(b.path));

  const registry_not_in_menus = Object.keys(reg.pathMap)
    .filter(p => !menuPathSet.has(p))
    .map(p => ({ path: p, module: reg.pathMap[p] }))
    .sort((a,b) => a.path.localeCompare(b.path));

  const missing_module_files = Object.entries(reg.pathMap)
    .filter(([, mod]) => !moduleFileSet.has(mod))
    .map(([p, mod]) => ({ path: p, module: mod }))
    .sort((a,b) => a.path.localeCompare(b.path));

  const unused_module_files = moduleFiles
    .filter(m => !regModuleSet.has(m))
    .sort();

  const role_menu_missing_menu = roleMenus
    .filter(x => !menuIdSet.has(x.menu_id))
    .sort((a,b) => a.menu_id.localeCompare(b.menu_id));

  const menu_without_roles = menus
    .filter(m => !roleMenus.some(rm => rm.menu_id === m.id))
    .map(m => ({ id: m.id, code: m.code, path: m.path, label: m.label }))
    .sort((a,b) => a.path.localeCompare(b.path));

  const expectedChecks = {
    users_client: menus.some(x => x.path === "/users/client") || regPathSet.has("/users/client"),
    users_talent: menus.some(x => x.path === "/users/talent") || regPathSet.has("/users/talent"),
    project_invites: menus.some(x => x.path === "/projects/invites") || regPathSet.has("/projects/invites"),
    project_invites_review: menus.some(x => x.path === "/projects/invites/review") || regPathSet.has("/projects/invites/review"),
    project_invite_public: regPathSet.has("/project-invite"),
    certificates_issue: menus.some(x => x.path === "/certificates/issue") || regPathSet.has("/certificates/issue"),
    certificates_templates: menus.some(x => x.path === "/certificates/templates") || regPathSet.has("/certificates/templates"),
    certificate_verify: regPathSet.has("/certificate/verify"),
    certificate_view: regPathSet.has("/certificate/view"),
    projects_finish_bulk: menus.some(x => x.path === "/projects/finish-bulk") || regPathSet.has("/projects/finish-bulk"),
    projects_archive_view: menus.some(x => x.path === "/projects/archive-view") || regPathSet.has("/projects/archive-view"),
    client_accounts: regPathSet.has("/client/accounts"),
    talent_verification: regPathSet.has("/talent/verification"),
    projects_board: regPathSet.has("/projects/board"),
    projects_root: regPathSet.has("/projects")
  };

  const summary = {
    registry_file: path.relative(process.cwd(), registryPath),
    menus_dump_file: menusDumpPath ? path.relative(process.cwd(), menusDumpPath) : null,
    role_menus_dump_file: roleMenusDumpPath ? path.relative(process.cwd(), roleMenusDumpPath) : null,
    counts: {
      registry_paths: Object.keys(reg.pathMap).length,
      registry_code_map: Object.keys(reg.codeMap).length,
      menus: menus.length,
      role_menus: roleMenus.length,
      module_files: moduleFiles.length
    },
    expected_checks: expectedChecks,
    menu_not_in_registry,
    registry_not_in_menus,
    missing_module_files,
    unused_module_files,
    role_menu_missing_menu,
    menu_without_roles
  };

  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("[OK] wrote:", outPath);
  console.log("[INFO] registry paths:", summary.counts.registry_paths);
  console.log("[INFO] menus:", summary.counts.menus);
  console.log("[INFO] role_menus:", summary.counts.role_menus);
  console.log("[INFO] module files:", summary.counts.module_files);
  console.log("[INFO] menu_not_in_registry:", menu_not_in_registry.length);
  console.log("[INFO] registry_not_in_menus:", registry_not_in_menus.length);
  console.log("[INFO] missing_module_files:", missing_module_files.length);
  console.log("[INFO] unused_module_files:", unused_module_files.length);
  console.log("[INFO] role_menu_missing_menu:", role_menu_missing_menu.length);
  console.log("[INFO] menu_without_roles:", menu_without_roles.length);
  console.log("[CHECK] users_client:", expectedChecks.users_client);
  console.log("[CHECK] users_talent:", expectedChecks.users_talent);
  console.log("[CHECK] project_invites:", expectedChecks.project_invites);
  console.log("[CHECK] project_invites_review:", expectedChecks.project_invites_review);
  console.log("[CHECK] project_invite_public:", expectedChecks.project_invite_public);
  console.log("[CHECK] client_accounts:", expectedChecks.client_accounts);
  console.log("[CHECK] talent_verification:", expectedChecks.talent_verification);
  console.log("[CHECK] projects_board:", expectedChecks.projects_board);
  console.log("[CHECK] projects_root:", expectedChecks.projects_root);
}

main();
