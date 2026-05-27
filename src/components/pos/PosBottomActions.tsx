import { Button } from "../ui/Button";

export function PosBottomActions({ onNote, onVoid }: { onNote?: () => void; onVoid?: () => void }) {
  return (
    <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap gap-3 rounded-2xl border border-[var(--pos-border)] bg-[rgba(11,18,32,0.9)] p-3 backdrop-blur-xl">
      <Button variant="secondary" onClick={onNote}>Add Note</Button>
      <Button variant="danger" onClick={onVoid}>Void Ticket</Button>
    </div>
  );
}
