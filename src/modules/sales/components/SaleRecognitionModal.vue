<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { extractApiError } from '../../../shared/api/http';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import {
  formatMoneyDisplay,
  paidOnRecognizedSale,
  totalRecognizedPaid,
} from '../utils/sale-finance';
import {
  clienteDisplayName,
  listClienteActivas,
  listClienteSuspendidas,
  searchCatalogClientes,
  type CatalogCliente,
} from '../utils/odoo-clientes';
import type { ReconocimientoVenta } from '../types/sale-form';
import { forceCaptureTextUppercase } from '../utils/sale-text';
import { saleKindLabel, type SaleKind } from '../constants/sale-kinds';

const props = withDefaults(
  defineProps<{
    open: boolean;
    kind?: SaleKind;
  }>(),
  { kind: 'RECONOCIMIENTO' },
);

const emit = defineEmits<{
  close: [];
  back: [];
  apply: [payload: { cliente: CatalogCliente; ventas: ReconocimientoVenta[] }];
}>();

const step = ref<'cliente' | 'ventas'>('cliente');
const q = ref('');
const results = ref<CatalogCliente[]>([]);
const cliente = ref<CatalogCliente | null>(null);
const loading = ref(false);
const error = ref('');
const salesLoading = ref(false);
const salesError = ref('');
const titular = ref<ReconocimientoVenta[]>([]);
const beneficiario = ref<ReconocimientoVenta[]>([]);
const selectedIds = reactive(new Set<number>());
let timer: ReturnType<typeof setTimeout> | null = null;

const isPlanChange = computed(
  () => props.kind === 'MEJORA' || props.kind === 'MINORIA',
);
const kindTitle = computed(() => saleKindLabel(props.kind));
const modalTitle = computed(() =>
  step.value === 'cliente'
    ? `${kindTitle.value} · Cliente`
    : `${kindTitle.value} · Ventas`,
);

const ventas = computed(() => [...titular.value, ...beneficiario.value]);

const selectedVentas = computed(() =>
  ventas.value.filter((item) => selectedIds.has(item.id)),
);

const selectedTotal = computed(() => totalRecognizedPaid(selectedVentas.value));

const listsEmpty = computed(
  () => !salesLoading.value && !ventas.value.length,
);

const canApply = computed(() => {
  if (!cliente.value || step.value !== 'ventas' || salesLoading.value) {
    return false;
  }
  if (isPlanChange.value) return selectedVentas.value.length > 0;
  if (listsEmpty.value) return true;
  return selectedVentas.value.length > 0;
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    reset();
  },
);

function reset() {
  if (timer) clearTimeout(timer);
  step.value = 'cliente';
  q.value = '';
  results.value = [];
  cliente.value = null;
  loading.value = false;
  error.value = '';
  salesLoading.value = false;
  salesError.value = '';
  titular.value = [];
  beneficiario.value = [];
  selectedIds.clear();
}

function onInput() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void search();
  }, 350);
}

async function search() {
  const term = q.value.trim();
  results.value = [];
  if (term.length < 3) {
    error.value = term ? 'Escribe al menos 3 caracteres' : '';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    results.value = await searchCatalogClientes(term, 20);
    if (!results.value.length) error.value = 'Sin coincidencias';
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudo buscar el cliente');
  } finally {
    loading.value = false;
  }
}

async function selectCliente(row: CatalogCliente) {
  cliente.value = row;
  selectedIds.clear();
  titular.value = [];
  beneficiario.value = [];
  salesError.value = '';
  step.value = 'ventas';
  salesLoading.value = true;
  try {
    const data = isPlanChange.value
      ? await listClienteActivas(row.id)
      : await listClienteSuspendidas(row.id);
    titular.value = data.titular;
    beneficiario.value = data.beneficiario;
  } catch (e: unknown) {
    salesError.value = extractApiError(
      e,
      'No se pudieron cargar las ventas',
    );
  } finally {
    salesLoading.value = false;
  }
}

function backToCliente() {
  step.value = 'cliente';
  selectedIds.clear();
  titular.value = [];
  beneficiario.value = [];
  salesError.value = '';
}

function toggleVenta(id: number) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
}

function apply() {
  if (!cliente.value || !canApply.value) return;
  emit('apply', {
    cliente: cliente.value,
    ventas: selectedVentas.value,
  });
}

function money(value: number) {
  return formatMoneyDisplay(value) || '$0.00';
}

function origenLabel(v: ReconocimientoVenta) {
  return v.matchType === 'beneficiario'
    ? 'Como beneficiario'
    : 'Del cliente';
}
</script>

<template>
  <VdModal :open="open" :title="modalTitle" wide @close="emit('close')">
    <div class="recog">
      <template v-if="step === 'cliente'">
        <p class="hint">Paso 1 de 2. Busca y elige al cliente.</p>
        <label>
          Nombre del cliente
          <input
            v-model="q"
            type="search"
            placeholder="ESCRIBE PARA BUSCAR…"
            autocomplete="off"
            @input.capture="forceCaptureTextUppercase"
            @input="onInput"
          />
        </label>
        <p v-if="loading" class="hint">Buscando…</p>
        <p v-else-if="error" class="err">{{ error }}</p>
        <ul v-if="results.length" class="list">
          <li v-for="c in results" :key="c.id">
            <button type="button" class="item" @click="selectCliente(c)">
              <strong>{{ clienteDisplayName(c) }}</strong>
              <small>
                {{ c.contacto.curp || 'Sin CURP' }}
                <template v-if="c.contacto.celular1">
                  · {{ c.contacto.celular1 }}
                </template>
              </small>
            </button>
          </li>
        </ul>
      </template>

      <template v-else>
        <p class="hint">
          Paso 2 de 2. Elige las ventas
          {{ isPlanChange ? 'activas' : 'a reconocer' }} de
          <strong>{{ cliente ? clienteDisplayName(cliente) : 'este cliente' }}</strong>.
        </p>
        <p v-if="salesLoading" class="hint">Cargando ventas…</p>
        <p v-else-if="salesError" class="err">{{ salesError }}</p>
        <p v-else-if="listsEmpty" class="hint">
          <template v-if="isPlanChange">
            No hay ventas activas de este cliente ni donde aparezca como
            beneficiario.
          </template>
          <template v-else>
            No hay ventas suspendidas de este cliente ni donde aparezca como
            beneficiario. Puedes aplicar solo sus datos.
          </template>
        </p>
        <ul v-else class="list list--sales">
          <li v-for="v in ventas" :key="v.id">
            <label class="sale">
              <input
                type="checkbox"
                :checked="selectedIds.has(v.id)"
                @change="toggleVenta(v.id)"
              />
              <span>
                <strong>{{ v.folio || `Venta #${v.id}` }}</strong>
                <small>
                  {{ origenLabel(v) }}
                  · A reconocer {{ money(paidOnRecognizedSale(v)) }}
                  <template v-if="v.dateOrder"> · {{ v.dateOrder }}</template>
                  <template v-if="v.matchType === 'beneficiario' && v.partnerName">
                    · {{ v.partnerName }}
                  </template>
                </small>
              </span>
            </label>
          </li>
        </ul>
        <p v-if="selectedVentas.length" class="total">
          Saldo a reconocer:
          <strong>{{ money(selectedTotal) }}</strong>
        </p>
      </template>
    </div>
    <template #footer>
      <button
        v-if="step === 'ventas'"
        type="button"
        class="btn btn-ghost"
        @click="backToCliente"
      >
        Atrás
      </button>
      <button type="button" class="btn btn-ghost" @click="emit('back')">
        Regresar
      </button>
      <button
        v-if="step === 'ventas'"
        type="button"
        class="btn btn-primary"
        :disabled="!canApply"
        @click="apply"
      >
        Aplicar
      </button>
    </template>
  </VdModal>
</template>

<style scoped>
.recog {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.recog label:not(.sale) {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--gsm-blue);
}

.recog input[type='search'] {
  width: 100%;
  min-height: 46px;
  box-sizing: border-box;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  background: #fff;
  color: inherit;
  font: inherit;
  font-size: 16px;
  text-transform: uppercase;
}

.recog input[type='search']:focus {
  outline: 2px solid var(--accent, #cca079);
  border-color: var(--gsm-blue);
}

.hint {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.88rem;
}

.hint strong {
  color: var(--gsm-blue);
}

.err {
  margin: 0;
  color: #b42318;
  font-size: 0.88rem;
  font-weight: 600;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 320px;
  overflow: auto;
}

.list--sales {
  max-height: 360px;
}

.item,
.sale {
  width: 100%;
  display: flex;
  text-align: left;
  border: 1px solid var(--vd-line);
  background: #fff;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  color: inherit;
}

.item {
  flex-direction: column;
  gap: 0.15rem;
  cursor: pointer;
}

.item:hover,
.sale:hover {
  border-color: var(--gsm-blue);
  background: #f4f8fa;
}

.sale:has(input:checked) {
  border-color: var(--gsm-blue);
  background: #eef5f8;
}

.item strong,
.sale strong {
  font-size: 0.9rem;
}

.item small,
.sale small {
  display: block;
  color: var(--vd-muted);
  font-size: 0.75rem;
}

.sale {
  align-items: flex-start;
  gap: 0.65rem;
  cursor: pointer;
}

.sale input[type='checkbox'] {
  width: 1.15rem;
  height: 1.15rem;
  min-width: 1.15rem;
  min-height: 1.15rem;
  margin: 0.2rem 0 0;
  accent-color: var(--gsm-blue);
  flex-shrink: 0;
}

.sale span {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.total {
  margin: 0.15rem 0 0;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  background: #f7f9fb;
  color: var(--gsm-blue);
  font-size: 0.88rem;
  font-weight: 600;
}

.total strong {
  color: var(--vd-ink, #1a2430);
  font-size: 1.05rem;
}
</style>
