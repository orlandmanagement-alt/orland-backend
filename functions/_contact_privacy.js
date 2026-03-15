import { hasRole } from "./_lib.js";

export function canViewFullTalentContact(roles){
  return hasRole(roles, ["super_admin", "admin", "staff"]);
}

export function maskPhone(v){
  const s = String(v || "").replace(/\D/g, "");
  if(!s) return "";
  if(s.length <= 2) return s;
  if(s.length <= 7) return s.slice(0, 2) + "x-xxxx";
  return s.slice(0, s.length - 5) + "x-xxxx";
}

export function maskEmail(v){
  const s = String(v || "").trim();
  const at = s.indexOf("@");
  if(at <= 0) return s;

  const local = s.slice(0, at);
  const domain = s.slice(at);

  if(local.length <= 2){
    return local[0] ? local[0] + "xxx" + domain : "xxx" + domain;
  }

  if(local.length <= 5){
    const first = local.slice(0, Math.min(3, local.length));
    const last = local.length > 3 ? local.slice(-1) : "";
    return first + "xxx" + last + domain;
  }

  const first = local.slice(0, 3);
  const last = local.slice(-2);
  return first + "xxx" + last + domain;
}

export function applyTalentContactPrivacy(row, roles){
  if(!row) return row;
  if(canViewFullTalentContact(roles)) return row;

  return {
    ...row,
    email_norm: row.email_norm ? maskEmail(row.email_norm) : row.email_norm,
    phone: row.phone ? maskPhone(row.phone) : row.phone,
    phone_e164: row.phone_e164 ? maskPhone(row.phone_e164) : row.phone_e164,
    private_contact: true
  };
}
