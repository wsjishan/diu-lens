type CircularProgressGuideProps = {
  totalSteps: number;
  currentStepIndex: number;
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

export function CircularProgressGuide({
  totalSteps,
  currentStepIndex,
}: CircularProgressGuideProps) {
  const size = 320;
  const center = size / 2;
  const radius = 138;
  const segmentSpan = 360 / totalSteps;
  const gapDegrees = 8;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
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
            strokeWidth={state === 'current' ? 10 : 8}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
            style={{
              opacity:
                state === 'current' ? 1 : state === 'completed' ? 0.92 : 0.45,
              filter:
                state === 'current'
                  ? 'drop-shadow(0px 0px 8px rgba(59,130,246,0.35))'
                  : undefined,
            }}
          />
        );
      })}
    </svg>
  );
}
