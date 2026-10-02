import type {
  FeedEvent,
  HallOfFameRow,
  LeaderboardRow,
  PlayerState,
  PlayerStats,
  PlayerSummary,
  SpinResponse,
} from '../../shared/api.ts';

const PLAYER_KEY = 'slot-party.player';

export function storedPlayerId(): number | null {
  try {
    const id = Number(localStorage.getItem(PLAYER_KEY));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function storePlayerId(id: number | null) {
  try {
    if (id) localStorage.setItem(PLAYER_KEY, String(id));
    else localStorage.removeItem(PLAYER_KEY);
  } catch {
    // Storage unavailable (private mode) — the session just won't be remembered.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const id = storedPlayerId();
  if (id) headers['x-player-id'] = String(id);
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  players: () => request<PlayerSummary[]>('GET', '/api/players'),
  join: (name: string, avatar: string, color: string) =>
    request<PlayerState>('POST', '/api/players', { name, avatar, color }),
  me: () => request<PlayerState>('GET', '/api/me'),
  updateMe: (avatar: string, color: string) => request<PlayerState>('PATCH', '/api/me', { avatar, color }),
  bonus: () => request<PlayerState>('POST', '/api/bonus'),
  spin: (bet: number, theme: string) => {
    // Dev aid: ?force=<outcome> is honored only when the server runs with SLOT_DEBUG=1.
    const force = new URLSearchParams(location.search).get('force') ?? undefined;
    return request<SpinResponse>('POST', '/api/spin', { bet, theme, force });
  },
  stats: (id: number) => request<PlayerStats>('GET', `/api/stats/${id}`),
  leaderboard: () => request<LeaderboardRow[]>('GET', '/api/leaderboard'),
  hallOfFame: () => request<HallOfFameRow[]>('GET', '/api/halloffame'),
  feed: () => request<FeedEvent[]>('GET', '/api/feed'),
};
