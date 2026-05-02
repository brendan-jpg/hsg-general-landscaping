import Link from 'next/link';
import type { ReactNode } from 'react';

interface PrimaryButtonProps {
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  size?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  'aria-label'?: string;
}

export default function PrimaryButton({
  href,
  type = 'button',
  size,
  className,
  disabled,
  onClick,
  children,
  ...rest
}: PrimaryButtonProps) {
  const classes = ['btn', 'btn--primary', size, className].filter(Boolean).join(' ');
  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
