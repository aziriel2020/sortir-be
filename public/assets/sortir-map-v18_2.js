(() => {
  'use strict';

  const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
  const BELGIUM_BOUNDS = [[2.2, 49.3], [6.7, 51.8]];
  const ACCENTS = {
    lime: '#91bc22',
    pink: '#df5d87',
    violet: '#7566d8',
    cyan: '#3da7b6',
    orange: '#dc8a38'
  };

  let map = null;
  let panel = null;
  let markers = [];
  let userMarker = null;
  let lastSignature = '';
  let resizeObserver = null;
  let mutationObserver = null;
  let syncQueued = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Exact inverse of the published SORTIR.BE D() projection used to turn
  // Belgian lon/lat into the old percentage-based marker coordinates.
  function percentageToLngLat(x, y) {
    const safeX = clamp(Number(x) || 50, 0, 100);
    const safeY = clamp(Number(y) || 50, 0, 100);
    return [
      2.2 + (safeX / 100) * 4.5,
      51.75 - (safeY / 100) * 2.45
    ];
  }

  function originalMarkerButtons() {
    if (!panel) return [];
    return [...panel.querySelectorAll(':scope > button.map-marker')];
  }

  function markerSignature(buttons) {
    return buttons.map((button) => [
      button.getAttribute('aria-label') || '',
      button.style.left || '',
      button.style.top || '',
      button.className || ''
    ].join('|')).join('~~');
  }

  function markerAccent(button) {
    for (const key of Object.keys(ACCENTS)) {
      if (button.classList.contains(key)) return key;
    }
    return 'cyan';
  }

  function createMarkerElement(button, index) {
    const accent = markerAccent(button);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `sortir-real-marker ${accent}`;
    el.setAttribute('aria-label', button.getAttribute('aria-label') || `Événement ${index + 1}`);
    el.title = button.getAttribute('aria-label') || '';
    el.style.setProperty('--real-marker', ACCENTS[accent] || ACCENTS.cyan);
    el.innerHTML = `<span>${index + 1}</span>`;

    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.click();
    });

    el.addEventListener('mouseenter', () => button.dispatchEvent(new Event('mouseenter', { bubbles: true })));
    el.addEventListener('focus', () => button.dispatchEvent(new Event('focus', { bubbles: true })));

    return el;
  }

  function clearMarkers() {
    for (const marker of markers) marker.remove();
    markers = [];
  }

  function fitToMarkers(points) {
    if (!map || !map.loaded()) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!points.length) {
      map.fitBounds(BELGIUM_BOUNDS, {
        padding: { top: 92, right: 42, bottom: 70, left: 42 },
        duration: reducedMotion ? 0 : 500,
        maxZoom: 8
      });
      return;
    }

    if (points.length === 1) {
      const [lng, lat] = points[0];
      map.easeTo({
        center: [lng, lat],
        zoom: 10.2,
        duration: reducedMotion ? 0 : 450
      });
      return;
    }

    const bounds = points.reduce(
      (acc, coord) => acc.extend(coord),
      new maplibregl.LngLatBounds(points[0], points[0])
    );

    map.fitBounds(bounds, {
      padding: { top: 94, right: 52, bottom: 76, left: 52 },
      duration: reducedMotion ? 0 : 500,
      maxZoom: 10.5
    });
  }

  function syncMarkers({ forceFit = false } = {}) {
    if (!map || !panel || !map.loaded()) return;

    const buttons = originalMarkerButtons();
    const signature = markerSignature(buttons);
    if (!forceFit && signature === lastSignature) return;
    lastSignature = signature;

    clearMarkers();
    const points = [];

    buttons.forEach((button, index) => {
      const x = parseFloat(button.style.left);
      const y = parseFloat(button.style.top);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const coord = percentageToLngLat(x, y);
      points.push(coord);

      const element = createMarkerElement(button, index);
      const marker = new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat(coord)
        .addTo(map);
      markers.push(marker);
    });

    // Let the browser finish the marker DOM insertion before fitting.
    requestAnimationFrame(() => fitToMarkers(points));
  }

  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncMarkers();
    });
  }

  function locateUser(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!map || !navigator.geolocation) return;

    const button = panel?.querySelector('.map-topbar button');
    button?.classList.add('is-locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        button?.classList.remove('is-locating');
        const coord = [position.coords.longitude, position.coords.latitude];

        if (userMarker) userMarker.remove();
        const userEl = document.createElement('span');
        userEl.className = 'sortir-user-marker';
        userEl.setAttribute('aria-label', 'Votre position');
        userMarker = new maplibregl.Marker({ element: userEl, anchor: 'center' })
          .setLngLat(coord)
          .addTo(map);

        map.easeTo({ center: coord, zoom: 12.5, duration: 550 });
      },
      () => button?.classList.remove('is-locating'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
    );
  }

  function installLocateButton() {
    const button = panel?.querySelector('.map-topbar button');
    if (!button || button.dataset.realMapLocate === '1') return;
    button.dataset.realMapLocate = '1';
    button.addEventListener('click', locateUser, true);
  }

  function initialize() {
    panel = document.querySelector('.map-panel#carte');
    if (!panel || panel.dataset.realMap === '1') return;
    panel.dataset.realMap = '1';

    const canvas = document.createElement('div');
    canvas.className = 'sortir-real-map';
    canvas.setAttribute('aria-hidden', 'true');
    panel.prepend(canvas);

    installLocateButton();

    if (!window.maplibregl) {
      panel.classList.add('real-map-failed');
      console.warn('[SORTIR.BE] MapLibre unavailable — keeping static map fallback.');
      return;
    }

    try {
      map = new maplibregl.Map({
        container: canvas,
        style: MAP_STYLE,
        bounds: BELGIUM_BOUNDS,
        fitBoundsOptions: {
          padding: { top: 92, right: 42, bottom: 70, left: 42 },
          maxZoom: 8
        },
        attributionControl: true,
        cooperativeGestures: false,
        pitchWithRotate: false,
        dragRotate: false
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      map.once('load', () => {
        panel.classList.add('real-map-ready');
        canvas.removeAttribute('aria-hidden');
        map.resize();
        syncMarkers({ forceFit: true });
      });

      map.on('error', (event) => {
        if (!panel.classList.contains('real-map-ready')) {
          console.warn('[SORTIR.BE] Real map loading issue — static fallback retained.', event?.error || event);
        }
      });

      resizeObserver = new ResizeObserver(() => {
        if (!map) return;
        map.resize();
      });
      resizeObserver.observe(panel);

      mutationObserver = new MutationObserver(scheduleSync);
      mutationObserver.observe(panel, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'aria-label']
      });

      window.addEventListener('orientationchange', () => {
        window.setTimeout(() => {
          map?.resize();
          syncMarkers({ forceFit: true });
        }, 120);
      }, { passive: true });

      window.addEventListener('hashchange', () => {
        if (location.hash === '#carte') {
          window.setTimeout(() => {
            map?.resize();
            syncMarkers({ forceFit: true });
          }, 350);
        }
      });
    } catch (error) {
      panel.classList.add('real-map-failed');
      console.error('[SORTIR.BE] Real map initialization failed — static fallback retained.', error);
    }
  }

  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
      initialize();
    }
  }

  boot();
})();
