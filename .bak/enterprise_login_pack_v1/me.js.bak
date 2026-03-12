import { json, requireAuth } from "../_lib.js";
import { getEffectiveVerificationState } from "./config/_global_policy.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const user = a.user || null;
  if(!user){
    return json(401, "unauthorized", null);
  }

  let state = {
    effective: null,
    summary: null,
    compliance: null
  };

  try{
    if(typeof getEffectiveVerificationState === "function"){
      state = await getEffectiveVerificationState(env, user, a.roles || []) || state;
    }
  }catch(err){
    return json(500, "server_error", {
      step: "getEffectiveVerificationState",
      message: String(err?.message || err)
    });
  }

  return json(200, "ok", {
    ...user,
    roles: a.roles || [],
    verification_policy: state?.effective || null,
    verification_summary: state?.summary || null,
    verification_compliance: state?.compliance || null
  });
}