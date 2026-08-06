<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../../../shared/api/http';
import { formatUtcToLocal } from '../../../shared/utils/datetime';
import { useDialog } from '../../../shared/ui/dialog';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import VdSwitch from '../../../shared/ui/switch/VdSwitch.vue';
import { useAuthStore } from '../../auth/stores/auth.store';
import type { UserType } from '../../../shared/types/auth';

interface PublicUser {
  id: number;
  type: UserType;
  fullName: string;
  cellphone: string | null;
  username: string | null;
  active: boolean;
  permissions: string[];
  createdAt: string;
}

const router = useRouter();
const auth = useAuthStore();
const { alert, confirm } = useDialog();

const users = ref<PublicUser[]>([]);
const loading = ref(true);
const saving = ref(false);
const togglingId = ref<number | null>(null);
const formError = ref<string | null>(null);
const listError = ref<string | null>(null);
const modalOpen = ref(false);
const editingId = ref<number | null>(null);

const form = reactive({
  type: 'VENDEDOR' as UserType,
  fullName: '',
  cellphone: '',
  username: '',
  password: '',
});

const isEditing = computed(() => editingId.value != null);

const formTitle = computed(() =>
  isEditing.value ? 'Editar usuario' : 'Nuevo usuario',
);

async function loadUsers() {
  loading.value = true;
  listError.value = null;
  try {
    const { data } = await http.get<PublicUser[]>('/users');
    users.value = data;
  } catch (e: any) {
    listError.value = e?.response?.data?.message ?? 'No se pudo cargar usuarios';
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingId.value = null;
  form.type = 'VENDEDOR';
  form.fullName = '';
  form.cellphone = '';
  form.username = '';
  form.password = '';
  formError.value = null;
}

function openCreate() {
  resetForm();
  modalOpen.value = true;
}

function startEdit(user: PublicUser) {
  editingId.value = user.id;
  form.type = user.type;
  form.fullName = user.fullName;
  form.cellphone = user.cellphone ?? '';
  form.username = user.username ?? '';
  form.password = '';
  formError.value = null;
  modalOpen.value = true;
}

function closeModal() {
  if (saving.value) return;
  modalOpen.value = false;
  resetForm();
}

function apiMessage(e: any, fallback: string) {
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('. ');
  return msg ?? fallback;
}

async function submitForm() {
  if (isEditing.value) {
    await updateUser();
  } else {
    await createUser();
  }
}

async function createUser() {
  saving.value = true;
  formError.value = null;

  const payload: Record<string, unknown> = {
    type: form.type,
    fullName: form.fullName.trim(),
  };

  if (form.type === 'VENDEDOR') {
    payload.cellphone = form.cellphone.trim();
  } else {
    payload.username = form.username.trim();
    payload.password = form.password;
  }

  try {
    await http.post('/users', payload);
    modalOpen.value = false;
    resetForm();
    await loadUsers();
    await alert({
      title: 'Listo',
      message: 'Usuario creado correctamente.',
      variant: 'success',
    });
  } catch (e: any) {
    formError.value = apiMessage(e, 'No se pudo crear el usuario');
  } finally {
    saving.value = false;
  }
}

async function updateUser() {
  if (editingId.value == null) return;

  saving.value = true;
  formError.value = null;

  const payload: Record<string, unknown> = {
    fullName: form.fullName.trim(),
  };

  if (form.type === 'VENDEDOR') {
    payload.cellphone = form.cellphone.trim();
  } else {
    payload.username = form.username.trim();
    if (form.password.trim()) {
      payload.password = form.password;
    }
  }

  try {
    await http.patch(`/users/${editingId.value}`, payload);
    modalOpen.value = false;
    resetForm();
    await loadUsers();
    await alert({
      title: 'Listo',
      message: 'Usuario actualizado correctamente.',
      variant: 'success',
    });
  } catch (e: any) {
    formError.value = apiMessage(e, 'No se pudo actualizar el usuario');
  } finally {
    saving.value = false;
  }
}

async function toggleActive(user: PublicUser) {
  const nextActive = !user.active;
  const ok = await confirm({
    title: nextActive ? 'Habilitar usuario' : 'Deshabilitar usuario',
    message: nextActive
      ? `¿Habilitar a ${user.fullName}? Podrá iniciar sesión de nuevo.`
      : `¿Deshabilitar a ${user.fullName}? No podrá iniciar sesión.`,
    variant: nextActive ? 'info' : 'danger',
    confirmText: nextActive ? 'Habilitar' : 'Deshabilitar',
    cancelText: 'Cancelar',
  });

  if (!ok) return;

  togglingId.value = user.id;
  try {
    await http.patch(`/users/${user.id}/active`, { active: nextActive });
    await loadUsers();
    await alert({
      title: 'Listo',
      message: nextActive
        ? 'Usuario habilitado correctamente.'
        : 'Usuario deshabilitado correctamente.',
      variant: 'success',
    });
  } catch (e: any) {
    await alert({
      title: 'No se pudo cambiar el estado',
      message: apiMessage(e, 'Intenta de nuevo'),
      variant: 'danger',
    });
  } finally {
    togglingId.value = null;
  }
}

function isSelf(user: PublicUser) {
  return auth.user?.id === user.id;
}

onMounted(loadUsers);
</script>

<template>
  <section class="users-page">
    <header class="page-head head-row">
      <div class="head-copy">
        <h1>Usuarios</h1>
        <p>Alta, edición y habilitación de vendedores y monitores.</p>
      </div>
      <div class="head-actions">
        <button type="button" class="btn btn-accent" @click="openCreate">
          Nuevo usuario
        </button>
        <button
          type="button"
          class="btn btn-ghost head-back"
          @click="router.push({ name: 'monitor-menu' })"
        >
          Volver
        </button>
      </div>
    </header>

    <div class="panel list-panel">
      <h2>Listado</h2>
      <p v-if="listError" class="error-text">{{ listError }}</p>

      <div v-if="loading" class="loading">
        <span class="spinner" />
        Cargando…
      </div>

      <template v-else>
        <div class="table-wrap desktop-list">
          <table class="data users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Acceso</th>
                <th>Estado</th>
                <th>Alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>{{ u.fullName }}</td>
                <td>{{ u.type }}</td>
                <td>{{ u.cellphone || u.username }}</td>
                <td>
                  <span class="badge" :class="u.active ? 'badge-ok' : 'badge-off'">
                    {{ u.active ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>{{ formatUtcToLocal(u.createdAt) }}</td>
                <td>
                  <div class="row-actions">
                    <button
                      type="button"
                      class="icon-btn"
                      title="Editar"
                      aria-label="Editar usuario"
                      @click="startEdit(u)"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0L4 16v4Z"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linejoin="round"
                        />
                        <path
                          d="M13 6.5 17.5 11"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                        />
                      </svg>
                    </button>
                    <VdSwitch
                      :model-value="u.active"
                      :disabled="togglingId === u.id || isSelf(u)"
                      :aria-label="u.active ? 'Deshabilitar usuario' : 'Habilitar usuario'"
                      :title="isSelf(u) ? 'No puedes desactivar tu cuenta' : u.active ? 'Deshabilitar' : 'Habilitar'"
                      @change="toggleActive(u)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mobile-list">
          <article v-for="u in users" :key="`card-${u.id}`" class="user-card">
            <div class="user-card__head">
              <strong>{{ u.fullName }}</strong>
              <span class="badge" :class="u.active ? 'badge-ok' : 'badge-off'">
                {{ u.active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <dl class="user-card__meta">
              <div>
                <dt>Tipo</dt>
                <dd>{{ u.type }}</dd>
              </div>
              <div>
                <dt>Acceso</dt>
                <dd>{{ u.cellphone || u.username }}</dd>
              </div>
              <div>
                <dt>Alta</dt>
                <dd>{{ formatUtcToLocal(u.createdAt) }}</dd>
              </div>
            </dl>
            <div class="row-actions card-actions">
              <button
                type="button"
                class="icon-btn"
                title="Editar"
                aria-label="Editar usuario"
                @click="startEdit(u)"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0L4 16v4Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M13 6.5 17.5 11"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <VdSwitch
                :model-value="u.active"
                :disabled="togglingId === u.id || isSelf(u)"
                :aria-label="u.active ? 'Deshabilitar usuario' : 'Habilitar usuario'"
                @change="toggleActive(u)"
              />
            </div>
          </article>

          <div v-if="!users.length" class="empty-state">
            <strong>Sin usuarios</strong>
            Crea el primero con “Nuevo usuario”.
          </div>
        </div>

        <div v-if="users.length === 0 && !loading" class="empty-state desktop-empty">
          <strong>Sin usuarios</strong>
          Crea el primero con “Nuevo usuario”.
        </div>
      </template>
    </div>

    <VdModal :open="modalOpen" :title="formTitle" @close="closeModal">
      <form id="user-form" class="user-form" @submit.prevent="submitForm">
        <div class="field">
          <label for="type">Tipo</label>
          <select id="type" v-model="form.type" :disabled="isEditing">
            <option value="VENDEDOR">Vendedor</option>
            <option value="MONITOR">Monitor</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>

        <div class="field">
          <label for="fullName">Nombre completo</label>
          <input id="fullName" v-model="form.fullName" required />
        </div>

        <div v-if="form.type === 'VENDEDOR'" class="field">
          <label for="cellphone">Celular (10 dígitos)</label>
          <input
            id="cellphone"
            v-model="form.cellphone"
            maxlength="10"
            inputmode="numeric"
            required
          />
        </div>

        <template v-else>
          <div class="field">
            <label for="username">Usuario</label>
            <input id="username" v-model="form.username" required />
          </div>
          <div class="field">
            <label for="password">
              Contraseña
              <template v-if="isEditing"> (opcional)</template>
            </label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              :required="!isEditing"
              minlength="6"
              :placeholder="isEditing ? 'Dejar vacío para no cambiar' : ''"
            />
          </div>
        </template>

        <p class="hint">
          <template v-if="isEditing">
            El tipo de usuario no se puede cambiar al editar.
          </template>
          <template v-else-if="form.type === 'VENDEDOR'">
            Login por PIN WhatsApp. El número no puede repetirse entre vendedores.
          </template>
          <template v-else-if="form.type === 'MONITOR'">
            Permisos default: panel, ventas y reportes.
          </template>
          <template v-else>
            Permisos default: todos + gestión de usuarios.
          </template>
        </p>

        <p v-if="formError" class="error-text">{{ formError }}</p>
      </form>

      <template #footer>
        <button
          class="btn btn-ghost"
          type="button"
          :disabled="saving"
          @click="closeModal"
        >
          Cancelar
        </button>
        <button
          class="btn btn-accent"
          type="submit"
          form="user-form"
          :disabled="saving"
        >
          <span v-if="saving" class="spinner" />
          {{
            saving
              ? 'Guardando…'
              : isEditing
                ? 'Guardar cambios'
                : 'Crear usuario'
          }}
        </button>
      </template>
    </VdModal>
  </section>
</template>

<style scoped>
.users-page {
  width: 100%;
  min-width: 0;
}

.head-row {
  display: flex;
  justify-content: space-between;
  gap: 0.65rem 1rem;
  align-items: flex-start;
  margin-bottom: 0.85rem;
}

.head-copy {
  flex: 1 1 auto;
  min-width: 0;
}

.head-copy h1 {
  margin-bottom: 0.2rem;
  font-size: clamp(1.55rem, 4vw, 2.2rem);
  line-height: 1.15;
}

.head-copy p {
  font-size: 0.9rem;
  line-height: 1.35;
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 0 0 auto;
}

.head-back {
  min-height: 40px;
  padding: 0.45rem 1rem;
}

.list-panel {
  min-width: 0;
  width: 100%;
}

.list-panel > h2 {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--vd-muted);
  padding: 0.5rem 0;
}

.users-table {
  min-width: 720px;
  width: 100%;
}

.users-table th,
.users-table td {
  white-space: nowrap;
}

.users-table td:first-child,
.users-table th:first-child {
  white-space: normal;
  word-break: break-word;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  background: var(--gsm-white);
  color: var(--gsm-blue);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

.icon-btn:hover {
  border-color: var(--gsm-cafe);
  background: rgba(204, 160, 121, 0.12);
  color: var(--gsm-blue);
}

.mobile-list {
  display: none;
  flex-direction: column;
  gap: 0.75rem;
}

.desktop-empty {
  display: block;
}

.user-card {
  border: 1px solid var(--vd-line);
  border-radius: var(--vd-radius-sm);
  background: var(--vd-surface-2);
  padding: 0.95rem 1rem;
}

.user-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.user-card__head strong {
  color: var(--gsm-blue);
  font-size: 1.05rem;
  line-height: 1.3;
  word-break: break-word;
  min-width: 0;
}

.user-card__meta {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem 0.85rem;
}

.user-card__meta dt {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vd-muted);
}

.user-card__meta dd {
  margin: 0.15rem 0 0;
  color: var(--vd-ink);
  font-weight: 500;
  word-break: break-word;
}

.card-actions {
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--vd-line);
}

.user-form {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.hint {
  font-size: 0.85rem;
  color: var(--vd-muted);
  margin: 0;
}

@media (max-width: 900px) {
  .head-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .head-copy p {
    display: none;
  }

  .head-actions {
    width: 100%;
  }

  .head-actions .btn {
    flex: 1;
    min-height: 44px;
  }
}

@media (max-width: 720px) {
  .desktop-list,
  .desktop-empty {
    display: none;
  }

  .mobile-list {
    display: flex;
  }

  .user-card__meta {
    grid-template-columns: 1fr 1fr;
  }

  .card-actions {
    justify-content: space-between;
  }
}

@media (max-width: 380px) {
  .user-card__meta {
    grid-template-columns: 1fr;
  }
}
</style>
