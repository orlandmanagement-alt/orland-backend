import { api, esc, ensureBaseStyles, mountNode } from "./_admin_common.js";

export default function(){
  return {
    title:"Talent Profile Theme",
    async mount(root){
      ensureBaseStyles();
      const host = mountNode(root);
      const DRAFT_KEY = "orland_talent_profile_theme_draft_v1";
      let serverData = null;
      let draft = {};
      let statusState = "idle";
      let lastSavedAt = 0;

      function setStatus(type, text){
        statusState = type;
        const el = document.getElementById("tp_save_status");
        if(!el) return;
        el.setAttribute("data-state", type);
        el.textContent = text;
      }

      function saveDraftLocal(data){
        try{
          localStorage.setItem(DRAFT_KEY, JSON.stringify({
            updated_at: Date.now(),
            data
          }));
          setStatus("draft", "Draft lokal");
        }catch{}
      }

      function loadDraftLocal(){
        try{
          const raw = localStorage.getItem(DRAFT_KEY);
          if(!raw) return null;
          return JSON.parse(raw);
        }catch{
          return null;
        }
      }

      function clearDraftLocal(){
        try{ localStorage.removeItem(DRAFT_KEY); }catch{}
      }

      function mediaUrl(storageKey){
        return storageKey ? "/cdn-cgi/image/fit=cover,width=480,height=640/" + storageKey : "";
      }

      function getFormData(){
        const get = id => document.getElementById(id);
        const creditCards = Array.from(document.querySelectorAll(".tp-credit-item"));

        return {
          user: {
            display_name: (get("tp_display_name")?.value || "").trim()
          },
          profile: {
            display_name: (get("tp_display_name")?.value || "").trim(),
            public_slug: (get("tp_public_slug")?.value || "").trim(),
            visibility_status: (get("tp_visibility_status")?.value || "private").trim()
          },
          basic: {
            gender: (get("tp_gender")?.value || "").trim(),
            dob: (get("tp_dob")?.value || "").trim(),
            location: (get("tp_location")?.value || "").trim()
          },
          contact: {
            email: (get("tp_email")?.value || "").trim(),
            phone: (get("tp_phone")?.value || "").trim(),
            website: (get("tp_website")?.value || "").trim(),
            contact_visibility: (get("tp_contact_visibility")?.value || "private").trim()
          },
          appearance: {
            height_cm: (get("tp_height_cm")?.value || "").trim(),
            weight_kg: (get("tp_weight_kg")?.value || "").trim(),
            eye_color: (get("tp_eye_color")?.value || "").trim(),
            hair_color: (get("tp_hair_color")?.value || "").trim()
          },
          personal_extra: {
            ethnicity: (get("tp_ethnicity")?.value || "").trim()
          },
          appearance_extra: {
            hip: (get("tp_hip")?.value || "").trim(),
            chest: (get("tp_chest")?.value || "").trim(),
            bodytype: (get("tp_bodytype")?.value || "").trim(),
            tattoos: (get("tp_tattoos")?.value || "").trim(),
            piercings: (get("tp_piercings")?.value || "").trim(),
            specific: (get("tp_specific")?.value || "").trim()
          },
          skills: (get("tp_skills")?.value || "").split(",").map(x => x.trim()).filter(Boolean),
          interests: (get("tp_interests")?.value || "").split(",").map(x => x.trim()).filter(Boolean),
          socials: [
            { platform: "instagram", url: (get("tp_social_instagram")?.value || "").trim() },
            { platform: "tiktok", url: (get("tp_social_tiktok")?.value || "").trim() },
            { platform: "youtube", url: (get("tp_social_youtube")?.value || "").trim() },
            { platform: "website", url: (get("tp_social_website")?.value || "").trim() }
          ].filter(x => x.url),
          credits: creditCards.map(card => ({
            title: (card.querySelector('[data-k="title"]')?.value || "").trim(),
            company: (card.querySelector('[data-k="company"]')?.value || "").trim(),
            credit_month: (card.querySelector('[data-k="month"]')?.value || "").trim(),
            credit_year: (card.querySelector('[data-k="year"]')?.value || "").trim(),
            about: (card.querySelector('[data-k="about"]')?.value || "").trim()
          })).filter(x => x.title)
        };
      }

      function socialValue(items, name){
        const row = (items || []).find(x => String(x.platform || "").toLowerCase() === String(name).toLowerCase());
        return row ? String(row.url || "") : "";
      }

      function renderCredits(items){
        const box = document.getElementById("tp_credits_box");
        if(!box) return;
        box.innerHTML = "";

        (items || []).forEach((c) => {
          const row = document.createElement("div");
          row.className = "tp-credit-item";
          row.innerHTML = `
            <div class="tp-grid2">
              <div><label>Title</label><input data-k="title" value="${esc(c.title || "")}"></div>
              <div><label>Company</label><input data-k="company" value="${esc(c.company || "")}"></div>
              <div><label>Month</label><input data-k="month" value="${esc(c.credit_month || "")}"></div>
              <div><label>Year</label><input data-k="year" value="${esc(c.credit_year || "")}"></div>
              <div style="grid-column:1/-1"><label>About</label><textarea data-k="about">${esc(c.about || "")}</textarea></div>
            </div>
            <div style="margin-top:8px"><button type="button" class="tp-mini danger tp-remove-credit">Hapus</button></div>
          `;
          box.appendChild(row);
        });

        box.querySelectorAll(".tp-remove-credit").forEach(btn => {
          btn.onclick = () => {
            btn.closest(".tp-credit-item")?.remove();
            saveDraftLocal(getFormData());
          };
        });
      }

      function addCreditRow(){
        renderCredits([...(getFormData().credits || []), { title:"", company:"", credit_month:"", credit_year:"", about:"" }]);
      }

      function renderPhotos(items){
        const box = document.getElementById("tp_photos_box");
        if(!box) return;
        box.innerHTML = (items || []).length ? (items || []).map(x => {
          let meta = {};
          try{ meta = JSON.parse(x.meta_json || "{}"); }catch{}
          const primary = Number(meta.is_primary || 0) === 1;
          const src = mediaUrl(x.storage_key || "");
          return `
            <div class="tp-photo">
              ${src ? `<img src="${esc(src)}" alt="photo" loading="lazy" decoding="async">` : `<div class="tp-empty">No photo</div>`}
              <div class="tp-photo-foot">
                <span>${primary ? "Primary" : "Photo"}</span>
                <button type="button" class="tp-mini" data-view="${esc(src)}">View</button>
              </div>
            </div>
          `;
        }).join("") : `<div class="tp-empty">Belum ada foto.</div>`;

        box.querySelectorAll("[data-view]").forEach(btn => {
          btn.onclick = () => openImagePopup(btn.getAttribute("data-view"));
        });
      }

      function openImagePopup(src){
        const m = document.getElementById("tp_media_modal");
        const img = document.getElementById("tp_media_img");
        const yt = document.getElementById("tp_media_yt");
        if(!m || !img || !yt) return;
        yt.hidden = true;
        yt.src = "";
        img.hidden = false;
        img.src = src || "";
        m.hidden = false;
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

      function openYoutubePopup(url){
        const m = document.getElementById("tp_media_modal");
        const img = document.getElementById("tp_media_img");
        const yt = document.getElementById("tp_media_yt");
        if(!m || !img || !yt) return;
        const embed = maybeYoutubeEmbed(url);
        if(!embed) return;
        img.hidden = true;
        img.src = "";
        yt.hidden = false;
        yt.src = embed;
        m.hidden = false;
      }

      function bindAutosave(){
        host.querySelectorAll("input, textarea, select").forEach(el => {
          el.addEventListener("input", () => saveDraftLocal(getFormData()));
          el.addEventListener("change", () => saveDraftLocal(getFormData()));
        });
      }

      async function doSave(){
        try{
          setStatus("saving", "Saving...");
          const payload = getFormData();
          const res = await api("/api/talent/profile-full", {
            method: "POST",
            body: payload
          });
          lastSavedAt = Number(res.saved_at || 0);
          clearDraftLocal();
          setStatus("saved", "Saved");
          const pct = document.getElementById("tp_completion");
          if(pct) pct.textContent = String(res.completion_percent || 0) + "%";
        }catch(err){
          setStatus("error", "Save failed");
          alert("Gagal simpan: " + err.message);
        }
      }

      function applyData(d){
        const get = id => document.getElementById(id);
        get("tp_display_name").value = d.profile?.display_name || d.user?.display_name || "";
        get("tp_public_slug").value = d.profile?.public_slug || "";
        get("tp_visibility_status").value = d.profile?.visibility_status || "private";

        get("tp_gender").value = d.basic?.gender || "";
        get("tp_dob").value = d.basic?.dob || "";
        get("tp_location").value = d.basic?.location || "";
        get("tp_ethnicity").value = d.personal_extra?.ethnicity || "";

        get("tp_email").value = d.contact?.email || d.user?.email_norm || "";
        get("tp_phone").value = d.contact?.phone || d.user?.phone_e164 || "";
        get("tp_website").value = d.contact?.website || "";
        get("tp_contact_visibility").value = d.contact?.contact_visibility || "private";

        get("tp_height_cm").value = d.appearance?.height_cm || "";
        get("tp_weight_kg").value = d.appearance?.weight_kg || "";
        get("tp_eye_color").value = d.appearance?.eye_color || "";
        get("tp_hair_color").value = d.appearance?.hair_color || "";
        get("tp_hip").value = d.appearance_extra?.hip || "";
        get("tp_chest").value = d.appearance_extra?.chest || "";
        get("tp_bodytype").value = d.appearance_extra?.bodytype || "";
        get("tp_tattoos").value = d.appearance_extra?.tattoos || "";
        get("tp_piercings").value = d.appearance_extra?.piercings || "";
        get("tp_specific").value = d.appearance_extra?.specific || "";

        get("tp_skills").value = (d.skills || []).join(", ");
        get("tp_interests").value = (d.interests || []).join(", ");

        get("tp_social_instagram").value = socialValue(d.socials, "instagram");
        get("tp_social_tiktok").value = socialValue(d.socials, "tiktok");
        get("tp_social_youtube").value = socialValue(d.socials, "youtube");
        get("tp_social_website").value = socialValue(d.socials, "website");

        document.getElementById("tp_completion").textContent = String(d.progress?.completion_percent || 0) + "%";
        renderCredits(d.credits || []);
        renderPhotos(d.photos || []);
      }

      function renderShell(){
        host.innerHTML = `
          <style>
            .tp-wrap{max-width:1150px;margin:0 auto;background:#f4f6fb;color:#111827}
            .tp-grid{display:grid;grid-template-columns:320px 1fr;gap:16px;padding:16px}
            .tp-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 10px 30px rgba(17,24,39,.08)}
            .tp-side,.tp-main{padding:14px}
            .tp-title{font-size:28px;font-weight:900;line-height:1.1;margin:0 0 8px}
            .tp-sub{font-size:13px;color:#6b7280}
            .tp-section{margin-top:14px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}
            .tp-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
            .tp-head b{font-size:12px;letter-spacing:.08em;color:#374151}
            .tp-body{padding:12px}
            .tp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
            .tp-grid2 > div{display:flex;flex-direction:column;gap:6px}
            .tp-grid2 label{font-size:12px;color:#6b7280;font-weight:800}
            .tp-grid2 input,.tp-grid2 select,.tp-grid2 textarea{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;font:inherit;background:#fff}
            .tp-grid2 textarea{min-height:92px;resize:vertical}
            .tp-progress{margin-top:12px;padding:12px;border:1px solid #fde68a;background:#fffbeb;border-radius:14px}
            .tp-mini{border:1px solid #e5e7eb;background:#fff;padding:7px 10px;border-radius:10px;cursor:pointer;font-weight:800}
            .tp-mini.primary{background:#2563eb;color:#fff;border-color:transparent}
            .tp-mini.danger{background:#fff;color:#b42318}
            .tp-photos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
            .tp-photo{border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}
            .tp-photo img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block}
            .tp-photo-foot{display:flex;justify-content:space-between;align-items:center;padding:10px}
            .tp-empty{padding:18px;text-align:center;color:#6b7280;border:1px dashed #cbd5e1;border-radius:14px;background:#fafafa}
            .tp-footer{position:sticky;bottom:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;background:rgba(255,255,255,.95);backdrop-filter:blur(6px);border-top:1px solid #e5e7eb}
            #tp_save_status[data-state="draft"]{color:#92400e}
            #tp_save_status[data-state="saving"]{color:#1d4ed8}
            #tp_save_status[data-state="saved"]{color:#15803d}
            #tp_save_status[data-state="error"]{color:#b42318}
            .tp-social-links{display:grid;grid-template-columns:1fr 1fr;gap:12px}
            .tp-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55)}
            .tp-modal-card{background:#fff;border-radius:16px;max-width:900px;width:100%;padding:12px}
            .tp-modal-card img,.tp-modal-card iframe{width:100%;max-height:80vh;object-fit:contain;border:0;border-radius:12px}
            @media (max-width:900px){
              .tp-grid{grid-template-columns:1fr}
            }
            @media (max-width:640px){
              .tp-grid2,.tp-social-links,.tp-photos{grid-template-columns:1fr}
            }
          </style>

          <div class="tp-wrap">
            <div class="tp-grid">
              <aside class="tp-card tp-side">
                <div class="tp-progress">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <strong>Profile Progress</strong>
                    <strong id="tp_completion">0%</strong>
                  </div>
                </div>

                <div class="tp-section">
                  <div class="tp-head"><b>PHOTOS</b></div>
                  <div class="tp-body">
                    <div id="tp_photos_box" class="tp-photos"></div>
                  </div>
                </div>
              </aside>

              <main class="tp-card tp-main">
                <h1 class="tp-title">Talent Profile</h1>
                <div class="tp-sub">Theme edit profile terhubung ke D1</div>

                <div class="tp-section">
                  <div class="tp-head"><b>BASIC</b></div>
                  <div class="tp-body tp-grid2">
                    <div><label>Name</label><input id="tp_display_name"></div>
                    <div><label>Public Slug</label><input id="tp_public_slug"></div>
                    <div><label>Gender</label><input id="tp_gender"></div>
                    <div><label>Date Of Birth</label><input id="tp_dob" type="date"></div>
                    <div><label>Location</label><input id="tp_location"></div>
                    <div><label>Ethnicity</label><input id="tp_ethnicity"></div>
                    <div><label>Visibility</label><select id="tp_visibility_status"><option value="private">private</option><option value="public">public</option></select></div>
                  </div>
                </div>

                <div class="tp-section">
                  <div class="tp-head"><b>CONTACT</b></div>
                  <div class="tp-body tp-grid2">
                    <div><label>Email</label><input id="tp_email" type="email"></div>
                    <div><label>Phone</label><input id="tp_phone"></div>
                    <div><label>Website</label><input id="tp_website"></div>
                    <div><label>Contact Visibility</label><select id="tp_contact_visibility"><option value="private">private</option><option value="public">public</option></select></div>
                  </div>
                </div>

                <div class="tp-section">
                  <div class="tp-head"><b>INTERESTS / SKILLS</b></div>
                  <div class="tp-body tp-grid2">
                    <div style="grid-column:1/-1"><label>Interested In</label><input id="tp_interests" placeholder="acting, modeling, singing"></div>
                    <div style="grid-column:1/-1"><label>Skills</label><input id="tp_skills" placeholder="acting, voice over, dancing"></div>
                  </div>
                </div>

                <div class="tp-section">
                  <div class="tp-head"><b>APPEARANCE</b></div>
                  <div class="tp-body tp-grid2">
                    <div><label>Height (cm)</label><input id="tp_height_cm" type="number"></div>
                    <div><label>Weight (kg)</label><input id="tp_weight_kg" type="number"></div>
                    <div><label>Eye Color</label><input id="tp_eye_color"></div>
                    <div><label>Hair Color</label><input id="tp_hair_color"></div>
                    <div><label>Hip</label><input id="tp_hip"></div>
                    <div><label>Chest</label><input id="tp_chest"></div>
                    <div><label>Body Type</label><input id="tp_bodytype"></div>
                    <div><label>Tattoos</label><input id="tp_tattoos"></div>
                    <div><label>Piercings</label><input id="tp_piercings"></div>
                    <div><label>Specific</label><input id="tp_specific"></div>
                  </div>
                </div>

                <div class="tp-section">
                  <div class="tp-head"><b>SOCIAL</b></div>
                  <div class="tp-body tp-social-links">
                    <div><label>Instagram</label><input id="tp_social_instagram"></div>
                    <div><label>TikTok</label><input id="tp_social_tiktok"></div>
                    <div><label>YouTube</label><input id="tp_social_youtube"></div>
                    <div><label>Website</label><input id="tp_social_website"></div>
                  </div>
                  <div class="tp-body">
                    <button type="button" class="tp-mini" id="tp_open_youtube">Preview YouTube</button>
                  </div>
                </div>

                <div class="tp-section">
                  <div class="tp-head">
                    <b>CREDITS</b>
                    <button type="button" class="tp-mini" id="tp_add_credit">+ Add</button>
                  </div>
                  <div class="tp-body" id="tp_credits_box"></div>
                </div>
              </main>
            </div>

            <div class="tp-footer">
              <div id="tp_save_status" data-state="idle">Ready</div>
              <div style="display:flex;gap:8px">
                <button type="button" class="tp-mini" id="tp_restore_draft">Restore Draft</button>
                <button type="button" class="tp-mini primary" id="tp_save_btn">Save</button>
              </div>
            </div>
          </div>

          <div id="tp_media_modal" class="tp-modal" hidden>
            <div class="tp-modal-card">
              <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                <button type="button" class="tp-mini" id="tp_close_media">Close</button>
              </div>
              <img id="tp_media_img" alt="preview">
              <iframe id="tp_media_yt" hidden allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
          </div>
        `;
      }

      async function init(){
        renderShell();
        setStatus("idle", "Ready");

        const data = await api("/api/talent/profile-full");
        serverData = data;

        const localDraft = loadDraftLocal();
        if(localDraft?.data){
          draft = localDraft.data;
          applyData(data);
          setStatus("draft", "Draft ditemukan");
        } else {
          applyData(data);
        }

        bindAutosave();

        document.getElementById("tp_save_btn").onclick = doSave;
        document.getElementById("tp_add_credit").onclick = () => {
          addCreditRow();
          bindAutosave();
        };

        document.getElementById("tp_restore_draft").onclick = () => {
          const localDraft2 = loadDraftLocal();
          if(!localDraft2?.data){
            alert("Draft lokal tidak ada.");
            return;
          }
          applyData({
            ...serverData,
            ...localDraft2.data
          });
          bindAutosave();
          setStatus("draft", "Draft lokal dipulihkan");
        };

        document.getElementById("tp_open_youtube").onclick = () => {
          const v = document.getElementById("tp_social_youtube").value.trim();
          if(!v) return alert("YouTube URL kosong");
          openYoutubePopup(v);
        };

        document.getElementById("tp_close_media").onclick = () => {
          const m = document.getElementById("tp_media_modal");
          const yt = document.getElementById("tp_media_yt");
          const img = document.getElementById("tp_media_img");
          yt.src = "";
          img.src = "";
          m.hidden = true;
        };
      }

      init().catch(err => {
        host.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat theme profile: ' + esc(err.message) + '</div></div>';
      });
    }
  };
}
