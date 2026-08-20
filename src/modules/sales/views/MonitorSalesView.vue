<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { extractApiError, http } from '../../../shared/api/http';
import { formatUtcToLocal } from '../../../shared/utils/datetime';
import { useDialog } from '../../../shared/ui/dialog';
import SaleAttachmentsModal from '../components/SaleAttachmentsModal.vue';
import SaleFilePreviewModal from '../components/SaleFilePreviewModal.vue';
import SalePdfPreviewModal from '../components/SalePdfPreviewModal.vue';
import {
  mergeSaleForm,
  type SaleAttachment,
  type SaleFormData,
  type SaleListItem,
  type SaleStatus,
} from '../types/sale-form';
import {
  listSaleAttachments,
  type AttachmentListItem,
} from '../utils/attachment-preview';
import { downloadMonitorSalesPdf } from '../utils/monitor-sales-pdf';
import {
  lastWeekRange,
  matchesDateRange,
  textEqualsNormalized,
  textIncludesNormalized,
} from '../utils/sales-list-filters';

interface SalesResponse {
  scope: 'all';
  items: SaleListItem[];
  total: number;
  message: string;
}

const { alert } = useDialog();

const loading = ref(true);
const exporting = ref(false);
const data = ref<SalesResponse | null>(null);
const error = ref<string | null>(null);

const defaultDates = lastWeekRange();

const filters = reactive({
  sellerId: '',
  status: '',
  dateFrom: defaultDates.dateFrom,
  dateTo: defaultDates.dateTo,
  client: '',
});

const clientQuery = ref('');
const clientMenuOpen = ref(false);

const previewOpen = ref(false);
const previewForm = ref<SaleFormData>(mergeSaleForm({}));
const previewId = ref<number | null>(null);
const previewStatus = ref<string | undefined>();

const attachmentsOpen = ref(false);
const attachmentsLoading = ref(false);
const attachmentItems = ref<AttachmentListItem[]>([]);
const filePreviewOpen = ref(false);
const filePreviewTitle = ref('Archivo');
const filePreviewAttachment = ref<SaleAttachment | null>(null);

const allItems = computed(() => data.value?.items ?? []);

const sellerOptions = computed(() => {
  const map = new Map<number, string>();
  for (const item of allItems.value) {
    if (!map.has(item.sellerId)) {
      map.set(item.sellerId, item.sellerName || `Vendedor #${item.sellerId}`);
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
});

const clientOptions = computed(() => {
  const names = new Set<string>();
  for (const item of allItems.value) {
    const name = (item.titularName || '').trim();
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'es'));
});

const filteredClientOptions = computed(() => {
  const q = clientQuery.value.trim();
  if (!q) return clientOptions.value.slice(0, 12);
  return clientOptions.value
    .filter((name) => textIncludesNormalized(name, q))
    .slice(0, 12);
});

function statusMatches(itemStatus: string, filter: string): boolean {
  if (!filter) return true;
  if (filter === 'COMPLETED') {
    return itemStatus === 'COMPLETED' || itemStatus === 'SUBMITTED';
  }
  return itemStatus === filter;
}

function matchesClient(titularName: string | null | undefined): boolean {
  if (filters.client) {
    return textEqualsNormalized(titularName, filters.client);
  }
  return textIncludesNormalized(titularName, clientQuery.value);
}

const filteredItems = computed(() => {
  return allItems.value.filter((item) => {
    if (
      filters.sellerId &&
      item.sellerId !== Number(filters.sellerId)
    ) {
      return false;
    }
    if (!statusMatches(item.status, filters.status)) return false;
    if (!matchesDateRange(item.createdAt, filters.dateFrom, filters.dateTo)) {
      return false;
    }
    if (!matchesClient(item.titularName)) return false;
    return true;
  });
});

const hasActiveFilters = computed(
  () =>
    !!filters.sellerId ||
    !!filters.status ||
    !!filters.client.trim() ||
    !!clientQuery.value.trim() ||
    filters.dateFrom !== defaultDates.dateFrom ||
    filters.dateTo !== defaultDates.dateTo,
);

function onClientInput() {
  filters.client = '';
  clientMenuOpen.value = true;
}

function selectClient(name: string) {
  filters.client = name;
  clientQuery.value = name;
  clientMenuOpen.value = false;
}

function clearClient() {
  filters.client = '';
  clientQuery.value = '';
  clientMenuOpen.value = true;
}

function clearFilters() {
  const range = lastWeekRange();
  filters.sellerId = '';
  filters.status = '';
  filters.dateFrom = range.dateFrom;
  filters.dateTo = range.dateTo;
  filters.client = '';
  clientQuery.value = '';
  clientMenuOpen.value = false;
  defaultDates.dateFrom = range.dateFrom;
  defaultDates.dateTo = range.dateTo;
}

async function exportPdf() {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    await alert({
      title: 'Fechas inválidas',
      message: 'La fecha inicial no puede ser mayor que la fecha final.',
      variant: 'warning',
    });
    return;
  }

  if (!filteredItems.value.length) {
    await alert({
      title: 'Exportar PDF',
      message: 'No hay ventas para exportar con los filtros actuales.',
      variant: 'warning',
    });
    return;
  }

  exporting.value = true;
  try {
    const sellerName = filters.sellerId
      ? sellerOptions.value.find((s) => String(s.id) === String(filters.sellerId))
          ?.name
      : undefined;

    await downloadMonitorSalesPdf(filteredItems.value, {
      sellerName,
      statusLabel: filters.status
        ? statusLabel(filters.status)
        : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      client: filters.client.trim() || undefined,
    });
  } catch (e: unknown) {
    await alert({
      title: 'Exportar PDF',
      message: extractApiError(e, 'No se pudo generar el PDF'),
      variant: 'danger',
    });
  } finally {
    exporting.value = false;
  }
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await http.get<SalesResponse>('/sales/todas');
    data.value = res.data;
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudieron cargar las ventas');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function statusLabel(status: SaleStatus | string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Pendiente de pago';
    case 'PENDING_SIGNATURE':
      return 'Pendiente de firma';
    case 'COMPLETED':
    case 'SUBMITTED':
      return 'Completada';
    case 'REJECTED':
      return 'Rechazada';
    case 'DRAFT':
      return 'Borrador';
    default:
      return status;
  }
}

function statusBadgeClass(status: SaleStatus | string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'status-badge status-badge--payment';
    case 'PENDING_SIGNATURE':
      return 'status-badge status-badge--sign';
    case 'COMPLETED':
    case 'SUBMITTED':
      return 'status-badge status-badge--done';
    case 'REJECTED':
      return 'status-badge status-badge--rejected';
    default:
      return 'status-badge';
  }
}

function salePago(item: SaleListItem) {
  const form = mergeSaleForm(item.payload);
  return {
    precioPlan: form.ubicacionPlan.precioPlan || form.pago.precioPlan,
    descuento: form.pago.promocionDescuento,
    anticipo: form.pago.anticipo,
    saldo: form.pago.saldo,
  };
}

function formatMoney(raw: string | number | null | undefined) {
  const n = Number(String(raw ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n) || String(raw ?? '').trim() === '') return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(n);
}

function formatDiscount(raw: string | null | undefined) {
  const t = String(raw ?? '').trim();
  if (!t) return '—';
  const n = Number(t.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return `${t}%`;
  return `${n}%`;
}

async function fetchSaleForm(item: SaleListItem): Promise<SaleListItem> {
  const { data: sale } = await http.get<SaleListItem>(`/sales/${item.id}`);
  return sale;
}

async function openPreview(item: SaleListItem) {
  try {
    const sale = await fetchSaleForm(item);
    previewForm.value = mergeSaleForm(sale.payload);
    previewId.value = sale.id;
    previewStatus.value = sale.status;
    previewOpen.value = true;
  } catch (e: unknown) {
    await alert({
      title: 'Vista previa',
      message: extractApiError(e, 'No se pudo abrir la venta'),
      variant: 'danger',
    });
  }
}

async function openAttachments(item: SaleListItem) {
  attachmentsOpen.value = true;
  attachmentsLoading.value = true;
  attachmentItems.value = [];
  try {
    const sale = await fetchSaleForm(item);
    attachmentItems.value = listSaleAttachments(mergeSaleForm(sale.payload));
  } catch (e: unknown) {
    attachmentsOpen.value = false;
    await alert({
      title: 'Anexos',
      message: extractApiError(e, 'No se pudieron cargar los archivos'),
      variant: 'danger',
    });
  } finally {
    attachmentsLoading.value = false;
  }
}

function onSelectAttachment(item: AttachmentListItem) {
  attachmentsOpen.value = false;
  filePreviewTitle.value = item.label;
  filePreviewAttachment.value = item.attachment;
  filePreviewOpen.value = true;
}
</script>

<template>
  <section class="sales-page">
    <header class="page-head">
      <h1>Ventas</h1>
      <p>Consulta de ventas de todos los vendedores.</p>
    </header>

    <div class="panel filters">
      <div class="field">
        <label for="filter-seller">Vendedor</label>
        <select id="filter-seller" v-model="filters.sellerId">
          <option value="">Todos</option>
          <option
            v-for="s in sellerOptions"
            :key="s.id"
            :value="s.id"
          >
            {{ s.name }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="filter-status">Estatus</label>
        <select id="filter-status" v-model="filters.status">
          <option value="">Todos</option>
          <option value="PENDING_PAYMENT">Pendiente de pago</option>
          <option value="PENDING_SIGNATURE">Pendiente de firma</option>
          <option value="COMPLETED">Completada</option>
          <option value="REJECTED">Rechazada</option>
        </select>
      </div>

      <div class="field">
        <label for="filter-from">Desde</label>
        <input id="filter-from" v-model="filters.dateFrom" type="date" />
      </div>

      <div class="field">
        <label for="filter-to">Hasta</label>
        <input id="filter-to" v-model="filters.dateTo" type="date" />
      </div>

      <div class="field field--wide client-ac">
        <label for="filter-client">Cliente</label>
        <div class="client-ac__row">
          <input
            id="filter-client"
            v-model="clientQuery"
            type="search"
            autocomplete="off"
            placeholder="Buscar o seleccionar cliente…"
            @input="onClientInput"
            @focus="clientMenuOpen = true"
            @blur="clientMenuOpen = false"
          />
          <button
            v-if="filters.client || clientQuery"
            type="button"
            class="btn btn-sm btn-ghost"
            @mousedown.prevent="clearClient"
          >
            Limpiar
          </button>
        </div>
        <ul
          v-if="clientMenuOpen && filteredClientOptions.length"
          class="client-ac__list"
          role="listbox"
        >
          <li v-for="name in filteredClientOptions" :key="name">
            <button
              type="button"
              class="client-ac__item"
              :class="{ active: name === filters.client }"
              @mousedown.prevent="selectClient(name)"
            >
              {{ name }}
            </button>
          </li>
        </ul>
        <p
          v-else-if="clientMenuOpen && clientQuery.trim()"
          class="client-ac__empty"
        >
          Sin coincidencias
        </p>
      </div>

      <div class="filter-actions">
        <button
          type="button"
          class="btn btn-accent"
          :disabled="exporting || loading || !filteredItems.length"
          @click="exportPdf"
        >
          {{ exporting ? 'Generando…' : 'Exportar PDF' }}
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="!hasActiveFilters"
          @click="clearFilters"
        >
          Limpiar
        </button>
      </div>
    </div>

    <div v-if="loading" class="panel loading">
      <span class="spinner" />
      Cargando…
    </div>

    <div v-else-if="error" class="panel">
      <p class="error-text">{{ error }}</p>
    </div>

    <div v-else class="panel">
      <div class="summary">
        <p>
          Mostrando {{ filteredItems.length }} de {{ allItems.length }} ventas
          <span v-if="!hasActiveFilters" class="muted-inline">
            (última semana)
          </span>
        </p>
        <span class="total">Total: {{ filteredItems.length }}</span>
      </div>

      <div v-if="!allItems.length" class="empty-state">
        <strong>Sin ventas todavía</strong>
        Cuando los vendedores registren ventas, aparecerán aquí.
      </div>

      <div v-else-if="!filteredItems.length" class="empty-state">
        <strong>Sin resultados</strong>
        Prueba otros filtros o limpia la búsqueda.
      </div>

      <template v-else>
        <div class="table-wrap desktop-list">
          <table class="data sales-table">
            <colgroup>
              <col class="col-fecha" />
              <col class="col-titular" />
              <col class="col-vendedor" />
              <col class="col-estatus" />
              <col class="col-money" />
              <col class="col-desc" />
              <col class="col-money" />
              <col class="col-money" />
              <col class="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Fecha local</th>
                <th>Titular</th>
                <th>Vendedor</th>
                <th>Estatus</th>
                <th class="num">Costo del plan</th>
                <th class="num">Descuento</th>
                <th class="num">Anticipo</th>
                <th class="num">Saldo final</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredItems" :key="item.id">
                <td>{{ formatUtcToLocal(item.createdAt) }}</td>
                <td class="cell-wrap">{{ item.titularName || '—' }}</td>
                <td class="cell-wrap">{{ item.sellerName }}</td>
                <td>
                  <span :class="statusBadgeClass(item.status)">
                    {{ statusLabel(item.status) }}
                  </span>
                </td>
                <td class="num">{{ formatMoney(salePago(item).precioPlan) }}</td>
                <td class="num">{{ formatDiscount(salePago(item).descuento) }}</td>
                <td class="num">{{ formatMoney(salePago(item).anticipo) }}</td>
                <td class="num">{{ formatMoney(salePago(item).saldo) }}</td>
                <td class="actions-cell">
                  <button
                    type="button"
                    class="icon-btn"
                    title="Archivos anexados"
                    aria-label="Archivos anexados"
                    @click="openAttachments(item)"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M16.5 6.5v10.25a4.25 4.25 0 1 1-8.5 0V5.75a2.75 2.75 0 1 1 5.5 0v10.5a1.25 1.25 0 1 1-2.5 0V7.25h-1.5v9a2.75 2.75 0 1 0 5.5 0V5.75a4.25 4.25 0 1 0-8.5 0v11a5.75 5.75 0 1 0 11.5 0V6.5h-1.5z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    title="Vista previa carátula"
                    aria-label="Vista previa carátula"
                    @click="openPreview(item)"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5Z"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mobile-list">
          <article
            v-for="item in filteredItems"
            :key="`m-${item.id}`"
            class="sale-card"
          >
            <div class="sale-card__head">
              <strong>{{ item.titularName || 'Sin titular' }}</strong>
              <span :class="statusBadgeClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </div>
            <span class="muted">{{ item.sellerName }}</span>
            <span class="muted">{{ formatUtcToLocal(item.createdAt) }}</span>
            <dl class="sale-meta">
              <div>
                <dt>Costo del plan</dt>
                <dd>{{ formatMoney(salePago(item).precioPlan) }}</dd>
              </div>
              <div>
                <dt>Descuento</dt>
                <dd>{{ formatDiscount(salePago(item).descuento) }}</dd>
              </div>
              <div>
                <dt>Anticipo</dt>
                <dd>{{ formatMoney(salePago(item).anticipo) }}</dd>
              </div>
              <div>
                <dt>Saldo final</dt>
                <dd>{{ formatMoney(salePago(item).saldo) }}</dd>
              </div>
            </dl>
            <div class="sale-card__actions">
              <button
                type="button"
                class="icon-btn"
                title="Archivos anexados"
                aria-label="Archivos anexados"
                @click="openAttachments(item)"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M16.5 6.5v10.25a4.25 4.25 0 1 1-8.5 0V5.75a2.75 2.75 0 1 1 5.5 0v10.5a1.25 1.25 0 1 1-2.5 0V7.25h-1.5v9a2.75 2.75 0 1 0 5.5 0V5.75a4.25 4.25 0 1 0-8.5 0v11a5.75 5.75 0 1 0 11.5 0V6.5h-1.5z"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn"
                title="Vista previa carátula"
                aria-label="Vista previa carátula"
                @click="openPreview(item)"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5Z"
                  />
                </svg>
              </button>
            </div>
          </article>
        </div>
      </template>
    </div>

    <SaleAttachmentsModal
      :open="attachmentsOpen"
      :items="attachmentItems"
      :loading="attachmentsLoading"
      @close="attachmentsOpen = false"
      @select="onSelectAttachment"
    />

    <SaleFilePreviewModal
      :open="filePreviewOpen"
      :title="filePreviewTitle"
      :attachment="filePreviewAttachment"
      @close="filePreviewOpen = false"
    />

    <SalePdfPreviewModal
      :open="previewOpen"
      :form="previewForm"
      :sale-id="previewId"
      :status="previewStatus"
      @close="previewOpen = false"
    />
  </section>
</template>

<style scoped>
.sales-page {
  min-width: 0;
}

.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.field label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vd-muted);
}

.field--wide {
  grid-column: span 2;
}

.client-ac {
  position: relative;
}

.client-ac__row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.client-ac__row input {
  flex: 1;
  min-width: 0;
}

.client-ac__list {
  list-style: none;
  margin: 0.3rem 0 0;
  padding: 0.25rem;
  border: 1px solid var(--vd-line);
  border-radius: 8px;
  max-height: 220px;
  overflow: auto;
  background: #fff;
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.client-ac__item {
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 0.55rem 0.65rem;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}

.client-ac__item:hover,
.client-ac__item.active {
  background: #f0f5f8;
  color: var(--gsm-blue);
}

.client-ac__empty {
  margin: 0.3rem 0 0;
  font-size: 0.82rem;
  color: var(--vd-muted);
}

.muted-inline {
  color: var(--vd-muted);
  font-size: 0.9em;
}

.filter-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--vd-muted);
}

.summary {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.total {
  font-weight: 600;
  color: var(--gsm-blue);
}

.table-wrap {
  overflow-x: auto;
  width: 100%;
}

.sales-table {
  table-layout: fixed;
  width: 100%;
  min-width: 960px;
}

.sales-table .col-fecha {
  width: 12%;
}

.sales-table .col-titular {
  width: 18%;
}

.sales-table .col-vendedor {
  width: 14%;
}

.sales-table .col-estatus {
  width: 13%;
}

.sales-table .col-money {
  width: 10%;
}

.sales-table .col-desc {
  width: 7%;
}

.sales-table .col-actions {
  width: 96px;
}

.sales-table th,
.sales-table td {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.sales-table .cell-wrap {
  white-space: normal;
  overflow: visible;
  word-break: break-word;
}

.sales-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.actions-cell {
  display: flex;
  gap: 0.35rem;
  justify-content: flex-end;
  white-space: nowrap;
}

.mobile-list {
  display: none;
  flex-direction: column;
  gap: 0.7rem;
}

.sale-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--vd-line);
  border-radius: var(--vd-radius-sm);
  background: var(--vd-surface-2);
}

.sale-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.sale-card__head strong {
  color: var(--gsm-blue);
}

.muted {
  color: var(--vd-muted);
  font-size: 0.88rem;
}

.sale-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem 0.75rem;
  margin: 0.45rem 0 0;
}

.sale-meta dt {
  font-size: 0.72rem;
  color: var(--vd-muted);
}

.sale-meta dd {
  margin: 0.1rem 0 0;
  font-weight: 600;
  color: var(--vd-ink);
}

.sale-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  background: rgba(53, 100, 125, 0.1);
  color: var(--gsm-blue);
}

.status-badge--payment {
  background: rgba(180, 120, 20, 0.12);
  color: #9a6410;
}

.status-badge--sign {
  background: rgba(53, 100, 125, 0.12);
  color: var(--gsm-blue);
}

.status-badge--done {
  background: rgba(47, 111, 78, 0.12);
  color: var(--vd-ok);
}

.status-badge--rejected {
  background: rgba(196, 40, 28, 0.1);
  color: var(--vd-danger);
}

.icon-btn {
  border: 1px solid var(--vd-line);
  background: #fff;
  color: var(--gsm-blue);
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.icon-btn:hover {
  border-color: var(--gsm-blue);
  background: rgba(53, 100, 125, 0.06);
}

@media (max-width: 1100px) {
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field--wide {
    grid-column: span 2;
  }
}

@media (max-width: 900px) {
  .desktop-list {
    display: none;
  }

  .mobile-list {
    display: flex;
  }
}

@media (max-width: 600px) {
  .filters {
    grid-template-columns: 1fr;
  }

  .field--wide {
    grid-column: auto;
  }

  .filter-actions .btn {
    width: 100%;
    min-height: 44px;
  }
}
</style>
