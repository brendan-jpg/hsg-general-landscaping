import Link from 'next/link';
import type { ReactNode } from 'react';

interface SecondaryButtonProps {
  href: string;
  size?: string;
  className?: string;
  children: ReactNode;
}

export default function SecondaryButton({ href, size, className, children }: SecondaryButtonProps) {
  return (
    <Link href={href} className={['btn', 'btn--secondary', size, className].filter(Boolean).join(' ')}>
      {children}
    </Link>
  );
}
