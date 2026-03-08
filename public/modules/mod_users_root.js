export default function(Orland){
  return {
    title: "User Manager",
    async mount(host){
      host.innerHTML = `<div class="text-xs text-slate-500">Redirecting…</div>`;
      // prefer /users/admin
      await Orland.navigate("/users/admin", true);
    }
  };
}
