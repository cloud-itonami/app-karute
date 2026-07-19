<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { fmtDateTime } from '../lib/util/format';

  interface Props {
    onNavigate: (path: string) => void;
  }
  const { onNavigate }: Props = $props();

  const stats = $derived({
    todayEncounters: 4,
    pendingOrders: 7,
    rxToReview: 2,
    criticalAlerts: 0,
  });

  const todaySchedule = $state([
    { time: '09:00', patientAlias: '田中 (anon)', purpose: '糖尿病 follow-up', didShort: 'did:plc:t…3a' },
    { time: '09:30', patientAlias: '佐藤 (anon)', purpose: '感冒・咽頭炎疑い', didShort: 'did:plc:s…2b' },
    { time: '10:00', patientAlias: '鈴木 (anon)', purpose: '高血圧 follow-up', didShort: 'did:plc:k…4c' },
    { time: '10:30', patientAlias: '高橋 (anon)', purpose: '健診結果説明', didShort: 'did:plc:h…5d' },
  ]);
</script>

<section class="home">
  <header class="hello">
    <div>
      <div class="greet">こんにちは、{store.state.session?.displayName ?? 'Clinician'}</div>
      <div class="sub">{store.state.session?.role} · {store.state.session?.facilityDid.replace('did:web:', '') ?? ''}</div>
    </div>
  </header>

  <div class="stats">
    <button class="stat" onclick={() => onNavigate('/patients')}>
      <div class="big">{stats.todayEncounters}</div>
      <div class="lbl">本日の受診</div>
    </button>
    <button class="stat" onclick={() => onNavigate('/orders')}>
      <div class="big">{stats.pendingOrders}</div>
      <div class="lbl">未処理オーダー</div>
    </button>
    <button class="stat warn" onclick={() => onNavigate('/orders?filter=rx-review')}>
      <div class="big">{stats.rxToReview}</div>
      <div class="lbl">Rx 共同署名待ち</div>
    </button>
    <button class="stat ok" onclick={() => onNavigate('/orders?filter=alerts')}>
      <div class="big">{stats.criticalAlerts}</div>
      <div class="lbl">クリティカル</div>
    </button>
  </div>

  <section class="card">
    <div class="card-hdr">
      <span>本日のスケジュール</span>
      <button onclick={() => onNavigate('/patients')} class="link">すべて →</button>
    </div>
    <ul class="schedule">
      {#each todaySchedule as item, i (i)}
        <li class="sch-row">
          <span class="time">{item.time}</span>
          <div class="who">
            <div class="alias">{item.patientAlias}</div>
            <div class="mini">{item.purpose}</div>
          </div>
        </li>
      {/each}
    </ul>
    <div class="note">アライアス・要約は public meta から生成。詳細表示時に read-cap で復号。</div>
  </section>

  <section class="card">
    <div class="card-hdr">クイック操作</div>
    <div class="actions">
      <button class="action" onclick={() => onNavigate('/patients')}>📋 患者検索</button>
      <button class="action" onclick={() => onNavigate('/orders')}>🧪 オーダー追跡</button>
      <button class="action" onclick={() => onNavigate('/zaitaku')}>🏠 在宅医療</button>
      <button class="action" onclick={() => onNavigate('/talk')}>💬 院内 Talk</button>
    </div>
  </section>
</section>

<style>
  .home { display: flex; flex-direction: column; gap: 14px; padding: 16px 14px 80px; }
  .hello { padding: 4px; }
  .greet { font-size: 18px; font-weight: 700; }
  .sub { font-size: 12px; color: var(--gv2-text-muted); margin-top: 2px; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .stat {
    display: flex; flex-direction: column; align-items: flex-start;
    padding: 14px;
    background: var(--gv2-bg-card);
    border: 1px solid var(--gv2-border);
    border-radius: 12px;
    color: var(--gv2-text-primary);
    text-align: left;
  }
  .stat .big { font-size: 28px; font-weight: 700; }
  .stat .lbl { font-size: 11px; color: var(--gv2-text-muted); }
  .stat.warn .big { color: #f59e0b; }
  .stat.ok .big { color: #10b981; }
  .card { background: var(--gv2-bg-card); border: 1px solid var(--gv2-border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .card-hdr { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 13px; }
  .link { background: transparent; border: 0; color: var(--gv2-accent); font-size: 11px; }
  .schedule { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .sch-row { display: flex; gap: 12px; align-items: center; padding: 8px 4px; border-bottom: 1px dashed var(--gv2-border); }
  .sch-row:last-child { border-bottom: 0; }
  .time { font-family: ui-monospace, monospace; font-weight: 600; color: var(--gv2-text-secondary); width: 50px; }
  .who { flex: 1; min-width: 0; }
  .alias { font-size: 13px; font-weight: 500; }
  .mini { font-size: 11px; color: var(--gv2-text-muted); }
  .note { font-size: 10px; color: var(--gv2-text-muted); border-top: 1px dashed var(--gv2-border); padding-top: 8px; }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .action {
    padding: 10px 6px;
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 8px;
    font-size: 12px;
    color: var(--gv2-text-primary);
  }
</style>
