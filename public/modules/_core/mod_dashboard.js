export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  function fmtNum(n){
    try{ return new Intl.NumberFormat("id-ID").format(Number(n || 0)); }
    catch{ return String(n || 0); }
  }

  function fmtBytes(n){
    n = Number(n || 0);
    if(n < 1024) return n + " B";
    if(n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if(n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
    return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }

  async function loadOverview(days=7){
    return await Orland.api("/api/analytics/overview?days=" + encodeURIComponent(days));
  }

  async function loadVisitors(days=7){
    return await Orland.api("/api/analytics/visitors?days=" + encodeURIComponent(days));
  }

  async function loadTopPages(){
    return await Orland.api("/api/analytics/top-pages");
  }

  async function loadTopCountries(){
    return await Orland.api("/api/analytics/top-countries");
  }

  function sumOverview(items){
    let requests = 0;
    let pageViews = 0;
    let bytes = 0;
    let cachedRequests = 0;

    for(const row of (items || [])){
      const s = row?.sum || {};
      requests += Number(s.requests || 0);
      pageViews += Number(s.pageViews || 0);
      bytes += Number(s.bytes || 0);
      cachedRequests += Number(s.cachedRequests || 0);
    }

    return { requests, pageViews, bytes, cachedRequests };
  }

  function sumVisitors(items){
    let uniques = 0;
    for(const row of (items || [])){
      uniques += Number(row?.uniq?.uniques || 0);
    }
    return uniques;
  }

  function renderMiniBars(items, key = "requests"){
    if(!items.length){
      return `<div class="text-sm text-slate-500">No visitor data.</div>`;
    }

    const vals = items.map(x => {
      if(key === "visitors") return Number(x?.uniq?.uniques || 0);
      return Number(x?.sum?.requests || 0);
    });

    const max = Math.max(...vals, 1);

    return `
      <div class="space-y-3">
        ${items.slice().reverse().map(row => {
          const d = row?.dimensions?.date || "-";
          const v = key === "visitors"
            ? Number(row?.uniq?.uniques || 0)
            : Number(row?.sum?.requests || 0);
          const w = Math.max(4, Math.round((v / max) * 100));
          return `
            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-slate-500">${esc(d)}</span>
                <span class="font-bold">${fmtNum(v)}</span>
              </div>
              <div class="h-2 rounded-full bg-slate-100 dark:bg-black/20 overflow-hidden">
                <div class="h-2 rounded-full bg-primary" style="width:${w}%"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderSimpleTable(items, kind){
    if(!items.length){
      return `<div class="text-sm text-slate-500">No data.</div>`;
    }

    return `
      <div class="space-y-2">
        ${items.map((row, i) => {
          let label = "-";
          if(kind === "pages") label = row?.dimensions?.clientRequestPath || "/";
          if(kind === "countries") label = row?.dimensions?.clientCountryName || "Unknown";
          const req = Number(row?.sum?.requests || 0);

          return `
            <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-3 py-3">
              <div class="min-w-0">
                <div class="text-xs text-slate-500">#${i + 1}</div>
                <div class="text-sm font-bold truncate">${esc(label)}</div>
              </div>
              <div class="text-sm font-black shrink-0">${fmtNum(req)}</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function emptyCards(){
    return {
      requests: "—",
      views: "—",
      bytes: "—",
      cached: "—",
      visitors: "—"
    };
  }

  return {
    title:"Dashboard",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold">Dashboard</div>
              <div class="text-slate-500 mt-1">Cloudflare visitor analytics overview.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <select id="days" class="px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter font-bold text-sm">
                <option value="7" selected>7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
              <button id="btnReload" class="px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">Reload</button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Requests</div>
              <div id="kRequests" class="text-2xl font-extrabold mt-2">—</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Page Views</div>
              <div id="kViews" class="text-2xl font-extrabold mt-2">—</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Visitors</div>
              <div id="kVisitors" class="text-2xl font-extrabold mt-2">—</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Bandwidth</div>
              <div id="kBytes" class="text-2xl font-extrabold mt-2">—</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Cached Requests</div>
              <div id="kCached" class="text-2xl font-extrabold mt-2">—</div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div class="xl:col-span-1 rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Requests Chart</div>
              <div class="text-slate-500 text-sm mt-1">Requests per day</div>
              <div id="chartBox" class="mt-5"></div>
            </div>

            <div class="xl:col-span-1 rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Visitors Chart</div>
              <div class="text-slate-500 text-sm mt-1">Unique visitors per day</div>
              <div id="visitorsBox" class="mt-5"></div>
            </div>

            <div class="xl:col-span-1 rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Top Pages</div>
              <div class="text-slate-500 text-sm mt-1">Most requested paths</div>
              <div id="pagesBox" class="mt-5"></div>
            </div>

            <div class="xl:col-span-1 rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Top Countries</div>
              <div class="text-slate-500 text-sm mt-1">Traffic by country</div>
              <div id="countriesBox" class="mt-5"></div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setCards(v){
        q("kRequests").textContent = v.requests;
        q("kViews").textContent = v.views;
        q("kVisitors").textContent = v.visitors;
        q("kBytes").textContent = v.bytes;
        q("kCached").textContent = v.cached;
      }

      async function render(){
        const days = Number(q("days").value || 7);
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Loading analytics...";

        setCards(emptyCards());
        q("chartBox").innerHTML = `<div class="text-sm text-slate-500">Loading...</div>`;
        q("visitorsBox").innerHTML = `<div class="text-sm text-slate-500">Loading...</div>`;
        q("pagesBox").innerHTML = `<div class="text-sm text-slate-500">Loading...</div>`;
        q("countriesBox").innerHTML = `<div class="text-sm text-slate-500">Loading...</div>`;

        const [overviewRes, visitorsRes, pagesRes, countriesRes] = await Promise.all([
          loadOverview(days),
          loadVisitors(days),
          loadTopPages(),
          loadTopCountries()
        ]);

        const ov = overviewRes.data || {};
        if(overviewRes.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Overview failed: " + overviewRes.status;
          return;
        }

        if(ov.enabled === false){
          q("msg").className = "text-sm text-amber-600";
          q("msg").textContent = "Analytics is disabled.";
          return;
        }

        if(ov.configured === false){
          q("msg").className = "text-sm text-amber-600";
          q("msg").textContent = "Analytics config is incomplete.";
          return;
        }

        if(ov.upstream_ok === false){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Cloudflare upstream failed: " + String(ov.message || ov.kind || "unknown");
          return;
        }

        const items = Array.isArray(ov.items) ? ov.items : [];
        const sums = sumOverview(items);

        const visitorItems = visitorsRes.status === "ok" && visitorsRes.data?.upstream_ok !== false
          ? (Array.isArray(visitorsRes.data?.items) ? visitorsRes.data.items : [])
          : [];

        setCards({
          requests: fmtNum(sums.requests),
          views: fmtNum(sums.pageViews),
          visitors: fmtNum(sumVisitors(visitorItems)),
          bytes: fmtBytes(sums.bytes),
          cached: fmtNum(sums.cachedRequests)
        });

        q("chartBox").innerHTML = renderMiniBars(items, "requests");
        q("visitorsBox").innerHTML = renderMiniBars(visitorItems, "visitors");

        const pageItems = pagesRes.status === "ok" && pagesRes.data?.upstream_ok !== false
          ? (Array.isArray(pagesRes.data?.items) ? pagesRes.data.items : [])
          : [];
        const countryItems = countriesRes.status === "ok" && countriesRes.data?.upstream_ok !== false
          ? (Array.isArray(countriesRes.data?.items) ? countriesRes.data.items : [])
          : [];

        q("pagesBox").innerHTML = renderSimpleTable(pageItems, "pages");
        q("countriesBox").innerHTML = renderSimpleTable(countryItems, "countries");

        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Loaded.";
      }

      q("btnReload").onclick = render;
      q("days").onchange = render;

      await render();
    }
  };
}
