<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { extractApiError, http } from '../../../shared/api/http';
import { formatUtcToLocal } from '../../../shared/utils/datetime';
import { useDialog } from '../../../shared/ui/dialog';
import { downloadAuditLogsPdf } from '../utils/audit-pdf';

type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'DELETE'
  | 'CANCEL'
  | 'APPLY'
  | '';

interface AuditLogItem {
  id: number;
  actorUserId: number | null;
  actorName: string | null;
  actorType: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditListResponse {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
}

interface PublicUser {
  id: number;
  fullName: string;
  type: string;
}

/** Misma semántica amigable que el PDF. */
const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Nuevo registro',
  UPDATE: 'Cambio de datos',
  ACTIVATE: 'Habilitación',
  DEACTIVATE: 'Deshabilitación',
  DELETE: 'Eliminación',
  CANCEL: 'Cancelación',
  APPLY: 'Aplicación',
};

const ACTION_VERBS: Record<string, string> = {
  CREATE: 'Dio de alta',
  UPDATE: 'Modificó',
  ACTIVATE: 'Habilitó',
  DEACTIVATE: 'Deshabilitó',
  DELETE: 'Eliminó',
  CANCEL: 'Canceló',
  APPLY: 'Aplicó',
};

const ENTITY_WORDS: Record<string, string> = {
  USER: 'usuario',
  SALE: 'venta',
  DISCOUNT: 'descuento especial',
  SETTINGS: 'configuración',
};

const HIDDEN_FIELDS = new Set(['id', 'sellerId']);

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
  fecha: 'Fecha',
  contrato: 'Contrato',
  origenVenta: 'Origen de venta',
  folioSolicitud: 'Folio solicitud',
  curp: 'CURP',
  celular: 'Celular',
  correo: 'Correo',
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
  nombreAsesor: 'Asesor',
  nombreJefeVentas: 'Jefe de ventas',
  driveFolderUrl: 'Carpeta Drive',
  percent: 'Porcentaje',
  createdByName: 'Generó',
  cancelledByName: 'Canceló',
  appliedSaleId: 'Venta aplicada',
  draftLimit: 'Límite de borradores',
  draftTtlHours: 'Vigencia borrador (h)',
  maxDiscountAmount: 'Descuento máximo (%)',
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
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
  SUBMITTED: 'Enviada',
  PARQUE: 'Parque',
  PLAN_FUTURO: 'Plan a futuro',
};

interface DetailRow {
  text: string;
  kind: 'value' | 'change';
  label?: string;
  from?: string;
  to?: string;
}

const router = useRouter();
const { alert } = useDialog();
const logs = ref<AuditLogItem[]>([]);
const users = ref<PublicUser[]>([]);
const loading = ref(true);
const exporting = ref(false);
const error = ref<string | null>(null);
const total = ref(0);
const expandedId = ref<number | null>(null);

function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatCalendarDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return isoDate;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const todayDefault = todayYmd();

const filters = reactive({
  q: '',
  dateFrom: todayDefault,
  dateTo: todayDefault,
  actorUserId: '' as string | number,
  action: '' as AuditAction,
});

const pageSize = 30;
const offset = ref(0);

const filterSummary = computed(() => {
  const parts: string[] = [];
  if (filters.dateFrom && filters.dateTo && filters.dateFrom === filters.dateTo) {
    parts.push(`Día: ${formatCalendarDate(filters.dateFrom)}`);
  } else if (filters.dateFrom || filters.dateTo) {
    parts.push(
      `Del ${filters.dateFrom ? formatCalendarDate(filters.dateFrom) : '…'} al ${
        filters.dateTo ? formatCalendarDate(filters.dateTo) : '…'
      }`,
    );
  }
  if (filters.q.trim()) parts.push(`Búsqueda: "${filters.q.trim()}"`);
  if (filters.actorUserId !== '' && filters.actorUserId != null) {
    const name = users.value.find((u) => u.id === Number(filters.actorUserId))
      ?.fullName;
    if (name) parts.push(`Hecho por: ${name}`);
  }
  if (filters.action) {
    parts.push(`Tipo: ${ACTION_LABELS[filters.action] ?? filters.action}`);
  }
  return parts;
});

async function loadUsers() {
  try {
    const { data } = await http.get<PublicUser[]>('/users');
    users.value = data;
  } catch {
    users.value = [];
  }
}

async function loadLogs(reset = true) {
  if (reset) offset.value = 0;
  loading.value = true;
  error.value = null;
  expandedId.value = null;

  const params: Record<string, string | number> = {
    ...buildFilterParams(),
    limit: pageSize,
    offset: offset.value,
  };

  try {
    const { data } = await http.get<AuditListResponse>('/audit-logs', {
      params,
    });
    logs.value = data.items;
    total.value = data.total;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'No se pudo cargar la bitácora';
    logs.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function buildFilterParams(): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  const q = filters.q.trim();
  if (q) params.q = q;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.actorUserId !== '' && filters.actorUserId != null) {
    params.actorUserId = Number(filters.actorUserId);
  }
  if (filters.action) params.action = filters.action;
  return params;
}

function applyFilters() {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    void alert({
      title: 'Fechas inválidas',
      message: 'La fecha inicial no puede ser mayor que la fecha final.',
      variant: 'warning',
    });
    return;
  }
  void loadLogs(true);
}

function clearFilters() {
  const today = todayYmd();
  filters.q = '';
  filters.dateFrom = today;
  filters.dateTo = today;
  filters.actorUserId = '';
  filters.action = '';
  void loadLogs(true);
}

const PDF_MAX_ROWS = 2000;

async function downloadPdf() {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    await alert({
      title: 'Fechas inválidas',
      message: 'La fecha inicial no puede ser mayor que la fecha final.',
      variant: 'warning',
    });
    return;
  }

  exporting.value = true;
  try {
    const { data } = await http.get<AuditListResponse>('/audit-logs', {
      params: {
        ...buildFilterParams(),
        limit: PDF_MAX_ROWS,
        offset: 0,
      },
    });

    if (data.total > PDF_MAX_ROWS) {
      await alert({
        title: 'Demasiados registros',
        message: `Hay ${data.total} registros. Reduce los filtros (máximo ${PDF_MAX_ROWS} para PDF).`,
        variant: 'warning',
      });
      return;
    }

    const actorName =
      filters.actorUserId !== '' && filters.actorUserId != null
        ? users.value.find((u) => u.id === Number(filters.actorUserId))
            ?.fullName
        : undefined;

    await downloadAuditLogsPdf(data.items, {
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      q: filters.q.trim() || undefined,
      actorName,
      action: filters.action || undefined,
    });
  } catch (e: unknown) {
    await alert({
      title: 'Descarga PDF',
      message: extractApiError(e, 'No se pudo generar el PDF'),
      variant: 'danger',
    });
  } finally {
    exporting.value = false;
  }
}

function prevPage() {
  if (offset.value <= 0) return;
  offset.value = Math.max(0, offset.value - pageSize);
  void loadLogs(false);
}

function nextPage() {
  if (offset.value + pageSize >= total.value) return;
  offset.value += pageSize;
  void loadLogs(false);
}

function toggleDetails(id: number) {
  expandedId.value = expandedId.value === id ? null : id;
}

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key;
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Sin dato';
  }
  if (typeof value === 'boolean') {
    if (key === 'active') return value ? 'Activo' : 'Inactivo';
    return value ? 'Sí' : 'No';
  }
  if (typeof value === 'string' && TYPE_LABELS[value]) {
    return TYPE_LABELS[value];
  }
  if (key === 'password') {
    const s = String(value).toLowerCase();
    if (s.includes('actualiz') || s.includes('updated')) return 'actualizada';
    return 'no visible';
  }
  return String(value);
}

function targetNameFromDetails(
  details: Record<string, unknown> | null,
): string | null {
  if (!details) return null;
  const after = details.after;
  if (after && typeof after === 'object') {
    const a = after as Record<string, unknown>;
    for (const key of ['titularName', 'fullName', 'sellerName'] as const) {
      const v = a[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  const changes = details.changes;
  if (changes && typeof changes === 'object') {
    const fullName = (changes as Record<string, { to?: unknown }>).fullName;
    if (typeof fullName?.to === 'string' && fullName.to.trim()) {
      return fullName.to.trim();
    }
  }
  return null;
}

/** Título corto como en el PDF: "Modificó venta #12 (Titular)". */
function entryTitle(item: AuditLogItem, index: number): string {
  const verb = ACTION_VERBS[item.action] ?? ACTION_LABELS[item.action] ?? item.action;
  const entityWord =
    ENTITY_WORDS[item.entityType] ??
    (TYPE_LABELS[item.entityType] ?? 'registro').toLowerCase();
  const name = targetNameFromDetails(item.details);

  let core: string;
  if (item.entityType === 'SALE') {
    if (item.entityId != null && name) {
      core = `${verb} venta #${item.entityId} (${name})`;
    } else if (item.entityId != null) {
      core = `${verb} venta #${item.entityId}`;
    } else {
      core = `${verb} venta`;
    }
  } else if (name) {
    core = `${verb} ${entityWord} ${name}`;
  } else if (item.entityId != null) {
    core = `${verb} ${entityWord} #${item.entityId}`;
  } else {
    core = verb;
  }

  return `${offset.value + index + 1}.  ${core}`;
}

function detailBoxTitle(action: string): string {
  return action === 'CREATE' ? 'Datos registrados' : 'Qué cambió';
}

/** Líneas de detalle al estilo PDF. */
function detailRows(details: Record<string, unknown> | null): DetailRow[] {
  if (!details) return [];

  const rows: DetailRow[] = [];

  if (details.after && typeof details.after === 'object') {
    const after = details.after as Record<string, unknown>;
    for (const [key, value] of Object.entries(after)) {
      if (HIDDEN_FIELDS.has(key)) continue;
      rows.push({
        kind: 'value',
        label: fieldLabel(key),
        text: `${fieldLabel(key)}: ${formatValue(key, value)}`,
      });
    }
    return rows;
  }

  if (details.changes && typeof details.changes === 'object') {
    const changes = details.changes as Record<
      string,
      { from?: unknown; to?: unknown }
    >;
    for (const [key, change] of Object.entries(changes)) {
      if (HIDDEN_FIELDS.has(key)) continue;
      const from = formatValue(key, change?.from);
      const to = formatValue(key, change?.to);
      if (key === 'password') {
        rows.push({
          kind: 'value',
          text: `${fieldLabel(key)}: se actualizó`,
        });
        continue;
      }
      rows.push({
        kind: 'change',
        label: fieldLabel(key),
        from,
        to,
        text: `${fieldLabel(key)}: pasó de "${from}" a "${to}"`,
      });
    }
    return rows;
  }

  for (const [key, value] of Object.entries(details)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (typeof value === 'object' && value !== null) continue;
    rows.push({
      kind: 'value',
      text: `${fieldLabel(key)}: ${formatValue(key, value)}`,
    });
  }

  return rows;
}

onMounted(async () => {
  await loadUsers();
  await loadLogs(true);
});
</script>

<template>
  <section class="audit-page">
    <header class="page-head head-row">
      <div class="head-copy">
        <h1>Bitácora</h1>
        <p>Bitácora de actividad · Solo administrador</p>
      </div>
      <button
        type="button"
        class="btn btn-ghost head-back"
        @click="router.push({ name: 'monitor-menu' })"
      >
        Volver
      </button>
    </header>

    <div class="panel filters">
      <div class="field">
        <label for="dateFrom">Desde</label>
        <input id="dateFrom" v-model="filters.dateFrom" type="date" />
      </div>

      <div class="field">
        <label for="dateTo">Hasta</label>
        <input id="dateTo" v-model="filters.dateTo" type="date" />
      </div>

      <div class="field">
        <label for="q">Palabra clave</label>
        <input
          id="q"
          v-model="filters.q"
          type="search"
          placeholder="Ej. pancho, celular, venta…"
          @keyup.enter="applyFilters"
        />
      </div>

      <div class="field">
        <label for="actor">Usuario</label>
        <select id="actor" v-model="filters.actorUserId">
          <option value="">Todos</option>
          <option v-for="u in users" :key="u.id" :value="u.id">
            {{ u.fullName }} ({{ u.type }})
          </option>
        </select>
      </div>

      <div class="field">
        <label for="action">Tipo de acción</label>
        <select id="action" v-model="filters.action">
          <option value="">Todas</option>
          <option value="CREATE">Nuevo registro</option>
          <option value="UPDATE">Cambio de datos</option>
          <option value="ACTIVATE">Habilitación</option>
          <option value="DEACTIVATE">Deshabilitación</option>
          <option value="DELETE">Eliminación</option>
          <option value="CANCEL">Cancelación</option>
          <option value="APPLY">Aplicación</option>
        </select>
      </div>

      <div class="filter-actions">
        <button type="button" class="btn btn-primary" @click="applyFilters">
          Filtrar
        </button>
        <button type="button" class="btn btn-ghost" @click="clearFilters">
          Limpiar
        </button>
        <button
          type="button"
          class="btn btn-accent"
          :disabled="exporting || loading"
          @click="downloadPdf"
        >
          <span v-if="exporting" class="spinner" />
          {{ exporting ? 'Generando…' : 'Descargar PDF' }}
        </button>
      </div>
    </div>

    <div class="results-banner">
      <strong>
        {{
          total === 1
            ? '1 registro encontrado'
            : `${total} registros encontrados`
        }}
      </strong>
      <p>
        {{
          filterSummary.length
            ? filterSummary.join('   ·   ')
            : 'Sin filtros adicionales'
        }}
      </p>
    </div>

    <div class="list-panel">
      <p v-if="error" class="error-text">{{ error }}</p>

      <div v-if="loading" class="loading">
        <span class="spinner" />
        Cargando…
      </div>

      <template v-else>
        <div v-if="!logs.length" class="empty-state">
          <strong>Sin actividad</strong>
          No hay actividad para mostrar con estos filtros.
        </div>

        <ul v-else class="log-list">
          <li
            v-for="(item, index) in logs"
            :key="item.id"
            class="log-card"
            :class="{ 'log-card--alt': index % 2 === 1 }"
          >
            <div class="log-card__accent" aria-hidden="true" />

            <div class="log-card__body">
              <div class="log-card__head">
                <h3 class="log-card__title">{{ entryTitle(item, index) }}</h3>
                <div class="log-card__meta">
                  <span class="actor-badge">{{
                    item.actorName?.trim() || 'Sistema'
                  }}</span>
                  <time>{{ formatUtcToLocal(item.createdAt) }}</time>
                </div>
              </div>

              <button
                type="button"
                class="detail-toggle"
                @click="toggleDetails(item.id)"
              >
                {{
                  expandedId === item.id
                    ? 'Ocultar detalle'
                    : detailBoxTitle(item.action)
                }}
              </button>

              <div
                v-if="expandedId === item.id"
                class="detail-box"
              >
                <p class="detail-box__label">{{ detailBoxTitle(item.action) }}</p>
                <p v-if="!detailRows(item.details).length" class="details-empty">
                  Sin detalle adicional.
                </p>
                <ul v-else class="detail-lines">
                  <li
                    v-for="(row, idx) in detailRows(item.details)"
                    :key="`${item.id}-${idx}`"
                  >
                    <template v-if="row.kind === 'change'">
                      <span class="details-label">{{ row.label }}:</span>
                      pasó de
                      <span class="from">"{{ row.from }}"</span>
                      a
                      <span class="to">"{{ row.to }}"</span>
                    </template>
                    <template v-else>
                      {{ row.text }}
                    </template>
                  </li>
                </ul>
              </div>
            </div>
          </li>
        </ul>

        <div v-if="total > pageSize" class="pager">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :disabled="offset <= 0 || loading"
            @click="prevPage"
          >
            Anterior
          </button>
          <span>
            {{ offset + 1 }}–{{ Math.min(offset + pageSize, total) }} de
            {{ total }}
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :disabled="offset + pageSize >= total || loading"
            @click="nextPage"
          >
            Siguiente
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.audit-page {
  width: 100%;
  min-width: 0;
}

.head-row {
  display: flex;
  justify-content: space-between;
  gap: 0.65rem 1rem;
  align-items: flex-start;
  margin-bottom: 0.85rem;
}

.head-copy {
  flex: 1;
  min-width: 0;
}

.head-copy h1 {
  margin-bottom: 0.2rem;
  font-size: clamp(1.55rem, 4vw, 2.2rem);
}

.head-copy p {
  margin: 0;
  color: var(--vd-muted);
}

.head-back {
  min-height: 40px;
}

.filters {
  display: grid;
  grid-template-columns:
    minmax(8rem, 0.85fr) minmax(8rem, 0.85fr) minmax(10rem, 1.4fr)
    minmax(9rem, 1.2fr) minmax(9rem, 1.1fr);
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 0.85rem;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  grid-column: 1 / -1;
}

/* Resumen como el banner del PDF */
.results-banner {
  margin-bottom: 1rem;
  padding: 0.9rem 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--vd-line);
  background: #f8fafb;
}

.results-banner strong {
  display: block;
  color: var(--gsm-blue);
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
}

.results-banner p {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.88rem;
  line-height: 1.4;
}

.list-panel {
  min-width: 0;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--vd-muted);
  padding: 1rem 0;
}

.empty-state {
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--vd-muted);
  border: 1px dashed var(--vd-line);
  border-radius: 10px;
  background: #fff;
}

.empty-state strong {
  display: block;
  color: var(--vd-ink);
  margin-bottom: 0.25rem;
}

.log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* Tarjeta tipo PDF */
.log-card {
  position: relative;
  display: flex;
  border: 1px solid #dce2e6;
  border-radius: 10px;
  background: #f8fafb;
  overflow: hidden;
}

.log-card--alt {
  background: #fff;
}

.log-card__accent {
  flex: 0 0 5px;
  background: var(--gsm-blue);
  border-radius: 10px 0 0 10px;
}

.log-card__body {
  flex: 1;
  min-width: 0;
  padding: 0.95rem 1.1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.log-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.log-card__title {
  margin: 0;
  flex: 1;
  min-width: 0;
  color: var(--gsm-blue);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.35;
}

.log-card__meta {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  min-width: 7.5rem;
}

.actor-badge {
  display: inline-block;
  max-width: 11rem;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  background: #e8eef2;
  color: var(--gsm-blue);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-card__meta time {
  color: var(--vd-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.detail-toggle {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--gsm-cafe);
  padding: 0;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.detail-toggle:hover {
  color: var(--gsm-blue);
}

.detail-box {
  margin: 0;
  padding: 0.75rem 0.9rem 0.85rem;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #dce2e6;
}

.detail-box__label {
  margin: 0 0 0.55rem;
  color: var(--gsm-cafe);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.details-empty {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.9rem;
}

.detail-lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.detail-lines li {
  position: relative;
  padding-left: 1rem;
  color: var(--vd-ink);
  font-size: 0.9rem;
  line-height: 1.4;
  word-break: break-word;
}

.detail-lines li::before {
  content: '';
  position: absolute;
  left: 0.15rem;
  top: 0.55em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gsm-blue);
}

.details-label {
  color: var(--vd-ink);
  font-weight: 600;
}

.detail-lines .from {
  color: var(--vd-muted);
}

.detail-lines .to {
  color: var(--gsm-blue);
  font-weight: 700;
}

.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--vd-line);
  color: var(--vd-muted);
  font-size: 0.9rem;
}

.error-text {
  color: var(--vd-danger);
  margin: 0 0 0.75rem;
}

@media (max-width: 960px) {
  .filters {
    grid-template-columns: 1fr 1fr;
  }

  .filter-actions {
    grid-column: 1 / -1;
  }

  .filter-actions .btn {
    flex: 1;
    min-height: 44px;
  }
}

@media (max-width: 600px) {
  .head-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filters {
    grid-template-columns: 1fr;
  }

  .log-card__head {
    flex-direction: column;
  }

  .log-card__meta {
    flex-direction: row;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
  }
}
</style>
