export type SaleBranch = {
  id: number;
  name: string;
};

/** Solo el id del plan en Odoo. Nombre/precio se leen al usarlo. */
export type SellerDefaultPlan = {
  id: number;
};

export type SellerDefaults = {
  defaultBranchId: number | null;
  defaultBranchName: string | null;
  defaultFuturePlans: SellerDefaultPlan[];
  defaultParkPlans: SellerDefaultPlan[];
};

export const emptySellerDefaults = (): SellerDefaults => ({
  defaultBranchId: null,
  defaultBranchName: null,
  defaultFuturePlans: [],
  defaultParkPlans: [],
});
