(() => {
  "use strict";

  // ---- konstanta output (STRIP di-import dari templates.js) ----
  const OUT_W = STRIP.width;
  const OUT_H = STRIP.height;
  const SLOTS = STRIP.slots;
  const SHOT_TRANSITION_MS = 1500;
  const DOWNLOAD_FILENAME = "photobooth-hasil.png";

  // ---- referensi elemen ----
  const screens = {
    login: document.getElementById("screen-login"),
    expired: document.getElementById("screen-expired"),
    error: document.getElementById("screen-error"),
    setup: document.getElementById("screen-setup"),
    camera: document.getElementById("screen-camera"),
    preview: document.getElementById("screen-preview"),
  };
  // layar yang menampilkan badge sesi & tombol "Selesai & Kembali"
  const SESSION_SCREENS = new Set(["setup", "camera", "preview", "error"]);

  const loginForm = document.getElementById("login-form");
  const loginCodeInput = document.getElementById("login-code");
  const loginError = document.getElementById("login-error");
  const btnExpiredOk = document.getElementById("btn-expired-ok");

  const btnRetry = document.getElementById("btn-retry");
  const errorMessage = document.getElementById("error-message");

  const durationOptions = document.getElementById("duration-options");
  const customWrap = document.getElementById("custom-duration-wrap");
  const customInput = document.getElementById("custom-duration");
  const templateTrack = document.getElementById("template-track");
  const btnStartSession = document.getElementById("btn-start-session");

  const shotDotsEls = [...document.querySelectorAll(".dot-shot")];
  const video = document.getElementById("video");
  const canvas = document.getElementById("strip-canvas");
  const ctx = canvas.getContext("2d");
  const shotBanner = document.getElementById("shot-banner");
  const countdownEl = document.getElementById("countdown");
  const flashEl = document.getElementById("flash");
  const btnShutter = document.getElementById("btn-shutter");
  const cameraHint = document.getElementById("camera-hint");

  const resultImg = document.getElementById("result-img");
  const btnDownload = document.getElementById("btn-download");
  const btnRetake = document.getElementById("btn-retake");
  const btnNewSession = document.getElementById("btn-new-session");

  const sessionBadge = document.getElementById("session-badge");
  const sessionBadgeText = document.getElementById("session-badge-text");
  const btnEndSession = document.getElementById("btn-end-session");

  // ---- state ----
  let mediaStream = null;
  let selectedTemplate = templates[0] || null;
  const frameImages = new Map();
  let countdownDuration = 3;
  let isCapturing = false;

  let session = null; // { label, minutes, expiresAt, timerId }

  // ============================================================
  // Navigasi antar layar
  // ============================================================
  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove("active"));
    screens[name].classList.add("active");

    const showChrome = SESSION_SCREENS.has(name) && session;
    sessionBadge.hidden = !showChrome;
    btnEndSession.hidden = !showChrome;
  }

  // ============================================================
  // LOGIN — kode akses / paket waktu
  // ============================================================
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = loginCodeInput.value.trim();
    const match = accessPackages.find(
      (pkg) => pkg.code.toUpperCase() === raw.toUpperCase() && raw.length > 0
    );
    if (!match) {
      loginError.hidden = false;
      loginCodeInput.focus();
      return;
    }
    loginError.hidden = true;
    loginCodeInput.value = "";
    startSession(match);
  });

  function startSession(pkg) {
    stopSessionTimer();
    session = { label: pkg.label, minutes: pkg.minutes, expiresAt: null, timerId: null };

    if (pkg.minutes != null) {
      session.expiresAt = Date.now() + pkg.minutes * 60 * 1000;
      updateSessionBadge();
      session.timerId = setInterval(updateSessionBadge, 1000);
    } else {
      sessionBadge.classList.remove("low");
      sessionBadgeText.textContent = `${pkg.label} \u00B7 \u221E`;
    }

    showScreen("setup");
  }

  function updateSessionBadge() {
    if (!session || session.expiresAt == null) return;
    const remainingMs = session.expiresAt - Date.now();
    if (remainingMs <= 0) {
      expireSession();
      return;
    }
    const totalSec = Math.ceil(remainingMs / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    sessionBadgeText.textContent = `${mm}:${ss}`;
    sessionBadge.classList.toggle("low", totalSec <= 60);
  }

  function stopSessionTimer() {
    if (session && session.timerId) clearInterval(session.timerId);
  }

  function expireSession() {
    stopSessionTimer();
    stopCamera();
    session = null;
    resetForNextGuest();
    showScreen("expired");
  }

  btnExpiredOk.addEventListener("click", () => showScreen("login"));

  btnEndSession.addEventListener("click", () => {
    const ok = window.confirm("Akhiri sesi ini dan kembali ke layar login?");
    if (!ok) return;
    stopSessionTimer();
    stopCamera();
    session = null;
    resetForNextGuest();
    showScreen("login");
  });

  // ============================================================
  // SETUP — durasi countdown & template
  // ============================================================
  durationOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".dur-btn");
    if (!btn) return;
    [...durationOptions.children].forEach((c) => c.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");

    if (btn.dataset.seconds === "custom") {
      customWrap.hidden = false;
      countdownDuration = clampDuration(customInput.value);
    } else {
      customWrap.hidden = true;
      countdownDuration = Number(btn.dataset.seconds);
    }
  });

  customInput.addEventListener("input", () => {
    countdownDuration = clampDuration(customInput.value);
  });

  function clampDuration(val) {
    let n = parseInt(val, 10);
    if (Number.isNaN(n)) n = 5;
    return Math.min(30, Math.max(1, n));
  }

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

      btn.addEventListener("click", () => {
        selectedTemplate = tpl;
        [...templateTrack.children].forEach((child, i) => {
          child.setAttribute("aria-pressed", templates[i].id === tpl.id ? "true" : "false");
        });
      });
      templateTrack.appendChild(btn);
    });
  }

  btnStartSession.addEventListener("click", async () => {
    resetShotProgress();
    btnStartSession.disabled = true;
    await initCamera();
    btnStartSession.disabled = false;
  });

  // ============================================================
  // Akses kamera
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
      NotAllowedError: "Izin kamera ditolak. Klik ikon kamera/gembok di address bar browser, izinkan akses, lalu coba lagi.",
      PermissionDeniedError: "Izin kamera ditolak. Klik ikon kamera/gembok di address bar browser, izinkan akses, lalu coba lagi.",
      NotFoundError: "Kamera tidak ditemukan. Pastikan perangkat memiliki webcam yang terhubung.",
      DevicesNotFoundError: "Kamera tidak ditemukan. Pastikan perangkat memiliki webcam yang terhubung.",
      NotReadableError: "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.",
      OverconstrainedError: "Kamera perangkat tidak mendukung pengaturan yang diminta.",
    };
    errorMessage.textContent =
      messages[err && err.name] || "Tidak dapat mengakses kamera pada perangkat/browser ini.";
    showScreen("error");
  }
  btnRetry.addEventListener("click", initCamera);

  // ============================================================
  // Progress 3 jepretan
  // ============================================================
  function resetShotProgress() {
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    shotDotsEls.forEach((d) => d.classList.remove("done", "current"));
    shotDotsEls[0] && shotDotsEls[0].classList.add("current");
    cameraHint.textContent =
      "Posisikan wajahmu di dalam bingkai, lalu tekan tombol untuk mulai jepret 3 foto berturut-turut";
  }

  function updateDots(doneCount) {
    shotDotsEls.forEach((dot, i) => {
      dot.classList.toggle("done", i < doneCount);
      dot.classList.toggle("current", i === doneCount);
    });
  }

  // ============================================================
  // Timer + capture berurutan (F-04/F-05/F-06 versi 3x jepret)
  // ============================================================
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  btnShutter.addEventListener("click", runSequence);

  async function runSequence() {
    if (isCapturing) return;
    isCapturing = true;
    btnShutter.disabled = true;
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    updateDots(0);

    for (let i = 0; i < SLOTS.length; i++) {
      cameraHint.textContent = `Foto ${i + 1} dari ${SLOTS.length} — bersiap!`;
      await runCountdown();
      fireFlash();
      captureShotIntoStrip(i);
      updateDots(i + 1);

      if (i < SLOTS.length - 1) {
        await showShotBanner(`Foto ${i + 1} selesai! Bersiap untuk foto ${i + 2}...`);
      }
    }

    finalizeStrip();
    isCapturing = false;
    btnShutter.disabled = false;
    showScreen("preview");
  }

  async function runCountdown() {
    countdownEl.classList.add("show");
    for (let n = countdownDuration; n >= 1; n--) {
      countdownEl.textContent = String(n);
      countdownEl.classList.remove("pulse");
      void countdownEl.offsetWidth;
      countdownEl.classList.add("pulse");
      await sleep(1000);
    }
    countdownEl.classList.remove("show", "pulse");
  }

  function showShotBanner(text) {
    shotBanner.textContent = text;
    shotBanner.classList.add("show");
    return sleep(SHOT_TRANSITION_MS).then(() => {
      shotBanner.classList.remove("show");
    });
  }

  function fireFlash() {
    flashEl.classList.remove("fire");
    void flashEl.offsetWidth;
    flashEl.classList.add("fire");
  }

  // crop video seperti object-fit:cover ke ukuran target
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

  // gambar 1 jepretan (mirrored) langsung ke slot-nya di kanvas strip
  function captureShotIntoStrip(index) {
    const slot = SLOTS[index];
    ctx.save();
    ctx.translate(slot.x + slot.w, slot.y);
    ctx.scale(-1, 1);
    drawVideoCover(ctx, video, slot.w, slot.h);
    ctx.restore();
  }

  // gabungkan bingkai template di atas 3 foto yang sudah ada
  function finalizeStrip() {
    const frameImg = selectedTemplate ? frameImages.get(selectedTemplate.id) : null;
    if (frameImg && frameImg.complete) {
      ctx.drawImage(frameImg, 0, 0, OUT_W, OUT_H);
    }
    resultImg.src = canvas.toDataURL("image/png");
  }

  // ============================================================
  // Preview: unduh / ulangi / sesi baru
  // ============================================================
  btnDownload.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = DOWNLOAD_FILENAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  btnRetake.addEventListener("click", () => {
    resetShotProgress();
    showScreen("camera");
  });

  btnNewSession.addEventListener("click", () => {
    resetShotProgress();
    showScreen("setup");
  });

  function resetForNextGuest() {
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    resultImg.removeAttribute("src");
    loginCodeInput.value = "";
    loginError.hidden = true;
  }

  // ============================================================
  // Cleanup
  // ============================================================
  window.addEventListener("pagehide", () => {
    stopSessionTimer();
    stopCamera();
  });

  // ============================================================
  // Init
  // ============================================================
  (function bootstrap() {
    showScreen("login");
    renderTemplatePicker();
    Promise.all(templates.map(preloadFrame));
  })();
})();
