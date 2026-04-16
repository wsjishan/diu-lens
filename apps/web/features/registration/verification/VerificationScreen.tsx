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
  acceptedShotsForCurrentAngle: number;
  requiredCaptures: number;
  totalAcceptedShots: number;
  totalRequiredShots: number;
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
  debugState?: {
    currentAngle: string;
    yaw: number;
    rawYaw: number;
    pitch: number;
    rawPitch: number;
    rawFaceCenter: { x: number; y: number } | null;
    faceDetected: boolean;
    isCentered: boolean;
    poseMatched: boolean;
    isStable: boolean;
    lightingOk: boolean;
    isSharpEnough: boolean;
    canCapture: boolean;
    poseHoldSatisfied: boolean;
    isCapturing: boolean;
    autoCaptureEnabled: boolean;
    acceptedShotsForCurrentAngle: number;
    totalAcceptedShots: number;
    cooldownRemainingMs: number;
    cameraReady: boolean;
    landmarkModelLoaded: boolean;
    landmarksDetected: boolean;
    fallbackPoseUsed: boolean;
    rawLandmarkCount: number | null;
    captureTriggerCount: number;
    blockingReason: string;
    expectedYawRange: [number, number] | null;
    expectedPitchRange: [number, number] | null;
    poseHoldMs: number;
    requiredPoseHoldMs: number;
    stabilityMs: number;
    requiredStabilityMs: number;
    debugModeEnabled: boolean;
    relaxThresholdsEnabled: boolean;
    onToggleDebugMode: () => void;
    onToggleRelaxThresholds: () => void;
  };
};

export function VerificationScreen({
  instruction,
  helperText,
  feedback,
  stepIndex,
  totalSteps,
  acceptedShotsForCurrentAngle,
  requiredCaptures,
  totalAcceptedShots,
  totalRequiredShots,
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
  debugState,
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
                Accepted {acceptedShotsForCurrentAngle} of {requiredCaptures}{' '}
                for this angle
              </p>
            ) : null}
            {requiredCaptures > 1 ? (
              <div className="mx-auto mt-1.5 flex w-fit items-center gap-1.5">
                {Array.from({ length: requiredCaptures }).map((_, index) => {
                  const isFilled = index < acceptedShotsForCurrentAngle;

                  return (
                    <span
                      key={index}
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: isFilled
                          ? 'var(--primary)'
                          : 'var(--border)',
                        opacity: isFilled ? 1 : 0.55,
                      }}
                    />
                  );
                })}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Total accepted {totalAcceptedShots} of {totalRequiredShots}
            </p>
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

          {process.env.NODE_ENV !== 'production' && debugState ? (
            <div className="rounded-md border border-dashed border-border/70 bg-muted/45 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              <p className="font-semibold text-foreground/80">
                Debug (temporary)
              </p>
              <div className="mb-1 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={debugState.onToggleDebugMode}
                  className="rounded border border-border/80 px-2 py-0.5 text-[10px] font-medium"
                >
                  Debug mode: {debugState.debugModeEnabled ? 'On' : 'Off'}
                </button>
                <button
                  type="button"
                  onClick={debugState.onToggleRelaxThresholds}
                  className="rounded border border-border/80 px-2 py-0.5 text-[10px] font-medium"
                >
                  Relax thresholds:{' '}
                  {debugState.relaxThresholdsEnabled ? 'On' : 'Off'}
                </button>
              </div>
              <p>blockingReason: {debugState.blockingReason}</p>
              <p>
                currentAngle: {debugState.currentAngle} | cameraReady:{' '}
                {String(debugState.cameraReady)} | landmarksDetected:{' '}
                {String(debugState.landmarksDetected)}
              </p>
              <p>
                landmarkModelLoaded: {String(debugState.landmarkModelLoaded)} |
                fallbackPoseUsed: {String(debugState.fallbackPoseUsed)} |
                rawLandmarkCount: {debugState.rawLandmarkCount ?? 'n/a'}
              </p>
              <p>
                yaw: {debugState.yaw.toFixed(1)} (raw{' '}
                {debugState.rawYaw.toFixed(1)}) | pitch:{' '}
                {debugState.pitch.toFixed(1)} (raw{' '}
                {debugState.rawPitch.toFixed(1)})
              </p>
              <p>
                rawFaceCenter:{' '}
                {debugState.rawFaceCenter
                  ? `${debugState.rawFaceCenter.x.toFixed(2)}, ${debugState.rawFaceCenter.y.toFixed(2)}`
                  : 'n/a'}
              </p>
              <p>
                expectedYawRange:{' '}
                {debugState.expectedYawRange
                  ? `[${debugState.expectedYawRange[0]}, ${debugState.expectedYawRange[1]}]`
                  : 'n/a'}{' '}
                | expectedPitchRange:{' '}
                {debugState.expectedPitchRange
                  ? `[${debugState.expectedPitchRange[0]}, ${debugState.expectedPitchRange[1]}]`
                  : 'n/a'}
              </p>
              <p>
                faceDetected: {String(debugState.faceDetected)} | isCentered:{' '}
                {String(debugState.isCentered)} | poseMatched:{' '}
                {String(debugState.poseMatched)}
              </p>
              <p>
                isStable: {String(debugState.isStable)} | lightingOk:{' '}
                {String(debugState.lightingOk)} | isSharpEnough:{' '}
                {String(debugState.isSharpEnough)}
              </p>
              <p>
                stabilityMs: {debugState.stabilityMs} /{' '}
                {debugState.requiredStabilityMs} | poseHoldMs:{' '}
                {debugState.poseHoldMs} / {debugState.requiredPoseHoldMs}
              </p>
              <p>
                poseHoldSatisfied: {String(debugState.poseHoldSatisfied)} |
                canCapture: {String(debugState.canCapture)}
              </p>
              <p>
                isCapturing: {String(debugState.isCapturing)} |
                autoCaptureEnabled: {String(debugState.autoCaptureEnabled)} |
                cooldownRemainingMs: {debugState.cooldownRemainingMs}
              </p>
              <p>
                acceptedShotsForCurrentAngle:{' '}
                {debugState.acceptedShotsForCurrentAngle} | totalAcceptedShots:{' '}
                {debugState.totalAcceptedShots} | captureTriggerCount:{' '}
                {debugState.captureTriggerCount}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
