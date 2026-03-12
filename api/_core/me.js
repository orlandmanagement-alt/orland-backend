import { json, requireAuth } from "../../_lib.js";
import { getEffectiveVerificationState } from "../config/_global_policy.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const user = a.user || null;
  if(!user){
    return json(401, "unauthorized", null);
  }

  const state = await getEffectiveVerificationState(env, user, a.roles || []);

  return json(200, "ok", {
    ...user,
    roles: a.roles || [],
    verification_policy: state?.effective || null,
    verification_summary: state?.summary || null,
    verification_compliance: state?.compliance || null
  });
}
