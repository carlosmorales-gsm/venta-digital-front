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
  mustChangePassword?: boolean;
  permissions: string[];
  nombreJefeVentas?: string | null;
  createdAt: string;
}

const router = useRouter();
const auth = useAuthStore();
const { alert, confirm } = useDialog();

const users = ref<PublicUser[]>([]);
const loading = ref(true);
const saving = ref(false);
const togglingId = ref<number | null>(null);
const enteringId = ref<number | null>(null);
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
  mustChangePassword: true,
  nombreJefeVentas: '',
});

const GROUP_ORDER: UserType[] = ['VENDEDOR', 'MONITOR', 'ADMIN'];

const GROUP_META: Record<
  UserType,
  { title: string; hint: string; empty: string }
> = {
  VENDEDOR: {
    title: 'Vendedores',
    hint: 'Entran con PIN de WhatsApp',
    empty: 'No hay vendedores.',
  },
  MONITOR: {
    title: 'Monitores',
    hint: 'Consultan ventas y reportes',
    empty: 'No hay monitores.',
  },
  ADMIN: {
    title: 'Administradores',
    hint: 'Gestionan usuarios y el sistema',
    empty: 'No hay administradores.',
  },
};

const openGroups = reactive<Record<UserType, boolean>>({
  VENDEDOR: true,
  MONITOR: true,
  ADMIN: true,
});

const isEditing = computed(() => editingId.value != null);

const userGroups = computed(() =>
  GROUP_ORDER.map((type) => ({
    type,
    ...GROUP_META[type],
    open: openGroups[type],
    users: users.value
      .filter((user) => user.type === type)
      .slice()
      .sort((a, b) =>
        a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' }),
      ),
  })),
);

function toggleGroup(type: UserType) {
  openGroups[type] = !openGroups[type];
}

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
  form.mustChangePassword = true;
  form.nombreJefeVentas = '';
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
  form.mustChangePassword = Boolean(user.mustChangePassword);
  form.nombreJefeVentas = user.nombreJefeVentas ?? '';
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
    payload.nombreJefeVentas = form.nombreJefeVentas.trim();
  } else {
    payload.username = form.username.trim();
    payload.password = form.password;
    payload.mustChangePassword = form.mustChangePassword;
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
    payload.nombreJefeVentas = form.nombreJefeVentas.trim();
  } else {
    payload.username = form.username.trim();
    if (form.password.trim()) {
      payload.password = form.password;
    }
    payload.mustChangePassword = form.mustChangePassword;
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

function canEnterAsSeller(user: PublicUser) {
  return user.type === 'VENDEDOR' && user.active;
}

async function enterAsSeller(user: PublicUser) {
  if (!canEnterAsSeller(user) || enteringId.value != null) return;

  const ok = await confirm({
    title: 'Entrar como vendedor',
    message: `Vas a trabajar como ${user.fullName}. Las ventas y la captura serán las de ese vendedor.`,
    confirmText: 'Entrar',
    cancelText: 'Cancelar',
    variant: 'info',
  });
  if (!ok) return;

  enteringId.value = user.id;
  try {
    await auth.enterAsSeller(user.id);
    await router.replace({ name: 'vendedor-ventas' });
  } catch (e: any) {
    await alert({
      title: 'No se pudo entrar como vendedor',
      message: apiMessage(e, 'Intenta de nuevo'),
      variant: 'danger',
    });
  } finally {
    enteringId.value = null;
  }
}

onMounted(loadUsers);
</script>

<template>
  <section class="users-page">
    <header class="page-head head-row">
      <div class="head-copy">
        <h1>Usuarios</h1>
        <p>Alta, edición y habilitación. El administrador puede entrar como un vendedor activo.</p>
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

    <p v-if="listError" class="error-text users-error">{{ listError }}</p>

    <div v-if="loading" class="panel loading">
      <span class="spinner" />
      Cargando…
    </div>

    <div v-else class="user-groups">
      <section
        v-for="group in userGroups"
        :key="group.type"
        class="panel user-group"
      >
        <button
          type="button"
          class="user-group__toggle"
          :aria-expanded="group.open"
          :aria-controls="`users-${group.type}`"
          @click="toggleGroup(group.type)"
        >
          <span
            class="user-group__chevron"
            :class="{ 'is-open': group.open }"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="m9 6 6 6-6 6"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="user-group__copy">
            <strong>{{ group.title }}</strong>
            <small>{{ group.hint }}</small>
          </span>
          <span class="user-group__count">{{ group.users.length }}</span>
        </button>

        <div
          v-show="group.open"
          :id="`users-${group.type}`"
          class="user-group__body"
        >
          <p v-if="!group.users.length" class="user-group__empty">
            {{ group.empty }}
          </p>

          <template v-else>
            <div class="table-wrap desktop-list">
              <table class="data users-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Acceso</th>
                    <th v-if="group.type === 'VENDEDOR'">Jefe de ventas</th>
                    <th>Estado</th>
                    <th>Alta</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in group.users" :key="u.id">
                    <td>{{ u.fullName }}</td>
                    <td>{{ u.cellphone || u.username }}</td>
                    <td v-if="group.type === 'VENDEDOR'">
                      {{ u.nombreJefeVentas || '—' }}
                    </td>
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
                        <button
                          v-if="canEnterAsSeller(u)"
                          type="button"
                          class="icon-btn"
                          title="Entrar como vendedor"
                          aria-label="Entrar como vendedor"
                          :disabled="enteringId === u.id"
                          @click="enterAsSeller(u)"
                        >
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"
                            />
                            <path
                              d="M10 17 15 12 10 7"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                            <path
                              d="M15 12H3"
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
              <article
                v-for="u in group.users"
                :key="`card-${u.id}`"
                class="user-card"
              >
                <div class="user-card__head">
                  <strong>{{ u.fullName }}</strong>
                  <span class="badge" :class="u.active ? 'badge-ok' : 'badge-off'">
                    {{ u.active ? 'Activo' : 'Inactivo' }}
                  </span>
                </div>
                <dl class="user-card__meta">
                  <div>
                    <dt>Acceso</dt>
                    <dd>{{ u.cellphone || u.username }}</dd>
                  </div>
                  <div v-if="u.type === 'VENDEDOR'">
                    <dt>Jefe de ventas</dt>
                    <dd>{{ u.nombreJefeVentas || '—' }}</dd>
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
                  <button
                    v-if="canEnterAsSeller(u)"
                    type="button"
                    class="icon-btn"
                    title="Entrar como vendedor"
                    aria-label="Entrar como vendedor"
                    :disabled="enteringId === u.id"
                    @click="enterAsSeller(u)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                      />
                      <path
                        d="M10 17 15 12 10 7"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M15 12H3"
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
            </div>
          </template>
        </div>
      </section>
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

        <div v-if="form.type === 'VENDEDOR'" class="field">
          <label for="nombreJefeVentas">Jefe de ventas</label>
          <input
            id="nombreJefeVentas"
            v-model="form.nombreJefeVentas"
            maxlength="120"
            autocomplete="off"
          />
          <span class="field-hint">
            Este nombre se usa en la carátula del contrato de sus ventas.
          </span>
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
          <label class="check-row" for="mustChangePassword">
            <input
              id="mustChangePassword"
              v-model="form.mustChangePassword"
              type="checkbox"
            />
            <span>
              Pedir contraseña nueva al iniciar sesión
              <small>
                Al entrar verá una pantalla para capturar su propia contraseña.
              </small>
            </span>
          </label>
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

.users-error {
  margin-bottom: 0.75rem;
}

.user-groups {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.user-group {
  padding: 0;
  overflow: hidden;
}

.user-group__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.user-group__toggle:hover {
  background: rgba(53, 100, 125, 0.04);
}

.user-group__chevron {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 8px;
  background: rgba(53, 100, 125, 0.08);
  color: var(--gsm-blue);
  transition: transform 0.15s ease;
}

.user-group__chevron svg {
  width: 16px;
  height: 16px;
}

.user-group__chevron.is-open {
  transform: rotate(90deg);
}

.user-group__copy {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.user-group__copy strong {
  color: var(--gsm-blue);
  font-size: 1.05rem;
  line-height: 1.2;
}

.user-group__copy small {
  color: var(--vd-muted);
  font-size: 0.8rem;
  line-height: 1.3;
}

.user-group__count {
  min-width: 1.85rem;
  height: 1.85rem;
  padding: 0 0.5rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(53, 100, 125, 0.1);
  color: var(--gsm-blue);
  font-weight: 700;
  font-size: 0.85rem;
}

.user-group__body {
  border-top: 1px solid var(--vd-line);
  padding: 0.85rem 1.15rem 1.1rem;
}

.user-group__empty {
  margin: 0.15rem 0;
  color: var(--vd-muted);
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

.icon-btn:hover:not(:disabled) {
  border-color: var(--gsm-cafe);
  background: rgba(204, 160, 121, 0.12);
  color: var(--gsm-blue);
}

.icon-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.mobile-list {
  display: none;
  flex-direction: column;
  gap: 0.75rem;
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

.field-hint {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--vd-muted);
  line-height: 1.35;
}

.check-row {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin: 0.15rem 0 0;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--vd-line);
  border-radius: var(--vd-radius-sm, 8px);
  background: rgba(53, 100, 125, 0.04);
  cursor: pointer;
}

.check-row input {
  margin-top: 0.2rem;
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--gsm-blue);
  flex: 0 0 auto;
}

.check-row span {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--gsm-blue);
  font-weight: 600;
  font-size: 0.92rem;
  line-height: 1.3;
}

.check-row small {
  font-weight: 500;
  color: var(--vd-muted);
  font-size: 0.78rem;
  line-height: 1.35;
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
  .desktop-list {
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
