<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import {
  BANK_OPTIONS,
  BANK_OTHER,
  isOtherBank,
} from '../constants/mexican-banks';
import { createPrefillPago, type SaleFormData } from '../types/sale-form';
import { parseMoney } from '../utils/sale-finance';

const props = defineProps<{
  open: boolean;
  form: SaleFormData;
  saving?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [pago: SaleFormData['pago']];
}>();

const pago = reactive({ ...props.form.pago });
const bancoChoice = ref('');
const bancoOtro = ref('');

const showBancoOtro = computed(() => isOtherBank(bancoChoice.value));

const isEfectivo = computed(
  () => String(pago.formaPago || '').trim().toUpperCase() === 'EFECTIVO',
);
const formaPagoNorm = computed(() =>
  String(pago.formaPago || '').trim().toUpperCase(),
);
const showBankFields = computed(
  () => formaPagoNorm.value === 'TRANSFERENCIA' || formaPagoNorm.value === 'CHEQUE',
);
const showCashFields = computed(() => isEfectivo.value);
const requiresCuenta = computed(() => formaPagoNorm.value === 'TRANSFERENCIA');

function formatMoneyLabel(raw: string) {
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n) || !String(raw).trim()) return '—';
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

function formatMoneyNumber(n: number) {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

const anticipoDue = computed(() =>
  parseMoney(props.form.pago.anticipo || pago.anticipo),
);

const anticipoLabel = computed(() =>
  formatMoneyLabel(props.form.pago.anticipo || pago.anticipo),
);

const cambioAmount = computed(() => {
  if (!showCashFields.value) return 0;
  const received = parseMoney(pago.montoRecibido);
  if (!received) return 0;
  return Math.max(0, received - anticipoDue.value);
});

const cambioLabel = computed(() => {
  if (!showCashFields.value) return '—';
  const received = parseMoney(pago.montoRecibido);
  if (!received) return '—';
  if (received < anticipoDue.value) {
    return `Faltan ${formatMoneyNumber(anticipoDue.value - received)}`;
  }
  return formatMoneyNumber(cambioAmount.value);
});

const cambioInsufficient = computed(() => {
  if (!showCashFields.value) return false;
  const received = parseMoney(pago.montoRecibido);
  return received > 0 && received < anticipoDue.value;
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    const src = props.form.pago;
    const merged = src.precioPlan?.trim()
      ? { ...src }
      : { ...src, ...createPrefillPago(), ...src };
    Object.assign(pago, merged, {
      precioPlan: props.form.ubicacionPlan.precioPlan || merged.precioPlan,
      anticipo: props.form.pago.anticipo || merged.anticipo,
      pagoInicial: props.form.pago.pagoInicial || merged.pagoInicial,
      importeCadaPago: props.form.pago.importeCadaPago || merged.importeCadaPago,
      saldo: props.form.pago.saldo || merged.saldo,
      frecuencia: props.form.pago.frecuencia || merged.frecuencia,
      plazo: props.form.pago.plazo || merged.plazo,
      promocionDescuento:
        props.form.pago.promocionDescuento || merged.promocionDescuento,
      fechaProximoPago:
        props.form.pago.fechaProximoPago || merged.fechaProximoPago,
      diasEspecificosPago:
        props.form.pago.diasEspecificosPago || merged.diasEspecificosPago,
      montoRecibido: props.form.pago.montoRecibido || merged.montoRecibido || '',
      cambio: props.form.pago.cambio || merged.cambio || '',
    });

    const bank = (pago.banco || '').trim();
    if (!bank) {
      bancoChoice.value = '';
      bancoOtro.value = '';
    } else if ((BANK_OPTIONS as readonly string[]).includes(bank)) {
      bancoChoice.value = bank;
      bancoOtro.value = '';
    } else {
      bancoChoice.value = BANK_OTHER;
      bancoOtro.value = bank;
    }
  },
);

watch(
  () => pago.formaPago,
  (method) => {
    const forma = String(method || '').trim().toUpperCase();
    if (forma === 'EFECTIVO') {
      pago.cuenta = '';
      bancoChoice.value = '';
      bancoOtro.value = '';
      return;
    }
    pago.montoRecibido = '';
    pago.cambio = '';
    if (forma === 'CHEQUE') {
      pago.cuenta = '';
    }
  },
);

function resolveBanco() {
  if (isOtherBank(bancoChoice.value)) return bancoOtro.value.trim();
  return bancoChoice.value.trim();
}

function resolveCambio() {
  const received = parseMoney(pago.montoRecibido);
  const change = received - anticipoDue.value;
  if (!Number.isFinite(change) || change <= 0) return '0';
  return String(Number(change.toFixed(2)));
}

function onSave() {
  const fromPlan = props.form.pago;
  emit('save', {
    ...pago,
    precioPlan:
      props.form.ubicacionPlan.precioPlan ||
      fromPlan.precioPlan ||
      pago.precioPlan,
    anticipo: fromPlan.anticipo || pago.anticipo,
    pagoInicial: fromPlan.pagoInicial || pago.pagoInicial,
    importeCadaPago: fromPlan.importeCadaPago || pago.importeCadaPago,
    saldo: fromPlan.saldo || pago.saldo,
    frecuencia: fromPlan.frecuencia || pago.frecuencia,
    plazo: fromPlan.plazo || pago.plazo,
    promocionDescuento: fromPlan.promocionDescuento || pago.promocionDescuento,
    fechaProximoPago: fromPlan.fechaProximoPago || pago.fechaProximoPago,
    diasEspecificosPago:
      fromPlan.diasEspecificosPago || pago.diasEspecificosPago,
    cuenta: isEfectivo.value ? '' : requiresCuenta.value ? pago.cuenta.trim() : '',
    banco: isEfectivo.value ? '' : resolveBanco(),
    montoRecibido: isEfectivo.value ? pago.montoRecibido.trim() : '',
    cambio: isEfectivo.value ? resolveCambio() : '',
  });
}

const canSave = computed(() => {
  const precio =
    props.form.ubicacionPlan.precioPlan ||
    props.form.pago.precioPlan ||
    pago.precioPlan;
  if (!String(precio || '').trim()) return false;

  const forma = formaPagoNorm.value;
  if (!forma) return false;
  if (anticipoDue.value <= 0) return false;

  if (forma === 'EFECTIVO') {
    const received = parseMoney(pago.montoRecibido);
    return received >= anticipoDue.value;
  }

  if (forma === 'TRANSFERENCIA' || forma === 'CHEQUE') {
    const banco = resolveBanco();
    if (!banco) return false;
    if (isOtherBank(bancoChoice.value) && !bancoOtro.value.trim()) return false;
    if (requiresCuenta.value && !pago.cuenta.trim()) return false;
    return true;
  }

  return false;
});
</script>

<template>
  <VdModal
    :open="open"
    title="Registrar pago"
    wide
    :close-on-scrim="!saving"
    @close="emit('close')"
  >
    <div class="payment-form">
      <p class="hint">
        Plan y financiamiento se capturan en la venta. Aquí solo registras la
        forma de pago.
      </p>

      <div class="amount-label">
        <span>Importe a pagar (anticipo)</span>
        <strong>{{ anticipoLabel }}</strong>
      </div>

      <div class="fields">
        <label class="span-2">
          Forma de pago
          <select v-model="pago.formaPago">
            <option value="">—</option>
            <option>TRANSFERENCIA</option>
            <option>EFECTIVO</option>
            <option>CHEQUE</option>
          </select>
        </label>

        <template v-if="showCashFields">
          <label>
            Efectivo recibido
            <input
              v-model="pago.montoRecibido"
              inputmode="decimal"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </label>
          <div class="cash-change">
            <span>Cambio</span>
            <strong :class="{ 'cash-change--warn': cambioInsufficient }">
              {{ cambioLabel }}
            </strong>
          </div>
        </template>

        <label v-if="showBankFields && requiresCuenta">
          Cuenta
          <input v-model="pago.cuenta" />
        </label>
        <label v-if="showBankFields">
          Banco
          <select v-model="bancoChoice">
            <option value="">—</option>
            <option v-for="b in BANK_OPTIONS" :key="b" :value="b">
              {{ b }}
            </option>
          </select>
        </label>
        <label v-if="showBankFields && showBancoOtro" class="span-2">
          Nombre del banco
          <input
            v-model="bancoOtro"
            placeholder="Escribe el banco"
            autocomplete="organization"
          />
        </label>
        <label class="span-2">
          Jefe de ventas
          <input v-model="pago.nombreJefeVentas" />
        </label>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-ghost"
        :disabled="saving"
        @click="emit('close')"
      >
        Cancelar
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="saving || !canSave"
        @click="onSave"
      >
        {{ saving ? 'Guardando…' : 'Guardar pago' }}
      </button>
    </template>
  </VdModal>
</template>

<style scoped>
.payment-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.hint {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.88rem;
  line-height: 1.4;
}

.amount-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  background: #f7f9fb;
}

.amount-label > span {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--gsm-blue);
}

.amount-label > strong {
  font-size: 1.2rem;
  color: var(--vd-ink, #1a2430);
}

.cash-change {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  background: #fff;
  justify-content: center;
}

.cash-change > span {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--gsm-blue);
}

.cash-change > strong {
  font-size: 1.05rem;
  color: var(--vd-ink, #1a2430);
}

.cash-change--warn {
  color: #b42318;
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem 0.85rem;
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

.span-2 {
  grid-column: 1 / -1;
}

.fields input,
.fields select {
  width: 100%;
  box-sizing: border-box;
  min-height: 46px;
  font: inherit;
  font-size: 16px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  color: var(--vd-ink);
  background: #fff;
}

@media (max-width: 600px) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
