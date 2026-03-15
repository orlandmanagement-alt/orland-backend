import { json, requireAuth } from "../../_lib.js";

function canAccessClient(roles){
  const set = new Set((roles || []).map(String));
  return set.has("client") || set.has("super_admin") || set.has("admin") || set.has("staff");
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessClient(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  return json(200, "ok", {
    items: [
      { key: "dashboard", label: "Dashboard", href: "/app/pages/client/index.html" },
      { key: "projects", label: "Projects", href: "/app/pages/client/projects.html" },
      { key: "project_detail", label: "Project Detail", href: "/app/pages/client/project-detail.html" },
      { key: "roles", label: "Roles", href: "/app/pages/client/roles.html" },
      { key: "applications", label: "Applications", href: "/app/pages/client/applications.html" },
      { key: "shortlists", label: "Shortlists", href: "/app/pages/client/shortlists.html" },
      { key: "invites", label: "Invites", href: "/app/pages/client/invites.html" },
      { key: "bookings", label: "Bookings", href: "/app/pages/client/bookings.html" },
      { key: "pipeline", label: "Pipeline", href: "/app/pages/client/pipeline.html" }
    ]
  });
}
