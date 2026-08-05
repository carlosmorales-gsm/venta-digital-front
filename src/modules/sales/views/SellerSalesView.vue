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
    <header class="page-header">
      <div>
        <h1>Mis ventas</h1>
        <p>Solo ves las ventas asociadas a tu sesión de vendedor.</p>
      </div>
      <div class="stat-chip">
        <span>Zona horaria</span>
        <strong>{{ timeZone }}</strong>
      </div>
    </header>

    <div v-if="loading" class="card loading-row">
      <span class="spinner" />
      Cargando ventas…
    </div>

    <div v-else-if="error" class="card">
      <p class="error-text">{{ error }}</p>
    </div>

    <div v-else class="card">
      <div class="page-header" style="margin-bottom: 1rem">
        <div>
          <p style="margin: 0; color: var(--muted)">{{ data?.message }}</p>
        </div>
        <div class="stat-chip">
          <span>Total</span>
          <strong>{{ data?.total ?? 0 }}</strong>
        </div>
      </div>

      <div v-if="!data?.items?.length" class="empty-state">
        <strong>Sin ventas todavía</strong>
        Cuando registres ventas, aparecerán aquí con hora local.
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
