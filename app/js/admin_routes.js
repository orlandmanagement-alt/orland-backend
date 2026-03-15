export const ADMIN_ROUTES = [
  {
    key: "security_home",
    label: "Security Home",
    href: "/app/pages/admin/security-home.html"
  },
  {
    key: "security_kpi",
    label: "Security KPI",
    href: "/app/pages/admin/security-kpi.html"
  },
  {
    key: "users_security_monitor",
    label: "Users Security",
    href: "/app/pages/admin/users-security-monitor.html"
  },
  {
    key: "sessions_monitor",
    label: "Sessions",
    href: "/app/pages/admin/sessions-monitor.html"
  },
  {
    key: "auth_risk_monitor",
    label: "Auth Risk",
    href: "/app/pages/admin/auth-risk-monitor.html"
  },
  {
    key: "audit_logs_monitor",
    label: "Audit Logs",
    href: "/app/pages/admin/audit-logs-monitor.html"
  },
  {
    key: "ip_blocks_monitor",
    label: "IP Blocks",
    href: "/app/pages/admin/ip-blocks-monitor.html"
  },
  {
    key: "request_counters_monitor",
    label: "Counters",
    href: "/app/pages/admin/request-counters-monitor.html"
  },
  {
    key: "projects_monitor",
    label: "Projects Monitor",
    href: "/app/pages/admin/projects-monitor.html"
  },
  {
    key: "applications_monitor",
    label: "Applications Monitor",
    href: "/app/pages/admin/applications-monitor.html"
  },
  {
    key: "invites_monitor",
    label: "Invites Monitor",
    href: "/app/pages/admin/invites-monitor.html"
  },
  {
    key: "bookings_monitor",
    label: "Bookings Monitor",
    href: "/app/pages/admin/bookings-monitor.html"
  },
  {
    key: "project_pipeline_monitor",
    label: "Pipeline Monitor",
    href: "/app/pages/admin/project-pipeline-monitor.html"
  }
];

export function findAdminRouteByPath(pathname){
  const path = String(pathname || "").trim();
  return ADMIN_ROUTES.find(item => item.href === path) || null;
}
