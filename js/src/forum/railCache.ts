import app from 'flarum/forum/app';

/**
 * One request per rail widget per few minutes, not one per index visit.
 *
 * The rail is rebuilt every time the index page is entered, and a widget that
 * fetched in `oninit` asked again on every visit - and would ask on every
 * redraw if a theme ever remounted it. The promise is held at module level and
 * shared, so two mounts are two views of one answer. The server caches the
 * trending list for an hour anyway; five minutes here only spares the request.
 */
const TTL = 5 * 60 * 1000;
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

export default function railRequest<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const key = url + (params ? JSON.stringify(params) : '');
  const hit = cache.get(key);

  if (hit && Date.now() - hit.at < TTL) return hit.promise as Promise<T>;

  const promise = app.request<T>({ method: 'GET', url, params }).catch((e: unknown) => {
    // Rethrown, not swallowed: the widget that asked decides what a failure
    // looks like.
    // A failure is not remembered: the next visit tries again.
    cache.delete(key);
    throw e;
  });

  cache.set(key, { at: Date.now(), promise });

  return promise;
}
