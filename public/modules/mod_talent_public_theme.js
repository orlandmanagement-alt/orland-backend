import { api, esc, ensureBaseStyles, mountNode } from "./_admin_common.js";

export default function(){
  return {
    title:"Talent Public Theme",
    async mount(root){
      ensureBaseStyles();
      const host = mountNode(root);

      function q(name){
        const u = new URL(location.href);
        return String(u.searchParams.get(name) || "").trim();
      }

      function mediaUrl(storageKey){
        return storageKey ? "/cdn-cgi/image/fit=cover,width=720,height=960/" + storageKey : "";
      }

      function maybeYoutubeEmbed(url){
        try{
          const u = new URL(url);
          if(u.hostname.includes("youtu.be")) return "https://www.youtube.com/embed/" + u.pathname.replace("/", "");
          if(u.hostname.includes("youtube.com")){
            const v = u.searchParams.get("v");
            if(v) return "https://www.youtube.com/embed/" + v;
          }
        }catch{}
        return "";
      }

      function socialValue(items, name){
        const row = (items || []).find(x => String(x.platform || "").toLowerCase() === String(name).toLowerCase());
        return row ? String(row.url || "") : "";
      }

      function openImagePopup(src){
        const m = document.getElementById("tv_media_modal");
        const img = document.getElementById("tv_media_img");
        const yt = document.getElementById("tv_media_yt");
        yt.hidden = true;
        yt.src = "";
        img.hidden = false;
        img.src = src || "";
        m.hidden = false;
      }

      function openYoutubePopup(url){
        const embed = maybeYoutubeEmbed(url);
        if(!embed) return;
        const m = document.getElementById("tv_media_modal");
        const img = document.getElementById("tv_media_img");
        const yt = document.getElementById("tv_media_yt");
        img.hidden = true;
        img.src = "";
        yt.hidden = false;
        yt.src = embed;
        m.hidden = false;
      }

      function renderProfile(data){
        const p = data.profile || {};
        const photos = data.photos || [];
        const socials = data.socials || [];
        const skills = data.skills || [];
        const interests = data.interests || [];
        const credits = data.credits || [];

        const primary = photos[0] || null;
        const side = photos[1] || null;
        const full = photos[2] || null;
        const additional = photos.slice(3);

        const youtubeUrl = socialValue(socials, "youtube");
        const instagramUrl = socialValue(socials, "instagram");
        const tiktokUrl = socialValue(socials, "tiktok");
        const websiteUrl = socialValue(socials, "website");

        const completion = Number(p.completion_percent || 0);
        const compcardEnabled = completion >= 70 && !!primary && !!p.display_name;

        host.innerHTML = `
          <style>
            .tv-wrap{max-width:1100px;margin:0 auto;padding:18px 14px 40px;background:#f4f6fb;color:#111827}
            .tv-alert{display:flex;gap:10px;align-items:center;background:#eef2ff;color:#3730a3;border:1px solid rgba(55,48,163,.14);padding:10px 12px;border-radius:12px;font-size:13px;margin-bottom:14px}
            .tv-grid{display:grid;grid-template-columns:320px 1fr;gap:16px;align-items:start}
            .tv-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 10px 30px rgba(17,24,39,.08)}
            .tv-side,.tv-main{padding:14px}
            .tv-title{font-size:28px;line-height:1.1;letter-spacing:-.02em;margin:0}
            .tv-sub{display:flex;gap:10px;align-items:center;margin-top:8px;color:#6b7280;font-size:13px;flex-wrap:wrap}
            .tv-rating{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-weight:700}
            .tv-star{width:14px;height:14px;display:inline-block;background:conic-gradient(from 0deg,#fbbf24,#f59e0b,#fbbf24);clip-path:polygon(50% 0%,62% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,38% 35%)}
            .tv-photo{width:100%;aspect-ratio:4/5;border-radius:16px;overflow:hidden;background:#f8fafc;border:1px solid #e2e8f0}
            .tv-photo img{width:100%;height:100%;object-fit:cover;display:block}
            .tv-mini-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
            .tv-mini{border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}
            .tv-mini .ph{aspect-ratio:4/3;background:#f8fafc}
            .tv-mini img{width:100%;height:100%;object-fit:cover;display:block}
            .tv-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;padding:10px 12px;border-radius:12px;cursor:pointer;background:#2563eb;color:#fff;font-weight:600;font-size:13px}
            .tv-btn.ghost{background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0}
            .tv-btn[disabled]{opacity:.55;cursor:not-allowed}
            .tv-section{margin-top:14px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;overflow:hidden}
            .tv-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
            .tv-head .label{font-weight:900;letter-spacing:.06em;font-size:12px;color:#374151}
            .tv-body{padding:12px;font-size:14px;color:#6b7280}
            .tv-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
            .tv-field{border:1px solid #eef2f7;border-radius:12px;padding:10px;background:#fff}
            .tv-field .k{font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:800}
            .tv-field .v{font-size:14px;color:#0f172a;font-weight:900}
            .tv-chips{display:flex;flex-wrap:wrap;gap:8px}
            .tv-chip{background:#eef2ff;border:1px solid #e0e7ff;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:900;color:#111827}
            .tv-social{display:grid;gap:10px}
            .tv-social-row{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid #eef2f7;border-radius:12px;padding:8px 10px;background:#fbfdff;font-size:13px}
            .tv-social-row a{color:#2563eb;font-weight:900;word-break:break-all;text-align:right;text-decoration:none}
            .tv-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
            .tv-gallery-item{border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff;cursor:pointer}
            .tv-gallery-item img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block}
            .tv-credit{border:1px solid #e5e7eb;border-radius:14px;padding:14px;background:#fff}
            .tv-credit + .tv-credit{margin-top:10px}
            .tv-credit-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
            .tv-credit-top b{font-size:15px;color:#111827}
            .tv-credit-meta{color:#6b7280;font-size:12px;font-weight:900;margin-top:4px}
            .tv-credit-about{margin-top:8px;color:#374151;font-size:13px;line-height:1.5}
            .tv-empty{padding:18px;text-align:center;color:#6b7280;border:1px dashed #cbd5e1;border-radius:14px;background:#fafafa}
            .tv-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55)}
            .tv-modal-card{background:#fff;border-radius:16px;max-width:900px;width:100%;padding:12px}
            .tv-modal-card img,.tv-modal-card iframe{width:100%;max-height:80vh;object-fit:contain;border:0;border-radius:12px}
            @media (max-width:900px){.tv-grid{grid-template-columns:1fr}}
            @media (max-width:640px){.tv-two,.tv-gallery{grid-template-columns:1fr}}
          </style>

          <div class="tv-wrap">
            <div class="tv-alert">
              <div><strong>Contact via Orland Management.</strong> Talent contact dibatasi sesuai kebijakan kontrak dan privasi.</div>
            </div>

            <div class="tv-grid">
              <aside class="tv-card tv-side">
                <div class="tv-photo">
                  ${primary ? `<img src="${esc(mediaUrl(primary.storage_key || ""))}" alt="Primary Photo" loading="lazy" decoding="async">` : `<div class="tv-empty" style="height:100%">No photo</div>`}
                </div>

                <div class="tv-mini-row">
                  <div class="tv-mini">
                    <div class="ph">
                      ${side ? `<img src="${esc(mediaUrl(side.storage_key || ""))}" alt="Side Photo" loading="lazy" decoding="async">` : `<div class="tv-empty" style="height:100%">No photo</div>`}
                    </div>
                  </div>
                  <div class="tv-mini">
                    <div class="ph">
                      ${full ? `<img src="${esc(mediaUrl(full.storage_key || ""))}" alt="Full Photo" loading="lazy" decoding="async">` : `<div class="tv-empty" style="height:100%">No photo</div>`}
                    </div>
                  </div>
                </div>

                <div style="margin-top:12px">
                  <button class="tv-btn ghost" ${compcardEnabled ? "" : "disabled"} id="tv_compcard_btn">
                    ⬇️ ${compcardEnabled ? "Comp Card Ready" : "Comp Card Locked"}
                  </button>
                </div>

                <div class="tv-section">
                  <div class="tv-head"><div class="label">CONTACT</div></div>
                  <div class="tv-body">
                    <div class="tv-two">
                      <div class="tv-field"><div class="k">Phone</div><div class="v">${esc(p.phone || "-")}</div></div>
                      <div class="tv-field"><div class="k">Email</div><div class="v">${esc(p.email_norm || "-")}</div></div>
                    </div>
                  </div>
                </div>

                <div class="tv-section">
                  <div class="tv-head"><div class="label">SOCIAL</div></div>
                  <div class="tv-body">
                    <div class="tv-social">
                      ${instagramUrl ? `<div class="tv-social-row"><span>Instagram</span><a href="${esc(instagramUrl)}" target="_blank" rel="noopener">Open</a></div>` : ""}
                      ${tiktokUrl ? `<div class="tv-social-row"><span>TikTok</span><a href="${esc(tiktokUrl)}" target="_blank" rel="noopener">Open</a></div>` : ""}
                      ${websiteUrl ? `<div class="tv-social-row"><span>Website</span><a href="${esc(websiteUrl)}" target="_blank" rel="noopener">Open</a></div>` : ""}
                      ${youtubeUrl ? `<div class="tv-social-row"><span>YouTube</span><button type="button" class="tv-btn ghost" style="width:auto" id="tv_open_yt">Preview</button></div>` : ""}
                      ${!instagramUrl && !tiktokUrl && !websiteUrl && !youtubeUrl ? `<div class="tv-empty">No social links.</div>` : ""}
                    </div>
                  </div>
                </div>
              </aside>

              <main class="tv-card tv-main">
                <h1 class="tv-title">${esc(p.display_name || "Talent Profile")}</h1>
                <div class="tv-sub">
                  <span class="tv-rating"><span class="tv-star"></span> ${esc(String(p.completion_percent || 0))}</span>
                  <span>/ 100</span>
                  ${p.public_slug ? `<span>Slug: ${esc(p.public_slug)}</span>` : ""}
                </div>

                <div class="tv-section">
                  <div class="tv-head"><div class="label">PERSONAL</div></div>
                  <div class="tv-body">
                    <div class="tv-two">
                      <div class="tv-field"><div class="k">Gender</div><div class="v">${esc(p.gender || "-")}</div></div>
                      <div class="tv-field"><div class="k">Date Of Birth</div><div class="v">${esc(p.dob || "-")}</div></div>
                      <div class="tv-field"><div class="k">Location</div><div class="v">${esc(p.location || "-")}</div></div>
                      <div class="tv-field"><div class="k">Website</div><div class="v">${esc(p.website || "-")}</div></div>
                    </div>
                  </div>
                </div>

                <div class="tv-section">
                  <div class="tv-head"><div class="label">APPEARANCE</div></div>
                  <div class="tv-body">
                    <div class="tv-two">
                      <div class="tv-field"><div class="k">Height</div><div class="v">${esc(p.height_cm || "-")}</div></div>
                      <div class="tv-field"><div class="k">Weight</div><div class="v">${esc(p.weight_kg || "-")}</div></div>
                      <div class="tv-field"><div class="k">Eye Color</div><div class="v">${esc(p.eye_color || "-")}</div></div>
                      <div class="tv-field"><div class="k">Hair Color</div><div class="v">${esc(p.hair_color || "-")}</div></div>
                    </div>
                  </div>
                </div>

                <div class="tv-section">
                  <div class="tv-head"><div class="label">INTERESTS</div></div>
                  <div class="tv-body">
                    ${interests.length ? `<div class="tv-chips">${interests.map(x => `<span class="tv-chip">${esc(x)}</span>`).join("")}</div>` : `<div class="tv-empty">No interests.</div>`}
                  </div>
                </div>

                <div class="tv-section">
                  <div class="tv-head"><div class="label">SKILLS</div></div>
                  <div class="tv-body">
                    ${skills.length ? `<div class="tv-chips">${skills.map(x => `<span class="tv-chip">${esc(x)}</span>`).join("")}</div>` : `<div class="tv-empty">No skills.</div>`}
                  </div>
                </div>

                <div class="tv-section">
                  <div class="tv-head"><div class="label">PHOTOS</div></div>
                  <div class="tv-body">
                    ${additional.length ? `
                      <div class="tv-gallery">
                        ${additional.map(x => `<div class="tv-gallery-item" data-img="${esc(mediaUrl(x.storage_key || ""))}"><img src="${esc(mediaUrl(x.storage_key || ""))}" loading="lazy" decoding="async" alt="photo"></div>`).join("")}
                      </div>
                    ` : `<div class="tv-empty">No additional photos.</div>`}
                  </div>
                </div>

                <div class="tv-section">
                  <div class="tv-head"><div class="label">CREDITS / EXPERIENCE</div></div>
                  <div class="tv-body">
                    ${credits.length ? credits.map(c => `
                      <div class="tv-credit">
                        <div class="tv-credit-top">
                          <b>${esc(c.title || "-")}</b>
                          <div>${esc(((c.credit_month || "") + " " + (c.credit_year || "")).trim() || "-")}</div>
                        </div>
                        <div class="tv-credit-meta">${esc(c.company || "-")}</div>
                        <div class="tv-credit-about">${esc(c.about || "-")}</div>
                      </div>
                    `).join("") : `<div class="tv-empty">No credits yet.</div>`}
                  </div>
                </div>
              </main>
            </div>
          </div>

          <div id="tv_media_modal" class="tv-modal" hidden>
            <div class="tv-modal-card">
              <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                <button type="button" class="tv-btn ghost" style="width:auto" id="tv_close_media">Close</button>
              </div>
              <img id="tv_media_img" alt="preview">
              <iframe id="tv_media_yt" hidden allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
          </div>
        `;

        host.querySelectorAll("[data-img]").forEach(el => {
          el.onclick = () => openImagePopup(el.getAttribute("data-img"));
        });

        if(primary){
          const main = host.querySelector(".tv-photo");
          if(main) main.onclick = () => openImagePopup(mediaUrl(primary.storage_key || ""));
        }
        if(side){
          const el = host.querySelectorAll(".tv-mini .ph")[0];
          if(el) el.onclick = () => openImagePopup(mediaUrl(side.storage_key || ""));
        }
        if(full){
          const el = host.querySelectorAll(".tv-mini .ph")[1];
          if(el) el.onclick = () => openImagePopup(mediaUrl(full.storage_key || ""));
        }

        const ytBtn = document.getElementById("tv_open_yt");
        if(ytBtn) ytBtn.onclick = () => openYoutubePopup(youtubeUrl);

        document.getElementById("tv_close_media").onclick = () => {
          const m = document.getElementById("tv_media_modal");
          const yt = document.getElementById("tv_media_yt");
          const img = document.getElementById("tv_media_img");
          yt.src = "";
          img.src = "";
          m.hidden = true;
        };

        document.getElementById("tv_compcard_btn").onclick = () => {
          if(!compcardEnabled) return;
          alert("Comp Card theme/download menyusul. Tombol sudah aktif karena profile memenuhi syarat.");
        };
      }

      async function init(){
        const slug = q("slug");
        const user_id = q("user_id");

        if(!slug && !user_id){
          host.innerHTML = '<div class="oa-wrap"><div class="oa-empty">slug atau user_id wajib diisi.</div></div>';
          return;
        }

        const qs = slug ? ("slug=" + encodeURIComponent(slug)) : ("user_id=" + encodeURIComponent(user_id));
        const data = await api("/api/talent/public-profile?" + qs);
        renderProfile(data);
      }

      init().catch(err => {
        host.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat public theme: ' + esc(err.message) + '</div></div>';
      });
    }
  };
}
