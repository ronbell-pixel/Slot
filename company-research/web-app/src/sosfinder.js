// SOS Finder (sosfinder.com) state business registry lookups.
// The API key stays on the server; Claude only sees the trimmed result.

const API_URL = process.env.SOS_API_URL || 'https://api.sosfinder.com/search';
const TIMEOUT_MS = 45_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

export const SEARCH_BY = ['name', 'entityId', 'documentNumber', 'fileNumber', 'filingNumber', 'controlNumber'];

export const sosConfigured = () => Boolean(process.env.SOS_API_KEY);

// Registry records carry 60+ fields plus the state's raw payload; keep what the report uses.
const DETAIL_FIELDS = [
  'name', 'entityId', 'oldNames', 'status', 'statusReason', 'subStatus', 'standing',
  'arStanding', 'raStanding', 'revenueStanding', 'otherStanding',
  'entityType', 'entityTypeDescription', 'formationDate', 'effectiveDate', 'dissolutionDate',
  'revivalDate', 'jurisdiction', 'feiEin', 'naicsCode', 'naicsDescription',
  'registeredAgentName', 'registeredAgentAddress', 'serviceOfProcessName', 'serviceOfProcessAddress',
  'principalOfficeAddress', 'mailingAddress', 'sosUrl', 'detailAvailable',
];
const SUMMARY_FIELDS = ['name', 'entityId', 'status', 'entityType', 'formationDate', 'sosUrl'];
const LIST_LIMITS = { officers: 15, filings: 5, filingHistory: 5, annualReports: 3, documents: 5 };

function pick(record, fields) {
  const out = {};
  for (const f of fields) {
    const v = record?.[f];
    if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) out[f] = v;
  }
  return out;
}

export function trimResponse(data) {
  const best = data?.bestMatch ?? null;
  const bestMatch = best ? pick(best, DETAIL_FIELDS) : null;
  if (best) {
    for (const [key, limit] of Object.entries(LIST_LIMITS)) {
      if (Array.isArray(best[key]) && best[key].length) bestMatch[key] = best[key].slice(0, limit);
    }
  }
  const similar = (data?.results ?? [])
    .filter((r) => !best || r.entityId !== best.entityId || r.name !== best.name)
    .slice(0, 5)
    .map((r) => pick(r, SUMMARY_FIELDS));
  return {
    state: data?.state ?? null,
    stateName: data?.stateName ?? null,
    success: Boolean(data?.success),
    count: data?.count ?? 0,
    blocked: Boolean(data?.blocked),
    error: data?.error ?? null,
    bestMatch,
    similar,
  };
}

const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
}

export function clearSosCache() {
  cache.clear();
}

/**
 * Searches one state's registry. Never throws for API problems: returns
 * `{error}` so Claude can fall back to web search and say why.
 */
export async function sosSearch({ state, query, search_by = 'name' }, { signal, fetchImpl = fetch } = {}) {
  const key = `${state}|${search_by}|${query}`.toLowerCase();
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const url = new URL(API_URL);
  url.searchParams.set('state', state);
  url.searchParams.set('business_name', query);
  if (search_by !== 'name') url.searchParams.set('by', search_by);

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(url, {
      headers: { 'x-api-key': process.env.SOS_API_KEY, accept: 'application/json' },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    return { error: timeout.aborted ? 'Registry lookup timed out.' : 'Registry service unreachable.' };
  }

  if (res.status === 401 || res.status === 403) return { error: 'Registry service rejected the API key.' };
  if (res.status === 402 || res.status === 429) return { error: 'Registry lookup quota or rate limit reached.' };
  if (!res.ok) return { error: `Registry service error (HTTP ${res.status}).` };

  let data;
  try {
    data = await res.json();
  } catch {
    return { error: 'Registry service returned an unreadable response.' };
  }
  const trimmed = trimResponse(data);
  // Blocked responses are transient; don't cache them.
  if (!trimmed.blocked) cacheSet(key, trimmed);
  return trimmed;
}
