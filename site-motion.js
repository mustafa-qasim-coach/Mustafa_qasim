(function () {
  const systemPrefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionEnabled = !systemPrefersReducedMotion;
  const gsapReady = !!window.gsap && motionEnabled;

  if (motionEnabled) document.documentElement.classList.add('motion-enabled');
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

  if (motionEnabled && typeof window.Lenis === 'function') {
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

  const macroScene = document.querySelector('.macro-scene');
  const macroFocusCopy = document.getElementById('macro-focus-copy');
  const macroCopy = {
    protein: 'مصادر بروتين: البيض، الدجاج، السمك، التونة والبقوليات. اختار الكمية من الحاسبة.',
    carbs: 'مصادر كارب: التمن، البطاطا، الشوفان، المعكرونة والبرغل. اختار الكمية من الحاسبة.',
    fats: 'دهون صحية: زيت الزيتون، المكسرات والطحينية. احسبها بالغرام لأن سعراتها مركّزة.',
  };
  document.querySelectorAll('[data-macro-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.macroChoice;
      if (!macroCopy[choice] || !macroScene) return;
      document.querySelectorAll('[data-macro-choice]').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      macroScene.dataset.active = choice;
      if (macroFocusCopy) macroFocusCopy.textContent = macroCopy[choice];
      macroScene.setAttribute('aria-label', `تصميم ثلاثي الأبعاد لمصادر ${button.textContent.trim()}`);
      window.updateAlarabin3DCategory?.(choice);
    });
  });

  const plateFoodLayer = document.getElementById('plate-food-layer');
  const plateMealChips = document.getElementById('plate-meal-chips');
  const plateName = document.getElementById('plate-current-name');
  const plateAmount = document.getElementById('plate-current-amount');
  const plateIcon = document.getElementById('plate-current-icon');
  const plateCount = document.getElementById('plate-food-count');
  function categoryForPlate(food) {
    const value = `${food?.category || ''} ${food?.name || ''}`;
    if (/بروتين|دجاج|صدر|لحم|سمك|تونة|لبن|روب|جبن|بقول|عدس|فاصوليا/i.test(value) || /(?:^|[^\u0621-\u064A])(?:بيض|بياض)(?=$|[^\u0621-\u064A])/u.test(value)) return 'protein';
    if (/كارب|رز|تمن|خبز|توست|بطاط|شوفان|معكرون|برغل|فاكه|تمر|سكر|عسل/i.test(value)) return 'carbs';
    if (/دهون|زيت|مكسر|طحيني|فول سوداني|أفوكادو/i.test(value)) return 'fats';
    return 'other';
  }
  function iconForPlate(food) {
    const name = food?.name || '';
    if (/دجاج|صدر|لحم|كباب/i.test(name)) return '🥩';
    if (/سمك|تونة/i.test(name)) return '🐟';
    if (/(?:^|[^\u0621-\u064A])(?:بيض|بياض)(?=$|[^\u0621-\u064A])/u.test(name)) return '🥚';
    if (/رز|تمن|برغل/i.test(name)) return '🍚';
    if (/بطاط/i.test(name)) return '🥔';
    if (/شوفان/i.test(name)) return '🥣';
    if (/خبز|توست/i.test(name)) return '🍞';
    if (/زيت|مكسر|طحيني|فول سوداني/i.test(name)) return '🥜';
    if (/فاكه|تفاح|موز|تمر/i.test(name)) return '🍎';
    if (/خضار|سلط|طماط|خيار/i.test(name)) return '🥗';
    if (/حليب|روب|لبن|جبن/i.test(name)) return '🥛';
    return '🍽️';
  }
  function makePlateToken(food, current = false) {
    const token = document.createElement('span');
    token.className = 'plate-food-token';
    token.dataset.category = categoryForPlate(food);
    token.dataset.current = String(current);
    token.title = `${food.name} · ${food.grams} ${food.unit}`;
    const icon = document.createElement('span');
    icon.className = 'plate-food-token-icon';
    icon.textContent = iconForPlate(food);
    const name = document.createElement('strong');
    name.textContent = food.name;
    const amount = document.createElement('small');
    amount.textContent = `${food.grams} ${food.unit}`;
    token.append(icon, name, amount);
    return token;
  }
  function updatePlate(event) {
    if (!plateFoodLayer || !plateMealChips) return;
    const selected = event.detail?.selected || null;
    const meal = Array.isArray(event.detail?.items) ? event.detail.items : [];
    plateFoodLayer.replaceChildren();
    const displayFoods = meal.map((food) => ({ ...food, current: false }));
    let selectedIndex = -1;
    if (selected) {
      for (let i = displayFoods.length - 1; i >= 0; i -= 1) {
        if (displayFoods[i].id === selected.id) { selectedIndex = i; break; }
      }
      if (selectedIndex < 0) displayFoods.unshift({ ...selected, current: true });
      else displayFoods[selectedIndex].current = true;
    }
    if (!displayFoods.length) {
      const empty = document.createElement('div');
      empty.className = 'plate-empty-state';
      const icon = document.createElement('span');
      icon.textContent = '🍽️';
      const title = document.createElement('b');
      title.textContent = 'الصحن جاهز';
      const hint = document.createElement('small');
      hint.textContent = 'اختار أكلة من القائمة';
      empty.append(icon, title, hint);
      plateFoodLayer.append(empty);
    } else {
      displayFoods.slice(0, 5).forEach((food) => plateFoodLayer.append(makePlateToken(food, food.current)));
      if (displayFoods.length > 5) {
        const more = document.createElement('span');
        more.className = 'plate-token-overflow';
        more.textContent = `+${displayFoods.length - 5}`;
        plateFoodLayer.append(more);
      }
    }
    plateMealChips.replaceChildren();
    if (meal.length) {
      meal.forEach((food) => {
        const chip = document.createElement('span');
        chip.className = 'plate-meal-chip';
        chip.dataset.category = categoryForPlate(food);
        chip.textContent = `${food.name} · ${food.grams} ${food.unit}`;
        plateMealChips.append(chip);
      });
    } else {
      const emptyChip = document.createElement('span');
      emptyChip.className = 'plate-empty-chip';
      emptyChip.textContent = 'أضف أكلة حتى تظهر هنا';
      plateMealChips.append(emptyChip);
    }
    if (plateName) plateName.textContent = selected?.name || 'اختار طعاماً من القائمة';
    if (plateAmount) plateAmount.textContent = selected ? `${selected.grams} ${selected.unit} · معاينة قبل الإضافة` : 'تظهر الكمية هنا';
    if (plateIcon) plateIcon.textContent = iconForPlate(selected);
    if (plateCount) plateCount.textContent = `${meal.length} ${meal.length === 1 ? 'صنف بالوجبة' : 'أصناف بالوجبة'}`;
    window.__alarabinPlateData = { selected, items: meal };
    window.updateAlarabin3DPlate?.(selected, meal);
    if (selected && macroScene) {
      const category = categoryForPlate(selected);
      if (['protein', 'carbs', 'fats'].includes(category)) {
        macroScene.dataset.active = category;
        window.updateAlarabin3DCategory?.(category);
        document.querySelectorAll('[data-macro-choice]').forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.macroChoice === category));
        });
      }
      if (macroFocusCopy) macroFocusCopy.textContent = `${selected.name} · ${selected.grams} ${selected.unit} — ظاهرة بالصحن. أضفها للوجبة حتى تدخل ضمن المجموع.`;
      macroScene.setAttribute('aria-label', `معاينة ${selected.name} بكمية ${selected.grams} ${selected.unit} على الصحن`);
    } else if (!selected && macroScene) {
      macroScene.setAttribute('aria-label', 'صحن تفاعلي يعرض الطعام الذي تختاره ومكونات وجبتك');
    }
  }
  window.addEventListener('alarabin:plate-update', updatePlate);
  document.addEventListener('DOMContentLoaded', () => {
    const foodSelect = document.getElementById('food-select');
    if (foodSelect?.value) foodSelect.dispatchEvent(new Event('change', { bubbles: true }));
    else updatePlate({ detail: { selected: null, items: [] } });
  }, { once: true });

  if (!motionEnabled) return;

  const revealSelector = [
    '.section-home-head', '.section-tile', '.section-head', '.hero-copy > *', '.hero-art', '.stat',
    '.result-card', '.athlete-card', '.plan-card', '.recipe-card',
    '.home-exercise-card', '.card', '.trainer-card', '.supplement-promo',
    '.nutrition-showcase', '.macro-card', '.food-source',
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
    if (gsapReady) {
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
      return;
    }

    entering.forEach((element, index) => {
      const animation = element.animate(
        [
          { opacity: 0, transform: 'translateY(22px) scale(.985)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: 620,
          delay: index * 75,
          easing: 'cubic-bezier(.22, 1, .36, 1)',
          fill: 'both',
        }
      );
      animation.onfinish = () => animation.cancel();
    });
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
  if (macroScene && gsapReady) {
    gsap.fromTo(macroScene,
      { autoAlpha: 0, y: 18, rotateX: 7 },
      { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.8, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }
    );
  }
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
    if (gsapReady) {
      gsap.to(logoOrb, {
        y: -7,
        rotation: 1,
        duration: 3.2,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    } else if (typeof logoOrb.animate === 'function') {
      logoOrb.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(0)' }],
        { duration: 3800, iterations: Infinity, easing: 'ease-in-out' }
      );
    }
  }
})();
