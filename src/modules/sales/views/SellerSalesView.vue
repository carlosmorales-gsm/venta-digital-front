<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { http } from '../../../shared/api/http';
import { formatUtcToLocal, getClientTimeZone } from '../../../shared/utils/datetime';

interface SalesResponse {
  items: Array<Record<string, unknown>>;
  total: number;
  message: string;
}

const loading = ref(true);
const data = ref<SalesResponse | null>(null);
const error = ref<string | null>(null);
const timeZone = getClientTimeZone();

onMounted(async () => {
  try {
    const res = await http.get<SalesResponse>('/sales/mias');
    data.value = res.data;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'No se pudieron cargar las ventas';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section>
    <header class="page-head">
      <h1>Mis ventas</h1>
      <p>
        Ventas de tu sesión. Horarios en zona local:
        <strong>{{ timeZone }}</strong>
      </p>
    </header>

    <div v-if="loading" class="panel loading">
      <span class="spinner" />
      Cargando…
    </div>

    <div v-else-if="error" class="panel">
      <p class="error-text">{{ error }}</p>
    </div>

    <div v-else class="panel">
      <div class="summary">
        <p>{{ data?.message }}</p>
        <span class="total">Total: {{ data?.total ?? 0 }}</span>
      </div>

      <div v-if="!data?.items?.length" class="empty-state">
        <strong>Aún no hay ventas</strong>
        Cuando registres movimientos, se mostrarán aquí.
      </div>

      <div v-else class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Fecha local</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in data.items" :key="index">
              <td>{{ formatUtcToLocal(String(item.createdAt ?? '')) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--vd-muted);
}

.summary {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.total {
  font-weight: 600;
  color: var(--gsm-teal-deep);
}

.page-head strong {
  color: var(--gsm-teal-deep);
  font-weight: 600;
}
</style>
