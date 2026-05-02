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
      <p className="text-lg font-semibold tracking-tight text-slate-900 max-[639px]:text-[#d2e3f5]">
        {instruction}
      </p>
      {helperText ? (
        <p className="text-sm leading-5 text-slate-500 max-[639px]:text-[#8ca4bc]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
