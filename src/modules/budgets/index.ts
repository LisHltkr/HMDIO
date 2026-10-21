import type { FeatureModule } from '../../core';
import { BudgetsSeite } from './BudgetsSeite';
import { budgetsAbgleichZiel, budgetsBasis, budgetsCashflow, type BudgetsDaten } from './model';

export { budgetStaende, budgetsAus, useBudgets, type BudgetStand, type Kategorie } from './model';

export const budgetsModul: FeatureModule<BudgetsDaten> = {
  ...budgetsBasis,
  cashflow: budgetsCashflow,
  abgleichZiel: budgetsAbgleichZiel,
  seiten: [{ id: 'budgets', titel: 'Budgets', reihenfolge: 30, Komponente: BudgetsSeite }],
};
