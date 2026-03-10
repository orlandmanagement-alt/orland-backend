export default function(){
  return {
    title: "Talent Invites",
    async mount(host){
      host.innerHTML = `
        <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
          <div class="text-2xl font-extrabold">Talent Invites</div>
          <div class="text-slate-500 mt-2">Placeholder module. Hubungkan ke endpoint invites talent jika backend sudah siap.</div>
        </div>
      `;
    }
  };
}
