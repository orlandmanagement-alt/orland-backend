import {
  json,
  requireAuth
} from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);

  if(!a.ok){
    return json(401, "unauthorized", {
      message: "session_invalid"
    });
  }

  return json(200, "ok", {
    user_id: a.uid,
    roles: a.roles || [],
    session_id: a.sid
  });
}
