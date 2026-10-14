import React, { useState } from 'react';
import {
  BoardState,
  BulkVideoItem,
  STREAM_NOTE,
  StreamKey,
  SubjectName,
} from '../types';
import {
  activeSubs,
  addDays,
  computePlan,
  fmtDate,
  fmtLen,
  fmtMin,
  getCustomLen,
  getFeasibility,
  getMinDaysNeeded,
  getPendingTotal,
  getSubjStats,
  hrs,
  parseLen,
  statusOf,
  todayStr,
} from '../planner';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface SetupWizardProps {
  S: BoardState;
  updateState: (fn: (draft: BoardState) => void, rebuild?: boolean) => void;
  onOpenBulk: (sub: SubjectName) => void;
  onLoadDemoLengths: () => void;
}

const SAMPLE_SECS: Record<SubjectName, number[]> = {
  Physics: [5400, 4800, 6200, 5100, 3600, 4500, 4900, 2700, 6600, 5200, 3800, 3300, 3400, 5700],
  Chemistry: [4800, 5400, 4600, 4200, 5100, 5800, 5600, 6400, 4500, 3900],
  Maths: [4200, 3600, 4500, 4800, 6000, 5800, 7200, 4200, 5100, 4400, 4900, 3300, 5200],
  Biology: [4500, 4800, 3300, 5700, 6300, 4200, 4900, 3200, 4600, 4100, 3900, 3600, 3400],
  English: [2400, 2400, 2400, 2700, 2600, 2500, 2200, 2400, 1800, 1800, 1800, 1800, 1800, 2500, 2700, 2600, 3000, 2400, 2500, 3600, 2700],
};

export const SetupWizard: React.FC<SetupWizardProps> = ({
  S,
  updateState,
  onOpenBulk,
  onLoadDemoLengths,
}) => {
  const subs = activeSubs(S);
  const [setupSub, setSetupSub] = useState<SubjectName>(subs[0]);
  const [armedDel, setArmedDel] = useState<string | null>(null);
  const [newChName, setNewChName] = useState('');
  const [newChPos, setNewChPos] = useState('end');

  const activeSub = subs.includes(setupSub) ? setupSub : subs[0];
  const st = S.step;
  const T = todayStr();

  const stepLabels = [
    'Choose stream',
    'Your chapters',
    'Video lengths',
    'Study settings',
    'Plan length',
  ];

  const handleAddChapter = () => {
    const trimmed = newChName.trim();
    if (!trimmed) return;
    updateState((d) => {
      const ch = {
        id: 'c' + d.nextId++,
        subject: activeSub,
        name: trimmed,
        num: 0,
        secs: 0,
        done: false,
        doneMin: 0,
        test: '',
        pin: null,
      };
      let idx = -1;
      if (newChPos === 'start') {
        idx = d.chapters.findIndex((x) => x.subject === activeSub);
      } else if (newChPos.startsWith('after:')) {
        const targetId = newChPos.slice(6);
        const found = d.chapters.findIndex((x) => x.id === targetId);
        if (found > -1) idx = found + 1;
      } else {
        for (let i = d.chapters.length - 1; i >= 0; i--) {
          if (d.chapters[i].subject === activeSub) {
            idx = i + 1;
            break;
          }
        }
      }
      if (idx < 0) idx = d.chapters.length;
      d.chapters.splice(idx, 0, ch);
    });
    setNewChName('');
  };

  const handleMoveChapter = (id: string, dir: number) => {
    updateState((d) => {
      const c = d.chapters.find((x) => x.id === id);
      if (!c) return;
      const idxs: number[] = [];
      d.chapters.forEach((x, i) => {
        if (x.subject === c.subject) idxs.push(i);
      });
      const p = idxs.indexOf(d.chapters.indexOf(c));
      const q = p + dir;
      if (p < 0 || q < 0 || q >= idxs.length) return;
      const a = idxs[p];
      const b = idxs[q];
      const tmp = d.chapters[a];
      d.chapters[a] = d.chapters[b];
      d.chapters[b] = tmp;
    });
  };

  const handleFillSubjectSamples = (sub: SubjectName) => {
    updateState((d) => {
      const subChs = d.chapters.filter((c) => c.subject === sub);
      const arr = SAMPLE_SECS[sub] || [];
      subChs.forEach((c, idx) => {
        if (!c.secs) {
          c.secs = arr[idx % arr.length] || 4500;
        }
      });
    });
  };

  const pTotal = getPendingTotal(S);
  const subChapters = S.chapters.filter((c) => c.subject === activeSub);
  const subStats = getSubjStats(S, activeSub);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-[var(--line)] bg-[var(--surface)] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-xl tracking-tight text-[var(--fg)]">
              Board Ready
            </span>
            <span className="text-xs text-[var(--muted)] hidden sm:inline">
              · Class 12 CBSE Study Planner
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLoadDemoLengths}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Fill sample lengths & preview
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Stepper & Context on Desktop */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Setup · Step {st} of 5
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-[var(--fg)]">
                {stepLabels[st - 1]}
              </h1>
              <p className="text-[var(--muted)] mt-2 text-sm sm:text-base">
                {st === 1 && 'Physics, Chemistry and English are always included.'}
                {st === 2 &&
                  'Based on the NCERT list. Rename, reorder, delete or add chapters so it matches your syllabus.'}
                {st === 3 &&
                  'Paste a whole YouTube playlist at once, or type each length like 1:25:30 (h:mm:ss) or 45:10 (mm:ss). Use + to add several videos in one chapter.'}
                {st === 4 &&
                  'Tell Board Ready your video speed, note-taking buffer, and daily study pace. You can change all of these later.'}
                {st === 5 &&
                  `Your plan starts today, ${fmtDate(T, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}.`}
              </p>
            </div>

            {/* Progress Bars */}
            <div className="space-y-2">
              <div className="flex gap-1.5" aria-label={`Step ${st} of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => updateState((d) => { d.step = i; })}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      i <= st ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'
                    }`}
                    aria-label={`Go to step ${i}: ${stepLabels[i - 1]}`}
                  />
                ))}
              </div>
              <nav className="hidden lg:flex flex-col gap-1 pt-2">
                {stepLabels.map((lbl, idx) => {
                  const num = idx + 1;
                  const active = st === num;
                  const done = st > num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => updateState((d) => { d.step = num; })}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-colors ${
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                          : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]'
                      }`}
                    >
                      <span>
                        {num}. {lbl}
                      </span>
                      {done && <Check className="w-4 h-4 text-[var(--accent)]" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Live Summary Box */}
            <div className="rounded-2xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--fg)] space-y-1.5">
              <div className="font-semibold text-[var(--accent)]">Syllabus summary</div>
              {pTotal.n === 0 ? (
                <p className="text-xs sm:text-sm">
                  No chapters have video lengths yet. Add lengths in Step 3 or click{' '}
                  <button
                    type="button"
                    onClick={() => handleFillSubjectSamples(activeSub)}
                    className="underline font-semibold text-[var(--accent)]"
                  >
                    fill sample lengths
                  </button>{' '}
                  to test.
                </p>
              ) : (
                <p className="text-xs sm:text-sm leading-relaxed">
                  Study time left: <b className="tabnum">{hrs(pTotal.min)} hours</b> across{' '}
                  <b className="tabnum">{pTotal.n}</b> chapters. At{' '}
                  <span className="tabnum">{S.hoursPerDay} h/day</span> that is about{' '}
                  <b className="tabnum">
                    {Math.ceil(pTotal.min / (S.hoursPerDay * 60))} days
                  </b>
                  .
                  {pTotal.missing > 0 &&
                    ` (${pTotal.missing} chapter${
                      pTotal.missing > 1 ? 's have' : ' has'
                    } no video length yet.)`}
                </p>
              )}
            </div>
          </aside>

          {/* Right Column: Active Step Form */}
          <div className="lg:col-span-8 space-y-5">
            {st === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['PCM', 'PCB', 'PCMB'] as StreamKey[]).map((k) => {
                  const active = S.stream === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => updateState((d) => { d.stream = k; })}
                      aria-pressed={active}
                      className={`flex flex-col justify-between text-left p-6 rounded-2xl border-2 transition-all min-h-[140px] ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                          : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--edge)]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-display text-2xl font-bold">{k}</span>
                        {active && (
                          <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center">
                            <Check className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-[var(--muted)] mt-4">
                        {STREAM_NOTE[k]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {st === 2 && (
              <div className="space-y-4">
                {/* Subject Segmented Bar */}
                <div
                  className="flex flex-wrap gap-2 p-1.5 bg-[var(--surface-2)] rounded-2xl"
                  role="group"
                  aria-label="Subject"
                >
                  {subs.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSetupSub(s)}
                      aria-pressed={activeSub === s}
                      className={`flex-1 min-w-[90px] min-h-[42px] px-3 py-1.5 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap ${
                        activeSub === s
                          ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                          : 'text-[var(--fg)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl divide-y divide-[var(--line)] px-4 sm:px-6">
                  {subChapters.map((c, idx) => (
                    <div key={c.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-mono-num text-[var(--muted)] w-6 shrink-0">
                          {idx + 1}.
                        </span>
                        <input
                          className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-medium focus:border-[var(--accent)] focus:outline-none"
                          aria-label="Chapter name"
                          value={c.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateState((d) => {
                              const target = d.chapters.find((x) => x.id === c.id);
                              if (target) target.name = val;
                            });
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveChapter(c.id, -1)}
                          aria-label={`Move up: ${c.name}`}
                          className="w-10 h-10 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--fg)] disabled:opacity-30 hover:bg-[var(--surface-2)]"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === subChapters.length - 1}
                          onClick={() => handleMoveChapter(c.id, 1)}
                          aria-label={`Move down: ${c.name}`}
                          className="w-10 h-10 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--fg)] disabled:opacity-30 hover:bg-[var(--surface-2)]"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (armedDel === c.id) {
                              updateState((d) => {
                                d.chapters = d.chapters.filter((x) => x.id !== c.id);
                              });
                              setArmedDel(null);
                            } else {
                              setArmedDel(c.id);
                              setTimeout(() => {
                                setArmedDel((cur) => (cur === c.id ? null : cur));
                              }, 4000);
                            }
                          }}
                          aria-label={`Delete ${c.name}`}
                          className="min-h-[40px] px-3 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--bad)] hover:bg-[var(--bad-soft)] flex items-center gap-1"
                        >
                          {armedDel === c.id ? 'Sure?' : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add chapter row */}
                  <div className="py-4 space-y-2.5">
                    <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Add a chapter to {activeSub}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <input
                        className="sm:col-span-6 min-h-[44px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm"
                        placeholder="New chapter name"
                        aria-label="New chapter name"
                        value={newChName}
                        onChange={(e) => setNewChName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddChapter();
                          }
                        }}
                      />
                      <select
                        className="sm:col-span-4 min-h-[44px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm"
                        aria-label="Where to put the new chapter"
                        value={newChPos}
                        onChange={(e) => setNewChPos(e.target.value)}
                      >
                        <option value="end">At the end</option>
                        <option value="start">At the start</option>
                        {subChapters.map((x) => (
                          <option key={x.id} value={`after:${x.id}`}>
                            After: {x.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddChapter}
                        className="sm:col-span-2 min-h-[44px] px-4 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {st === 3 && (
              <div className="space-y-4">
                <div
                  className="flex flex-wrap gap-2 p-1.5 bg-[var(--surface-2)] rounded-2xl"
                  role="group"
                  aria-label="Subject"
                >
                  {subs.map((s) => {
                    const stSub = getSubjStats(S, s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSetupSub(s)}
                        aria-pressed={activeSub === s}
                        className={`flex-1 min-w-[100px] min-h-[42px] px-3 py-1.5 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${
                          activeSub === s
                            ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                            : 'text-[var(--fg)] hover:bg-[var(--surface)]'
                        }`}
                      >
                        <span>{s}</span>
                        <span className="text-xs opacity-80 tabnum">
                          ({stSub.n - stSub.missing}/{stSub.n})
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-7 space-y-1.5">
                      <label className="text-sm font-semibold block" htmlFor="pl-setup">
                        {activeSub} playlist link (optional)
                      </label>
                      <input
                        id="pl-setup"
                        type="url"
                        inputmode="url"
                        placeholder="https://youtube.com/playlist?list=..."
                        value={S.playlists[activeSub] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateState((d) => {
                            d.playlists[activeSub] = val;
                          });
                        }}
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm"
                      />
                    </div>
                    <div className="sm:col-span-5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenBulk(activeSub)}
                        className="flex-1 min-h-[44px] px-4 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <ClipboardPaste className="w-4 h-4" />
                        Paste all {activeSub} lengths
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillSubjectSamples(activeSub)}
                        title={`Fill sample lengths for ${activeSub}`}
                        className="min-h-[44px] px-3 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] whitespace-nowrap"
                      >
                        Sample
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--line)] pt-2">
                    {subChapters.map((c, idx) => (
                      <ChapterLengthRow
                        key={c.id}
                        index={idx + 1}
                        chapter={c}
                        onUpdateLen={(secs) =>
                          updateState((d) => {
                            const target = d.chapters.find((x) => x.id === c.id);
                            if (target) target.secs = secs;
                          })
                        }
                        onToggleDone={(done) =>
                          updateState((d) => {
                            const target = d.chapters.find((x) => x.id === c.id);
                            if (target) {
                              target.done = done;
                              target.doneMin = 0;
                            }
                          })
                        }
                      />
                    ))}
                  </div>

                  <div className="pt-2 text-sm text-[var(--muted)]">
                    Video left in {activeSub}:{' '}
                    <b className="text-[var(--fg)] tabnum">{fmtMin(subStats.vid / 60)}</b>
                    {subStats.missing > 0
                      ? ` · ${subStats.missing} chapter${
                          subStats.missing > 1 ? 's' : ''
                        } still need a length.`
                      : ' · All chapters have lengths!'}
                  </div>
                </div>
              </div>
            )}

            {st === 4 && (
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-6">
                <StudySettingsControls S={S} updateState={updateState} />
              </div>
            )}

            {st === 5 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[30, 60, 90].map((n) => {
                    const cp = computePlan(S, n, false);
                    const s = statusOf(cp);
                    let msg = '';
                    let badgeTone = 'text-[var(--accent)]';
                    if (s.kind === 'done') {
                      msg = 'Nothing left to plan';
                    } else if (s.kind === 'ok') {
                      msg = `Fits at your pace of ${S.hoursPerDay} h/day`;
                    } else if (s.kind === 'ramp') {
                      msg = `Doable with a slow build-up to ${hrs(s.peak * 60)} h/day`;
                      badgeTone = 'text-[var(--warn)]';
                    } else {
                      const md = getMinDaysNeeded(S);
                      msg = `Too much: needs ~${hrs(cp.total / n)} h/day. Choose ≥ ${md} days.`;
                      badgeTone = 'text-[var(--bad)]';
                    }
                    const selected = S.planKind === String(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          updateState((d) => {
                            d.planKind = String(n) as '30' | '60' | '90';
                            d.planDays = n;
                          })
                        }
                        aria-pressed={selected}
                        className={`flex flex-col justify-between text-left p-5 rounded-2xl border-2 transition-all ${
                          selected
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                            : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--edge)]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-display text-2xl font-bold tabnum">
                              {n} days
                            </span>
                            {selected && <Check className="w-5 h-5 text-[var(--accent)]" />}
                          </div>
                          <div className="text-sm text-[var(--muted)] mt-1">
                            Ends{' '}
                            {fmtDate(addDays(T, n - 1), {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                        <div className={`text-xs font-semibold mt-4 ${badgeTone}`}>{msg}</div>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() =>
                      updateState((d) => {
                        d.planKind = 'custom';
                        const cl = getCustomLen(d);
                        if (cl) d.planDays = cl;
                      })
                    }
                    aria-pressed={S.planKind === 'custom'}
                    className={`flex flex-col justify-between text-left p-5 rounded-2xl border-2 transition-all ${
                      S.planKind === 'custom'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--edge)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-display text-2xl font-bold">Custom</span>
                        {S.planKind === 'custom' && (
                          <Check className="w-5 h-5 text-[var(--accent)]" />
                        )}
                      </div>
                      <div className="text-sm text-[var(--muted)] mt-1">
                        Pick an end date, or a number of days
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-[var(--accent)] mt-4">
                      Flexible window up to 365 days
                    </div>
                  </button>
                </div>

                {S.planKind === 'custom' && (
                  <CustomPlanBox S={S} updateState={updateState} />
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--line)] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {st > 1 ? (
            <button
              type="button"
              onClick={() =>
                updateState((d) => {
                  d.step = Math.max(1, d.step - 1);
                })
              }
              className="min-h-[48px] px-5 rounded-xl border border-[var(--line)] font-semibold text-sm inline-flex items-center gap-2 hover:bg-[var(--surface-2)]"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {st < 5 ? (
            <button
              type="button"
              onClick={() =>
                updateState((d) => {
                  d.step = Math.min(5, d.step + 1);
                })
              }
              className="min-h-[48px] px-7 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-base inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-colors ml-auto"
            >
              Next step
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={S.planKind === 'custom' && !getCustomLen(S)}
              onClick={() =>
                updateState((d) => {
                  if (d.planKind === 'custom') {
                    const cl = getCustomLen(d);
                    if (!cl) return;
                    d.planDays = cl;
                  }
                  d.setupDone = true;
                  d.planStart = todayStr();
                  d.schedFor = '';
                }, true)
              }
              className="min-h-[48px] px-8 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-base inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] disabled:opacity-45 transition-colors ml-auto"
            >
              Start my plan
              <Check className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- Subcomponents ---------- */
interface ChapterLengthRowProps {
  index: number;
  chapter: { id: string; name: string; secs: number; done: boolean };
  onUpdateLen: (secs: number) => void;
  onToggleDone: (done: boolean) => void;
}

const ChapterLengthRow: React.FC<ChapterLengthRowProps> = ({
  index,
  chapter,
  onUpdateLen,
  onToggleDone,
}) => {
  const [draft, setDraft] = useState(fmtLen(chapter.secs));

  React.useEffect(() => {
    setDraft(fmtLen(chapter.secs));
  }, [chapter.secs]);

  return (
    <div
      className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
        chapter.done ? 'opacity-60' : ''
      }`}
    >
      <div className="font-medium text-sm sm:text-base leading-snug">
        <span className="text-xs font-mono-num text-[var(--muted)] mr-2">{index}.</span>
        {chapter.name}
      </div>
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="h:mm:ss"
          aria-label={`Video length for ${chapter.name}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = parseLen(draft);
            onUpdateLen(parsed);
            setDraft(fmtLen(parsed));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const parsed = parseLen(draft);
              onUpdateLen(parsed);
              setDraft(fmtLen(parsed));
              const inputs = Array.from(
                document.querySelectorAll<HTMLInputElement>('input[data-len-input="true"]')
              );
              const idx = inputs.indexOf(e.currentTarget);
              if (idx > -1 && inputs[idx + 1]) {
                inputs[idx + 1].focus();
                inputs[idx + 1].select();
              } else {
                e.currentTarget.blur();
              }
            }
          }}
          data-len-input="true"
          className="w-32 min-h-[42px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] font-mono-num text-sm focus:border-[var(--accent)] focus:outline-none"
        />
        <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--muted)] cursor-pointer min-h-[42px] select-none">
          <input
            type="checkbox"
            checked={chapter.done}
            onChange={(e) => onToggleDone(e.target.checked)}
            className="w-5 h-5 accent-[var(--accent)] rounded"
          />
          Already completed
        </label>
      </div>
    </div>
  );
};

export const StudySettingsControls: React.FC<{
  S: BoardState;
  updateState: (fn: (draft: BoardState) => void, rebuild?: boolean) => void;
}> = ({ S, updateState }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="text-sm font-semibold block">Video playback speed</span>
        <div
          className="grid grid-cols-5 gap-2"
          role="group"
          aria-label="Video playback speed"
        >
          {[1, 1.25, 1.5, 1.75, 2].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() =>
                updateState((d) => {
                  d.speed = v;
                }, true)
              }
              aria-pressed={S.speed === v}
              className={`min-h-[44px] rounded-xl border font-semibold text-sm tabnum transition-colors ${
                S.speed === v
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]'
                  : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold" htmlFor="r-note">
            Note-taking time
          </label>
          <span className="font-display font-bold text-lg text-[var(--accent)] tabnum">
            {S.noteMin} min
          </span>
        </div>
        <input
          type="range"
          id="r-note"
          min={0}
          max={30}
          step={1}
          value={S.noteMin}
          onChange={(e) => {
            const v = +e.target.value;
            updateState((d) => {
              d.noteMin = v;
            }, true);
          }}
        />
        <span className="text-xs text-[var(--muted)] block">
          Extra minutes for every hour of video.
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold" htmlFor="r-prac">
            Time to understand and practise
          </label>
          <span className="font-display font-bold text-lg text-[var(--accent)] tabnum">
            {S.practicePct}%
          </span>
        </div>
        <input
          type="range"
          id="r-prac"
          min={0}
          max={150}
          step={5}
          value={S.practicePct}
          onChange={(e) => {
            const v = +e.target.value;
            updateState((d) => {
              d.practicePct = v;
            }, true);
          }}
        />
        <span className="text-xs text-[var(--muted)] block">
          Extra time on top of the video time (at your speed).
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold" htmlFor="r-hpd">
            Hours you can study per day
          </label>
          <span className="font-display font-bold text-lg text-[var(--accent)] tabnum">
            {S.hoursPerDay} h
          </span>
        </div>
        <input
          type="range"
          id="r-hpd"
          min={1}
          max={12}
          step={0.5}
          value={S.hoursPerDay}
          onChange={(e) => {
            const v = +e.target.value;
            updateState((d) => {
              d.hoursPerDay = v;
            }, true);
          }}
        />
        <span className="text-xs text-[var(--muted)] block">
          Your hours right now. The plan raises this slowly only if it has to.
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold block" htmlFor="exam-date-input">
          Board exams start on
        </label>
        <input
          id="exam-date-input"
          type="date"
          value={S.examDate}
          onChange={(e) => {
            const v = e.target.value;
            if (v) {
              updateState((d) => {
                d.examDate = v;
              });
            }
          }}
          className="w-full sm:w-64 min-h-[44px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-mono-num"
        />
        <span className="text-xs text-[var(--muted)] block">
          Used for the countdown. Check the official CBSE date sheet.
        </span>
      </div>
    </div>
  );
};

export const CustomPlanBox: React.FC<{
  S: BoardState;
  updateState: (fn: (draft: BoardState) => void, rebuild?: boolean) => void;
}> = ({ S, updateState }) => {
  const T = todayStr();
  const isDate = S.customMode === 'date';
  const showExam = Boolean(S.examDate && S.examDate >= T);
  const D = getCustomLen(S);
  const f = D ? getFeasibility(S, D) : null;

  return (
    <div className="bg-[var(--surface-2)] rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex gap-2" role="group" aria-label="Custom plan type">
        <button
          type="button"
          onClick={() =>
            updateState((d) => {
              d.customMode = 'days';
              const cl = getCustomLen(d);
              if (cl) {
                d.planDays = cl;
                if (d.setupDone) d.planStart = todayStr();
              }
            }, true)
          }
          aria-pressed={!isDate}
          className={`flex-1 min-h-[42px] rounded-xl font-semibold text-sm border transition-colors ${
            !isDate
              ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]'
              : 'bg-[var(--surface)] border-[var(--line)]'
          }`}
        >
          Number of days
        </button>
        <button
          type="button"
          onClick={() =>
            updateState((d) => {
              d.customMode = 'date';
              const cl = getCustomLen(d);
              if (cl) {
                d.planDays = cl;
                if (d.setupDone) d.planStart = todayStr();
              }
            }, true)
          }
          aria-pressed={isDate}
          className={`flex-1 min-h-[42px] rounded-xl font-semibold text-sm border transition-colors ${
            isDate
              ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]'
              : 'bg-[var(--surface)] border-[var(--line)]'
          }`}
        >
          End date
        </button>
      </div>

      {isDate ? (
        <div className="space-y-2">
          <label className="text-sm font-semibold block" htmlFor="cend">
            Finish by
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="cend"
              type="date"
              min={T}
              value={S.customEnd || ''}
              onChange={(e) => {
                const v = e.target.value;
                updateState((d) => {
                  d.customEnd = v;
                  const cl = getCustomLen(d);
                  if (cl) {
                    d.planDays = cl;
                    if (d.setupDone) d.planStart = todayStr();
                  }
                }, true);
              }}
              className="min-h-[44px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-mono-num"
            />
            {showExam && (
              <button
                type="button"
                onClick={() =>
                  updateState((d) => {
                    d.customEnd = d.examDate;
                    d.customMode = 'date';
                    const cl = getCustomLen(d);
                    if (cl) {
                      d.planDays = cl;
                      if (d.setupDone) d.planStart = todayStr();
                    }
                  }, true)
                }
                className="min-h-[40px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                Use my exam date ({fmtDate(S.examDate, { day: 'numeric', month: 'short' })})
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold block" htmlFor="cdays">
            How many days?
          </label>
          <input
            id="cdays"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={S.customDays}
            onChange={(e) => {
              const v = e.target.value;
              updateState((d) => {
                d.customDays = v;
                const cl = getCustomLen(d);
                if (cl) {
                  d.planDays = cl;
                  if (d.setupDone) d.planStart = todayStr();
                }
              }, true);
            }}
            className="w-40 min-h-[44px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-mono-num"
          />
        </div>
      )}

      {/* Feasibility result */}
      <div className="space-y-2 text-sm">
        {!D || !f ? (
          <p className="text-[var(--bad)] font-medium">
            {isDate
              ? S.customEnd && S.customEnd < T
                ? 'That date has passed. Pick today or a later date.'
                : 'Pick an end date to check your plan.'
              : 'Enter a number of days from 1 to 365.'}
          </p>
        ) : (
          <>
            <p className="text-xs text-[var(--muted)]">
              {D} day{D > 1 ? 's' : ''}, from today to{' '}
              {fmtDate(addDays(T, D - 1), {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              .
            </p>
            {f.kind === 'done' && (
              <p>
                <span className="font-semibold text-[var(--accent)]">Nothing to plan · </span>
                {f.missing
                  ? 'No chapter has a video length yet. Add the lengths first, then this check can tell you if the plan is realistic.'
                  : 'Every chapter is already complete.'}
              </p>
            )}
            {f.kind === 'ok' && (
              <p>
                <span className="font-semibold text-[var(--accent)]">Realistic · </span>
                This works. You have {f.left} chapter{f.left === 1 ? '' : 's'} left, about{' '}
                <b>{hrs(f.total)} hours</b> of study (~{hrs(f.total / D)} h/day), which fits
                your {S.hoursPerDay} h/day.
              </p>
            )}
            {f.kind === 'ramp' && (
              <p>
                <span className="font-semibold text-[var(--warn)]">
                  Realistic with a slow build-up ·{' '}
                </span>
                You have {f.left} chapter{f.left === 1 ? '' : 's'} left, about{' '}
                <b>{hrs(f.total)} hours</b> of study (~{hrs(f.total / D)} h/day). The plan
                starts at {S.hoursPerDay} h/day and rises slowly to {hrs(f.peak * 60)} h/day.
              </p>
            )}
            {f.kind === 'no' && (
              <div className="space-y-1">
                <p>
                  <span className="font-semibold text-[var(--bad)]">
                    Too much for {D} day{D > 1 ? 's' : ''} ·{' '}
                  </span>
                  You have {f.left} chapter{f.left === 1 ? '' : 's'} left, about{' '}
                  <b>{hrs(f.total)} hours</b> of study. In {D} day{D > 1 ? 's' : ''} that
                  would need about <b>{hrs(f.total / D)} hours every day</b>.
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Choose at least <b>{f.minDays} days</b>, or study more hours a day in your
                  settings.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
