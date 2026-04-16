import { CameraFeed } from '@/features/registration/verification/CameraFeed';
import { VerificationControls } from '@/features/registration/verification/VerificationControls';
import { VerificationInstruction } from '@/features/registration/verification/VerificationInstruction';

type VerificationScreenProps = {
  instruction: string;
  note: string;
  statusText: string;
  videoRef: (node: HTMLVideoElement | null) => void;
  streamActive: boolean;
  actionLabel: string;
  actionDisabled: boolean;
  onAction: () => void;
  cameraFallbackMessage?: string;
};

export function VerificationScreen({
  instruction,
  note,
  statusText,
  videoRef,
  streamActive,
  actionLabel,
  actionDisabled,
  onAction,
  cameraFallbackMessage,
}: VerificationScreenProps) {
  return (
    <section className="flex h-full min-h-0 items-center justify-center px-1 py-1 sm:px-2 sm:py-2">
      <div className="relative h-[min(600px,calc(100dvh-10.5rem))] max-h-[600px] w-full max-w-4xl overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-4 shadow-[0_14px_40px_-30px_rgba(15,23,42,0.45)] sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_12%,rgba(59,130,246,0.11),transparent_38%),radial-gradient(circle_at_82%_85%,rgba(59,130,246,0.08),transparent_42%)]" />
        <div className="relative grid h-full grid-rows-[auto_auto_1fr_auto_auto] gap-3 sm:gap-4">
          <h2 className="text-center text-[1.35rem] font-semibold tracking-tight text-foreground sm:text-2xl">
            Face Verification
          </h2>

          <VerificationInstruction
            instruction={instruction}
            helperText={note}
          />

          <div className="relative mx-auto aspect-square w-68 sm:w-72">
            <div className="absolute inset-8 flex items-center justify-center sm:inset-9">
              <CameraFeed
                videoRef={videoRef}
                streamActive={streamActive}
                fallbackMessage={cameraFallbackMessage}
              />
            </div>
          </div>

          <VerificationControls
            label={actionLabel}
            onClick={onAction}
            disabled={actionDisabled}
          />

          <p className="text-center text-sm text-muted-foreground">
            {statusText}
          </p>
        </div>
      </div>
    </section>
  );
}
