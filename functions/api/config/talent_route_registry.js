import { json, requireAuth } from "../../_lib.js";

function canAccessTalent(roles){
  const set = new Set((roles || []).map(String));
  return set.has("talent") || set.has("super_admin") || set.has("admin") || set.has("staff");
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessTalent(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  return json(200, "ok", {
    items: [
      { key: "dashboard", label: "Dashboard", href: "/app/pages/talent/index.html" },
      { key: "profile", label: "Profile", href: "/app/pages/talent/profile.html" },
      { key: "projects", label: "Projects", href: "/app/pages/talent/projects.html" },
      { key: "project_apply", label: "Apply Project", href: "/app/pages/talent/project-apply.html" },
      { key: "applications", label: "Applications", href: "/app/pages/talent/applications.html" },
      { key: "invites", label: "Invites", href: "/app/pages/talent/invites.html" },
      { key: "invite_detail", label: "Invite Detail", href: "/app/pages/talent/invite-detail.html" },
      { key: "invite_respond", label: "Respond Invite", href: "/app/pages/talent/invite-respond.html" },
      { key: "bookings", label: "Bookings", href: "/app/pages/talent/bookings.html" }
    ]
  });
}
