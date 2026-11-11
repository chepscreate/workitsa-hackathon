"use client";

import { CATEGORIES, SUBCATEGORIES, type CategoryId } from "@/lib/types";

/**
 * Two-level work picker: broad category chips, and for every selected
 * category its specific-skill chips underneath (e.g. Beauty & wellness →
 * Hair, Nails, Barber…). Used on /profile and /verification so a worker's
 * declared skills power the skill-level search on /workers.
 *
 * Deselecting a category also drops its skills — a skill without its parent
 * category would never surface in the directory's category filter.
 */
export default function CategorySkillsPicker({
  categories,
  skills,
  onCategoriesChange,
  onSkillsChange,
}: {
  categories: string[];
  skills: string[];
  onCategoriesChange: (next: string[]) => void;
  onSkillsChange: (next: string[]) => void;
}) {
  const toggleCategory = (id: CategoryId) => {
    if (categories.includes(id)) {
      onCategoriesChange(categories.filter((c) => c !== id));
      const subIds = new Set(SUBCATEGORIES[id].map((s) => s.id));
      onSkillsChange(skills.filter((s) => !subIds.has(s)));
    } else {
      onCategoriesChange([...categories, id]);
    }
  };

  const toggleSkill = (id: string) => {
    onSkillsChange(
      skills.includes(id) ? skills.filter((s) => s !== id) : [...skills, id],
    );
  };

  const activeCategories = CATEGORIES.filter((c) => categories.includes(c.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const active = categories.includes(c.id);
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => toggleCategory(c.id)}
              aria-pressed={active}
              className={`px-4 py-2 rounded-pill text-sm transition-colors ${
                active
                  ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                  : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)]"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {activeCategories.length > 0 && (
        <div className="rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] space-y-3">
          <p className="text-xs text-[var(--color-ink-muted)]">
            Now pick your <b className="text-[var(--color-ink)]">specific skills</b> —
            this is how employers searching for e.g. a hair stylist or a plumber
            find you.
          </p>
          {activeCategories.map((c) => (
            <div key={c.id}>
              <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] mb-1.5">
                {c.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUBCATEGORIES[c.id].map((s) => {
                  const active = skills.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleSkill(s.id)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-pill text-xs transition-colors ${
                        active
                          ? "bg-[var(--color-sage-600)] text-white"
                          : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
                      }`}
                    >
                      {active ? "✓ " : ""}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
