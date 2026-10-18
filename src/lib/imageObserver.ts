/**
 * ZK Voice Hub - Progressive Image Intersection Observer Utility
 * 
 * Performance & LCP Optimization:
 * 1. Centralized singleton IntersectionObserver avoids creating multiple observer instances.
 * 2. Tuned rootMargin (250px) loads images just before they enter viewport to prevent pop-in.
 * 3. Defers 100% of network requests for off-screen images until scrolled near.
 * 4. Prioritizes LCP by keeping network pipelines free for hero banners and above-the-fold media.
 * 5. Automatic cleanup and memory-leak prevention via WeakMap.
 */

type ObserverCallback = (entry: IntersectionObserverEntry) => void;

let sharedObserver: IntersectionObserver | null = null;
const callbackMap = new WeakMap<Element, ObserverCallback>();

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return null;
  }

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cb = callbackMap.get(entry.target);
            if (cb) {
              cb(entry);
              callbackMap.delete(entry.target);
              sharedObserver?.unobserve(entry.target);
            }
          }
        });
      },
      {
        // 250px margin on all sides: loads smoothly before entering viewport
        // in both vertical page scrolling and horizontal carousels without network congestion
        rootMargin: '250px',
        threshold: 0.01,
      }
    );
  }

  return sharedObserver;
}

/**
 * Register an element for progressive viewport intersection loading.
 * Returns an unregister cleanup function.
 */
export function observeImageIntersection(
  element: Element | null,
  onIntersect: ObserverCallback
): () => void {
  if (!element || typeof window === 'undefined') {
    return () => {};
  }

  const observer = getSharedObserver();
  if (!observer) {
    // Fallback for browsers/environments without IntersectionObserver
    onIntersect({ isIntersecting: true, target: element } as IntersectionObserverEntry);
    return () => {};
  }

  callbackMap.set(element, onIntersect);
  observer.observe(element);

  return () => {
    callbackMap.delete(element);
    observer.unobserve(element);
  };
}

/**
 * Injects a high-priority <link rel="preload" as="image"> for critical LCP images (e.g. Hero Banner)
 */
export function preloadLCPImage(url?: string | null): void {
  if (typeof document === 'undefined' || !url) return;
  const clean = String(url).trim();
  if (!clean || clean.startsWith('data:') || clean.length < 5) return;

  try {
    const existing = document.querySelector(`link[rel="preload"][as="image"][href="${clean}"]`);
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = clean;
      link.setAttribute('fetchpriority', 'high');
      document.head.appendChild(link);
    }
  } catch {}
}
