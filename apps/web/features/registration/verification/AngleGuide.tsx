import { CheckCircle2 } from 'lucide-react';

import type {
  CaptureState,
  CaptureValidation,
  VerificationAngle,
} from '@/features/registration/verification/types';
import { cn } from '@/lib/utils';

type AngleGuideProps = {
  angle: VerificationAngle;
  feedback: string;
  captureState: CaptureState;
  statusLabel: string;
  validation: CaptureValidation;
};

const validationRows = [
  { key: 'faceDetected', label: 'Face detected' },
  { key: 'isCentered', label: 'Face centered' },
  { key: 'poseMatched', label: 'Pose matched' },
  { key: 'isSharpEnough', label: 'Image sharp enough' },
  { key: 'lightingOk', label: 'Lighting acceptable' },
  { key: 'isStable', label: 'Hold still' },
] as const;

export function AngleGuide({
  angle,
  feedback,
  captureState,
  statusLabel,
  validation,
}: AngleGuideProps) {
  return (
    <aside className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-white/10 dark:bg-[#0b1220]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          Live guidance
        </p>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {statusLabel}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {angle.title}
      </h3>
      <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">
        {angle.guidance}
      </p>

      <div
        className={cn(
          'rounded-lg border p-2.5 text-sm',
          captureState === 'ready' || captureState === 'captured'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300'
            : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300'
        )}
      >
        {feedback}
      </div>

      <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-slate-900/70">
        {validationRows.map((row) => {
          const done = validation[row.key];

          return (
            <div
              key={row.key}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-slate-600 dark:text-slate-300">
                {row.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                  done
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                )}
              >
                {done ? <CheckCircle2 className="size-3" /> : null}
                {done ? 'OK' : 'Pending'}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
