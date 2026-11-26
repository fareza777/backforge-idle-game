export interface RankStorageLike {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
}

export interface RankSession {
  playerId: string;
  gameId: string;
  token: string;
  nickname: string;
  country: string;
  recoveryCode: string;
}

export interface RankScoreEntry {
  boardId: string;
  score: number;
  meta?: Record<string, unknown>;
}

export interface BoardRow {
  rank: number | null;
  playerId: string;
  nickname: string;
  country: string;
  score: number;
  meta: Record<string, unknown>;
  updatedAt: number;
  percentile?: number | null;
  flagged?: boolean;
}

export interface BoardResponse {
  board: {
    id: string;
    title: string;
    periodType: string;
    periodKey: string;
    sortDir: string;
  };
  totalPlayers: number;
  top: BoardRow[];
  scope: string;
  me: BoardRow | null;
  aroundMe: BoardRow[];
  fromCache?: boolean;
  cachedAt?: number;
  error?: string;
}

export interface WorldBossInfo {
  bossKey: string;
  bossId: string;
  title: string;
  element: string;
  totalHp: number;
  currentDamage: number;
  hitsCount: number;
  startsAt: number;
  endsAt: number;
  participants: number;
}

export interface WorldBossContributor {
  rank: number;
  playerId: string;
  nickname: string;
  country: string;
  totalDamage: number;
  bestHit: number;
  runsCount: number;
  meta: Record<string, unknown>;
}

export interface WorldBossStatusResponse {
  boss: WorldBossInfo;
  top: WorldBossContributor[];
  me: {
    totalDamage: number;
    bestHit: number;
    runsCount: number;
    runsToday: number;
    rank: number | null;
  } | null;
  fromCache?: boolean;
}

export interface WorldBossHitResponse {
  ok: boolean;
  acceptedDamage: number;
  totalDamage: number;
  bestHit: number;
  runsToday: number;
  globalDamage: number;
}

export interface PvpOpponent {
  playerId: string;
  nickname: string;
  country: string;
  rating: number;
  wins: number;
  losses: number;
  power: number;
  snapshot: Record<string, unknown>;
  isBot: boolean;
}

export interface PvpMatchResponse {
  me: {
    rating: number;
    wins: number;
    losses: number;
    streak: number;
    fightsToday: number;
  };
  opponents: PvpOpponent[];
  leaderboard: {
    rank: number;
    playerId: string;
    nickname: string;
    country: string;
    rating: number;
    wins: number;
    losses: number;
    streak: number;
    power: number;
  }[];
  defenseLog: {
    id: string;
    attackerName: string;
    defenderWon: boolean;
    ratingDelta: number;
    attackerPower: number;
    createdAt: number;
  }[];
  fromCache?: boolean;
}

export interface PvpResultResponse {
  ok: boolean;
  rating: number;
  delta: number;
  wins: number;
  losses: number;
  streak: number;
  fightsToday: number;
}

const defaultStorage = (): RankStorageLike => ({
  get(key: string) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota or private-mode restrictions.
    }
  },
});

export class F7RankClient {
  readonly baseUrl: string;
  readonly gameId: string;
  private readonly storage: RankStorageLike;
  private readonly fetchImpl: typeof fetch | null;
  private readonly prefix: string;
  private session: RankSession | null = null;
  private queue: RankScoreEntry[] = [];
  private loaded = false;

  constructor(options: {
    baseUrl: string;
    gameId: string;
    storage?: RankStorageLike | null;
    fetchImpl?: typeof fetch | null;
  }) {
    if (!options?.baseUrl || !options?.gameId) {
      throw new Error('F7RankClient requires baseUrl and gameId');
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.gameId = options.gameId;
    this.storage = options.storage ?? defaultStorage();
    this.fetchImpl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    this.prefix = `f7.rank.${this.gameId}`;
  }

  private async loadState(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const rawSess = await this.storage.get(`${this.prefix}.session`);
      if (rawSess) this.session = JSON.parse(rawSess) as RankSession;
    } catch {
      this.session = null;
    }
    try {
      const rawQ = await this.storage.get(`${this.prefix}.queue`);
      if (rawQ) this.queue = (JSON.parse(rawQ) as RankScoreEntry[]) || [];
    } catch {
      this.queue = [];
    }
  }

  private async saveSession(session: RankSession): Promise<void> {
    this.session = session;
    await this.storage.set(`${this.prefix}.session`, JSON.stringify(session));
  }

  private async saveQueue(queue: RankScoreEntry[]): Promise<void> {
    this.queue = queue;
    await this.storage.set(`${this.prefix}.queue`, JSON.stringify(queue));
  }

  private async req<T>(
    path: string,
    options: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    if (!this.fetchImpl) throw new Error('Fetch unavailable');
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = { 'X-Game-Id': this.gameId };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.auth && this.session?.token) headers.Authorization = `Bearer ${this.session.token}`;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 8500) : null;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller?.signal,
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const err = new Error(String(data.error || `HTTP ${res.status}`)) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return data as T;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async getSession(): Promise<RankSession | null> {
    await this.loadState();
    return this.session;
  }

  async ensureAuth(defaultNickname = 'Forge Smith', meta: Record<string, unknown> = {}): Promise<RankSession> {
    await this.loadState();
    if (this.session?.token && this.session?.playerId) return this.session;
    const data = await this.req<RankSession>('/v1/auth/anon', {
      method: 'POST',
      body: { gameId: this.gameId, nickname: defaultNickname, meta },
    });
    await this.saveSession(data);
    return data;
  }

  async recover(recoveryCode: string): Promise<RankSession> {
    await this.loadState();
    const data = await this.req<RankSession>('/v1/auth/recover', {
      method: 'POST',
      body: { gameId: this.gameId, recoveryCode },
    });
    await this.saveSession(data);
    return data;
  }

  async setNickname(nickname: string, meta?: Record<string, unknown>): Promise<{ ok: boolean; nickname: string }> {
    const sess = await this.ensureAuth(nickname);
    const res = await this.req<{ ok: boolean; nickname: string }>('/v1/player/profile', {
      method: 'PATCH',
      auth: true,
      body: { nickname, ...(meta ? { meta } : {}) },
    });
    await this.saveSession({ ...sess, nickname: res.nickname });
    return res;
  }

  async submitScores(
    entries: RankScoreEntry[],
    defaultNickname = 'Forge Smith',
  ): Promise<{ ok: boolean; flushed: number; queued: number; results?: unknown[]; error?: string }> {
    await this.loadState();
    const merged = new Map<string, RankScoreEntry>();
    for (const item of [...this.queue, ...(entries || [])]) {
      if (!item?.boardId || !Number.isFinite(Number(item.score))) continue;
      const prev = merged.get(item.boardId);
      const nextScore = Number(item.score);
      if (!prev || nextScore >= prev.score) {
        merged.set(item.boardId, { boardId: item.boardId, score: nextScore, meta: item.meta ?? {} });
      }
    }
    const nextQueue = [...merged.values()];
    await this.saveQueue(nextQueue);
    return this.flushQueue(defaultNickname);
  }

  async flushQueue(
    defaultNickname = 'Forge Smith',
  ): Promise<{ ok: boolean; flushed: number; queued: number; results?: unknown[]; error?: string }> {
    await this.loadState();
    if (!this.queue.length) return { ok: true, flushed: 0, queued: 0 };
    try {
      await this.ensureAuth(defaultNickname);
      const res = await this.req<{ results?: unknown[] }>('/v1/scores/submit', {
        method: 'POST',
        auth: true,
        body: { entries: this.queue },
      });
      const count = this.queue.length;
      await this.saveQueue([]);
      return { ok: true, flushed: count, queued: 0, results: res.results ?? [] };
    } catch (err) {
      return {
        ok: false,
        flushed: 0,
        queued: this.queue.length,
        error: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  async getBoard(
    boardId: string,
    options: { scope?: 'global' | 'country' | 'tag'; tag?: string; limit?: number } = {},
  ): Promise<BoardResponse> {
    await this.loadState();
    const scope = options.scope ?? 'global';
    const tag = options.tag ?? '';
    const limit = options.limit ?? 50;
    const cacheKey = `${this.prefix}.board.${boardId}.${scope}.${tag}`;
    const q = new URLSearchParams({ gameId: this.gameId, scope, limit: String(limit) });
    if (tag) q.set('tag', tag);

    try {
      const data = await this.req<BoardResponse>(`/v1/boards/${encodeURIComponent(boardId)}?${q.toString()}`, {
        method: 'GET',
        auth: Boolean(this.session?.token),
      });
      await this.storage.set(cacheKey, JSON.stringify({ cachedAt: Date.now(), data }));
      return { ...data, fromCache: false };
    } catch (err) {
      try {
        const raw = await this.storage.get(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { cachedAt: number; data: BoardResponse };
          return {
            ...parsed.data,
            fromCache: true,
            cachedAt: parsed.cachedAt,
            error: err instanceof Error ? err.message : 'Offline',
          };
        }
      } catch {
        // Ignore malformed cache.
      }
      throw err;
    }
  }

  async getPendingCount(): Promise<number> {
    await this.loadState();
    return this.queue.length;
  }

  async getWorldBossStatus(): Promise<WorldBossStatusResponse> {
    await this.loadState();
    const cacheKey = `${this.prefix}.wb.status`;
    try {
      const data = await this.req<WorldBossStatusResponse>(`/v1/worldboss/status?gameId=${encodeURIComponent(this.gameId)}`, {
        method: 'GET',
        auth: Boolean(this.session?.token),
      });
      await this.storage.set(cacheKey, JSON.stringify({ cachedAt: Date.now(), data }));
      return { ...data, fromCache: false };
    } catch (err) {
      const raw = await this.storage.get(cacheKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { data: WorldBossStatusResponse };
          return { ...parsed.data, fromCache: true };
        } catch {
          // Ignore malformed cache.
        }
      }
      throw err;
    }
  }

  async submitWorldBossHit(params: {
    damage: number;
    power: number;
    adBonus?: boolean;
    meta?: Record<string, unknown>;
    nickname?: string;
  }): Promise<WorldBossHitResponse> {
    await this.ensureAuth(params.nickname ?? 'Forge Smith');
    return this.req<WorldBossHitResponse>('/v1/worldboss/hit', {
      method: 'POST',
      auth: true,
      body: {
        damage: params.damage,
        power: params.power,
        adBonus: Boolean(params.adBonus),
        meta: params.meta ?? {},
      },
    });
  }

  async uploadPvpSnapshot(params: {
    snapshot: Record<string, unknown>;
    power: number;
    nickname?: string;
  }): Promise<{ ok: boolean }> {
    await this.ensureAuth(params.nickname ?? 'Forge Smith');
    return this.req<{ ok: boolean }>('/v1/pvp/snapshot', {
      method: 'POST',
      auth: true,
      body: { snapshot: params.snapshot, power: params.power },
    });
  }

  async getPvpMatch(): Promise<PvpMatchResponse> {
    await this.loadState();
    const cacheKey = `${this.prefix}.pvp.match`;
    try {
      const data = await this.req<PvpMatchResponse>(`/v1/pvp/match?gameId=${encodeURIComponent(this.gameId)}`, {
        method: 'GET',
        auth: Boolean(this.session?.token),
      });
      await this.storage.set(cacheKey, JSON.stringify({ cachedAt: Date.now(), data }));
      return { ...data, fromCache: false };
    } catch (err) {
      const raw = await this.storage.get(cacheKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { data: PvpMatchResponse };
          return { ...parsed.data, fromCache: true };
        } catch {
          // Ignore malformed cache.
        }
      }
      throw err;
    }
  }

  async submitPvpResult(params: {
    won: boolean;
    isBot: boolean;
    defenderId: string;
    defenderName: string;
    defenderRating: number;
    attackerPower: number;
    defenderPower: number;
    adBonus?: boolean;
    nickname?: string;
  }): Promise<PvpResultResponse> {
    await this.ensureAuth(params.nickname ?? 'Forge Smith');
    return this.req<PvpResultResponse>('/v1/pvp/result', {
      method: 'POST',
      auth: true,
      body: {
        won: params.won,
        isBot: params.isBot,
        defenderId: params.defenderId,
        defenderName: params.defenderName,
        defenderRating: params.defenderRating,
        attackerPower: params.attackerPower,
        defenderPower: params.defenderPower,
        adBonus: Boolean(params.adBonus),
      },
    });
  }
}
