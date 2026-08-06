<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
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

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Alta',
  UPDATE: 'Edición',
  ACTIVATE: 'Habilitar',
  DEACTIVATE: 'Deshabilitar',
  DELETE: 'Eliminar',
};

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  type: 'Tipo',
  fullName: 'Nombre completo',
  username: 'Usuario',
  cellphone: 'Celular / WhatsApp',
  active: 'Estado',
  password: 'Contraseña',
  amount: 'Monto',
  sellerId: 'Vendedor (ID)',
  sellerName: 'Vendedor',
};

const TYPE_LABELS: Record<string, string> = {
  VENDEDOR: 'Vendedor',
  MONITOR: 'Monitor',
  ADMIN: 'Administrador',
  USER: 'Usuario',
  SALE: 'Venta',
};

interface DetailRow {
  label: string;
  value: string;
  from?: string;
  to?: string;
  kind: 'value' | 'change';
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

/** Hoy calendario del negocio (YYYY-MM-DD). Interno; no exponer TZ al UI. */
function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
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
    return String(value);
  }
  return String(value);
}

/** Convierte details del API a filas legibles en español (sin JSON). */
function detailRows(details: Record<string, unknown> | null): DetailRow[] {
  if (!details) return [];

  const rows: DetailRow[] = [];

  if (details.after && typeof details.after === 'object') {
    const after = details.after as Record<string, unknown>;
    for (const [key, value] of Object.entries(after)) {
      rows.push({
        kind: 'value',
        label: fieldLabel(key),
        value: formatValue(key, value),
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
      rows.push({
        kind: 'change',
        label: fieldLabel(key),
        value: '',
        from: formatValue(key, change?.from),
        to: formatValue(key, change?.to),
      });
    }
    return rows;
  }

  // Fallback genérico por si llega otra estructura
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'object' && value !== null) continue;
    rows.push({
      kind: 'value',
      label: fieldLabel(key),
      value: formatValue(key, value),
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
        <p>Log de transacciones. Solo visible para administrador.</p>
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
          <option value="CREATE">Alta</option>
          <option value="UPDATE">Edición</option>
          <option value="ACTIVATE">Habilitar</option>
          <option value="DEACTIVATE">Deshabilitar</option>
          <option value="DELETE">Eliminar</option>
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

    <div class="panel list-panel">
      <div class="list-head">
        <h2>Registros</h2>
        <span class="total">{{ total }} resultado{{ total === 1 ? '' : 's' }}</span>
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>

      <div v-if="loading" class="loading">
        <span class="spinner" />
        Cargando…
      </div>

      <template v-else>
        <div v-if="!logs.length" class="empty-state">
          <strong>Sin registros</strong>
          Prueba otra palabra clave o limpia los filtros.
        </div>

        <ul v-else class="log-list">
          <li v-for="item in logs" :key="item.id" class="log-item">
            <div class="log-item__top">
              <span class="badge-action" :data-action="item.action">
                {{ actionLabel(item.action) }}
              </span>
              <time>{{ formatUtcToLocal(item.createdAt) }}</time>
            </div>

            <p class="log-item__summary">{{ item.summary }}</p>

            <div class="log-item__meta">
              <span>
                Usuario:
                <strong>{{ item.actorName || 'Sistema' }}</strong>
                <template v-if="item.actorType"> ({{ item.actorType }})</template>
              </span>
              <span>
                Entidad:
                <strong>{{ item.entityType }}</strong>
                <template v-if="item.entityId != null"> #{{ item.entityId }}</template>
              </span>
            </div>

            <button
              type="button"
              class="link-btn"
              @click="toggleDetails(item.id)"
            >
              {{ expandedId === item.id ? 'Ocultar detalle' : 'Ver detalle' }}
            </button>

            <div v-if="expandedId === item.id" class="log-item__details">
              <p v-if="!detailRows(item.details).length" class="details-empty">
                Sin detalle adicional.
              </p>
              <ul v-else class="details-list">
                <li
                  v-for="(row, idx) in detailRows(item.details)"
                  :key="`${item.id}-${idx}`"
                >
                  <template v-if="row.kind === 'change'">
                    <span class="details-label">{{ row.label }}</span>
                    <span class="details-change">
                      <span class="from">{{ row.from }}</span>
                      <span class="arrow">→</span>
                      <span class="to">{{ row.to }}</span>
                    </span>
                  </template>
                  <template v-else>
                    <span class="details-label">{{ row.label }}</span>
                    <span class="details-value">{{ row.value }}</span>
                  </template>
                </li>
              </ul>
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
            {{ offset + 1 }}–{{ Math.min(offset + pageSize, total) }} de {{ total }}
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

.head-back {
  min-height: 40px;
}

.filters {
  display: grid;
  grid-template-columns: minmax(8rem, 0.85fr) minmax(8rem, 0.85fr) minmax(10rem, 1.4fr) minmax(9rem, 1.2fr) minmax(9rem, 1.1fr);
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 1rem;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  grid-column: 1 / -1;
}

.list-panel > .list-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.list-head h2 {
  margin: 0;
  font-size: 1.25rem;
}

.total {
  color: var(--vd-muted);
  font-size: 0.9rem;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--vd-muted);
}

.log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.log-item {
  border: 1px solid var(--vd-line);
  border-radius: var(--vd-radius-sm);
  background: var(--vd-surface-2);
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.log-item__top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.log-item__top time {
  color: var(--vd-muted);
  font-size: 0.85rem;
  white-space: nowrap;
}

.badge-action {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  background: rgba(53, 100, 125, 0.12);
  color: var(--gsm-blue);
}

.badge-action[data-action='CREATE'] {
  background: rgba(47, 111, 78, 0.14);
  color: var(--vd-ok);
}

.badge-action[data-action='UPDATE'] {
  background: rgba(53, 100, 125, 0.12);
  color: var(--gsm-blue);
}

.badge-action[data-action='ACTIVATE'] {
  background: rgba(204, 160, 121, 0.22);
  color: #6a4a2e;
}

.badge-action[data-action='DEACTIVATE'],
.badge-action[data-action='DELETE'] {
  background: rgba(203, 42, 29, 0.12);
  color: var(--vd-danger);
}

.log-item__summary {
  margin: 0;
  color: var(--vd-ink);
  font-weight: 500;
  line-height: 1.4;
}

.log-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  color: var(--vd-muted);
  font-size: 0.88rem;
}

.log-item__meta strong {
  color: var(--gsm-blue);
  font-weight: 600;
}

.link-btn {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--gsm-blue);
  padding: 0;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.log-item__details {
  margin: 0.25rem 0 0;
  padding: 0.75rem 0.85rem;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--vd-line);
}

.details-empty {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.9rem;
}

.details-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.details-list li {
  display: grid;
  grid-template-columns: minmax(120px, 160px) minmax(0, 1fr);
  gap: 0.5rem 0.85rem;
  align-items: start;
  font-size: 0.92rem;
}

.details-label {
  color: var(--vd-muted);
  font-weight: 500;
}

.details-value {
  color: var(--vd-ink);
  font-weight: 600;
  word-break: break-word;
}

.details-change {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  color: var(--vd-ink);
}

.details-change .from {
  color: var(--vd-muted);
  text-decoration: line-through;
}

.details-change .arrow {
  color: var(--gsm-cafe);
  font-weight: 700;
}

.details-change .to {
  color: var(--gsm-blue);
  font-weight: 700;
}

@media (max-width: 600px) {
  .details-list li {
    grid-template-columns: 1fr;
    gap: 0.15rem;
  }
}

.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  color: var(--vd-muted);
  font-size: 0.9rem;
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

  .log-item__top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
