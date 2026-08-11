<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { extractApiError, http } from '../../../shared/api/http';
import { useDialog } from '../../../shared/ui/dialog';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import SalePdfPreviewModal from '../components/SalePdfPreviewModal.vue';
import SalePlanSearchModal, {
  type PlanProduct,
} from '../components/SalePlanSearchModal.vue';
import SaleLocationSearchModal, {
  type ParkLocationSelection,
} from '../components/SaleLocationSearchModal.vue';
import { SALE_ORIGIN_OPTIONS } from '../constants/sale-origins';
import {
  createPrefillSaleForm,
  emptyBeneficiary,
  mergeSaleForm,
  syncBeneficiariosToDerechos,
  titularDisplayName,
  type ReuseGroup,
  type SaleFormData,
  type SaleListItem,
  type SaleStatus,
} from '../types/sale-form';
import { isValidCurp } from '../utils/curp';
import { pickRandomDevSaleMock } from '../utils/dev-sale-mocks';
import { computeSaldo, parseDiscountPct, parseMoney } from '../utils/sale-finance';
import { fileToAttachment } from '../utils/file-to-attachment';
import { useAuthStore } from '../../auth/stores/auth.store';

const isDev = import.meta.env.DEV;
const auth = useAuthStore();
const sellerAsesorName = computed(() => auth.user?.fullName?.trim() || '');

const STEPS = [
  { key: 'meta', title: 'Contrato', short: 'Contrato' },
  { key: 'titular', title: 'Titular', short: 'Titular' },
  { key: 'beneficiarios', title: 'Beneficiarios', short: 'Benef.' },
  { key: 'segundo', title: '2.º contacto', short: '2.º cont.' },
  { key: 'plan', title: 'Plan', short: 'Plan' },
  { key: 'docs', title: 'Documentos', short: 'Docs' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];
type InnerTab = 'personales' | 'domicilio';
type PlanInnerTab = 'plan' | 'financiamiento';

const route = useRoute();
const router = useRouter();
const { alert, confirm } = useDialog();

const form = reactive<SaleFormData>(createPrefillSaleForm());
const step = ref(0);
const saleId = ref<number | null>(null);
const status = ref<SaleStatus | 'NEW'>('NEW');
const saving = ref(false);
const submitting = ref(false);
const loading = ref(false);
const previewOpen = ref(false);
const reuseOpen = ref(false);
const devPrefillOpen = ref(false);
const devPrefillSteps = reactive({
  meta: true,
  titular: true,
  beneficiarios: true,
  segundo: true,
  plan: true,
  docs: true,
});
const references = ref<SaleListItem[]>([]);
const reuseGroups = reactive<Record<ReuseGroup, boolean>>({
  contacto: true,
  segundoContacto: true,
  beneficiarios: true,
});
const selectedRefId = ref<number | null>(null);
const draftLimit = ref(3);
const draftTtlHours = ref(24);
const allowedDiscountMax = ref(0);
const maxDiscountAmount = ref(0);
const descuentoEspecial = ref(0);

const titularInnerTab = ref<InnerTab>('personales');
const segundoInnerTab = ref<InnerTab>('personales');
const planInnerTab = ref<PlanInnerTab>('plan');
const formOpen = ref(false);

const stepTitle = computed(() => STEPS[step.value]?.title ?? '');
const canEdit = computed(
  () => status.value === 'NEW' || status.value === 'DRAFT',
);
const isParque = computed(
  () => form.ubicacionPlan.planKind === 'PARQUE',
);
const isPlanFuturo = computed(
  () => form.ubicacionPlan.planKind === 'PLAN_FUTURO',
);

const planSearchOpen = ref(false);
const locationSearchOpen = ref(false);

function clearParkLocation() {
  const plan = form.ubicacionPlan;
  plan.parqueFuneral = '';
  plan.seccion = '';
  plan.cuadrante = '';
  plan.numero = '';
  plan.parkId = null;
  plan.sectionId = null;
  plan.quadrantId = null;
  plan.spaceId = null;
}

/** Al cambiar tipo de plan se limpia el plan Odoo y la ubicación. */
function onPlanKindChange() {
  const plan = form.ubicacionPlan;
  plan.nombrePlan = '';
  plan.productId = null;
  plan.productDefaultCode = '';
  plan.precioPlan = '';
  if (plan.planKind !== 'PARQUE') {
    plan.preasignacion = false;
    clearParkLocation();
  } else {
    plan.servicioFunerario = '';
  }
}

function onPreasignacionChange() {
  if (!form.ubicacionPlan.preasignacion) clearParkLocation();
}

function onPlanSelected(plan: PlanProduct) {
  const dest = form.ubicacionPlan;
  dest.nombrePlan = plan.name;
  dest.productId = plan.id;
  dest.productDefaultCode = plan.defaultCode ?? '';
  const price = plan.listPrice > 0 ? String(plan.listPrice) : '';
  dest.precioPlan = price;
  if (price) form.pago.precioPlan = price;
  recomputeSaldo();
  planSearchOpen.value = false;
}

function formatMoneyLabel(raw: string) {
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n) || !String(raw).trim()) return '—';
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

function recomputeSaldo() {
  const precio = form.ubicacionPlan.precioPlan || form.pago.precioPlan;
  form.pago.saldo = computeSaldo(
    precio,
    form.pago.promocionDescuento,
    form.pago.anticipo,
  );
}

function clampDescuento() {
  let pct = parseDiscountPct(form.pago.promocionDescuento);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  if (allowedDiscountMax.value > 0 && pct > allowedDiscountMax.value) {
    pct = Math.trunc(allowedDiscountMax.value);
  }
  form.pago.promocionDescuento = pct > 0 ? String(pct) : '';
  recomputeSaldo();
}

function discountError(): string | null {
  const pct = parseDiscountPct(form.pago.promocionDescuento);
  if (pct < 0) return 'El descuento no puede ser negativo.';
  if (pct > 100) return 'El descuento no puede ser mayor a 100%.';
  if (pct > allowedDiscountMax.value + 0.001) {
    return `El descuento no puede exceder ${allowedDiscountMax.value}%.`;
  }
  return null;
}

watch(
  [
    () => form.ubicacionPlan.precioPlan,
    () => form.pago.precioPlan,
    () => form.pago.promocionDescuento,
    () => form.pago.anticipo,
  ],
  () => {
    recomputeSaldo();
  },
);

function onLocationSelected(loc: ParkLocationSelection) {
  const dest = form.ubicacionPlan;
  dest.parkId = loc.parkId;
  dest.parqueFuneral = loc.parkName;
  dest.sectionId = loc.sectionId;
  dest.seccion = loc.sectionName;
  dest.quadrantId = loc.quadrantId;
  dest.cuadrante = loc.quadrantName;
  dest.spaceId = loc.spaceId;
  dest.numero = loc.spaceName;
  locationSearchOpen.value = false;
}

function hasText(v?: string | null) {
  return Boolean(v && String(v).trim());
}

function firstBeneficiaryHasName(): boolean {
  const b = form.beneficiarios[0];
  if (!b) return false;
  return Boolean(
    b.nombres.trim() ||
      b.apellidoPaterno.trim() ||
      b.apellidoMaterno.trim(),
  );
}

/** Completitud por sección (check en el menú de pasos). */
const stepComplete = computed<Record<StepKey, boolean>>(() => {
  const c = form.contacto;
  const sc = form.segundoContacto;
  const plan = form.ubicacionPlan;
  const pago = form.pago;
  const parkOk =
    plan.planKind !== 'PARQUE' ||
    !plan.preasignacion ||
    Boolean(
      plan.parkId &&
        plan.sectionId &&
        plan.quadrantId &&
        plan.spaceId,
    );
  const precioOk = parseMoney(plan.precioPlan || pago.precioPlan) > 0;
  const finOk =
    hasText(pago.frecuencia) &&
    hasText(pago.plazo) &&
    hasText(pago.fechaProximoPago) &&
    hasText(pago.anticipo);
  const descOk = discountError() === null;

  return {
    meta: hasText(form.meta.fecha) && hasText(form.meta.origenVenta),
    titular:
      hasText(c.nombres) &&
      hasText(c.apellidoPaterno) &&
      isValidCurp(c.curp) &&
      hasText(c.fechaNacimiento) &&
      hasText(c.sexo) &&
      hasText(c.direccion) &&
      hasText(c.colonia) &&
      hasText(c.municipio) &&
      hasText(c.estado),
    beneficiarios: firstBeneficiaryHasName(),
    segundo:
      hasText(sc.nombres) &&
      hasText(sc.apellidoPaterno) &&
      hasText(sc.celular),
    plan:
      Boolean(plan.productId) &&
      parkOk &&
      (plan.planKind !== 'PLAN_FUTURO' || hasText(plan.servicioFunerario)) &&
      precioOk &&
      finOk &&
      descOk,
    docs:
      Boolean(form.documentos.ine) &&
      Boolean(form.documentos.comprobanteDomicilio) &&
      hasText(form.declaraciones.aceptaMercadotecnia) &&
      hasText(form.declaraciones.aceptaPublicidad),
  };
});

const stepsMenu = computed(() =>
  STEPS.map((s, index) => ({
    ...s,
    index,
    complete: stepComplete.value[s.key],
    statusLabel: stepComplete.value[s.key] ? 'Completo' : 'Pendiente',
  })),
);

const completedCount = computed(
  () => stepsMenu.value.filter((s) => s.complete).length,
);
const progress = computed(
  () => (completedCount.value / STEPS.length) * 100,
);

/** Mínimo para poder guardar borrador. */
const canSaveDraft = computed(() => {
  const c = form.contacto;
  if (!hasText(c.nombres) || !hasText(c.apellidoPaterno)) return false;
  if (hasText(c.curp) && !isValidCurp(c.curp)) return false;
  return true;
});

/** Todos los pasos listos → se puede guardar como venta (flujo de pago/firma). */
const allStepsComplete = computed(() =>
  STEPS.every((s) => stepComplete.value[s.key]),
);

const firstIncompleteStep = computed(() =>
  stepsMenu.value.find((s) => !s.complete)?.index ?? null,
);

function openStep(index: number) {
  if (index < 0 || index >= STEPS.length) return;
  step.value = index;
  if (index === 1) titularInnerTab.value = 'personales';
  if (index === 3) segundoInnerTab.value = 'personales';
  if (index === 4) planInnerTab.value = 'plan';
  formOpen.value = true;
}

function closeStepForm() {
  formOpen.value = false;
}

function syncNombreAsesor() {
  if (sellerAsesorName.value) {
    form.pago.nombreAsesor = sellerAsesorName.value;
  }
}

function payloadMeta() {
  syncNombreAsesor();
  // Mantener compat PDF local; el API solo acepta beneficiarios.
  syncBeneficiariosToDerechos(form);
  const { derechohabientes: _omit, ...payload } = form;
  return {
    payload,
    titularName: titularDisplayName(form),
    amount: form.pago.precioPlan || '0',
  };
}

function ensureBeneficiarios() {
  if (!form.beneficiarios.length) {
    form.beneficiarios.push(emptyBeneficiary());
  }
}

function validateCurpIfPresent(): string | null {
  const curp = form.contacto.curp?.trim() ?? '';
  if (!curp) return null;
  if (!isValidCurp(curp)) {
    return 'La CURP no es válida. Verifica el formato de 18 caracteres.';
  }
  return null;
}

async function loadDraftPolicy() {
  try {
    const { data } = await http.get<{
      draftLimit: number;
      draftTtlHours: number;
      maxDiscountAmount?: number;
      descuentoEspecial?: number;
      allowedDiscountMax?: number;
    }>('/settings/drafts');
    draftLimit.value = data.draftLimit;
    draftTtlHours.value = data.draftTtlHours;
    maxDiscountAmount.value = Number(data.maxDiscountAmount) || 0;
    descuentoEspecial.value = Number(data.descuentoEspecial) || 0;
    allowedDiscountMax.value =
      Number(data.allowedDiscountMax) ||
      Math.max(maxDiscountAmount.value, descuentoEspecial.value);
    applyDescuentoEspecialDefault();
  } catch {
    if (isDev) allowedDiscountMax.value = 100;
  }
}

/** Si hay descuento especial activo, mostrarlo y prellenar si aún no hay % capturado. */
function applyDescuentoEspecialDefault() {
  if (descuentoEspecial.value <= 0 || !canEdit.value) return;
  const current = parseDiscountPct(form.pago.promocionDescuento);
  if (current > 0) return;
  form.pago.promocionDescuento = String(Math.trunc(descuentoEspecial.value));
  recomputeSaldo();
}

async function loadSale(id: number) {
  loading.value = true;
  try {
    const { data } = await http.get<SaleListItem>(`/sales/${id}`);
    saleId.value = data.id;
    status.value = data.status;
    Object.assign(form, mergeSaleForm(data.payload));
    ensureBeneficiarios();
    clampDescuento();
    recomputeSaldo();
    syncNombreAsesor();
  } catch (e: unknown) {
    await alert({
      title: 'Venta',
      message: extractApiError(e, 'No se pudo cargar la venta'),
      variant: 'danger',
    });
    router.replace({ name: 'vendedor-ventas' });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  void loadDraftPolicy();
  const idParam = route.params.id;
  if (idParam && idParam !== 'nueva') {
    await loadSale(Number(idParam));
  } else {
    ensureBeneficiarios();
  }
  syncNombreAsesor();
});

function addBeneficiario() {
  if (!canEdit.value) return;
  if (form.beneficiarios.length >= 2) return;
  form.beneficiarios.push(emptyBeneficiary());
}

function removeBeneficiario(index: number) {
  if (!canEdit.value) return;
  if (index !== 1) return;
  if (form.beneficiarios.length < 2) return;
  form.beneficiarios.splice(1, 1);
}

async function saveDraft() {
  if (!canEdit.value) return;

  if (!canSaveDraft.value) {
    await alert({
      title: 'Datos básicos',
      message:
        'Para guardar el borrador captura al menos nombre y apellido paterno del titular. Si capturas CURP, debe ser válida.',
      variant: 'warning',
    });
    openStep(1);
    titularInnerTab.value = 'personales';
    return;
  }

  const curpError = validateCurpIfPresent();
  if (curpError) {
    await alert({
      title: 'CURP',
      message: curpError,
      variant: 'warning',
    });
    openStep(1);
    titularInnerTab.value = 'personales';
    return;
  }

  recomputeSaldo();
  const descErr = discountError();
  if (descErr) {
    await alert({
      title: 'Descuento',
      message: descErr,
      variant: 'warning',
    });
    openStep(4);
    planInnerTab.value = 'financiamiento';
    return;
  }

  saving.value = true;
  try {
    const body = payloadMeta();
    if (saleId.value) {
      const { data } = await http.patch<SaleListItem>(
        `/sales/${saleId.value}/draft`,
        body,
      );
      saleId.value = data.id;
      status.value = 'DRAFT';
    } else {
      const { data } = await http.post<SaleListItem>('/sales/drafts', body);
      saleId.value = data.id;
      status.value = 'DRAFT';
      await router.replace({
        name: 'vendedor-venta-editar',
        params: { id: String(data.id) },
      });
    }
    await alert({
      title: 'Borrador',
      message: `Guardado. Caduca en ${draftTtlHours.value} h (máx. ${draftLimit.value} borradores).`,
      variant: 'success',
    });
  } catch (e: unknown) {
    await alert({
      title: 'Borrador',
      message: extractApiError(e, 'No se pudo guardar el borrador'),
      variant: 'danger',
    });
  } finally {
    saving.value = false;
  }
}

async function finalizeSale() {
  if (!canEdit.value) return;

  if (!allStepsComplete.value) {
    const idx = firstIncompleteStep.value ?? 0;
    await alert({
      title: 'Faltan datos',
      message: `Completa el paso "${STEPS[idx]?.title}" antes de guardar la venta.`,
      variant: 'warning',
    });
    openStep(idx);
    return;
  }

  const curp = form.contacto.curp?.trim() ?? '';
  if (!curp || !isValidCurp(curp)) {
    await alert({
      title: 'CURP',
      message: 'La CURP del titular es obligatoria y debe ser válida.',
      variant: 'warning',
    });
    openStep(1);
    titularInnerTab.value = 'personales';
    return;
  }

  recomputeSaldo();
  const descErr = discountError();
  if (descErr) {
    await alert({
      title: 'Descuento',
      message: descErr,
      variant: 'warning',
    });
    openStep(4);
    planInnerTab.value = 'financiamiento';
    return;
  }

  const ok = await confirm({
    title: 'Guardar venta',
    message:
      '¿Confirmas que todos los datos están correctos? La venta pasará a pendiente de pago.',
    variant: 'warning',
    confirmText: 'Guardar venta',
    cancelText: 'Seguir editando',
  });
  if (!ok) return;

  submitting.value = true;
  try {
    const body = payloadMeta();
    const { data } = saleId.value
      ? await http.post<SaleListItem>(`/sales/${saleId.value}/finalize`, body)
      : await http.post<SaleListItem>('/sales/finalize', body);
    status.value = data.status;
    saleId.value = data.id;
    await alert({
      title: 'Venta guardada',
      message: `Venta #${data.id} lista. Continúa con el pago en Mis ventas.`,
      variant: 'success',
    });
    router.replace({ name: 'vendedor-ventas' });
  } catch (e: unknown) {
    await alert({
      title: 'Guardar venta',
      message: extractApiError(e, 'No se pudo guardar la venta'),
      variant: 'danger',
    });
  } finally {
    submitting.value = false;
  }
}

async function openReuse() {
  try {
    const { data } = await http.get<SaleListItem[]>('/sales/referencias');
    references.value = data;
    selectedRefId.value = data[0]?.id ?? null;
    reuseOpen.value = true;
  } catch (e: unknown) {
    await alert({
      title: 'Cotización',
      message: extractApiError(e, 'No se pudieron cargar referencias'),
      variant: 'danger',
    });
  }
}

function applyReuse() {
  const ref = references.value.find(
    (r) => r.id === Number(selectedRefId.value),
  );
  if (!ref) return;
  const src = mergeSaleForm(ref.payload);
  if (reuseGroups.contacto) Object.assign(form.contacto, src.contacto);
  if (reuseGroups.segundoContacto) {
    Object.assign(form.segundoContacto, src.segundoContacto);
  }
  if (reuseGroups.beneficiarios) {
    form.beneficiarios.splice(
      0,
      form.beneficiarios.length,
      ...src.beneficiarios.map((b) => ({ ...emptyBeneficiary(), ...b })),
    );
    ensureBeneficiarios();
    syncBeneficiariosToDerechos(form);
  }
  reuseOpen.value = false;
}

function openDevPrefill() {
  if (!isDev || !canEdit.value) return;
  devPrefillOpen.value = true;
}

function toggleAllDevPrefill(on: boolean) {
  for (const key of Object.keys(devPrefillSteps) as Array<
    keyof typeof devPrefillSteps
  >) {
    devPrefillSteps[key] = on;
  }
}

async function applyDevPrefill() {
  if (!isDev || !canEdit.value) return;
  const selected = STEPS.filter((s) => devPrefillSteps[s.key]);
  if (!selected.length) {
    await alert({
      title: 'Prellenar (dev)',
      message: 'Marca al menos un paso para rellenar.',
      variant: 'warning',
    });
    return;
  }

  const { label, form: mock } = pickRandomDevSaleMock();
  if (devPrefillSteps.meta) Object.assign(form.meta, mock.meta);
  if (devPrefillSteps.titular) Object.assign(form.contacto, mock.contacto);
  if (devPrefillSteps.beneficiarios) {
    form.beneficiarios.splice(
      0,
      form.beneficiarios.length,
      ...mock.beneficiarios.map((b) => ({ ...emptyBeneficiary(), ...b })),
    );
    ensureBeneficiarios();
    syncBeneficiariosToDerechos(form);
  }
  if (devPrefillSteps.segundo) {
    Object.assign(form.segundoContacto, mock.segundoContacto);
  }
  if (devPrefillSteps.plan) {
    Object.assign(form.ubicacionPlan, mock.ubicacionPlan);
    Object.assign(form.pago, mock.pago);
    clampDescuento();
    recomputeSaldo();
  }
  if (devPrefillSteps.docs) {
    form.documentos.ine = mock.documentos.ine;
    form.documentos.comprobanteDomicilio = mock.documentos.comprobanteDomicilio;
    Object.assign(form.declaraciones, mock.declaraciones);
  }

  devPrefillOpen.value = false;
  await alert({
    title: 'Prellenar (dev)',
    message: `Mock: ${label}. Pasos: ${selected.map((s) => s.short).join(', ')}.`,
    variant: 'success',
  });
}

async function onFile(
  kind: 'ine' | 'comprobanteDomicilio',
  ev: Event,
) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    form.documentos[kind] = await fileToAttachment(file);
  } catch (e: unknown) {
    await alert({
      title: 'Archivo',
      message: e instanceof Error ? e.message : 'Archivo no válido',
      variant: 'warning',
    });
  } finally {
    input.value = '';
  }
}

function clearFile(kind: 'ine' | 'comprobanteDomicilio') {
  if (!canEdit.value) return;
  form.documentos[kind] = null;
}

function fileKindLabel(mime?: string) {
  if (!mime) return 'Archivo';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.startsWith('image/')) return 'Imagen';
  return 'Archivo';
}

async function goBack() {
  if (!canEdit.value) {
    router.push({ name: 'vendedor-ventas' });
    return;
  }
  const ok = await confirm({
    title: 'Salir',
    message: '¿Deseas salir? Puedes guardar borrador antes.',
    variant: 'warning',
    confirmText: 'Salir',
    cancelText: 'Quedarme',
  });
  if (ok) router.push({ name: 'vendedor-ventas' });
}
</script>

<template>
  <section class="capture">
    <header class="capture__head">
      <div class="capture__titles">
        <button type="button" class="link-back" @click="goBack">
          ← Mis ventas
        </button>
        <h1>{{ canEdit ? 'Nueva venta' : 'Venta' }}</h1>
        <p class="capture__meta">
          {{ stepTitle }} · {{ completedCount }}/{{ STEPS.length }} secciones
          completas
        </p>
      </div>
      <div class="capture__head-actions">
        <div class="capture__head-actions-row">
          <button
            v-if="canEdit"
            type="button"
            class="btn btn-ghost btn-compact"
            @click="openReuse"
          >
            Cotización
          </button>
          <button
            type="button"
            class="btn btn-accent btn-compact"
            @click="previewOpen = true"
          >
            Vista previa
          </button>
        </div>
        <div v-if="isDev" class="capture__head-actions-row">
          <button
            v-if="canEdit"
            type="button"
            class="btn btn-ghost btn-compact"
            title="Elige qué pasos rellenar con un mock al azar"
            @click="openDevPrefill"
          >
            Prellenar (dev)
          </button>
          <button
            type="button"
            class="icon-btn"
            title="Credencial (próximamente)"
            aria-label="Credencial (próximamente)"
            disabled
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13zM6 8.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0zM6.5 14h4a.75.75 0 0 0 0-1.5h-4a.75.75 0 0 0 0 1.5zm0 2.75h3a.75.75 0 0 0 0-1.5h-3a.75.75 0 0 0 0 1.5zM13 9.25h4.5a.75.75 0 0 0 0-1.5H13a.75.75 0 0 0 0 1.5zm0 3h4.5a.75.75 0 0 0 0-1.5H13a.75.75 0 0 0 0 1.5zm0 3h3a.75.75 0 0 0 0-1.5H13a.75.75 0 0 0 0 1.5z"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="progress" aria-hidden="true">
      <div class="progress__bar" :style="{ width: `${progress}%` }" />
    </div>

    <div v-if="loading" class="panel loading">
      <span class="spinner" />
      Cargando…
    </div>

    <nav v-else class="panel step-list" aria-label="Pasos de la venta">
      <header class="step-list__head">
        <h2>Pasos de la venta</h2>
        <p>Toca un paso para capturar o revisar su información.</p>
      </header>
      <ol class="step-list__items">
        <li v-for="s in stepsMenu" :key="s.key">
          <button
            type="button"
            class="step-row"
            :class="{ complete: s.complete }"
            @click="openStep(s.index)"
          >
            <span class="step-row__mark" aria-hidden="true">
              <svg v-if="s.complete" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <template v-else>{{ s.index + 1 }}</template>
            </span>
            <span class="step-row__body">
              <strong>{{ s.title }}</strong>
              <small>{{ s.statusLabel }}</small>
            </span>
            <span class="step-row__chevron" aria-hidden="true">›</span>
          </button>
        </li>
      </ol>
    </nav>

    <VdModal
      :open="formOpen"
      :title="stepTitle"
      xlarge
      @close="closeStepForm"
    >
      <form class="form-panel form-panel--modal" @submit.prevent>
      <!-- 0 · Contrato -->
      <div v-show="step === 0" class="fields">
        <label>
          Fecha
          <input v-model="form.meta.fecha" type="date" :disabled="!canEdit" />
        </label>
        <label>
          Contrato
          <input v-model="form.meta.contrato" :disabled="!canEdit" />
        </label>
        <label>
          Origen de venta
          <select v-model="form.meta.origenVenta" :disabled="!canEdit">
            <option value="">Selecciona origen…</option>
            <option
              v-for="opt in SALE_ORIGIN_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </label>
        <label>
          Folio de solicitud
          <input v-model="form.meta.folioSolicitud" :disabled="!canEdit" />
        </label>
        <label>
          Fecha de servicio
          <input
            v-model="form.meta.fechaServicio"
            type="date"
            :disabled="!canEdit"
          />
        </label>
        <label>
          Estatus
          <select v-model="form.meta.estatus" :disabled="!canEdit">
            <option value="ACTIVO">Activo</option>
            <option value="MEJORA">Mejora</option>
            <option value="MINORIA">Minoría</option>
            <option value="REACTIVACION">Reactivación</option>
          </select>
        </label>
        <label>
          Anterior
          <input v-model="form.meta.anterior" :disabled="!canEdit" />
        </label>
        <label>
          Verificación
          <input v-model="form.meta.verificacion" :disabled="!canEdit" />
        </label>
      </div>

      <!-- 1 · Titular -->
      <div v-show="step === 1" class="titular-step">
        <div class="tabs" role="tablist" aria-label="Datos del titular">
          <button
            type="button"
            class="tab"
            :class="{ active: titularInnerTab === 'personales' }"
            @click="titularInnerTab = 'personales'"
          >
            Datos personales
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: titularInnerTab === 'domicilio' }"
            @click="titularInnerTab = 'domicilio'"
          >
            Domicilio
          </button>
        </div>

        <div v-show="titularInnerTab === 'personales'" class="fields">
          <p class="hint span-2">Identidad</p>
          <label class="span-2">
            Nombre(s)
            <input v-model="form.contacto.nombres" :disabled="!canEdit" />
          </label>
          <div class="field-row">
            <label>
              Apellido paterno
              <input
                v-model="form.contacto.apellidoPaterno"
                :disabled="!canEdit"
              />
            </label>
            <label>
              Apellido materno
              <input
                v-model="form.contacto.apellidoMaterno"
                :disabled="!canEdit"
              />
            </label>
          </div>
          <label class="span-2">
            CURP
            <input
              v-model="form.contacto.curp"
              maxlength="18"
              autocomplete="off"
              :disabled="!canEdit"
            />
          </label>
          <div class="field-row">
            <label>
              Fecha de nacimiento
              <input
                v-model="form.contacto.fechaNacimiento"
                type="date"
                :disabled="!canEdit"
              />
            </label>
            <label>
              Sexo
              <select v-model="form.contacto.sexo" :disabled="!canEdit">
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>
          </div>
          <label class="span-2">
            Estado civil
            <select v-model="form.contacto.estadoCivil" :disabled="!canEdit">
              <option value="">—</option>
              <option>SOLTERO</option>
              <option>CASADO</option>
              <option>VIUDO</option>
              <option>DIVORCIADO</option>
              <option>UNION LIBRE</option>
              <option>CONCUBINATO</option>
            </select>
          </label>

          <p class="hint span-2 section-gap">Contacto</p>
          <div class="field-row">
            <label>
              Celular 1
              <input
                v-model="form.contacto.celular1"
                inputmode="tel"
                :disabled="!canEdit"
              />
            </label>
            <label>
              Celular 2
              <input
                v-model="form.contacto.celular2"
                inputmode="tel"
                :disabled="!canEdit"
              />
            </label>
          </div>
          <label class="span-2">
            Correo electrónico
            <input
              v-model="form.contacto.correo"
              type="email"
              :disabled="!canEdit"
            />
          </label>

          <p class="hint span-2 section-gap">Datos adicionales</p>
          <div class="field-row">
            <label>
              Factura
              <select v-model="form.contacto.factura" :disabled="!canEdit">
                <option value="">—</option>
                <option value="SI">Sí</option>
                <option value="NO">No</option>
              </select>
            </label>
            <div class="toggle-field">
              <span class="toggle-field__label">Sindicalizado</span>
              <label
                class="toggle"
                :class="{
                  'toggle--on': form.contacto.sindicalizado === 'SI',
                  'toggle--disabled': !canEdit,
                }"
              >
                <input
                  v-model="form.contacto.sindicalizado"
                  type="checkbox"
                  true-value="SI"
                  false-value="NO"
                  :disabled="!canEdit"
                />
                <span class="toggle__track" aria-hidden="true">
                  <span class="toggle__thumb" />
                </span>
                <span class="toggle__text">
                  {{ form.contacto.sindicalizado === 'SI' ? 'Sí' : 'No' }}
                </span>
              </label>
            </div>
          </div>
          <label class="span-2">
            Observaciones
            <textarea
              v-model="form.contacto.observaciones"
              rows="3"
              :disabled="!canEdit"
            />
          </label>
        </div>

        <div v-show="titularInnerTab === 'domicilio'" class="fields">
          <p class="hint span-2">Domicilio</p>
          <label class="span-2">
            Dirección
            <input v-model="form.contacto.direccion" :disabled="!canEdit" />
          </label>
          <div class="field-row">
            <label>
              Colonia
              <input v-model="form.contacto.colonia" :disabled="!canEdit" />
            </label>
            <label>
              C.P.
              <input
                v-model="form.contacto.cp"
                inputmode="numeric"
                :disabled="!canEdit"
              />
            </label>
          </div>
          <div class="field-row">
            <label>
              Municipio
              <input v-model="form.contacto.municipio" :disabled="!canEdit" />
            </label>
            <label>
              Estado
              <input v-model="form.contacto.estado" :disabled="!canEdit" />
            </label>
          </div>
          <label class="span-2">
            Entre calles
            <input v-model="form.contacto.entreCalles" :disabled="!canEdit" />
          </label>
          <label class="span-2">
            Seña particular
            <input
              v-model="form.contacto.senaParticular"
              :disabled="!canEdit"
            />
          </label>

          <p class="hint span-2 section-gap">Datos adicionales</p>
          <label>
            Tipo de cobranza
            <select v-model="form.contacto.tipoCobranza" :disabled="!canEdit">
              <option value="">—</option>
              <option>VENTANILLA</option>
              <option>DOMICILIADO</option>
              <option>NOMINA</option>
              <option>OTRO</option>
            </select>
          </label>
          <label class="span-2">
            Domicilio entrega documentación
            <input
              v-model="form.contacto.domicilioEntregaDocumentacion"
              :disabled="!canEdit"
            />
          </label>
        </div>
      </div>

      <!-- 2 · Beneficiarios -->
      <div v-show="step === 2" class="benef-block">
        <p class="hint">
          El primer beneficiario es obligatorio. Puedes agregar uno más
          (máximo 2).
        </p>

        <div
          v-for="(b, index) in form.beneficiarios"
          :key="index"
          class="benef-card"
        >
          <div class="benef-card__head">
            <h3>
              {{ index === 0 ? 'Beneficiario 1 (obligatorio)' : 'Beneficiario 2' }}
            </h3>
            <button
              v-if="canEdit && index === 1"
              type="button"
              class="btn btn-ghost btn-compact"
              @click="removeBeneficiario(index)"
            >
              Quitar
            </button>
          </div>
          <div class="fields">
            <label>
              Nombre(s)
              <input v-model="b.nombres" :disabled="!canEdit" />
            </label>
            <label>
              Apellido paterno
              <input v-model="b.apellidoPaterno" :disabled="!canEdit" />
            </label>
            <label>
              Apellido materno
              <input v-model="b.apellidoMaterno" :disabled="!canEdit" />
            </label>
            <label>
              Parentesco
              <input v-model="b.parentesco" :disabled="!canEdit" />
            </label>
            <label>
              Celular
              <input
                v-model="b.celular"
                inputmode="tel"
                :disabled="!canEdit"
              />
            </label>
            <label>
              Fecha de nacimiento
              <input
                v-model="b.fechaNacimiento"
                type="date"
                :disabled="!canEdit"
              />
            </label>
          </div>
        </div>

        <button
          v-if="canEdit && form.beneficiarios.length < 2"
          type="button"
          class="btn btn-ghost"
          @click="addBeneficiario"
        >
          Agregar beneficiario
        </button>
      </div>

      <!-- 3 · Segundo contacto -->
      <div v-show="step === 3" class="titular-step">
        <p class="hint">Segundo contacto del titular (residente local)</p>
        <div class="tabs" role="tablist" aria-label="Datos del segundo contacto">
          <button
            type="button"
            class="tab"
            :class="{ active: segundoInnerTab === 'personales' }"
            @click="segundoInnerTab = 'personales'"
          >
            Datos personales
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: segundoInnerTab === 'domicilio' }"
            @click="segundoInnerTab = 'domicilio'"
          >
            Dirección
          </button>
        </div>

        <div v-show="segundoInnerTab === 'personales'" class="fields">
          <label class="span-2">
            Nombre(s)
            <input v-model="form.segundoContacto.nombres" :disabled="!canEdit" />
          </label>
          <div class="field-row">
            <label>
              Apellido paterno
              <input
                v-model="form.segundoContacto.apellidoPaterno"
                :disabled="!canEdit"
              />
            </label>
            <label>
              Apellido materno
              <input
                v-model="form.segundoContacto.apellidoMaterno"
                :disabled="!canEdit"
              />
            </label>
          </div>
          <div class="field-row">
            <label>
              Parentesco
              <input
                v-model="form.segundoContacto.parentesco"
                :disabled="!canEdit"
              />
            </label>
            <label>
              Fecha de nacimiento
              <input
                v-model="form.segundoContacto.fechaNacimiento"
                type="date"
                :disabled="!canEdit"
              />
            </label>
          </div>
          <label class="span-2">
            Celular
            <input
              v-model="form.segundoContacto.celular"
              inputmode="tel"
              :disabled="!canEdit"
            />
          </label>
        </div>

        <div v-show="segundoInnerTab === 'domicilio'" class="fields">
          <label class="span-2">
            Dirección
            <input
              v-model="form.segundoContacto.direccion"
              :disabled="!canEdit"
            />
          </label>
          <div class="field-row">
            <label>
              Colonia
              <input
                v-model="form.segundoContacto.colonia"
                :disabled="!canEdit"
              />
            </label>
            <label>
              C.P.
              <input
                v-model="form.segundoContacto.cp"
                inputmode="numeric"
                :disabled="!canEdit"
              />
            </label>
          </div>
          <label class="span-2">
            Entre calles
            <input
              v-model="form.segundoContacto.entreCalles"
              :disabled="!canEdit"
            />
          </label>
          <label class="span-2">
            Domicilio entrega documentación
            <input
              v-model="form.segundoContacto.domicilioEntregaDocumentacion"
              :disabled="!canEdit"
            />
          </label>
        </div>
      </div>

      <!-- 4 · Plan -->
      <div v-show="step === 4" class="titular-step">
        <div class="tabs" role="tablist" aria-label="Plan y financiamiento">
          <button
            type="button"
            class="tab"
            :class="{ active: planInnerTab === 'plan' }"
            @click="planInnerTab = 'plan'"
          >
            Plan
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: planInnerTab === 'financiamiento' }"
            @click="planInnerTab = 'financiamiento'"
          >
            Financiamiento
          </button>
        </div>

        <div v-show="planInnerTab === 'plan'" class="fields">
          <label class="span-2">
            Tipo de plan
            <select
              v-model="form.ubicacionPlan.planKind"
              :disabled="!canEdit"
              @change="onPlanKindChange"
            >
              <option value="PLAN_FUTURO">Plan futuro</option>
              <option value="PARQUE">Parque</option>
            </select>
          </label>
          <div class="span-2 plan-name">
            <label class="plan-name__field">
              Nombre del plan
              <input
                v-model="form.ubicacionPlan.nombrePlan"
                readonly
                :placeholder="
                  canEdit ? 'Selecciona un plan con Buscar en Odoo…' : '—'
                "
                class="plan-name__readonly"
              />
            </label>
            <button
              type="button"
              class="btn btn-ghost plan-name__search"
              :disabled="!canEdit"
              @click="planSearchOpen = true"
            >
              Buscar en Odoo
            </button>
          </div>
          <p
            v-if="form.ubicacionPlan.productId"
            class="hint span-2 plan-name__meta"
          >
            Plan Odoo #{{ form.ubicacionPlan.productId
            }}<template v-if="form.ubicacionPlan.productDefaultCode">
              · {{ form.ubicacionPlan.productDefaultCode }}</template
            >
          </p>
          <label v-if="isPlanFuturo" class="span-2">
            Servicio funerario
            <input
              v-model="form.ubicacionPlan.servicioFunerario"
              :disabled="!canEdit"
            />
          </label>

          <template v-if="isParque">
            <label class="check span-2">
              <input
                v-model="form.ubicacionPlan.preasignacion"
                type="checkbox"
                :disabled="!canEdit"
                @change="onPreasignacionChange"
              />
              Preasignación de ubicación
            </label>

            <template v-if="form.ubicacionPlan.preasignacion">
              <div class="span-2 plan-name">
                <button
                  type="button"
                  class="btn btn-ghost plan-name__search"
                  :disabled="!canEdit"
                  @click="locationSearchOpen = true"
                >
                  Buscar ubicación en Odoo
                </button>
              </div>
              <label>
                Parque
                <input
                  :value="form.ubicacionPlan.parqueFuneral"
                  readonly
                  class="plan-name__readonly"
                  placeholder="—"
                />
              </label>
              <label>
                Sección
                <input
                  :value="form.ubicacionPlan.seccion"
                  readonly
                  class="plan-name__readonly"
                  placeholder="—"
                />
              </label>
              <label>
                Cuadrante
                <input
                  :value="form.ubicacionPlan.cuadrante"
                  readonly
                  class="plan-name__readonly"
                  placeholder="—"
                />
              </label>
              <label>
                Ubicación
                <input
                  :value="form.ubicacionPlan.numero"
                  readonly
                  class="plan-name__readonly"
                  placeholder="—"
                />
              </label>
            </template>
          </template>
        </div>

        <div v-show="planInnerTab === 'financiamiento'" class="fields">
          <div class="span-2 plan-readonly">
            <div class="plan-readonly__item">
              <span>Precio del plan</span>
              <strong>{{
                formatMoneyLabel(
                  form.ubicacionPlan.precioPlan || form.pago.precioPlan,
                )
              }}</strong>
            </div>
            <div class="plan-readonly__item">
              <span>Saldo</span>
              <strong>{{ formatMoneyLabel(form.pago.saldo) }}</strong>
            </div>
          </div>

          <div v-if="descuentoEspecial > 0" class="span-2 descuento-especial">
            <div class="plan-readonly__item">
              <span>Descuento especial autorizado</span>
              <strong>{{ Math.trunc(descuentoEspecial) }}%</strong>
            </div>
            <p class="field-hint">
              Tope estándar: {{ maxDiscountAmount }}%.
              <template v-if="descuentoEspecial > maxDiscountAmount">
                Se marcará como utilizado al generar la venta.
              </template>
            </p>
          </div>

          <label>
            Descuento (%)
            <input
              v-model="form.pago.promocionDescuento"
              inputmode="numeric"
              type="number"
              min="0"
              max="100"
              step="1"
              :disabled="!canEdit"
              placeholder="0"
              @blur="clampDescuento"
            />
            <small class="field-hint">
              Máximo permitido: {{ allowedDiscountMax }}%
            </small>
          </label>
          <label>
            Anticipo
            <input
              v-model="form.pago.anticipo"
              inputmode="decimal"
              :disabled="!canEdit"
              placeholder="0.00"
            />
          </label>
          <label>
            Pago inicial
            <input
              v-model="form.pago.pagoInicial"
              inputmode="decimal"
              :disabled="!canEdit"
            />
          </label>
          <label>
            Importe de cada pago
            <input
              v-model="form.pago.importeCadaPago"
              inputmode="decimal"
              :disabled="!canEdit"
            />
          </label>
          <label>
            Frecuencia
            <select v-model="form.pago.frecuencia" :disabled="!canEdit">
              <option value="">—</option>
              <option>SEMANAL</option>
              <option>QUINCENAL</option>
              <option>MENSUAL</option>
            </select>
          </label>
          <label>
            Plazo
            <input v-model="form.pago.plazo" :disabled="!canEdit" />
          </label>
          <label>
            Próximo pago
            <input
              v-model="form.pago.fechaProximoPago"
              type="date"
              :disabled="!canEdit"
            />
          </label>
          <label>
            Días específicos
            <input
              v-model="form.pago.diasEspecificosPago"
              :disabled="!canEdit"
              placeholder="Ej. 15 de cada mes"
            />
          </label>
          <div class="plan-readonly__item">
            <span>Nombre del asesor</span>
            <strong>{{ sellerAsesorName || '—' }}</strong>
          </div>
          <label>
            Nombre del jefe de ventas
            <input
              v-model="form.pago.nombreJefeVentas"
              :disabled="!canEdit"
            />
          </label>
        </div>
      </div>

      <!-- 5 · Documentos + declaraciones -->
      <div v-show="step === 5" class="fields docs">
        <p class="hint span-2">
          Imagen o PDF. Al completar todos los pasos podrás guardar la venta.
        </p>

        <div class="upload-grid span-2">
          <div
            class="upload-card"
            :class="{
              'upload-card--filled': form.documentos.ine,
              'upload-card--disabled': !canEdit,
            }"
          >
            <div class="upload-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="1.7"
                />
                <circle cx="8.5" cy="10" r="1.4" fill="currentColor" />
                <path
                  d="M4.5 16l4.2-4.2a1 1 0 0 1 1.4 0L14 16l2.1-2.1a1 1 0 0 1 1.4 0L19.5 16"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <div class="upload-card__body">
              <strong>INE</strong>
              <template v-if="form.documentos.ine">
                <span class="upload-card__name">{{
                  form.documentos.ine.name
                }}</span>
                <span class="upload-card__meta">{{
                  fileKindLabel(form.documentos.ine.mime)
                }}</span>
              </template>
              <span v-else class="upload-card__hint"
                >Toca para seleccionar imagen o PDF</span
              >
            </div>
            <div class="upload-card__actions">
              <label class="upload-card__btn">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  :disabled="!canEdit"
                  @change="onFile('ine', $event)"
                />
                <span class="upload-card__btn-ui" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 16V5M12 5l-3.5 3.5M12 5l3.5 3.5"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M5 16.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-1.5"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </span>
                <span class="upload-card__btn-text">{{
                  form.documentos.ine ? 'Cambiar' : 'Adjuntar'
                }}</span>
              </label>
              <button
                v-if="form.documentos.ine && canEdit"
                type="button"
                class="upload-card__remove"
                @click="clearFile('ine')"
              >
                Quitar
              </button>
            </div>
          </div>

          <div
            class="upload-card"
            :class="{
              'upload-card--filled': form.documentos.comprobanteDomicilio,
              'upload-card--disabled': !canEdit,
            }"
          >
            <div class="upload-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 3.5h7.2L19 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5z"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round"
                />
                <path
                  d="M14 3.5V8h5"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round"
                />
                <path
                  d="M9 13h6M9 16.5h4"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <div class="upload-card__body">
              <strong>Comprobante de domicilio</strong>
              <template v-if="form.documentos.comprobanteDomicilio">
                <span class="upload-card__name">{{
                  form.documentos.comprobanteDomicilio.name
                }}</span>
                <span class="upload-card__meta">{{
                  fileKindLabel(form.documentos.comprobanteDomicilio.mime)
                }}</span>
              </template>
              <span v-else class="upload-card__hint"
                >Toca para seleccionar imagen o PDF</span
              >
            </div>
            <div class="upload-card__actions">
              <label class="upload-card__btn">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  :disabled="!canEdit"
                  @change="onFile('comprobanteDomicilio', $event)"
                />
                <span class="upload-card__btn-ui" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 16V5M12 5l-3.5 3.5M12 5l3.5 3.5"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M5 16.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-1.5"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </span>
                <span class="upload-card__btn-text">{{
                  form.documentos.comprobanteDomicilio ? 'Cambiar' : 'Adjuntar'
                }}</span>
              </label>
              <button
                v-if="form.documentos.comprobanteDomicilio && canEdit"
                type="button"
                class="upload-card__remove"
                @click="clearFile('comprobanteDomicilio')"
              >
                Quitar
              </button>
            </div>
          </div>
        </div>

        <h3 class="span-2">Declaraciones</h3>
        <label>
          ¿Acepta uso mercadotécnico?
          <select
            v-model="form.declaraciones.aceptaMercadotecnia"
            :disabled="!canEdit"
          >
            <option value="">—</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
          </select>
        </label>
        <label>
          ¿Acepta recibir publicidad?
          <select
            v-model="form.declaraciones.aceptaPublicidad"
            :disabled="!canEdit"
          >
            <option value="">—</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
          </select>
        </label>
      </div>
      </form>
      <template #footer>
        <button type="button" class="btn btn-primary" @click="closeStepForm">
          Listo
        </button>
      </template>
    </VdModal>

    <footer class="capture__dock">
      <p class="dock-hint">
        <template v-if="!canEdit">Solo consulta</template>
        <template v-else-if="allStepsComplete">
          Todos los pasos listos · se guardará como venta
        </template>
        <template v-else-if="canSaveDraft">
          {{ completedCount }}/{{ STEPS.length }} completos · puedes guardar
          borrador
        </template>
        <template v-else>
          Captura nombre y apellido paterno del titular para guardar borrador
        </template>
      </p>
      <div v-if="canEdit" class="dock-actions">
        <button
          v-if="!allStepsComplete"
          type="button"
          class="btn btn-primary dock-draft"
          :disabled="saving || !canSaveDraft"
          @click="saveDraft"
        >
          {{ saving ? 'Guardando…' : 'Guardar borrador' }}
        </button>
        <template v-else>
          <button
            type="button"
            class="btn btn-ghost dock-draft"
            :disabled="saving || submitting"
            @click="saveDraft"
          >
            {{ saving ? 'Guardando…' : 'Borrador' }}
          </button>
          <button
            type="button"
            class="btn btn-primary dock-draft"
            :disabled="submitting || saving"
            @click="finalizeSale"
          >
            {{ submitting ? 'Guardando…' : 'Guardar venta' }}
          </button>
        </template>
      </div>
    </footer>

    <SalePdfPreviewModal
      :open="previewOpen"
      :form="form"
      :sale-id="saleId"
      :status="status === 'NEW' ? undefined : status"
      @close="previewOpen = false"
    />

    <SalePlanSearchModal
      :open="planSearchOpen"
      :plan-kind="form.ubicacionPlan.planKind"
      @close="planSearchOpen = false"
      @select="onPlanSelected"
    />

    <SaleLocationSearchModal
      :open="locationSearchOpen"
      @close="locationSearchOpen = false"
      @select="onLocationSelected"
    />

    <VdModal
      v-if="isDev"
      :open="devPrefillOpen"
      title="Prellenar (dev)"
      @close="devPrefillOpen = false"
    >
      <div class="dev-prefill">
        <p class="hint">
          Marca los pasos a rellenar. Se usará un cliente/venta al azar de los
          10 mocks.
        </p>
        <div class="dev-prefill__actions">
          <button
            type="button"
            class="btn btn-ghost btn-compact"
            @click="toggleAllDevPrefill(true)"
          >
            Todos
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-compact"
            @click="toggleAllDevPrefill(false)"
          >
            Ninguno
          </button>
        </div>
        <label v-for="s in STEPS" :key="s.key" class="check">
          <input v-model="devPrefillSteps[s.key]" type="checkbox" />
          {{ s.title }}
        </label>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          @click="devPrefillOpen = false"
        >
          Cancelar
        </button>
        <button type="button" class="btn btn-primary" @click="applyDevPrefill">
          Prellenar
        </button>
      </template>
    </VdModal>

    <VdModal
      :open="reuseOpen"
      title="Usar cotización de referencia"
      wide
      @close="reuseOpen = false"
    >
      <div class="reuse">
        <p class="hint">
          Elige una venta o borrador y marca qué datos reutilizar.
        </p>
        <label>
          Cotización
          <select v-model="selectedRefId">
            <option v-for="r in references" :key="r.id" :value="r.id">
              #{{ r.id }} · {{ r.titularName || 'Sin titular' }}
              ({{ r.status === 'DRAFT' ? 'Borrador' : 'Enviada' }})
            </option>
          </select>
        </label>
        <label class="check">
          <input v-model="reuseGroups.contacto" type="checkbox" />
          Datos de contacto del titular
        </label>
        <label class="check">
          <input v-model="reuseGroups.segundoContacto" type="checkbox" />
          Segundo contacto del titular
        </label>
        <label class="check">
          <input v-model="reuseGroups.beneficiarios" type="checkbox" />
          Beneficiarios
        </label>
      </div>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="reuseOpen = false">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!selectedRefId"
          @click="applyReuse"
        >
          Aplicar
        </button>
      </template>
    </VdModal>
  </section>
</template>

<style scoped>
.capture {
  --dock-h: 7.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding-bottom: calc(var(--dock-h) + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.capture__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.capture__titles {
  min-width: 0;
  flex: 1;
}

.capture__head h1 {
  margin: 0.1rem 0 0.15rem;
  color: var(--gsm-blue);
  font-size: clamp(1.35rem, 4vw, 1.75rem);
  line-height: 1.15;
}

.capture__meta {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.88rem;
}

.link-back {
  border: 0;
  background: transparent;
  color: var(--gsm-blue);
  padding: 0;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  min-height: 32px;
}

.capture__head-actions {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: stretch;
  gap: 0.4rem;
}

.capture__head-actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.btn-compact {
  min-height: 40px;
  padding: 0.4rem 0.7rem;
  font-size: 0.82rem;
  white-space: nowrap;
}

.progress {
  height: 5px;
  background: rgba(53, 100, 125, 0.12);
  border-radius: 999px;
  overflow: hidden;
}

.progress__bar {
  height: 100%;
  background: var(--gsm-blue);
  transition: width 0.2s ease;
}

.step-list {
  margin: 0;
  padding: 0.9rem;
}

.step-list__head {
  margin-bottom: 0.85rem;
}

.step-list__head h2 {
  margin: 0 0 0.2rem;
  font-size: 1.05rem;
  color: var(--gsm-blue);
}

.step-list__head p {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.88rem;
}

.step-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.step-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 64px;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--vd-line);
  border-radius: 12px;
  background: #fff;
  color: var(--vd-ink);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.step-row:hover {
  border-color: rgba(53, 100, 125, 0.4);
  box-shadow: 0 4px 14px rgba(2, 53, 125, 0.06);
}

.step-row__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: rgba(53, 100, 125, 0.12);
  color: var(--gsm-blue);
  font-size: 0.85rem;
  font-weight: 800;
}

.step-row__mark svg {
  width: 1.05rem;
  height: 1.05rem;
}

.step-row__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.step-row__body strong {
  font-size: 0.98rem;
  color: var(--gsm-blue);
}

.step-row__body small {
  color: var(--vd-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.step-row__chevron {
  color: var(--gsm-cafe);
  font-size: 1.5rem;
  line-height: 1;
  font-weight: 400;
}

.step-row.complete {
  border-color: rgba(47, 111, 78, 0.35);
  background: rgba(47, 111, 78, 0.04);
}

.step-row.complete .step-row__mark {
  background: var(--vd-ok);
  color: #fff;
}

.step-row.complete .step-row__body small {
  color: var(--vd-ok);
}

.form-panel--modal {
  margin: 0;
  padding: 0.15rem 0 0.25rem;
  overflow: visible;
}

.titular-step {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tab {
  border: 1px solid var(--vd-line);
  background: var(--vd-surface, #fff);
  color: var(--vd-muted);
  border-radius: 10px;
  padding: 0.45rem 0.85rem;
  font-size: 0.84rem;
  font-weight: 600;
  min-height: 40px;
  cursor: pointer;
}

.tab.active {
  background: var(--gsm-blue);
  border-color: var(--gsm-blue);
  color: #fff;
}

.benef-block {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.benef-card {
  border: 1px solid var(--vd-line);
  border-radius: 12px;
  padding: 0.75rem;
  background: var(--vd-surface, #fff);
}

.benef-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
}

.benef-card__head h3 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--gsm-blue);
}

.fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.7rem;
}

.fields label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--gsm-blue);
  min-width: 0;
}

.fields label.check {
  flex-direction: row;
  align-items: center;
  gap: 0.55rem;
  color: var(--vd-ink);
  font-weight: 500;
}

.fields label.check input[type='checkbox'] {
  width: 1.15rem;
  height: 1.15rem;
  min-height: 0;
  margin: 0;
  accent-color: var(--gsm-blue);
}

.plan-name {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
}

.plan-name__field {
  flex: 1;
}

.plan-name__search {
  min-height: 46px;
  white-space: nowrap;
}

.plan-name__readonly {
  cursor: default;
  background: var(--vd-surface, #f4f7f9);
  color: var(--vd-ink);
}

.plan-name__readonly:read-only:focus {
  outline: none;
  border-color: var(--vd-line);
}

.plan-name__meta {
  margin-top: -0.35rem;
}

.plan-readonly {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.plan-readonly__item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  background: #f7f9fb;
}

.plan-readonly__item span {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--gsm-blue);
}

.plan-readonly__item strong {
  font-size: 1.05rem;
  color: var(--vd-ink, #1a2430);
}

.descuento-especial {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.descuento-especial .field-hint {
  margin: 0;
}

.field-hint {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--vd-muted);
  line-height: 1.35;
}

@media (max-width: 600px) {
  .plan-readonly {
    grid-template-columns: 1fr;
  }
}

.fields input,
.fields select,
.fields textarea {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  min-height: 46px;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-size: 16px;
  color: var(--vd-ink);
  background: #fff;
}

.fields textarea {
  min-height: 88px;
  resize: vertical;
}

.span-2 {
  grid-column: 1 / -1;
}

.field-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: inherit;
  align-items: end;
}

.toggle-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.toggle-field__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--gsm-blue);
}

.toggle {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 46px;
  padding: 0 0.85rem;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  user-select: none;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.toggle input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  margin: 0;
  pointer-events: none;
}

.toggle__track {
  position: relative;
  flex: 0 0 auto;
  width: 2.55rem;
  height: 1.45rem;
  border-radius: 999px;
  background: #cfd8de;
  transition: background 0.2s ease;
}

.toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(35, 35, 35, 0.22);
  transition: transform 0.2s ease;
}

.toggle__text {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--vd-muted);
  letter-spacing: 0.01em;
}

.toggle--on {
  border-color: rgba(53, 100, 125, 0.45);
  background: rgba(53, 100, 125, 0.06);
  box-shadow: inset 0 0 0 1px rgba(53, 100, 125, 0.06);
}

.toggle--on .toggle__track {
  background: var(--gsm-blue);
}

.toggle--on .toggle__thumb {
  transform: translateX(1.1rem);
}

.toggle--on .toggle__text {
  color: var(--gsm-blue);
}

.toggle:hover:not(.toggle--disabled) {
  border-color: rgba(53, 100, 125, 0.4);
}

.toggle--disabled {
  opacity: 0.62;
  cursor: not-allowed;
  background: var(--vd-surface-2);
}

.fields h3 {
  margin: 0.25rem 0 0;
  font-size: 0.98rem;
  color: var(--gsm-blue);
}

.hint {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.88rem;
  font-weight: 500;
}

.section-gap {
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--vd-line);
  font-weight: 700;
  color: var(--gsm-blue);
  letter-spacing: 0.01em;
}

.upload-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.upload-card {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'icon body'
    'actions actions';
  gap: 0.65rem 0.85rem;
  padding: 0.95rem 1rem;
  border: 1.5px dashed rgba(53, 100, 125, 0.35);
  border-radius: 14px;
  background: linear-gradient(180deg, #f8fbfc 0%, #fff 70%);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.upload-card__icon {
  grid-area: icon;
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 12px;
  background: rgba(53, 100, 125, 0.1);
  color: var(--gsm-blue);
}

.upload-card__icon svg {
  width: 1.35rem;
  height: 1.35rem;
}

.upload-card__body {
  grid-area: body;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.upload-card__body strong {
  color: var(--gsm-blue);
  font-size: 0.95rem;
}

.upload-card__hint {
  color: var(--vd-muted);
  font-size: 0.82rem;
  font-weight: 500;
}

.upload-card__name {
  color: var(--vd-ink);
  font-size: 0.86rem;
  font-weight: 600;
  word-break: break-word;
}

.upload-card__meta {
  color: var(--vd-ok);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.upload-card__actions {
  grid-area: actions;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.upload-card__btn {
  position: relative;
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 40px;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  background: var(--gsm-blue);
  color: #fff !important;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
}

.upload-card__btn input[type='file'] {
  position: absolute !important;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  min-height: 0 !important;
  background: transparent !important;
  z-index: 2;
}

.upload-card__btn-ui {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  pointer-events: none;
  z-index: 1;
}

.upload-card__btn-ui svg {
  width: 1rem;
  height: 1rem;
}

.upload-card__btn-text {
  position: relative;
  z-index: 1;
  pointer-events: none;
  color: #fff;
  font-weight: 700;
}

.upload-card__btn:has(input:disabled) {
  opacity: 0.55;
  cursor: not-allowed;
}

.upload-card__remove {
  min-height: 38px;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(203, 42, 29, 0.28);
  background: rgba(203, 42, 29, 0.06);
  color: var(--vd-danger);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.upload-card--filled {
  border-style: solid;
  border-color: rgba(47, 111, 78, 0.4);
  background: rgba(47, 111, 78, 0.05);
}

.upload-card--filled .upload-card__icon {
  background: rgba(47, 111, 78, 0.14);
  color: var(--vd-ok);
}

.upload-card--disabled {
  opacity: 0.75;
}

@media (min-width: 720px) {
  .upload-grid {
    grid-template-columns: 1fr 1fr;
  }

  .upload-card {
    grid-template-columns: auto 1fr;
    grid-template-areas:
      'icon body'
      'icon actions';
    align-items: start;
  }
}

.capture__dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: grid;
  gap: 0.45rem;
  padding: 0.65rem 0.85rem calc(0.65rem + env(safe-area-inset-bottom, 0px));
  background: rgba(244, 247, 249, 0.96);
  border-top: 1px solid var(--vd-line);
  backdrop-filter: blur(8px);
}

.dock-hint {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.3;
}

.dock-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
}

.dock-draft {
  flex: 1;
  min-width: 8rem;
  min-height: 48px;
}

.dock-draft:disabled {
  opacity: 0.55;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--vd-muted);
}

.reuse {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reuse label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  color: var(--gsm-blue);
  font-size: 0.9rem;
}

.reuse select {
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid var(--vd-line);
  padding: 0.5rem 0.7rem;
  width: 100%;
  font-size: 16px;
}

.reuse .check {
  flex-direction: row;
  align-items: center;
  gap: 0.55rem;
  color: var(--vd-ink);
  font-weight: 500;
}

.dev-prefill {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.dev-prefill__actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.dev-prefill .check {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.55rem;
  min-height: 44px;
  color: var(--vd-ink);
  font-weight: 500;
  font-size: 0.95rem;
}

.dev-prefill .check input {
  width: 1.15rem;
  height: 1.15rem;
}

@media (min-width: 720px) {
  .capture {
    --dock-h: 5.5rem;
    gap: 0.9rem;
  }

  .fields {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 0.9rem;
  }

  .step-list {
    padding: 1.15rem 1.25rem;
  }

  .capture__dock {
    left: 50%;
    transform: translateX(-50%);
    width: min(980px, calc(100% - 2rem));
    border-radius: 14px 14px 0 0;
    align-items: center;
    grid-template-columns: 1fr auto;
  }

  .dock-actions {
    width: auto;
    justify-content: flex-end;
  }

  .dock-draft {
    width: auto;
    flex: 0 1 auto;
    min-width: 10rem;
  }
}

@media (min-width: 960px) {
  .capture__dock {
    position: sticky;
    transform: none;
    left: auto;
    width: 100%;
    border-radius: 12px;
    margin-top: 0.25rem;
  }

  .capture {
    --dock-h: 0px;
    padding-bottom: 1rem;
  }
}
</style>
