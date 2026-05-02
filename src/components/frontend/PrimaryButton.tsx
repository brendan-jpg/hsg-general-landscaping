import * as React from 'react';
import Button from '@/components/shared/Button';

type PrimaryButtonProps =
  | (React.ComponentPropsWithoutRef<'button'> & {
      href?: undefined;
      size?: 'btn--sm' | 'btn--md' | 'btn--lg';
      icon?: React.ReactNode;
      iconPosition?: 'left' | 'right';
    })
  | (Omit<React.ComponentPropsWithoutRef<'a'>, 'href'> & {
      href: string;
      size?: 'btn--sm' | 'btn--md' | 'btn--lg';
      icon?: React.ReactNode;
      iconPosition?: 'left' | 'right';
    });

export default function PrimaryButton(props: PrimaryButtonProps) {
  if ('href' in props && typeof props.href === 'string') {
    const { href, className, size, icon, iconPosition, children, ...rest } = props;
    const mergedClassName = ['btn--primary-colorway', className].filter(Boolean).join(' ');
    return (
      <Button
        as="link"
        href={href}
        variant="btn--primary"
        size={size}
        icon={icon}
        iconPosition={iconPosition}
        className={mergedClassName}
        {...rest}
      >
        {children}
      </Button>
    );
  }

  const { className, size, icon, iconPosition, children, type, ...rest } = props;
  const mergedClassName = ['btn--primary-colorway', className].filter(Boolean).join(' ');
  return (
    <Button
      as="button"
      type={type}
      variant="btn--primary"
      size={size}
      icon={icon}
      iconPosition={iconPosition}
      className={mergedClassName}
      {...rest}
    >
      {children}
    </Button>
  );
}
