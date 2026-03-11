export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  async function load(){ return await Orland.api("/api/blogspot/widgets"); }

  return {
    title:"Blogspot Widgets / Home",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xl font-extrabold text-slate-900 dark:text-white">Blogspot Widgets / Home</div>
              <div class="text-sm text-slate-500">Fallback home data dari Blogger API.</div>
            </div>
            <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder">Reload</button>
          </div>
          <div id="box" class="space-y-4"></div>
        </div>
      `;

      const box = host.querySelector("#box");

      async function render(){
        box.innerHTML = "Loading...";
        const r = await load();
        if(r.status!=="ok"){
          box.innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r,null,2))}</pre>`;
          return;
        }

        const d = r.data || {};
        const blog = d.blog || {};
        const posts = d.recent_posts || [];
        const pages = d.recent_pages || [];

        box.innerHTML = `
          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <div class="text-sm font-extrabold">${esc(blog.name || "Blog")}</div>
            <div class="text-[11px] text-slate-500 mt-1">${esc(blog.url || "")}</div>
            <div class="text-[11px] text-slate-500 mt-1">${esc(d.note || "")}</div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
              <div class="text-sm font-extrabold">Recent Posts</div>
              <div class="mt-3 space-y-2">
                ${posts.map(x=>`<div class="text-xs"><a class="text-primary" href="${esc(x.url||"#")}" target="_blank">${esc(x.title||"Untitled")}</a></div>`).join("") || `<div class="text-xs text-slate-500">No posts.</div>`}
              </div>
            </div>
            <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
              <div class="text-sm font-extrabold">Recent Pages</div>
              <div class="mt-3 space-y-2">
                ${pages.map(x=>`<div class="text-xs"><a class="text-primary" href="${esc(x.url||"#")}" target="_blank">${esc(x.title||"Untitled")}</a></div>`).join("") || `<div class="text-xs text-slate-500">No pages.</div>`}
              </div>
            </div>
          </div>
        `;
      }

      host.querySelector("#btnReload").onclick = render;
      await render();
    }
  };
}
