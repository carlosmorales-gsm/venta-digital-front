<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../../../shared/api/http';
import { formatUtcToLocal } from '../../../shared/utils/datetime';
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
const users = ref<PublicUser[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const form = reactive({
  type: 'VENDEDOR' as UserType,
  fullName: '',
  cellphone: '',
  username: '',
  password: '',
});

async function loadUsers() {
  loading.value = true;
  error.value = null;
  try {
    const { data } = await http.get<PublicUser[]>('/users');
    users.value = data;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'No se pudo cargar usuarios';
  } finally {
    loading.value = false;
  }
}

async function createUser() {
  saving.value = true;
  error.value = null;
  success.value = null;

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
    success.value = 'Usuario creado correctamente';
    form.fullName = '';
    form.cellphone = '';
    form.username = '';
    form.password = '';
    await loadUsers();
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    error.value = Array.isArray(msg)
      ? msg.join('. ')
      : msg ?? 'No se pudo crear el usuario';
  } finally {
    saving.value = false;
  }
}

onMounted(loadUsers);
</script>

<template>
  <section class="users-page">
    <header class="page-head head-row">
      <div class="head-copy">
        <h1>Usuarios</h1>
        <p>Alta de vendedores y monitores con permisos por defecto.</p>
      </div>
      <button type="button" class="btn btn-ghost head-back" @click="router.push({ name: 'monitor-menu' })">
        Volver
      </button>
    </header>

    <div class="grid">
      <form class="panel form" @submit.prevent="createUser">
        <h2>Nuevo usuario</h2>

        <div class="field">
          <label for="type">Tipo</label>
          <select id="type" v-model="form.type">
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
            <label for="password">Contraseña</label>
            <input id="password" v-model="form.password" type="password" required minlength="6" />
          </div>
        </template>

        <p class="hint">
          <template v-if="form.type === 'VENDEDOR'">
            Login por PIN WhatsApp.
          </template>
          <template v-else-if="form.type === 'MONITOR'">
            Permisos default: panel, ventas y reportes.
          </template>
          <template v-else>
            Permisos default: todos + gestión de usuarios.
          </template>
        </p>

        <p v-if="error" class="error-text">{{ error }}</p>
        <p v-if="success" class="ok-text">{{ success }}</p>

        <button class="btn btn-accent submit" type="submit" :disabled="saving">
          <span v-if="saving" class="spinner" />
          {{ saving ? 'Guardando…' : 'Crear usuario' }}
        </button>
      </form>

      <div class="panel list-panel">
        <h2>Listado</h2>
        <div v-if="loading" class="loading">
          <span class="spinner" />
          Cargando…
        </div>

        <template v-else>
          <!-- Desktop / tablet ancha -->
          <div class="table-wrap desktop-list">
            <table class="data users-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Acceso</th>
                  <th>Estado</th>
                  <th>Alta</th>
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
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Móvil / tablet estrecha -->
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
            </article>

            <div v-if="!users.length" class="empty-state">
              <strong>Sin usuarios</strong>
              Crea el primero con el formulario.
            </div>
          </div>
        </template>
      </div>
    </div>
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

.head-back {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 0.45rem 1rem;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.form,
.list-panel {
  min-width: 0;
  width: 100%;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.form h2,
.list-panel > h2 {
  font-size: 1.25rem;
  margin-bottom: 0.35rem;
}

.hint {
  font-size: 0.85rem;
  color: var(--vd-muted);
  margin: 0;
}

.submit {
  width: 100%;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--vd-muted);
  padding: 0.5rem 0;
}

.users-table {
  min-width: 0;
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

/* Tablet */
@media (max-width: 1024px) {
  .grid {
    grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
  }
}

/* Una columna: form arriba, listado abajo */
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }

  /* Título + Volver en la misma fila, sin huecos grandes */
  .head-row {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .head-copy p {
    display: none; /* en móvil el subtítulo ocupa demasiado; el form ya explica */
  }

  .head-back {
    width: auto;
    flex-shrink: 0;
  }
}

/* Móvil: cards en lugar de tabla */
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
}

@media (max-width: 380px) {
  .user-card__meta {
    grid-template-columns: 1fr;
  }
}
</style>
