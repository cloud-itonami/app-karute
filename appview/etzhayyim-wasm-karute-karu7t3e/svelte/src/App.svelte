<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createRouter } from './lib/router.svelte';
  import { store } from './lib/store.svelte';

  import PhiBanner from './components/PhiBanner.svelte';
  import SuperAppTabBar from './components/SuperAppTabBar.svelte';

  import HomeView from './routes/HomeView.svelte';
  import PatientListView from './routes/PatientListView.svelte';
  import PatientDetailView from './routes/PatientDetailView.svelte';
  import SoapView from './routes/SoapView.svelte';
  import RxView from './routes/RxView.svelte';
  import VitalsView from './routes/VitalsView.svelte';
  import OrderView from './routes/OrderView.svelte';
  import OrdersView from './routes/OrdersView.svelte';
  import PharmacyView from './routes/PharmacyView.svelte';
  import PatientPortalView from './routes/PatientPortalView.svelte';
  import ZaitakuView from './routes/ZaitakuView.svelte';
  import TalkView from './routes/TalkView.svelte';

  const router = createRouter();
  onDestroy(() => router.destroy());

  function navigate(path: string) {
    router.navigate(path);
  }

  const session = $derived(store.state.session);
  const role = $derived(session?.role ?? 'MD');

  // Map current route → active tab id, applying role-aware home routing:
  //   - PHARM clinicians land on the dispense queue when they hit "/"
  //   - PATIENT lands on their portal when they hit "/"
  //   - everyone else lands on the clinical Home dashboard
  const activeTab = $derived.by<'home' | 'patients' | 'orders' | 'pharmacy' | 'portal' | 'talk'>(() => {
    const id = router.current.id;
    if (id === 'pharmacy') return 'pharmacy';
    if (id === 'portal') return 'portal';
    if (id === 'orders') return 'orders';
    if (id === 'talk') return 'talk';
    if (id === 'home') {
      if (role === 'PHARM') return 'pharmacy';
      if (role === 'PATIENT') return 'portal';
      return 'home';
    }
    return 'patients';
  });

  // Role-routed home: '/' delegates to the role-default view component.
  const isHomeRoute = $derived(router.current.id === 'home');
</script>

<div class="shell">
  {#if session}
    <PhiBanner role={session.role} facilityDid={session.facilityDid} />
  {/if}

  <main class="viewport">
    {#if isHomeRoute && role === 'PHARM'}
      <PharmacyView onNavigate={navigate} />
    {:else if isHomeRoute && role === 'PATIENT'}
      <PatientPortalView onNavigate={navigate} />
    {:else if router.current.id === 'home'}
      <HomeView onNavigate={navigate} />
    {:else if router.current.id === 'patients'}
      <PatientListView onNavigate={navigate} />
    {:else if router.current.id === 'patient'}
      <PatientDetailView patientDid={router.current.params.patientDid} onNavigate={navigate} />
    {:else if router.current.id === 'patient.soap'}
      <SoapView patientDid={router.current.params.patientDid} onNavigate={navigate} />
    {:else if router.current.id === 'patient.rx'}
      <RxView patientDid={router.current.params.patientDid} onNavigate={navigate} />
    {:else if router.current.id === 'patient.vitals'}
      <VitalsView patientDid={router.current.params.patientDid} onNavigate={navigate} />
    {:else if router.current.id === 'patient.order'}
      <OrderView patientDid={router.current.params.patientDid} onNavigate={navigate} />
    {:else if router.current.id === 'orders'}
      <OrdersView onNavigate={navigate} />
    {:else if router.current.id === 'pharmacy'}
      <PharmacyView onNavigate={navigate} />
    {:else if router.current.id === 'portal'}
      <PatientPortalView onNavigate={navigate} />
    {:else if router.current.id === 'zaitaku'}
      <ZaitakuView onNavigate={navigate} />
    {:else if router.current.id === 'talk'}
      <TalkView />
    {:else}
      <div class="placeholder">404</div>
    {/if}
  </main>

  {#if store.state.notifications.length > 0}
    <div class="toasts" aria-live="polite">
      {#each store.state.notifications.slice(-3) as n (n.id)}
        <button class="toast lvl-{n.level}" onclick={() => store.dismissNotification(n.id)} type="button">
          {n.text}
        </button>
      {/each}
    </div>
  {/if}

  <SuperAppTabBar {activeTab} {role} onNavigate={navigate} />
</div>

<style>
  .shell {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--gv2-bg-primary);
    position: relative;
  }
  .viewport {
    flex: 1;
    width: 100%;
    box-sizing: border-box;
  }
  .placeholder {
    padding: 80px 16px;
    text-align: center;
    color: var(--gv2-text-muted);
  }
  .toasts {
    position: fixed;
    bottom: 72px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 32px);
    max-width: 560px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 20;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    text-align: left;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    border: 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    color: white;
  }
  .toast.lvl-info { background: #0ea5e9; }
  .toast.lvl-warning { background: #f59e0b; }
  .toast.lvl-critical { background: #dc2626; }
</style>
