import Image from 'next/image';

interface LogoProps {
  className?: string;
  height?: number;
  priority?: boolean;
}

const ASPECT_RATIO = 1067 / 282;

export function Logo({ className, height = 32, priority }: LogoProps) {
  return (
    <Image
      src="/brand/logo-wordmark.png"
      alt="EstiMate"
      width={Math.round(height * ASPECT_RATIO)}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
