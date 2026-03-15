import { api, esc, ensureBaseStyles, mountNode } from "./_admin_common.js";

export default function(){
  return {
    title:"Certificate Document",
    async mount(root){
      ensureBaseStyles();
      const host = mountNode(root);

      function getParam(name){
        const u = new URL(location.href);
        return String(u.searchParams.get(name) || "").trim();
      }

      function openImagePreview(dataUrl){
        const modal = document.getElementById("cdoc_img_modal");
        const img = document.getElementById("cdoc_img_preview");
        img.src = dataUrl || "";
        modal.hidden = false;
      }

      function closeImagePreview(){
        const modal = document.getElementById("cdoc_img_modal");
        const img = document.getElementById("cdoc_img_preview");
        img.src = "";
        modal.hidden = true;
      }

      async function ensureQrLib(){
        if(window.QRCode) return;
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      async function loadDoc(){
        const id = getParam("id");
        const certificate_no = getParam("certificate_no");
        const code = getParam("code");

        if(!id && !certificate_no && !code){
          host.innerHTML = '<div class="oa-wrap"><div class="oa-empty">id, certificate_no, atau code wajib diisi.</div></div>';
          return;
        }

        const qs = new URLSearchParams();
        if(id) qs.set("id", id);
        if(certificate_no) qs.set("certificate_no", certificate_no);
        if(code) qs.set("code", code);

        const data = await api("/api/certificates/document?" + qs.toString());

        const verifyUrl = `/certificate/verify?certificate_no=${encodeURIComponent(data.item?.certificate_no || "")}&code=${encodeURIComponent(data.item?.verification_code || "")}`;

        host.innerHTML = `
          <style>
            .cdoc-wrap{max-width:1260px;margin:0 auto;padding:18px 14px 40px;background:#f4f6fb;color:#111827}
            .cdoc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}
            .cdoc-title{margin:0;font-size:28px;font-weight:900;line-height:1.1}
            .cdoc-sub{margin-top:8px;color:#6b7280;font-size:14px}
            .cdoc-tools{display:flex;gap:8px;flex-wrap:wrap}
            .cdoc-btn{border:0;padding:10px 14px;border-radius:12px;cursor:pointer;background:#2563eb;color:#fff;font-weight:700}
            .cdoc-btn.alt{background:#f1f5f9;color:#0f172a;border:1px solid #e5e7eb}
            .cdoc-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 10px 30px rgba(17,24,39,.08);padding:14px}
            .cdoc-frame{width:100%;height:78vh;border:1px solid #e5e7eb;border-radius:14px;background:#fff}
            .cdoc-info{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:12px}
            .cdoc-field{border:1px solid #eef2f7;border-radius:12px;padding:12px;background:#fff}
            .cdoc-field .k{font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:800}
            .cdoc-field .v{font-size:14px;color:#0f172a;font-weight:900;word-break:break-word}
            .cdoc-verify-box{display:flex;gap:12px;align-items:center}
            .cdoc-qr{width:96px;height:96px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}
            .cdoc-qr canvas,.cdoc-qr img{max-width:100%;max-height:100%}
            .cdoc-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.6)}
            .cdoc-modal-card{background:#fff;border-radius:16px;max-width:95vw;max-height:95vh;padding:12px}
            .cdoc-modal-card img{max-width:90vw;max-height:82vh;display:block;border-radius:12px}
            @media (max-width:900px){.cdoc-info{grid-template-columns:1fr 1fr}}
            @media (max-width:640px){.cdoc-info{grid-template-columns:1fr}.cdoc-frame{height:70vh}.cdoc-verify-box{flex-direction:column;align-items:flex-start}}
          </style>

          <div class="cdoc-wrap">
            <div class="cdoc-head">
              <div>
                <h1 class="cdoc-title">Certificate Document</h1>
                <div class="cdoc-sub">Preview, print PDF, download PNG, dan scan QR verification.</div>
              </div>
              <div class="cdoc-tools">
                <button class="cdoc-btn alt" id="cdoc_btn_reload" type="button">Reload</button>
                <button class="cdoc-btn alt" id="cdoc_btn_print" type="button">Print / Save PDF</button>
                <button class="cdoc-btn" id="cdoc_btn_png" type="button">Download PNG</button>
              </div>
            </div>

            <div class="cdoc-info">
              <div class="cdoc-field"><div class="k">Certificate No</div><div class="v">${esc(data.item?.certificate_no || "-")}</div></div>
              <div class="cdoc-field"><div class="k">Issued To</div><div class="v">${esc(data.item?.issued_to_name || "-")}</div></div>
              <div class="cdoc-field"><div class="k">Project</div><div class="v">${esc(data.item?.project_title || "-")}</div></div>
              <div class="cdoc-field">
                <div class="k">Verification</div>
                <div class="cdoc-verify-box">
                  <div id="cdoc_qr" class="cdoc-qr"></div>
                  <div class="v">
                    <div>${esc(data.item?.verification_code || "-")}</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:6px;word-break:break-all">${esc(location.origin + verifyUrl)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="cdoc-card">
              <iframe id="cdoc_frame" class="cdoc-frame"></iframe>
            </div>
          </div>

          <div id="cdoc_img_modal" class="cdoc-modal" hidden>
            <div class="cdoc-modal-card">
              <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                <button class="cdoc-btn alt" id="cdoc_btn_close_img" type="button">Close</button>
              </div>
              <img id="cdoc_img_preview" alt="certificate png preview">
            </div>
          </div>
        `;

        document.getElementById("cdoc_frame").srcdoc = data.document_html || "";

        await ensureQrLib();
        const qrBox = document.getElementById("cdoc_qr");
        qrBox.innerHTML = "";
        await window.QRCode.toCanvas(qrBox, location.origin + verifyUrl, {
          width: 96,
          margin: 1
        });

        document.getElementById("cdoc_btn_reload").onclick = loadDoc;

        document.getElementById("cdoc_btn_print").onclick = () => {
          const frame = document.getElementById("cdoc_frame");
          if(frame?.contentWindow) frame.contentWindow.print();
        };

        document.getElementById("cdoc_btn_close_img").onclick = closeImagePreview;
        document.getElementById("cdoc_img_modal").onclick = (e) => {
          if(e.target.id === "cdoc_img_modal") closeImagePreview();
        };

        document.getElementById("cdoc_btn_png").onclick = async () => {
          const frame = document.getElementById("cdoc_frame");
          if(!frame) return;

          try{
            const win = frame.contentWindow;
            const doc = win.document;
            const target = doc.querySelector(".doc-card") || doc.body;

            if(!window.html2canvas){
              await new Promise((resolve, reject) => {
                const s = document.createElement("script");
                s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
              });
            }

            const canvas = await window.html2canvas(target, {
              scale: 2,
              useCORS: true,
              backgroundColor: "#ffffff"
            });

            const dataUrl = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = (data.item?.certificate_no || "certificate") + ".png";
            document.body.appendChild(a);
            a.click();
            a.remove();

            openImagePreview(dataUrl);
          }catch(err){
            alert("Gagal generate PNG: " + err.message);
          }
        };
      }

      loadDoc().catch(err => {
        host.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat certificate document: ' + esc(err.message) + '</div></div>';
      });
    }
  };
}
