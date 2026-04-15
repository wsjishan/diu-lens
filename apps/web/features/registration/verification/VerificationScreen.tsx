import { CameraFeed } from '@/features/registration/verification/CameraFeed';
import { ProgressRing } from '@/features/registration/verification/ProgressRing';
import { VerificationControls } from '@/features/registration/verification/VerificationControls';
import { VerificationInstruction } from '@/features/registration/verification/VerificationInstruction';

type VerificationScreenProps = {
  instruction: string;
  helperText?: string;
  feedback: string;
  stepIndex: number;
  totalSteps: number;
  captureIndex: number;
  requiredCaptures: number;
  progressPercent: number;
  holdProgress: number;
  videoRef: (node: HTMLVideoElement | null) => void;
  streamActive: boolean;
  permissionBlocked: boolean;
  isRequestingPermission: boolean;
  isAutoCaptureActive: boolean;
  isAutoCaptureEnabled: boolean;
  isManualFallback: boolean;
  canCaptureNow: boolean;
  onEnableCamera: () => void;
  onCaptureNow: () => void;
  onResumeAutoCapture: () => void;
  onRetake: () => void;
  canRetake: boolean;
  autoCaptureHint: string;
  cameraFallbackMessage?: string;
};

export function VerificationScreen({
  instruction,
  helperText,
  feedback,
  stepIndex,
  totalSteps,
  captureIndex,
  requiredCaptures,
  progressPercent,
  holdProgress,
  videoRef,
  streamActive,
  permissionBlocked,
  isRequestingPermission,
  isAutoCaptureActive,
  isAutoCaptureEnabled,
  isManualFallback,
  canCaptureNow,
  onEnableCamera,
  onCaptureNow,
  onResumeAutoCapture,
  onRetake,
  canRetake,
  autoCaptureHint,
  cameraFallbackMessage,
}: VerificationScreenProps) {
  const stepNumber = stepIndex + 1;

  return (
    <section className="flex h-full min-h-0 items-center justify-center px-1 py-1 sm:px-2 sm:py-2">
      <div className="relative h-[min(600px,calc(100dvh-10.5rem))] max-h-[600px] w-full max-w-4xl overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-4 shadow-[0_14px_40px_-30px_rgba(15,23,42,0.45)] sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_12%,rgba(59,130,246,0.11),transparent_38%),radial-gradient(circle_at_82%_85%,rgba(59,130,246,0.08),transparent_42%)]" />
        <div className="relative grid h-full grid-rows-[auto_auto_1fr_auto_auto_auto] gap-3 sm:gap-4">
          <h2 className="text-center text-[1.35rem] font-semibold tracking-tight text-foreground sm:text-2xl">
            Face Verification
          </h2>

          <VerificationInstruction
            instruction={instruction}
            helperText={helperText}
          />

          <div className="relative mx-auto aspect-square w-68 sm:w-72">
            <ProgressRing
              totalSteps={totalSteps}
              currentStepIndex={stepIndex}
              progressPercent={progressPercent}
              holdProgress={holdProgress}
            />
            <div className="absolute inset-[2rem] flex items-center justify-center sm:inset-[2.15rem]">
              <CameraFeed
                videoRef={videoRef}
                streamActive={streamActive}
                fallbackMessage={cameraFallbackMessage}
              />
            </div>
          </div>

          <div className="space-y-0.5 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Step {stepNumber} of {totalSteps}
            </p>
            {requiredCaptures > 1 ? (
              <p className="text-xs text-muted-foreground">
                Capture {captureIndex} of {requiredCaptures}
              </p>
            ) : null}
            <p className="text-xs font-medium text-primary/90">
              Progress {progressPercent}%
            </p>
          </div>

          <VerificationControls
            permissionBlocked={permissionBlocked}
            isRequestingPermission={isRequestingPermission}
            isAutoCaptureActive={isAutoCaptureActive}
            isAutoCaptureEnabled={isAutoCaptureEnabled}
            isManualFallback={isManualFallback}
            canCaptureNow={canCaptureNow}
            onEnableCamera={onEnableCamera}
            onCaptureNow={onCaptureNow}
            onResumeAutoCapture={onResumeAutoCapture}
            onRetake={onRetake}
            canRetake={canRetake}
            statusText={autoCaptureHint}
          />

          <p className="text-center text-sm text-muted-foreground">
            {feedback}
          </p>
        </div>
      </div>
    </section>
  );
}
