/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivePlanInfo,
  BoardState,
  SubjectName,
  TabId,
} from './types';
import {
  activeChapters,
  activeSubs,
  chOf,
  createDefaults,
  diffDays,
  fmtDate,
  getStreaks,
  loadState,
  migrateState,
  pad,
  rebuildSchedule,
  saveState,
  sortDay,
  todayStr,
  totalMin,
} from './planner';
import { SetupWizard } from './components/SetupWizard';
import { TodayView } from './components/TodayView';
import { PlanView } from './components/PlanView';
import { PomoTimerState, StudyView } from './components/StudyView';
import { ChaptersView } from './components/ChaptersView';
import { SettingsView } from './components/SettingsView';
import { SheetState, Sheets } from './components/Sheets';
import {
  BookOpen,
  Calendar,
  Flame,
  LineChart,
  Moon,
  Plus,
  SlidersHorizontal,
  Sun,
  Timer,
} from 'lucide-react';

const PM_LEN = { focus: 25, short: 5, long: 15 };

const DEMO_SECS: Record<SubjectName, number[]> = {
  Physics: [5400, 4800, 6200, 5100, 3600, 4500, 4900, 2700, 6600, 5200, 3800, 3300, 3400, 5700],
  Chemistry: [4800, 5400, 4600, 4200, 5100, 5800, 5600, 6400, 4500, 3900],
  Maths: [4200, 3600, 4500, 4800, 6000, 5800, 7200, 4200, 5100, 4400, 4900, 3300, 5200],
  Biology: [4500, 4800, 3300, 5700, 6300, 4200, 4900, 3200, 4600, 4100, 3900, 3600, 3400],
  English: [2400, 2400, 2400, 2700, 2600, 2500, 2200, 2400, 1800, 1800, 1800, 1800, 1800, 2500, 2700, 2600, 3000, 2400, 2500, 3600, 2700],
};

function playBeep(acRef: React.MutableRefObject<AudioContext | null>) {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!acRef.current) acRef.current = new AC();
    const ac = acRef.current;
    const now = ac.currentTime;
    [0, 0.35].forEach((dt) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = dt ? 660 : 880;
      o.connect(g);
      g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, now + dt);
      g.gain.exponentialRampToValueAtTime(0.25, now + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.3);
      o.start(now + dt);
      o.stop(now + dt + 0.32);
    });
  } catch {
    // ignore audio block
  }
  try {
    if (navigator.vibrate) navigator.vibrate(200);
  } catch {
    // ignore vibrate error
  }
}

export default function App() {
  const [{ state: S, activePlan: A, storageOk }, setApp] = useState<{
    state: BoardState;
    activePlan: ActivePlanInfo | null;
    storageOk: boolean;
  }>(() => {
    const loaded = loadState();
    let plan: ActivePlanInfo | null = null;
    if (loaded.state.setupDone) {
      plan = rebuildSchedule(loaded.state, loaded.state.schedFor === todayStr());
      saveState(loaded.state);
    }
    return {
      state: loaded.state,
      activePlan: plan,
      storageOk: loaded.storageOk,
    };
  });

  const [tab, setTab] = useState<TabId>('today');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [burstKey, setBurstKey] = useState<number | null>(null);

  // Pomodoro state
  const acRef = useRef<AudioContext | null>(null);
  const pmRef = useRef<{
    phase: 'focus' | 'short' | 'long';
    running: boolean;
    endAt: number;
    left: number;
  }>({
    phase: 'focus',
    running: false,
    endAt: 0,
    left: PM_LEN.focus * 60,
  });

  const [pomoUi, setPomoUi] = useState<PomoTimerState>({
    phase: 'focus',
    running: false,
    secLeft: PM_LEN.focus * 60,
    frac: 0,
  });

  // Sync theme attribute on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (S.theme === 'light' || S.theme === 'dark') {
      root.setAttribute('data-theme', S.theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }, [S.theme]);

  // Helper to mutate state and optionally rebuild schedule
  const updateState = useCallback(
    (mutator: (draft: BoardState) => void, shouldRebuild = false) => {
      setApp((prev) => {
        const next: BoardState = JSON.parse(JSON.stringify(prev.state));
        mutator(next);
        const sk = getStreaks(next);
        if (sk.best > (next.best || 0)) next.best = sk.best;
        let nextPlan = prev.activePlan;
        if (next.setupDone && (shouldRebuild || !nextPlan)) {
          nextPlan = rebuildSchedule(next, false);
        }
        const ok = saveState(next);
        return {
          state: next,
          activePlan: nextPlan,
          storageOk: prev.storageOk && ok,
        };
      });
    },
    []
  );

  // Day rollover check
  useEffect(() => {
    const checkNewDay = () => {
      setApp((prev) => {
        if (!prev.state.setupDone) return prev;
        const T = todayStr();
        if (prev.state.schedFor !== T) {
          const next: BoardState = JSON.parse(JSON.stringify(prev.state));
          const nextPlan = rebuildSchedule(next, false);
          saveState(next);
          return { ...prev, state: next, activePlan: nextPlan };
        }
        return prev;
      });
    };

    const handleVis = () => {
      if (!document.hidden) checkNewDay();
    };
    document.addEventListener('visibilitychange', handleVis);
    const id = setInterval(checkNewDay, 60000);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      clearInterval(id);
    };
  }, []);

  // Pomodoro tick loop
  const syncPomoUi = useCallback(() => {
    const p = pmRef.current;
    const tot =
      (p.phase === 'focus'
        ? PM_LEN.focus
        : p.phase === 'short'
        ? PM_LEN.short
        : PM_LEN.long) * 60;
    const sec = p.running
      ? Math.max(0, Math.ceil((p.endAt - Date.now()) / 1000))
      : p.left;
    const frac = Math.min(1, Math.max(0, (tot - sec) / tot));
    setPomoUi({
      phase: p.phase,
      running: p.running,
      secLeft: sec,
      frac,
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const p = pmRef.current;
      if (!p.running) return;
      const sec = Math.max(0, Math.ceil((p.endAt - Date.now()) / 1000));
      if (sec <= 0) {
        if (p.phase === 'focus') {
          setApp((prev) => {
            const next: BoardState = JSON.parse(JSON.stringify(prev.state));
            const subs = activeSubs(next);
            const sub = subs.includes(next.pomo.sub as SubjectName)
              ? (next.pomo.sub as SubjectName)
              : subs[0];
            next.study.push({
              id: next.studyNext++,
              d: todayStr(),
              sub,
              min: PM_LEN.focus,
              src: 'timer',
            });
            next.pomo.done++;
            const sk = getStreaks(next);
            if (sk.best > (next.best || 0)) next.best = sk.best;
            saveState(next);

            const nextPhase = next.pomo.done % 4 === 0 ? 'long' : 'short';
            const nextLen =
              (nextPhase === 'long' ? PM_LEN.long : PM_LEN.short) * 60;
            pmRef.current = {
              phase: nextPhase,
              running: true,
              left: nextLen,
              endAt: Date.now() + nextLen * 1000,
            };
            return { ...prev, state: next };
          });
        } else {
          const focusLen = PM_LEN.focus * 60;
          pmRef.current = {
            phase: 'focus',
            running: false,
            left: focusLen,
            endAt: 0,
          };
        }
        playBeep(acRef);
      }
      syncPomoUi();
    }, 1000);
    return () => clearInterval(timer);
  }, [syncPomoUi]);

  // Actions
  const handleTick = (k: number) => {
    setApp((prev) => {
      const next: BoardState = JSON.parse(JSON.stringify(prev.state));
      const T = todayStr();
      const list = next.sched[T] || [];
      const ix = list.findIndex((x) => x.k === k);
      if (ix < 0) return prev;
      const it = list.splice(ix, 1)[0];
      const c = chOf(next, it.c);
      if (c) {
        c.doneMin = (c.doneMin || 0) + it.m;
        if (totalMin(next, c) - c.doneMin <= 0) c.done = true;
      }
      (next.log[T] = next.log[T] || []).push(it);
      const sk = getStreaks(next);
      if (sk.best > (next.best || 0)) next.best = sk.best;
      const nextPlan = rebuildSchedule(next, true);
      saveState(next);
      return { ...prev, state: next, activePlan: nextPlan };
    });
    setBurstKey(k);
    setTimeout(() => {
      setBurstKey((cur) => (cur === k ? null : cur));
    }, 800);
  };

  const handleUntick = (k: number) => {
    setApp((prev) => {
      const next: BoardState = JSON.parse(JSON.stringify(prev.state));
      const T = todayStr();
      const lg = next.log[T] || [];
      const ix = lg.findIndex((x) => x.k === k);
      if (ix < 0) return prev;
      const it = lg.splice(ix, 1)[0];
      const c = chOf(next, it.c);
      if (!lg.length) delete next.log[T];
      if (c) {
        c.doneMin = Math.max(0, (c.doneMin || 0) - it.m);
        c.done = false;
      }
      (next.sched[T] = next.sched[T] || []).push(it);
      const nextPlan = rebuildSchedule(next, true);
      saveState(next);
      return { ...prev, state: next, activePlan: nextPlan };
    });
  };

  const handleMoveChapter = (id: string, date: string, time: string) => {
    setApp((prev) => {
      const next: BoardState = JSON.parse(JSON.stringify(prev.state));
      const c = chOf(next, id);
      const T = todayStr();
      if (!c || !date || date < T || c.done) return prev;
      const today = next.sched[T] || [];
      const inToday = today.filter((x) => x.c === id);
      if (date === T) {
        if (inToday.length) {
          inToday.forEach((x) => {
            x.t = time || '';
          });
        } else {
          const r = totalMin(next, c) - (c.doneMin || 0);
          if (r > 0) {
            today.push({
              k: next.nextK++,
              c: id,
              m: r,
              p: 1,
              n: 1,
              t: time || '',
            });
          }
        }
        next.sched[T] = sortDay(today);
      } else {
        next.sched[T] = today.filter((x) => x.c !== id);
      }
      c.pin = { date, time: time || '' };
      const nextPlan = rebuildSchedule(next, true);
      saveState(next);
      return { ...prev, state: next, activePlan: nextPlan };
    });
  };

  const handleClearPin = (id: string) => {
    setApp((prev) => {
      const next: BoardState = JSON.parse(JSON.stringify(prev.state));
      const c = chOf(next, id);
      if (c) c.pin = null;
      const nextPlan = rebuildSchedule(next, true);
      saveState(next);
      return { ...prev, state: next, activePlan: nextPlan };
    });
  };

  const handleSaveTestDate = (id: string, testDate: string) => {
    setApp((prev) => {
      const next: BoardState = JSON.parse(JSON.stringify(prev.state));
      const c = chOf(next, id);
      if (c) c.test = testDate || '';
      const nextPlan = rebuildSchedule(next, true);
      saveState(next);
      return { ...prev, state: next, activePlan: nextPlan };
    });
  };

  const handleApplyBulk = (
    _sub: SubjectName,
    sums: Record<string, number>,
    skipDone: boolean
  ) => {
    updateState((d) => {
      Object.keys(sums).forEach((id) => {
        const c = chOf(d, id);
        if (!c || (skipDone && c.done)) return;
        c.secs = sums[id];
      });
    }, true);
  };

  const handleLoadDemoLengths = () => {
    setApp((prev) => {
      const next: BoardState = JSON.parse(JSON.stringify(prev.state));
      (['Physics', 'Chemistry', 'Maths', 'Biology', 'English'] as SubjectName[]).forEach(
        (sub) => {
          const chs = next.chapters.filter((c) => c.subject === sub);
          const arr = DEMO_SECS[sub] || [];
          chs.forEach((c, idx) => {
            if (!c.secs) c.secs = arr[idx % arr.length] || 4500;
          });
        }
      );
      next.setupDone = true;
      next.planStart = todayStr();
      next.schedFor = '';
      const nextPlan = rebuildSchedule(next, false);
      saveState(next);
      return { ...prev, state: next, activePlan: nextPlan };
    });
    setTab('today');
    window.scrollTo(0, 0);
  };

  // Pomodoro handlers
  const handlePomoStart = () => {
    if (pmRef.current.running) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AC && !acRef.current) acRef.current = new AC();
      if (acRef.current && acRef.current.state === 'suspended') {
        acRef.current.resume();
      }
    } catch {
      // ignore
    }
    pmRef.current.running = true;
    pmRef.current.endAt = Date.now() + pmRef.current.left * 1000;
    syncPomoUi();
  };

  const handlePomoPause = () => {
    const p = pmRef.current;
    const sec = p.running
      ? Math.max(0, Math.ceil((p.endAt - Date.now()) / 1000))
      : p.left;
    p.left = sec;
    p.running = false;
    syncPomoUi();
  };

  const handlePomoReset = () => {
    pmRef.current = {
      phase: 'focus',
      running: false,
      left: PM_LEN.focus * 60,
      endAt: 0,
    };
    syncPomoUi();
  };

  // Setup mode
  if (!S.setupDone || !A) {
    return (
      <>
        <SetupWizard
          S={S}
          updateState={updateState}
          onOpenBulk={(sub) => setSheet({ type: 'bulk', sub })}
          onLoadDemoLengths={handleLoadDemoLengths}
        />
        <Sheets
          S={S}
          sheet={sheet}
          onClose={() => setSheet(null)}
          onMoveChapter={handleMoveChapter}
          onClearPin={handleClearPin}
          onSaveTestDate={handleSaveTestDate}
          onApplyBulk={handleApplyBulk}
        />
      </>
    );
  }

  const T = todayStr();
  const chs = activeChapters(S);
  const doneN = chs.filter((c) => c.done).length;
  const pct = chs.length ? Math.round((doneN / chs.length) * 100) : 0;
  const left = diffDays(T, S.examDate);
  const streak = getStreaks(S).cur;

  const navItems: { id: TabId; label: string; Icon: React.ElementType }[] = [
    { id: 'today', label: 'Today', Icon: Calendar },
    { id: 'plan', label: 'Plan', Icon: LineChart },
    { id: 'study', label: 'Study', Icon: Timer },
    { id: 'chapters', label: 'Chapters', Icon: BookOpen },
    { id: 'settings', label: 'Settings', Icon: SlidersHorizontal },
  ];

  const toggleQuickTheme = () => {
    const isDarkNow =
      S.theme === 'dark' ||
      (S.theme !== 'light' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    updateState((d) => {
      d.theme = isDarkNow ? 'light' : 'dark';
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex flex-col md:flex-row">
      {/* Desktop & Tablet Left Navigation Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col justify-between border-r border-[var(--line)] bg-[var(--surface)] p-5 sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Brand & Theme Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-display font-bold text-2xl tracking-tight text-[var(--fg)] block">
                Board Ready
              </span>
              <span className="text-xs font-semibold text-[var(--muted)]">
                {S.stream} · Class 12 CBSE
              </span>
            </div>
            <button
              type="button"
              onClick={toggleQuickTheme}
              aria-label="Toggle light or dark mode"
              className="w-10 h-10 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
            >
              {S.theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Primary Nav */}
          <nav className="space-y-1.5" aria-label="Main navigation">
            {navItems.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTab(id);
                    window.scrollTo(0, 0);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full min-h-[46px] px-4 rounded-xl font-semibold text-sm flex items-center justify-between transition-colors ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    {label}
                  </span>
                  {id === 'study' && pomoUi.running && (
                    <span className="text-xs font-mono-num text-[var(--accent)]">
                      {pad(Math.floor(pomoUi.secLeft / 60))}:
                      {pad(pomoUi.secLeft % 60)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Action */}
          <button
            type="button"
            onClick={() => setSheet({ type: 'add' })}
            className="w-full min-h-[46px] px-4 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add chapter to today
          </button>
        </div>

        {/* Bottom Compact Summary in Sidebar */}
        <div className="pt-6 border-t border-[var(--line)] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted)] font-semibold">Syllabus done</span>
            <span className="font-bold text-[var(--fg)] tabnum">
              {doneN}/{chs.length} ({pct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--fg)] tabnum">
              <Flame className="w-4 h-4 text-[var(--accent)] fill-[var(--accent-soft)]" />
              {streak}d streak
            </span>
            <span className="tabnum">
              {left > 0
                ? `${left}d to ${fmtDate(S.examDate, {
                    day: 'numeric',
                    month: 'short',
                  })}`
                : 'Boards period'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-lg tracking-tight">
              Board Ready
            </span>
            <span className="text-xs text-[var(--muted)] font-semibold">
              · {S.stream}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {pomoUi.running && tab !== 'study' && (
              <button
                type="button"
                onClick={() => setTab('study')}
                className="px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-mono-num font-semibold"
              >
                {pad(Math.floor(pomoUi.secLeft / 60))}:{pad(pomoUi.secLeft % 60)}
              </button>
            )}
            <button
              type="button"
              onClick={toggleQuickTheme}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)]"
            >
              {S.theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12">
          {tab === 'today' && (
            <TodayView
              S={S}
              A={A}
              burstKey={burstKey}
              onTick={handleTick}
              onUntick={handleUntick}
              onOpenAdd={() => setSheet({ type: 'add' })}
              onOpenMove={(id) => setSheet({ type: 'move', id })}
              onGoToTab={(t) => {
                setTab(t);
                window.scrollTo(0, 0);
              }}
            />
          )}

          {tab === 'plan' && (
            <PlanView
              S={S}
              A={A}
              onOpenMove={(id) => setSheet({ type: 'move', id })}
            />
          )}

          {tab === 'study' && (
            <StudyView
              S={S}
              pomoState={pomoUi}
              onPomoStart={handlePomoStart}
              onPomoPause={handlePomoPause}
              onPomoReset={handlePomoReset}
              onSelectPomoSub={(sub) =>
                updateState((d) => {
                  d.pomo.sub = sub;
                })
              }
              onAddManualStudy={(sub, min) =>
                updateState((d) => {
                  d.study.push({
                    id: d.studyNext++,
                    d: todayStr(),
                    sub,
                    min,
                    src: 'manual',
                  });
                })
              }
              onDeleteStudyEntry={(id) =>
                updateState((d) => {
                  d.study = d.study.filter((e) => e.id !== id);
                })
              }
            />
          )}

          {tab === 'chapters' && (
            <ChaptersView
              S={S}
              updateState={updateState}
              onOpenBulk={(sub) => setSheet({ type: 'bulk', sub })}
              onOpenMove={(id) => setSheet({ type: 'move', id })}
            />
          )}

          {tab === 'settings' && (
            <SettingsView
              S={S}
              storageOk={storageOk}
              updateState={updateState}
              onResetPlan={() => {
                handlePomoReset();
                setApp((prev) => {
                  const next: BoardState = JSON.parse(JSON.stringify(prev.state));
                  next.chapters.forEach((c) => {
                    c.done = false;
                    c.doneMin = 0;
                    c.pin = null;
                  });
                  next.log = {};
                  next.study = [];
                  next.best = 0;
                  next.pomo.done = 0;
                  next.sched = {};
                  next.schedFor = '';
                  next.todaySubj = '';
                  next.setupDone = false;
                  next.step = 1;
                  saveState(next);
                  return { ...prev, state: next, activePlan: null };
                });
                window.scrollTo(0, 0);
              }}
              onEraseAll={() => {
                handlePomoReset();
                const fresh = createDefaults();
                saveState(fresh);
                setApp({
                  state: fresh,
                  activePlan: null,
                  storageOk: true,
                });
                setTab('today');
                window.scrollTo(0, 0);
              }}
              onOpenNote={() => setSheet({ type: 'note' })}
              onImportState={(imported) => {
                const base = createDefaults();
                Object.assign(base, imported);
                migrateState(base, imported);
                const nextPlan = base.setupDone
                  ? rebuildSchedule(base, base.schedFor === todayStr())
                  : null;
                saveState(base);
                setApp({
                  state: base,
                  activePlan: nextPlan,
                  storageOk: true,
                });
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--line)] px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))]">
        <nav
          aria-label="Main"
          className="max-w-lg mx-auto grid grid-cols-5 gap-1"
        >
          {navItems.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  setSheet(null);
                  window.scrollTo(0, 0);
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1.5 px-1 rounded-xl text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'text-[var(--muted)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Modals / Sheets */}
      <Sheets
        S={S}
        sheet={sheet}
        onClose={() => setSheet(null)}
        onMoveChapter={handleMoveChapter}
        onClearPin={handleClearPin}
        onSaveTestDate={handleSaveTestDate}
        onApplyBulk={handleApplyBulk}
      />
    </div>
  );
}
