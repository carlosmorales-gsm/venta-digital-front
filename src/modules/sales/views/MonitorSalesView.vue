<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { http } from '../../../shared/api/http';
import { formatUtcToLocal, getClientTimeZone } from '../../../shared/utils/datetime';

interface SaleItem {
  id: number;
  sellerId: number;
  sellerName: string;
  amount: number;
  createdAt: string;
}

interface SalesResponse {
  scope: 'all';
  items: SaleItem[];
  total: number;
  message: string;
}

const loading = ref(true);
const data = ref<SalesResponse | null>(null);
const error = ref<string | null>(null);
const timeZone = getClientTimeZone();

onMounted(async () => {
  try {
    const res = await http.get<SalesResponse>('/sales/todas');
    data.value = res.data;
  } catch (e: any) {
    error.value =
      e?.response?.data?.message ?? 'No se pudieron cargar las ventas';
  } finally {
    loading.value = false;
  }
});

function formatAmount(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value);
}
</script>

<template>
  <section class="sales-page">
    <header class="page-head">
      <h1>Ventas</h1>
      <p>
        Consulta de ventas de todos los vendedores. Horarios en
        <strong>{{ timeZone }}</strong>.
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
        <strong>Sin ventas todavía</strong>
        Cuando los vendedores registren ventas, aparecerán aquí.
      </div>

      <template v-else>
        <div class="table-wrap desktop-list">
          <table class="data">
            <thead>
              <tr>
                <th>Fecha local</th>
                <th>Vendedor</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.items" :key="item.id">
                <td>{{ formatUtcToLocal(item.createdAt) }}</td>
                <td>{{ item.sellerName }}</td>
                <td>{{ formatAmount(item.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mobile-list">
          <article v-for="item in data.items" :key="`m-${item.id}`" class="sale-card">
            <strong>{{ item.sellerName }}</strong>
            <span>{{ formatUtcToLocal(item.createdAt) }}</span>
            <b>{{ formatAmount(item.amount) }}</b>
          </article>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.sales-page {
  min-width: 0;
}

.page-head strong {
  color: var(--gsm-teal-deep);
  font-weight: 600;
}

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

.mobile-list {
  display: none;
  flex-direction: column;
  gap: 0.7rem;
}

.sale-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--vd-line);
  border-radius: var(--vd-radius-sm);
  background: var(--vd-surface-2);
}

.sale-card strong {
  color: var(--gsm-teal);
}

.sale-card span {
  color: var(--vd-muted);
  font-size: 0.88rem;
}

.sale-card b {
  color: var(--vd-ink);
}

@media (max-width: 720px) {
  .desktop-list {
    display: none;
  }

  .mobile-list {
    display: flex;
  }
}
</style>
