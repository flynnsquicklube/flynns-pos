import { normalizePlateState } from "../../lib/domain/vehicles/plateUtils";
import { US_STATES } from "../../lib/domain/vehicles/usStates";
import { TouchSelect } from "../ui/TouchSelect";

interface StatePickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  label?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  errorText?: string;
}

function stateLabel(value?: string | null) {
  const code = normalizePlateState(value) || "OH";
  const state = US_STATES.find((item) => item.code === code);
  return state ? `${state.code} - ${state.name}` : code;
}

export function StatePicker({ value, onChange, label = "State", defaultValue = "OH", disabled = false, required = false, errorText }: StatePickerProps) {
  const selectedCode = normalizePlateState(value) || normalizePlateState(defaultValue) || "OH";
  return (
    <TouchSelect
      label={required && label ? `${label} *` : label}
      value={selectedCode}
      onChange={onChange}
      options={US_STATES.map((state) => ({ value: state.code, label: stateLabel(state.code) }))}
      placeholder="Select state"
      searchable
      disabled={disabled}
      error={errorText}
    />
  );
}
