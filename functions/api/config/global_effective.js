import { json, requireAuth, hasRole } from "../../_lib.js";
import { loadGlobalVerificationPolicy, resolveVerificationRules } from "./_global_policy.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin","admin","staff","client","talent"])){
    return json(403, "forbidden", null);
  }

  const policy = await loadGlobalVerificationPolicy(env);
  const effective = resolveVerificationRules(policy, a.roles || []);

  return json(200, "ok", {
    value: effective
  });
}
