import {
  ActivePlanInfo,
  BoardState,
  BulkVideoItem,
  CAPH,
  Chapter,
  ComputePlanResult,
  DEFCH,
  LADDER,
  LadderOption,
  LINES,
  PlaceResult,
  PlanDayResult,
  PlanStatus,
  ROT,
  SchedItem,
  STORAGE_KEY,
  STREAMS,
  SubjectName,
} from './types';

/* ---------- Date & Format Helpers ---------- */
export function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

export function ymd(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function parseYmd(s: string): Date {
  const p = s.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function diffDays(a: string, b: string): number {
  const x = parseYmd(a);
  const y = parseYmd(b);
  return Math.round(
    (Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) -
      Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) /
      864e5
  );
}

export function todayStr(): string {
  return ymd(new Date());
}

export function fmtDate(s: string, o?: Intl.DateTimeFormatOptions): string {
  try {
    return parseYmd(s).toLocaleDateString('en-GB', o);
  } catch {
    return s;
  }
}

export function parseOne(str: string): number {
  const s = String(str || '').trim().toLowerCase();
  if (!s) return 0;
  if (s.indexOf(':') > -1) {
    const p = s.split(':').map((x) => parseInt(x, 10) || 0);
    if (p.length >= 3) return p[0] * 3600 + p[1] * 60 + p[2];
    return p[0] * 60 + p[1];
  }
  if (/[hms]/.test(s)) {
    const h = /(\d+)\s*h/.exec(s);
    const m = /(\d+)\s*m/.exec(s);
    const sec = /(\d+)\s*s/.exec(s);
    return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (sec ? +sec[1] : 0);
  }
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
}

export function parseLen(str: string): number {
  const segs = String(str || '').split('+');
  if (segs.length > 1) {
    return segs.reduce((a, x) => a + parseOne(x), 0);
  }
  return parseOne(str);
}

export function fmtLen(sec: number): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h + ':' + pad(m) + ':' + pad(s);
}

export function fmtMin(m: number): string {
  const rounded = Math.round(m);
  const h = Math.floor(rounded / 60);
  const r = rounded % 60;
  if (h && r) return h + 'h ' + r + 'm';
  if (h) return h + 'h';
  return r + 'm';
}

export function hrs(min: number): string {
  const v = Math.round((min / 60) * 10) / 10;
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
}

export function fmtClock(t?: string): string {
  if (!t) return '';
  const p = t.split(':');
  let h = +p[0];
  const m = p[1] || '00';
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return h + ':' + m + ' ' + ap;
}

export function safeUrl(u?: string): string {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+/.test(s)) return 'https://' + s;
  return '';
}

/* ---------- Defaults & Persistence ---------- */
export function createDefaults(): BoardState {
  const st: BoardState = {
    v: 1,
    setupDone: false,
    step: 1,
    stream: 'PCM',
    chapters: [],
    nextId: 1,
    nextK: 1,
    playlists: {},
    speed: 1.5,
    noteMin: 10,
    practicePct: 50,
    hoursPerDay: 4,
    examDate: '2027-02-15',
    planDays: 60,
    planStart: '',
    sched: {},
    schedFor: '',
    todaySubj: '',
    log: {},
    study: [],
    studyNext: 1,
    pomo: { sub: '', done: 0 },
    best: 0,
    planKind: '60',
    customMode: 'days',
    customDays: 15,
    customEnd: '',
    theme: 'system',
  };

  (['Physics', 'Chemistry', 'Maths', 'Biology', 'English'] as SubjectName[]).forEach((sub) => {
    DEFCH[sub].forEach((n, i) => {
      st.chapters.push({
        id: 'c' + st.nextId++,
        subject: sub,
        name: n,
        num: i + 1,
        secs: 0,
        done: false,
        doneMin: 0,
        test: '',
        pin: null,
      });
    });
  });

  return st;
}

export function migrateState(d: BoardState, o: Partial<BoardState>): void {
  const map: Record<string, number> = {};
  (Object.keys(DEFCH) as SubjectName[]).forEach((sub) => {
    DEFCH[sub].forEach((n, i) => {
      map[sub + '|' + n] = i + 1;
    });
  });
  d.chapters.forEach((c) => {
    if (c.num === undefined) c.num = map[c.subject + '|' + c.name] || 0;
  });
  if (o.planKind === undefined) {
    d.planKind = [30, 60, 90].includes(d.planDays)
      ? (String(d.planDays) as '30' | '60' | '90')
      : 'custom';
  }
  if (!d.theme) {
    d.theme = 'system';
  }
}

export function loadState(): { state: BoardState; storageOk: boolean } {
  let storageOk = true;
  try {
    localStorage.setItem(STORAGE_KEY + '.t', '1');
    localStorage.removeItem(STORAGE_KEY + '.t');
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && o.v === 1) {
        const d = createDefaults();
        Object.assign(d, o);
        migrateState(d, o);
        return { state: d, storageOk: true };
      }
    }
  } catch {
    storageOk = false;
  }
  return { state: createDefaults(), storageOk };
}

export function saveState(S: BoardState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    return true;
  } catch {
    return false;
  }
}

/* ---------- Study Time & Chapter Helpers ---------- */
export function chOf(S: BoardState, id: string): Chapter | null {
  for (let i = 0; i < S.chapters.length; i++) {
    if (S.chapters[i].id === id) return S.chapters[i];
  }
  return null;
}

export function activeSubs(S: BoardState): SubjectName[] {
  return STREAMS[S.stream] || STREAMS.PCM;
}

export function activeChapters(S: BoardState): Chapter[] {
  const a = activeSubs(S);
  return S.chapters.filter((c) => a.includes(c.subject));
}

export function parts(S: BoardState, c: Chapter): { w: number; n: number; p: number } {
  const watch = c.secs / 60 / S.speed;
  return {
    w: Math.round(watch),
    n: Math.round((c.secs / 3600) * S.noteMin),
    p: Math.round((watch * S.practicePct) / 100),
  };
}

export function totalMin(S: BoardState, c: Chapter): number {
  if (!(c.secs > 0)) return 0;
  const b = parts(S, c);
  return Math.max(1, b.w + b.n + b.p);
}

export function remainMin(S: BoardState, c: Chapter): number {
  if (c.done) return 0;
  return Math.max(0, totalMin(S, c) - (c.doneMin || 0));
}

/* ---------- Core Planner Engine ---------- */
interface PoolEntry {
  id: string;
  subject: SubjectName;
  order: number;
  r: number;
  dl: number | null;
}

interface PinEntry {
  e: PoolEntry;
  i: number;
  t: string;
}

interface PlaceContext {
  D: number;
  h0: number;
  used0: number;
  kept: SchedItem[];
  pool: PoolEntry[];
  pins: PinEntry[];
  subj: Record<string, SubjectName>;
  blocked: (i: number, s: SubjectName) => boolean;
  rp: number;
  keep: boolean;
}

export function place(opt: LadderOption, ctx: PlaceContext): PlaceResult {
  const h0 = ctx.h0;
  const cap = Math.max(CAPH, h0);
  function lim(i: number): number {
    const h = opt.s ? h0 + Math.floor(i / opt.k) * opt.s : h0;
    return Math.round(Math.min(cap, h) * 60);
  }

  const days: PlanDayResult[] = [];
  function day(i: number): PlanDayResult {
    if (!days[i]) {
      days[i] = { items: [], used: 0, subs: {} };
    }
    return days[i];
  }

  const by: Partial<Record<SubjectName, PoolEntry[]>> = {};
  ctx.pool.forEach((e0) => {
    const e: PoolEntry = {
      id: e0.id,
      subject: e0.subject,
      order: e0.order,
      r: e0.r,
      dl: e0.dl,
    };
    (by[e.subject] = by[e.subject] || []).push(e);
  });

  (Object.keys(by) as SubjectName[]).forEach((s) => {
    by[s]!.sort((a, b) => {
      const x = a.dl == null ? 1e9 : a.dl;
      const y = b.dl == null ? 1e9 : b.dl;
      return x - y || a.order - b.order;
    });
  });

  function pending(s: SubjectName): boolean {
    return Boolean(by[s] && by[s]!.some((e) => e.r > 0));
  }

  let remaining = ctx.pool.length;
  const d0 = day(0);
  d0.used = ctx.used0;
  ctx.kept.forEach((it) => {
    d0.subs[ctx.subj[it.c]] = 1;
  });
  ctx.pins.forEach((p) => {
    const d = day(p.i);
    d.items.push({ c: p.e.id, m: p.e.r, p: 1, n: 1, t: p.t });
    d.used += p.e.r;
    d.subs[p.e.subject] = 1;
  });

  let rp = ctx.rp;
  let cont: SubjectName | null = null;
  let i = ctx.keep ? 1 : 0;
  const MAX = ctx.D + 500;

  while (remaining > 0 && i < MAX) {
    const d = day(i);
    const L = lim(i);
    const cands = ROT.filter((s) => pending(s) && !ctx.blocked(i, s));

    if (cands.length && L - d.used > 0) {
      let prim: SubjectName | null = null;
      if (cont && cands.includes(cont)) {
        prim = cont;
      } else {
        let best: PoolEntry | null = null;
        cands.forEach((s) => {
          by[s]!.forEach((e) => {
            if (e.r > 0 && e.dl != null && e.dl - i <= 3 && (!best || e.dl < best.dl!)) {
              best = e;
            }
          });
        });
        if (best) prim = (best as PoolEntry).subject;
      }
      cont = null;

      if (!prim) {
        for (let k = 0; k < ROT.length; k++) {
          const ix = (rp + k) % ROT.length;
          if (cands.includes(ROT[ix])) {
            prim = ROT[ix];
            rp = ix + 1;
            break;
          }
        }
      }

      const fill = (s: SubjectName, split: boolean): boolean => {
        const list = by[s]!;
        let placed = false;
        for (let q = 0; q < list.length; q++) {
          const e = list[q];
          if (e.r <= 0) continue;
          const free = L - d.used;
          if (free <= 0) break;
          if (e.r <= free) {
            d.items.push({ c: e.id, m: e.r, p: 0, n: 0 });
            d.used += e.r;
            d.subs[s] = 1;
            e.r = 0;
            remaining--;
            placed = true;
          } else if (split && e.r > L && d.used === 0) {
            d.items.push({ c: e.id, m: free, p: 0, n: 0 });
            d.used += free;
            d.subs[s] = 1;
            e.r -= free;
            cont = s;
            placed = true;
            break;
          } else {
            break;
          }
        }
        return placed;
      };

      if (prim && (d.subs[prim] || Object.keys(d.subs).length < 2)) {
        fill(prim, true);
      }

      if (prim && L - d.used > 10 && Object.keys(d.subs).length < 2) {
        const pi = ROT.indexOf(prim);
        for (let k2 = 1; k2 <= ROT.length; k2++) {
          const ix2 = (pi + k2) % ROT.length;
          const s2 = ROT[ix2];
          if (s2 === prim || !cands.includes(s2) || !pending(s2)) continue;
          let first: PoolEntry | null = null;
          for (let q2 = 0; q2 < by[s2]!.length; q2++) {
            if (by[s2]![q2].r > 0) {
              first = by[s2]![q2];
              break;
            }
          }
          if (first && first.r <= L - d.used) {
            if (fill(s2, false)) {
              rp = ix2 + 1;
            }
            break;
          }
        }
      }
    }
    i++;
  }

  const cnt: Record<string, number> = {};
  const seen: Record<string, number> = {};
  days.forEach((d) => {
    if (d) {
      d.items.forEach((it) => {
        cnt[it.c] = (cnt[it.c] || 0) + 1;
      });
    }
  });
  days.forEach((d) => {
    if (d) {
      d.items.forEach((it) => {
        seen[it.c] = (seen[it.c] || 0) + 1;
        it.p = seen[it.c];
        it.n = cnt[it.c];
      });
    }
  });

  let last = ctx.kept.length ? 0 : -1;
  days.forEach((d, ix) => {
    if (d && d.items.length) last = Math.max(last, ix);
  });

  return {
    days,
    lim,
    opt,
    remaining,
    lastIdx: last,
    fits: remaining === 0 && last < ctx.D,
  };
}

export function computePlan(S: BoardState, D: number, keep: boolean): ComputePlanResult {
  const T = todayStr();
  const chs = activeChapters(S);
  const byId: Record<string, Chapter> = {};
  const subj: Record<string, SubjectName> = {};
  chs.forEach((c) => {
    byId[c.id] = c;
    subj[c.id] = c.subject;
  });

  const tests: { s: SubjectName; i: number }[] = [];
  chs.forEach((c) => {
    if (c.test) tests.push({ s: c.subject, i: diffDays(T, c.test) });
  });

  function blocked(i: number, s: SubjectName): boolean {
    for (let q = 0; q < tests.length; q++) {
      if (tests[q].i === i && tests[q].s === s) return true;
    }
    return false;
  }

  const kept: SchedItem[] = [];
  const keptBy: Record<string, number> = {};
  if (keep) {
    (S.sched[T] || []).forEach((it) => {
      const c = byId[it.c];
      if (!c || c.done || blocked(0, c.subject)) return;
      if (c.pin && c.pin.date !== T) return;
      kept.push({ ...it });
      keptBy[c.id] = (keptBy[c.id] || 0) + it.m;
    });
  }

  const pool: PoolEntry[] = [];
  const pins: PinEntry[] = [];
  let total = 0;

  chs.forEach((c) => {
    if (c.done || !(c.secs > 0)) return;
    const full = totalMin(S, c) - (c.doneMin || 0);
    const r = full - (keptBy[c.id] || 0);
    total += Math.max(0, full);
    if (r <= 0) return;
    const e: PoolEntry = {
      id: c.id,
      subject: c.subject,
      order: S.chapters.indexOf(c),
      r,
      dl: c.test ? diffDays(T, c.test) - 1 : null,
    };
    if (c.pin) {
      const pi = diffDays(T, c.pin.date);
      if (pi > 0 || (pi === 0 && !keep)) {
        e.r = full;
        pins.push({ e, i: pi, t: c.pin.time || '' });
        return;
      }
      if (pi === 0 && keep) return;
    }
    pool.push(e);
  });

  const logged = (S.log[T] || []).reduce((a, x) => a + x.m, 0);
  const keptMin = kept.reduce((a, x) => a + x.m, 0);
  let rp = S.todaySubj ? ROT.indexOf(S.todaySubj as SubjectName) + 1 : 0;
  if (rp < 0) rp = 0;

  const ctx: PlaceContext = {
    D,
    h0: S.hoursPerDay,
    used0: logged + keptMin,
    kept,
    pool,
    pins,
    subj,
    blocked,
    rp,
    keep,
  };

  let res: PlaceResult = place(LADDER[0], ctx);
  let idx = 0;
  for (let o = 0; o < LADDER.length; o++) {
    res = place(LADDER[o], ctx);
    idx = o;
    if (res.fits) break;
  }

  return {
    plan: res,
    optIdx: idx,
    total,
    kept,
    D,
    logged,
    pinsCount: pins.length,
  };
}

export function planWindow(S: BoardState): { end: string; D: number } {
  const T = todayStr();
  const end = addDays(S.planStart || T, S.planDays - 1);
  return { end, D: Math.max(0, diffDays(T, end) + 1) };
}

export function statusOf(cp: ComputePlanResult): PlanStatus {
  const pl = cp.plan;
  let peak = 0;
  const n = Math.max(0, Math.min(pl.lastIdx, Math.max(cp.D - 1, 0)));
  for (let i = 0; i <= n; i++) peak = Math.max(peak, pl.lim(i));
  let kind: PlanStatus['kind'];
  if (cp.total === 0) kind = 'done';
  else if (pl.fits && cp.optIdx === 0) kind = 'ok';
  else if (pl.fits) kind = 'ramp';
  else kind = 'no';
  return {
    kind,
    peak: peak / 60,
    over: Math.max(0, pl.lastIdx + 1 - cp.D),
  };
}

export function sortDay(items: SchedItem[]): SchedItem[] {
  const timed = items
    .filter((x) => x.t)
    .sort((a, b) => (a.t! < b.t! ? -1 : a.t! > b.t! ? 1 : 0));
  const rest = items.filter((x) => !x.t);
  return timed.concat(rest);
}

export function rebuildSchedule(S: BoardState, keepFlag: boolean): ActivePlanInfo {
  const T = todayStr();
  S.chapters.forEach((c) => {
    if (c.pin && c.pin.date < T) c.pin = null;
  });
  activeChapters(S).forEach((c) => {
    if (!c.done && c.secs > 0 && totalMin(S, c) - (c.doneMin || 0) <= 0) {
      c.done = true;
    }
  });
  const keep = Boolean(keepFlag) && S.schedFor === T;
  const w = planWindow(S);
  const cp = computePlan(S, w.D, keep);
  const out: Record<string, SchedItem[]> = {};
  const items0 = keep
    ? cp.kept.slice()
    : cp.plan.days[0]
    ? cp.plan.days[0].items.slice()
    : [];
  items0.forEach((it) => {
    if (!it.k) it.k = S.nextK++;
  });
  out[T] = sortDay(items0);

  for (let i = 1; i < cp.plan.days.length; i++) {
    const d = cp.plan.days[i];
    if (d && d.items.length) {
      d.items.forEach((it) => {
        it.k = S.nextK++;
      });
      out[addDays(T, i)] = sortDay(d.items);
    }
  }
  S.sched = out;
  S.schedFor = T;
  if (items0.length) {
    const lc = chOf(S, items0[items0.length - 1].c);
    if (lc) S.todaySubj = lc.subject;
  }
  return { cp, st: statusOf(cp), w };
}

/* ---------- Derived Metrics ---------- */
export function getActiveDays(S: BoardState): Record<string, number> {
  const o: Record<string, number> = {};
  Object.keys(S.log).forEach((d) => {
    if (S.log[d] && S.log[d].length) o[d] = 1;
  });
  (S.study || []).forEach((e) => {
    if (e.min > 0) o[e.d] = 1;
  });
  return o;
}

export function getStreaks(S: BoardState): { cur: number; best: number } {
  const o = getActiveDays(S);
  const T = todayStr();
  let cur = 0;
  let d = o[T] ? T : addDays(T, -1);
  while (o[d]) {
    cur++;
    d = addDays(d, -1);
  }
  const keys = Object.keys(o).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  keys.forEach((k) => {
    run = prev && diffDays(prev, k) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  });
  if ((S.best || 0) > best) best = S.best;
  return { cur, best };
}

export function getCheer(T: string): string {
  const n = Math.floor(parseYmd(T).getTime() / 864e5);
  return LINES[((n % LINES.length) + LINES.length) % LINES.length];
}

export function getSubjStats(
  S: BoardState,
  sub: SubjectName
): { n: number; done: number; vid: number; missing: number; totalMinLeft: number } {
  const cs = S.chapters.filter((c) => c.subject === sub);
  const done = cs.filter((c) => c.done).length;
  let vid = 0;
  let missing = 0;
  let totalMinLeft = 0;
  cs.forEach((c) => {
    if (!c.done) {
      vid += c.secs;
      totalMinLeft += remainMin(S, c);
      if (!(c.secs > 0)) missing++;
    }
  });
  return { n: cs.length, done, vid, missing, totalMinLeft };
}

export function getPendingTotal(S: BoardState): {
  min: number;
  n: number;
  missing: number;
} {
  let m = 0;
  let n = 0;
  let miss = 0;
  activeChapters(S).forEach((c) => {
    if (c.done) return;
    if (c.secs > 0) {
      m += remainMin(S, c);
      n++;
    } else {
      miss++;
    }
  });
  return { min: m, n, missing: miss };
}

export function getCustomLen(S: BoardState): number {
  const T = todayStr();
  if (S.customMode === 'date') {
    if (!S.customEnd || S.customEnd < T) return 0;
    const n = diffDays(T, S.customEnd) + 1;
    return n > 730 ? 0 : n;
  }
  const n = Math.round(parseFloat(String(S.customDays)));
  return n >= 1 && n <= 365 ? n : 0;
}

export function getMinDaysNeeded(S: BoardState): number {
  let lo = 1;
  let hi = 730;
  if (!computePlan(S, hi, false).plan.fits) return hi;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (computePlan(S, mid, false).plan.fits) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function getFeasibility(S: BoardState, D: number) {
  const cp = computePlan(S, D, false);
  const st = statusOf(cp);
  const p = getPendingTotal(S);
  return {
    kind: st.kind,
    total: cp.total,
    peak: st.peak,
    left: p.n,
    missing: p.missing,
    minDays: st.kind === 'no' ? getMinDaysNeeded(S) : 0,
  };
}

export function getMinOn(S: BoardState, d: string, sub?: SubjectName): number {
  let m = 0;
  (S.log[d] || []).forEach((it) => {
    const c = chOf(S, it.c);
    if (c && (!sub || c.subject === sub)) m += it.m;
  });
  (S.study || []).forEach((e) => {
    if (e.d === d && (!sub || e.sub === sub)) m += e.min;
  });
  return m;
}

export function getWeekDays(): string[] {
  const T = todayStr();
  const off = (parseYmd(T).getDay() + 6) % 7;
  const s = addDays(T, -off);
  const a: string[] = [];
  for (let i = 0; i < 7; i++) a.push(addDays(s, i));
  return a;
}

export function getTotalStudyMin(S: BoardState): number {
  let m = 0;
  Object.keys(S.log).forEach((d) => {
    (S.log[d] || []).forEach((it) => {
      if (chOf(S, it.c)) m += it.m;
    });
  });
  (S.study || []).forEach((e) => {
    m += e.min;
  });
  return m;
}

export function getPlannedDate(S: BoardState, id: string): string {
  const ds = Object.keys(S.sched).sort();
  for (let i = 0; i < ds.length; i++) {
    if ((S.sched[ds[i]] || []).some((x) => x.c === id)) return ds[i];
  }
  return '';
}

/* ---------- Bulk Playlist Parser ---------- */
const STOPW: Record<string, number> = {};
'and the of in on at to for a an with by from is are its this that your you class 12 12th xii chapter chapters ch lecture lec lect full complete one shot ncert cbse board boards 2024 2025 2026 2027 new syllabus session part detailed explanation revision notes concept concepts important questions numericals pyq pyqs mcq mcqs video videos hindi english physics chemistry maths math mathematics biology bio series course playlist day'
  .split(' ')
  .forEach((w) => {
    STOPW[w] = 1;
  });

function aliasTitle(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\bemi\b/g, 'electromagnetic induction')
    .replace(/\blpp\b/g, 'linear programming')
    .replace(/\b3\s*-?\s*d\b/g, 'three dimensional')
    .replace(/\bac\b/g, 'alternating current');
}

function toks(s: string): string[] {
  const out: string[] = [];
  aliasTitle(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .forEach((t) => {
      if (!t || STOPW[t] || /^\d+$/.test(t)) return;
      if (t.length > 3 && /s$/.test(t) && !/ss$/.test(t)) t = t.slice(0, -1);
      if (t.length < 2 && t !== 'd' && t !== 'f') return;
      if (!out.includes(t)) out.push(t);
    });
  return out;
}

function tokEq(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  if (n < 5) return false;
  let i = 0;
  while (i < n && a.charAt(i) === b.charAt(i)) i++;
  return i >= 5 && i >= 0.8 * n;
}

function hasTok(list: string[], t: string): boolean {
  for (let i = 0; i < list.length; i++) {
    if (tokEq(list[i], t)) return true;
  }
  return false;
}

function chNum(s: string): number {
  const m = /\b(?:chapter|ch)\s*[-.:#]?\s*(\d{1,2})\b/i.exec(String(s || ''));
  return m ? +m[1] : 0;
}

interface BulkModel {
  chs: Chapter[];
  tk: string[][];
  wt: number[][];
}

function createBulkModel(S: BoardState, sub: SubjectName): BulkModel {
  const chs = S.chapters.filter((c) => c.subject === sub);
  const tk = chs.map((c) => toks(c.name));
  const wt = tk.map((l) =>
    l.map((t) => {
      let n = 0;
      tk.forEach((l2) => {
        if (hasTok(l2, t)) n++;
      });
      return 1 / Math.max(1, n);
    })
  );
  return { chs, tk, wt };
}

function bestFor(m: BulkModel, primary: string, full: string): { i: number; s: number } {
  const vt = toks(full);
  const pt = toks(primary);
  const num = chNum(primary) || chNum(full);
  let best = -1;
  let bi = -1;
  for (let i = 0; i < m.chs.length; i++) {
    const l = m.tk[i];
    let tot = 0;
    let got = 0;
    for (let k = 0; k < l.length; k++) {
      tot += m.wt[i][k];
      if (hasTok(vt, l[k])) got += m.wt[i][k];
    }
    let s = tot ? got / tot : 0;
    if (pt.length >= 2) {
      let mt = 0;
      pt.forEach((t) => {
        if (hasTok(l, t)) mt++;
      });
      if (mt >= 2) s = Math.max(s, (0.8 * mt) / pt.length);
    }
    if (num && m.chs[i].num === num) s += 0.001;
    if (s > best) {
      best = s;
      bi = i;
    }
  }
  return { i: bi, s: best };
}

const DURRE = /^\d{1,2}(?::\d{2}){1,2}$/;

export function parseBulkPlaylist(
  S: BoardState,
  txt: string,
  sub: SubjectName
): { vids: BulkVideoItem[]; note: string } {
  const lines = String(txt || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  const du: { f: number; i: number; d: string }[] = [];
  lines.forEach((l, i) => {
    if (!DURRE.test(l)) return;
    const last = du[du.length - 1];
    if (last && last.i === i - 1 && last.d === l) {
      last.i = i;
      return;
    }
    du.push({ f: i, i, d: l });
  });

  let vids: BulkVideoItem[] = [];
  const model = createBulkModel(S, sub);

  if (!du.length) {
    let mm = String(txt || '').match(/\b\d{1,2}(?::\d{2}){1,2}\b/g) || [];
    if (mm.length >= 4 && mm.length % 2 === 0) {
      let dbl = true;
      for (let x = 0; x < mm.length; x += 2) {
        if (mm[x] !== mm[x + 1]) {
          dbl = false;
          break;
        }
      }
      if (dbl) {
        const o: string[] = [];
        for (let y = 0; y < mm.length; y += 2) o.push(mm[y]);
        mm = o;
      }
    }
    vids = mm.map((d) => ({
      d,
      secs: parseLen(d),
      title: '',
      ctx: '',
      ch: '',
      how: '',
    }));
  } else {
    const clean = (a: number, b: number): string[] => {
      const out: string[] = [];
      for (let q = a; q < b; q++) {
        const l = lines[q];
        if (/^\d{1,3}$/.test(l) || /\b(views?|watching|ago|subscribers?)\b/i.test(l)) continue;
        out.push(l);
      }
      return out;
    };

    const first = du.map((x, k) => {
      const end = k + 1 < du.length ? du[k + 1].f : Math.min(lines.length, x.i + 9);
      const a = clean(x.i + 1, end).slice(0, 4);
      return { p: a[0] || '', c: a.slice(0, 3).join(' ') };
    });

    const lastL = du.map((x, k) => {
      const st = k > 0 ? du[k - 1].i + 1 : Math.max(0, x.f - 6);
      let a = clean(st, x.f);
      if (k === 0) a = a.slice(-3);
      return { p: a[0] || '', c: a.slice(0, 3).join(' ') };
    });

    const unit = (a: number, b: number): number => {
      const s = /\b(views?|watching|ago)\b/i.test(lines.slice(a, b).join(' ')) ? 1 : 0;
      const r = bestFor(model, '', clean(a, b).slice(0, 4).join(' '));
      return s + (r.i > -1 && r.s >= 0.5 ? 1 : 0);
    };

    const endI = du[du.length - 1].i;
    const sF = unit(endI + 1, Math.min(lines.length, endI + 9));
    const sL = unit(Math.max(0, du[0].f - 8), du[0].f);
    const useLast = sL > sF;
    const pick = useLast ? lastL : first;

    vids = du.map((x, k) => ({
      d: x.d,
      secs: parseLen(x.d),
      title: pick[k].p,
      ctx: pick[k].c,
      ch: '',
      how: '',
    }));
  }

  vids.forEach((v) => {
    v.ch = '';
    v.how = '';
    if (!v.title) return;
    const r = bestFor(model, v.title, v.ctx);
    if (r.i > -1 && r.s >= 0.5) {
      v.ch = model.chs[r.i].id;
      v.how = 'name';
      return;
    }
    const n = chNum(v.title) || chNum(v.ctx);
    if (n) {
      for (let q = 0; q < model.chs.length; q++) {
        if (model.chs[q].num === n) {
          v.ch = model.chs[q].id;
          v.how = 'number';
          break;
        }
      }
    }
  });

  const note =
    vids.length && !vids.some((x) => x.title)
      ? 'No video titles were found in the pasted text, so choose a chapter for each video below.'
      : '';

  return { vids, note };
}
