import * as React from "react";
import Link from "next/link";
import PlusIcon from "@/components/shared/icons/PlusIcon";

type ButtonVariant =
  | "btn--primary"
  | "btn--secondary"
  | "btn--ghost"
  | "btn--success"
  | "btn--danger";

type ButtonSize = "btn--sm" | "btn--md" | "btn--lg";

type BaseProps = {
  children: React.ReactNode;

  /** Optional icon (ex: <Icon name="arrow-right" />) */
  icon?: React.ReactNode;

  /** Where the icon appears */
  iconPosition?: "left" | "right";

  /** Existing button classes */
  variant?: ButtonVariant;
  size?: ButtonSize;

  className?: string;
  disabled?: boolean;
};

/* ---------------------------------------------
   Button (native <button>)
--------------------------------------------- */

type ButtonProps = BaseProps & {
  as?: "button";
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

/* ---------------------------------------------
   Button as Link
--------------------------------------------- */

type LinkButtonProps = BaseProps & {
  as: "link";
  href: string;
};

/* ---------------------------------------------
   Component
--------------------------------------------- */

export default function Button(props: ButtonProps | LinkButtonProps) {
  const {
    children,
    icon,
    iconPosition = "right",
    variant = "btn--primary",
    size,
    className,
    disabled,
  } = props;

  const labelText = React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string") return child;
      if (typeof child === "number") return String(child);
      return "";
    })
    .join(" ")
    .trim();
  const isCreateAction = /^(add|new)\b/i.test(labelText);
  const resolvedIcon = icon ?? (isCreateAction ? <PlusIcon /> : null);
  const resolvedIconPosition = icon ? iconPosition : "left";

  const classes = [
    variant,
    size,
    "btn",
    resolvedIcon ? "btn--with-icon" : null,
    isCreateAction ? "btn--create" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {resolvedIcon && resolvedIconPosition === "left" && <span className="btn__icon">{resolvedIcon}</span>}
      <span className="btn__label" style={{ textTransform: "none", fontStyle: "normal" }}>{children}</span>
      {resolvedIcon && resolvedIconPosition === "right" && <span className="btn__icon">{resolvedIcon}</span>}
    </>
  );

  // Link version
  if (props.as === "link") {
    return (
      <Link href={props.href} className={classes} aria-disabled={disabled}>
        {content}
      </Link>
    );
  }

  // Button version (default)
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={disabled}
      className={classes}
    >
      {content}
    </button>
  );
}
