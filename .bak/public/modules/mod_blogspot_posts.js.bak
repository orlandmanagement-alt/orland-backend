export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  async function load(){ return await Orland.api("/api/blogspot/posts?maxResults=10"); }

  return {
    title:"Blogspot Posts",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xl font-extrabold text-slate-900 dark:text-white">Blogspot Posts</div>
              <div class="text-sm text-slate-500">Read-only list dari Blogger API.</div>
            </div>
            <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder">Reload</button>
          </div>
          <div id="box" class="space-y-3"></div>
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
        const items = r.data?.items || [];
        if(!items.length){
          box.innerHTML = `<div class="text-xs text-slate-500">No posts.</div>`;
          return;
        }
        box.innerHTML = items.map(x=>`
          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <div class="text-sm font-extrabold">${esc(x.title || "Untitled")}</div>
            <div class="text-[11px] text-slate-500 mt-1">${esc(x.url || "")}</div>
            <div class="text-[11px] text-slate-500 mt-1">Published: ${esc(x.published || "")}</div>
          </div>
        `).join("");
      }

      host.querySelector("#btnReload").onclick = render;
      await render();
    }
  };
}
