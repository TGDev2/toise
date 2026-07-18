interface LogoProps {
  className?: string;
  height?: number;
}

export function Logo({ className, height = 32 }: LogoProps) {
  return (
    <span
      className={className}
      style={{
        fontSize: Math.round(height * 0.72),
        lineHeight: `${height}px`,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      Chiffr<span style={{ color: 'var(--accent)' }}>éo</span>
    </span>
  );
}
