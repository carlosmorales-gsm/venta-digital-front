<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import {
  BANK_OPTIONS,
  BANK_OTHER,
  isOtherBank,
} from '../constants/mexican-banks';
import { createPrefillPago, type SaleFormData } from '../types/sale-form';
import { moneyInputText, parseMoney, paymentDueAmount } from '../utils/sale-finance';

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
const isTarjeta = computed(() => formaPagoNorm.value.startsWith('TARJETA'));
const showBankFields = computed(
  () =>
    formaPagoNorm.value === 'TRANSFERENCIA' ||
    formaPagoNorm.value === 'CHEQUE' ||
    isTarjeta.value,
);
const showCashFields = computed(() => isEfectivo.value);
const requiresCuenta = computed(
  () => formaPagoNorm.value === 'TRANSFERENCIA' || isTarjeta.value,
);

function formatMoneyNumber(n: number) {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

const amountDue = computed(() =>
  paymentDueAmount({
    pagoInicial: props.form.pago.pagoInicial || pago.pagoInicial,
    anticipo: props.form.pago.anticipo || pago.anticipo,
  }),
);

const amountDueLabel = computed(() => formatMoneyNumber(amountDue.value));

const amountDueCaption = computed(() => {
  const inicial = parseMoney(props.form.pago.pagoInicial || pago.pagoInicial);
  const anticipo = parseMoney(props.form.pago.anticipo || pago.anticipo);
  if (inicial > 0 && anticipo > 0 && inicial !== anticipo) {
    return `Pago inicial (anticipo en contrato: ${formatMoneyNumber(anticipo)})`;
  }
  if (inicial > 0) return 'Pago inicial';
  return 'Anticipo';
});

const cambioAmount = computed(() => {
  if (!showCashFields.value) return 0;
  const received = parseMoney(moneyInputText(pago.montoRecibido));
  if (!received) return 0;
  return Math.max(0, received - amountDue.value);
});

const cambioLabel = computed(() => {
  if (!showCashFields.value) return '—';
  const received = parseMoney(moneyInputText(pago.montoRecibido));
  if (!received) return '—';
  if (received + 0.001 < amountDue.value) {
    return `Faltan ${formatMoneyNumber(amountDue.value - received)}`;
  }
  return formatMoneyNumber(cambioAmount.value);
});

const cambioInsufficient = computed(() => {
  if (!showCashFields.value) return false;
  const received = parseMoney(moneyInputText(pago.montoRecibido));
  return received > 0 && received + 0.001 < amountDue.value;
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
      pago.banco = '';
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
  const received = parseMoney(moneyInputText(pago.montoRecibido));
  const change = received - amountDue.value;
  if (!Number.isFinite(change) || change <= 0) return '0';
  return String(Number(change.toFixed(2)));
}

function onSave() {
  if (saveBlockReason.value) return;

  const fromPlan = props.form.pago;
  const montoRecibido = moneyInputText(pago.montoRecibido);
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
    cuenta: isEfectivo.value
      ? ''
      : requiresCuenta.value
        ? pago.cuenta.trim()
        : '',
    banco: isEfectivo.value ? '' : resolveBanco(),
    montoRecibido: isEfectivo.value ? montoRecibido : '',
    cambio: isEfectivo.value ? resolveCambio() : '',
  });
}

const canSave = computed(() => saveBlockReason.value === null);

const saveBlockReason = computed((): string | null => {
  if (!props.open) return 'Completa los datos de pago.';

  const precio =
    props.form.ubicacionPlan.precioPlan ||
    props.form.pago.precioPlan ||
    pago.precioPlan;
  if (!String(precio || '').trim()) {
    return 'La venta no tiene precio de plan; revisa la captura.';
  }

  const forma = formaPagoNorm.value;
  if (!forma) return 'Selecciona la forma de pago.';

  if (amountDue.value <= 0) {
    return 'Captura pago inicial o anticipo en la venta antes de registrar el pago.';
  }

  if (forma === 'EFECTIVO') {
    const received = parseMoney(moneyInputText(pago.montoRecibido));
    if (!received) return 'Indica el efectivo recibido.';
    if (received + 0.001 < amountDue.value) {
      return `El efectivo debe cubrir al menos ${amountDueLabel.value}.`;
    }
    return null;
  }

  if (
    forma === 'TRANSFERENCIA' ||
    forma === 'CHEQUE' ||
    forma === 'TARJETA DEBITO' ||
    forma === 'TARJETA CREDITO'
  ) {
    const banco = resolveBanco();
    if (!banco) return 'Selecciona el banco.';
    if (isOtherBank(bancoChoice.value) && !bancoOtro.value.trim()) {
      return 'Escribe el nombre del banco.';
    }
    if (requiresCuenta.value && !pago.cuenta.trim()) {
      return forma.startsWith('TARJETA')
        ? 'Indica la cuenta de la tarjeta.'
        : 'Indica la cuenta de transferencia.';
    }
    return null;
  }

  return 'Forma de pago no válida.';
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
        <span>{{ amountDueCaption }}</span>
        <strong>{{ amountDueLabel }}</strong>
      </div>

      <p v-if="!canSave" class="validation-hint">
        {{ saveBlockReason }}
      </p>

      <div class="fields">
        <label class="span-2">
          Forma de pago
          <select v-model="pago.formaPago">
            <option value="">—</option>
            <option>TRANSFERENCIA</option>
            <option>EFECTIVO</option>
            <option>CHEQUE</option>
            <option value="TARJETA DEBITO">TARJETA DÉBITO</option>
            <option value="TARJETA CREDITO">TARJETA CRÉDITO</option>
          </select>
        </label>

        <template v-if="showCashFields">
          <label>
            Efectivo recibido
            <input
              v-model="pago.montoRecibido"
              inputmode="decimal"
              placeholder="0.00"
              autocomplete="off"
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
        :disabled="saving"
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

.validation-hint {
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 8px;
  background: rgba(196, 40, 28, 0.08);
  color: #a82218;
  font-size: 0.84rem;
  line-height: 1.35;
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
