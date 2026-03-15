import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";
import { ensureInviteTables, getInviteLinkDetail, makeToken } from "./_invite_common.js";

function canManage(a){
  return hasRole(a.roles, ["super_admin","admin","staff","client"]);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403, "forbidden", null);

  await ensureInviteTables(env);

  const url = new URL(request.url);
  const project_role_id = String(url.searchParams.get("project_role_id") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();

  const r = await env.DB.prepare(`
    SELECT
      l.id, l.project_role_id, l.token, l.status, l.title, l.message, l.role_label,
      l.require_approval, l.auto_create_user, l.max_uses, l.used_count, l.expires_at,
      l.created_by_user_id, l.created_at, l.updated_at,
      pr.role_name, pr.project_id,
      p.title AS project_title
    FROM project_invite_links l
    JOIN project_roles pr ON pr.id = l.project_role_id
    JOIN projects p ON p.id = pr.project_id
    WHERE (? = '' OR l.project_role_id = ?)
      AND (? = '' OR l.status = ?)
    ORDER BY l.created_at DESC
  `).bind(project_role_id, project_role_id, status, status).all();

  return json(200, "ok", { items: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403, "forbidden", null);

  await ensureInviteTables(env);

  const body = await readJson(request) || {};
  const project_role_id = String(body.project_role_id || "").trim();
  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const role_label = String(body.role_label || "").trim();
  const require_approval = body.require_approval ? 1 : 0;
  const auto_create_user = body.auto_create_user === false ? 0 : 1;
  const max_uses = Math.max(1, Number(body.max_uses || 1));
  const expires_at = body.expires_at ? Number(body.expires_at) : null;

  if(!project_role_id) return json(400, "invalid_input", { message: "project_role_id" });

  const roleRow = await env.DB.prepare(`
    SELECT pr.id, pr.role_name, p.title AS project_title
    FROM project_roles pr
    JOIN projects p ON p.id = pr.project_id
    WHERE pr.id=?
    LIMIT 1
  `).bind(project_role_id).first();

  if(!roleRow) return json(404, "not_found", { message: "project_role_not_found" });

  const now = nowSec();
  const id = crypto.randomUUID();
  const token = makeToken();

  await env.DB.prepare(`
    INSERT INTO project_invite_links (
      id, project_role_id, token, status, title, message, role_label,
      require_approval, auto_create_user, max_uses, used_count, expires_at,
      created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).bind(
    id,
    project_role_id,
    token,
    title || null,
    message || null,
    role_label || null,
    require_approval,
    auto_create_user,
    max_uses,
    expires_at,
    a.uid || null,
    now,
    now
  ).run();

  const detail = await getInviteLinkDetail(env, token);

  return json(200, "ok", {
    created: true,
    invite_link_id: id,
    token,
    invite_url: "/project-invite?token=" + token,
    detail
  });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403, "forbidden", null);

  await ensureInviteTables(env);

  const body = await readJson(request) || {};
  const action = String(body.action || "").trim();
  const id = String(body.id || "").trim();
  if(!id) return json(400, "invalid_input", { message: "id" });

  const now = nowSec();

  if(action === "revoke"){
    await env.DB.prepare(`
      UPDATE project_invite_links
      SET status='revoked', updated_at=?
      WHERE id=?
    `).bind(now, id).run();

    return json(200, "ok", { revoked: true });
  }

  if(action === "activate"){
    await env.DB.prepare(`
      UPDATE project_invite_links
      SET status='active', updated_at=?
      WHERE id=?
    `).bind(now, id).run();

    return json(200, "ok", { activated: true });
  }

  return json(400, "invalid_input", { message: "unknown_action" });
}
