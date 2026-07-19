export function fmtDateTime(iso: string | undefined, locale = 'ja-JP'): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function fmtDate(iso: string | undefined, locale = 'ja-JP'): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function shortDid(did: string | undefined, len = 12): string {
  if (!did) return '';
  if (did.length <= len * 2 + 2) return did;
  return `${did.slice(0, len)}…${did.slice(-6)}`;
}

const SEVERITY_RANK: Record<string, number> = {
  contraindicated: 4, major: 3, moderate: 2, minor: 1, '': 0,
};

export function severityRank(s: string | undefined): number {
  return SEVERITY_RANK[s ?? ''] ?? 0;
}
