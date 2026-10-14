import React, { useRef, useState } from 'react';
import {
  BoardState,
  STREAM_NOTE,
  StreamKey,
  ThemePref,
} from '../types';
import {
  fmtDate,
  getCustomLen,
  getPendingTotal,
  hrs,
  todayStr,
} from '../planner';
import { CustomPlanBox, StudySettingsControls } from './SetupWizard';
import {
  Download,
  Heart,
  Moon,
  Monitor,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';

interface SettingsViewProps {
  S: BoardState;
  storageOk: boolean;
  updateState: (fn: (draft: BoardState) => void, rebuild?: boolean) => void;
  onResetPlan: () => void;
  onEraseAll: () => void;
  onOpenNote: () => void;
  onImportState: (imported: BoardState) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  S,
  storageOk,
  updateState,
  onResetPlan,
  onEraseAll,
  onOpenNote,
  onImportState,
}) => {
  const T = todayStr();
  const [confirmMode, setConfirmMode] = useState<'' | 'reset' | 'erase'>('');
  const [importMsg, setImportMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const p = getPendingTotal(S);
  const days = Math.ceil(p.min / (S.hoursPerDay * 60));

  const handleExport = () => {
    const dataStr = JSON.stringify(S, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `board-ready-backup-${T}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && parsed.v === 1 && Array.isArray(parsed.chapters)) {
          onImportState(parsed);
          setImportMsg('Plan backup restored successfully across this device.');
        } else {
          setImportMsg('Invalid backup file format.');
        }
      } catch {
        setImportMsg('Could not read that JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const themePref: ThemePref = S.theme || 'system';

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Board Ready
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1">Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Stream & Study Settings */}
        <div className="lg:col-span-7 space-y-5">
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="space-y-2">
              <span className="text-sm font-semibold block">Stream</span>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Stream">
                {(['PCM', 'PCB', 'PCMB'] as StreamKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      updateState((d) => {
                        d.stream = k;
                      }, true)
                    }
                    aria-pressed={S.stream === k}
                    className={`min-h-[44px] rounded-xl border font-semibold text-sm transition-colors ${
                      S.stream === k
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[var(--muted)] block">
                {STREAM_NOTE[S.stream]}
              </span>
            </div>

            <StudySettingsControls S={S} updateState={updateState} />
          </section>

          {/* Plan Length Card */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="space-y-2">
              <span className="text-sm font-semibold block">Plan length</span>
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                role="group"
                aria-label="Plan length"
              >
                {(['30', '60', '90', 'custom'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      updateState((d) => {
                        d.planKind = k;
                        if (k === 'custom') {
                          const D = getCustomLen(d);
                          if (D) d.planDays = D;
                        } else {
                          d.planDays = parseInt(k, 10);
                        }
                        d.planStart = todayStr();
                      }, true)
                    }
                    aria-pressed={S.planKind === k}
                    className={`min-h-[44px] rounded-xl border font-semibold text-sm transition-colors ${
                      S.planKind === k
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    {k === 'custom' ? 'Custom' : `${k} days`}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[var(--muted)] block">
                Changing this restarts the plan window from today (
                {fmtDate(T, { day: 'numeric', month: 'short' })}). Your progress is kept.
              </span>
            </div>

            {S.planKind === 'custom' && (
              <CustomPlanBox S={S} updateState={updateState} />
            )}

            <div className="rounded-2xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--fg)]">
              {!p.n ? (
                <span>
                  <b>No chapters left to plan.</b> Add video lengths or untick chapters you
                  have not finished.
                </span>
              ) : (
                <span>
                  Study time left: <b className="tabnum">{hrs(p.min)} hours</b> across {p.n}{' '}
                  chapters. At {S.hoursPerDay} h/day that is about{' '}
                  <b className="tabnum">{days} days</b>.
                  {p.missing > 0 &&
                    ` ${p.missing} chapter${
                      p.missing > 1 ? 's have' : ' has'
                    } no video length yet and is left out.`}
                </span>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Appearance, Device Sync, Syllabus Check, Reset & Credit */}
        <div className="lg:col-span-5 space-y-5">
          {/* Appearance / Theme */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-3">
            <h2 className="font-display text-lg font-bold">Appearance</h2>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Color theme">
              {(
                [
                  ['system', 'System', Monitor],
                  ['light', 'Light', Sun],
                  ['dark', 'Dark', Moon],
                ] as const
              ).map(([val, label, Icon]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() =>
                    updateState((d) => {
                      d.theme = val;
                    })
                  }
                  aria-pressed={themePref === val}
                  className={`min-h-[42px] px-3 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    themePref === val
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]'
                      : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Multi-device Backup & Restore */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-3">
            <h2 className="font-display text-lg font-bold">Multi-device backup</h2>
            <p className="text-xs sm:text-sm text-[var(--muted)]">
              Move your study plan between your phone, tablet, and laptop by exporting or
              importing your backup file.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExport}
                className="flex-1 min-h-[44px] px-4 rounded-xl border border-[var(--line)] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 hover:bg-[var(--surface-2)]"
              >
                <Download className="w-4 h-4 text-[var(--accent)]" />
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-h-[44px] px-4 rounded-xl border border-[var(--line)] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 hover:bg-[var(--surface-2)]"
              >
                <Upload className="w-4 h-4 text-[var(--accent)]" />
                Import JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {importMsg && (
              <p className="text-xs font-medium text-[var(--accent)]">{importMsg}</p>
            )}
          </section>

          {/* Syllabus Check */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-2">
            <h2 className="font-display text-lg font-bold">Syllabus check</h2>
            <p className="text-sm text-[var(--muted)]">
              Verify the chapter list against the official CBSE syllabus for this year.
            </p>
          </section>

          {/* Start Again */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-bold">Start again</h2>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  if (confirmMode === 'reset') {
                    onResetPlan();
                    setConfirmMode('');
                  } else {
                    setConfirmMode('reset');
                    setTimeout(() => {
                      setConfirmMode((c) => (c === 'reset' ? '' : c));
                    }, 4000);
                  }
                }}
                className="w-full min-h-[46px] px-4 rounded-xl border border-[var(--line)] text-[var(--accent)] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[var(--surface-2)]"
              >
                <RotateCcw className="w-4 h-4" />
                {confirmMode === 'reset' ? 'Tap again to reset the plan' : 'Reset plan'}
              </button>
              <span className="text-xs text-[var(--muted)] block">
                Clears progress, streaks, study time and the schedule, keeps your chapters and
                settings, and takes you back to setup.
              </span>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  if (confirmMode === 'erase') {
                    onEraseAll();
                    setConfirmMode('');
                  } else {
                    setConfirmMode('erase');
                    setTimeout(() => {
                      setConfirmMode((c) => (c === 'erase' ? '' : c));
                    }, 4000);
                  }
                }}
                className="w-full min-h-[46px] px-4 rounded-xl bg-[var(--bad-soft)] text-[var(--bad)] font-semibold text-sm inline-flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {confirmMode === 'erase'
                  ? 'Tap again to erase everything'
                  : 'Erase everything'}
              </button>
              <span className="text-xs text-[var(--muted)] block">
                Deletes all saved data in this browser, including your own chapter edits.
              </span>
            </div>
          </section>

          {/* Credit Card */}
          <section className="rounded-2xl bg-[var(--accent-soft)] p-6 flex flex-col items-center text-center gap-3">
            <Heart className="w-6 h-6 text-[var(--accent)] fill-[var(--accent)]" />
            <p className="font-display text-lg font-semibold">
              Made with love by Bhavya (Halchuuu)
            </p>
            <button
              type="button"
              onClick={onOpenNote}
              className="w-full min-h-[46px] rounded-xl bg-[var(--surface)] text-[var(--accent)] font-semibold text-sm hover:opacity-95 transition-opacity"
            >
              Read a note from Bhavya
            </button>
          </section>

          {!storageOk && (
            <div className="rounded-2xl bg-[var(--warn-soft)] text-[var(--warn)] p-4 text-sm">
              This browser is blocking storage, so progress will not be saved after you close
              the page.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
