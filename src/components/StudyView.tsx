import React, { useState } from 'react';
import { BoardState, SubjectName } from '../types';
import {
  activeChapters,
  activeSubs,
  fmtDate,
  fmtMin,
  getActiveDays,
  getMinOn,
  getStreaks,
  getSubjStats,
  getTotalStudyMin,
  getWeekDays,
  pad,
  todayStr,
} from '../planner';
import { Flame, Pause, Play, RotateCcw, Star, X } from 'lucide-react';

export interface PomoTimerState {
  phase: 'focus' | 'short' | 'long';
  running: boolean;
  secLeft: number;
  frac: number;
}

interface StudyViewProps {
  S: BoardState;
  pomoState: PomoTimerState;
  onPomoStart: () => void;
  onPomoPause: () => void;
  onPomoReset: () => void;
  onSelectPomoSub: (sub: SubjectName) => void;
  onAddManualStudy: (sub: SubjectName, min: number) => void;
  onDeleteStudyEntry: (id: number) => void;
}

function buildLadder(
  value: number,
  steps: number[],
  labelFn: (n: number) => string,
  max?: number
) {
  const items: { n: number; label: string; got: boolean }[] = [];
  let next: number | null = null;
  for (let i = 0; i < steps.length; i++) {
    if (max && steps[i] > max) break;
    const got = value >= steps[i];
    items.push({ n: steps[i], label: labelFn(steps[i]), got });
    if (!got) {
      next = steps[i];
      break;
    }
  }
  return { items, next };
}

export const StudyView: React.FC<StudyViewProps> = ({
  S,
  pomoState,
  onPomoStart,
  onPomoPause,
  onPomoReset,
  onSelectPomoSub,
  onAddManualStudy,
  onDeleteStudyEntry,
}) => {
  const T = todayStr();
  const subs = activeSubs(S);
  const activePomoSub: SubjectName = subs.includes(S.pomo.sub as SubjectName)
    ? (S.pomo.sub as SubjectName)
    : subs[0];

  const [mSub, setMSub] = useState<SubjectName>(activePomoSub);
  const [mMin, setMMin] = useState('');
  const [mErr, setMErr] = useState('');

  const sk = getStreaks(S);
  const wd = getWeekDays();
  const mins = wd.map((d) => (d > T ? 0 : getMinOn(S, d)));
  const totWeek = mins.reduce((a, x) => a + x, 0);
  const mxWeek = Math.max(...mins, 60);

  const phaseLen =
    (pomoState.phase === 'focus' ? 25 : pomoState.phase === 'short' ? 5 : 15) * 60;
  const started = pomoState.secLeft < phaseLen;
  const C = 2 * Math.PI * 86;
  const phaseName =
    pomoState.phase === 'focus'
      ? 'Focus'
      : pomoState.phase === 'short'
      ? 'Short break'
      : 'Long break';
  const dots = pomoState.phase === 'long' ? 4 : S.pomo.done % 4;

  const recent = (S.study || []).slice(-5).reverse();

  // Badges calculation
  const ss0: number[] = [];
  for (let n7 = 7; n7 <= Math.max(7, Math.ceil((sk.best + 1) / 7) * 7); n7 += 7) {
    ss0.push(n7);
  }
  const lS = buildLadder(sk.best, ss0, (n) => `${n}-day streak`);
  const chs = activeChapters(S);
  const doneN = chs.filter((c) => c.done).length;
  const lC = buildLadder(
    doneN,
    [1, 5, 10, 20, 30, 40, 50],
    (n) => `${n} ${n > 1 ? 'chapters' : 'chapter'} finished`,
    chs.length
  );
  const hrsN = getTotalStudyMin(S) / 60;
  const lH = buildLadder(
    hrsN,
    [1, 5, 10, 25, 50, 100, 150, 200],
    (n) => `${n} ${n > 1 ? 'hours' : 'hour'} studied`
  );

  const handleManualAdd = () => {
    const mv = Math.round(parseFloat(mMin));
    if (mv >= 1 && mv <= 600) {
      onAddManualStudy(subs.includes(mSub) ? mSub : activePomoSub, mv);
      setMMin('');
      setMErr('');
    } else {
      setMErr('Enter the minutes you studied, from 1 to 600.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Extra study and progress
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1">Study</h1>
      </div>

      {/* Multi-device Grid: Left Focus Timer & Manual Logger, Right Analytics & Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-5 space-y-5">
          {/* Pomodoro Focus Card */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 flex flex-col items-center text-center space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              {phaseName}
            </div>

            <div className="relative w-[210px] h-[210px] max-w-full">
              <svg
                width="210"
                height="210"
                viewBox="0 0 210 210"
                className="-rotate-90 block"
                aria-hidden="true"
              >
                <circle
                  cx="105"
                  cy="105"
                  r="86"
                  fill="none"
                  stroke="var(--surface-2)"
                  strokeWidth="12"
                />
                <circle
                  cx="105"
                  cy="105"
                  r="86"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={C.toFixed(2)}
                  style={{
                    strokeDashoffset: (C * (1 - pomoState.frac)).toFixed(2),
                    transition: 'stroke-dashoffset 0.9s linear',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <b className="font-display text-5xl font-bold leading-none tabnum">
                  {pad(Math.floor(pomoState.secLeft / 60))}:{pad(pomoState.secLeft % 60)}
                </b>
                <span className="text-sm text-[var(--muted)] font-medium">
                  {activePomoSub}
                </span>
              </div>
            </div>

            {/* Session Dots */}
            <div
              className="flex gap-2 justify-center"
              role="img"
              aria-label={`${dots} of 4 focus sessions done`}
            >
              {[0, 1, 2, 3].map((i) => (
                <i
                  key={i}
                  className={`w-3 h-3 rounded-full border-[1.5px] ${
                    i < dots
                      ? 'bg-[var(--accent)] border-[var(--accent)]'
                      : 'bg-[var(--surface-2)] border-[var(--edge)]'
                  }`}
                />
              ))}
            </div>

            {/* Subject Selector */}
            <div
              className="flex flex-wrap gap-1.5 w-full bg-[var(--surface-2)] p-1.5 rounded-xl"
              role="group"
              aria-label="Subject for this session"
            >
              {subs.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSelectPomoSub(s)}
                  aria-pressed={s === activePomoSub}
                  className={`flex-1 min-h-[38px] px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    s === activePomoSub
                      ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                      : 'text-[var(--fg)] hover:bg-[var(--surface)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Timer Controls */}
            <div className="flex gap-2.5 flex-wrap justify-center w-full">
              {pomoState.running ? (
                <button
                  type="button"
                  onClick={onPomoPause}
                  className="flex-1 min-h-[48px] px-5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-base inline-flex items-center justify-center gap-2"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPomoStart}
                  className="flex-1 min-h-[48px] px-5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-base inline-flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] transition-colors"
                >
                  <Play className="w-4 h-4" />
                  {started
                    ? 'Resume'
                    : pomoState.phase === 'focus'
                    ? 'Start focus'
                    : 'Start break'}
                </button>
              )}

              {(started || pomoState.phase !== 'focus') && (
                <button
                  type="button"
                  onClick={onPomoReset}
                  className="min-h-[48px] px-4 rounded-xl border border-[var(--line)] text-[var(--accent)] font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[var(--surface-2)]"
                >
                  <RotateCcw className="w-4 h-4" />
                  {pomoState.phase === 'focus' ? 'Reset' : 'Skip break'}
                </button>
              )}
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              25 minutes of focus, then a 5 minute break. After four sessions you get a 15
              minute break. Each finished focus session is saved as {activePomoSub} study
              time.
            </p>
          </section>

          {/* Add Study Time Card */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold">Add study time</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                For practice or revision you did away from the timer and the playlist videos.
              </p>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_116px] gap-2.5">
              <select
                aria-label="Subject"
                value={subs.includes(mSub) ? mSub : activePomoSub}
                onChange={(e) => setMSub(e.target.value as SubjectName)}
                className="min-h-[44px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-medium"
              >
                {subs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                placeholder="Minutes"
                aria-label="Minutes studied"
                value={mMin}
                onChange={(e) => setMMin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualAdd();
                  }
                }}
                className="min-h-[44px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-mono-num"
              />
            </div>

            {mErr && <p className="text-xs text-[var(--bad)] font-medium">{mErr}</p>}

            <button
              type="button"
              onClick={handleManualAdd}
              className="w-full min-h-[46px] rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors"
            >
              Add study time
            </button>

            {recent.length > 0 && (
              <div className="divide-y divide-[var(--line)] pt-1">
                {recent.map((e) => (
                  <div
                    key={e.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <b>{e.sub}</b> · <span className="tabnum">{fmtMin(e.min)}</span>
                      <div className="text-xs text-[var(--muted)]">
                        {e.d === T ? 'Today' : fmtDate(e.d, { day: 'numeric', month: 'short' })}{' '}
                        · {e.src === 'timer' ? 'Timer' : 'Added by you'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteStudyEntry(e.id)}
                      aria-label="Remove this entry"
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Weekly Chart, Subject Progress, Streaks & Badges */}
        <div className="lg:col-span-7 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* This Week Card */}
            <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  This week
                </div>
                <p className="font-display text-2xl font-bold mt-1">
                  <b className="text-[var(--accent)] tabnum">{fmtMin(totWeek)}</b> studied
                </p>
              </div>

              <div className="grid grid-cols-7 gap-2 items-end pt-2">
                {wd.map((d, i) => {
                  const isToday = d === T;
                  const hPct = Math.round((mins[i] / mxWeek) * 100);
                  return (
                    <div
                      key={d}
                      className="flex flex-col items-center gap-1.5"
                      role="img"
                      aria-label={`${fmtDate(d, { weekday: 'long' })}: ${fmtMin(mins[i])}`}
                    >
                      <div className="h-24 w-full flex items-end">
                        <div
                          className={`w-full min-h-[4px] rounded-t-md rounded-b-sm transition-all ${
                            isToday ? 'bg-[var(--accent)]' : 'bg-[var(--accent-soft)]'
                          }`}
                          style={{ height: `${hPct}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          isToday ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                        }`}
                      >
                        {'MTWTFSS'.charAt(i)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-[var(--muted)]">
                Chapters you tick and extra study time both count.
              </p>
            </section>

            {/* Streaks Card */}
            <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <h2 className="font-display text-lg font-bold">Streaks</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--surface-2)] rounded-2xl p-4">
                  <div className="font-display text-3xl font-bold flex items-center gap-1.5 tabnum">
                    <Flame className="w-7 h-7 text-[var(--accent)] fill-[var(--accent-soft)]" />
                    {sk.cur}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">Current streak</div>
                </div>
                <div className="bg-[var(--surface-2)] rounded-2xl p-4">
                  <div className="font-display text-3xl font-bold tabnum">{sk.best}</div>
                  <div className="text-xs text-[var(--muted)] mt-1">Best streak</div>
                </div>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {getActiveDays(S)[T]
                  ? 'Today counts. '
                  : 'Tick a chapter or log study time today to keep your streak going. '}
                A day counts when you tick a chapter or log study time.
              </p>
            </section>
          </div>

          {/* Progress by Subject Card */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-3">
            <h2 className="font-display text-lg font-bold">Progress by subject</h2>
            <div className="divide-y divide-[var(--line)]">
              {subs.map((s) => {
                const ss = getSubjStats(S, s);
                const pct = ss.n ? Math.round((ss.done / ss.n) * 100) : 0;
                const wk = wd.reduce((a, d) => a + (d > T ? 0 : getMinOn(S, d, s)), 0);
                return (
                  <div key={s} className="py-3 space-y-1.5 first:pt-1 last:pb-1">
                    <div className="flex items-center justify-between text-sm">
                      <b>{s}</b>
                      <span className="text-xs text-[var(--muted)] tabnum">
                        {ss.done} of {ss.n} chapters
                      </span>
                    </div>
                    <div
                      className="h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden"
                      role="progressbar"
                      aria-label={`${s} chapters completed`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                    >
                      <i
                        className="block h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--muted)] block tabnum">
                      This week: {fmtMin(wk)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Badges Card */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-5">
            <h2 className="font-display text-lg font-bold">Badges</h2>

            <BadgeGroup
              title="Streak"
              note={`A new badge every 7 days in a row. ${
                lS.next ? `Next one at ${lS.next} days.` : ''
              }`}
              lad={lS}
            />

            <BadgeGroup
              title="Chapters finished"
              note={
                lC.next
                  ? `Next one at ${lC.next} chapters. You have finished ${doneN}.`
                  : 'You earned every chapter badge. Well done.'
              }
              lad={lC}
            />

            <BadgeGroup
              title="Hours studied"
              note={
                lH.next
                  ? `Next one at ${lH.next} hours. You have studied ${
                      Math.round(hrsN * 10) / 10
                    }.`
                  : 'You earned every hours badge. Well done.'
              }
              lad={lH}
            />
          </section>
        </div>
      </div>
    </div>
  );
};

const BadgeGroup: React.FC<{
  title: string;
  note: string;
  lad: { items: { n: number; label: string; got: boolean }[] };
}> = ({ title, note, lad }) => {
  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <p className="text-xs text-[var(--muted)]">{note}</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {lad.items.map((b) => (
          <div
            key={b.n}
            role="img"
            aria-label={`${b.label}${b.got ? ', earned' : ', not earned yet'}`}
            className={`flex flex-col items-center gap-1.5 text-center ${
              b.got ? 'opacity-100' : 'opacity-55'
            }`}
          >
            <span
              className={`w-16 h-16 rounded-full flex flex-col items-center justify-center gap-0.5 leading-none ${
                b.got
                  ? 'border-2 border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-2 border-dashed border-[var(--edge)] text-[var(--muted)]'
              }`}
            >
              <Star
                className={`w-4 h-4 ${b.got ? 'fill-[var(--accent)]' : ''}`}
              />
              <b className="font-display text-lg font-bold tabnum">{b.n}</b>
            </span>
            <span
              className={`text-xs leading-tight ${
                b.got ? 'text-[var(--fg)] font-medium' : 'text-[var(--muted)]'
              }`}
            >
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
