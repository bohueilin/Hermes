import { el } from './dom.js';
import { FILM_URL, POSTER_URL } from './hero-media.js';

/** Optional motion; the poster and product actions never depend on video playback. */
export function createHeroFilm({ filmUrl = FILM_URL, posterUrl = POSTER_URL, reducedMotion } = {}) {
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
    class: 'film-video', playsinline: true, loop: true, preload: 'none',
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

  let active = false, visible = false, destroyed = false;
  let userPaused = false, optedIn = false, blocked = false, pending = false;
  let generation = 0;
  const view = document.defaultView;
  const motion = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced = () => reducedMotion ? reducedMotion() : Boolean(motion?.matches);
  let lastReduced = reduced();
  const connection = view?.navigator?.connection;
  const canObserve = typeof view?.IntersectionObserver === 'function';
  const allowed = () => (canObserve || optedIn) && !destroyed && active && visible &&
    !document.hidden && !userPaused && !blocked &&
    (optedIn || (!reduced() && !connection?.saveData));

  function label() {
    const playing = video.paused === false && !destroyed;
    const loading = pending && allowed();
    button.textContent = playing ? 'Pause film' : loading ? 'Cancel loading' : 'Play film';
    button.setAttribute('aria-label', playing ? 'Pause concept film' : loading ? 'Cancel film loading' : 'Play concept film');
  }
  function pause() {
    generation += 1;
    video.pause?.();
    label();
  }
  function failure() {
    blocked = true;
    pause();
    poster.hidden = false;
    video.classList.remove('is-playing');
    status.textContent = 'Film unavailable. The concept image is shown.';
  }
  function reconcile() {
    const currentReduced = reduced();
    if (currentReduced !== lastReduced) { lastReduced = currentReduced; optedIn = false; }
    if (!allowed()) { pause(); return; }
    if (pending || video.paused === false || typeof video.play !== 'function') { label(); return; }
    if (!video.getAttribute('src')) video.setAttribute('src', filmUrl);
    const attempt = ++generation;
    pending = true;
    let result;
    try { result = video.play(); }
    catch { pending = false; failure(); return; }
    label();
    Promise.resolve(result).then(() => {
      pending = false;
      if (attempt !== generation || !allowed()) {
        pause();
        // Visibility may have changed away and back while this attempt settled.
        // Only a still-permitted state gets a fresh attempt; denied playback stays blocked.
        if (allowed()) reconcile();
        return;
      }
      label();
    }, (error) => {
      pending = false;
      if (destroyed) return;
      if (attempt !== generation && error?.name === 'AbortError') {
        // Our pause can abort a pending play. Resume only after a state change
        // invalidated that request, and only if the current state allows it.
        if (allowed()) reconcile();
        else label();
      } else failure(); // A denial, including a stale denial, never retries automatically.
    });
  }
  function playing() {
    if (!allowed()) { pause(); return; }
    poster.hidden = true;
    video.classList.add('is-playing');
    status.textContent = '';
    label();
  }
  function click() {
    if (destroyed) return;
    if (video.paused === false || (pending && allowed())) { userPaused = true; pause(); }
    else { userPaused = false; optedIn = true; blocked = false; reconcile(); }
  }
  const preference = () => { optedIn = false; reconcile(); };
  const visibility = () => reconcile();
  video.addEventListener('play', label);
  video.addEventListener('playing', playing);
  video.addEventListener('pause', label);
  video.addEventListener('error', failure);
  button.addEventListener('click', click);
  document.addEventListener('visibilitychange', visibility);
  motion?.addEventListener?.('change', preference);
  connection?.addEventListener?.('change', preference);
  const observer = canObserve ? new view.IntersectionObserver((entries) => {
    visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0);
    reconcile();
  }, { threshold: 0.05 }) : null;
  observer?.observe(element);
  // Without an observer, require deliberate playback rather than guessing autoplay visibility.
  if (!observer) visible = true;

  return {
    element,
    setActive(value) {
      active = Boolean(value);
      if (!observer && !optedIn) return;
      reconcile();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      pause();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion?.removeEventListener?.('change', preference);
      connection?.removeEventListener?.('change', preference);
      button.removeEventListener('click', click);
      video.removeEventListener('play', label);
      video.removeEventListener('playing', playing);
      video.removeEventListener('pause', label);
      video.removeEventListener('error', failure);
      video.removeAttribute('src');
      video.load?.();
    },
  };
}
