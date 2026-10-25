(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsapReady = !!window.gsap && !reducedMotion;
  const progress = document.createElement('div');
  progress.id = 'alarabin-scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);

  const header = document.querySelector('.topbar');
  let setProgress = null;
  if (gsapReady) {
    setProgress = gsap.quickTo(progress, 'scaleX', {
      duration: 0.18,
      ease: 'power2.out',
    });
  }

  function updateScrollUI() {
    const root = document.documentElement;
    const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
    const amount = Math.max(0, Math.min(1, (window.scrollY || root.scrollTop) / maxScroll));
    if (setProgress) setProgress(amount);
    else progress.style.transform = `scaleX(${amount})`;
    if (header) header.classList.toggle('motion-scrolled', (window.scrollY || root.scrollTop) > 12);
  }

  let scrollFrame = 0;
  function scheduleScrollUI() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      updateScrollUI();
    });
  }

  window.addEventListener('scroll', scheduleScrollUI, { passive: true });
  window.addEventListener('resize', scheduleScrollUI, { passive: true });
  updateScrollUI();

  if (!reducedMotion && typeof window.Lenis === 'function') {
    try {
      window.__alarabinLenis = new Lenis({
        autoRaf: true,
        anchors: false,
        smoothWheel: true,
        syncTouch: false,
        lerp: 0.1,
        prevent: (node) => node instanceof Element && !!node.closest(
          'dialog, [role="dialog"], input, textarea, select, [contenteditable="true"], [data-lenis-prevent]'
        ),
      });
      window.__alarabinLenis.on('scroll', scheduleScrollUI);
    } catch (_) {
      window.__alarabinLenis = null;
    }
  }

  if (!gsapReady) return;

  const revealSelector = [
    '.section-home-head', '.section-tile', '.section-head', '.hero-art', '.stat',
    '.result-card', '.athlete-card', '.plan-card', '.recipe-card',
    '.home-exercise-card', '.card', '.trainer-card', '.supplement-promo',
  ].join(',');
  const observed = new WeakSet();
  const revealObserver = new IntersectionObserver((entries) => {
    const entering = entries
      .filter((entry) => entry.isIntersecting)
      .map((entry) => {
        revealObserver.unobserve(entry.target);
        return entry.target;
      });
    if (!entering.length) return;
    gsap.fromTo(entering,
      { autoAlpha: 0, y: 15 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.48,
        ease: 'power2.out',
        stagger: 0.055,
        clearProps: 'opacity,visibility,transform',
        overwrite: 'auto',
      }
    );
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });

  function watchReveal(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(revealSelector) && !observed.has(root)) {
      observed.add(root);
      revealObserver.observe(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll(revealSelector).forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        revealObserver.observe(element);
      });
    }
  }

  watchReveal(document);
  const contentObserver = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) watchReveal(node);
    }));
  });
  contentObserver.observe(document.querySelector('main') || document.body, {
    childList: true,
    subtree: true,
  });

  const logoOrb = document.querySelector('.hero-art .orb');
  if (logoOrb) {
    gsap.to(logoOrb, {
      y: -7,
      rotation: 1,
      duration: 3.2,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    });
  }
})();
