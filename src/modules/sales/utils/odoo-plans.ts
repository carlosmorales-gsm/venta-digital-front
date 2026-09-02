import { http } from '../../../shared/api/http';
import type { PlanKind } from '../types/sale-form';
import type { PlanProduct } from '../components/SalePlanSearchModal.vue';
import type { SellerDefaultPlan, SellerDefaults } from '../types/seller-defaults';

type PlanApiRow = PlanProduct & {
  default_code?: string | null;
  without_interest?: boolean;
};

export function mapPlanProduct(row: PlanApiRow): PlanProduct {
  return {
    ...row,
    defaultCode: row.defaultCode ?? row.default_code ?? null,
    withoutInterest: Boolean(row.withoutInterest ?? row.without_interest),
  };
}

export async function fetchPlanesByIds(
  planKind: PlanKind,
  ids: number[],
): Promise<PlanProduct[]> {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!uniqueIds.length) return [];
  const { data } = await http.get<PlanApiRow[]>('/odoo/planes', {
    params: { planKind, ids: uniqueIds.join(',') },
    skipGlobalLoading: true,
  });
  const byId = new Map((data || []).map((row) => [row.id, mapPlanProduct(row)]));
  return uniqueIds.map((id) => byId.get(id)).filter(Boolean) as PlanProduct[];
}

export function defaultPlanHasName(plan: SellerDefaultPlan): boolean {
  return Boolean(String(plan.name || '').trim());
}

export function defaultsNeedPlanNames(defaults: SellerDefaults): boolean {
  return [...defaults.defaultFuturePlans, ...defaults.defaultParkPlans].some(
    (plan) => !defaultPlanHasName(plan) || plan.withoutInterest == null,
  );
}

export function toCachedDefaultPlan(plan: PlanProduct): SellerDefaultPlan {
  return {
    id: plan.id,
    name: plan.name,
    listPrice: plan.listPrice,
    defaultCode: plan.defaultCode,
    withoutInterest: plan.withoutInterest,
  };
}

export function toPlanProduct(plan: SellerDefaultPlan): PlanProduct | null {
  if (!plan.id || !defaultPlanHasName(plan)) return null;
  return {
    id: plan.id,
    name: String(plan.name),
    listPrice: Number(plan.listPrice) || 0,
    defaultCode: plan.defaultCode ?? null,
    companyId: 0,
    withoutInterest: Boolean(plan.withoutInterest),
  };
}

export function mergeDefaultPlanCache(
  stored: SellerDefaultPlan[],
  live: PlanProduct[],
): SellerDefaultPlan[] {
  const byId = new Map(live.map((plan) => [plan.id, plan]));
  return stored.map((plan) => {
    const hit = byId.get(plan.id);
    return hit ? toCachedDefaultPlan(hit) : plan;
  });
}

export async function hydrateSellerDefaultPlans(
  defaults: SellerDefaults,
): Promise<SellerDefaults> {
  if (!defaultsNeedPlanNames(defaults)) return defaults;
  const [future, park] = await Promise.all([
    fetchPlanesByIds(
      'PLAN_FUTURO',
      defaults.defaultFuturePlans.map((plan) => plan.id),
    ),
    fetchPlanesByIds(
      'PARQUE',
      defaults.defaultParkPlans.map((plan) => plan.id),
    ),
  ]);
  return {
    ...defaults,
    defaultFuturePlans: mergeDefaultPlanCache(defaults.defaultFuturePlans, future),
    defaultParkPlans: mergeDefaultPlanCache(defaults.defaultParkPlans, park),
  };
}
