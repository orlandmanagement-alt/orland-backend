export function buildAdminExportUrl(basePath, params = {}){
  const url = new URL(basePath, location.origin);

  Object.entries(params || {}).forEach(([k, v]) => {
    if(v == null) return;
    const s = String(v).trim();
    if(!s) return;
    url.searchParams.set(k, s);
  });

  return url.toString();
}

export function triggerAdminCsvExport(basePath, params = {}){
  const url = buildAdminExportUrl(basePath, params);
  window.location.href = url;
}
