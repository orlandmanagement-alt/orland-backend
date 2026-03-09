export default function(Orland){
  return {
    title: "User Manager",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="text-sm font-bold">User Manager</div>
          <div class="text-xs opacity-70 mt-1">Redirecting to Admin Users...</div>
        </div>
      `;
      setTimeout(()=> Orland.navigate("/users/admin", true), 50);
    }
  };
}
