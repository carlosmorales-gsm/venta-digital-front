<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { extractApiError, http } from '../../../shared/api/http';
import { getClientTimeZone } from '../../../shared/utils/datetime';
import { lastDaysRange } from '../../sales/utils/sales-list-filters';
import {
  loadSaleOrigins,
  saleOriginLabel,
} from '../../sales/constants/sale-origins';

type Bucket = { key: string; count: number; amount: number };

type Dashboard = {
  dateFrom: string;
  dateTo: string;
  total: number;
  amount: number;
  anticipo: number;
  saldo: number;
  synced: number;
  quoted: number;
  byStatus: Bucket[];
  byTipo: Bucket[];
  byPlan: Bucket[];
  byDay: Bucket[];
  bySeller: Bucket[];
  byOrigin: Bucket[];
  byBranch: Bucket[];
};

const RANGES = [
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PENDING_SIGNATURE: 'Pendiente de firma',
  PENDING_VALIDATION: 'Pendiente de validación',
  PENDING_CORRECTION: 'Por corregir',
  PENDING_CORRECTION_REVIEW: 'Corrección por validar',
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
};

const TIPO_LABELS: Record<string, string> = {
  NUEVA: 'Nueva',
  FUNEPET: 'Funepet',
  MEJORA: 'Mejora',
  MINORIA: 'Minoría',
  RECONOCIMIENTO: 'Reconocimiento de saldo',
};

const PLAN_LABELS: Record<string, string> = {
  PLAN_FUTURO: 'Plan a futuro',
  PARQUE: 'Parque',
};

const rangeId = ref<(typeof RANGES)[number]['id']>('30');
const data = ref<Dashboard | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return money.format(value || 0);
}

function labelOf(group: 'status' | 'tipo' | 'plan' | 'origin', key: string) {
  if (key === 'Otros' || key === 'Sin origen' || key === 'Sin vendedor' || key === 'Sin sucursal') {
    return key;
  }
  if (group === 'status') return STATUS_LABELS[key] || key;
  if (group === 'tipo') return TIPO_LABELS[key] || key;
  if (group === 'plan') return PLAN_LABELS[key] || key;
  return saleOriginLabel(key);
}

function peak(rows: Bucket[]) {
  return Math.max(1, ...rows.map((row) => row.count));
}

function share(count: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function dayLabel(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])}/${Number(match[2])}`;
}

const dayPeak = computed(() => peak(data.value?.byDay ?? []));
const selectedDayKey = ref<string | null>(null);

const selectedDayRow = computed(() => {
  const rows = data.value?.byDay ?? [];
  if (!rows.length) return null;
  const current = rows.find((row) => row.key === selectedDayKey.value);
  if (current) return current;
  return [...rows].reverse().find((row) => row.count > 0) ?? rows[rows.length - 1];
});

function dayTitle(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

const dayTicks = computed(() => {
  const rows = data.value?.byDay ?? [];
  if (!rows.length) return [];
  const count = rows.length <= 10 ? rows.length : 6;
  const ticks: Array<{ key: string; label: string }> = [];
  const seen = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const index =
      count === 1 ? 0 : Math.round((i * (rows.length - 1)) / (count - 1));
    if (seen.has(index)) continue;
    seen.add(index);
    ticks.push({ key: rows[index].key, label: dayLabel(rows[index].key) });
  }
  return ticks;
});

async function load() {
  loading.value = true;
  error.value = null;
  const range = lastDaysRange(Number(rangeId.value));
  try {
    const [{ data: body }] = await Promise.all([
      http.get<Dashboard>('/sales/dashboard', {
        params: {
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
          timeZone: getClientTimeZone(),
        },
        skipGlobalLoading: true,
      }),
      loadSaleOrigins().catch(() => undefined),
    ]);
    data.value = body;
  } catch (e: unknown) {
    data.value = null;
    error.value = extractApiError(e, 'No se pudieron cargar los indicadores');
  } finally {
    loading.value = false;
  }
}

function pickRange(id: (typeof RANGES)[number]['id']) {
  if (rangeId.value === id) return;
  rangeId.value = id;
  void load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="dash">
    <div class="dash-toolbar">
      <p v-if="data">
        Del {{ dayLabel(data.dateFrom) }} al {{ dayLabel(data.dateTo) }}
      </p>
      <div class="ranges" role="group" aria-label="Periodo">
        <button
          v-for="range in RANGES"
          :key="range.id"
          type="button"
          class="range"
          :class="{ 'is-active': rangeId === range.id }"
          @click="pickRange(range.id)"
        >
          {{ range.label }}
        </button>
      </div>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>
    <div v-else-if="loading && !data" class="loading">
      <span class="spinner" />
      Cargando indicadores…
    </div>

    <template v-else-if="data">
      <div class="kpis">
        <article class="kpi">
          <span>Ventas</span>
          <strong>{{ data.total }}</strong>
        </article>
        <article class="kpi">
          <span>Monto de planes</span>
          <strong>{{ formatMoney(data.amount) }}</strong>
        </article>
        <article class="kpi">
          <span>Anticipos</span>
          <strong>{{ formatMoney(data.anticipo) }}</strong>
        </article>
        <article class="kpi">
          <span>Saldo</span>
          <strong>{{ formatMoney(data.saldo) }}</strong>
        </article>
        <article class="kpi">
          <span>En expediente Odoo</span>
          <strong>{{ data.synced }}</strong>
          <small>{{ share(data.synced, data.total) }}</small>
        </article>
        <article class="kpi">
          <span>Con cotización</span>
          <strong>{{ data.quoted }}</strong>
          <small>{{ share(data.quoted, data.total) }}</small>
        </article>
      </div>

      <p v-if="!data.total" class="empty-note">No hay ventas en este periodo.</p>

      <div v-else class="grid">
        <article class="panel chart">
          <h2>Por día</h2>
          <div v-if="selectedDayRow" class="day-detail">
            <p>{{ dayTitle(selectedDayRow.key) }}</p>
            <dl>
              <div>
                <dt>Ventas</dt>
                <dd>{{ selectedDayRow.count }}</dd>
              </div>
              <div>
                <dt>Monto</dt>
                <dd>{{ formatMoney(selectedDayRow.amount) }}</dd>
              </div>
            </dl>
          </div>
          <div class="days">
            <button
              v-for="day in data.byDay"
              :key="day.key"
              type="button"
              class="day"
              :class="{ 'is-selected': selectedDayRow?.key === day.key }"
              :aria-pressed="selectedDayRow?.key === day.key"
              :aria-label="`${dayTitle(day.key)}: ${day.count} ventas, ${formatMoney(day.amount)}`"
              @click="selectedDayKey = day.key"
            >
              <div class="day__track">
                <span
                  class="day__bar"
                  :style="{ height: `${(day.count / dayPeak) * 100}%` }"
                />
              </div>
            </button>
          </div>
          <div class="day-axis">
            <span v-for="tick in dayTicks" :key="tick.key">{{ tick.label }}</span>
          </div>
        </article>

        <article class="panel chart">
          <h2>Estatus</h2>
          <ul class="bars">
            <li v-for="row in data.byStatus" :key="row.key">
              <div class="bars__meta">
                <span>{{ labelOf('status', row.key) }}</span>
                <strong>{{ row.count }}</strong>
              </div>
              <div class="bars__track">
                <span :style="{ width: `${(row.count / peak(data.byStatus)) * 100}%` }" />
              </div>
            </li>
          </ul>
        </article>

        <article class="panel chart">
          <h2>Tipo de venta</h2>
          <ul class="bars">
            <li v-for="row in data.byTipo" :key="row.key">
              <div class="bars__meta">
                <span>{{ labelOf('tipo', row.key) }}</span>
                <strong>{{ row.count }}</strong>
              </div>
              <div class="bars__track">
                <span :style="{ width: `${(row.count / peak(data.byTipo)) * 100}%` }" />
              </div>
            </li>
          </ul>
        </article>

        <article class="panel chart">
          <h2>Plan</h2>
          <ul class="bars">
            <li v-for="row in data.byPlan" :key="row.key">
              <div class="bars__meta">
                <span>{{ labelOf('plan', row.key) }}</span>
                <strong>{{ formatMoney(row.amount) }}</strong>
              </div>
              <div class="bars__track">
                <span :style="{ width: `${(row.count / peak(data.byPlan)) * 100}%` }" />
              </div>
              <small>{{ row.count }} ventas</small>
            </li>
          </ul>
        </article>

        <article class="panel chart">
          <h2>Vendedores</h2>
          <ul class="bars">
            <li v-for="row in data.bySeller" :key="row.key">
              <div class="bars__meta">
                <span>{{ row.key }}</span>
                <strong>{{ row.count }}</strong>
              </div>
              <div class="bars__track">
                <span :style="{ width: `${(row.count / peak(data.bySeller)) * 100}%` }" />
              </div>
              <small>{{ formatMoney(row.amount) }}</small>
            </li>
          </ul>
        </article>

        <article class="panel chart">
          <h2>Origen de venta</h2>
          <ul class="bars">
            <li v-for="row in data.byOrigin" :key="row.key">
              <div class="bars__meta">
                <span>{{ labelOf('origin', row.key) }}</span>
                <strong>{{ row.count }}</strong>
              </div>
              <div class="bars__track">
                <span :style="{ width: `${(row.count / peak(data.byOrigin)) * 100}%` }" />
              </div>
            </li>
          </ul>
        </article>

        <article class="panel chart">
          <h2>Sucursal</h2>
          <ul class="bars">
            <li v-for="row in data.byBranch" :key="row.key">
              <div class="bars__meta">
                <span>{{ row.key }}</span>
                <strong>{{ row.count }}</strong>
              </div>
              <div class="bars__track">
                <span :style="{ width: `${(row.count / peak(data.byBranch)) * 100}%` }" />
              </div>
            </li>
          </ul>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
  max-width: 100%;
}

.dash-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dash-toolbar p {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.9rem;
}

.ranges {
  display: flex;
  gap: 0.35rem;
}

.range {
  border: 1px solid var(--vd-line);
  background: var(--vd-surface);
  color: var(--gsm-blue);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.range.is-active {
  background: var(--gsm-blue);
  border-color: var(--gsm-blue);
  color: white;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.7rem;
}

.kpi {
  background: var(--vd-surface);
  border: 1px solid rgba(53, 100, 125, 0.1);
  border-radius: var(--vd-radius);
  box-shadow: var(--vd-shadow);
  padding: 0.85rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border-top: 3px solid var(--gsm-cafe);
}

.kpi span,
.kpi small {
  color: var(--vd-muted);
  font-size: 0.78rem;
}

.kpi strong {
  color: var(--gsm-blue);
  font-size: 1.25rem;
  line-height: 1.15;
}

.empty-note {
  margin: 0;
  color: var(--vd-muted);
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 0.85rem;
  min-width: 0;
}

.chart {
  min-width: 0;
  overflow: hidden;
}

.chart h2 {
  margin: 0 0 0.85rem;
  font-size: 1rem;
  color: var(--gsm-blue);
}

.days {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  width: 100%;
  min-width: 0;
  min-height: 118px;
}

.day-detail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  flex-wrap: wrap;
  margin: 0 0 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  background: var(--vd-surface-2);
}

.day-detail p {
  margin: 0;
  color: var(--gsm-blue);
  font-weight: 600;
  text-transform: capitalize;
}

.day-detail dl {
  display: flex;
  gap: 1.15rem;
  margin: 0;
}

.day-detail dt {
  color: var(--vd-muted);
  font-size: 0.72rem;
}

.day-detail dd {
  margin: 0.1rem 0 0;
  color: var(--gsm-blue);
  font-size: 1.05rem;
  font-weight: 600;
}

.day {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.day.is-selected .day__bar {
  background: var(--gsm-cafe);
}

.day.is-selected .day__track {
  box-shadow: inset 0 0 0 2px var(--gsm-cafe);
}

.day:focus-visible .day__track {
  outline: 2px solid var(--gsm-blue);
  outline-offset: 1px;
}

.day-axis {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  margin-top: 0.4rem;
  color: var(--vd-muted);
  font-size: 0.68rem;
}

.day__track {
  height: 110px;
  width: 100%;
  display: flex;
  align-items: flex-end;
  background: var(--vd-surface-2);
  border-radius: 6px 6px 2px 2px;
}

.day__bar {
  display: block;
  width: 100%;
  min-height: 2px;
  background: var(--gsm-blue);
  border-radius: 6px 6px 2px 2px;
}

.bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.bars__meta {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  font-size: 0.88rem;
}

.bars__meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bars__meta strong {
  color: var(--gsm-blue);
}

.bars__track {
  margin-top: 0.28rem;
  height: 8px;
  border-radius: 999px;
  background: var(--vd-surface-2);
  overflow: hidden;
}

.bars__track span {
  display: block;
  height: 100%;
  min-width: 2px;
  background: var(--gsm-cafe);
  border-radius: inherit;
}

.bars small {
  display: block;
  margin-top: 0.15rem;
  color: var(--vd-muted);
  font-size: 0.75rem;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--vd-muted);
}

@media (max-width: 1100px) {
  .kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 800px) {
  .kpis,
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
