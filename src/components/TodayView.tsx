import React from 'react';
import { ActivePlanInfo, BoardState, SchedItem } from '../types';
import {
  activeChapters,
  activeSubs,
  chOf,
  diffDays,
  fmtClock,
  fmtDate,
  fmtMin,
  getCheer,
  getPendingTotal,
  getStreaks,
   getSubjStats,
  parts,
  safeUrl,
  todayStr,
} from '../planner';
import {
  ArrowRightLeft,
  CalendarPlus,
  Check,
  Clock,
  ExternalLink,
  Flame,
  Plus,
  Sparkles,
} from 'lucide-react';

interface TodayViewProps {
  S: BoardState;
  A: ActivePlanInfo;
  burstKey: number | null;
  onTick: (k: number) => void;
  onUntick: (k: number) => void;
  onOpenAdd: () => void;
  onOpenMove: (id: string) => void;
  onGoToTab: (tab: 'plan' | 'chapters' | 'study') => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  S,
  A,
  burstKey,
  onTick,
  onUntick,
  onOpenAdd,
  onOpenMove,
  onGoToTab,
}) => {
  const T = todayStr();
  const chs = activeChapters(S);
  const doneN = chs.filter((c) => c.done).length;
  const total = chs.length;
  const pct = total ? Math.round((doneN / total) * 100) : 0;
  const left = diffDays(T, S.examDate);
  const streak = getStreaks(S).cur;

  const pend = (S.sched[T] || []).filter((it) => chOf(S, it.c));
  const logs = (S.log[T] || []).filter((l) => chOf(S, l.c));
  const planned = pend.concat(logs).reduce((a, x) => a + x.m, 0);
  const completedMinToday = logs.reduce((a, x) => a + x.m, 0);

  const R = 54;
  const C = 2 * Math.PI * R;
  const offset = (C * (1 - pct / 100)).toFixed(2);

  let line: string;
  if (!pend.length && logs.length) {
    line = "Today's list is done. Rest well, tomorrow is already planned.";
  } else if (!pend.length && !total) {
    line = 'Add your chapters to get started.';
  } else if (!pend.length && A.cp.total === 0) {
    line = 'Every chapter is complete. Revise, relax, and trust your work.';
  } else {
    line = getCheer(T);
  }

  const miss = getPendingTotal(S).missing;
  const subs = activeSubs(S);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {fmtDate(T, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1">Today</h1>
        </div>
        {planned > 0 && (
          <div className="text-sm text-[var(--muted)] tabnum">
            {completedMinToday > 0 ? (
              <span>
                <b className="text-[var(--fg)]">{fmtMin(completedMinToday)}</b> of{' '}
                {fmtMin(planned)} completed today
              </span>
            ) : (
              <span>
                <b className="text-[var(--fg)]">{fmtMin(planned)}</b> planned for today
              </span>
            )}
          </div>
        )}
      </div>

      {/* Multi-device Grid: Left Hero & Subject Pulse, Right Today's Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-5 space-y-5">
          {/* Hero Summary Card */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* SVG Progress Ring */}
              <div
                className={`relative w-[132px] h-[132px] shrink-0 ${
                  burstKey ? 'animate-pulse-ring' : ''
                }`}
              >
                <svg
                  width="132"
                  height="132"
                  viewBox="0 0 132 132"
                  className="-rotate-90 block"
                  role="img"
                  aria-label={`${pct} percent of chapters completed`}
                >
                  <circle
                    cx="66"
                    cy="66"
                    r={R}
                    fill="none"
                    stroke="var(--surface-2)"
                    strokeWidth="12"
                  />
                  <circle
                    cx="66"
                    cy="66"
                    r={R}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={C.toFixed(2)}
                    style={{
                      strokeDashoffset: offset,
                      transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center font-display">
                  <b className="text-3xl font-bold leading-none tabnum">{pct}%</b>
                  <span className="text-xs text-[var(--muted)] mt-1 tabnum">
                    {doneN} of {total}
                  </span>
                </div>
              </div>

              {/* Key Stats */}
              <div className="flex-1 space-y-4 text-center sm:text-left">
                <div>
                  {left > 0 ? (
                    <>
                      <div className="font-display text-3xl font-bold leading-none tabnum">
                        {left}
                      </div>
                      <div className="text-sm text-[var(--muted)] mt-1">
                        days to boards ·{' '}
                        {fmtDate(S.examDate, { day: 'numeric', month: 'short' })}
                      </div>
                    </>
                  ) : left === 0 ? (
                    <>
                      <div className="font-display text-3xl font-bold leading-none">
                        Today
                      </div>
                      <div className="text-sm text-[var(--muted)] mt-1">
                        Exams begin. All the best.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-display text-3xl font-bold leading-none">On</div>
                      <div className="text-sm text-[var(--muted)] mt-1">
                        Exam period has started
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <div className="font-display text-3xl font-bold leading-none tabnum inline-flex items-center gap-1.5">
                    <Flame className="w-6 h-6 text-[var(--accent)] fill-[var(--accent-soft)]" />
                    {streak}
                  </div>
                  <div className="text-sm text-[var(--muted)] mt-1">day streak</div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[var(--line)]">
              <p className="font-display font-semibold text-base sm:text-lg leading-snug text-[var(--fg)]">
                {line}
              </p>
            </div>
          </section>

          {/*Alerts if any*/}
          {A.cp.total > 0 && A.st.kind === 'no' && (
            <div className="rounded-2xl bg-[var(--bad-soft)] text-[var(--bad)] p-4 text-sm flex items-center justify-between gap-3">
              <span>Your plan is running behind. Check the Plan tab to adjust.</span>
              <button
                type="button"
                onClick={() => onGoToTab('plan')}
                className="px-3 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--bad)] font-semibold text-xs shrink-0"
              >
                Open Plan
              </button>
            </div>
          )}

          {miss > 0 && (
            <div className="rounded-2xl bg-[var(--warn-soft)] text-[var(--warn)] p-4 text-sm flex items-center justify-between gap-3">
              <span>
                {miss} chapter{miss > 1 ? 's have' : ' has'} no video length yet, so{' '}
                {miss > 1 ? 'they are' : 'it is'} not in the plan.
              </span>
              <button
                type="button"
                onClick={() => onGoToTab('chapters')}
                className="px-3 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--warn)] font-semibold text-xs shrink-0"
              >
                Add lengths
              </button>
            </div>
          )}

          {/* Subject Overview Card on Tablet/Desktop */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-base">Syllabus progress</h2>
              <button
                type="button"
                onClick={() => onGoToTab('chapters')}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Manage chapters
              </button>
            </div>
            <div className="space-y-3">
              {subs.map((s) => {
                const st = getSubjStats(S, s);
                const sPct = st.n ? Math.round((st.done / st.n) * 100) : 0;
                return (
                  <div key={s} className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-semibold">{s}</span>
                      <span className="text-[var(--muted)] tabnum">
                        {st.done}/{st.n} done · {sPct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                        style={{ width: `${sPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Today's Chapters */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-xl font-bold">Today&apos;s chapters</h2>
            <button
              type="button"
              onClick={onOpenAdd}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              <Plus className="w-4 h-4" />
              Add chapter
            </button>
          </div>

          {!pend.length && !logs.length ? (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 text-center space-y-3">
              <p className="text-base font-medium text-[var(--fg)]">
                Nothing is scheduled for today.
              </p>
              <p className="text-sm text-[var(--muted)]">
                {miss === total
                  ? 'Add video lengths to your chapters so Board Ready can build your daily schedule.'
                  : 'Pull a chapter into today or enjoy your free day.'}
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenAdd}
                  className="min-h-[44px] px-5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm inline-flex items-center gap-2"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Add a chapter to today
                </button>
                {miss > 0 && (
                  <button
                    type="button"
                    onClick={() => onGoToTab('chapters')}
                    className="min-h-[44px] px-5 rounded-xl border border-[var(--line)] font-semibold text-sm inline-flex items-center gap-2 hover:bg-[var(--surface-2)]"
                  >
                    Enter video lengths
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {pend.map((it) => (
                <TaskCard
                  key={it.k || it.c}
                  S={S}
                  it={it}
                  done={false}
                  isBurst={false}
                  onToggle={() => it.k && onTick(it.k)}
                  onOpenMove={() => onOpenMove(it.c)}
                />
              ))}
              {logs.map((it) => (
                <TaskCard
                  key={it.k || it.c}
                  S={S}
                  it={it}
                  done={true}
                  isBurst={burstKey === it.k}
                  onToggle={() => it.k && onUntick(it.k)}
                  onOpenMove={() => onOpenMove(it.c)}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onOpenAdd}
            className="w-full min-h-[50px] rounded-2xl border-2 border-dashed border-[var(--line)] text-[var(--accent)] font-semibold text-sm sm:text-base flex items-center justify-center gap-2 hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add a chapter to today
          </button>
        </div>
      </div>
    </div>
  );
};

interface TaskCardProps {
  S: BoardState;
  it: SchedItem;
  done: boolean;
  isBurst: boolean;
  onToggle: () => void;
  onOpenMove: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  S,
  it,
  done,
  isBurst,
  onToggle,
  onOpenMove,
}) => {
  const c = chOf(S, it.c);
  if (!c) return null;
  const b = parts(S, c);
  const url = safeUrl(S.playlists[c.subject]);

  let partLabel = '';
  if (it.n > 1) partLabel = `Part ${it.p} of ${it.n}`;
  else if ((c.doneMin || 0) > 0 && !done) partLabel = 'Rest of chapter';

  return (
    <article
      className={`grid grid-cols-[46px_minmax(0,1fr)] gap-3.5 p-4 sm:p-5 bg-[var(--surface)] border border-[var(--line)] rounded-2xl transition-all ${
        isBurst ? 'animate-pop' : ''
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? 'Mark not done: ' : 'Mark done: '}${c.name}`}
        onClick={onToggle}
        className={`relative w-[46px] h-[46px] rounded-full border-2 flex items-center justify-center transition-colors ${
          done
            ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]'
            : 'border-[var(--edge)] bg-[var(--surface)] text-transparent hover:border-[var(--accent)]'
        }`}
      >
        <Check className="w-6 h-6 stroke-[2.4]" />
        {isBurst && (
          <span className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => {
              const a = (i / 10) * 6.2832;
              const r = 34 + (i % 3) * 8;
              return (
                <i
                  key={i}
                  className="burst-dot"
                  style={
                    {
                      '--dx': `${Math.round(Math.cos(a) * r)}px`,
                      '--dy': `${Math.round(Math.sin(a) * r)}px`,
                    } as React.CSSProperties
                  }
                />
              );
            })}
          </span>
        )}
      </button>

      <div className="min-w-0 flex flex-col gap-1.5">
        {/* Clean unboxed metadata line */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[var(--muted)]">
          <span className="text-[var(--accent)] uppercase tracking-wider">{c.subject}</span>
          {partLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span>{partLabel}</span>
            </>
          )}
          {it.t && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {fmtClock(it.t)}
              </span>
            </>
          )}
          {c.test && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--warn)]">
                Test {fmtDate(c.test, { day: 'numeric', month: 'short' })}
              </span>
            </>
          )}
        </div>

        <h3
          className={`font-display text-lg sm:text-xl font-semibold leading-snug break-words ${
            done ? 'line-through text-[var(--muted)]' : 'text-[var(--fg)]'
          }`}
        >
          {c.name}
        </h3>

        <p className="text-sm text-[var(--muted)] tabnum">
          <b className="text-[var(--fg)] font-bold">{fmtMin(it.m)}</b> · Watch {fmtMin(b.w)}{' '}
          + Notes {fmtMin(b.n)} + Practice {fmtMin(b.p)}
        </p>

        {!done && (
          <div className="flex flex-wrap gap-2 pt-1.5">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-xl border border-[var(--line)] text-xs sm:text-sm font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open playlist
              </a>
            )}
            <button
              type="button"
              onClick={onOpenMove}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-xl border border-[var(--line)] text-xs sm:text-sm font-semibold text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Move
            </button>
          </div>
        )}
      </div>
    </article>
  );
};
