import { json, requireAuth } from "../_lib.js";
import { getEffectiveVerificationState } from "./config/_global_policy.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const state = await getEffectiveVerificationState(env, a.user, a.roles || []);

  return json(200, "ok", {
    ...a.user,
    roles: a.roles || [],
    verification_policy: state.effective,
    verification_summary: state.summary,
    verification_compliance: state.compliance
  });
}
