<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { extractApiError, http } from '../../../shared/api/http';
import { useAuthStore } from '../../auth/stores/auth.store';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import type { PlanProduct } from './SalePlanSearchModal.vue';
import type { SaleBranch, SellerDefaults } from '../types/seller-defaults';
import { emptySellerDefaults } from '../types/seller-defaults';
import {
  defaultsNeedPlanNames,
  fetchPlanesByIds,
  mapPlanProduct,
  mergeDefaultPlanCache,
  toCachedDefaultPlan,
  toPlanProduct,
} from '../utils/odoo-plans';
import {
  patchSellerPrefetch,
  prefetchSellerSession,
  readSellerPrefetch,
} from '../utils/seller-session-cache';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  saved: [defaults: SellerDefaults];
}>();

const auth = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const branches = ref<SaleBranch[]>([]);
const form = reactive<SellerDefaults>(emptySellerDefaults());
const planLabels = reactive<Record<number, string>>({});

const futureQ = ref('');
const parkQ = ref('');
const futureResults = ref<PlanProduct[]>([]);
const parkResults = ref<PlanProduct[]>([]);
const futureLoading = ref(false);
const parkLoading = ref(false);
let futureTimer: ReturnType<typeof setTimeout> | null = null;
let parkTimer: ReturnType<typeof setTimeout> | null = null;

function rememberLabel(plan: PlanProduct) {
  planLabels[plan.id] = plan.name;
}

function planLabel(plan: { id: number; name?: string }) {
  return plan.name || planLabels[plan.id] || `Plan #${plan.id}`;
}

function money(n: number) {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

async function searchPlans(kind: 'PLAN_FUTURO' | 'PARQUE', q: string) {
  const term = q.trim();
  if (term.length < 1) return [];
  const { data } = await http.get<
    Array<PlanProduct & { default_code?: string | null; without_interest?: boolean }>
  >('/odoo/planes', {
    params: { planKind: kind, q: term, limit: 12 },
    skipGlobalLoading: true,
  });
  return (data || []).map((p) => mapPlanProduct(p));
}

function onFutureInput() {
  if (futureTimer) clearTimeout(futureTimer);
  futureTimer = setTimeout(async () => {
    futureLoading.value = true;
    try {
      futureResults.value = await searchPlans('PLAN_FUTURO', futureQ.value);
    } catch {
      futureResults.value = [];
    } finally {
      futureLoading.value = false;
    }
  }, 350);
}

function onParkInput() {
  if (parkTimer) clearTimeout(parkTimer);
  parkTimer = setTimeout(async () => {
    parkLoading.value = true;
    try {
      parkResults.value = await searchPlans('PARQUE', parkQ.value);
    } catch {
      parkResults.value = [];
    } finally {
      parkLoading.value = false;
    }
  }, 350);
}

function addPlan(kind: 'future' | 'park', plan: PlanProduct) {
  const list = kind === 'future' ? form.defaultFuturePlans : form.defaultParkPlans;
  if (list.some((p) => p.id === plan.id)) return;
  if (list.length >= 3) {
    error.value = 'Solo puedes guardar hasta 3 planes por tipo.';
    return;
  }
  rememberLabel(plan);
  list.push(toCachedDefaultPlan(plan));
  if (kind === 'future') {
    futureQ.value = '';
    futureResults.value = [];
  } else {
    parkQ.value = '';
    parkResults.value = [];
  }
}

function removePlan(kind: 'future' | 'park', id: number) {
  if (kind === 'future') {
    form.defaultFuturePlans = form.defaultFuturePlans.filter((p) => p.id !== id);
  } else {
    form.defaultParkPlans = form.defaultParkPlans.filter((p) => p.id !== id);
  }
}

function onBranchChange() {
  const selected = branches.value.find((b) => b.id === form.defaultBranchId);
  form.defaultBranchName = selected?.name ?? null;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const userId = auth.user?.id;
    const cached = readSellerPrefetch(userId);
    if (cached) {
      branches.value = cached.branches;
      Object.assign(form, emptySellerDefaults(), cached.defaults);
    } else if (userId) {
      const data = await prefetchSellerSession(userId);
      branches.value = data.branches;
      Object.assign(form, emptySellerDefaults(), data.defaults);
    } else {
      branches.value = [];
    }
    for (const plan of [
      ...form.defaultFuturePlans,
      ...form.defaultParkPlans,
    ]) {
      if (plan.name) planLabels[plan.id] = plan.name;
    }
    if (defaultsNeedPlanNames(form)) {
      const [futureLive, parkLive] = await Promise.all([
        fetchPlanesByIds(
          'PLAN_FUTURO',
          form.defaultFuturePlans.map((plan) => plan.id),
        ),
        fetchPlanesByIds(
          'PARQUE',
          form.defaultParkPlans.map((plan) => plan.id),
        ),
      ]);
      form.defaultFuturePlans = mergeDefaultPlanCache(
        form.defaultFuturePlans,
        futureLive,
      );
      form.defaultParkPlans = mergeDefaultPlanCache(
        form.defaultParkPlans,
        parkLive,
      );
      for (const plan of [...futureLive, ...parkLive]) rememberLabel(plan);
    }
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudieron cargar los valores predeterminados');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = null;
  onBranchChange();
  try {
    const { data } = await http.patch<SellerDefaults>('/users/me/defaults', {
      defaultBranchId: form.defaultBranchId,
      defaultBranchName: form.defaultBranchName,
      defaultFuturePlans: form.defaultFuturePlans.map((p) => ({ id: p.id })),
      defaultParkPlans: form.defaultParkPlans.map((p) => ({ id: p.id })),
    });
    patchSellerPrefetch({
      userId: auth.user?.id,
      defaults: {
        ...data,
        defaultFuturePlans: mergeDefaultPlanCache(
          data.defaultFuturePlans,
          form.defaultFuturePlans
            .map((plan) =>
              toPlanProduct({
                ...plan,
                name: plan.name || planLabels[plan.id],
              }),
            )
            .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan)),
        ),
        defaultParkPlans: mergeDefaultPlanCache(
          data.defaultParkPlans,
          form.defaultParkPlans
            .map((plan) =>
              toPlanProduct({
                ...plan,
                name: plan.name || planLabels[plan.id],
              }),
            )
            .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan)),
        ),
      },
    });
    emit('saved', data);
    emit('close');
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudieron guardar los valores predeterminados');
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    futureQ.value = '';
    parkQ.value = '';
    futureResults.value = [];
    parkResults.value = [];
    void load();
  },
);
</script>

<template>
  <VdModal :open="open" title="Valores predeterminados" wide @close="emit('close')">
    <div class="defaults">
      <p v-if="loading" class="muted">Cargando…</p>
      <p v-else-if="error" class="err">{{ error }}</p>

      <template v-if="!loading">
        <label>
          Sucursal predeterminada
          <select
            :value="form.defaultBranchId ?? ''"
            @change="
              form.defaultBranchId = ($event.target as HTMLSelectElement).value
                ? Number(($event.target as HTMLSelectElement).value)
                : null;
              onBranchChange();
            "
          >
            <option value="">Sin sucursal predeterminada</option>
            <option v-for="b in branches" :key="b.id" :value="b.id">
              {{ b.name }}
            </option>
          </select>
        </label>

        <section class="plan-block">
          <h3>Plan a futuro (máx. 3)</h3>
          <div v-if="form.defaultFuturePlans.length" class="chips">
            <button
              v-for="p in form.defaultFuturePlans"
              :key="p.id"
              type="button"
              class="chip"
              @click="removePlan('future', p.id)"
            >
              {{ planLabel(p) }}
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <input
            v-model="futureQ"
            type="search"
            placeholder="Buscar plan a futuro…"
            :disabled="form.defaultFuturePlans.length >= 3"
            @input="onFutureInput"
          />
          <p v-if="futureLoading" class="muted">Buscando…</p>
          <ul v-if="futureResults.length" class="results">
            <li v-for="p in futureResults" :key="p.id">
              <button type="button" @click="addPlan('future', p)">
                <strong>{{ p.name }}</strong>
                <span>{{ money(p.listPrice) }}</span>
              </button>
            </li>
          </ul>
        </section>

        <section class="plan-block">
          <h3>Plan de parque (máx. 3)</h3>
          <div v-if="form.defaultParkPlans.length" class="chips">
            <button
              v-for="p in form.defaultParkPlans"
              :key="p.id"
              type="button"
              class="chip"
              @click="removePlan('park', p.id)"
            >
              {{ planLabel(p) }}
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <input
            v-model="parkQ"
            type="search"
            placeholder="Buscar plan de parque…"
            :disabled="form.defaultParkPlans.length >= 3"
            @input="onParkInput"
          />
          <p v-if="parkLoading" class="muted">Buscando…</p>
          <ul v-if="parkResults.length" class="results">
            <li v-for="p in parkResults" :key="p.id">
              <button type="button" @click="addPlan('park', p)">
                <strong>{{ p.name }}</strong>
                <span>{{ money(p.listPrice) }}</span>
              </button>
            </li>
          </ul>
        </section>

        <footer class="actions">
          <button type="button" class="btn btn-ghost" @click="emit('close')">
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </button>
        </footer>
      </template>
    </div>
  </VdModal>
</template>

<style scoped>
.defaults {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.defaults label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--gsm-blue);
}

.defaults select,
.defaults input[type='search'] {
  min-height: 46px;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-size: 16px;
}

.plan-block h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  color: var(--gsm-blue);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.55rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--gsm-blue);
  background: #eef5f8;
  color: var(--gsm-blue);
  border-radius: 999px;
  padding: 0.3rem 0.65rem;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.results {
  list-style: none;
  margin: 0.45rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 180px;
  overflow: auto;
}

.results button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  text-align: left;
  border: 1px solid var(--vd-line);
  background: #fff;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  cursor: pointer;
}

.muted {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.88rem;
}

.err {
  margin: 0;
  color: #b42318;
  font-size: 0.9rem;
  font-weight: 600;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
