import Lenis from 'lenis';

/* ==========================================================================
   1. LENIS SMOOTH SCROLL INITIALIZATION
   ========================================================================== */
const lenis = new Lenis({
  duration: 1.5,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  wheelMultiplier: 0.8, // Calms mousewheel bursts for deliberate cinematic control
  touchMultiplier: 1.2,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

/* ==========================================================================
   2. NAVBAR SCROLL DETECTION & MOBILE DRAWER
   ========================================================================== */
const siteHeader = document.querySelector('.site-header');
const mobileToggle = document.getElementById('mobile-toggle');
const mobileDrawer = document.getElementById('mobile-drawer');
const navLinks = document.querySelectorAll('.nav-menu .nav-link');

const trackedNavSections = [
  { id: 'hero-stage', el: document.getElementById('hero-stage') },
  { id: 'why-us', el: document.getElementById('why-us') },
  { id: 'roomtour-stage', el: document.getElementById('roomtour-stage') },
  { id: 'properties', el: document.getElementById('properties') },
  { id: 'services', el: document.getElementById('services') },
  { id: 'about', el: document.getElementById('about') },
  { id: 'contact', el: document.getElementById('contact') }
].filter(item => item.el !== null);

function updateActiveNav() {
  const scrollY = window.scrollY || window.pageYOffset;
  
  if (siteHeader) {
    if (scrollY > 30) {
      siteHeader.classList.add('scrolled');
    } else {
      siteHeader.classList.remove('scrolled');
    }
  }

  let currentId = 'hero-stage';
  for (let i = 0; i < trackedNavSections.length; i++) {
    const section = trackedNavSections[i];
    const rect = section.el.getBoundingClientRect();
    if (rect.top <= 180 && rect.bottom >= 180) {
      currentId = section.id;
      break;
    }
  }

  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href === `#${currentId}`) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });
lenis.on('scroll', updateActiveNav);

if (mobileToggle && mobileDrawer) {
  mobileToggle.addEventListener('click', () => {
    mobileDrawer.classList.toggle('open');
    const isOpen = mobileDrawer.classList.contains('open');
    mobileToggle.classList.toggle('active', isOpen);
    mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.querySelectorAll('.mobile-link').forEach((link) => {
    link.addEventListener('click', () => {
      mobileDrawer.classList.remove('open');
      mobileToggle.classList.remove('active');
      mobileToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ==========================================================================
   3. DUAL 240-FRAME SCROLLYTELLING ENGINE (HERO & ROOMTOUR)
   ========================================================================== */
const TOTAL_FRAMES = 240;

function createScrollyController({
  stageId,
  canvasId,
  framePathFn,
  actIds,
  timelineLabelId,
  timelinePhases,
  priority = false
}) {
  const stage = document.getElementById(stageId);
  const canvas = document.getElementById(canvasId);
  if (!stage || !canvas) return null;

  const ctx = canvas.getContext('2d', { alpha: false });
  const frames = [];
  let currentFrame = 1;
  let targetFrame = 1;
  let hasRenderedInitial = false;
  let isVisible = false;

  const actElements = actIds.map((id) => document.getElementById(id));
  const timelineLabel = timelineLabelId ? document.getElementById(timelineLabelId) : null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.clientWidth || window.innerWidth;
    const h = rect.height || canvas.clientHeight || window.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.scale(dpr, dpr);
    render();
  }

  function render() {
    let frameIdx = Math.min(Math.max(Math.round(currentFrame), 1), TOTAL_FRAMES);
    let img = frames[frameIdx];

    // Fallback to nearest loaded frame if current frame is loading
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
        const prev = frameIdx - offset;
        const next = frameIdx + offset;
        if (prev >= 1 && frames[prev]?.complete && frames[prev].naturalWidth > 0) {
          img = frames[prev];
          break;
        }
        if (next <= TOTAL_FRAMES && frames[next]?.complete && frames[next].naturalWidth > 0) {
          img = frames[next];
          break;
        }
      }
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    if (img && img.complete && img.naturalWidth > 0) {
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = w / h;
      let renderW, renderH, offsetX, offsetY;

      if (canvasRatio > imgRatio) {
        renderW = w;
        renderH = w / imgRatio;
        offsetX = 0;
        offsetY = (h - renderH) / 2;
      } else {
        renderH = h;
        renderW = h * imgRatio;
        offsetX = (w - renderW) / 2;
        offsetY = 0;
      }

      ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
    }
  }

  function update() {
    // Only animate if stage is within viewport or initial frame not painted
    if (!isVisible && hasRenderedInitial) return;

    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.01) {
      // Cinematic weighted damping (analog camera glide)
      currentFrame += diff * 0.085;
      render();
    } else if (!hasRenderedInitial && frames[1]?.complete) {
      render();
      hasRenderedInitial = true;
    }
  }

  function onScroll() {
    const rect = stage.getBoundingClientRect();
    const windowH = window.innerHeight;

    // Viewport visibility check (with 200px buffer)
    isVisible = rect.top < windowH + 200 && rect.bottom > -200;
    if (!isVisible) return;

    const stickyOffset = stageId === 'roomtour-stage' ? 90 : 0;
    const totalScroll = Math.max(stage.offsetHeight - windowH, 1);
    const currentScroll = -(rect.top - stickyOffset);
    const progress = Math.min(Math.max(currentScroll / totalScroll, 0), 1);

    // Scrub 240 frames
    targetFrame = 1 + progress * (TOTAL_FRAMES - 1);

    // 4 Act thresholds
    let activeAct = 1;
    if (progress >= 0.75) {
      activeAct = 4;
    } else if (progress >= 0.50) {
      activeAct = 3;
    } else if (progress >= 0.25) {
      activeAct = 2;
    } else {
      activeAct = 1;
    }

    actElements.forEach((el, idx) => {
      if (el) {
        if (idx + 1 === activeAct) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });

    if (timelineLabel && timelinePhases[activeAct - 1]) {
      timelineLabel.textContent = timelinePhases[activeAct - 1];
    }
  }

  function preload() {
    // PASS 1: Frame 1 immediately
    const firstImg = new Image();
    firstImg.src = framePathFn(1);
    firstImg.onload = () => {
      frames[1] = firstImg;
      render();
    };
    if (firstImg.complete) {
      frames[1] = firstImg;
      render();
    }
    frames[1] = firstImg;

    // PASS 2: Milestones every 4 frames (covers 100% of the timeline in ~150ms)
    for (let i = 5; i <= TOTAL_FRAMES; i += 4) {
      const img = new Image();
      img.src = framePathFn(i);
      img.onload = () => {
        if (Math.round(currentFrame) === i) render();
      };
      frames[i] = img;
    }

    // PASS 3: Intermediate frames for dense 60fps scrubbing
    const loadIntermediate = () => {
      for (let i = 2; i <= TOTAL_FRAMES; i++) {
        if (frames[i]) continue;
        const img = new Image();
        img.src = framePathFn(i);
        img.onload = () => {
          if (Math.round(currentFrame) === i) render();
        };
        frames[i] = img;
      }
    };

    if (priority) {
      setTimeout(loadIntermediate, 80);
    } else {
      setTimeout(loadIntermediate, 350);
    }
  }

  preload();

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', onScroll, { passive: true });

  // Initial call
  resize();
  onScroll();

  return {
    update,
    render,
    resize,
    onScroll
  };
}

/* ==========================================================================
   4. INITIALIZE HERO & ROOMTOUR CONTROLLERS
   ========================================================================== */
const heroController = createScrollyController({
  stageId: 'hero-stage',
  canvasId: 'hero-canvas',
  framePathFn: (idx) => `/frames/frame_${String(idx).padStart(3, '0')}.webp`,
  actIds: ['act-1', 'act-2', 'act-3', 'act-4'],
  timelineLabelId: 'timeline-label',
  timelinePhases: [
    'Phase 01 / Ground Foundation',
    'Phase 02 / Structural Steel & Concrete',
    'Phase 03 / Architectural Glazing',
    'Phase 04 / Completed Sanctuary'
  ],
  priority: true
});

const roomtourController = createScrollyController({
  stageId: 'roomtour-stage',
  canvasId: 'roomtour-canvas',
  framePathFn: (idx) => `/frames_roomtour/frame_${String(idx).padStart(3, '0')}.webp`,
  actIds: ['roomtour-act-1', 'roomtour-act-2', 'roomtour-act-3', 'roomtour-act-4'],
  timelineLabelId: 'roomtour-timeline-label',
  timelinePhases: [
    'Space 01 / Culinary Studio',
    'Space 02 / Dining Pavilion',
    'Space 03 / Indoor-Outdoor Glass',
    'Space 04 / Cozy Living Lounge'
  ],
  priority: false
});

// Direct Lenis smooth scroll bridge for floating-point scroll precision
lenis.on('scroll', () => {
  heroController?.onScroll();
  roomtourController?.onScroll();
});

// Master 60FPS Lerp Loop
function masterAnimationLoop() {
  if (heroController) heroController.update();
  if (roomtourController) roomtourController.update();
  requestAnimationFrame(masterAnimationLoop);
}
requestAnimationFrame(masterAnimationLoop);

/* ==========================================================================
   6. PROPERTY FILTER TABS
   ========================================================================== */
const filterBtns = document.querySelectorAll('.filter-btn');
const propertyCards = document.querySelectorAll('.property-card');

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterBtns.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    const category = btn.dataset.category;

    propertyCards.forEach((card) => {
      if (category === 'all' || card.dataset.category === category) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

/* ==========================================================================
   7. DARK SERVICES ACCORDION & DYNAMIC DISPLAY
   ========================================================================== */
const serviceRows = document.querySelectorAll('.service-row');
const displayTitle = document.getElementById('display-service-title');
const displaySub = document.getElementById('display-service-sub');

const serviceData = {
  1: {
    title: 'Office Leasing',
    sub: 'Curated corporate headquarters & boutique workspaces across Jakarta & Bali with flexible lease terms.'
  },
  2: {
    title: 'Retail Spaces',
    sub: 'High-visibility flagship storefronts in premier lifestyle districts with verified pedestrian footfall.'
  },
  3: {
    title: 'Architectural Build',
    sub: 'End-to-end bespoke villa development from land acquisition, permit clearance to turnkey luxury delivery.'
  },
  4: {
    title: 'Estate Advisory',
    sub: 'Discreet wealth management for ultra-high-net-worth real estate portfolios and private family estates.'
  }
};

serviceRows.forEach((row) => {
  row.addEventListener('click', () => {
    const serviceId = row.dataset.service;
    if (serviceData[serviceId]) {
      serviceRows.forEach((r) => r.classList.remove('active'));
      row.classList.add('active');

      if (displayTitle && displaySub) {
        displayTitle.style.opacity = '0';
        displaySub.style.opacity = '0';

        setTimeout(() => {
          displayTitle.textContent = serviceData[serviceId].title;
          displaySub.textContent = serviceData[serviceId].sub;
          displayTitle.style.opacity = '1';
          displaySub.style.opacity = '1';
        }, 150);
      }
    }
  });
});

/* ==========================================================================
   8. INQUIRY DIALOG / MODAL
   ========================================================================== */
const inquiryDialog = document.getElementById('inquiry-dialog');
const openInquiryBtns = [
  document.getElementById('btn-open-inquiry'),
  document.getElementById('btn-hero-inquiry'),
  document.getElementById('btn-roomtour-inquiry'),
  document.getElementById('btn-mobile-inquiry'),
  document.getElementById('btn-see-all'),
  ...document.querySelectorAll('.btn-trigger-modal')
];
const closeDialogBtn = document.getElementById('dialog-close');
const inquiryForm = document.getElementById('inquiry-form');

openInquiryBtns.forEach((btn) => {
  if (btn) {
    btn.addEventListener('click', () => {
      if (inquiryDialog && typeof inquiryDialog.showModal === 'function') {
        inquiryDialog.showModal();
      }
    });
  }
});

if (closeDialogBtn && inquiryDialog) {
  closeDialogBtn.addEventListener('click', () => {
    inquiryDialog.close();
  });

  inquiryDialog.addEventListener('click', (e) => {
    if (e.target === inquiryDialog) {
      inquiryDialog.close();
    }
  });
}

if (inquiryForm) {
  inquiryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('inq-name')?.value || 'Client';
    alert(`Thank you, ${name}. Your private inquiry has been received. Our senior advisor will contact you shortly.`);
    inquiryDialog.close();
    inquiryForm.reset();
  });
}

/* ==========================================================================
   9. SMOOTH SCROLL ANCHORS
   ========================================================================== */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const targetId = anchor.getAttribute('href');
    if (targetId && targetId !== '#') {
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        lenis.scrollTo(targetEl, { offset: -75, duration: 1.2 });
      }
    }
  });
});
