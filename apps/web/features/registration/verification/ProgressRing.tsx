type ProgressRingProps = {
  totalSteps: number;
  currentStepIndex: number;
  progressPercent: number;
  holdProgress: number;
};

type SegmentState = 'completed' | 'current' | 'upcoming';

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ');
}

function segmentColor(state: SegmentState) {
  if (state === 'completed') {
    return 'var(--primary)';
  }

  if (state === 'current') {
    return 'var(--ring)';
  }

  return 'var(--border)';
}

export function ProgressRing({
  totalSteps,
  currentStepIndex,
  progressPercent,
  holdProgress,
}: ProgressRingProps) {
  const size = 286;
  const center = size / 2;
  const radius = 120;
  const segmentSpan = 360 / totalSteps;
  const gapDegrees = 8;

  const circumference = 2 * Math.PI * (radius - 14);
  const progress = Math.min(Math.max(progressPercent / 100, 0), 1);
  const dashOffset = circumference * (1 - progress);
  const hold = Math.min(Math.max(holdProgress, 0), 1);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <circle
        cx={center}
        cy={center}
        r={radius - 14}
        fill="none"
        stroke="var(--border)"
        strokeWidth="5"
        opacity={0.38}
      />
      <circle
        cx={center}
        cy={center}
        r={radius - 14}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        className="origin-center -rotate-90 transition-all duration-300 ease-out"
      />

      {Array.from({ length: totalSteps }).map((_, index) => {
        const startAngle = index * segmentSpan + gapDegrees / 2;
        const endAngle = (index + 1) * segmentSpan - gapDegrees / 2;

        const state: SegmentState =
          index < currentStepIndex
            ? 'completed'
            : index === currentStepIndex
              ? 'current'
              : 'upcoming';

        return (
          <path
            key={index}
            d={describeArc(center, center, radius, startAngle, endAngle)}
            fill="none"
            stroke={segmentColor(state)}
            strokeWidth={state === 'current' ? 9 : 7}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
            style={{
              opacity:
                state === 'current' ? 1 : state === 'completed' ? 0.94 : 0.4,
              filter:
                state === 'current'
                  ? 'drop-shadow(0px 0px 8px rgba(59,130,246,0.35))'
                  : undefined,
            }}
          />
        );
      })}

      <circle
        cx={center}
        cy={center}
        r={radius - 30}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${hold * 145} 145`}
        className="origin-center -rotate-90 transition-all duration-200"
        opacity={0.82}
      />
    </svg>
  );
}
