(() => {
  const grid = document.getElementById('home-exercise-grid');
  if (!grid) return;
  const svgNS = 'http://www.w3.org/2000/svg';

  function enhance(card) {
    const svg = card.querySelector('.home-exercise-art svg');
    if (!svg || svg.dataset.polished === 'true') return;
    const key = (card.dataset.homeId || `home-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '-');
    const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(svgNS, 'defs'), svg.firstChild);
    const gradient = document.createElementNS(svgNS, 'linearGradient');
    gradient.id = `home-skin-${key}`;
    gradient.setAttribute('x1', '0'); gradient.setAttribute('y1', '0');
    gradient.setAttribute('x2', '1'); gradient.setAttribute('y2', '1');
    [['0%', '#f1cda9'], ['42%', '#d2a17d'], ['100%', '#a87655']].forEach(([offset, color]) => {
      const stop = document.createElementNS(svgNS, 'stop');
      stop.setAttribute('offset', offset); stop.setAttribute('stop-color', color); gradient.appendChild(stop);
    });
    defs.appendChild(gradient);
    svg.querySelectorAll('[fill="#dce5d8"]').forEach(part => {
      part.classList.add('home-art-body-fill');
      part.setAttribute('fill', `url(#${gradient.id})`);
      part.setAttribute('stroke', '#684a35');
      part.setAttribute('stroke-width', '2.4');
      part.setAttribute('stroke-linejoin', 'round');
      part.setAttribute('paint-order', 'stroke fill');
    });
    svg.querySelectorAll('[stroke="#dce5d8"]').forEach(part => {
      part.classList.add('home-art-body-line');
      part.setAttribute('stroke', '#d0a07b');
      part.setAttribute('stroke-width', String((Number(part.getAttribute('stroke-width')) || 10) + 1.5));
      part.setAttribute('stroke-linecap', 'round');
      part.setAttribute('stroke-linejoin', 'round');
    });
    svg.querySelectorAll('[stroke="#b7c1b3"]').forEach(part => part.setAttribute('stroke', '#9b8069'));
    svg.dataset.polished = 'true';
  }

  grid.querySelectorAll('.home-exercise-card').forEach(enhance);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    if (node.matches?.('.home-exercise-card')) enhance(node);
    node.querySelectorAll?.('.home-exercise-card').forEach(enhance);
  }))).observe(grid, { childList: true });
})();
