import { json, requireAuth, hasRole } from "../../../_lib.js";

const KNOWN_MODULE_FILES = new Set([
  "/modules/mod_admin_user_mfa_inspector.js",
  "/modules/mod_audit.js",
  "/modules/mod_blogspot.js",
  "/modules/mod_blogspot_pages.js",
  "/modules/mod_blogspot_posts.js",
  "/modules/mod_blogspot_sync.js",
  "/modules/mod_blogspot_widgets.js",
  "/modules/mod_bootstrap_admin.js",
  "/modules/mod_cfg_analytics.js",
  "/modules/mod_cfg_blogspot.js",
  "/modules/mod_cfg_bulk_tools.js",
  "/modules/mod_cfg_cron_global.js",
  "/modules/mod_cfg_global.js",
  "/modules/mod_cfg_otp.js",
  "/modules/mod_cfg_plugins.js",
  "/modules/mod_cfg_sec_policy.js",
  "/modules/mod_cfg_verify.js",
  "/modules/mod_config.js",
  "/modules/mod_dashboard.js",
  "/modules/mod_data.js",
  "/modules/mod_data_export.js",
  "/modules/mod_data_import.js",
  "/modules/mod_force_password_reset_admin.js",
  "/modules/mod_invites_talent.js",
  "/modules/mod_ipblocks.js",
  "/modules/mod_login_audit_timeline.js",
  "/modules/mod_menu_builder.js",
  "/modules/mod_mfa_challenge.js",
  "/modules/mod_mfa_compliance_dashboard.js",
  "/modules/mod_mfa_enrollment.js",
  "/modules/mod_mfa_policy_console.js",
  "/modules/mod_mfa_recovery_audit.js",
  "/modules/mod_mfa_recovery_codes.js",
  "/modules/mod_mfa_recovery_export.js",
  "/modules/mod_ops.js",
  "/modules/mod_ops_incidents.js",
  "/modules/mod_ops_oncall.js",
  "/modules/mod_password_change_required.js",
  "/modules/mod_placeholder.js",
  "/modules/mod_plugins.js",
  "/modules/mod_preferences_appearance.js",
  "/modules/mod_profile.js",
  "/modules/mod_profile_security.js",
  "/modules/mod_rbac.js",
  "/modules/mod_registry.js",
  "/modules/mod_role_builder.js",
  "/modules/mod_security.js",
  "/modules/mod_security_center.js",
  "/modules/mod_security_final_health.js",
  "/modules/mod_security_policy.js",
  "/modules/mod_security_policy_console.js",
  "/modules/mod_sessions_admin.js",
  "/modules/mod_sessions_me.js",
  "/modules/mod_settings_center.js",
  "/modules/mod_user_role_assignment.js",
  "/modules/mod_users.js",
  "/modules/mod_users_admin.js",
  "/modules/mod_users_client.js",
  "/modules/mod_users_talent.js",
  "/modules/mod_users_tenant.js",
  "/modules/mod_verification_admin.js",
  "/modules/mod_verification_dashboard.js",
  "/modules/mod_verify_center.js"
]);

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/, "");
  return p || "/";
}

function normalizeGroupKey(v){
  const x = String(v || "").trim().toLowerCase();
  return [
    "dashboard","access","users","security",
    "content","ops","data","settings","audit"
  ].includes(x) ? x : "settings";
}

function severityRank(v){
  const map = { healthy:0, notice:1, warning:2, critical:3 };
  return map[String(v || "healthy")] ?? 0;
}

function statusLabel(v){
  if(v === "critical") return "Perlu perbaikan";
  if(v === "warning") return "Perlu perhatian";
  if(v === "notice") return "Info";
  return "Sehat";
}

function pushIssue(list, kind, severity, title, recommendation, extra = {}){
  list.push({
    kind: String(kind || "issue"),
    severity: String(severity || "notice"),
    status_label: statusLabel(severity),
    title: String(title || "Issue"),
    recommendation: String(recommendation || ""),
    ...extra
  });
}

async function readMenus(env){
  const r = await env.DB.prepare(`
    SELECT id, code, label, path, parent_id, sort_order, icon, created_at, group_key
    FROM menus
    ORDER BY sort_order ASC, created_at ASC
  `).all();

  return (r.results || []).map(x => ({
    id: String(x.id || ""),
    code: String(x.code || ""),
    label: String(x.label || ""),
    path: normPath(x.path || "/"),
    parent_id: x.parent_id ? String(x.parent_id) : null,
    sort_order: Number(x.sort_order ?? 9999),
    icon: String(x.icon || ""),
    created_at: Number(x.created_at ?? 0),
    group_key: normalizeGroupKey(x.group_key)
  }));
}

async function readRegistryRoutes(env){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k = 'registry_routes'
    LIMIT 1
  `).first();

  if(!row?.v) return {};

  try{
    const parsed = JSON.parse(row.v);
    return parsed && typeof parsed === "object" ? parsed : {};
  }catch{
    return {};
  }
}

function groupForPath(path, menusByPath){
  const hit = menusByPath.get(path);
  if(hit) return hit.group_key;
  return "settings";
}

function parentExists(menu, menusById){
  if(!menu.parent_id) return true;
  return menusById.has(menu.parent_id);
}

function detectMenuDuplicates(menus){
  const byPath = new Map();
  const byCode = new Map();

  for(const m of menus){
    const p = normPath(m.path || "/");
    const c = String(m.code || "").trim().toLowerCase();

    if(p && p !== "/"){
      if(!byPath.has(p)) byPath.set(p, []);
      byPath.get(p).push(m.id);
    }

    if(c){
      if(!byCode.has(c)) byCode.set(c, []);
      byCode.get(c).push(m.id);
    }
  }

  const dupPath = Array.from(byPath.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([path, ids]) => ({ path, ids }));

  const dupCode = Array.from(byCode.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([code, ids]) => ({ code, ids }));

  return { dupPath, dupCode };
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin", "audit_admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const menus = await readMenus(env);
  const routes = await readRegistryRoutes(env);

  const menusById = new Map(menus.map(x => [x.id, x]));
  const menusByPath = new Map(menus.map(x => [x.path, x]));
  const routeEntries = Object.entries(routes || {}).map(([path, cfg]) => ({
    path: normPath(path),
    module: String(cfg?.module || ""),
    export: String(cfg?.export || "default"),
    title: String(cfg?.title || cfg?.label || path),
    group: String(cfg?.group || ""),
    raw: cfg || {}
  }));

  const issues = [];
  const menuItems = [];
  const routeItems = [];

  const { dupPath, dupCode } = detectMenuDuplicates(menus);

  for(const d of dupPath){
    pushIssue(
      issues,
      "duplicate_menu_path",
      "critical",
      `Path menu ganda ditemukan: ${d.path}`,
      "Gunakan satu path unik untuk satu menu. Satukan atau ubah path menu yang bentrok.",
      { path: d.path, ids: d.ids }
    );
  }

  for(const d of dupCode){
    pushIssue(
      issues,
      "duplicate_menu_code",
      "warning",
      `Code menu ganda ditemukan: ${d.code}`,
      "Gunakan code unik agar audit, builder, dan mapping route lebih konsisten.",
      { code: d.code, ids: d.ids }
    );
  }

  for(const menu of menus){
    const path = normPath(menu.path);
    const route = routes[path];
    const parent_ok = parentExists(menu, menusById);
    const isRoot = !menu.parent_id;
    const isContainer = isRoot && ["/access-control"].includes(path);

    let severity = "healthy";
    const notices = [];

    if(!parent_ok){
      severity = "critical";
      notices.push("Parent menu tidak ditemukan.");
    }

    if(path === "/" || !path){
      severity = severityRank(severity) < 2 ? "warning" : severity;
      notices.push("Path menu root tidak ideal untuk registry dashboard.");
    }

    if(!route && !isContainer){
      severity = severityRank(severity) < 2 ? "warning" : severity;
      notices.push("Menu ada di database tetapi belum ada route registry.");
    }

    if(route){
      const module_ok = KNOWN_MODULE_FILES.has(String(route.module || ""));
      if(!module_ok){
        severity = "critical";
        notices.push("Route registry menunjuk module yang tidak ditemukan di daftar file.");
      }
    }

    if(!menu.icon){
      if(severityRank(severity) < 1) severity = "notice";
      notices.push("Icon kosong. Sebaiknya isi agar sidebar lebih jelas.");
    }

    menuItems.push({
      id: menu.id,
      code: menu.code,
      label: menu.label,
      path,
      group_key: menu.group_key,
      parent_id: menu.parent_id,
      registry_exists: !!route,
      registry_module: route?.module || null,
      module_exists: route ? KNOWN_MODULE_FILES.has(String(route.module || "")) : false,
      parent_ok,
      severity,
      status_label: statusLabel(severity),
      notices,
      recommendation: !route && !isContainer
        ? "Tambahkan route ini ke registry atau ubah menu menjadi container-only."
        : (!parent_ok
          ? "Perbaiki parent_id atau hapus referensi parent yang sudah tidak ada."
          : (!menu.icon
            ? "Tambahkan icon agar lebih mudah dikenali."
            : "Tidak ada tindakan penting.")
        )
    });
  }

  for(const route of routeEntries){
    const menu = menusByPath.get(route.path);
    const module_ok = KNOWN_MODULE_FILES.has(route.module);

    let severity = "healthy";
    const notices = [];

    if(!menu){
      severity = "critical";
      notices.push("Route registry tidak punya menu di database.");
    }

    if(!module_ok){
      severity = "critical";
      notices.push("Module route tidak ditemukan di daftar file.");
    }

    if(menu){
      const expectedGroup = groupForPath(route.path, menusByPath);
      if(route.group && String(route.group) !== String(expectedGroup)){
        if(severityRank(severity) < 1) severity = "notice";
        notices.push("Group registry berbeda dengan group_key menu.");
      }
    }

    routeItems.push({
      path: route.path,
      module: route.module,
      export: route.export,
      title: route.title,
      group: route.group || null,
      menu_exists: !!menu,
      menu_id: menu?.id || null,
      menu_label: menu?.label || null,
      module_exists: module_ok,
      severity,
      status_label: statusLabel(severity),
      notices,
      recommendation: !menu
        ? "Tambahkan menu DB untuk route ini atau hapus route registry yang tidak dipakai."
        : (!module_ok
          ? "Perbaiki path module registry agar sesuai file yang tersedia."
          : "Tidak ada tindakan penting.")
    });
  }

  const dead_routes = routeItems.filter(x => !x.menu_exists || !x.module_exists);
  const dead_menus = menuItems.filter(x => !x.registry_exists || !x.module_exists || !x.parent_ok);

  const summary = {
    total_menus: menuItems.length,
    total_routes: routeItems.length,
    healthy_menus: menuItems.filter(x => x.severity === "healthy").length,
    healthy_routes: routeItems.filter(x => x.severity === "healthy").length,
    dead_routes: dead_routes.length,
    dead_menus: dead_menus.length,
    critical_issues: issues.filter(x => x.severity === "critical").length
      + menuItems.filter(x => x.severity === "critical").length
      + routeItems.filter(x => x.severity === "critical").length,
    warnings: issues.filter(x => x.severity === "warning").length
      + menuItems.filter(x => x.severity === "warning").length
      + routeItems.filter(x => x.severity === "warning").length
  };

  const overall_severity =
    summary.critical_issues > 0 ? "critical" :
    summary.warnings > 0 ? "warning" :
    "healthy";

  const top_notices = [];
  if(summary.dead_routes > 0){
    top_notices.push("Ada route registry yang belum tersambung sempurna. Periksa module atau menu terkait.");
  }
  if(summary.dead_menus > 0){
    top_notices.push("Ada menu database yang belum aktif penuh di aplikasi. Sinkronkan menu dengan registry.");
  }
  if(dupPath.length > 0){
    top_notices.push("Ada path menu ganda. Ini bisa membuat navigasi dan module resolve tidak konsisten.");
  }
  if(dupCode.length > 0){
    top_notices.push("Ada code menu ganda. Sebaiknya dibersihkan untuk memudahkan audit dan pengelolaan.");
  }
  if(!top_notices.length){
    top_notices.push("Registry dan menu berada pada kondisi sehat.");
  }

  return json(200, "ok", {
    overall: {
      severity: overall_severity,
      status_label: statusLabel(overall_severity),
      top_notices
    },
    summary,
    issues,
    dead_routes,
    dead_menus,
    menu_items: menuItems,
    route_items: routeItems,
    known_module_count: KNOWN_MODULE_FILES.size
  });
}
