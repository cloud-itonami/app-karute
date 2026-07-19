<script lang="ts">
  interface Tab {
    id: 'home' | 'patients' | 'orders' | 'pharmacy' | 'portal' | 'talk';
    path: string;
    label: string;
    icon: string;
  }

  interface Props {
    activeTab: Tab['id'];
    role?: 'MD' | 'NP' | 'RN' | 'PHARM' | 'ADMIN' | 'PATIENT';
    onNavigate: (path: string) => void;
  }

  const { activeTab, role = 'MD', onNavigate }: Props = $props();

  // Role-specific tab sets. Clinicians (MD/NP/RN) get the patient chart workflow;
  // pharmacists get the dispense queue; patients see their portal.
  const TABS_CLINICAL: Tab[] = [
    { id: 'home', path: '/', label: 'Home', icon: '◐' },
    { id: 'patients', path: '/patients', label: 'Chart', icon: '◰' },
    { id: 'orders', path: '/orders', label: 'Orders', icon: '◱' },
    { id: 'talk', path: '/talk', label: 'Talk', icon: '◑' },
  ];
  const TABS_PHARM: Tab[] = [
    { id: 'pharmacy', path: '/pharmacy', label: '調剤', icon: '◐' },
    { id: 'patients', path: '/patients', label: 'Patient', icon: '◰' },
    { id: 'orders', path: '/orders', label: 'Orders', icon: '◱' },
    { id: 'talk', path: '/talk', label: 'Talk', icon: '◑' },
  ];
  const TABS_PATIENT: Tab[] = [
    { id: 'portal', path: '/portal', label: 'My Chart', icon: '◐' },
    { id: 'talk', path: '/talk', label: 'Talk', icon: '◑' },
  ];

  const tabs = $derived.by<Tab[]>(() => {
    if (role === 'PHARM') return TABS_PHARM;
    if (role === 'PATIENT') return TABS_PATIENT;
    return TABS_CLINICAL;
  });
</script>

<nav class="tabbar" aria-label="Primary">
  {#each tabs as t (t.id)}
    <button
      type="button"
      class="tab"
      class:active={activeTab === t.id}
      onclick={() => onNavigate(t.path)}
      aria-current={activeTab === t.id ? 'page' : undefined}
    >
      <span class="icon" aria-hidden="true">{t.icon}</span>
      <span class="label">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tabbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    background: var(--gv2-bg-card);
    border-top: 1px solid var(--gv2-border);
    padding: 4px max(env(safe-area-inset-left), 8px) calc(env(safe-area-inset-bottom) + 4px) max(env(safe-area-inset-right), 8px);
    z-index: 10;
  }
  .tab {
    flex: 1 1 0;
    max-width: 150px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    background: transparent;
    border: 0;
    color: var(--gv2-text-muted);
    transition: color 120ms ease;
  }
  .tab.active {
    color: var(--gv2-accent);
  }
  .icon { font-size: 22px; line-height: 1; }
  .label { font-size: 11px; font-weight: 500; letter-spacing: 0.02em; }
</style>
