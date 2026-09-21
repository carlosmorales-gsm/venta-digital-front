<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

const auth = useAuthStore();
const router = useRouter();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showCurrent = ref(false);
const showNew = ref(false);
const localError = ref<string | null>(null);

const firstName = computed(
  () => auth.user?.fullName?.split(' ')[0] ?? 'usuario',
);
const mustChangePassword = computed(() => Boolean(auth.user?.mustChangePassword));
const minNewLength = computed(() => (mustChangePassword.value ? 8 : 6));

function strongPasswordError(password: string): string | null {
  if (password.length < 8) {
    return 'La nueva contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-ZÁÉÍÓÚÜÑ]/.test(password)) {
    return 'La nueva contraseña debe incluir al menos una letra mayúscula.';
  }
  if (!/\d/.test(password)) {
    return 'La nueva contraseña debe incluir al menos un número.';
  }
  if (!/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(password)) {
    return 'La nueva contraseña debe incluir al menos un carácter especial.';
  }
  return null;
}

function validate(): string | null {
  const current = currentPassword.value;
  const next = newPassword.value.trim();
  const confirm = confirmPassword.value.trim();
  if (!current) return 'Captura tu contraseña actual.';
  if (mustChangePassword.value) {
    const strength = strongPasswordError(next);
    if (strength) return strength;
  } else if (next.length < minNewLength.value) {
    return `La nueva contraseña debe tener al menos ${minNewLength.value} caracteres.`;
  }
  if (next !== confirm) return 'La confirmación no coincide.';
  if (next === current) {
    return 'La nueva contraseña debe ser distinta a la actual.';
  }
  return null;
}

async function onSubmit() {
  localError.value = null;
  const problem = validate();
  if (problem) {
    localError.value = problem;
    return;
  }
  try {
    await auth.changeOwnPassword(
      currentPassword.value,
      newPassword.value.trim(),
    );
    await router.replace({ name: 'monitor-menu' });
  } catch {
    localError.value = auth.error || 'No se pudo cambiar la contraseña';
  }
}

async function onLogout() {
  await auth.logout();
  await router.replace({ name: 'login-monitor' });
}
</script>

<template>
  <div class="login-shell">
    <aside class="brand-panel">
      <img src="/logo-sanmartin-white.svg" alt="San Martín" class="logo-white" />
      <div class="brand-copy">
        <img src="/icons-palomasanmartin.svg" alt="" class="dove" />
        <h1>Venta Digital</h1>
        <p>Por seguridad, define tu propia contraseña antes de continuar.</p>
      </div>
      <small>Grupo San Martín</small>
    </aside>

    <section class="form-panel">
      <form class="login-card" @submit.prevent="onSubmit">
        <img src="/logo-gsm-azul.svg" alt="GSM" class="logo-blue" />
        <h2>Nueva contraseña</h2>
        <p class="subtitle">
          Hola {{ firstName }}. Captura una contraseña nueva para tu usuario.
        </p>

        <div class="field">
          <label for="currentPassword">Contraseña actual</label>
          <div class="password-row">
            <input
              id="currentPassword"
              v-model="currentPassword"
              :type="showCurrent ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              required
            />
            <button
              class="toggle-pass"
              type="button"
              @click="showCurrent = !showCurrent"
            >
              {{ showCurrent ? 'Ocultar' : 'Ver' }}
            </button>
          </div>
        </div>

        <div class="field">
          <label for="newPassword">Nueva contraseña</label>
          <div class="password-row">
            <input
              id="newPassword"
              v-model="newPassword"
              :type="showNew ? 'text' : 'password'"
              autocomplete="new-password"
              :minlength="minNewLength"
              :placeholder="
                mustChangePassword
                  ? 'Ej. Abcdef1!'
                  : `Mínimo ${minNewLength} caracteres`
              "
              required
            />
            <button
              class="toggle-pass"
              type="button"
              @click="showNew = !showNew"
            >
              {{ showNew ? 'Ocultar' : 'Ver' }}
            </button>
          </div>
          <p v-if="mustChangePassword" class="field-hint">
            Mínimo 8 caracteres, una mayúscula, un número y un carácter especial.
          </p>
        </div>

        <div class="field">
          <label for="confirmPassword">Confirmar contraseña</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            :minlength="minNewLength"
            placeholder="Repite la nueva contraseña"
            required
          />
        </div>

        <p v-if="localError" class="error-text" role="alert">{{ localError }}</p>

        <button class="btn btn-primary submit" type="submit" :disabled="auth.loading">
          <span v-if="auth.loading" class="spinner" />
          {{ auth.loading ? 'Guardando…' : 'Guardar y continuar' }}
        </button>

        <button class="btn btn-ghost back" type="button" @click="onLogout">
          Cerrar sesión
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(400px, 46%) minmax(0, 1fr);
}

.brand-panel {
  background: var(--gsm-blue);
  color: var(--gsm-white);
  padding: clamp(2.5rem, 5vw, 4.5rem);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-right: 3px solid var(--gsm-cafe);
}

.logo-white {
  width: min(180px, 60%);
}

.dove {
  width: 48px;
  margin-bottom: 1rem;
  filter: brightness(0) invert(1);
  opacity: 0.9;
}

.brand-copy h1 {
  color: var(--gsm-cafe);
  font-size: clamp(2.4rem, 5vw, 3.6rem);
  margin-bottom: 0.5rem;
}

.brand-copy p {
  margin: 0;
  max-width: 300px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 300;
}

.brand-panel small {
  opacity: 0.7;
  letter-spacing: 0.04em;
}

.form-panel {
  display: grid;
  place-items: center;
  padding: clamp(2rem, 6vw, 4rem);
  background: var(--vd-bg);
}

.login-card {
  width: min(460px, 100%);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: var(--gsm-white);
  border: 1px solid rgba(53, 100, 125, 0.12);
  border-radius: 16px 8px 8px 8px;
  padding: 2.2rem 2rem;
  box-shadow: var(--vd-shadow);
  border-top: 3px solid var(--gsm-cafe);
}

.logo-blue {
  width: 120px;
  margin-bottom: 0.35rem;
}

.login-card h2 {
  font-size: 1.75rem;
  margin: 0;
  color: var(--gsm-blue);
}

.subtitle {
  margin: -0.35rem 0 0.35rem;
  color: var(--vd-muted);
  font-size: 0.95rem;
}

.field-hint {
  margin: 0.3rem 0 0;
  color: var(--vd-muted);
  font-size: 0.82rem;
}

.password-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

.toggle-pass {
  border: 1px solid var(--vd-line);
  background: var(--gsm-white);
  border-radius: var(--vd-radius-sm);
  padding: 0 0.85rem;
  color: var(--gsm-blue);
  cursor: pointer;
  font-weight: 500;
  min-height: 46px;
}

.toggle-pass:hover {
  border-color: var(--gsm-cafe);
  background: rgba(204, 160, 121, 0.1);
}

.submit,
.back {
  width: 100%;
}

.submit {
  margin-top: 0.25rem;
}

@media (max-width: 960px) {
  .login-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    align-content: start;
  }

  .brand-panel {
    min-height: 0;
    padding: 1.25rem 1.35rem 1.5rem;
    gap: 0.85rem;
    justify-content: flex-start;
    border-right: 0;
    border-bottom: 3px solid var(--gsm-cafe);
  }

  .brand-panel small {
    display: none;
  }

  .logo-white {
    width: min(140px, 48%);
  }

  .dove {
    width: 36px;
    margin-bottom: 0.45rem;
  }

  .brand-copy h1 {
    font-size: clamp(1.75rem, 6.5vw, 2.1rem);
    margin-bottom: 0.25rem;
  }

  .brand-copy p {
    max-width: none;
    font-size: 0.95rem;
  }

  .form-panel {
    display: block;
    padding: 0 1.15rem 1.5rem;
    margin-top: -1.25rem;
    place-items: unset;
  }

  .login-card {
    width: 100%;
    border-radius: 14px 8px 8px 8px;
    padding: 1.5rem 1.25rem 1.35rem;
    margin: 0 auto;
  }

  .logo-blue {
    width: 100px;
  }

  .login-card h2 {
    font-size: 1.55rem;
  }
}

@media (max-width: 600px) {
  .brand-panel {
    padding: 1rem 1.1rem 1.25rem;
    gap: 0.65rem;
  }

  .form-panel {
    padding: 0 0.9rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
    margin-top: -1rem;
  }

  .login-card {
    padding: 1.25rem 1.05rem 1.2rem;
  }

  .toggle-pass,
  .submit {
    min-height: 48px;
  }
}
</style>
