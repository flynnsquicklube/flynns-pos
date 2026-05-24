import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";

export function ComingSoonBadge({ label = "Coming Soon" }: { label?: string }) {
  return <Badge tone="slate">{label}</Badge>;
}

interface ComingSoonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function ComingSoonButton({ children, ...props }: ComingSoonButtonProps) {
  return (
    <Button variant="secondary" disabled {...props}>
      {children} <ComingSoonBadge label="Soon" />
    </Button>
  );
}

