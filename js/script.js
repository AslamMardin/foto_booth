(() => {
  "use strict";

  // ---- konstanta output (hardcoded sesuai PRD bagian 2) ----
  const OUT_W = 555;
  const OUT_H = 331;
  const COUNTDOWN_SECONDS = 3;
  const DOWNLOAD_FILENAME = "photobooth-hasil.png";

  // ---- referensi elemen ----
  const screens = {
    start: document.getElementById("screen-start"),
    error: document.getElementById("screen-error"),
    camera: document.getElementById("screen-camera"),
    preview: document.getElementById("screen-preview"),
  };

  const btnStart = document.getElementById("btn-start");
  const btnRetry = document.getElementById("btn-retry");
  const errorMessage = document.getElementById("error-message");

  const video = document.getElementById("video");
  const overlay = document.getElementById("overlay");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const countdownEl = document.getElementById("countdown");
  const flashEl = document.getElementById("flash");

  const templateTrack = document.getElementById("template-track");
  const btnShutter = document.getElementById("btn-shutter");

  const resultImg = document.getElementById("result-img");
  const btnDownload = document.getElementById("btn-download");
  const btnRetake = document.getElementById("btn-retake");

  // ---- state ----
  let mediaStream = null;
  let selectedTemplate = templates[0] || null;
  const frameImages = new Map(); // id -> HTMLImageElement (preloaded)
  let isCapturing = false;

  // ============================================================
  // Navigasi antar layar
  // ============================================================
  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ============================================================
  // F-02 — Katalog Template
  // ============================================================
  function preloadFrame(tpl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = tpl.src;
      frameImages.set(tpl.id, img);
    });
  }

  function renderTemplatePicker() {
    templateTrack.innerHTML = "";
    templates.forEach((tpl, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tpl-thumb";
      btn.style.backgroundImage = `url("${tpl.thumbnail}")`;
      btn.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      btn.setAttribute("aria-label", `Pilih bingkai ${tpl.nama}`);

      const label = document.createElement("span");
      label.textContent = tpl.nama;
      btn.appendChild(label);

      btn.addEventListener("click", () => selectTemplate(tpl));
      templateTrack.appendChild(btn);
    });
  }

  function selectTemplate(tpl) {
    selectedTemplate = tpl;
    overlay.src = tpl.src; // F-03: live preview overlay
    [...templateTrack.children].forEach((child, i) => {
      child.setAttribute("aria-pressed", templates[i].id === tpl.id ? "true" : "false");
    });
  }

  // ============================================================
  // F-01 — Akses Web Cam
  // ============================================================
  async function initCamera() {
    stopCamera();
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = mediaStream;
      await video.play().catch(() => {});
      showScreen("camera");
    } catch (err) {
      showCameraError(err);
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
  }

  function showCameraError(err) {
    const messages = {
      NotAllowedError:
        "Izin kamera ditolak. Klik ikon kamera/gembok di address bar browser, izinkan akses, lalu coba lagi.",
      PermissionDeniedError:
        "Izin kamera ditolak. Klik ikon kamera/gembok di address bar browser, izinkan akses, lalu coba lagi.",
      NotFoundError:
        "Kamera tidak ditemukan. Pastikan perangkat memiliki webcam yang terhubung.",
      DevicesNotFoundError:
        "Kamera tidak ditemukan. Pastikan perangkat memiliki webcam yang terhubung.",
      NotReadableError:
        "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.",
      OverconstrainedError:
        "Kamera perangkat tidak mendukung pengaturan yang diminta.",
    };
    errorMessage.textContent =
      messages[err && err.name] ||
      "Tidak dapat mengakses kamera pada perangkat/browser ini.";
    showScreen("error");
  }

  // ============================================================
  // F-04 / F-05 — Timer Visual + Pengambilan Foto
  // ============================================================
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function runCountdownAndCapture() {
    if (isCapturing) return;
    isCapturing = true;
    btnShutter.disabled = true;

    countdownEl.classList.add("show");
    for (let n = COUNTDOWN_SECONDS; n >= 1; n--) {
      countdownEl.textContent = String(n);
      countdownEl.classList.remove("pulse");
      // force reflow supaya animasi bisa retrigger tiap angka
      void countdownEl.offsetWidth;
      countdownEl.classList.add("pulse");
      await sleep(1000);
    }
    countdownEl.classList.remove("show", "pulse");

    fireFlash();
    capturePhoto();
    enterPreviewMode();

    isCapturing = false;
    btnShutter.disabled = false;
  }

  function fireFlash() {
    flashEl.classList.remove("fire");
    void flashEl.offsetWidth;
    flashEl.classList.add("fire");
  }

  // Menghitung area crop video agar pas seperti object-fit:cover
  function drawVideoCover(context, videoEl, targetW, targetH) {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return;

    const videoRatio = vw / vh;
    const targetRatio = targetW / targetH;
    let sx, sy, sw, sh;

    if (videoRatio > targetRatio) {
      sh = vh;
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      sw = vw;
      sh = vw / targetRatio;
      sx = 0;
      sy = (vh - sh) / 2;
    }
    context.drawImage(videoEl, sx, sy, sw, sh, 0, 0, targetW, targetH);
  }

  // F-06 — Penggabungan Gambar (foto + template) ke satu canvas 555x331
  function capturePhoto() {
    ctx.clearRect(0, 0, OUT_W, OUT_H);

    // gambar video secara mirrored, konsisten dengan live preview
    ctx.save();
    ctx.translate(OUT_W, 0);
    ctx.scale(-1, 1);
    drawVideoCover(ctx, video, OUT_W, OUT_H);
    ctx.restore();

    // gambar bingkai template di atasnya (tidak dicermin)
    const frameImg = selectedTemplate ? frameImages.get(selectedTemplate.id) : null;
    if (frameImg && frameImg.complete) {
      ctx.drawImage(frameImg, 0, 0, OUT_W, OUT_H);
    }
  }

  // ============================================================
  // F-07 — Mode Pratinjau Hasil
  // ============================================================
  function enterPreviewMode() {
    resultImg.src = canvas.toDataURL("image/png");
    showScreen("preview");
  }

  // ============================================================
  // F-08 — Unduh Otomatis
  // ============================================================
  function downloadPhoto() {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = DOWNLOAD_FILENAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // ============================================================
  // F-09 — Retake
  // ============================================================
  function retake() {
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    resultImg.removeAttribute("src");
    showScreen("camera");
  }

  // ============================================================
  // Event wiring
  // ============================================================
  btnStart.addEventListener("click", initCamera);
  btnRetry.addEventListener("click", initCamera);
  btnShutter.addEventListener("click", runCountdownAndCapture);
  btnDownload.addEventListener("click", downloadPhoto);
  btnRetake.addEventListener("click", retake);

  // hentikan kamera dengan rapi saat tab ditutup/pindah agar lampu indikator kamera mati
  window.addEventListener("pagehide", stopCamera);

  // ============================================================
  // Init
  // ============================================================
  (function bootstrap() {
    showScreen("start"); // pastikan layar awal benar-benar tampil
    renderTemplatePicker();
    Promise.all(templates.map(preloadFrame)).then(() => {
      if (selectedTemplate) overlay.src = selectedTemplate.src;
    });
  })();
})();
