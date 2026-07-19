<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { fmtDateTime, shortDid } from '../lib/util/format';

  // ZaitakuView is the 在宅医療 episode landing — shows active episodes, today's
  // scheduled visits across episodes, and per-episode visit log.

  interface Props {
    onNavigate: (path: string) => void;
  }
  const { onNavigate }: Props = $props();

  type CareType =
    | 'chronic-disease' | 'post-discharge' | 'palliative' | 'hospice'
    | 'rehabilitation' | 'ventilator-dependent' | 'dialysis-home'
    | 'intractable-disease' | 'pediatric-medical-care';

  interface EpisodeRow {
    rkey: string;
    patientAlias: string;
    patientDid: string;
    careType: CareType[];
    status: 'planned' | 'active' | 'onhold' | 'finished';
    startedAt: string;
    primaryMd: string;
    primaryNurse: string;
    dnar: boolean;
    nextVisit?: string;
  }

  interface VisitRow {
    rkey: string;
    patientAlias: string;
    visitorDid: string;
    visitType: string;
    occurredAt: string;
    lengthMinutes?: number;
    escalationType?: string;
  }

  // Phase 3 fixture data — replaced by listHomecareEpisodes / listHomeVisits when backend lands.
  const episodes = $state<EpisodeRow[]>([
    { rkey: 'ep1', patientAlias: '高橋 (anon)', patientDid: 'did:plc:jkl4takahashi', careType: ['palliative', 'chronic-disease'], status: 'active', startedAt: '2026-03-10T00:00:00Z', primaryMd: 'did:web:dr-yamada.etzhayyim.com', primaryNurse: 'did:web:rn-kondo.etzhayyim.com', dnar: true, nextVisit: '2026-05-23T14:00:00Z' },
    { rkey: 'ep2', patientAlias: '佐藤 (anon)', patientDid: 'did:plc:def2sato', careType: ['post-discharge', 'rehabilitation'], status: 'active', startedAt: '2026-05-08T00:00:00Z', primaryMd: 'did:web:dr-tanaka.etzhayyim.com', primaryNurse: 'did:web:rn-kondo.etzhayyim.com', dnar: false, nextVisit: '2026-05-24T10:00:00Z' },
    { rkey: 'ep3', patientAlias: '田中 (anon)', patientDid: 'did:plc:abc1tanaka', careType: ['chronic-disease', 'dialysis-home'], status: 'active', startedAt: '2026-02-01T00:00:00Z', primaryMd: 'did:web:dr-yamada.etzhayyim.com', primaryNurse: 'did:web:rn-suzuki.etzhayyim.com', dnar: false, nextVisit: '2026-05-25T09:00:00Z' },
  ]);

  const todayVisits = $state<VisitRow[]>([
    { rkey: 'v1', patientAlias: '高橋 (anon)', visitorDid: 'did:web:dr-yamada.etzhayyim.com', visitType: 'scheduled-md', occurredAt: '2026-05-23T09:00:00Z', lengthMinutes: 45 },
    { rkey: 'v2', patientAlias: '高橋 (anon)', visitorDid: 'did:web:rn-kondo.etzhayyim.com', visitType: 'scheduled-rn', occurredAt: '2026-05-23T14:00:00Z' },
    { rkey: 'v3', patientAlias: '田中 (anon)', visitorDid: 'did:web:rn-kondo.etzhayyim.com', visitType: 'emergency-rn', occurredAt: '2026-05-23T02:30:00Z', lengthMinutes: 90, escalationType: 'md-callback' },
  ]);

  let activeTab = $state<'today' | 'episodes'>('today');

  const CARE_LABEL: Record<CareType, string> = {
    'chronic-disease': '慢性',
    'post-discharge': '退院後',
    'palliative': '緩和',
    'hospice': 'ホスピス',
    'rehabilitation': 'リハ',
    'ventilator-dependent': '人工呼吸器',
    'dialysis-home': '在宅透析',
    'intractable-disease': '難病',
    'pediatric-medical-care': '小児',
  };

  const VISIT_LABEL: Record<string, { label: string; color: string }> = {
    'scheduled-md': { label: '医師訪問', color: '#0ea5e9' },
    'scheduled-rn': { label: '看護訪問', color: '#10b981' },
    'scheduled-pt': { label: 'PT', color: '#8b5cf6' },
    'scheduled-ot': { label: 'OT', color: '#8b5cf6' },
    'scheduled-st': { label: 'ST', color: '#8b5cf6' },
    'scheduled-pharm': { label: '薬剤師', color: '#ec4899' },
    'emergency-md': { label: '緊急/MD', color: '#dc2626' },
    'emergency-rn': { label: '緊急/RN', color: '#f59e0b' },
    'after-hours-rn': { label: '夜間RN', color: '#f59e0b' },
    'death-confirmation': { label: '看取り', color: '#7f1d1d' },
  };

  function logVisit(_episode: EpisodeRow) {
    // Phase 3: navigate to a visit-composer route. For now surface a toast.
    store.pushNotification({ level: 'info', text: '訪問記録 UI: Phase 3 — composer は別 commit で実装' });
  }
</script>

<section class="zaitaku">
  <header class="hdr">
    <h2>在宅医療</h2>
    <div class="sub">{episodes.filter((e) => e.status === 'active').length} active episode · 在宅療養事業者</div>
  </header>

  <nav class="tabs">
    <button class:active={activeTab === 'today'} onclick={() => (activeTab = 'today')} type="button">
      本日の訪問 <span class="cnt">{todayVisits.length}</span>
    </button>
    <button class:active={activeTab === 'episodes'} onclick={() => (activeTab = 'episodes')} type="button">
      エピソード <span class="cnt">{episodes.length}</span>
    </button>
  </nav>

  {#if activeTab === 'today'}
    <ul class="visits">
      {#each todayVisits as v (v.rkey)}
        {@const k = VISIT_LABEL[v.visitType] ?? { label: v.visitType, color: '#94a3b8' }}
        <li class="visit" class:escalated={!!v.escalationType}>
          <div class="when">
            <div class="time">{new Date(v.occurredAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="dot" style="background:{k.color}"></div>
          </div>
          <div class="body">
            <div class="row1">
              <span class="kind">{k.label}</span>
              <span class="who">{v.patientAlias}</span>
              {#if v.escalationType}
                <span class="esc">⚠ {v.escalationType}</span>
              {/if}
            </div>
            <div class="row2">
              <span class="mono">{shortDid(v.visitorDid, 8)}</span>
              {#if v.lengthMinutes}· {v.lengthMinutes}分{/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <ul class="episodes">
      {#each episodes as e (e.rkey)}
        <li class="episode" class:dnar={e.dnar}>
          <div class="ep-hdr">
            <div class="alias">{e.patientAlias}</div>
            <span class="status st-{e.status}">{e.status}</span>
            {#if e.dnar}<span class="dnar-badge">DNAR</span>{/if}
          </div>
          <div class="care-types">
            {#each e.careType as ct (ct)}
              <span class="ct">{CARE_LABEL[ct]}</span>
            {/each}
          </div>
          <div class="ep-meta">
            <div>開始: {fmtDateTime(e.startedAt)}</div>
            <div>主治医: <span class="mono">{shortDid(e.primaryMd, 8)}</span></div>
            <div>主担看護師: <span class="mono">{shortDid(e.primaryNurse, 8)}</span></div>
            {#if e.nextVisit}<div>次回: {fmtDateTime(e.nextVisit)}</div>{/if}
          </div>
          <div class="ep-actions">
            <button onclick={() => logVisit(e)} type="button">訪問記録</button>
            <button onclick={() => onNavigate(`/patients/${encodeURIComponent(e.patientDid)}`)} type="button">カルテ</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .zaitaku { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .sub { font-size: 11px; color: var(--gv2-text-muted); margin-top: 2px; }
  .tabs { display: flex; gap: 6px; }
  .tabs button {
    flex: 1; padding: 10px;
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 8px;
    color: var(--gv2-text-primary);
    font-size: 13px;
    font-weight: 600;
  }
  .tabs button.active { background: var(--gv2-accent); color: white; border-color: var(--gv2-accent); }
  .cnt { font-size: 11px; padding: 1px 6px; border-radius: 999px; background: rgba(255,255,255,0.15); margin-left: 4px; }

  .visits { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .visit {
    display: flex; gap: 10px;
    padding: 10px;
    background: var(--gv2-bg-card);
    border: 1px solid var(--gv2-border);
    border-radius: 10px;
  }
  .visit.escalated { border-color: #dc2626; background: rgba(220, 38, 38, 0.04); }
  .when { display: flex; flex-direction: column; align-items: center; gap: 4px; padding-top: 2px; }
  .time { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 600; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .body { flex: 1; }
  .row1 { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .kind { font-size: 12px; padding: 1px 6px; background: var(--gv2-bg-input); border-radius: 4px; font-weight: 600; }
  .who { font-size: 13px; font-weight: 500; }
  .esc { font-size: 10px; padding: 1px 6px; background: #fee2e2; color: #991b1b; border-radius: 4px; font-weight: 600; }
  .row2 { font-size: 11px; color: var(--gv2-text-muted); margin-top: 2px; }

  .episodes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .episode {
    padding: 12px;
    background: var(--gv2-bg-card);
    border: 1px solid var(--gv2-border);
    border-radius: 12px;
    border-left: 4px solid var(--gv2-accent);
    display: flex; flex-direction: column; gap: 8px;
  }
  .episode.dnar { border-left-color: #7f1d1d; }
  .ep-hdr { display: flex; gap: 8px; align-items: center; }
  .alias { flex: 1; font-weight: 700; font-size: 14px; }
  .status { font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
  .status.st-active { background: #d1fae5; color: #065f46; }
  .status.st-planned { background: #e0f2fe; color: #075985; }
  .status.st-onhold { background: #fef3c7; color: #92400e; }
  .status.st-finished { background: #f1f5f9; color: #475569; }
  .dnar-badge { font-size: 10px; padding: 1px 6px; background: #7f1d1d; color: white; border-radius: 4px; font-weight: 600; letter-spacing: 0.05em; }
  .care-types { display: flex; gap: 4px; flex-wrap: wrap; }
  .ct { font-size: 10px; padding: 2px 8px; background: var(--gv2-bg-input); border-radius: 999px; color: var(--gv2-text-secondary); }
  .ep-meta { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: var(--gv2-text-muted); }
  .mono { font-family: ui-monospace, monospace; }
  .ep-actions { display: flex; gap: 6px; padding-top: 4px; }
  .ep-actions button {
    flex: 1;
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 6px;
    padding: 6px;
    font-size: 11px;
    color: var(--gv2-text-primary);
    font-weight: 500;
  }
</style>
