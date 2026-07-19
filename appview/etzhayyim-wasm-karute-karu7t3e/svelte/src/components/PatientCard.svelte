<script lang="ts">
  import type { PatientMeta } from '../lib/api/types';
  import { fmtDate, shortDid } from '../lib/util/format';

  interface Props {
    patient: PatientMeta;
    onSelect: (did: string) => void;
  }
  const { patient, onSelect }: Props = $props();
</script>

<button class="card" onclick={() => onSelect(patient.patientDid)} type="button">
  <div class="row top">
    <div class="alias">{patient.publicAlias ?? shortDid(patient.patientDid)}</div>
    <div class="badge" title="ciphertext only — read-cap 必須">🔒</div>
  </div>
  <div class="row meta">
    <span class="muted">DID</span>
    <span class="mono">{shortDid(patient.patientDid, 8)}</span>
  </div>
  <div class="row meta">
    <span class="muted">登録</span>
    <span>{fmtDate(patient.registeredAt)}</span>
  </div>
</button>

<style>
  .card {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    background: var(--gv2-bg-card);
    border: 1px solid var(--gv2-border);
    border-radius: 10px;
    color: var(--gv2-text-primary);
    text-align: left;
    transition: border-color 120ms, transform 120ms;
  }
  .card:hover { border-color: var(--gv2-accent); }
  .card:active { transform: scale(0.998); }
  .row { display: flex; justify-content: space-between; align-items: baseline; }
  .top { gap: 8px; }
  .alias { font-weight: 600; font-size: 15px; }
  .badge { font-size: 13px; }
  .meta { font-size: 12px; }
  .muted { color: var(--gv2-text-muted); }
  .mono { font-family: ui-monospace, monospace; font-size: 11px; color: var(--gv2-text-secondary); }
</style>
