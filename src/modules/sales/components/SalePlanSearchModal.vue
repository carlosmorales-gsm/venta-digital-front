<script setup lang="ts">
import { ref, watch } from 'vue';
import { extractApiError, http } from '../../../shared/api/http';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import type { PlanKind } from '../types/sale-form';
import type { SellerDefaultPlan } from '../types/seller-defaults';
import { fetchPlanesByIds, mapPlanProduct } from '../utils/odoo-plans';

export type PlanProduct = {
  id: number;
  name: string;
  listPrice: number;
  defaultCode: string | null;
  companyId: number;
  /** product.template.without_interest */
  withoutInterest: boolean;
};

const props = defineProps<{
  open: boolean;
  planKind: PlanKind;
  favoritePlans?: SellerDefaultPlan[];
}>();

const emit = defineEmits<{
  close: [];
  select: [plan: PlanProduct];
}>();

const q = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const results = ref<PlanProduct[]>([]);
const liveFavorites = ref<PlanProduct[]>([]);
const pickingId = ref<number | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

async function hydrateFavorites() {
  const ids = (props.favoritePlans ?? []).map((plan) => plan.id);
  if (!ids.length) {
    liveFavorites.value = [];
    return;
  }
  try {
    liveFavorites.value = await fetchPlanesByIds(props.planKind, ids);
  } catch {
    liveFavorites.value = [];
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      q.value = '';
      results.value = [];
      error.value = null;
      pickingId.value = null;
      void hydrateFavorites();
    }
  },
);

async function search() {
  const term = q.value.trim();
  if (term.length < 1) {
    results.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const { data } = await http.get<
      Array<
        PlanProduct & {
          default_code?: string | null;
          without_interest?: boolean;
        }
      >
    >('/odoo/planes', {
      params: { planKind: props.planKind, q: term, limit: 20 },
      skipGlobalLoading: true,
    });
    results.value = (data || []).map((p) => mapPlanProduct(p));
    if (!results.value.length) error.value = 'Sin coincidencias';
  } catch (e: unknown) {
    results.value = [];
    error.value = extractApiError(e, 'No se pudo buscar planes');
  } finally {
    loading.value = false;
  }
}

function onInput() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void search();
  }, 350);
}

async function selectFavorite(planId: number) {
  pickingId.value = planId;
  error.value = null;
  try {
    const [fresh] = await fetchPlanesByIds(props.planKind, [planId]);
    if (!fresh) {
      error.value =
        'Ese plan ya no está disponible o cambió. Elígelo de nuevo en la búsqueda.';
      liveFavorites.value = liveFavorites.value.filter((p) => p.id !== planId);
      return;
    }
    emit('select', fresh);
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudo leer el plan actual en Odoo');
  } finally {
    pickingId.value = null;
  }
}

function money(n: number) {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}
</script>

<template>
  <VdModal :open="open" title="Buscar plan" @close="emit('close')">
    <div class="plan-search">
      <div v-if="favoritePlans?.length" class="favorites">
        <p>Tus planes predeterminados</p>
        <div class="chips">
          <button
            v-for="plan in liveFavorites"
            :key="plan.id"
            type="button"
            class="chip"
            :disabled="pickingId === plan.id"
            @click="selectFavorite(plan.id)"
          >
            {{ plan.name }}
          </button>
        </div>
      </div>

      <label>
        Nombre del plan
        <input
          v-model="q"
          type="search"
          placeholder="Escribe para buscar…"
          autocomplete="off"
          @input="onInput"
        />
      </label>

      <p v-if="loading" class="muted">Buscando…</p>
      <p v-else-if="error" class="err">{{ error }}</p>

      <ul v-if="results.length" class="plan-list">
        <li v-for="p in results" :key="p.id">
          <button type="button" class="plan-item" @click="emit('select', p)">
            <strong>{{ p.name }}</strong>
            <span>{{ money(p.listPrice) }}</span>
            <small v-if="p.defaultCode">{{ p.defaultCode }}</small>
          </button>
        </li>
      </ul>
    </div>
  </VdModal>
</template>

<style scoped>
.plan-search {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.favorites p {
  margin: 0 0 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--gsm-blue);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  border: 1px solid var(--gsm-blue);
  background: #eef5f8;
  color: var(--gsm-blue);
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.chip:hover {
  background: #dceaf1;
}

.plan-search label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--gsm-blue);
}

.plan-search input {
  min-height: 46px;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-size: 16px;
}

.muted {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.9rem;
}

.err {
  margin: 0;
  color: #b42318;
  font-size: 0.9rem;
  font-weight: 600;
}

.plan-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 320px;
  overflow: auto;
}

.plan-item {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.2rem 0.75rem;
  text-align: left;
  border: 1px solid var(--vd-line);
  background: #fff;
  border-radius: 10px;
  padding: 0.7rem 0.8rem;
  cursor: pointer;
  color: inherit;
}

.plan-item:hover {
  border-color: var(--gsm-blue);
  background: #f4f8fa;
}

.plan-item strong {
  grid-column: 1;
  font-size: 0.9rem;
}

.plan-item span {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  font-weight: 700;
  color: var(--gsm-blue);
  font-size: 0.88rem;
  white-space: nowrap;
}

.plan-item small {
  grid-column: 1;
  color: var(--vd-muted);
  font-size: 0.75rem;
}
</style>
