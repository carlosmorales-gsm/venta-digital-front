<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { extractApiError, http } from '../../../shared/api/http';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import { BANK_OPTIONS } from '../constants/mexican-banks';
import {
  FISCAL_REGIMEN_CARTA,
  FISCAL_REGIMEN_OTROS,
  TIPO_PERSONA_OPTIONS,
} from '../constants/fiscal-regimes';
import { SALE_KINDS } from '../constants/sale-kinds';
import { SALE_ORIGIN_OPTIONS } from '../constants/sale-origins';
import { todayIsoDate } from '../../../shared/utils/datetime';
import { DEFAULT_SERVICIO_FUNERARIO, type SaleFormData } from '../types/sale-form';
import SaleLocationSearchModal, {
  type ParkLocationSelection,
} from './SaleLocationSearchModal.vue';
import SalePlanSearchModal, { type PlanProduct } from './SalePlanSearchModal.vue';
import { fileToAttachment } from '../utils/file-to-attachment';
import {
  CORRECTION_FIELDS,
  PLAN_CORRECTION_KEY,
  correctionFileTargets,
  displayCorrectionValue,
  readPath,
  type CorrectionFieldDef,
} from '../utils/correction-fields';
import {
  FINANCE_DRIVER_KEYS,
  computeFinancingBreakdown,
  defaultSpecificDaysForFrequency,
  formatMoneyDisplay,
  formatMoneyField,
  normalizeFrequency,
  parseDiscountPct,
  parseMoney,
  previewCorrectionFinance,
  totalRecognizedPaid,
} from '../utils/sale-finance';
import { mxPhoneError, normalizeMxPhone } from '../utils/phone';
import { readSellerPrefetch } from '../utils/seller-session-cache';
import { toSaleUppercase } from '../utils/sale-text';

const props = defineProps<{
  open: boolean;
  saleId: number | null;
  fields: string[];
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const payload = ref<SaleFormData | null>(null);
const titular = ref('');
const values = reactive<Record<string, string>>({});
const companions = reactive<Record<string, string>>({});
const files = reactive<Record<string, { name: string; mime: string; dataBase64: string }>>({});

const catalog = computed(() => readSellerPrefetch());
const planSearchOpen = ref(false);
const locationSearchOpen = ref(false);
const plan = reactive<SaleFormData['ubicacionPlan']>({
  planKind: 'PLAN_FUTURO',
  nombrePlan: '',
  productId: null,
  productDefaultCode: '',
  precioPlan: '',
  seccion: '',
  cuadrante: '',
  numero: '',
  servicioFunerario: '',
  parqueFuneral: '',
  parkId: null,
  sectionId: null,
  quadrantId: null,
  spaceId: null,
  preasignacion: false,
  withoutInterest: false,
});

const PLAN_OWNED_KEYS = new Set([
  'pago.anticipo',
  'pago.frecuencia',
  'pago.plazo',
  'pago.pagoInicial',
]);

const correctPlan = computed(() => props.fields.includes(PLAN_CORRECTION_KEY));

const finance = reactive({
  promocionDescuento: '',
  anticipo: '',
  frecuencia: '',
  plazo: '',
  pagoInicial: '',
  saldo: '',
  importeCadaPago: '',
  fechaProximoPago: '',
  diasEspecificosPago: '',
});
const pagoInicialActivo = ref(false);
const allowedDiscountMax = ref(0);
const maxDiscountAmount = ref(0);
const descuentoEspecial = ref(0);

const isFunepet = computed(() => payload.value?.meta.tipoVenta === 'FUNEPET');

const favoritePlans = computed(() => {
  const defaults = catalog.value?.defaults;
  if (!defaults || isFunepet.value) return [];
  return plan.planKind === 'PARQUE'
    ? defaults.defaultParkPlans
    : defaults.defaultFuturePlans;
});

const planPriceLabel = computed(() => formatMoneyDisplay(plan.precioPlan) || '—');

const selected = computed(() => {
  const wanted = new Set(props.fields);
  return CORRECTION_FIELDS.filter(
    (item) =>
      wanted.has(item.key) &&
      item.kind === 'field' &&
      item.key !== PLAN_CORRECTION_KEY &&
      !(correctPlan.value && PLAN_OWNED_KEYS.has(item.key)),
  );
});

const fileTargets = computed(() => correctionFileTargets(props.fields));

const sections = computed(() => {
  const groups = new Map<string, { label: string; items: CorrectionFieldDef[] }>();
  for (const item of selected.value) {
    const current = groups.get(item.section) ?? {
      label: item.sectionLabel,
      items: [],
    };
    current.items.push(item);
    groups.set(item.section, current);
  }
  return [...groups.values()];
});

const financeDrivers = computed(() =>
  selected.value.some((item) =>
    (FINANCE_DRIVER_KEYS as readonly string[]).includes(item.key),
  ),
);

const financeView = computed(() => {
  const form = payload.value;
  if (!form || !financeDrivers.value) return null;
  const edited = (key: string, fallback: unknown) =>
    selected.value.some((item) => item.key === key) ? values[key] : fallback;
  return previewCorrectionFinance({
    precioPlan: form.ubicacionPlan.precioPlan || form.pago.precioPlan,
    descuentoPct: form.pago.promocionDescuento,
    anticipo: edited('pago.anticipo', form.pago.anticipo),
    frecuencia: edited('pago.frecuencia', form.pago.frecuencia),
    plazo: edited('pago.plazo', form.pago.plazo),
    withoutInterest: Boolean(form.ubicacionPlan.withoutInterest),
    recognizedBalance: totalRecognizedPaid(form.meta.reconocimientoVentas),
    previousPagoInicial: form.pago.pagoInicial,
    previousDias: form.pago.diasEspecificosPago,
    frequencyChanged: selected.value.some((item) => item.key === 'pago.frecuencia') &&
      String(values['pago.frecuencia'] || '')
        .trim()
        .toUpperCase() !==
        String(form.pago.frecuencia || '')
          .trim()
          .toUpperCase(),
  });
});

watch(financeView, (preview) => {
  if (!preview) return;
  if (
    preview.frequencyCode === 'CONTADO' &&
    Object.prototype.hasOwnProperty.call(values, 'pago.plazo') &&
    values['pago.plazo'] !== preview.plazo
  ) {
    values['pago.plazo'] = preview.plazo;
  }
  if (
    preview.pagoInicial != null &&
    Object.prototype.hasOwnProperty.call(values, 'pago.pagoInicial') &&
    values['pago.pagoInicial'] !== preview.pagoInicial
  ) {
    values['pago.pagoInicial'] = preview.pagoInicial;
  }
});

watch(
  () => [props.open, props.saleId] as const,
  async ([open, saleId]) => {
    if (!open || !saleId) return;
    loading.value = true;
    error.value = null;
    payload.value = null;
    for (const key of Object.keys(values)) delete values[key];
    for (const key of Object.keys(companions)) delete companions[key];
    for (const key of Object.keys(files)) delete files[key];
    try {
      const { data } = await http.get<{
        titularName?: string | null;
        payload: SaleFormData;
      }>(`/sales/${saleId}`);
      payload.value = data.payload;
      titular.value = data.titularName || '';
      assignPlan(data.payload.ubicacionPlan, data.payload.meta.tipoVenta === 'FUNEPET');
      assignFinance(data.payload.pago);
      if (props.fields.includes(PLAN_CORRECTION_KEY)) void loadDiscountPolicy();
      planSearchOpen.value = false;
      locationSearchOpen.value = false;
      for (const item of selected.value) {
        if (item.kind === 'field') {
          const shown = displayCorrectionValue(readPath(data.payload, item.key));
          values[item.key] = isDate(item) ? shown.slice(0, 10) : shown;
        }
      }
    } catch {
      error.value = 'No se pudo cargar la venta';
    } finally {
      loading.value = false;
    }
  },
);

type SelectOption = { value: string; label: string };

function withCurrent(options: SelectOption[], current: string): SelectOption[] {
  const value = current.trim();
  if (!value || options.some((item) => item.value === value)) return options;
  return [{ value, label: value }, ...options];
}

function namedOptions(
  rows: Array<{ id: number; name: string }> | undefined,
  current: string,
): SelectOption[] {
  const options = (rows ?? []).map((row) => ({
    value: toSaleUppercase(row.name),
    label: toSaleUppercase(row.name),
  }));
  return withCurrent(options, toSaleUppercase(current));
}

function selectOptions(item: CorrectionFieldDef): SelectOption[] | null {
  const current = values[item.key] ?? '';
  const key = item.key;
  if (key === 'meta.origenVenta') {
    return withCurrent(
      SALE_ORIGIN_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
      current,
    );
  }
  if (key === 'meta.branchName') {
    return namedOptions(catalog.value?.branches, current);
  }
  if (key === 'meta.serviceTypeName') {
    return namedOptions(catalog.value?.serviceTypes, current);
  }
  if (key === 'meta.tipoVenta') {
    return withCurrent(
      SALE_KINDS.map((opt) => ({ value: opt.value, label: opt.label })),
      current,
    );
  }
  if (key === 'contacto.sexo') {
    return withCurrent(
      [
        { value: 'M', label: 'M' },
        { value: 'F', label: 'F' },
      ],
      current,
    );
  }
  if (key === 'contacto.estadoCivil') {
    return withCurrent(
      ['SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO', 'UNION LIBRE', 'CONCUBINATO'].map(
        (value) => ({ value, label: value }),
      ),
      current,
    );
  }
  if (key === 'contacto.factura' || key === 'contacto.mismaDireccionFactura') {
    return withCurrent(
      [
        { value: 'SI', label: 'Sí' },
        { value: 'NO', label: 'No' },
      ],
      current,
    );
  }
  if (key === 'contacto.tipoPersona') {
    return withCurrent(
      TIPO_PERSONA_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
      current,
    );
  }
  if (key === 'contacto.regimenFiscal') {
    return withCurrent(
      [...FISCAL_REGIMEN_CARTA, ...FISCAL_REGIMEN_OTROS].map((opt) => ({
        value: opt.value,
        label: opt.label,
      })),
      current,
    );
  }
  if (key.endsWith('.parentesco')) {
    return namedOptions(catalog.value?.parentescos, current);
  }
  if (key === 'pago.formaPago') {
    return withCurrent(
      [
        { value: 'TRANSFERENCIA', label: 'Transferencia' },
        { value: 'EFECTIVO', label: 'Efectivo' },
        { value: 'CHEQUE', label: 'Cheque' },
        { value: 'TARJETA DEBITO', label: 'Tarjeta débito' },
        { value: 'TARJETA CREDITO', label: 'Tarjeta crédito' },
      ],
      current,
    );
  }
  if (key === 'pago.frecuencia') {
    return withCurrent(
      ['SEMANAL', 'QUINCENAL', 'MENSUAL', 'CONTADO'].map((value) => ({
        value,
        label: value,
      })),
      current,
    );
  }
  if (key === 'pago.banco') {
    return withCurrent(
      BANK_OPTIONS.map((value) => ({ value, label: value })),
      current,
    );
  }
  if (key === 'pago.empresaNomina') {
    return namedOptions(catalog.value?.convenioCompanies, current);
  }
  return null;
}

function isPhone(item: CorrectionFieldDef) {
  return /(?:^|\.)(celular|celular1|celular2|telefonoFactura)$/.test(item.key);
}

function isDate(item: CorrectionFieldDef) {
  return (
    item.key.endsWith('fechaNacimiento') ||
    item.key.endsWith('fechaServicio') ||
    item.key === 'pago.fechaProximoPago'
  );
}

function isEmail(item: CorrectionFieldDef) {
  return item.key.endsWith('.correo');
}

function isCp(item: CorrectionFieldDef) {
  return item.key.endsWith('.cp') || item.key.endsWith('facturaCp');
}

function isRfc(item: CorrectionFieldDef) {
  return item.key.endsWith('.rfc');
}

function isCurp(item: CorrectionFieldDef) {
  return item.key.endsWith('.curp');
}

function isDecimal(item: CorrectionFieldDef) {
  return item.key.endsWith('.anticipo') || item.key.endsWith('.pagoInicial');
}

function isPlazoLocked(item: CorrectionFieldDef) {
  return item.key === 'pago.plazo' && financeView.value?.frequencyCode === 'CONTADO';
}

function isPagoInicialLocked(item: CorrectionFieldDef) {
  return item.key === 'pago.pagoInicial' && financeView.value?.pagoInicial != null;
}

function isMoney(item: CorrectionFieldDef) {
  return (
    item.key.endsWith('.plazo') ||
    item.key.endsWith('.numeroEmpleado') ||
    item.key.endsWith('.cuenta')
  );
}

function onDecimal(item: CorrectionFieldDef, event: Event) {
  const raw = (event.target as HTMLInputElement).value.replace(/[^\d.]/g, '');
  const [whole, ...rest] = raw.split('.');
  values[item.key] = rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

function companionKey(item: CorrectionFieldDef): string | null {
  if (item.key === 'meta.branchName') return 'meta.branchId';
  if (item.key === 'meta.serviceTypeName') return 'meta.serviceTypeId';
  if (item.key === 'pago.empresaNomina') return 'pago.empresaNominaId';
  if (item.key.endsWith('.parentesco')) {
    return item.key.replace(/parentesco$/, 'relationId');
  }
  return null;
}

function catalogRows(item: CorrectionFieldDef) {
  if (item.key === 'meta.branchName') return catalog.value?.branches ?? [];
  if (item.key === 'meta.serviceTypeName') return catalog.value?.serviceTypes ?? [];
  if (item.key.endsWith('.parentesco')) return catalog.value?.parentescos ?? [];
  if (item.key === 'pago.empresaNomina') return catalog.value?.convenioCompanies ?? [];
  return [];
}

function onSelect(item: CorrectionFieldDef, event: Event) {
  const next = (event.target as HTMLSelectElement).value;
  values[item.key] = next;
  if (
    item.key === 'pago.frecuencia' &&
    next.trim().toUpperCase() === 'CONTADO' &&
    Object.prototype.hasOwnProperty.call(values, 'pago.plazo')
  ) {
    values['pago.plazo'] = '0';
  }
  const idKey = companionKey(item);
  if (!idKey) return;
  const row = catalogRows(item).find(
    (entry) => toSaleUppercase(entry.name) === toSaleUppercase(next),
  );
  if (row) companions[idKey] = String(row.id);
  else delete companions[idKey];
}

function onPhone(item: CorrectionFieldDef, event: Event) {
  values[item.key] = normalizeMxPhone((event.target as HTMLInputElement).value);
}

function onDigits(item: CorrectionFieldDef, event: Event, max: number) {
  values[item.key] = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, max);
}

function onUpper(item: CorrectionFieldDef, event: Event) {
  values[item.key] = toSaleUppercase((event.target as HTMLInputElement).value);
}

function currentFileName(saveKey: string) {
  return (
    files[saveKey]?.name ||
    displayCorrectionValue(readPath(payload.value, saveKey)) ||
    'Sin archivo'
  );
}

async function onFile(saveKey: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  error.value = null;
  try {
    const attachment = await fileToAttachment(file);
    if (!attachment.dataBase64) {
      error.value = 'No se pudo leer el archivo';
      return;
    }
    files[saveKey] = {
      name: attachment.name,
      mime: attachment.mime,
      dataBase64: attachment.dataBase64,
    };
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Archivo no válido';
  }
}

function assignPlan(src: SaleFormData['ubicacionPlan'], funepet: boolean) {
  plan.planKind = funepet || src.planKind !== 'PARQUE' ? 'PLAN_FUTURO' : 'PARQUE';
  plan.nombrePlan = src.nombrePlan || '';
  plan.productId = src.productId ?? null;
  plan.productDefaultCode = src.productDefaultCode || '';
  plan.precioPlan = src.precioPlan || '';
  plan.servicioFunerario = src.servicioFunerario || '';
  plan.parqueFuneral = funepet ? '' : src.parqueFuneral || '';
  plan.seccion = funepet ? '' : src.seccion || '';
  plan.cuadrante = funepet ? '' : src.cuadrante || '';
  plan.numero = funepet ? '' : src.numero || '';
  plan.parkId = funepet ? null : src.parkId ?? null;
  plan.sectionId = funepet ? null : src.sectionId ?? null;
  plan.quadrantId = funepet ? null : src.quadrantId ?? null;
  plan.spaceId = funepet ? null : src.spaceId ?? null;
  plan.preasignacion = funepet ? false : Boolean(src.preasignacion);
  plan.withoutInterest = Boolean(src.withoutInterest);
  if (plan.planKind === 'PLAN_FUTURO' && !plan.servicioFunerario.trim()) {
    plan.servicioFunerario = DEFAULT_SERVICIO_FUNERARIO;
  }
}

function clearParkLocation() {
  plan.parqueFuneral = '';
  plan.seccion = '';
  plan.cuadrante = '';
  plan.numero = '';
  plan.parkId = null;
  plan.sectionId = null;
  plan.quadrantId = null;
  plan.spaceId = null;
}

function onPlanKindChange() {
  plan.nombrePlan = '';
  plan.productId = null;
  plan.productDefaultCode = '';
  plan.precioPlan = '';
  plan.withoutInterest = false;
  if (plan.planKind !== 'PARQUE') {
    plan.preasignacion = false;
    clearParkLocation();
    if (!plan.servicioFunerario.trim()) {
      plan.servicioFunerario = DEFAULT_SERVICIO_FUNERARIO;
    }
  } else {
    plan.servicioFunerario = '';
  }
}

function onPlanSelected(picked: PlanProduct) {
  plan.nombrePlan = toSaleUppercase(picked.name);
  plan.productId = picked.id;
  plan.productDefaultCode = picked.defaultCode ?? '';
  plan.withoutInterest = Boolean(picked.withoutInterest);
  plan.precioPlan = picked.listPrice > 0 ? String(picked.listPrice) : '';
  planSearchOpen.value = false;
}

function onPreasignacionChange() {
  if (plan.preasignacion) return;
  plan.cuadrante = '';
  plan.numero = '';
  plan.quadrantId = null;
  plan.spaceId = null;
}

function onLocationSelected(loc: ParkLocationSelection) {
  plan.parkId = loc.parkId;
  plan.parqueFuneral = toSaleUppercase(loc.parkName);
  plan.sectionId = loc.sectionId;
  plan.seccion = toSaleUppercase(loc.sectionName);
  plan.quadrantId = loc.quadrantId ?? null;
  plan.cuadrante = toSaleUppercase(loc.quadrantName ?? '');
  plan.spaceId = loc.spaceId ?? null;
  plan.numero = toSaleUppercase(loc.spaceName ?? '');
  locationSearchOpen.value = false;
}

function assignFinance(pago: SaleFormData['pago']) {
  finance.promocionDescuento = pago.promocionDescuento || '0';
  finance.anticipo = pago.anticipo || '0';
  finance.frecuencia = pago.frecuencia || '';
  finance.plazo = pago.plazo || '';
  finance.pagoInicial = pago.pagoInicial || '';
  finance.saldo = pago.saldo || '';
  finance.importeCadaPago = pago.importeCadaPago || '';
  finance.fechaProximoPago = (pago.fechaProximoPago || '').slice(0, 10);
  finance.diasEspecificosPago = pago.diasEspecificosPago || '';
  pagoInicialActivo.value =
    normalizeFrequency(finance.frecuencia) === 'CONTADO' ||
    parseMoney(finance.pagoInicial) > 0;
  recomputeFinancing();
}

async function loadDiscountPolicy() {
  try {
    const { data } = await http.get<{
      maxDiscountAmount?: number;
      descuentoEspecial?: number;
      allowedDiscountMax?: number;
    }>('/settings/drafts');
    maxDiscountAmount.value = Number(data.maxDiscountAmount) || 0;
    descuentoEspecial.value = Number(data.descuentoEspecial) || 0;
    allowedDiscountMax.value =
      Number(data.allowedDiscountMax) ||
      Math.max(maxDiscountAmount.value, descuentoEspecial.value);
  } catch {
    /* se conserva el tope del vendedor */
  }
}

const recognizedBalance = computed(() =>
  totalRecognizedPaid(payload.value?.meta.reconocimientoVentas),
);

const isPagoContado = computed(
  () => normalizeFrequency(finance.frecuencia) === 'CONTADO',
);

const financingHint = computed(() => {
  const code = normalizeFrequency(finance.frecuencia);
  if (!code) return '';
  const payments = computeFinancingBreakdown({
    precioPlan: plan.precioPlan,
    descuentoPct: finance.promocionDescuento,
    anticipo: finance.anticipo,
    frecuencia: finance.frecuencia,
    plazo: finance.plazo,
    config: { withoutInterest: plan.withoutInterest },
    recognizedBalance: recognizedBalance.value,
  }).numberFrequencies;
  if (code === 'CONTADO') return 'Un solo pago por el precio de contado.';
  if (!payments) return 'Indica el plazo en meses para calcular la cuota.';
  return `${payments} pagos programados`;
});

const recognizedLabel = computed(() =>
  payload.value?.meta.tipoVenta === 'MEJORA' ||
  payload.value?.meta.tipoVenta === 'MINORIA'
    ? 'Saldo a reconocer (cambio de plan)'
    : 'Saldo a reconocer',
);

function recomputeFinancing() {
  const breakdown = computeFinancingBreakdown({
    precioPlan: plan.precioPlan,
    descuentoPct: finance.promocionDescuento,
    anticipo: finance.anticipo,
    frecuencia: finance.frecuencia,
    plazo: finance.plazo,
    config: { withoutInterest: plan.withoutInterest },
    recognizedBalance: recognizedBalance.value,
  });
  finance.saldo = String(Number(breakdown.saldo.toFixed(2)));
  finance.importeCadaPago = formatMoneyField(breakdown.importeCadaPago);
  if (pagoInicialActivo.value) finance.pagoInicial = finance.importeCadaPago;
}

watch(pagoInicialActivo, (active) => {
  finance.pagoInicial = active ? finance.importeCadaPago : '';
});

watch(
  () => [
    plan.precioPlan,
    plan.withoutInterest,
    finance.promocionDescuento,
    finance.anticipo,
    finance.frecuencia,
    finance.plazo,
    recognizedBalance.value,
  ],
  () => {
    if (!correctPlan.value) return;
    recomputeFinancing();
  },
);

function onFrecuenciaChange() {
  if (isPagoContado.value) {
    finance.plazo = '0';
    pagoInicialActivo.value = true;
  } else if (finance.plazo.trim() === '0') {
    finance.plazo = '';
  }
  finance.diasEspecificosPago = defaultSpecificDaysForFrequency(finance.frecuencia);
  recomputeFinancing();
}

function clampDescuento() {
  let pct = parseDiscountPct(finance.promocionDescuento);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  if (pct > allowedDiscountMax.value) pct = Math.trunc(allowedDiscountMax.value);
  finance.promocionDescuento = String(pct);
  recomputeFinancing();
}

function clampAnticipo() {
  const amount = Math.max(0, parseMoney(finance.anticipo));
  finance.anticipo = amount > 0 ? String(Number(amount.toFixed(2))) : '0';
  recomputeFinancing();
}

function discountError(): string | null {
  const pct = parseDiscountPct(finance.promocionDescuento);
  if (pct < 0) return 'El descuento no puede ser negativo.';
  if (pct > 100) return 'El descuento no puede ser mayor a 100%.';
  if (pct > allowedDiscountMax.value + 0.001) {
    return `El descuento no puede exceder ${allowedDiscountMax.value}%.`;
  }
  return null;
}

function planCorrectionError(): string | null {
  if (!correctPlan.value) return null;
  if (!plan.productId || !plan.nombrePlan.trim()) return 'Selecciona un plan';
  if (plan.planKind === 'PARQUE') {
    if (!plan.parqueFuneral.trim() || !plan.seccion.trim()) {
      return 'Selecciona parque y sección';
    }
    if (plan.preasignacion && (!plan.cuadrante.trim() || !plan.numero.trim())) {
      return 'Selecciona la ubicación del parque';
    }
  } else if (!plan.servicioFunerario.trim()) {
    return 'Indica el servicio funerario';
  }
  if (parseMoney(plan.precioPlan) <= 0) return 'Selecciona un plan con precio';
  if (!finance.frecuencia.trim()) return 'Indica la frecuencia';
  if (!isPagoContado.value && !finance.plazo.trim()) return 'Indica el plazo';
  if (!isPagoContado.value && !finance.anticipo.trim()) return 'Indica el anticipo';
  if (!isPagoContado.value && !finance.fechaProximoPago.trim()) {
    return 'La fecha del próximo pago es obligatoria';
  }
  if (
    !isPagoContado.value &&
    finance.fechaProximoPago.slice(0, 10) < todayIsoDate()
  ) {
    return 'La fecha del próximo pago no puede ser anterior a hoy';
  }
  if (!isPagoContado.value && !finance.diasEspecificosPago.trim()) {
    return 'Los días específicos de pago son obligatorios';
  }
  if (parseMoney(finance.importeCadaPago) <= 0) {
    return 'No se pudo calcular el importe de cada pago';
  }
  return discountError();
}

async function submit() {
  if (!props.saleId || saving.value) return;
  const planError = planCorrectionError();
  if (planError) {
    error.value = planError;
    return;
  }
  const primerPago = selected.value.find((item) => item.key === 'pago.fechaProximoPago');
  if (primerPago) {
    const fecha = (values[primerPago.key] || '').slice(0, 10);
    if (!fecha) {
      error.value = 'Indica la fecha de primer pago';
      return;
    }
    if (fecha < todayIsoDate()) {
      error.value = 'La fecha de primer pago no puede ser anterior a hoy';
      return;
    }
  }
  const missingDoc = fileTargets.value.find((item) => !files[item.saveKey]);
  if (missingDoc) {
    error.value = `Adjunta el archivo de ${missingDoc.label}`;
    return;
  }
  const badPhone = selected.value.find(
    (item) => item.kind === 'field' && isPhone(item) && mxPhoneError(values[item.key], true),
  );
  if (badPhone) {
    error.value = `${badPhone.label}: ${mxPhoneError(values[badPhone.key], true)}`;
    return;
  }
  saving.value = true;
  error.value = null;
  const body: Record<string, unknown> = { ...values, ...companions };
  delete body[PLAN_CORRECTION_KEY];
  if (correctPlan.value) {
    body[PLAN_CORRECTION_KEY] = {
      ...plan,
      financiamiento: { ...finance },
    };
  }
  for (const [key, file] of Object.entries(files)) body[key] = file;
  try {
    await http.post(`/sales/${props.saleId}/correction`, { values: body });
    emit('saved');
    emit('close');
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudo guardar la corrección');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <VdModal
    :open="open"
    title="Por corregir"
    wide
    @close="emit('close')"
  >
    <p class="lead">
      Mesa de Control pidió corregir estos datos de
      <strong>{{ titular || 'la venta' }}</strong>.
    </p>
    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="loading" class="muted">Cargando…</p>
    <div v-else class="sections">
      <section v-if="financeView" class="block finance">
        <h3>Cálculo actualizado</h3>
        <p class="finance-note">
          {{
            correctPlan
              ? 'Así quedan saldo e importe con el plan de esta corrección.'
              : 'Anticipo, frecuencia y plazo recalculan estos importes. Así quedan con los datos de esta corrección.'
          }}
        </p>
        <div class="calc-row">
          <span>Saldo</span>
          <strong>{{ financeView.saldoLabel }}</strong>
        </div>
        <div class="calc-row">
          <span>Importe de cada pago</span>
          <strong>{{ financeView.cuotaLabel }}</strong>
        </div>
        <p class="finance-note">{{ financeView.hint }}</p>
        <div class="calc-row">
          <span>Días específicos</span>
          <strong>{{ financeView.diasEspecificosPago || '—' }}</strong>
        </div>
        <div v-if="financeView.pagoInicial != null" class="calc-row">
          <span>Pago inicial</span>
          <strong>{{ financeView.pagoInicialLabel }}</strong>
        </div>
      </section>
      <section v-if="fileTargets.length" class="block">
        <h3>Archivos</h3>
        <label v-for="item in fileTargets" :key="item.saveKey" class="row">
          <span>{{ item.label }}</span>
          <span class="file-row">
            <small>{{ currentFileName(item.saveKey) }}</small>
            <label class="file-btn">
              {{ files[item.saveKey] ? 'Cambiar archivo' : 'Seleccionar archivo' }}
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                @change="onFile(item.saveKey, $event)"
              />
            </label>
          </span>
        </label>
      </section>
      <section v-if="correctPlan" class="block">
        <h3>Plan y financiamiento</h3>
        <div class="plan-fields">
          <label class="span-2">
            Tipo de plan
            <select
              v-model="plan.planKind"
              :disabled="isFunepet"
              @change="onPlanKindChange"
            >
              <option value="PLAN_FUTURO">Servicio funerario</option>
              <option value="PARQUE">Parque</option>
            </select>
          </label>
          <p v-if="isFunepet" class="hint span-2">
            Funepet busca solo planes de servicio funerario con Pet Plan a futuro.
          </p>
          <div class="span-2 plan-name">
            <label class="plan-name__field">
              Nombre del plan
              <input
                :value="plan.nombrePlan"
                readonly
                placeholder="Selecciona un plan con Buscar plan…"
                class="plan-name__readonly"
                @click="planSearchOpen = true"
              />
            </label>
            <button type="button" class="btn btn-ghost" @click="planSearchOpen = true">
              {{ plan.productId ? 'Cambiar plan' : 'Buscar plan' }}
            </button>
          </div>
          <p v-if="plan.productId" class="hint span-2">
            Plan #{{ plan.productId
            }}<template v-if="plan.productDefaultCode">
              · {{ plan.productDefaultCode }}</template
            >
            · {{ planPriceLabel }}
          </p>
          <label v-if="plan.planKind === 'PLAN_FUTURO'" class="span-2">
            Servicio funerario
            <input v-model="plan.servicioFunerario" />
          </label>
          <template v-if="plan.planKind === 'PARQUE'">
            <label class="check span-2">
              <input
                v-model="plan.preasignacion"
                type="checkbox"
                @change="onPreasignacionChange"
              />
              Preasignación de ubicación
            </label>
            <div class="span-2">
              <button
                type="button"
                class="btn btn-ghost"
                @click="locationSearchOpen = true"
              >
                {{
                  plan.preasignacion ? 'Buscar ubicación' : 'Buscar parque y sección'
                }}
              </button>
            </div>
            <label>
              Parque *
              <input :value="plan.parqueFuneral" readonly placeholder="—" />
            </label>
            <label>
              Sección *
              <input :value="plan.seccion" readonly placeholder="—" />
            </label>
            <template v-if="plan.preasignacion">
              <label>
                Cuadrante *
                <input :value="plan.cuadrante" readonly placeholder="—" />
              </label>
              <label>
                Ubicación *
                <input :value="plan.numero" readonly placeholder="—" />
              </label>
            </template>
          </template>
        </div>

        <h3 class="finance-title">Financiamiento</h3>
        <div class="plan-readonly">
          <div>
            <span>Precio del plan</span>
            <strong>{{ planPriceLabel }}</strong>
          </div>
          <div
            v-if="
              payload?.meta.tipoVenta === 'RECONOCIMIENTO' || recognizedBalance > 0
            "
          >
            <span>{{ recognizedLabel }}</span>
            <strong>{{ formatMoneyDisplay(recognizedBalance) || '—' }}</strong>
          </div>
          <div>
            <span>Saldo</span>
            <strong>{{ formatMoneyDisplay(finance.saldo) || '—' }}</strong>
          </div>
          <div v-if="plan.productId">
            <span>Financiamiento</span>
            <strong>{{ plan.withoutInterest ? 'Sin intereses' : 'Con intereses' }}</strong>
          </div>
        </div>
        <div v-if="descuentoEspecial > 0" class="descuento-especial">
          <strong>Descuento especial autorizado {{ Math.trunc(descuentoEspecial) }}%</strong>
          <p class="hint">
            Tope estándar: {{ maxDiscountAmount }}%.
          </p>
        </div>
        <div class="plan-fields">
          <label>
            <span>Descuento (%)</span>
            <small class="hint">Máximo permitido: {{ allowedDiscountMax }}%</small>
            <input
              v-model="finance.promocionDescuento"
              inputmode="numeric"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="0"
              @blur="clampDescuento"
            />
            <small v-if="discountError()" class="field-error">{{ discountError() }}</small>
          </label>
          <label>
            Anticipo
            <input
              v-model="finance.anticipo"
              inputmode="decimal"
              :disabled="isPagoContado"
              placeholder="0"
              @blur="clampAnticipo"
            />
          </label>
          <label>
            Frecuencia
            <select v-model="finance.frecuencia" @change="onFrecuenciaChange">
              <option value="">—</option>
              <option>SEMANAL</option>
              <option>QUINCENAL</option>
              <option>MENSUAL</option>
              <option>CONTADO</option>
            </select>
          </label>
          <label>
            Plazo (meses)
            <input
              v-model="finance.plazo"
              inputmode="numeric"
              :disabled="isPagoContado"
              placeholder="Ej. 24"
            />
          </label>
          <label class="span-2">
            <span>Importe de cada pago</span>
            <small class="hint">{{ financingHint }}</small>
            <input
              :value="formatMoneyDisplay(finance.importeCadaPago) || '—'"
              readonly
            />
          </label>
          <label class="check span-2">
            <input
              v-model="pagoInicialActivo"
              type="checkbox"
              :disabled="isPagoContado"
            />
            <span>
              Pago inicial
              <small v-if="pagoInicialActivo && finance.pagoInicial" class="hint">
                {{ formatMoneyDisplay(finance.pagoInicial) }}
              </small>
            </span>
          </label>
          <label>
            Próximo pago{{ isPagoContado ? '' : ' *' }}
            <input
              v-model="finance.fechaProximoPago"
              type="date"
              :min="todayIsoDate()"
              :disabled="isPagoContado"
            />
          </label>
          <label>
            Días específicos{{ isPagoContado ? '' : ' *' }}
            <input
              v-model="finance.diasEspecificosPago"
              :disabled="isPagoContado"
              placeholder="Ej. 5,20"
            />
            <small class="hint">
              {{
                isPagoContado
                  ? 'No aplica en pago de contado.'
                  : 'Quincenal: 5,20 · Semanal: 7,14,21,28 · Mensual: se captura a mano'
              }}
            </small>
          </label>
        </div>
      </section>
      <section v-for="section in sections" :key="section.label" class="block">
        <h3>{{ section.label }}</h3>
        <label v-for="item in section.items" :key="item.key" class="row">
          <span>{{ item.label }}</span>
          <select
            v-if="item.kind === 'field' && selectOptions(item)"
            :value="values[item.key]"
            @change="onSelect(item, $event)"
          >
            <option value="">Selecciona…</option>
            <option
              v-for="opt in selectOptions(item)"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
          <input
            v-else-if="item.kind === 'field' && isPhone(item)"
            :value="values[item.key]"
            inputmode="numeric"
            maxlength="10"
            autocomplete="tel"
            @input="onPhone(item, $event)"
          />
          <input
            v-else-if="item.kind === 'field' && isDate(item)"
            v-model="values[item.key]"
            type="date"
            :min="item.key === 'pago.fechaProximoPago' ? todayIsoDate() : undefined"
          />
          <input
            v-else-if="item.kind === 'field' && isEmail(item)"
            v-model="values[item.key]"
            type="email"
            autocomplete="email"
          />
          <input
            v-else-if="item.kind === 'field' && isCp(item)"
            :value="values[item.key]"
            inputmode="numeric"
            maxlength="5"
            @input="onDigits(item, $event, 5)"
          />
          <input
            v-else-if="item.kind === 'field' && isRfc(item)"
            :value="values[item.key]"
            maxlength="13"
            placeholder="12 o 13 caracteres"
            @input="onUpper(item, $event)"
          />
          <input
            v-else-if="item.kind === 'field' && isCurp(item)"
            :value="values[item.key]"
            maxlength="18"
            @input="onUpper(item, $event)"
          />
          <input
            v-else-if="item.kind === 'field' && isDecimal(item)"
            :value="values[item.key]"
            inputmode="decimal"
            :disabled="isPagoInicialLocked(item)"
            @input="onDecimal(item, $event)"
          />
          <input
            v-else-if="item.kind === 'field' && isMoney(item)"
            :value="values[item.key]"
            inputmode="numeric"
            :disabled="isPlazoLocked(item)"
            @input="onDigits(item, $event, 19)"
          />
          <input
            v-else
            :value="values[item.key]"
            type="text"
            @input="onUpper(item, $event)"
          />
          <small v-if="isPhone(item) && mxPhoneError(values[item.key])" class="field-error">
            {{ mxPhoneError(values[item.key]) }}
          </small>
        </label>
      </section>
    </div>
    <div class="actions">
      <button type="button" class="btn btn-ghost" @click="emit('close')">Cerrar</button>
      <button type="button" class="btn btn-accent" :disabled="saving || loading" @click="submit">
        {{ saving ? 'Guardando…' : 'Guardar corrección' }}
      </button>
    </div>
  </VdModal>
  <SalePlanSearchModal
    :open="planSearchOpen"
    :plan-kind="plan.planKind"
    :favorite-plans="favoritePlans"
    :pet-future-plan="isFunepet"
    @close="planSearchOpen = false"
    @select="onPlanSelected"
  />
  <SaleLocationSearchModal
    :open="locationSearchOpen"
    :stop-at="plan.preasignacion ? 'espacio' : 'seccion'"
    @close="locationSearchOpen = false"
    @select="onLocationSelected"
  />
</template>

<style scoped>
.lead {
  margin: 0 0 0.8rem;
}

.sections {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-height: 60vh;
  overflow: auto;
}

.block {
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  padding: 0.7rem 0.8rem;
}

.block h3 {
  margin: 0 0 0.55rem;
  font-size: 0.95rem;
}

.row {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 0.55rem;
  font-size: 0.88rem;
}

.plan-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem 0.7rem;
}

.plan-fields label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.88rem;
}

.plan-fields .span-2 {
  grid-column: 1 / -1;
}

.plan-fields input,
.plan-fields select {
  width: 100%;
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

.plan-fields input:focus,
.plan-fields select:focus {
  outline: 2px solid var(--accent);
  border-color: var(--accent);
}

.plan-fields input[readonly] {
  background: #f3f5f7;
  cursor: pointer;
}

.plan-fields select:disabled {
  background: #f3f5f7;
  color: var(--vd-ink);
}

.plan-name {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.plan-name__field {
  flex: 1;
}

.plan-fields .check {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.plan-fields .check input {
  width: auto;
  min-height: 0;
}

.finance-title {
  margin: 1rem 0 0.55rem;
}

.plan-readonly {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem 0.7rem;
  margin-bottom: 0.7rem;
  padding: 0.65rem 0.7rem;
  border-radius: 10px;
  background: #f7f9fb;
}

.plan-readonly span {
  display: block;
  color: var(--vd-muted);
  font-size: 0.78rem;
}

.plan-readonly strong {
  font-variant-numeric: tabular-nums;
}

.descuento-especial {
  margin-bottom: 0.7rem;
}

.hint {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.84rem;
}

.row input,
.row select {
  width: 100%;
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

.row input:not([type='email']):not([type='date']):not([inputmode='numeric']):not([inputmode='decimal']) {
  text-transform: uppercase;
}

.row input:focus,
.row select:focus {
  outline: 2px solid var(--accent);
  border-color: var(--accent);
}

.row input:disabled,
.row select:disabled {
  background: #f3f5f7;
  color: var(--vd-ink);
}

.finance {
  background: #f7f9fb;
}

.finance-note {
  margin: 0 0 0.55rem;
  color: var(--vd-muted);
  font-size: 0.84rem;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.4rem;
  font-size: 0.92rem;
}

.calc-row strong {
  font-variant-numeric: tabular-nums;
}

.file-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.file-btn {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  background: #fff;
  color: var(--gsm-blue, var(--primary));
  font-weight: 650;
  cursor: pointer;
}

.file-btn input {
  display: none;
}

.field-error {
  color: #b42318;
  font-weight: 600;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.muted {
  color: var(--vd-muted);
}
</style>
