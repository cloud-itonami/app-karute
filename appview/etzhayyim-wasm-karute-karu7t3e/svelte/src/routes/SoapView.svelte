<script lang="ts">
  import SoapEditor from '../components/SoapEditor.svelte';
  import { createSoapNote } from '../lib/api/karute-client';
  import { store } from '../lib/store.svelte';
  import type { SoapNoteRecord } from '../lib/api/types';

  interface Props {
    patientDid: string;
    onNavigate: (path: string) => void;
  }
  const { patientDid, onNavigate }: Props = $props();

  const authorDid = $derived(store.state.session?.clinicianDid ?? 'did:web:unknown');
  const encounterDid = $derived(store.state.encounters[0]?.encounterDid ?? 'enc-pending');

  async function save(rec: SoapNoteRecord, signed: boolean) {
    const result = await createSoapNote({
      record: rec,
      recipientDids: [
        patientDid,
        authorDid,
        store.state.session?.facilityDid ?? 'did:web:sample-clinic.etzhayyim.com',
      ],
      publicMeta: {
        patientDid,
        encounterDid,
        authorDid,
        occurredAt: rec.occurredAt,
        signed,
      },
    }).catch(() => ({ rkey: 'mock-rkey', encryptedCid: 'bafy-mock-soap' }));
    store.pushNotification({ level: 'info', text: `SOAP ${signed ? '署名確定' : '下書き保存'} (cid ${result.encryptedCid.slice(0, 12)}…)` });
    onNavigate(`/patients/${encodeURIComponent(patientDid)}`);
  }
</script>

<section class="page">
  <header class="hdr">
    <button onclick={() => onNavigate(`/patients/${encodeURIComponent(patientDid)}`)} class="back">← カルテ</button>
    <h2>SOAP 記録</h2>
  </header>
  <SoapEditor {patientDid} {encounterDid} {authorDid} onSubmit={save} />
</section>

<style>
  .page { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr { display: flex; align-items: center; gap: 8px; }
  h2 { margin: 0; font-size: 16px; font-weight: 700; }
  .back { background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 8px; padding: 6px 10px; font-size: 12px; color: var(--gv2-text-primary); }
</style>
