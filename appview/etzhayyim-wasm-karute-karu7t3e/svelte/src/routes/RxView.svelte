<script lang="ts">
  import RxComposer from '../components/RxComposer.svelte';
  import { createMedicationRequest } from '../lib/api/karute-client';
  import { store } from '../lib/store.svelte';
  import type { MedicationRequestRecord } from '../lib/api/types';

  interface Props {
    patientDid: string;
    onNavigate: (path: string) => void;
  }
  const { patientDid, onNavigate }: Props = $props();

  const prescriberDid = $derived(store.state.session?.clinicianDid ?? 'did:web:unknown');
  const encounterDid = $derived(store.state.encounters[0]?.encounterDid ?? 'enc-pending');

  async function save(rec: MedicationRequestRecord, override?: { reason: string }) {
    try {
      const result = await createMedicationRequest({
        record: rec,
        recipientDids: [
          patientDid,
          prescriberDid,
          'did:web:pharmacy.etzhayyim.com',
        ],
        publicMeta: {
          patientDid,
          encounterDid,
          prescriberDid,
          status: rec.status,
          rxnormSummary: rec.medication.rxnorm,
          yjCodeSummary: rec.medication.yjCode,
          authoredOn: rec.authoredOn,
        },
        overrideInteractionBlock: override !== undefined,
        overrideReason: override?.reason,
      });
      if (!result.blocked) {
        store.pushNotification({
          level: result.interactionFlags?.length ? 'warning' : 'info',
          text: `処方発行 ${override ? '(override)' : ''}: ${rec.medication.display}`,
        });
      }
      return result;
    } catch {
      // Phase 1 mock: surface a fake contraindication for any RxNorm = 197361 (warfarin demo)
      if (rec.medication.rxnorm === '197361') {
        return {
          blocked: true,
          interactionFlags: [
            {
              severity: 'contraindicated' as const,
              mechanism: 'CYP2C9 競合 — warfarin の血中濃度上昇 (出血リスク)',
              recommendation: 'NSAIDs を中止または別系統の鎮痛剤に切替',
              withMedicationRxnorm: 'NSAID-class',
            },
          ],
        };
      }
      store.pushNotification({ level: 'info', text: `モック処方発行: ${rec.medication.display}` });
      return { blocked: false };
    }
  }
</script>

<section class="page">
  <header class="hdr">
    <button onclick={() => onNavigate(`/patients/${encodeURIComponent(patientDid)}`)} class="back">← カルテ</button>
    <h2>処方発行</h2>
  </header>
  <RxComposer {patientDid} {encounterDid} {prescriberDid} onSubmit={save} />
</section>

<style>
  .page { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr { display: flex; align-items: center; gap: 8px; }
  h2 { margin: 0; font-size: 16px; font-weight: 700; }
  .back { background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 8px; padding: 6px 10px; font-size: 12px; color: var(--gv2-text-primary); }
</style>
