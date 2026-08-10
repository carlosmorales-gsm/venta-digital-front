<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { extractApiError, http } from '../../../shared/api/http';
import { useDialog } from '../../../shared/ui/dialog';

type SettingsDto = {
  draftLimit: number;
  draftTtlHours: number;
  maxDiscountAmount: number;
  updatedAt?: string | null;
};

const router = useRouter();
const { alert } = useDialog();

const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const form = reactive({
  draftLimit: 3,
  draftTtlHours: 24,
  maxDiscountAmount: 0,
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { data } = await http.get<SettingsDto>('/settings');
    form.draftLimit = data.draftLimit;
    form.draftTtlHours = data.draftTtlHours;
    form.maxDiscountAmount = Number(data.maxDiscountAmount) || 0;
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudo cargar la configuración');
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (form.draftLimit < 1 || form.draftTtlHours < 1) {
    await alert({
      title: 'Configuración',
      message: 'Los valores de borrador deben ser al menos 1.',
      variant: 'warning',
    });
    return;
  }
  if (form.maxDiscountAmount < 0 || form.maxDiscountAmount > 100) {
    await alert({
      title: 'Configuración',
      message: 'El descuento máximo debe estar entre 0 y 100%.',
      variant: 'warning',
    });
    return;
  }
  saving.value = true;
  try {
    const { data } = await http.patch<SettingsDto>('/settings', {
      draftLimit: Number(form.draftLimit),
      draftTtlHours: Number(form.draftTtlHours),
      maxDiscountAmount: Number(form.maxDiscountAmount),
    });
    form.draftLimit = data.draftLimit;
    form.draftTtlHours = data.draftTtlHours;
    form.maxDiscountAmount = Number(data.maxDiscountAmount) || 0;
    await alert({
      title: 'Configuración',
      message: 'Cambios guardados.',
      variant: 'success',
    });
  } catch (e: unknown) {
    await alert({
      title: 'Configuración',
      message: extractApiError(e, 'No se pudo guardar'),
      variant: 'danger',
    });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="settings-page">
    <header class="page-head head-row">
      <div class="head-copy">
        <h1>Configuración</h1>
        <p>Parámetros operativos del sistema (administrador).</p>
      </div>
      <button
        type="button"
        class="btn btn-ghost head-back"
        @click="router.push({ name: 'monitor-menu' })"
      >
        Volver
      </button>
    </header>

    <div class="panel form-panel">
      <h2>Borradores de venta</h2>
      <p class="section-help">
        Define cuántos borradores puede tener un vendedor y por cuántas horas
        permanecen activos desde el último guardado.
      </p>

      <p v-if="error" class="error-text" role="alert">{{ error }}</p>

      <div v-if="loading" class="loading">
        <span class="spinner" />
        Cargando…
      </div>

      <form v-else class="fields" @submit.prevent="save">
        <label>
          Límite de borradores por vendedor
          <input
            v-model.number="form.draftLimit"
            type="number"
            min="1"
            max="50"
            step="1"
            required
          />
        </label>
        <label>
          Tiempo de vigencia (horas)
          <input
            v-model.number="form.draftTtlHours"
            type="number"
            min="1"
            max="720"
            step="1"
            required
          />
          <small>Ej. 24 = un día. Al guardar el borrador se reinicia el plazo.</small>
        </label>

        <h2 class="subhead">Descuentos</h2>
        <p class="section-help">
          Porcentaje máximo global que puede aplicar un vendedor. Descuentos
          mayores se autorizan en la pantalla Descuentos.
        </p>
        <label>
          Porcentaje máximo de descuento (%)
          <input
            v-model.number="form.maxDiscountAmount"
            type="number"
            min="0"
            max="100"
            step="0.01"
            required
          />
        </label>

        <div class="actions">
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.head-back {
  flex-shrink: 0;
}

.form-panel h2 {
  margin: 0 0 0.35rem;
  font-size: 1.1rem;
  color: var(--gsm-blue);
}

.form-panel h2.subhead {
  margin-top: 1.25rem;
}

.section-help {
  margin: 0 0 1rem;
  color: var(--vd-muted);
  font-size: 0.92rem;
  line-height: 1.4;
}

.fields {
  display: grid;
  gap: 1rem;
  max-width: 28rem;
}

.fields label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--vd-ink, #1a2430);
}

.fields input {
  border: 1px solid var(--vd-line);
  border-radius: var(--vd-radius-sm, 8px);
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-weight: 500;
  min-height: 44px;
}

.fields small {
  font-weight: 500;
  color: var(--vd-muted);
  font-size: 0.8rem;
}

.actions {
  margin-top: 0.25rem;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--vd-muted);
}

.error-text {
  color: #b42318;
  font-weight: 600;
  font-size: 0.9rem;
}
</style>
