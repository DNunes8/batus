// Single source of truth for the studio's plans. Lives in a plain module (not
// a "use server" file, which can only export async functions) so it can be
// imported by both server actions and client components.
//
// A plan bundles three stored columns: which Pagamentos tab the student sits in
// (service_type), how many group classes they may book per week
// (weekly_class_limit; null = livre/PT), and the standard monthly fee.

export type Plan = "1" | "2" | "3" | "livre" | "pt" | "pack";

export const PLAN_CONFIG: Record<
  Plan,
  {
    service_type: "group" | "solo";
    weekly_class_limit: number | null;
    fee_cents: number | null;
    // Prepaid-pack plan: gated by class_credits (a balance the coach loads),
    // no monthly fee, no weekly limit. setStudentPlan handles the credit +
    // has_monthly_fee side that this config can't express.
    is_pack?: boolean;
  }
> = {
  "1": { service_type: "group", weekly_class_limit: 1, fee_cents: 2500 },
  "2": { service_type: "group", weekly_class_limit: 2, fee_cents: 3500 },
  "3": { service_type: "group", weekly_class_limit: 3, fee_cents: 5000 },
  livre: { service_type: "group", weekly_class_limit: null, fee_cents: 6000 },
  pt: { service_type: "solo", weekly_class_limit: null, fee_cents: null },
  pack: { service_type: "group", weekly_class_limit: null, fee_cents: null, is_pack: true },
};

// The standard tier prices. Used to tell a plan-derived fee (safe to update
// when the plan changes) from a custom rate the coach set on purpose (which
// must be preserved). Derived from PLAN_CONFIG so it can never drift.
export const STANDARD_FEES_CENTS = new Set<number>(
  Object.values(PLAN_CONFIG)
    .map((c) => c.fee_cents)
    .filter((f): f is number => f !== null),
);

// The buttons the approve dialog and the student-page plan card both render.
export const PLAN_OPTIONS: Array<{
  plan: Plan;
  label: string;
  detail: string;
}> = [
  { plan: "1", label: "1 aula por semana", detail: "Grupo · 25€/mês" },
  { plan: "2", label: "2 aulas por semana", detail: "Grupo · 35€/mês" },
  { plan: "3", label: "3 aulas por semana", detail: "Grupo · 50€/mês" },
  { plan: "livre", label: "Livre", detail: "Grupo · 60€/mês" },
  { plan: "pt", label: "PT", detail: "Sessões individuais" },
  { plan: "pack", label: "Pack", detail: "Pacote de aulas" },
];

// Which plan a student is currently on, derived from their stored columns.
// PT (solo) wins regardless of limit; group students map by weekly limit,
// with null = livre.
export function currentPlan(p: {
  service_type: string | null;
  weekly_class_limit: number | null;
  class_credits?: number | null;
}): Plan {
  // A non-null balance means they're on a prepaid pack — wins over everything.
  if (p.class_credits != null) return "pack";
  if (p.service_type === "solo") return "pt";
  if (p.weekly_class_limit === 1) return "1";
  if (p.weekly_class_limit === 2) return "2";
  if (p.weekly_class_limit === 3) return "3";
  return "livre";
}
