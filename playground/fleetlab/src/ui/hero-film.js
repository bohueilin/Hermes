import { el } from './dom.js';
import { FILM_URL, POSTER_URL } from './hero-media.js';

// Homepage-only rollback: false keeps the same asset behind explicit Play.
export const FILM_AUTOPLAY = true;

// A document survives BFCache and component remounts; a new navigation gets a new visit.
const filmVisits = new WeakSet();

/** Optional, silent, once-through motion. The poster and product actions never depend on playback. */
export function createHeroFilm({ filmUrl = FILM_URL, posterUrl = POSTER_URL, autoplay = FILM_AUTOPLAY, reducedMotion } = {}) {
  if (filmUrl && !/^\.\/media\/[a-z0-9-]+\.mp4$/.test(filmUrl)) {
    throw new Error('Film must use a local media path');
  }
  if (!/^\.\/media\/[a-z0-9-]+\.webp$/.test(posterUrl) &&
      !/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(posterUrl)) {
    throw new Error('Poster must use local image data');
  }
  const poster = el('img', {
    class: 'film-poster', src: posterUrl, width: 1280, height: 720,
    alt: 'An electric AV travels along a sunny waterfront beside a promenade.',
  });
  const element = el('div', { class: 'hero-film' }, poster);
  if (!filmUrl) return { element, setActive() {}, destroy() {} };

  const video = el('video', {
    class: 'film-video', playsinline: true, preload: 'none', width: 1280, height: 720,
    'aria-hidden': 'true', tabindex: '-1',
  });
  video.muted = true;
  const button = el('button', {
    class: 'film-control', type: 'button', 'aria-label': 'Play concept film',
  }, 'Play film');
  const status = el('span', { class: 'film-status', role: 'status' });
  element.appendChild(video);
  element.appendChild(button);
  element.appendChild(status);

  const doc = document, view = doc.defaultView;
  const motion = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const dataMotion = view?.matchMedia?.('(prefers-reduced-data: reduce)');
  const connection = view?.navigator?.connection;
  const reduced = () => reducedMotion ? reducedMotion() : Boolean(motion?.matches);
  const saving = () => Boolean(connection?.saveData || dataMotion?.matches);
  let lastReduced = reduced(), lastSaving = saving();
  let active = false, visible = false, destroyed = false, away = false;
  let state = 'poster', intent = null, pending = null, generation = 0;
  const eligible = () => !destroyed && active && visible && !doc.hidden && !away;
  const allowed = () => intent !== null && eligible();

  function label() {
    const playing = allowed() && video.paused === false;
    const loading = pending && allowed();
    const action = playing ? 'Pause' : loading ? 'Cancel' : state === 'ended' ? 'Replay' : 'Play';
    button.textContent = action === 'Cancel' ? 'Cancel loading' : action + ' film';
    button.setAttribute('aria-label', action === 'Cancel' ? 'Cancel film loading' : action + ' concept film');
  }
  function pause() {
    generation += 1;
    video.pause?.();
    label();
  }
  function cancel(next) {
    intent = null;
    state = next;
    filmVisits.add(doc);
    pause();
  }
  function failure() {
    if (destroyed) return;
    cancel('blocked');
    poster.hidden = false;
    video.classList.remove('is-playing');
    status.textContent = 'Film unavailable. The concept image is shown.';
  }
  function reconcile() {
    if (destroyed) return;
    const currentReduced = reduced(), currentSaving = saving();
    const veto = (!lastReduced && currentReduced) || (!lastSaving && currentSaving);
    lastReduced = currentReduced;
    lastSaving = currentSaving;
    if (veto) cancel(state === 'ended' ? 'ended' : 'preferencePaused');
    if (!eligible()) {
      // Manual playback overrides a preference for this visible instance only.
      if (intent && (currentReduced || currentSaving)) cancel('preferencePaused');
      if (intent && state !== 'visibilityPaused') { state = 'visibilityPaused'; pause(); }
      else label();
      return;
    }
    // No network API is a missing signal, not a bandwidth estimate. Only the one
    // bounded film is eligible; explicit save-data/reduced-data signals veto it.
    if (!intent && state === 'poster' && autoplay && observer && !filmVisits.has(doc) && !currentReduced && !currentSaving) {
      intent = 'automatic';
      filmVisits.add(doc);
    }
    if (!allowed() || pending || video.paused === false || typeof video.play !== 'function') { label(); return; }
    if (!video.getAttribute('src')) video.setAttribute('src', filmUrl);
    const attempt = ++generation;
    pending = { generation: attempt };
    state = 'starting';
    let result;
    try { result = video.play(); }
    catch { pending = null; failure(); return; }
    label();
    Promise.resolve(result).then(() => {
      pending = null;
      if (attempt !== generation || !allowed()) {
        pause();
        // Serialize requests: stale media cannot satisfy a newer intent. A still
        // eligible intent gets its own play request only after the old one settles.
        if (allowed()) reconcile();
        return;
      }
      label();
    }, (error) => {
      pending = null;
      if (destroyed) return;
      if (attempt !== generation && error?.name === 'AbortError') {
        if (allowed()) reconcile();
        else label();
      } else failure(); // A denial, including a stale denial, never retries automatically.
    });
  }
  function playing() {
    if (video.paused !== false) { label(); return; }
    if (!allowed() || (pending && pending.generation !== generation)) { pause(); return; }
    state = 'playing';
    poster.hidden = true;
    video.classList.add('is-playing');
    status.textContent = '';
    label();
  }
  function playEvent() {
    if (!allowed() || (pending && pending.generation !== generation)) pause();
    else label();
  }
  function ended() {
    if (!allowed() || (pending && pending.generation !== generation)) return;
    cancel('ended');
  }
  function click() {
    if (destroyed) return;
    if (video.paused === false || (pending && allowed())) cancel('userPaused');
    else {
      if (state === 'ended') video.currentTime = 0;
      intent = 'manual';
      state = 'starting';
      filmVisits.add(doc);
      status.textContent = '';
      reconcile();
    }
  }
  const visibility = () => reconcile();
  const departure = () => { away = true; reconcile(); };
  const restoration = () => { away = false; reconcile(); };
  video.addEventListener('play', playEvent);
  video.addEventListener('playing', playing);
  video.addEventListener('pause', label);
  video.addEventListener('ended', ended);
  video.addEventListener('error', failure);
  button.addEventListener('click', click);
  doc.addEventListener('visibilitychange', visibility);
  motion?.addEventListener?.('change', visibility);
  dataMotion?.addEventListener?.('change', visibility);
  connection?.addEventListener?.('change', visibility);
  view?.addEventListener('pagehide', departure);
  view?.addEventListener('pageshow', restoration);

  function sufficientlyVisible(entry) {
    if (!entry.isIntersecting) return false;
    const bounds = entry.boundingClientRect, intersection = entry.intersectionRect;
    const viewportHeight = entry.rootBounds?.height ?? view?.innerHeight;
    if (bounds?.height > viewportHeight && intersection) {
      return intersection.width > 0 && intersection.height >= viewportHeight / 2;
    }
    return entry.intersectionRatio >= 0.5;
  }
  const observer = typeof view?.IntersectionObserver === 'function' ? new view.IntersectionObserver((entries) => {
    visible = entries.some(sufficientlyVisible);
    reconcile();
  }, { threshold: [0, 0.5, 1] }) : null;
  observer?.observe(element);
  function geometry() {
    if (!observer || destroyed) return;
    const rect = element.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, view.innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, view.innerHeight) - Math.max(rect.top, 0));
    visible = sufficientlyVisible({ isIntersecting: width > 0 && height > 0,
      intersectionRatio: width * height / (rect.width * rect.height),
      boundingClientRect: rect, intersectionRect: { width, height } });
    reconcile();
  }
  // Scroll/resize also cover oversized frames crossing the viewport-height boundary
  // between IntersectionObserver's area thresholds. Unknown geometry stays static.
  view?.addEventListener('scroll', geometry, { passive: true });
  view?.addEventListener('resize', geometry);
  if (!observer) visible = true; // Manual playback remains available; automatic playback needs measured visibility.

  return {
    element,
    setActive(value) {
      if (destroyed) return;
      if (active && !value) cancel(state === 'ended' ? 'ended' : 'routePaused');
      active = Boolean(value);
      reconcile();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      intent = null;
      pause();
      observer?.disconnect();
      doc.removeEventListener('visibilitychange', visibility);
      motion?.removeEventListener?.('change', visibility);
      dataMotion?.removeEventListener?.('change', visibility);
      connection?.removeEventListener?.('change', visibility);
      view?.removeEventListener('pagehide', departure);
      view?.removeEventListener('pageshow', restoration);
      view?.removeEventListener('scroll', geometry);
      view?.removeEventListener('resize', geometry);
      button.removeEventListener('click', click);
      video.removeEventListener('play', playEvent);
      video.removeEventListener('playing', playing);
      video.removeEventListener('pause', label);
      video.removeEventListener('ended', ended);
      video.removeEventListener('error', failure);
      video.removeAttribute('src');
      video.load?.();
    },
  };
}
