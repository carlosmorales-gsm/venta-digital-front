<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { extractApiError, http } from '../../../shared/api/http';
import { useDialog } from '../../../shared/ui/dialog';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import { formatUtcToLocal } from '../../../shared/utils/datetime';
import type { UserType } from '../../../shared/types/auth';

type GrantStatus = 'ACTIVE' | 'CANCELLED' | 'APPLIED';

type DiscountGrant = {
  id: number;
  sellerId: number;
  sellerName: string;
  percent: number;
  status: GrantStatus;
  createdByUserId: number;
  createdByName: string;
  createdAt: string | null;
  cancelledByUserId: number | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  appliedSaleId: number | null;
  appliedAt: string | null;
};

type PublicUser = {
  id: number;
  type: UserType;
  fullName: string;
  active: boolean;
};

const router = useRouter();
const { alert, confirm } = useDialog();

const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const grants = ref<DiscountGrant[]>([]);
const sellers = ref<PublicUser[]>([]);
const modalOpen = ref(false);
const formError = ref<string | null>(null);
const sellerQuery = ref('');
const sellerMenuOpen = ref(false);
const form = reactive({
  sellerId: 0,
  percent: 0,
});

const activeSellers = computed(() =>
  sellers.value.filter((s) => s.type === 'VENDEDOR' && s.active),
);

const selectedSeller = computed(
  () => activeSellers.value.find((s) => s.id === form.sellerId) ?? null,
);

const filteredSellers = computed(() => {
  const q = sellerQuery.value.trim().toLowerCase();
  if (!q) return activeSellers.value.slice(0, 12);
  return activeSellers.value
    .filter((s) => s.fullName.toLowerCase().includes(q))
    .slice(0, 12);
});

function statusLabel(status: GrantStatus) {
  if (status === 'APPLIED') return 'Aplicado';
  if (status === 'CANCELLED') return 'Cancelado';
  return 'Activo';
}

function statusClass(status: GrantStatus) {
  if (status === 'APPLIED') return 'badge-applied';
  if (status === 'CANCELLED') return 'badge-off';
  return 'badge-ok';
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [g, u] = await Promise.all([
      http.get<DiscountGrant[]>('/discounts'),
      http.get<PublicUser[]>('/users', { params: { type: 'VENDEDOR' } }),
    ]);
    grants.value = g.data;
    sellers.value = u.data;
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudieron cargar los descuentos');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.sellerId = 0;
  form.percent = 0;
  sellerQuery.value = '';
  sellerMenuOpen.value = false;
  formError.value = null;
  modalOpen.value = true;
}

function closeModal() {
  if (saving.value) return;
  modalOpen.value = false;
  sellerMenuOpen.value = false;
}

function onSellerInput() {
  form.sellerId = 0;
  sellerMenuOpen.value = true;
}

function selectSeller(s: PublicUser) {
  form.sellerId = s.id;
  sellerQuery.value = s.fullName;
  sellerMenuOpen.value = false;
}

function clearSeller() {
  form.sellerId = 0;
  sellerQuery.value = '';
  sellerMenuOpen.value = true;
}

async function createGrant() {
  if (!form.sellerId || !selectedSeller.value) {
    formError.value = 'Selecciona un vendedor de la lista';
    return;
  }
  if (form.percent <= 0 || form.percent > 100) {
    formError.value = 'El descuento debe estar entre 0.01 y 100%';
    return;
  }
  saving.value = true;
  formError.value = null;
  try {
    await http.post('/discounts', {
      sellerId: Number(form.sellerId),
      percent: Number(form.percent),
    });
    modalOpen.value = false;
    await load();
    await alert({
      title: 'Descuento',
      message: 'Descuento especial autorizado.',
      variant: 'success',
    });
  } catch (e: unknown) {
    formError.value = extractApiError(e, 'No se pudo guardar');
  } finally {
    saving.value = false;
  }
}

async function cancelGrant(g: DiscountGrant) {
  if (g.status !== 'ACTIVE') return;
  const ok = await confirm({
    title: 'Cancelar descuento',
    message: `¿Cancelar el ${g.percent}% autorizado a ${g.sellerName}?`,
    variant: 'warning',
    confirmText: 'Cancelar descuento',
  });
  if (!ok) return;
  try {
    await http.patch(`/discounts/${g.id}/cancel`);
    await load();
  } catch (e: unknown) {
    await alert({
      title: 'Descuento',
      message: extractApiError(e, 'No se pudo cancelar'),
      variant: 'danger',
    });
  }
}

onMounted(load);
</script>

<template>
  <section class="page">
    <header class="page-head head-row">
      <div class="head-copy">
        <h1>Descuentos especiales</h1>
        <p>
          Autoriza un porcentaje a un vendedor. Queda registrado quién lo generó,
          cuándo, cuánto y a quién.
        </p>
      </div>
      <div class="head-actions">
        <button type="button" class="btn btn-accent" @click="openCreate">
          Nuevo descuento
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          @click="router.push({ name: 'monitor-menu' })"
        >
          Volver
        </button>
      </div>
    </header>

    <div class="panel">
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>

      <div v-if="loading" class="loading">
        <span class="spinner" />
        Cargando…
      </div>

      <div v-else-if="!grants.length" class="empty-state">
        <strong>Sin descuentos especiales</strong>
        Crea el primero con “Nuevo descuento”.
      </div>

      <template v-else>
        <div class="table-wrap desktop-list">
          <table class="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>%</th>
                <th>Generó</th>
                <th>Estatus</th>
                <th>Detalle</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in grants" :key="g.id">
                <td>{{ formatUtcToLocal(g.createdAt) }}</td>
                <td>{{ g.sellerName }}</td>
                <td>{{ g.percent }}%</td>
                <td>{{ g.createdByName }}</td>
                <td>
                  <span class="badge" :class="statusClass(g.status)">
                    {{ statusLabel(g.status) }}
                  </span>
                </td>
                <td class="detail">
                  <template v-if="g.status === 'APPLIED'">
                    Venta #{{ g.appliedSaleId }}
                    <small v-if="g.appliedAt">
                      · {{ formatUtcToLocal(g.appliedAt) }}
                    </small>
                  </template>
                  <template v-else-if="g.status === 'CANCELLED'">
                    {{ g.cancelledByName || '—' }}
                    <small v-if="g.cancelledAt">
                      · {{ formatUtcToLocal(g.cancelledAt) }}
                    </small>
                  </template>
                  <template v-else>—</template>
                </td>
                <td>
                  <button
                    v-if="g.status === 'ACTIVE'"
                    type="button"
                    class="btn btn-sm btn-ghost"
                    @click="cancelGrant(g)"
                  >
                    Cancelar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mobile-list">
          <article v-for="g in grants" :key="`m-${g.id}`" class="card">
            <div class="card__head">
              <strong>{{ g.sellerName }}</strong>
              <span class="badge" :class="statusClass(g.status)">
                {{ statusLabel(g.status) }}
              </span>
            </div>
            <p>{{ g.percent }}% · {{ formatUtcToLocal(g.createdAt) }}</p>
            <p class="muted">Generó: {{ g.createdByName }}</p>
            <p v-if="g.status === 'APPLIED'" class="muted">
              Aplicado en venta #{{ g.appliedSaleId }}
            </p>
            <p v-else-if="g.status === 'CANCELLED'" class="muted">
              Canceló: {{ g.cancelledByName }}
            </p>
            <button
              v-if="g.status === 'ACTIVE'"
              type="button"
              class="btn btn-sm btn-ghost"
              @click="cancelGrant(g)"
            >
              Cancelar descuento
            </button>
          </article>
        </div>
      </template>
    </div>

    <VdModal :open="modalOpen" title="Nuevo descuento especial" @close="closeModal">
      <form id="discount-form" class="form" @submit.prevent="createGrant">
        <div class="seller-ac">
          <label for="seller-q">Vendedor</label>
          <div class="seller-ac__row">
            <input
              id="seller-q"
              v-model="sellerQuery"
              type="search"
              autocomplete="off"
              placeholder="Escribe para buscar…"
              @input="onSellerInput"
              @focus="sellerMenuOpen = true"
            />
            <button
              v-if="form.sellerId || sellerQuery"
              type="button"
              class="btn btn-sm btn-ghost"
              @click="clearSeller"
            >
              Limpiar
            </button>
          </div>
          <ul
            v-if="sellerMenuOpen && filteredSellers.length"
            class="seller-ac__list"
            role="listbox"
          >
            <li v-for="s in filteredSellers" :key="s.id">
              <button
                type="button"
                class="seller-ac__item"
                :class="{ active: s.id === form.sellerId }"
                @click="selectSeller(s)"
              >
                {{ s.fullName }}
              </button>
            </li>
          </ul>
          <p v-else-if="sellerMenuOpen && sellerQuery.trim()" class="seller-ac__empty">
            Sin coincidencias
          </p>
          <p v-if="selectedSeller" class="seller-ac__picked">
            Seleccionado: <strong>{{ selectedSeller.fullName }}</strong>
          </p>
        </div>
        <label>
          Descuento (%)
          <input
            v-model.number="form.percent"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            required
          />
        </label>
        <p v-if="formError" class="error-text">{{ formError }}</p>
      </form>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="saving"
          @click="closeModal"
        >
          Cerrar
        </button>
        <button
          type="submit"
          form="discount-form"
          class="btn btn-accent"
          :disabled="saving"
        >
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </template>
    </VdModal>
  </section>
</template>

<style scoped>
.page {
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

.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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

.badge {
  display: inline-flex;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-ok {
  background: #e8f5ee;
  color: #0f6b3c;
}

.badge-off {
  background: #f1f3f5;
  color: #5c6770;
}

.badge-applied {
  background: #e7f0f7;
  color: var(--gsm-blue);
}

.detail {
  font-size: 0.88rem;
}

.detail small {
  color: var(--vd-muted);
}

.mobile-list {
  display: none;
  flex-direction: column;
  gap: 0.65rem;
}

.card {
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.card__head {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: center;
}

.card p {
  margin: 0;
  font-size: 0.9rem;
}

.muted {
  color: var(--vd-muted);
  font-size: 0.85rem !important;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.88rem;
  font-weight: 600;
}

.form input,
.form select {
  min-height: 44px;
  border: 1px solid var(--vd-line);
  border-radius: 8px;
  padding: 0.5rem 0.7rem;
  font: inherit;
}

.seller-ac {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.seller-ac > label {
  font-size: 0.88rem;
  font-weight: 600;
}

.seller-ac__row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.seller-ac__row input {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--vd-line);
  border-radius: 8px;
  padding: 0.5rem 0.7rem;
  font: inherit;
}

.seller-ac__list {
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  border: 1px solid var(--vd-line);
  border-radius: 8px;
  max-height: 220px;
  overflow: auto;
  background: #fff;
}

.seller-ac__item {
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 0.55rem 0.65rem;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}

.seller-ac__item:hover,
.seller-ac__item.active {
  background: #f0f5f8;
  color: var(--gsm-blue);
}

.seller-ac__empty,
.seller-ac__picked {
  margin: 0;
  font-size: 0.82rem;
  color: var(--vd-muted);
}

.seller-ac__picked strong {
  color: var(--gsm-blue);
}

@media (max-width: 900px) {
  .desktop-list {
    display: none;
  }
  .mobile-list {
    display: flex;
  }
}
</style>
