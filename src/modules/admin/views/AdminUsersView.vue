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
  <section>
    <header class="page-header">
      <div>
        <h1>Usuarios</h1>
        <p>Alta de vendedores y monitores con permisos por defecto.</p>
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn-ghost" @click="router.push({ name: 'monitor-menu' })">
          Volver al menú
        </button>
      </div>
    </header>

    <div class="admin-grid">
      <form class="card form" @submit.prevent="createUser">
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
            Login por PIN WhatsApp. Sin menú de monitor.
          </template>
          <template v-else-if="form.type === 'MONITOR'">
            Permisos default: panel, ventas y reportes.
          </template>
          <template v-else>
            Permisos default: todos, incluyendo gestión de usuarios.
          </template>
        </p>

        <p v-if="error" class="error-text">{{ error }}</p>
        <p v-if="success" class="ok-text">{{ success }}</p>

        <button class="btn btn-gold" type="submit" :disabled="saving">
          <span v-if="saving" class="spinner" />
          {{ saving ? 'Guardando…' : 'Crear usuario' }}
        </button>
      </form>

      <div class="card">
        <h2>Listado</h2>
        <div v-if="loading" class="loading-row">
          <span class="spinner" />
          Cargando…
        </div>
        <div v-else class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Acceso</th>
                <th>Estado</th>
                <th>Alta (local)</th>
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

          <div class="data-cards">
            <article v-for="u in users" :key="`m-${u.id}`" class="data-card">
              <div class="data-card-head">
                <strong>{{ u.fullName }}</strong>
                <span class="badge" :class="u.active ? 'badge-ok' : 'badge-off'">
                  {{ u.active ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
              <div class="data-card-meta">
                <div class="row">
                  <span>Tipo</span>
                  <b>{{ u.type }}</b>
                </div>
                <div class="row">
                  <span>Acceso</span>
                  <b>{{ u.cellphone || u.username }}</b>
                </div>
                <div class="row">
                  <span>Alta</span>
                  <b>{{ formatUtcToLocal(u.createdAt) }}</b>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-grid {
  display: grid;
  grid-template-columns: minmax(260px, 360px) 1fr;
  gap: 1rem;
}

.form h2,
.card h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.hint {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0 0 0.75rem;
}

.ok-text {
  color: #2d6a4f;
  font-size: 0.875rem;
  margin: 0 0 0.75rem;
}

@media (max-width: 900px) {
  .admin-grid {
    grid-template-columns: 1fr;
  }
}
</style>
