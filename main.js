(function () {
  'use strict';

  const TOTAL_FRAMES = 240;
  const canvas = document.getElementById('sequence-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const navbar = document.querySelector('.navbar');

  const getFrameUrl = (index) =>
    `ezgif-879ecf3c16d05fab-jpg/ezgif-frame-${String(index).padStart(3, '0')}.jpg`;

  const frames = new Array(TOTAL_FRAMES + 1);
  const isLoaded = new Uint8Array(TOTAL_FRAMES + 1);

  let targetFrame = 1;
  let currentFrame = 1;
  let currentRenderedIndex = -1;

  // Set up canvas sizing with device pixel ratio
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (currentRenderedIndex > 0) {
      renderFrame(currentRenderedIndex, true);
    }
  }

  // Draw frame on canvas with aspect-ratio-preserving 'cover'
  function renderFrame(index, forceRedraw = false) {
    const clampedIndex = Math.min(TOTAL_FRAMES, Math.max(1, Math.round(index)));

    if (!forceRedraw && clampedIndex === currentRenderedIndex) {
      return;
    }

    let img = frames[clampedIndex];
    if (!img || !isLoaded[clampedIndex]) {
      // Find closest loaded frame
      for (let d = 1; d < TOTAL_FRAMES; d++) {
        const down = clampedIndex - d;
        if (down >= 1 && isLoaded[down]) {
          img = frames[down];
          break;
        }
        const up = clampedIndex + d;
        if (up <= TOTAL_FRAMES && isLoaded[up]) {
          img = frames[up];
          break;
        }
      }
    }

    if (!img) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;

    // Cover logic - scales cleanly to fill screen
    const scale = Math.max(cw / iw, ch / ih);
    const renderW = iw * scale;
    const renderH = ih * scale;
    const offsetX = (cw - renderW) / 2;
    const offsetY = (ch - renderH) / 2;

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
    currentRenderedIndex = clampedIndex;
  }

  // Preload frame with decode API
  function loadFrame(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = getFrameUrl(index);
      img.onload = async () => {
        try {
          if ('decode' in img) {
            await img.decode();
          }
        } catch (_) {}
        frames[index] = img;
        isLoaded[index] = 1;
        resolve(img);
      };
      img.onerror = () => resolve(null);
    });
  }

  // Preload all frames in optimized batches
  async function preloadAllFrames() {
    const BATCH_SIZE = 16;
    for (let i = 2; i <= TOTAL_FRAMES; i += BATCH_SIZE) {
      const batch = [];
      for (let j = i; j < i + BATCH_SIZE && j <= TOTAL_FRAMES; j++) {
        batch.push(loadFrame(j));
      }
      await Promise.all(batch);
    }
  }

  // Fallback native progress calculation
  function calculateNativeProgress() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / maxScroll));
  }

  // Initialize Lenis smooth scroll
  let lenis = null;
  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
      infinite: false,
    });

    // Smooth anchor navigation
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || !href) return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          lenis.scrollTo(target, { offset: -40, duration: 1.5 });
        }
      });
    });
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!lenis) {
        const progress = calculateNativeProgress();
        targetFrame = 1 + progress * (TOTAL_FRAMES - 1);
      }

      if (navbar) {
        if (window.scrollY > 50) {
          navbar.classList.add('scrolled');
        } else {
          navbar.classList.remove('scrolled');
        }
      }
    },
    { passive: true }
  );

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (lenis) {
      lenis.resize();
    }
  }, { passive: true });

  // Main animation render loop
  function animate(time) {
    if (lenis) {
      lenis.raf(time);
      const progress = lenis.progress;
      if (typeof progress === 'number' && !isNaN(progress)) {
        targetFrame = 1 + progress * (TOTAL_FRAMES - 1);
      }
    } else {
      const progress = calculateNativeProgress();
      targetFrame = 1 + progress * (TOTAL_FRAMES - 1);
    }

    // Butter-smooth frame interpolation
    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.002) {
      currentFrame += diff * 0.16;
    } else {
      currentFrame = targetFrame;
    }

    renderFrame(currentFrame);
    requestAnimationFrame(animate);
  }

  // Initialize
  async function init() {
    resizeCanvas();

    // Start render loop immediately
    requestAnimationFrame(animate);

    // Immediately load and show frame 1
    await loadFrame(1);
    renderFrame(1, true);

    // Preload remaining frames
    preloadAllFrames();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
