const POLICY_KEY = "protected_menu_policy_v1";

function uniqStrings(arr){
  return Array.from(new Set((Array.isArray(arr) ? arr : []).map(x => String(x || "").trim()).filter(Boolean)));
}

function defaultPolicy(){
  return {
    enabled: 1,
    protected_menu_ids: [],
    protected_paths: [],
    deny_delete: 1,
    deny_path_change: 1,
    deny_parent_change: 1,
    deny_group_change: 1
  };
}

function normalizePolicy(v){
  const src = v && typeof v === "object" ? v : {};
  const d = defaultPolicy();
  return {
    enabled: src.enabled ? 1 : 0,
    protected_menu_ids: uniqStrings(src.protected_menu_ids ?? d.protected_menu_ids),
    protected_paths: uniqStrings(src.protected_paths ?? d.protected_paths),
    deny_delete: src.deny_delete ? 1 : 0,
    deny_path_change: src.deny_path_change ? 1 : 0,
    deny_parent_change: src.deny_parent_change ? 1 : 0,
    deny_group_change: src.deny_group_change ? 1 : 0
  };
}

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/, "");
  return p || "/";
}

export async function readProtectedMenuPolicy(env){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k = ?
    LIMIT 1
  `).bind(POLICY_KEY).first();

  if(!row?.v) return defaultPolicy();

  try{
    return normalizePolicy(JSON.parse(row.v));
  }catch{
    return defaultPolicy();
  }
}

export function isProtectedMenu(policy, rowOrDraft){
  const p = normalizePolicy(policy);
  if(!p.enabled) return false;

  const id = String(rowOrDraft?.id || "").trim();
  const path = normPath(rowOrDraft?.path || "/");

  return p.protected_menu_ids.includes(id) || p.protected_paths.includes(path);
}

export function evaluateProtectedMenuMutation(policy, originalRow, draft, action){
  const p = normalizePolicy(policy);
  const act = String(action || "").trim().toLowerCase();

  if(!p.enabled) return { ok:true };

  const originalProtected = isProtectedMenu(p, originalRow || {});
  const draftProtected = isProtectedMenu(p, draft || {});
  const protectedHit = originalProtected || draftProtected;

  if(!protectedHit){
    return { ok:true };
  }

  if(act === "delete" && p.deny_delete){
    return {
      ok:false,
      code:"protected_menu_delete_denied",
      message:"Menu protected tidak boleh dihapus."
    };
  }

  if((act === "update" || act === "create") && originalRow){
    const oldPath = normPath(originalRow.path || "/");
    const newPath = normPath(draft?.path || "/");
    const oldParent = String(originalRow.parent_id || "");
    const newParent = String(draft?.parent_id || "");
    const oldGroup = String(originalRow.group_key || "");
    const newGroup = String(draft?.group_key || "");

    if(p.deny_path_change && oldPath !== newPath){
      return {
        ok:false,
        code:"protected_menu_path_change_denied",
        message:"Path menu protected tidak boleh diubah."
      };
    }

    if(p.deny_parent_change && oldParent !== newParent){
      return {
        ok:false,
        code:"protected_menu_parent_change_denied",
        message:"Parent menu protected tidak boleh diubah."
      };
    }

    if(p.deny_group_change && oldGroup !== newGroup){
      return {
        ok:false,
        code:"protected_menu_group_change_denied",
        message:"Group menu protected tidak boleh diubah."
      };
    }
  }

  return { ok:true };
}
