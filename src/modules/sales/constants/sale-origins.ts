/** Orígenes de venta (Odoo sale.order / sale_origin). */
export const SALE_ORIGIN_OPTIONS = [
  { value: 'inmediate_need', label: 'Necesidad inmediata' },
  { value: 'field_selling', label: 'Cambaceo' },
  { value: 'social_media', label: 'Redes sociales' },
  { value: 'redes_personal', label: 'Redes Personal' },
  { value: 'agreement', label: 'Ventas convenio' },
  { value: 'exhibition', label: 'Exhibición' },
  { value: 'guard_culiacan_park', label: 'Guardia parque Culiacán' },
  { value: 'guard_montebello', label: 'Guardia Montebello' },
  { value: 'guard_zapata_branch', label: 'Guardia suc Zapata' },
  { value: 'guard_funeral_losmochis', label: 'Guardia Funeraria Los Mochis' },
  { value: 'guard_sucursal_guasave', label: 'Guardia Sucursal Guasave' },
  { value: 'guard_funeral_guasave', label: 'Guardia Funeraria Guasave' },
  { value: 'guard_parque_guasave', label: 'Guardia Parque Guasave' },
  { value: 'floor_sales', label: 'Venta piso' },
  { value: 'natural_market_sales', label: 'Ventas mercado natural' },
  { value: 'referral_sales', label: 'Ventas por referidos' },
  { value: 'telemarketing_sales', label: 'Ventas por telemarketing' },
  { value: 'employee_sales', label: 'Venta empleado' },
  { value: 'operational', label: 'Operativo' },
  { value: 'direct', label: 'Directo' },
  { value: 'convention', label: 'Convenio' },
  { value: 'agency', label: 'Agencia' },
  { value: 'omnichannel', label: 'Omnicanal' },
  { value: 'plaza_fiesta', label: 'Plaza Fiesta' },
  { value: 'ley_humaya', label: 'Ley Humaya' },
  { value: 'ley_abastos', label: 'Ley Abastos' },
  { value: 'ley_san_isidro', label: 'Ley San Isidro' },
  { value: 'independiente', label: 'Independiente' },
  { value: 'guard_parque_losmochis', label: 'Guardia Parque Los Mochis' },
  { value: 'guard_parque_navalato', label: 'Guardia Parque Navolato' },
  { value: 'guard_sucursal_costarica', label: 'Guardia Sucursal Costa Rica' },
  { value: 'guard_sucursal_navolato', label: 'Guardia Sucursal Navolato' },
  { value: 'ventas_por_guardias', label: 'Ventas por Guardias' },
  { value: 'ventas_por_jefe_turno', label: 'Ventas por Jefe Turno' },
  { value: 'ventas_programa_lealtad', label: 'Ventas Programa Lealtad' },
] as const;

export function saleOriginLabel(value: string | null | undefined): string {
  if (!value) return '';
  const found = SALE_ORIGIN_OPTIONS.find((o) => o.value === value);
  return found?.label ?? value;
}
