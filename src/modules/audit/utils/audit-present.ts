export type AuditPresentItem = {
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  actorName?: string | null;
  details: Record<string, unknown> | null;
};

export type AuditDetailRow = {
  text: string;
  kind: 'value' | 'change';
  label?: string;
  from?: string;
  to?: string;
};

export const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Nuevo registro',
  UPDATE: 'Cambio de datos',
  ACTIVATE: 'Habilitación',
  DEACTIVATE: 'Deshabilitación',
  DELETE: 'Eliminación',
  CANCEL: 'Cancelación',
  APPLY: 'Aplicación',
};

const HIDDEN_FIELDS = new Set([
  'id',
  'sellerId',
  'kind',
  'cvv',
  'dataBase64',
  'passwordHash',
]);

const FIELD_LABELS: Record<string, string> = {
  type: 'Tipo de cuenta',
  fullName: 'Nombre',
  username: 'Usuario de acceso',
  cellphone: 'Celular / WhatsApp',
  active: 'Estado',
  password: 'Contraseña',
  amount: 'Monto',
  sellerName: 'Vendedor',
  titularName: 'Titular',
  status: 'Estatus',
  estatus: 'Estatus',
  fecha: 'Fecha',
  contrato: 'Contrato',
  origenVenta: 'Origen de venta',
  folioSolicitud: 'Folio',
  curp: 'CURP',
  celular: 'Celular',
  correo: 'Correo del titular',
  email: 'Correo del titular',
  municipio: 'Municipio',
  estado: 'Estado (domicilio)',
  planKind: 'Tipo de plan',
  nombrePlan: 'Nombre del plan',
  servicioFunerario: 'Servicio funerario',
  parqueFuneral: 'Parque funeral',
  seccion: 'Sección',
  cuadrante: 'Cuadrante',
  numero: 'Número',
  preasignacion: 'Preasignación',
  beneficiario1: 'Beneficiario 1',
  beneficiario1Parentesco: 'Parentesco beneficiario 1',
  beneficiario2: 'Beneficiario 2',
  segundoContacto: 'Segundo contacto',
  documentos: 'Documentos',
  precioPlan: 'Precio del plan',
  anticipo: 'Anticipo',
  pagoInicial: 'Pago inicial',
  frecuencia: 'Frecuencia',
  plazo: 'Plazo',
  importeCadaPago: 'Importe cada pago',
  saldo: 'Saldo',
  formaPago: 'Forma de pago',
  banco: 'Banco',
  cuenta: 'Cuenta',
  bancoPago: 'Banco del pago',
  cuentaPago: 'Cuenta del pago',
  montoRecibido: 'Monto recibido',
  cambio: 'Cambio',
  nombreAsesor: 'Asesor',
  nombreJefeVentas: 'Jefe de ventas',
  driveFolderUrl: 'Carpeta Drive',
  sucursal: 'Sucursal',
  tipoServicio: 'Tipo de servicio',
  percent: 'Porcentaje',
  createdByName: 'Generó',
  cancelledByName: 'Canceló',
  appliedSaleId: 'Venta aplicada',
  draftLimit: 'Límite de borradores',
  draftTtlHours: 'Vigencia borrador (h)',
  maxDiscountAmount: 'Descuento máximo (%)',
  reason: 'Motivo',
  campos: 'Campos a corregir',
  previousOdooSaleOrderId: 'Cotización Odoo',
};

const TYPE_LABELS: Record<string, string> = {
  VENDEDOR: 'Vendedor',
  MONITOR: 'Monitor',
  ADMIN: 'Administrador',
  USER: 'Usuario',
  SALE: 'Venta',
  DISCOUNT: 'Descuento especial',
  SETTINGS: 'Configuración',
  ACTIVE: 'Activo',
  CANCELLED: 'Cancelado',
  APPLIED: 'Aplicado',
  DRAFT: 'Borrador',
  PENDING_PAYMENT: 'Pendiente de pago',
  PENDING_SIGNATURE: 'Pendiente de firma',
  PENDING_VALIDATION: 'Pendiente de validación',
  PENDING_CORRECTION: 'Por corregir',
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
  SUBMITTED: 'Enviada',
  PARQUE: 'Parque',
  PLAN_FUTURO: 'Plan a futuro',
};

const PAYMENT_KEYS = [
  'formaPago',
  'montoRecibido',
  'cambio',
  'anticipo',
  'pagoInicial',
  'frecuencia',
  'plazo',
  'importeCadaPago',
  'saldo',
  'banco',
  'cuenta',
  'bancoPago',
  'cuentaPago',
  'amount',
  'status',
  'estatus',
] as const;

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key;
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Sin dato';
  if (typeof value === 'boolean') {
    if (key === 'active') return value ? 'Activo' : 'Inactivo';
    return value ? 'Sí' : 'No';
  }
  if (typeof value === 'string' && TYPE_LABELS[value]) return TYPE_LABELS[value];
  if (key === 'password') {
    const s = String(value).toLowerCase();
    if (s.includes('actualiz') || s.includes('updated') || s.includes('oculto')) {
      return 'se actualizó';
    }
    return 'no visible';
  }
  return String(value);
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function capitalize(value: string) {
  const text = value.trim();
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase('es-MX') + text.slice(1);
}

/** La acción concreta, sin repetir el nombre que ya va en la etiqueta. */
export function auditActionTitle(item: AuditPresentItem): string {
  const summary = item.summary?.trim() ?? '';
  if (!summary) {
    return ACTION_LABELS[item.action] ?? item.action;
  }
  const actor = item.actorName?.trim() ?? '';
  if (actor && summary.toLocaleLowerCase('es-MX').startsWith(actor.toLocaleLowerCase('es-MX'))) {
    const rest = summary.slice(actor.length).trim();
    if (rest) return capitalize(rest);
  }
  return summary;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function changeRow(key: string, from: unknown, to: unknown): AuditDetailRow {
  if (key === 'password') {
    return { kind: 'value', label: fieldLabel(key), text: 'Contraseña: se actualizó' };
  }
  const fromText = formatValue(key, from);
  const toText = formatValue(key, to);
  return {
    kind: 'change',
    label: fieldLabel(key),
    from: fromText,
    to: toText,
    text: `${fieldLabel(key)}: pasó de "${fromText}" a "${toText}"`,
  };
}

function valueRow(key: string, value: unknown): AuditDetailRow {
  return {
    kind: 'value',
    label: fieldLabel(key),
    text: `${fieldLabel(key)}: ${formatValue(key, value)}`,
  };
}

function diffRows(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditDetailRow[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const rows: AuditDetailRow[] = [];
  for (const key of keys) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (sameValue(before[key], after[key])) continue;
    rows.push(changeRow(key, before[key], after[key]));
  }
  return rows;
}

function changesRows(changes: Record<string, unknown>): AuditDetailRow[] {
  const rows: AuditDetailRow[] = [];
  for (const [key, change] of Object.entries(changes)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    const pair = asRecord(change);
    rows.push(changeRow(key, pair?.from, pair?.to));
  }
  return rows;
}

function snapshotRows(source: Record<string, unknown>, only?: readonly string[]): AuditDetailRow[] {
  const keys = only ?? Object.keys(source);
  const rows: AuditDetailRow[] = [];
  for (const key of keys) {
    if (HIDDEN_FIELDS.has(key) || !(key in source)) continue;
    const value = source[key];
    if (value === '' || value == null) continue;
    rows.push(valueRow(key, value));
  }
  return rows;
}

function extraRows(details: Record<string, unknown>): AuditDetailRow[] {
  const rows: AuditDetailRow[] = [];
  for (const key of ['reason', 'campos', 'previousOdooSaleOrderId'] as const) {
    if (details[key] == null || details[key] === '') continue;
    rows.push(valueRow(key, details[key]));
  }
  return rows;
}

function inferKind(item: AuditPresentItem, details: Record<string, unknown> | null): string {
  const explicit = details && typeof details.kind === 'string' ? details.kind : '';
  if (explicit) return explicit;
  const summary = (item.summary || '').toLocaleLowerCase('es-MX');
  if (details?.changes || (details?.before && details?.after)) return 'changes';
  if (
    /enlace de firma|correo de firma|envi[oó] correo/.test(summary) ||
    (details && (details.email != null || details.correo != null) && !details.after)
  ) {
    return 'email';
  }
  if (/gener[oó] pago|registr[oó] pago/.test(summary)) return 'payment';
  if (/firm[oó]/.test(summary)) return 'sign';
  if (/elimin[oó]/.test(summary) || item.action === 'DELETE') return 'delete';
  if (
    /gener[oó] venta|finaliz[oó] captura|guard[oó] borrador/.test(summary) ||
    (item.action === 'CREATE' && item.entityType === 'SALE')
  ) {
    return 'sale';
  }
  if (details?.campos) return 'note';
  if (item.action === 'CREATE') return 'create';
  if (item.action === 'UPDATE' || item.action === 'CANCEL') return 'changes';
  return 'note';
}

export function presentAudit(item: AuditPresentItem): {
  title: string;
  boxTitle: string;
  rows: AuditDetailRow[];
} {
  const details = item.details;
  const kind = inferKind(item, details);
  const title = auditActionTitle(item);

  if (!details) {
    return { title, boxTitle: 'Detalle', rows: [] };
  }

  if (kind === 'changes') {
    const changes = asRecord(details.changes);
    const before = asRecord(details.before);
    const after = asRecord(details.after);
    const rows = changes
      ? changesRows(changes)
      : before && after
        ? diffRows(before, after)
        : [];
    rows.push(...extraRows(details));
    return { title, boxTitle: 'Datos anteriores y nuevos', rows };
  }

  if (kind === 'email') {
    const correo = details.correo ?? details.email;
    return {
      title,
      boxTitle: 'Correo enviado',
      rows: correo ? [valueRow('correo', correo)] : [],
    };
  }

  if (kind === 'payment') {
    const source = asRecord(details.after) ?? details;
    return {
      title,
      boxTitle: 'Pago generado',
      rows: snapshotRows(source, PAYMENT_KEYS),
    };
  }

  if (kind === 'sign') {
    const changes = asRecord(details.changes);
    const after = asRecord(details.after);
    const rows = changes
      ? changesRows(changes)
      : after?.status != null
        ? [valueRow('status', after.status)]
        : [];
    return { title, boxTitle: 'Firma', rows };
  }

  if (kind === 'sale' || kind === 'delete' || kind === 'create') {
    const after = asRecord(details.after);
    const boxTitle =
      kind === 'delete'
        ? 'Datos eliminados'
        : item.entityType === 'SALE'
          ? 'Datos de la venta'
          : 'Datos registrados';
    return {
      title,
      boxTitle,
      rows: after ? snapshotRows(after) : extraRows(details),
    };
  }

  const scalars: AuditDetailRow[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (value == null || typeof value === 'object') continue;
    scalars.push(valueRow(key, value));
  }
  return {
    title,
    boxTitle: kind === 'note' ? 'Detalle' : 'Detalle',
    rows: scalars,
  };
}
