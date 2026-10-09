<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { http } from '../../../shared/api/http';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import { BANK_OPTIONS } from '../constants/mexican-banks';
import {
  FISCAL_REGIMEN_CARTA,
  FISCAL_REGIMEN_OTROS,
  TIPO_PERSONA_OPTIONS,
} from '../constants/fiscal-regimes';
import { SALE_KINDS } from '../constants/sale-kinds';
import { SALE_ORIGIN_OPTIONS } from '../constants/sale-origins';
import type { SaleFormData } from '../types/sale-form';
import { fileToAttachment } from '../utils/file-to-attachment';
import {
  CORRECTION_FIELDS,
  correctionFileTargets,
  displayCorrectionValue,
  readPath,
  type CorrectionFieldDef,
} from '../utils/correction-fields';
import {
  FINANCE_DRIVER_KEYS,
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

const selected = computed(() => {
  const wanted = new Set(props.fields);
  return CORRECTION_FIELDS.filter(
    (item) => wanted.has(item.key) && item.kind === 'field',
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
      for (const item of selected.value) {
        if (item.kind === 'field') {
          values[item.key] = displayCorrectionValue(readPath(data.payload, item.key));
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
  return item.key.endsWith('fechaNacimiento') || item.key.endsWith('fechaServicio');
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

async function submit() {
  if (!props.saleId || saving.value) return;
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
  for (const [key, file] of Object.entries(files)) body[key] = file;
  try {
    await http.post(`/sales/${props.saleId}/correction`, { values: body });
    emit('saved');
    emit('close');
  } catch {
    error.value = 'No se pudo guardar la corrección';
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
          Anticipo, frecuencia y plazo recalculan estos importes. Así quedan con los datos de esta corrección.
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
