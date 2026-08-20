import { http } from '../../../shared/api/http';
import type { PlanKind } from '../types/sale-form';
import type { PlanProduct } from '../components/SalePlanSearchModal.vue';

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
