import { Button } from '@/components/ui/button';

type VerificationControlsProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function VerificationControls({
  label,
  onClick,
  disabled = false,
}: VerificationControlsProps) {
  return (
    <Button
      type="button"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className="h-11 w-full rounded-xl"
    >
      {label}
    </Button>
  );
}
