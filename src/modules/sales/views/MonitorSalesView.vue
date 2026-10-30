<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { extractApiError, http } from '../../../shared/api/http';
import { formatUtcToLocal, getClientTimeZone } from '../../../shared/utils/datetime';
import { useDialog } from '../../../shared/ui/dialog';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import SaleAttachmentsModal from '../components/SaleAttachmentsModal.vue';
import SaleDetailModal from '../components/SaleDetailModal.vue';
import SaleFilePreviewModal from '../components/SaleFilePreviewModal.vue';
import SalePdfPreviewModal from '../components/SalePdfPreviewModal.vue';
import {
  formatDigitalFolio,
  mergeSaleForm,
  realContrato,
  type SaleAttachment,
  type SaleFormData,
  type SaleListItem,
  type SaleStatus,
} from '../types/sale-form';
import { buildSignSaleRequest } from '../utils/submit-sign';
import {
  listSaleAttachments,
  type AttachmentListItem,
} from '../utils/attachment-preview';
import { downloadMonitorSalesPdf } from '../utils/monitor-sales-pdf';
import {
  lastWeekRange,
  textIncludesNormalized,
} from '../utils/sales-list-filters';

interface SalesResponse {
  scope: 'all';
  items: SaleListItem[];
  sellers?: { id: number; name: string }[];
  total: number;
  message: string;
}

const { alert, confirm } = useDialog();

const loading = ref(true);
const syncingId = ref<number | null>(null);
const resendingSignId = ref<number | null>(null);
const refreshingId = ref<number | null>(null);
const actionsItem = ref<SaleListItem | null>(null);
const exporting = ref(false);
const data = ref<SalesResponse | null>(null);
const error = ref<string | null>(null);

const MONITOR_SEARCH_KEY = 'vd_monitor_sales_search';

const SALE_SORT_KEYS = [
  'fecha',
  'titular',
  'vendedor',
  'digital',
  'folio',
  'estatus',
  'precio',
  'descuento',
  'anticipo',
  'saldo',
] as const;

type SaleSortKey = (typeof SALE_SORT_KEYS)[number];

type StoredMonitorSearch = {
  sellerId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  client: string;
  sortKey: SaleSortKey | null;
  sortDir: 'asc' | 'desc';
};

function storedSortKey(value: unknown): SaleSortKey | null {
  return SALE_SORT_KEYS.includes(value as SaleSortKey)
    ? (value as SaleSortKey)
    : null;
}

function readStoredSearch(): StoredMonitorSearch | null {
  try {
    const raw = sessionStorage.getItem(MONITOR_SEARCH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StoredMonitorSearch>;
    const dateFrom = String(data.dateFrom || '').trim();
    const dateTo = String(data.dateTo || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      return null;
    }
    return {
      sellerId: String(data.sellerId || ''),
      status: String(data.status || ''),
      dateFrom,
      dateTo,
      client: String(data.client || ''),
      sortKey: storedSortKey(data.sortKey),
      sortDir: data.sortDir === 'desc' ? 'desc' : 'asc',
    };
  } catch {
    return null;
  }
}

const defaultDates = lastWeekRange();
const storedSearch = readStoredSearch();

const filters = reactive({
  sellerId: storedSearch?.sellerId ?? '',
  status: storedSearch?.status ?? '',
  dateFrom: storedSearch?.dateFrom ?? defaultDates.dateFrom,
  dateTo: storedSearch?.dateTo ?? defaultDates.dateTo,
  client: storedSearch?.client ?? '',
});

const clientQuery = ref(storedSearch?.client ?? '');
const clientMenuOpen = ref(false);
const applied = reactive({
  sellerId: '',
  status: '',
  dateFrom: defaultDates.dateFrom,
  dateTo: defaultDates.dateTo,
  client: '',
});

const previewOpen = ref(false);
const previewForm = ref<SaleFormData>(mergeSaleForm({}));
const previewId = ref<number | null>(null);
const previewStatus = ref<string | undefined>();

const detailOpen = ref(false);
const detailForm = ref<SaleFormData>(mergeSaleForm({}));
const detailItem = ref<SaleListItem | null>(null);

const attachmentsOpen = ref(false);
const attachmentsLoading = ref(false);
const attachmentItems = ref<AttachmentListItem[]>([]);
const filePreviewOpen = ref(false);
const filePreviewTitle = ref('Archivo');
const filePreviewAttachment = ref<SaleAttachment | null>(null);

const allItems = computed(() => data.value?.items ?? []);

const sortKey = ref<SaleSortKey | null>(storedSearch?.sortKey ?? null);
const sortDir = ref<'asc' | 'desc'>(storedSearch?.sortDir ?? 'asc');

function toggleSort(key: SaleSortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    return;
  }
  sortKey.value = key;
  sortDir.value = 'asc';
}

function sortMark(key: SaleSortKey): string {
  if (sortKey.value !== key) return '↕';
  return sortDir.value === 'asc' ? '↑' : '↓';
}

function sortAria(key: SaleSortKey): 'none' | 'ascending' | 'descending' {
  if (sortKey.value !== key) return 'none';
  return sortDir.value === 'asc' ? 'ascending' : 'descending';
}

function amountSortValue(raw: string | null | undefined): number | null {
  const text = String(raw ?? '').trim();
  if (!text || text === '—') return null;
  const n = Number(text.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function compareText(a: string, b: string): number {
  const left = a.trim();
  const right = b.trim();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right, 'es', { sensitivity: 'base', numeric: true });
}

function compareAmount(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

const sortedItems = computed(() => {
  const items = allItems.value.slice();
  const key = sortKey.value;
  if (!key) return items;
  const dir = sortDir.value === 'asc' ? 1 : -1;
  items.sort((a, b) => {
    let result = 0;
    if (key === 'fecha') {
      result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (key === 'titular') {
      result = compareText(a.titularName || '', b.titularName || '');
    } else if (key === 'vendedor') {
      result = compareText(a.sellerName || '', b.sellerName || '');
    } else if (key === 'digital') {
      result = a.id - b.id;
    } else if (key === 'folio') {
      result = compareText(completedSaleFolio(a), completedSaleFolio(b));
    } else if (key === 'estatus') {
      result = compareText(statusLabel(a.status), statusLabel(b.status));
    } else if (key === 'precio') {
      result = compareAmount(
        amountSortValue(salePago(a).precioPlan),
        amountSortValue(salePago(b).precioPlan),
      );
    } else if (key === 'descuento') {
      result = compareAmount(
        amountSortValue(salePago(a).descuento),
        amountSortValue(salePago(b).descuento),
      );
    } else if (key === 'anticipo') {
      result = compareAmount(
        amountSortValue(salePago(a).anticipo),
        amountSortValue(salePago(b).anticipo),
      );
    } else {
      result = compareAmount(
        amountSortValue(salePago(a).saldo),
        amountSortValue(salePago(b).saldo),
      );
    }
    return result * dir;
  });
  return items;
});
const sellerCatalog = ref<{ id: number; name: string }[]>([]);

const sellerOptions = computed(() => {
  if (sellerCatalog.value.length) return sellerCatalog.value;
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

function openActions(item: SaleListItem) {
  actionsItem.value = item;
}

function closeActions() {
  actionsItem.value = null;
}

function runSaleAction(action: (item: SaleListItem) => void) {
  const item = actionsItem.value;
  closeActions();
  if (item) action(item);
}

function canRefreshDocuments(item: SaleListItem): boolean {
  return saleKeepsSignature(item.status);
}

function saleKeepsSignature(status: string): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'SUBMITTED' ||
    status === 'PENDING_VALIDATION' ||
    status === 'PENDING_CORRECTION' ||
    status === 'PENDING_CORRECTION_REVIEW'
  );
}

async function refreshDocuments(item: SaleListItem) {
  if (refreshingId.value) return;
  const accepted = await confirm({
    title: 'Actualizar documentos',
    message:
      'Se generan otra vez los documentos a firmar con los datos actuales y se reemplazan los anteriores en Drive.',
    confirmText: 'Actualizar',
    variant: 'warning',
  });
  if (!accepted) return;
  refreshingId.value = item.id;
  try {
    const sale = await fetchSaleForm(item);
    const form = mergeSaleForm(sale.payload);
    const { data: firma } = await http.get<{
      dataBase64: string | null;
      mime: string;
    }>(`/sales/${item.id}/firma`);
    if (saleKeepsSignature(sale.status) && !firma.dataBase64) {
      await alert({
        title: 'Sin firma',
        message:
          'Esta venta ya estaba firmada, pero no se encontró la firma para volver a estampar los documentos.',
        variant: 'warning',
      });
      return;
    }
    const dataUrl = firma.dataBase64
      ? `data:${firma.mime || 'image/png'};base64,${firma.dataBase64}`
      : null;
    const { body, hasCaratula } = await buildSignSaleRequest(form, item.id, dataUrl);
    if (!hasCaratula || !body.caratulaPdf) {
      await alert({
        title: 'Documentos',
        message: 'No se pudo generar la carátula.',
        variant: 'danger',
      });
      return;
    }
    await http.post(
      `/sales/${item.id}/refresh-sign-documents`,
      {
        caratulaPdf: body.caratulaPdf,
        cartaFacturaPdf: body.cartaFacturaPdf ?? null,
        cartaNoFacturaPdf: body.cartaNoFacturaPdf ?? null,
        cartaExclusionesPdf: body.cartaExclusionesPdf ?? null,
        reglamentoParquePdf: body.reglamentoParquePdf ?? null,
        reglamentoParqueFolletoPdf: body.reglamentoParqueFolletoPdf ?? null,
        cartaAutorizacionPdf: body.cartaAutorizacionPdf ?? null,
        cartaNominaPdf: body.cartaNominaPdf ?? null,
        solicitudReconocimientoPdfs: body.solicitudReconocimientoPdfs ?? null,
        cartaNoPapeleriaPdfs: body.cartaNoPapeleriaPdfs ?? null,
        solicitudCancelacionPdfs: body.solicitudCancelacionPdfs ?? null,
      },
      { timeout: 120000 },
    );
    await alert({
      title: 'Documentos actualizados',
      message: `Los documentos de la venta #${item.id} ya reemplazaron a los anteriores en Drive.`,
      variant: 'success',
    });
  } catch (e: unknown) {
    await alert({
      title: 'No se actualizaron',
      message: extractApiError(e, 'No se pudieron actualizar los documentos'),
      variant: 'danger',
    });
  } finally {
    refreshingId.value = null;
  }
}

function canResendSign(item: SaleListItem): boolean {
  return (
    item.status === 'PENDING_VALIDATION' ||
    item.status === 'COMPLETED' ||
    item.status === 'SUBMITTED'
  );
}

async function resendSignLink(item: SaleListItem) {
  if (resendingSignId.value != null) return;
  const ok = await confirm({
    title: 'Enviar firma de nuevo',
    message:
      'Se enviará un correo al titular para que firme otra vez. Al firmar, los documentos se reemplazan con la firma nueva.',
    confirmText: 'Enviar',
    cancelText: 'Cancelar',
  });
  if (!ok) return;
  resendingSignId.value = item.id;
  try {
    await http.post(`/sales/${item.id}/resend-sign-link`, {
      frontUrl: window.location.origin,
    });
    await alert({
      title: 'Firma enviada',
      message: 'Se envió el enlace de firma al correo del titular.',
      variant: 'success',
    });
  } catch (e: unknown) {
    await alert({
      title: 'Firma',
      message: extractApiError(e, 'No se pudo enviar el enlace de firma'),
      variant: 'danger',
    });
  } finally {
    resendingSignId.value = null;
  }
}

function canSyncSale(item: SaleListItem): boolean {
  return item.status !== 'DRAFT' && item.status !== 'REJECTED';
}

async function syncSale(item: SaleListItem) {
  if (syncingId.value) return;
  syncingId.value = item.id;
  try {
    await http.post(`/sales/${item.id}/sync`, {}, { skipGlobalLoading: true });
    await alert({
      title: 'Venta sincronizada',
      message: `La venta #${item.id} ya está en el expediente de Odoo.`,
      variant: 'success',
    });
  } catch (e: unknown) {
    await alert({
      title: 'No se sincronizó',
      message: extractApiError(e, 'No se pudo sincronizar la venta'),
      variant: 'danger',
    });
  } finally {
    syncingId.value = null;
  }
}

function isCompletedStatus(status: SaleStatus | string): boolean {
  return status === 'COMPLETED' || status === 'SUBMITTED';
}

function digitalSaleFolio(item: SaleListItem): string {
  return formatDigitalFolio(item.id);
}

function completedSaleFolio(item: SaleListItem): string {
  if (!isCompletedStatus(item.status)) return '';
  return realContrato(item.contrato);
}

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
  void search();
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
  void load();
}

async function search() {
  if (!filters.dateFrom || !filters.dateTo) {
    await alert({
      title: 'Fechas',
      message: 'Indica desde y hasta para consultar las ventas.',
      variant: 'warning',
    });
    return;
  }
  if (filters.dateFrom > filters.dateTo) {
    await alert({
      title: 'Fechas inválidas',
      message: 'La fecha inicial no puede ser mayor que la fecha final.',
      variant: 'warning',
    });
    return;
  }
  clientMenuOpen.value = false;
  await load();
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

  if (!allItems.value.length) {
    await alert({
      title: 'Exportar PDF',
      message: 'No hay ventas para exportar con los filtros actuales.',
      variant: 'warning',
    });
    return;
  }

  exporting.value = true;
  try {
    const sellerName = applied.sellerId
      ? sellerOptions.value.find((s) => String(s.id) === String(applied.sellerId))
          ?.name
      : undefined;

    await downloadMonitorSalesPdf(allItems.value, {
      sellerName,
      statusLabel: applied.status ? statusLabel(applied.status) : undefined,
      dateFrom: applied.dateFrom || undefined,
      dateTo: applied.dateTo || undefined,
      client: applied.client || undefined,
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

function rememberSearch() {
  const payload: StoredMonitorSearch = {
    sellerId: String(filters.sellerId || ''),
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    client: (filters.client || clientQuery.value).trim(),
    sortKey: sortKey.value,
    sortDir: sortDir.value,
  };
  sessionStorage.setItem(MONITOR_SEARCH_KEY, JSON.stringify(payload));
}

async function load() {
  loading.value = true;
  error.value = null;
  rememberSearch();
  try {
    const res = await http.get<SalesResponse>('/sales', {
      params: {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        sellerId: filters.sellerId || undefined,
        status: filters.status || undefined,
        client: (filters.client || clientQuery.value).trim() || undefined,
        timeZone: getClientTimeZone(),
      },
    });
    data.value = res.data;
    if (res.data.sellers?.length) sellerCatalog.value = res.data.sellers;
    applied.sellerId = filters.sellerId;
    applied.status = filters.status;
    applied.dateFrom = filters.dateFrom;
    applied.dateTo = filters.dateTo;
    applied.client = (filters.client || clientQuery.value).trim();
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudieron cargar las ventas');
  } finally {
    loading.value = false;
  }
}

watch(
  () => [
    filters.sellerId,
    filters.status,
    filters.dateFrom,
    filters.dateTo,
    filters.client,
    clientQuery.value,
    sortKey.value,
    sortDir.value,
  ],
  () => rememberSearch(),
);

onMounted(load);

function statusLabel(status: SaleStatus | string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Pendiente de pago';
    case 'PENDING_SIGNATURE':
      return 'Pendiente de firma';
    case 'PENDING_VALIDATION':
      return 'Pendiente de validación';
    case 'PENDING_CORRECTION':
      return 'Por corregir';
    case 'PENDING_CORRECTION_REVIEW':
      return 'Corrección por validar';
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
    case 'PENDING_VALIDATION':
      return 'status-badge status-badge--validation';
    case 'PENDING_CORRECTION':
      return 'status-badge status-badge--correction';
    case 'PENDING_CORRECTION_REVIEW':
      return 'status-badge status-badge--review';
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
    precioPlan:
      item.precioPlan ||
      form.ubicacionPlan.precioPlan ||
      form.pago.precioPlan,
    descuento: item.promocionDescuento || form.pago.promocionDescuento,
    anticipo: item.anticipo || form.pago.anticipo,
    saldo: item.saldo || form.pago.saldo,
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

async function openDetail(item: SaleListItem) {
  try {
    const sale = await fetchSaleForm(item);
    detailForm.value = mergeSaleForm(sale.payload);
    detailItem.value = sale;
    detailOpen.value = true;
  } catch (e: unknown) {
    await alert({
      title: 'Datos de la venta',
      message: extractApiError(e, 'No se pudo abrir la venta'),
      variant: 'danger',
    });
  }
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
            :value="String(s.id)"
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
          <option value="PENDING_VALIDATION">Pendiente de validación</option>
          <option value="PENDING_CORRECTION">Por corregir</option>
          <option value="PENDING_CORRECTION_REVIEW">Corrección por validar</option>
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
            @keydown.enter.prevent="search"
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
          class="btn btn-primary"
          :disabled="loading"
          @click="search"
        >
          Buscar
        </button>
        <button
          type="button"
          class="btn btn-accent"
          :disabled="exporting || loading || !allItems.length"
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
          {{ allItems.length }} ventas
          <span v-if="!hasActiveFilters" class="muted-inline">
            (última semana)
          </span>
        </p>
        <span class="total">Total: {{ allItems.length }}</span>
      </div>

      <div v-if="!allItems.length" class="empty-state">
        <strong>Sin resultados</strong>
        No hay ventas en ese periodo. Prueba otras fechas o limpia la búsqueda.
      </div>

      <template v-else>
        <div class="table-wrap desktop-list">
          <table class="data sales-table">
            <colgroup>
              <col class="col-fecha" />
              <col class="col-titular" />
              <col class="col-vendedor" />
              <col class="col-vd" />
              <col class="col-folio" />
              <col class="col-estatus" />
              <col class="col-money" />
              <col class="col-desc" />
              <col class="col-money" />
              <col class="col-money" />
              <col class="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th :aria-sort="sortAria('fecha')">
                  <button type="button" class="th-sort" :class="{ 'is-active': sortKey === 'fecha' }" @click="toggleSort('fecha')">
                    Fecha local
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('fecha') }}</span>
                  </button>
                </th>
                <th :aria-sort="sortAria('titular')">
                  <button type="button" class="th-sort" :class="{ 'is-active': sortKey === 'titular' }" @click="toggleSort('titular')">
                    Titular
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('titular') }}</span>
                  </button>
                </th>
                <th :aria-sort="sortAria('vendedor')">
                  <button type="button" class="th-sort" :class="{ 'is-active': sortKey === 'vendedor' }" @click="toggleSort('vendedor')">
                    Vendedor
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('vendedor') }}</span>
                  </button>
                </th>
                <th :aria-sort="sortAria('digital')">
                  <button type="button" class="th-sort" :class="{ 'is-active': sortKey === 'digital' }" @click="toggleSort('digital')">
                    Venta digital
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('digital') }}</span>
                  </button>
                </th>
                <th :aria-sort="sortAria('folio')">
                  <button type="button" class="th-sort" :class="{ 'is-active': sortKey === 'folio' }" @click="toggleSort('folio')">
                    Folio
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('folio') }}</span>
                  </button>
                </th>
                <th :aria-sort="sortAria('estatus')">
                  <button type="button" class="th-sort" :class="{ 'is-active': sortKey === 'estatus' }" @click="toggleSort('estatus')">
                    Estatus
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('estatus') }}</span>
                  </button>
                </th>
                <th class="num" :aria-sort="sortAria('precio')">
                  <button type="button" class="th-sort th-sort--num" :class="{ 'is-active': sortKey === 'precio' }" @click="toggleSort('precio')">
                    Costo del plan
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('precio') }}</span>
                  </button>
                </th>
                <th class="num" :aria-sort="sortAria('descuento')">
                  <button type="button" class="th-sort th-sort--num" :class="{ 'is-active': sortKey === 'descuento' }" @click="toggleSort('descuento')">
                    Descuento
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('descuento') }}</span>
                  </button>
                </th>
                <th class="num" :aria-sort="sortAria('anticipo')">
                  <button type="button" class="th-sort th-sort--num" :class="{ 'is-active': sortKey === 'anticipo' }" @click="toggleSort('anticipo')">
                    Anticipo
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('anticipo') }}</span>
                  </button>
                </th>
                <th class="num" :aria-sort="sortAria('saldo')">
                  <button type="button" class="th-sort th-sort--num" :class="{ 'is-active': sortKey === 'saldo' }" @click="toggleSort('saldo')">
                    Saldo final
                    <span class="th-sort__mark" aria-hidden="true">{{ sortMark('saldo') }}</span>
                  </button>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in sortedItems" :key="item.id">
                <td>{{ formatUtcToLocal(item.createdAt) }}</td>
                <td class="cell-wrap">{{ item.titularName || '—' }}</td>
                <td class="cell-wrap">{{ item.sellerName }}</td>
                <td>{{ digitalSaleFolio(item) || '—' }}</td>
                <td>{{ completedSaleFolio(item) || '—' }}</td>
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
                    title="Acciones"
                    aria-label="Acciones de la venta"
                    @click="openActions(item)"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mobile-list">
          <article
            v-for="item in sortedItems"
            :key="`m-${item.id}`"
            class="sale-card"
          >
            <div class="sale-card__head">
              <strong>{{ item.titularName || 'Sin titular' }}</strong>
              <span :class="statusBadgeClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
              <button
                type="button"
                class="icon-btn sale-card__more"
                title="Acciones"
                aria-label="Acciones de la venta"
                @click="openActions(item)"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                  <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                </svg>
              </button>
            </div>
            <span class="muted">{{ item.sellerName }}</span>
            <span class="muted">{{ formatUtcToLocal(item.createdAt) }}</span>
            <span v-if="digitalSaleFolio(item)" class="muted">
              Venta digital {{ digitalSaleFolio(item) }}
            </span>
            <span v-if="completedSaleFolio(item)" class="muted">
              Folio {{ completedSaleFolio(item) }}
            </span>
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

    <SaleDetailModal
      :open="detailOpen"
      :form="detailForm"
      :sale-id="detailItem?.id ?? null"
      :seller-name="detailItem?.sellerName ?? ''"
      :status="detailItem?.status ?? ''"
      :status-label="detailItem ? statusLabel(detailItem.status) : ''"
      :created-at="detailItem ? formatUtcToLocal(detailItem.createdAt) : ''"
      :contrato="detailItem?.contrato ?? ''"
      @close="detailOpen = false"
    />

    <SalePdfPreviewModal
      :open="previewOpen"
      :form="previewForm"
      :sale-id="previewId"
      :status="previewStatus"
      @close="previewOpen = false"
    />

    <VdModal
      :open="actionsItem != null"
      title="Acciones"
      @close="closeActions"
    >
      <p v-if="actionsItem" class="actions-menu__who">
        {{ actionsItem.titularName || 'Sin titular' }}
        · {{ digitalSaleFolio(actionsItem) }}
      </p>
      <div v-if="actionsItem" class="actions-menu">
        <button type="button" class="actions-menu__item" @click="runSaleAction(openDetail)">
          <span class="actions-menu__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                fill="currentColor"
                d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm6.5 1.5V9H18L13.5 4.5zM8 12h8v1.5H8V12zm0 3h8v1.5H8V15zm0 3h5.5V19.5H8V18z"
              />
            </svg>
          </span>
          Ver datos de la venta
        </button>
        <button type="button" class="actions-menu__item" @click="runSaleAction(openAttachments)">
          <span class="actions-menu__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                fill="currentColor"
                d="M16.5 6.5v10.25a4.25 4.25 0 1 1-8.5 0V5.75a2.75 2.75 0 1 1 5.5 0v10.5a1.25 1.25 0 1 1-2.5 0V7.25h-1.5v9a2.75 2.75 0 1 0 5.5 0V5.75a4.25 4.25 0 1 0-8.5 0v11a5.75 5.75 0 1 0 11.5 0V6.5h-1.5z"
              />
            </svg>
          </span>
          Archivos anexados
        </button>
        <button type="button" class="actions-menu__item" @click="runSaleAction(openPreview)">
          <span class="actions-menu__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                fill="currentColor"
                d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5Z"
              />
            </svg>
          </span>
          Vista previa carátula
        </button>
        <button
          v-if="canRefreshDocuments(actionsItem)"
          type="button"
          class="actions-menu__item"
          :disabled="refreshingId === actionsItem.id"
          @click="runSaleAction(refreshDocuments)"
        >
          <span class="actions-menu__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                fill="currentColor"
                d="M17.65 6.35A7.95 7.95 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8a8 8 0 0 0 7.73-6h-2.08A6 6 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
              />
            </svg>
          </span>
          {{ refreshingId === actionsItem.id ? 'Actualizando…' : 'Actualizar documentos' }}
        </button>
        <button
          v-if="canResendSign(actionsItem)"
          type="button"
          class="actions-menu__item"
          :disabled="resendingSignId === actionsItem.id"
          @click="runSaleAction(resendSignLink)"
        >
          <span class="actions-menu__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                fill="currentColor"
                d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"
              />
            </svg>
          </span>
          {{ resendingSignId === actionsItem.id ? 'Enviando…' : 'Enviar firma de nuevo' }}
        </button>
        <button
          v-if="canSyncSale(actionsItem)"
          type="button"
          class="actions-menu__item"
          :disabled="syncingId === actionsItem.id"
          @click="runSaleAction(syncSale)"
        >
          <span class="actions-menu__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                fill="currentColor"
                d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
              />
            </svg>
          </span>
          {{ syncingId === actionsItem.id ? 'Sincronizando…' : 'Sincronizar' }}
        </button>
      </div>
    </VdModal>
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
  min-width: 1120px;
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

.sales-table .col-vd {
  width: 9%;
}

.sales-table .col-folio {
  width: 9%;
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
  width: 56px;
}

.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
}

.th-sort--num {
  width: 100%;
  justify-content: flex-end;
  text-align: right;
}

.th-sort__mark {
  flex-shrink: 0;
  font-size: 0.72rem;
  opacity: 0.35;
}

.th-sort.is-active .th-sort__mark {
  opacity: 1;
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
  align-items: center;
  overflow: visible;
  white-space: nowrap;
}

.actions-menu__who {
  margin: 0 0 0.75rem;
  color: var(--vd-muted);
  font-size: 0.9rem;
}

.actions-menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.actions-menu__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 52px;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--vd-line);
  border-radius: 12px;
  background: #fff;
  color: var(--gsm-blue);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.actions-menu__icon {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  flex-shrink: 0;
  border-radius: 10px;
  background: #e8f0f4;
  color: var(--gsm-blue);
}

.actions-menu__item:hover:not(:disabled) {
  border-color: var(--gsm-blue);
  background: #f6fafc;
}

.actions-menu__item:disabled {
  opacity: 0.6;
  cursor: default;
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

.sale-card__more {
  margin-left: auto;
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

.status-badge--validation {
  background: rgba(180, 120, 20, 0.14);
  color: #8a5a0a;
}

.status-badge--done {
  background: rgba(47, 111, 78, 0.12);
  color: var(--vd-ok);
}

.status-badge--rejected {
  background: rgba(196, 40, 28, 0.1);
  color: var(--vd-danger);
}

.status-badge--correction {
  background: #eceff1;
  color: #5f6770;
}

.status-badge--review {
  background: rgba(107, 91, 149, 0.14);
  color: #5c4d82;
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

.icon-btn:disabled {
  opacity: 0.55;
  cursor: wait;
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
