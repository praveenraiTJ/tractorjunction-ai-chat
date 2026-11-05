// postMessage channel between the widget iframe and public/widget.js on the host page
import { PageContext } from './types';

const SOURCE_WIDGET = 'tj-kisan-widget';
const SOURCE_LOADER = 'tj-kisan-loader';

export const isEmbedded = window.parent !== window;

const allowedParent = (origin: string) =>
  // TJ production + tractorfirst.com dev/staging hosts
  /^https:\/\/([a-z0-9-]+\.)*(tractorjunction|tractorfirst)\.com$/.test(origin) ||
  (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

// The embedding page's origin: passed by widget.js as ?parent= (document.referrer is often stripped
// by Referrer-Policy), then confirmed by the loader's first message
let parentOrigin: string | null = (() => {
  const origin = new URLSearchParams(window.location.search).get('parent');
  return origin && allowedParent(origin) ? origin : null;
})();

function post(type: string, payload: Record<string, unknown> = {}) {
  if (!isEmbedded || !parentOrigin) return;
  window.parent.postMessage({ source: SOURCE_WIDGET, type, ...payload }, parentOrigin);
}

export const notifyReady = () => post('ready');
export const requestClose = () => post('close');
export const notifyUnread = (count: number) => post('unread', { count });

export function openUrl(url: string) {
  if (isEmbedded && parentOrigin) post('open_url', { url });
  else window.open(url, '_blank', 'noopener');
}

export function onParentMessage(handler: (msg: { type: string; context?: PageContext; open?: boolean }) => void) {
  const listener = (event: MessageEvent) => {
    if (!allowedParent(event.origin) || event.data?.source !== SOURCE_LOADER) return;
    parentOrigin = event.origin;
    handler(event.data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
