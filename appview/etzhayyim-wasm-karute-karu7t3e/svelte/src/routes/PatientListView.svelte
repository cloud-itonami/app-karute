<script lang="ts">
  import { listPatients } from '../lib/api/karute-client';
  import { store } from '../lib/store.svelte';
  import PatientCard from '../components/PatientCard.svelte';

  interface Props {
    onNavigate: (path: string) => void;
  }
  const { onNavigate }: Props = $props();

  let q = $state('');
  let error = $state<string | null>(null);

  $effect(() => {
    void load();
  });

  async function load() {
    store.setLoadingPatients(true);
    error = null;
    try {
      const r = await listPatients({ limit: 100, q: q || undefined });
      store.setPatients(r.items);
    } catch (e) {
      // In Phase 1 the backend may be absent; seed a mock list so the UI is exercisable.
      store.setPatients([
        { rkey: '3lab1', patientDid: 'did:plc:abc1tanaka', encryptedCid: 'bafy-mock-aaa', registeredAt: '2026-04-12T09:00:00Z', facilityDid: 'did:web:sample-clinic.etzhayyim.com', publicAlias: '田中 (anon)' },
        { rkey: '3lab2', patientDid: 'did:plc:def2sato', encryptedCid: 'bafy-mock-bbb', registeredAt: '2026-04-13T10:00:00Z', facilityDid: 'did:web:sample-clinic.etzhayyim.com', publicAlias: '佐藤 (anon)' },
        { rkey: '3lab3', patientDid: 'did:plc:ghi3suzuki', encryptedCid: 'bafy-mock-ccc', registeredAt: '2026-04-14T11:00:00Z', facilityDid: 'did:web:sample-clinic.etzhayyim.com', publicAlias: '鈴木 (anon)' },
        { rkey: '3lab4', patientDid: 'did:plc:jkl4takahashi', encryptedCid: 'bafy-mock-ddd', registeredAt: '2026-04-15T13:30:00Z', facilityDid: 'did:web:sample-clinic.etzhayyim.com', publicAlias: '高橋 (anon)' },
      ]);
      error = '(オフライン — モックデータ表示)';
    } finally {
      store.setLoadingPatients(false);
    }
  }

  function selectPatient(did: string) {
    store.selectPatient(did);
    onNavigate(`/patients/${encodeURIComponent(did)}`);
  }
</script>

<section class="patients">
  <header class="hdr">
    <h2>患者一覧</h2>
    <button class="add" onclick={() => alert('新患登録は Phase 2 で実装')} type="button">+ 新患</button>
  </header>

  <div class="search">
    <input
      type="search"
      placeholder="public alias で検索 (PHI 不可)"
      bind:value={q}
      oninput={() => { /* debounce omitted in Phase 1 */ }}
    />
    <button type="button" class="refresh" onclick={load} aria-label="再読込">↻</button>
  </div>

  {#if error}<div class="note">{error}</div>{/if}

  {#if store.state.loadingPatients}
    <div class="loading">読込中…</div>
  {:else}
    <div class="list">
      {#each store.state.patients as p (p.patientDid)}
        <PatientCard patient={p} onSelect={selectPatient} />
      {:else}
        <div class="empty">該当患者なし</div>
      {/each}
    </div>
  {/if}

  <div class="phi-note">
    🔒 一覧は public alias / DID / 登録日のみ。氏名・生年月日・住所等は患者選択後に read-cap で復号。
  </div>
</section>

<style>
  .patients { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .add { background: var(--gv2-accent); color: white; border: 0; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 600; }
  .search { display: flex; gap: 8px; }
  .search input { flex: 1; background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 8px; padding: 10px 12px; font-size: 14px; color: var(--gv2-text-primary); }
  .refresh { background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 8px; width: 40px; font-size: 16px; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .empty, .loading { padding: 32px; text-align: center; color: var(--gv2-text-muted); font-size: 13px; }
  .note { font-size: 11px; color: var(--gv2-text-muted); padding: 6px; }
  .phi-note { font-size: 10px; color: var(--gv2-text-muted); text-align: center; padding: 8px 4px 0; border-top: 1px dashed var(--gv2-border); }
</style>
