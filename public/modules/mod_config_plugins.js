export default function(Orland){
  return {
    title: "config_plugins",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white/5 border border-white/10 rounded-xl p-4">
          <div class="text-sm font-bold mb-1">Module placeholder: config_plugins</div>
          <div class="text-xs opacity-70">Create real UI in <code>public/modules/mod_config_plugins.js</code></div>
        </div>`;
    }
  };
}
