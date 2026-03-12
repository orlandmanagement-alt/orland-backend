import { requireBlogspotAccess } from "./_service.js";

export function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers, rows){
  const out = [];
  out.push(headers.map(csvEscape).join(","));
  for(const row of rows){
    out.push(headers.map(h => csvEscape(row?.[h] ?? "")).join(","));
  }
  return out.join("\n");
}

export function parseRange(request){
  const url = new URL(request.url);
  const from = Number(url.searchParams.get("from") || "0");
  const to = Number(url.searchParams.get("to") || "0");
  return {
    from: Number.isFinite(from) && from > 0 ? from : 0,
    to: Number.isFinite(to) && to > 0 ? to : 0
  };
}

export function asJson(data, fileName = "evidence.json"){
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${fileName}"`
    }
  });
}

export function asCsv(csv, fileName = "evidence.csv"){
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${fileName}"`
    }
  });
}

export async function requireEvidenceAccess(env, request){
  return await requireBlogspotAccess(env, request, true);
}

export async function countOne(env, sql, ...binds){
  const row = await env.DB.prepare(sql).bind(...binds).first();
  return Number(row?.total || 0);
}

export function whereCreatedAt(range, column = "created_at"){
  const wh = [];
  const binds = [];
  if(range.from > 0){
    wh.push(`${column} >= ?`);
    binds.push(range.from);
  }
  if(range.to > 0){
    wh.push(`${column} <= ?`);
    binds.push(range.to);
  }
  return {
    sql: wh.length ? ` WHERE ${wh.join(" AND ")}` : "",
    binds
  };
}
