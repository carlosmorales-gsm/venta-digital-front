<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { extractApiError, http } from '../../../shared/api/http';
import { formatUtcToLocal } from '../../../shared/utils/datetime';
import { useDialog } from '../../../shared/ui/dialog';
import SalePdfPreviewModal from '../components/SalePdfPreviewModal.vue';
import SalePaymentModal from '../components/SalePaymentModal.vue';
import SaleManualSignModal from '../components/SaleManualSignModal.vue';
import {
  mergeSaleForm,
  type SaleFormData,
  type SaleListItem,
  type SaleStatus,
} from '../types/sale-form';
import { buildSalePreviewPdf } from '../utils/sale-pdf';

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

interface SalesResponse {
  items: SaleListItem[];
  drafts: SaleListItem[];
  submitted: SaleListItem[];
  draftCount: number;
  draftLimit: number;
  total: number;
  message: string;
}

const router = useRouter();
const { alert, confirm } = useDialog();

const loading = ref(true);
const data = ref<SalesResponse | null>(null);
const error = ref<string | null>(null);

const previewOpen = ref(false);
const previewForm = ref<SaleFormData>(mergeSaleForm({}));
const previewId = ref<number | null>(null);
const previewStatus = ref<string | undefined>();

const actionForm = ref<SaleFormData>(mergeSaleForm({}));
const actionSaleId = ref<number | null>(null);

const paymentOpen = ref(false);
const paymentSaving = ref(false);

const signOpen = ref(false);
const signSubmitting = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await http.get<SalesResponse>('/sales/mias');
    data.value = res.data;
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudieron cargar las ventas');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function goNew() {
  if ((data.value?.draftCount ?? 0) >= (data.value?.draftLimit ?? 3)) {
    void alert({
      title: 'Borradores',
      message: `Ya tienes ${data.value?.draftLimit ?? 3} borradores. Elimina o envía uno para crear otra venta.`,
      variant: 'warning',
    });
    return;
  }
  router.push({ name: 'vendedor-venta-nueva' });
}

function editDraft(id: number) {
  router.push({ name: 'vendedor-venta-editar', params: { id: String(id) } });
}

function statusLabel(status: SaleStatus | string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Pendiente de pago';
    case 'PENDING_SIGNATURE':
      return 'Pendiente de firma';
    case 'COMPLETED':
    case 'SUBMITTED':
      return 'Completada';
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
    default:
      return 'status-badge';
  }
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

async function openPayment(item: SaleListItem) {
  try {
    const sale = await fetchSaleForm(item);
    actionForm.value = mergeSaleForm(sale.payload);
    actionSaleId.value = sale.id;
    paymentOpen.value = true;
  } catch (e: unknown) {
    await alert({
      title: 'Pago',
      message: extractApiError(e, 'No se pudo abrir la venta'),
      variant: 'danger',
    });
  }
}

async function savePayment(pago: SaleFormData['pago']) {
  if (!actionSaleId.value) return;
  paymentSaving.value = true;
  try {
    await http.patch(`/sales/${actionSaleId.value}/payment`, { pago });
    paymentOpen.value = false;
    await alert({
      title: 'Pago registrado',
      message: 'El pago se guardó correctamente.',
      variant: 'success',
    });
    await load();
  } catch (e: unknown) {
    await alert({
      title: 'Pago',
      message: extractApiError(e, 'No se pudo guardar el pago'),
      variant: 'danger',
    });
  } finally {
    paymentSaving.value = false;
  }
}

async function openSign(item: SaleListItem) {
  try {
    const sale = await fetchSaleForm(item);
    actionForm.value = mergeSaleForm(sale.payload);
    actionSaleId.value = sale.id;
    signOpen.value = true;
  } catch (e: unknown) {
    await alert({
      title: 'Firma',
      message: extractApiError(e, 'No se pudo abrir la venta'),
      variant: 'danger',
    });
  }
}

async function confirmSign(dataUrl: string) {
  if (!actionSaleId.value) return;
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl;
  signSubmitting.value = true;
  try {
    const firmaCliente = {
      name: 'firma-cliente.png',
      mime: 'image/png',
      dataBase64: base64,
    };

    // PDF con firma incluida → se sube a Drive junto con los demás docs.
    const formForPdf = mergeSaleForm({
      ...actionForm.value,
      documentos: {
        ...actionForm.value.documentos,
        firmaCliente,
      },
    });
    let caratulaPdf:
      | { name: string; mime: string; dataBase64: string }
      | undefined;
    try {
      const blob = await buildSalePreviewPdf(formForPdf, {
        saleId: actionSaleId.value,
        status: 'COMPLETED',
      });
      caratulaPdf = {
        name: `caratula-contrato_venta-${actionSaleId.value}.pdf`,
        mime: 'application/pdf',
        dataBase64: await blobToBase64(blob),
      };
    } catch (pdfErr) {
      console.warn('No se pudo generar carátula para Drive', pdfErr);
    }

    await http.post(`/sales/${actionSaleId.value}/sign`, {
      firmaCliente,
      ...(caratulaPdf ? { caratulaPdf } : {}),
    });
    signOpen.value = false;
    await alert({
      title: 'Firma registrada',
      message: caratulaPdf
        ? 'La firma y la vista previa del contrato se guardaron (incluye Drive).'
        : 'La firma se guardó correctamente.',
      variant: 'success',
    });
    await load();
  } catch (e: unknown) {
    await alert({
      title: 'Firma',
      message: extractApiError(e, 'No se pudo registrar la firma'),
      variant: 'danger',
    });
  } finally {
    signSubmitting.value = false;
  }
}

async function removeDraft(id: number) {
  const ok = await confirm({
    title: 'Eliminar borrador',
    message: '¿Seguro que deseas eliminar este borrador?',
    variant: 'danger',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
  });
  if (!ok) return;
  try {
    await http.delete(`/sales/${id}`);
    await load();
  } catch (e: unknown) {
    await alert({
      title: 'Borrador',
      message: extractApiError(e, 'No se pudo eliminar'),
      variant: 'danger',
    });
  }
}
</script>

<template>
  <section class="sales-page">
    <header class="page-head head-row">
      <div>
        <h1>Mis ventas</h1>
        <p>Borradores, pagos, firmas y ventas en proceso.</p>
      </div>
      <button type="button" class="btn btn-primary" @click="goNew">
        Nueva venta
      </button>
    </header>

    <div v-if="loading" class="panel loading">
      <span class="spinner" />
      Cargando…
    </div>

    <div v-else-if="error" class="panel">
      <p class="error-text">{{ error }}</p>
    </div>

    <template v-else>
      <div v-if="data?.drafts?.length" class="panel">
        <div class="section-head">
          <h2>Borradores</h2>
          <span class="muted">
            {{ data.draftCount }} / {{ data.draftLimit }}
          </span>
        </div>
        <ul class="card-list">
          <li v-for="d in data.drafts" :key="d.id" class="sale-card">
            <div class="sale-card__main">
              <strong>{{ d.titularName || 'Sin titular' }}</strong>
              <span class="muted">
                Caduca {{ formatUtcToLocal(d.draftExpiresAt) }}
              </span>
            </div>
            <div class="sale-card__actions">
              <button
                type="button"
                class="icon-btn"
                title="Ver"
                aria-label="Ver"
                @click="openPreview(d)"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5Z"
                  />
                </svg>
              </button>
              <button type="button" class="btn btn-ghost btn-sm" @click="editDraft(d.id)">
                Continuar
              </button>
              <button type="button" class="btn btn-ghost btn-sm" @click="removeDraft(d.id)">
                Eliminar
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="panel">
        <div class="section-head">
          <h2>En proceso</h2>
          <span class="muted">{{ data?.submitted?.length ?? 0 }}</span>
        </div>

        <div v-if="!data?.submitted?.length" class="empty-state">
          <strong>Aún no hay ventas en proceso</strong>
          Usa <em>Nueva venta</em> para capturar la carátula.
        </div>

        <ul v-else class="card-list">
          <li v-for="item in data.submitted" :key="item.id" class="sale-card">
            <div class="sale-card__main">
              <div class="sale-card__title">
                <strong>#{{ item.id }} · {{ item.titularName || 'Sin titular' }}</strong>
                <span :class="statusBadgeClass(item.status)">
                  <svg
                    v-if="item.status === 'COMPLETED' || item.status === 'SUBMITTED'"
                    class="status-badge__icon"
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.5 8l-1.4-1.4z"
                    />
                  </svg>
                  {{ statusLabel(item.status) }}
                </span>
              </div>
              <span class="muted">
                {{ formatUtcToLocal(item.createdAt) }}
                <template v-if="item.amount">
                  · ${{ item.amount.toLocaleString('es-MX') }}
                </template>
              </span>
            </div>
            <div class="sale-card__actions">
              <button
                v-if="item.status === 'PENDING_PAYMENT'"
                type="button"
                class="icon-btn icon-btn--payment"
                title="Registrar pago"
                aria-label="Registrar pago"
                @click="openPayment(item)"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H15.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.8 1.95 2.37.62 4.05 1.67 4.05 3.83 0 1.84-1.38 2.94-3.12 3.3z"
                  />
                </svg>
              </button>
              <button
                v-if="item.status === 'PENDING_SIGNATURE'"
                type="button"
                class="icon-btn icon-btn--sign"
                title="Firmar"
                aria-label="Firmar"
                @click="openSign(item)"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn"
                title="Ver"
                aria-label="Ver venta"
                @click="openPreview(item)"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5Z"
                  />
                </svg>
              </button>
            </div>
          </li>
        </ul>
      </div>
    </template>

    <SalePdfPreviewModal
      :open="previewOpen"
      :form="previewForm"
      :sale-id="previewId"
      :status="previewStatus"
      @close="previewOpen = false"
    />

    <SalePaymentModal
      :open="paymentOpen"
      :form="actionForm"
      :saving="paymentSaving"
      @close="paymentOpen = false"
      @save="savePayment"
    />

    <SaleManualSignModal
      :open="signOpen"
      :form="actionForm"
      :submitting="signSubmitting"
      @close="signOpen = false"
      @confirm="confirmSign"
    />
  </section>
</template>

<style scoped>
.sales-page {
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
}

.head-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.head-row .btn {
  flex-shrink: 0;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--vd-muted);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.75rem;
}

.section-head h2 {
  margin: 0;
  font-size: 1.15rem;
  color: var(--gsm-blue);
}

.muted {
  color: var(--vd-muted);
  font-size: 0.88rem;
}

.card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.sale-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--vd-line);
  border-radius: 12px;
  background: var(--vd-surface-2);
}

.sale-card__main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.sale-card__main strong {
  color: var(--vd-ink);
}

.sale-card__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.sale-card__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
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

.status-badge__icon {
  flex-shrink: 0;
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

.icon-btn {
  border: 1px solid var(--vd-line);
  background: #fff;
  color: var(--gsm-blue);
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.icon-btn:hover {
  border-color: var(--gsm-blue);
  background: rgba(53, 100, 125, 0.06);
}

.icon-btn--payment {
  color: #9a6410;
}

.icon-btn--payment:hover {
  border-color: #9a6410;
  background: rgba(180, 120, 20, 0.08);
}

.icon-btn--sign {
  color: var(--gsm-blue);
}

.btn-sm {
  min-height: 40px;
  padding: 0.35rem 0.7rem;
  font-size: 0.85rem;
}

@media (max-width: 600px) {
  .head-row {
    flex-direction: column;
    align-items: stretch;
  }

  .head-row .btn {
    width: 100%;
    min-height: 48px;
  }

  .sale-card {
    flex-direction: column;
    align-items: stretch;
  }

  .sale-card__actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .sale-card__actions .btn {
    flex: 1;
    min-height: 44px;
  }
}
</style>
