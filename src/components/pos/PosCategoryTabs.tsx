export function PosCategoryTabs({ categories, active, onSelect }: { categories: string[]; active: string; onSelect: (category: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onSelect(category)}
          className={`min-h-12 whitespace-nowrap rounded-2xl border px-4 text-sm font-black transition ${active === category ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] text-white pos-glow" : "border-[var(--pos-border)] bg-[var(--pos-card)] text-[var(--pos-muted)] hover:bg-[var(--pos-card-hover)]"}`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
