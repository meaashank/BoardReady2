import React from 'react';
import { ActivePlanInfo, BoardState, SchedItem } from '../types';
import {
  addDays,
  chOf,
  diffDays,
  fmtClock,
  fmtDate,
  fmtMin,
  getMinDaysNeeded,
  hrs,
  parseYmd,
  todayStr,
} from '../planner';
import { ArrowRightLeft, Check } from 'lucide-react';

interface PlanViewProps {
  S: BoardState;
  A: ActivePlanInfo;
  onOpenMove: (id: string) => void;
}

function niceStep(max: number): number {
  return max <= 6 ? 1 : max <= 12 ? 2 : 4;
}

export const PlanView: React.FC<PlanViewProps> = ({ S, A, onOpenMove }) => {
  const T = todayStr();
  const cp = A.cp;
  const st = A.st;
  const w = A.w;
  const pl = cp.plan;
  const h0 = S.hoursPerDay;

  const flat = Math.ceil(cp.total / (h0 * 60));

  let statusTitle = '';
  let statusColor = 'text-[var(--accent)]';
  let statusBg = 'bg-[var(--accent-soft)]';
  if (st.kind === 'done') {
    statusTitle = 'All done';
  } else if (st.kind === 'ok') {
    statusTitle = 'Realistic';
  } else if (st.kind === 'ramp') {
    statusTitle = 'Needs a slow ramp-up';
    statusColor = 'text-[var(--warn)]';
    statusBg = 'bg-[var(--warn-soft)]';
  } else if (w.D <= 0) {
    statusTitle = 'Plan ended';
    statusColor = 'text-[var(--bad)]';
    statusBg = 'bg-[var(--bad-soft)]';
  } else {
    statusTitle = 'Too much for this plan';
    statusColor = 'text-[var(--bad)]';
    statusBg = 'bg-[var(--bad-soft)]';
  }

  // Chart data
  const n = Math.max(1, Math.min(120, Math.max(w.D, pl.lastIdx + 1)));
  const lims: number[] = [];
  const loads: number[] = [];
  for (let i = 0; i < n; i++) {
    lims.push(pl.lim(i) / 60);
    const ds = addDays(T, i);
    let m = (S.sched[ds] || []).reduce((a, x) => a + x.m, 0);
    if (i === 0) m += (S.log[T] || []).reduce((a, x) => a + x.m, 0);
    loads.push(m / 60);
  }

  let expl = '';
  if (st.kind === 'ok' || st.kind === 'done') {
    expl = `Your daily hours stay at ${h0} because the plan already fits.`;
  } else if (st.kind === 'ramp') {
    expl = `You start at ${h0} h/day and add ${pl.opt.s * 60} minutes every ${
      pl.opt.k
    } days, up to ${hrs(st.peak * 60)} h/day, so everything fits in time.`;
  } else {
    expl = `Hours rise by ${pl.opt.s * 60} minutes every ${pl.opt.k} day${
      pl.opt.k > 1 ? 's' : ''
    } up to ${hrs(st.peak * 60)} h/day, and it is still not enough.`;
  }

  // Calendar weeks
  const first = S.planStart && S.planStart < T ? S.planStart : T;
  let lastDate = w.end;
  Object.keys(S.sched).forEach((d) => {
    if (d > lastDate) lastDate = d;
  });
  let totalDays = diffDays(first, lastDate) + 1;
  if (totalDays > 200) totalDays = 200;
  if (totalDays < 1) totalDays = 1;

  const weeks: { weekNum: number; dates: string[] }[] = [];
  for (let di = 0; di < totalDays; di++) {
    const d = addDays(first, di);
    const wi = Math.floor(di / 7);
    if (!weeks[wi]) weeks[wi] = { weekNum: wi + 1, dates: [] };
    weeks[wi].dates.push(d);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {S.planDays}-day plan · ends {fmtDate(w.end, { day: 'numeric', month: 'short' })}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1">Your plan</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('today-row');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="self-start sm:self-auto text-xs font-semibold text-[var(--accent)] hover:underline"
        >
          Jump to today on calendar
        </button>
      </div>

      {/* Multi-device Grid: Left Summary & Chart, Right Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-5">
          {/* Status Card */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-3.5">
            {cp.total > 0 && (
              <p className="font-display text-xl sm:text-2xl font-semibold leading-snug">
                You need <b className="text-[var(--accent)] tabnum">{hrs(cp.total)} hours</b>{' '}
                total; at <b className="text-[var(--accent)] tabnum">{h0} hrs/day</b>, that
                is <b className="text-[var(--accent)] tabnum">{flat} days</b>.
              </p>
            )}

            <div className="flex items-center gap-2">
              <span
                className={`inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${statusBg} ${statusColor}`}
              >
                {statusTitle}
              </span>
            </div>

            <div className="text-sm sm:text-base text-[var(--fg)] leading-relaxed">
              {st.kind === 'done' && <p>Every chapter is complete.</p>}
              {st.kind === 'ok' && (
                <p>
                  Your {S.planDays}-day plan fits at your current pace. You are on track to
                  finish by{' '}
                  <b>
                    {fmtDate(addDays(T, pl.lastIdx), {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </b>
                  .
                </p>
              )}
              {st.kind === 'ramp' && (
                <p>
                  Your pace alone is not enough, but a gradual build-up to{' '}
                  <b className="tabnum">{hrs(st.peak * 60)} h/day</b> makes it fit. Finish:{' '}
                  <b>
                    {fmtDate(addDays(T, pl.lastIdx), {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </b>
                  .
                </p>
              )}
              {st.kind === 'no' && w.D <= 0 && (
                <p>Your plan window has ended. Pick a new plan length in Settings.</p>
              )}
              {st.kind === 'no' && w.D > 0 && (
                <p>
                  You are expecting too much. About <b>{hrs(cp.total)} hours</b> of study are
                  left, which needs about <b>{hrs(cp.total / w.D)} hours every day</b> for{' '}
                  {w.D} days. Choose at least <b>{getMinDaysNeeded(S)} days</b> from today,
                  study more hours a day, or lower the notes and practice time in Settings.
                </p>
              )}
            </div>
          </section>

          {/* Hours Chart Card */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-3">
            <h2 className="font-display text-lg font-bold">Hours per day</h2>
            <p className="text-xs sm:text-sm text-[var(--muted)]">{expl}</p>
            <PlanChart
              lims={lims}
              loads={loads}
              labels={[
                'Today',
                fmtDate(addDays(T, Math.floor((n - 1) / 2)), {
                  day: 'numeric',
                  month: 'short',
                }),
                fmtDate(addDays(T, n - 1), { day: 'numeric', month: 'short' }),
              ]}
            />
            <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)] pt-1">
              <span className="inline-flex items-center gap-1.5">
                <i className="w-3 h-3 rounded bg-[var(--accent)] inline-block" />
                Hours allowed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="w-3 h-3 rounded bg-[var(--accent-soft)] inline-block" />
                Hours planned
              </span>
            </div>
          </section>
        </div>

        {/* Right Column: Calendar */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-display text-xl font-bold">Calendar</h2>
            <span className="text-xs text-[var(--muted)]">Tap Move to change a day</span>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl px-4 sm:px-6 py-3 space-y-4">
            {weeks.map((wk) => (
              <div key={wk.weekNum}>
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] pt-3 pb-1.5">
                  Week {wk.weekNum}
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {wk.dates.map((d) => (
                    <CalendarDayRow
                      key={d}
                      S={S}
                      d={d}
                      T={T}
                      end={w.end}
                      onOpenMove={onOpenMove}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- SVG Chart Component ---------- */
const PlanChart: React.FC<{
  lims: number[];
  loads: number[];
  labels: [string, string, string];
}> = ({ lims, loads, labels }) => {
  const n = lims.length;
  const W = 340;
  const H = 196;
  const ml = 32;
  const mr = 10;
  const mt = 16;
  const mb = 30;
  const iw = W - ml - mr;
  const ih = H - mt - mb;

  const mx = Math.max(...lims, ...loads, 1);
  const stp = niceStep(mx);
  const top = Math.ceil(mx / stp) * stp;

  const X = (i: number) => ml + ((i + 0.5) * iw) / n;
  const Y = (v: number) => mt + ih - (v / top) * ih;

  const gridValues: number[] = [];
  for (let t = 0; t <= top; t += stp) gridValues.push(t);

  const bw = Math.max(1.5, (iw / n) * 0.62);
  const pts = lims.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const line = 'M' + pts.join(' L');
  const area = `${line} L${X(n - 1).toFixed(1)},${mt + ih} L${X(0).toFixed(1)},${
    mt + ih
  } Z`;

  const ex = X(n - 1);
  const ey = Y(lims[n - 1]);

  return (
    <svg
      className="w-full h-auto block overflow-visible"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Hours per day over the plan"
    >
      {gridValues.map((t) => (
        <g key={t}>
          <line
            x1={ml}
            x2={W - mr}
            y1={Y(t).toFixed(1)}
            y2={Y(t).toFixed(1)}
            stroke="var(--line)"
            strokeWidth="1"
          />
          <text
            x={ml - 6}
            y={(Y(t) + 4).toFixed(1)}
            textAnchor="end"
            className="text-[11px] fill-[var(--muted)]"
          >
            {t}
          </text>
        </g>
      ))}

      {loads.map((v, i) =>
        v > 0 ? (
          <rect
            key={i}
            x={(X(i) - bw / 2).toFixed(1)}
            y={Y(v).toFixed(1)}
            width={bw.toFixed(1)}
            height={(mt + ih - Y(v)).toFixed(1)}
            rx="1.5"
            fill="var(--accent-soft)"
          />
        ) : null
      )}

      <path d={area} fill="var(--accent)" fillOpacity="0.1" />
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={ex.toFixed(1)}
        cy={ey.toFixed(1)}
        r="4.5"
        fill="var(--accent)"
        stroke="var(--surface)"
        strokeWidth="2"
      />
      <text
        x={Math.min(ex, W - mr - 8).toFixed(1)}
        y={Math.max(ey - 9, 10).toFixed(1)}
        textAnchor="end"
        className="text-[12px] font-bold fill-[var(--accent)]"
      >
        {Math.round(lims[n - 1] * 10) / 10} h
      </text>
      <text
        x={X(0).toFixed(1)}
        y={H - 8}
        textAnchor="start"
        className="text-[11px] fill-[var(--muted)]"
      >
        {labels[0]}
      </text>
      {n > 6 && (
        <text
          x={X(Math.floor((n - 1) / 2)).toFixed(1)}
          y={H - 8}
          textAnchor="middle"
          className="text-[11px] fill-[var(--muted)]"
        >
          {labels[1]}
        </text>
      )}
      <text
        x={ex.toFixed(1)}
        y={H - 8}
        textAnchor="end"
        className="text-[11px] fill-[var(--muted)]"
      >
        {labels[2]}
      </text>
    </svg>
  );
};

/* ---------- Calendar Day Row ---------- */
const CalendarDayRow: React.FC<{
  S: BoardState;
  d: string;
  T: string;
  end: string;
  onOpenMove: (id: string) => void;
}> = ({ S, d, T, end, onOpenMove }) => {
  const past = d < T;
  const today = d === T;
  const logs = (S.log[d] || []).filter((x) => chOf(S, x.c));
  const pend = past ? [] : (S.sched[d] || []).filter((x) => chOf(S, x.c));
  const mins = logs.concat(pend).reduce((a, x) => a + x.m, 0);
  const dt = parseYmd(d);

  return (
    <div
      id={today ? 'today-row' : undefined}
      className={`grid grid-cols-[56px_minmax(0,1fr)] gap-3.5 py-3.5 ${
        past ? 'opacity-65' : ''
      }`}
    >
      <div className="text-center leading-tight">
        <b
          className={`block font-display text-2xl font-bold tabnum ${
            today ? 'text-[var(--accent)]' : 'text-[var(--fg)]'
          }`}
        >
          {dt.getDate()}
        </b>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {fmtDate(d, { weekday: 'short' })}
        </span>
      </div>

      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[var(--muted)]">
          {today && <span className="text-[var(--accent)] font-bold">Today ·</span>}
          <span>{fmtDate(d, { month: 'short' })}</span>
          {mins > 0 && <span className="tabnum">· {fmtMin(mins)}</span>}
          {d > end && <span className="text-[var(--warn)]">· After plan end</span>}
        </div>

        {logs.length === 0 && pend.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            {past ? 'Nothing completed' : 'Free day'}
          </p>
        ) : (
          <div className="space-y-2">
            {logs.map((it, idx) => (
              <CalendarItem
                key={`log-${it.k || idx}`}
                S={S}
                it={it}
                done={true}
                onOpenMove={onOpenMove}
              />
            ))}
            {pend.map((it, idx) => (
              <CalendarItem
                key={`pend-${it.k || idx}`}
                S={S}
                it={it}
                done={false}
                onOpenMove={onOpenMove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CalendarItem: React.FC<{
  S: BoardState;
  it: SchedItem;
  done: boolean;
  onOpenMove: (id: string) => void;
}> = ({ S, it, done, onOpenMove }) => {
  const c = chOf(S, it.c);
  if (!c) return null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
      <div>
        <div
          className={`text-sm sm:text-base font-semibold leading-snug break-words ${
            done ? 'line-through text-[var(--muted)]' : 'text-[var(--fg)]'
          }`}
        >
          {c.name}
        </div>
        <div className="text-xs text-[var(--muted)] tabnum">
          {c.subject} · {fmtMin(it.m)}
          {it.n > 1 ? ` · part ${it.p} of ${it.n}` : ''}
          {it.t ? ` · ${fmtClock(it.t)}` : ''}
        </div>
      </div>

      {done ? (
        <span className="text-[var(--muted)] p-2">
          <Check className="w-4 h-4" />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onOpenMove(c.id)}
          aria-label={`Move ${c.name}`}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors"
        >
          <ArrowRightLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
