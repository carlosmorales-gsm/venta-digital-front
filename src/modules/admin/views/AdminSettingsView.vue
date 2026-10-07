<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { extractApiError, http } from '../../../shared/api/http';
import { useDialog } from '../../../shared/ui/dialog';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import VdSwitch from '../../../shared/ui/switch/VdSwitch.vue';

type SettingsDto = {
  draftLimit: number;
  draftTtlHours: number;
  maxDiscountAmount: number;
  sellerPasswordLogin?: boolean;
  sellerPasswordExpiresOn?: string | null;
  sellerPasswordExpired?: boolean;
  canManageSellerAccess?: boolean;
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
  sellerPasswordLogin: false,
  sellerAccessPassword: '',
});
const canManageSellerAccess = ref(false);
const sellerPasswordExpiresOn = ref<string | null>(null);
const sellerPasswordExpired = ref(false);
const loadedPasswordActive = ref(false);
const passwordModalOpen = ref(false);
const passwordDraft = ref('');
const passwordConfirm = ref('');
const passwordModalError = ref('');

function formatExpiresOn(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function applySellerAccess(data: SettingsDto) {
  form.sellerPasswordLogin = Boolean(data.sellerPasswordLogin);
  form.sellerAccessPassword = '';
  canManageSellerAccess.value = Boolean(data.canManageSellerAccess);
  sellerPasswordExpiresOn.value = data.sellerPasswordExpiresOn ?? null;
  sellerPasswordExpired.value = Boolean(data.sellerPasswordExpired);
  loadedPasswordActive.value = Boolean(data.sellerPasswordLogin);
}

function onSellerAccessChange(next: boolean) {
  if (next) {
    passwordDraft.value = '';
    passwordConfirm.value = '';
    passwordModalError.value = '';
    passwordModalOpen.value = true;
    return;
  }
  form.sellerPasswordLogin = false;
  form.sellerAccessPassword = '';
}

function closePasswordModal() {
  passwordModalOpen.value = false;
  passwordModalError.value = '';
}

function confirmPasswordModal() {
  const password = passwordDraft.value.trim();
  const confirm = passwordConfirm.value.trim();
  if (password.length < 6 || password.length > 72) {
    passwordModalError.value = 'La contraseña debe tener entre 6 y 72 caracteres.';
    return;
  }
  if (password !== confirm) {
    passwordModalError.value = 'Las contraseñas no coinciden.';
    return;
  }
  form.sellerAccessPassword = password;
  form.sellerPasswordLogin = true;
  passwordModalOpen.value = false;
  passwordModalError.value = '';
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { data } = await http.get<SettingsDto>('/settings');
    form.draftLimit = data.draftLimit;
    form.draftTtlHours = data.draftTtlHours;
    form.maxDiscountAmount = Number(data.maxDiscountAmount) || 0;
    applySellerAccess(data);
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
  if (
    canManageSellerAccess.value &&
    form.sellerPasswordLogin &&
    !loadedPasswordActive.value &&
    form.sellerAccessPassword.trim().length < 6
  ) {
    await alert({
      title: 'Configuración',
      message: 'Define una contraseña de al menos 6 caracteres para los vendedores.',
      variant: 'warning',
    });
    return;
  }
  if (
    canManageSellerAccess.value &&
    form.sellerAccessPassword.trim() &&
    (form.sellerAccessPassword.trim().length < 6 ||
      form.sellerAccessPassword.trim().length > 72)
  ) {
    await alert({
      title: 'Configuración',
      message: 'La contraseña de vendedores debe tener entre 6 y 72 caracteres.',
      variant: 'warning',
    });
    return;
  }
  saving.value = true;
  try {
    const body: Record<string, unknown> = {
      draftLimit: Number(form.draftLimit),
      draftTtlHours: Number(form.draftTtlHours),
      maxDiscountAmount: Number(form.maxDiscountAmount),
    };
    if (canManageSellerAccess.value) {
      body.sellerPasswordLogin = form.sellerPasswordLogin;
      if (form.sellerAccessPassword.trim()) {
        body.sellerAccessPassword = form.sellerAccessPassword.trim();
      }
    }
    const { data } = await http.patch<SettingsDto>('/settings', body);
    form.draftLimit = data.draftLimit;
    form.draftTtlHours = data.draftTtlHours;
    form.maxDiscountAmount = Number(data.maxDiscountAmount) || 0;
    applySellerAccess(data);
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

        <template v-if="canManageSellerAccess">
          <h2 class="subhead">Acceso de vendedores</h2>
          <p class="section-help">
            Si lo activas, todos los vendedores entran con la contraseña que
            captures. Vence al final del día siguiente. Si lo dejas apagado, o
            cuando ya venció, siguen entrando con el PIN de WhatsApp.
          </p>
          <div class="switch-row">
            <VdSwitch
              :model-value="form.sellerPasswordLogin"
              aria-label="Entrar con contraseña"
              @change="onSellerAccessChange"
            />
            <span>Entrar con contraseña</span>
          </div>
          <p
            v-if="form.sellerPasswordLogin && form.sellerAccessPassword"
            class="section-help"
          >
            Contraseña lista. Al guardar, queda vigente hasta el final del día
            siguiente.
          </p>
          <p
            v-else-if="form.sellerPasswordLogin && sellerPasswordExpiresOn"
            class="section-help"
          >
            Vigente hasta el {{ formatExpiresOn(sellerPasswordExpiresOn) }}.
          </p>
          <p v-else-if="sellerPasswordExpired" class="section-help">
            La contraseña venció el
            {{ formatExpiresOn(sellerPasswordExpiresOn) }}. Actívala de nuevo
            para definir otra.
          </p>
        </template>

        <div class="actions">
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </div>

    <VdModal
      :open="passwordModalOpen"
      title="Contraseña de vendedores"
      @close="closePasswordModal"
    >
      <form id="seller-password-form" class="password-form" @submit.prevent="confirmPasswordModal">
        <p class="section-help">
          Esta contraseña la usarán todos los vendedores y vence al final del
          día siguiente. Después vuelven al PIN de WhatsApp.
        </p>
        <label>
          Contraseña
          <input
            v-model="passwordDraft"
            type="password"
            autocomplete="new-password"
            minlength="6"
            maxlength="72"
            required
          />
        </label>
        <label>
          Confirmar contraseña
          <input
            v-model="passwordConfirm"
            type="password"
            autocomplete="new-password"
            minlength="6"
            maxlength="72"
            required
          />
        </label>
        <p v-if="passwordModalError" class="error-text" role="alert">
          {{ passwordModalError }}
        </p>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="closePasswordModal">
          Cancelar
        </button>
        <button type="submit" form="seller-password-form" class="btn btn-primary">
          Usar esta contraseña
        </button>
      </template>
    </VdModal>
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

.switch-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--vd-ink, #1a2430);
}

.password-form {
  display: grid;
  gap: 0.9rem;
}

.password-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--vd-ink, #1a2430);
}

.password-form input {
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
