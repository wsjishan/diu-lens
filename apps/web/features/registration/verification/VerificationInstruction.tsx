type VerificationInstructionProps = {
  instruction: string;
  helperText?: string;
};

export function VerificationInstruction({
  instruction,
  helperText,
}: VerificationInstructionProps) {
  return (
    <div className="space-y-1 text-center">
      <p className="text-lg font-semibold tracking-tight text-slate-900">
        {instruction}
      </p>
      {helperText ? (
        <p className="text-sm leading-5 text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}
