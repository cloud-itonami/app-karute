// Hash-based mini router using Svelte 5 runes.
// No SvelteKit, no SSR — designed to ship as a single static bundle behind a CF Worker edge proxy.

export type RouteId =
  | 'home'
  | 'patients'
  | 'patient'
  | 'patient.soap'
  | 'patient.rx'
  | 'patient.vitals'
  | 'patient.order'
  | 'orders'
  | 'pharmacy'
  | 'portal'
  | 'zaitaku'
  | 'talk';

export interface Route {
  id: RouteId;
  params: Record<string, string>;
}

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (!raw) return { id: 'home', params: {} };

  const [path, query] = raw.split('?');
  const segments = path.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  if (query) {
    for (const pair of query.split('&')) {
      const [k, v] = pair.split('=');
      if (k) params[k] = decodeURIComponent(v ?? '');
    }
  }

  // /                       -> home
  // /patients               -> patients
  // /patients/:did          -> patient
  // /patients/:did/soap     -> patient.soap
  // /patients/:did/rx       -> patient.rx
  // /patients/:did/vitals   -> patient.vitals
  // /patients/:did/order    -> patient.order
  // /orders                 -> orders
  // /talk                   -> talk

  if (segments[0] === 'orders') return { id: 'orders', params };
  if (segments[0] === 'pharmacy') return { id: 'pharmacy', params };
  if (segments[0] === 'portal') return { id: 'portal', params };
  if (segments[0] === 'zaitaku') return { id: 'zaitaku', params };
  if (segments[0] === 'talk') return { id: 'talk', params };
  if (segments[0] === 'patients') {
    if (!segments[1]) return { id: 'patients', params };
    params.patientDid = decodeURIComponent(segments[1]);
    const action = segments[2];
    if (action === 'soap') return { id: 'patient.soap', params };
    if (action === 'rx') return { id: 'patient.rx', params };
    if (action === 'vitals') return { id: 'patient.vitals', params };
    if (action === 'order') return { id: 'patient.order', params };
    return { id: 'patient', params };
  }
  return { id: 'home', params };
}

export function createRouter() {
  let route = $state<Route>(parseHash(window.location.hash));

  const handler = () => {
    route = parseHash(window.location.hash);
  };
  window.addEventListener('hashchange', handler);

  return {
    get current() {
      return route;
    },
    navigate(path: string) {
      window.location.hash = path.startsWith('#') ? path : `#${path}`;
    },
    destroy() {
      window.removeEventListener('hashchange', handler);
    },
  };
}
