<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import { SALE_ORIGIN_OPTIONS } from '../constants/sale-origins';
import { saleKindLabel } from '../constants/sale-kinds';
import {
  formatDigitalFolio,
  fullName,
  realContrato,
  type SaleFormData,
} from '../types/sale-form';
import { listSaleAttachments } from '../utils/attachment-preview';
import {
  formatCardNumber,
  normalizeTipoCobranza,
  TIPO_COBRANZA_OPTIONS,
} from '../utils/payment-method';

const props = defineProps<{
  open: boolean;
  form: SaleFormData;
  saleId: number | null;
  sellerName: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  contrato: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

type TabKey =
  | 'contrato'
  | 'contacto'
  | 'sustituto'
  | 'beneficiarios'
  | 'segundo'
  | 'plan'
  | 'documentos';

type InnerKey = string;

type DetailRow = { label: string; value: string; wide?: boolean };

const tab = ref<TabKey>('contrato');
const contactoTab = ref<'personales' | 'domicilio' | 'factura'>('personales');
const segundoTab = ref<'personales' | 'domicilio'>('personales');
const planTab = ref<'plan' | 'financiamiento' | 'cobranza'>('plan');

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    tab.value = 'contrato';
    contactoTab.value = 'personales';
    segundoTab.value = 'personales';
    planTab.value = 'plan';
  },
);

const clientName = computed(() => fullName(props.form.contacto).trim());

const title = computed(
  () => clientName.value || formatDigitalFolio(props.saleId) || 'Datos de la venta',
);

const folioSolicitud = computed(() => formatDigitalFolio(props.saleId) || '—');

const folioVenta = computed(() =>
  text(realContrato(props.contrato || props.form.meta.contrato)),
);

const pideFactura = computed(() => props.form.contacto.factura === 'SI');
const cobranza = computed(() =>
  normalizeTipoCobranza(props.form.contacto.tipoCobranza),
);

function text(value: string | number | null | undefined): string {
  const raw = String(value ?? '').trim();
  return raw || '—';
}

function yesNo(value: string | null | undefined): string {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'SI') return 'Sí';
  if (raw === 'NO') return 'No';
  return text(value);
}

function money(value: string | number | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const n = Number(raw.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(n);
}

function dateLabel(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return text(raw);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function originLabel(value: string): string {
  const found = SALE_ORIGIN_OPTIONS.find((opt) => opt.value === value);
  return found?.label || text(value);
}

function cobranzaLabel(value: string): string {
  const norm = normalizeTipoCobranza(value);
  const found = TIPO_COBRANZA_OPTIONS.find((opt) => opt.value === norm);
  return found?.label || text(value);
}

function personName(person: {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
}): string {
  return text(fullName(person));
}

function statusClass(status: string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'badge badge--payment';
    case 'PENDING_SIGNATURE':
      return 'badge badge--sign';
    case 'PENDING_VALIDATION':
      return 'badge badge--validation';
    case 'PENDING_CORRECTION':
      return 'badge badge--correction';
    case 'PENDING_CORRECTION_REVIEW':
      return 'badge badge--review';
    case 'COMPLETED':
    case 'SUBMITTED':
      return 'badge badge--done';
    case 'REJECTED':
      return 'badge badge--rejected';
    case 'DRAFT':
      return 'badge badge--draft';
    default:
      return 'badge';
  }
}

const contratoRows = computed((): DetailRow[] => {
  const meta = props.form.meta;
  return [
    { label: 'Fecha', value: dateLabel(meta.fecha) },
    { label: 'Origen de venta', value: originLabel(meta.origenVenta) },
    { label: 'Sucursal', value: text(meta.branchName) },
    { label: 'Tipo de servicio', value: text(meta.serviceTypeName) },
    {
      label: 'Tipo de venta',
      value: meta.tipoVenta ? saleKindLabel(meta.tipoVenta) : '—',
    },
    { label: 'Fecha de servicio', value: dateLabel(meta.fechaServicio) },
    { label: 'Venta anterior', value: text(meta.anterior), wide: true },
  ];
});

const contactoPersonales = computed(() => {
  const c = props.form.contacto;
  return [
    { label: 'Nombre', value: personName(c) },
    { label: 'CURP', value: text(c.curp) },
    { label: 'Fecha de nacimiento', value: dateLabel(c.fechaNacimiento) },
    { label: 'Sexo', value: text(c.sexo) },
    { label: 'Estado civil', value: text(c.estadoCivil) },
    { label: 'Celular', value: text(c.celular1) },
    { label: 'Correo', value: text(c.correo) },
    { label: 'Factura', value: yesNo(c.factura) },
    { label: 'Sindicalizado', value: yesNo(c.sindicalizado) },
    { label: 'Observaciones', value: text(c.observaciones), wide: true },
  ];
});

const contactoDomicilio = computed(() => {
  const c = props.form.contacto;
  return [
    { label: 'Dirección', value: text(c.direccion), wide: true },
    { label: 'Colonia', value: text(c.colonia) },
    { label: 'C.P.', value: text(c.cp) },
    { label: 'Municipio', value: text(c.municipio) },
    { label: 'Estado', value: text(c.estado) },
    { label: 'Entre calles', value: text(c.entreCalles), wide: true },
    { label: 'Seña particular', value: text(c.senaParticular), wide: true },
    {
      label: 'Entrega de documentación',
      value: c.domicilioEntregaDocumentacion === 'SI' ? 'En el domicilio del titular' : '—',
    },
  ];
});

const contactoFactura = computed(() => {
  const c = props.form.contacto;
  const regimen =
    c.regimenFiscal === 'OTRO' ? c.regimenFiscalOtro : c.regimenFiscal;
  return [
    { label: 'Tipo de persona', value: text(c.tipoPersona) },
    { label: 'RFC', value: text(c.rfc) },
    { label: 'Razón social', value: text(c.razonSocial), wide: true },
    { label: 'Código postal', value: text(c.facturaCp) },
    { label: 'Teléfono', value: text(c.telefonoFactura) },
    { label: 'Régimen fiscal', value: text(regimen) },
  ];
});

const sustitutoRows = computed(() => {
  const p = props.form.derechohabientes.titularSustituto;
  return [
    { label: 'Nombre', value: personName(p) },
    { label: 'Parentesco', value: text(p.parentesco) },
    { label: 'Celular', value: text(p.celular) },
    { label: 'Fecha de nacimiento', value: dateLabel(p.fechaNacimiento) },
  ];
});

const segundoPersonales = computed(() => {
  const p = props.form.segundoContacto;
  return [
    { label: 'Nombre', value: personName(p) },
    { label: 'Parentesco', value: text(p.parentesco) },
    { label: 'Celular', value: text(p.celular) },
    { label: 'Fecha de nacimiento', value: dateLabel(p.fechaNacimiento) },
  ];
});

const segundoDomicilio = computed(() => {
  const p = props.form.segundoContacto;
  return [
    { label: 'Dirección', value: text(p.direccion), wide: true },
    { label: 'Colonia', value: text(p.colonia) },
    { label: 'C.P.', value: text(p.cp) },
    { label: 'Entre calles', value: text(p.entreCalles) },
    {
      label: 'Entrega de documentación',
      value:
        p.domicilioEntregaDocumentacion === 'SI'
          ? 'En el domicilio del 2.º contacto'
          : '—',
    },
  ];
});

const planRows = computed(() => {
  const plan = props.form.ubicacionPlan;
  const rows = [
    {
      label: 'Tipo de plan',
      value: plan.planKind === 'PARQUE' ? 'Parque' : 'Plan a futuro',
    },
    { label: 'Plan', value: text(plan.nombrePlan) },
    { label: 'Precio', value: money(plan.precioPlan || props.form.pago.precioPlan) },
  ];
  if (plan.planKind === 'PLAN_FUTURO') {
    rows.push({ label: 'Servicio funerario', value: text(plan.servicioFunerario) });
  }
  if (plan.planKind === 'PARQUE') {
    rows.push(
      { label: 'Parque', value: text(plan.parqueFuneral) },
      { label: 'Sección', value: text(plan.seccion) },
      { label: 'Preasignación', value: plan.preasignacion ? 'Sí' : 'No' },
    );
    if (plan.preasignacion) {
      rows.push(
        { label: 'Cuadrante', value: text(plan.cuadrante) },
        { label: 'Ubicación', value: text(plan.numero) },
      );
    }
  }
  rows.push({
    label: 'Financiamiento',
    value: plan.withoutInterest ? 'Sin intereses' : 'Con intereses',
  });
  return rows;
});

const financiamientoRows = computed(() => {
  const pago = props.form.pago;
  const rows = [
    { label: 'Descuento', value: pago.promocionDescuento ? `${pago.promocionDescuento}%` : '—' },
    { label: 'Anticipo', value: money(pago.anticipo) },
    { label: 'Frecuencia', value: text(pago.frecuencia) },
    { label: 'Plazo (meses)', value: text(pago.plazo) },
    { label: 'Importe de cada pago', value: money(pago.importeCadaPago) },
    { label: 'Pago inicial', value: money(pago.pagoInicial) },
    { label: 'Saldo', value: money(pago.saldo) },
    { label: 'Próximo pago', value: dateLabel(pago.fechaProximoPago) },
    { label: 'Días específicos', value: text(pago.diasEspecificosPago) },
    { label: 'Asesor', value: text(pago.nombreAsesor) },
    { label: 'Jefe de ventas', value: text(pago.nombreJefeVentas) },
  ];
  return rows;
});

const cobranzaRows = computed(() => {
  const pago = props.form.pago;
  const c = props.form.contacto;
  const rows = [
    { label: 'Tipo de cobranza', value: cobranzaLabel(c.tipoCobranza) },
  ];
  if (cobranza.value === 'DOMICILIADO') {
    rows.push(
      { label: 'Número de tarjeta', value: text(formatCardNumber(pago.cuenta)) },
      { label: 'Vencimiento', value: text(pago.vencimientoTarjeta) },
      { label: 'Dígitos de seguridad', value: pago.cvv?.trim() ? 'Capturado' : '—' },
      { label: 'Titular de la tarjeta', value: text(pago.titularTarjeta) },
      { label: 'Banco', value: text(pago.banco) },
    );
  } else if (cobranza.value === 'NOMINA') {
    rows.push(
      { label: 'Empresa de convenio', value: text(pago.empresaNomina) },
      { label: 'Nombre del empleado', value: text(pago.nombreEmpleado) },
      { label: 'Número de empleado', value: text(pago.numeroEmpleado) },
      { label: 'Información de nómina', value: text(pago.infoNomina), wide: true },
    );
  }
  return rows;
});

const reconocimientos = computed(() => props.form.meta.reconocimientoVentas ?? []);

const documentos = computed(() => listSaleAttachments(props.form));

const declaraciones = computed(() => {
  const d = props.form.declaraciones;
  return [
    { label: 'Mercadotecnia', value: yesNo(d.aceptaMercadotecnia) },
    { label: 'Publicidad', value: yesNo(d.aceptaPublicidad) },
  ];
});

const tabItems = computed(
  (): Array<{ key: TabKey; label: string; count?: number }> => [
  { key: 'contrato' as const, label: 'Contrato' },
  { key: 'contacto' as const, label: 'Contacto' },
  { key: 'sustituto' as const, label: 'Titular sustituto' },
  {
    key: 'beneficiarios' as const,
    label: 'Beneficiarios',
    count: props.form.beneficiarios.length,
  },
  { key: 'segundo' as const, label: '2.º contacto' },
  { key: 'plan' as const, label: 'Plan' },
  {
    key: 'documentos' as const,
    label: 'Documentos',
    count: documentos.value.length,
  },
],
);

function setTab(key: TabKey) {
  tab.value = key;
}

function setInner(target: 'contacto' | 'segundo' | 'plan', key: InnerKey) {
  if (target === 'contacto') {
    contactoTab.value = key as 'personales' | 'domicilio' | 'factura';
  } else if (target === 'segundo') {
    segundoTab.value = key as 'personales' | 'domicilio';
  } else {
    planTab.value = key as 'plan' | 'financiamiento' | 'cobranza';
  }
}
</script>

<template>
  <VdModal :open="open" :title="title" xlarge @close="emit('close')">
    <div class="summary">
      <span :class="statusClass(status)">{{ statusLabel || '—' }}</span>
      <div class="summary__item">
        <span>Folio de solicitud</span>
        <strong>{{ folioSolicitud }}</strong>
      </div>
      <div class="summary__item">
        <span>Folio de venta</span>
        <strong :class="{ 'is-empty': folioVenta === '—' }">{{ folioVenta }}</strong>
      </div>
      <div class="summary__item">
        <span>Vendedor</span>
        <strong>{{ text(sellerName) }}</strong>
      </div>
      <div class="summary__item">
        <span>Alta</span>
        <strong>{{ text(createdAt) }}</strong>
      </div>
    </div>

    <div class="tabs" role="tablist" aria-label="Datos de la venta">
      <button
        v-for="item in tabItems"
        :key="item.key"
        type="button"
        class="tab"
        role="tab"
        :aria-selected="tab === item.key"
        :class="{ active: tab === item.key }"
        @click="setTab(item.key)"
      >
        {{ item.label }}
        <span v-if="item.count != null" class="tab__count">{{ item.count }}</span>
      </button>
    </div>

    <div v-if="tab === 'contrato'" class="pane">
      <dl class="sheet">
        <div v-for="row in contratoRows" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <template v-if="reconocimientos.length">
        <h3>Reconocimiento de ventas</h3>
        <ul class="docs">
          <li v-for="sale in reconocimientos" :key="sale.id">
            <strong>{{ sale.folio || `Venta #${sale.id}` }}</strong>
            <span>{{ sale.partnerName || '—' }}</span>
          </li>
        </ul>
      </template>
    </div>

    <div v-else-if="tab === 'contacto'" class="pane">
      <div class="tabs tabs--inner" role="tablist">
        <button
          type="button"
          class="tab"
          :class="{ active: contactoTab === 'personales' }"
          @click="setInner('contacto', 'personales')"
        >
          Datos personales
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: contactoTab === 'domicilio' }"
          @click="setInner('contacto', 'domicilio')"
        >
          Domicilio
        </button>
        <button
          v-if="pideFactura"
          type="button"
          class="tab"
          :class="{ active: contactoTab === 'factura' }"
          @click="setInner('contacto', 'factura')"
        >
          Factura
        </button>
      </div>
      <dl v-if="contactoTab === 'personales'" class="sheet">
        <div v-for="row in contactoPersonales" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <dl v-else-if="contactoTab === 'domicilio'" class="sheet">
        <div v-for="row in contactoDomicilio" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <dl v-else class="sheet">
        <div v-for="row in contactoFactura" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </div>

    <div v-else-if="tab === 'sustituto'" class="pane">
      <dl class="sheet">
        <div v-for="row in sustitutoRows" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </div>

    <div v-else-if="tab === 'beneficiarios'" class="pane">
      <p v-if="!form.beneficiarios.length" class="empty">Sin beneficiarios.</p>
      <article
        v-for="(person, index) in form.beneficiarios"
        :key="index"
        class="person"
      >
        <header class="person__head">
          <h3>{{ personName(person) }}</h3>
          <p>{{ text(person.parentesco) }}</p>
        </header>
        <dl class="sheet">
          <div :class="{ 'is-empty': text(person.celular) === '—' }">
            <dt>Celular</dt>
            <dd>{{ text(person.celular) }}</dd>
          </div>
          <div :class="{ 'is-empty': dateLabel(person.fechaNacimiento) === '—' }">
            <dt>Fecha de nacimiento</dt>
            <dd>{{ dateLabel(person.fechaNacimiento) }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <div v-else-if="tab === 'segundo'" class="pane">
      <div class="tabs tabs--inner" role="tablist">
        <button
          type="button"
          class="tab"
          :class="{ active: segundoTab === 'personales' }"
          @click="setInner('segundo', 'personales')"
        >
          Datos personales
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: segundoTab === 'domicilio' }"
          @click="setInner('segundo', 'domicilio')"
        >
          Dirección
        </button>
      </div>
      <dl v-if="segundoTab === 'personales'" class="sheet">
        <div v-for="row in segundoPersonales" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <dl v-else class="sheet">
        <div v-for="row in segundoDomicilio" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </div>

    <div v-else-if="tab === 'plan'" class="pane">
      <div class="tabs tabs--inner" role="tablist">
        <button
          type="button"
          class="tab"
          :class="{ active: planTab === 'plan' }"
          @click="setInner('plan', 'plan')"
        >
          Plan
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: planTab === 'financiamiento' }"
          @click="setInner('plan', 'financiamiento')"
        >
          Financiamiento
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: planTab === 'cobranza' }"
          @click="setInner('plan', 'cobranza')"
        >
          Tipo de cobranza
        </button>
      </div>
      <dl v-if="planTab === 'plan'" class="sheet">
        <div v-for="row in planRows" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <dl v-else-if="planTab === 'financiamiento'" class="sheet">
        <div v-for="row in financiamientoRows" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <dl v-else class="sheet">
        <div v-for="row in cobranzaRows" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </div>

    <div v-else class="pane">
      <dl class="sheet">
        <div v-for="row in declaraciones" :key="row.label" :class="{ wide: row.wide, 'is-empty': row.value === '—' }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <h3>Archivos</h3>
      <p v-if="!documentos.length" class="empty">Sin archivos anexados.</p>
      <ul v-else class="docs">
        <li v-for="item in documentos" :key="item.kind">
          <strong>{{ item.label }}</strong>
          <span>{{ item.attachment.name || 'Anexado' }}</span>
        </li>
      </ul>
    </div>

    <template #footer>
      <button type="button" class="btn btn-primary" @click="emit('close')">
        Cerrar
      </button>
    </template>
  </VdModal>
</template>

<style scoped>
.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.85rem 1.25rem;
  margin-bottom: 0.85rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--vd-line);
  border-radius: 12px;
  background: #f7f9fb;
}

.summary__item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.summary__item span {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--vd-muted);
}

.summary__item strong {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--vd-ink, #1a2430);
  overflow-wrap: anywhere;
}

.summary__item strong.is-empty {
  color: #9aa3ab;
  font-weight: 600;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  background: rgba(53, 100, 125, 0.1);
  color: var(--gsm-blue);
}

.badge--payment,
.badge--validation {
  background: rgba(180, 120, 20, 0.14);
  color: #8a5a0a;
}

.badge--sign {
  background: rgba(53, 100, 125, 0.12);
  color: var(--gsm-blue);
}

.badge--done {
  background: rgba(47, 111, 78, 0.12);
  color: var(--vd-ok, #2f6f4e);
}

.badge--rejected {
  background: rgba(196, 40, 28, 0.1);
  color: var(--vd-danger, #c4281c);
}

.badge--correction,
.badge--draft {
  background: #eceff1;
  color: #5f6770;
}

.badge--review {
  background: rgba(107, 91, 149, 0.14);
  color: #5c4d82;
}

.tabs {
  display: flex;
  gap: 0.15rem;
  margin: 0 0 1rem;
  overflow-x: auto;
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fff;
  border-bottom: 1px solid var(--vd-line);
}

.tabs--inner {
  position: static;
  gap: 0.25rem;
  margin-bottom: 0.85rem;
  padding: 0.2rem;
  border: 1px solid var(--vd-line);
  border-bottom: 1px solid var(--vd-line);
  border-radius: 10px;
  background: #f4f7f8;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--vd-muted);
  border-radius: 0;
  padding: 0.55rem 0.75rem;
  font-size: 0.84rem;
  font-weight: 600;
  min-height: 40px;
  cursor: pointer;
  white-space: nowrap;
}

.tab.active {
  color: var(--gsm-blue);
  border-bottom-color: var(--gsm-blue);
  background: transparent;
}

.tabs--inner .tab {
  border-bottom: 0;
  border-radius: 8px;
  padding: 0.4rem 0.7rem;
  min-height: 36px;
}

.tabs--inner .tab.active {
  background: #fff;
  color: var(--gsm-blue);
  box-shadow: 0 1px 2px rgba(28, 42, 51, 0.08);
}

.tab__count {
  min-width: 1.25rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: rgba(53, 100, 125, 0.1);
  color: var(--gsm-blue);
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
}

.tab.active .tab__count {
  background: var(--gsm-blue);
  color: #fff;
}

.tabs--inner .tab.active .tab__count {
  background: rgba(53, 100, 125, 0.12);
  color: var(--gsm-blue);
}

.pane h3 {
  margin: 1rem 0 0.55rem;
  font-size: 1rem;
  color: var(--vd-ink, #1a2430);
}

.person__head h3 {
  margin: 0;
}

.sheet {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  border: 1px solid var(--vd-line);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.sheet > div {
  min-width: 0;
  padding: 0.65rem 0.85rem;
  background: #fff;
  border-bottom: 1px solid var(--vd-line);
  box-shadow: inset -1px 0 0 var(--vd-line);
}

.sheet > div.wide {
  grid-column: 1 / -1;
  box-shadow: none;
}

dt {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--vd-muted);
}

dd {
  margin: 0.15rem 0 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vd-ink, #1a2430);
  overflow-wrap: anywhere;
}

.sheet > div.is-empty dd {
  color: #9aa3ab;
  font-weight: 500;
}

.person + .person {
  margin-top: 0.85rem;
}

.person__head {
  margin-bottom: 0.45rem;
}

.person__head p {
  margin: 0.1rem 0 0;
  color: var(--vd-muted);
  font-size: 0.86rem;
}

.docs {
  list-style: none;
  margin: 0.7rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.docs li {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  background: #fff;
}

.docs span {
  color: var(--vd-muted);
  text-align: right;
  overflow-wrap: anywhere;
}

.empty {
  margin: 0;
  padding: 0.85rem 0.2rem;
  color: var(--vd-muted);
}

@media (max-width: 700px) {
  .summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }

  .badge {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .sheet {
    grid-template-columns: 1fr;
  }

  .docs li {
    flex-direction: column;
    gap: 0.2rem;
  }

  .docs span {
    text-align: left;
  }
}
</style>
