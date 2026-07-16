const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${SIZES[size]} ${className}`}
    />
  );
}
