import { Input } from "./Input";
import type { ComponentProps } from "react";

export function NumberInput(props: Omit<ComponentProps<typeof Input>, "type">) {
  return <Input type="number" inputMode="decimal" {...props} />;
}
