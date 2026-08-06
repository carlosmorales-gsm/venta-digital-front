<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import { createPrefillPago, type SaleFormData } from '../types/sale-form';

type PaymentTab = 'plan' | 'pago';

const props = defineProps<{
  open: boolean;
  form: SaleFormData;
  saving?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [pago: SaleFormData['pago']];
}>();

const tab = ref<PaymentTab>('plan');
const pago = reactive({ ...props.form.pago });

watch(
  () => props.open,
  (open) => {
    if (open) {
      const src = props.form.pago;
      Object.assign(
        pago,
        src.precioPlan?.trim() ? src : { ...src, ...createPrefillPago() },
      );
      tab.value = 'plan';
    }
  },
);
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
      <div class="tabs" role="tablist" aria-label="Secciones de pago">
        <button
          type="button"
          class="tab"
          :class="{ active: tab === 'plan' }"
          @click="tab = 'plan'"
        >
          Datos del plan
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: tab === 'pago' }"
          @click="tab = 'pago'"
        >
          Datos del pago
        </button>
      </div>

      <div v-show="tab === 'plan'" class="fields">
        <label class="span-2">
          Precio del plan
          <input v-model="pago.precioPlan" inputmode="decimal" />
        </label>
        <label>
          Frecuencia
          <select v-model="pago.frecuencia">
            <option value="">—</option>
            <option>SEMANAL</option>
            <option>QUINCENAL</option>
            <option>MENSUAL</option>
          </select>
        </label>
        <label>
          Plazo
          <input v-model="pago.plazo" />
        </label>
        <label class="span-2">
          Promoción / descuento
          <input v-model="pago.promocionDescuento" />
        </label>
        <label>
          Próximo pago
          <input v-model="pago.fechaProximoPago" type="date" />
        </label>
        <label>
          Días específicos
          <input v-model="pago.diasEspecificosPago" />
        </label>
      </div>

      <div v-show="tab === 'pago'" class="fields">
        <label>
          Anticipo
          <input v-model="pago.anticipo" inputmode="decimal" />
        </label>
        <label>
          Pago inicial
          <input v-model="pago.pagoInicial" inputmode="decimal" />
        </label>
        <label>
          Importe de cada pago
          <input v-model="pago.importeCadaPago" inputmode="decimal" />
        </label>
        <label>
          Saldo
          <input v-model="pago.saldo" inputmode="decimal" />
        </label>
        <label class="span-2">
          Forma de pago
          <select v-model="pago.formaPago">
            <option value="">—</option>
            <option>TRANSFERENCIA</option>
            <option>EFECTIVO</option>
            <option>CHEQUE</option>
          </select>
        </label>
        <label>
          Cuenta
          <input v-model="pago.cuenta" />
        </label>
        <label>
          Banco
          <input v-model="pago.banco" />
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
        :disabled="saving || !pago.precioPlan.trim()"
        @click="emit('save', { ...pago })"
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
