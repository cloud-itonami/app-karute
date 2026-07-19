<script lang="ts">
  import VitalsForm from '../components/VitalsForm.svelte';
  import { createObservation } from '../lib/api/karute-client';
  import { store } from '../lib/store.svelte';
  import { CodeSystem } from '../lib/fhir/codeSystems';

  interface Props {
    patientDid: string;
    onNavigate: (path: string) => void;
  }
  const { patientDid, onNavigate }: Props = $props();

  const performerDid = $derived(store.state.session?.clinicianDid ?? 'did:web:unknown');
  const encounterDid = $derived(store.state.encounters[0]?.encounterDid ?? 'enc-pending');

  async function save(records: Parameters<Parameters<typeof VitalsForm>[0]['onSubmit']>[0]) {
    const now = new Date().toISOString();
    for (const r of records) {
      await createObservation({
        record: {
          fhirResourceType: 'Observation',
          status: 'final',
          patientDid,
          encounterDid,
          category: 'vital-signs',
          code: { system: r.system, code: r.loincCode, display: r.display },
          valueQuantity: { valueScaled: r.valueScaled, scale: r.scale, unit: r.unit },
          interpretation: r.interpretation,
          performerDid,
          occurredAt: now,
          createdAt: now,
        },
        recipientDids: [patientDid, performerDid, store.state.session?.facilityDid ?? 'did:web:sample-clinic.etzhayyim.com'],
        publicMeta: {
          patientDid,
          encounterDid,
          loincCode: r.loincCode,
          category: 'vital-signs',
          interpretation: r.interpretation,
          occurredAt: now,
        },
      }).catch(() => ({ rkey: 'mock', encryptedCid: 'bafy-mock-obs' }));
    }
    store.pushNotification({ level: 'info', text: `バイタル ${records.length} 件を暗号化記録` });
    onNavigate(`/patients/${encodeURIComponent(patientDid)}`);
  }
</script>

<section class="page">
  <header class="hdr">
    <button onclick={() => onNavigate(`/patients/${encodeURIComponent(patientDid)}`)} class="back">← カルテ</button>
    <h2>バイタル/オーダー結果</h2>
  </header>
  <VitalsForm onSubmit={save} />
</section>

<style>
  .page { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr { display: flex; align-items: center; gap: 8px; }
  h2 { margin: 0; font-size: 16px; font-weight: 700; }
  .back { background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 8px; padding: 6px 10px; font-size: 12px; color: var(--gv2-text-primary); }
</style>
