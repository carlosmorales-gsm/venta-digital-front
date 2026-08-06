export type SaleStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PENDING_SIGNATURE'
  | 'COMPLETED'
  | 'SUBMITTED'; // compat

export type PlanKind = 'PARQUE' | 'PLAN_FUTURO';

export interface SalePersonName {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
}

export interface SaleBeneficiary extends SalePersonName {
  parentesco: string;
  celular: string;
  fechaNacimiento: string;
}

export interface SaleAttachment {
  name: string;
  mime: string;
  dataBase64: string;
}

export interface SaleFormData {
  meta: {
    fecha: string;
    contrato: string;
    origenVenta: string;
    folioSolicitud: string;
    fechaServicio: string;
    estatus: string;
    anterior: string;
    verificacion: string;
  };
  contacto: SalePersonName & {
    sexo: string;
    curp: string;
    factura: string;
    direccion: string;
    colonia: string;
    cp: string;
    entreCalles: string;
    senaParticular: string;
    municipio: string;
    estado: string;
    tipoCobranza: string;
    fechaNacimiento: string;
    sindicalizado: string;
    observaciones: string;
    celular1: string;
    celular2: string;
    correo: string;
    estadoCivil: string;
    domicilioEntregaDocumentacion: string;
  };
  segundoContacto: SalePersonName & {
    celular: string;
    parentesco: string;
    direccion: string;
    colonia: string;
    cp: string;
    entreCalles: string;
    fechaNacimiento: string;
    domicilioEntregaDocumentacion: string;
  };
  /** 1 obligatorio, máx. 2 */
  beneficiarios: SaleBeneficiary[];
  /** Compat PDF */
  derechohabientes: {
    titularSustituto: SaleBeneficiary;
    primerBeneficiario: SaleBeneficiary;
    segundoBeneficiario: SaleBeneficiary;
  };
  ubicacionPlan: {
    planKind: PlanKind;
    nombrePlan: string;
    seccion: string;
    cuadrante: string;
    numero: string;
    servicioFunerario: string;
    parqueFuneral: string;
    preasignacion: string;
  };
  pago: {
    precioPlan: string;
    frecuencia: string;
    promocionDescuento: string;
    anticipo: string;
    pagoInicial: string;
    plazo: string;
    importeCadaPago: string;
    saldo: string;
    fechaProximoPago: string;
    diasEspecificosPago: string;
    formaPago: string;
    cuenta: string;
    banco: string;
    nombreJefeVentas: string;
    nombreAsesor: string;
  };
  declaraciones: {
    aceptaMercadotecnia: string;
    aceptaPublicidad: string;
  };
  documentos: {
    ine: SaleAttachment | null;
    comprobanteDomicilio: SaleAttachment | null;
    firmaCliente: SaleAttachment | null;
  };
}

export type ReuseGroup = 'contacto' | 'segundoContacto' | 'beneficiarios';

export interface SaleListItem {
  id: number;
  sellerId: number;
  sellerName: string;
  status: SaleStatus;
  amount: number;
  titularName: string | null;
  payload: SaleFormData | Record<string, unknown>;
  draftExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  driveFolderUrl?: string | null;
}

export function emptyPerson(): SalePersonName {
  return { apellidoPaterno: '', apellidoMaterno: '', nombres: '' };
}

export function emptyBeneficiary(): SaleBeneficiary {
  return {
    ...emptyPerson(),
    parentesco: '',
    celular: '',
    fechaNacimiento: '',
  };
}

function syncDerechos(beneficiarios: SaleBeneficiary[]) {
  return {
    titularSustituto: beneficiarios[0] ? { ...beneficiarios[0] } : emptyBeneficiary(),
    primerBeneficiario: beneficiarios[0]
      ? { ...beneficiarios[0] }
      : emptyBeneficiary(),
    segundoBeneficiario: beneficiarios[1]
      ? { ...beneficiarios[1] }
      : emptyBeneficiary(),
  };
}

export function createEmptySaleForm(): SaleFormData {
  const today = new Date().toISOString().slice(0, 10);
  const beneficiarios = [emptyBeneficiary()];
  return {
    meta: {
      fecha: today,
      contrato: '',
      origenVenta: '',
      folioSolicitud: '',
      fechaServicio: '',
      estatus: 'ACTIVO',
      anterior: '',
      verificacion: '',
    },
    contacto: {
      ...emptyPerson(),
      sexo: '',
      curp: '',
      factura: '',
      direccion: '',
      colonia: '',
      cp: '',
      entreCalles: '',
      senaParticular: '',
      municipio: '',
      estado: '',
      tipoCobranza: '',
      fechaNacimiento: '',
      sindicalizado: 'NO',
      observaciones: '',
      celular1: '',
      celular2: '',
      correo: '',
      estadoCivil: '',
      domicilioEntregaDocumentacion: '',
    },
    segundoContacto: {
      ...emptyPerson(),
      celular: '',
      parentesco: '',
      direccion: '',
      colonia: '',
      cp: '',
      entreCalles: '',
      fechaNacimiento: '',
      domicilioEntregaDocumentacion: '',
    },
    beneficiarios,
    derechohabientes: syncDerechos(beneficiarios),
    ubicacionPlan: {
      planKind: 'PLAN_FUTURO',
      nombrePlan: '',
      seccion: '',
      cuadrante: '',
      numero: '',
      servicioFunerario: '',
      parqueFuneral: '',
      preasignacion: 'N/A',
    },
    pago: {
      precioPlan: '',
      frecuencia: '',
      promocionDescuento: '',
      anticipo: '',
      pagoInicial: '',
      plazo: '',
      importeCadaPago: '',
      saldo: '',
      fechaProximoPago: '',
      diasEspecificosPago: '',
      formaPago: '',
      cuenta: '',
      banco: '',
      nombreJefeVentas: '',
      nombreAsesor: '',
    },
    declaraciones: {
      aceptaMercadotecnia: '',
      aceptaPublicidad: '',
    },
    documentos: {
      ine: null,
      comprobanteDomicilio: null,
      firmaCliente: null,
    },
  };
}

/** Datos demo para el modal de pago (si la venta aún no tiene precio). */
export function createPrefillPago(): SaleFormData['pago'] {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const fechaProximo = nextMonth.toISOString().slice(0, 10);

  return {
    precioPlan: '45000',
    frecuencia: 'MENSUAL',
    promocionDescuento: '10% anticipo',
    anticipo: '5000',
    pagoInicial: '4500',
    plazo: '24',
    importeCadaPago: '1666.67',
    saldo: '35500',
    fechaProximoPago: fechaProximo,
    diasEspecificosPago: '15 de cada mes',
    formaPago: 'TRANSFERENCIA',
    cuenta: '0123456789',
    banco: 'BBVA',
    nombreJefeVentas: 'Carlos Mendoza',
    nombreAsesor: '',
  };
}

export function createPrefillSaleForm(): SaleFormData {
  const base = createEmptySaleForm();
  const today = new Date().toISOString().slice(0, 10);
  base.meta = {
    ...base.meta,
    contrato: 'VD-DEMO-001',
    origenVenta: 'field_selling',
    folioSolicitud: 'SOL-2026-0842',
    verificacion: 'Pendiente',
  };
  base.contacto = {
    ...base.contacto,
    apellidoPaterno: 'García',
    apellidoMaterno: 'López',
    nombres: 'María Elena',
    sexo: 'F',
    // CURP demo válida: María Elena García López · F · 15/03/1985 · Sinaloa
    curp: 'GALE850315MSLRPL09',
    factura: 'NO',
    direccion: 'Calle Hidalgo 245',
    colonia: 'Centro',
    cp: '80000',
    entreCalles: 'Juárez y Morelos',
    senaParticular: 'Portón azul',
    municipio: 'Culiacán',
    estado: 'Sinaloa',
    tipoCobranza: 'VENTANILLA',
    fechaNacimiento: '1985-03-15',
    sindicalizado: 'NO',
    observaciones: 'Prefiere contacto por WhatsApp por la tarde.',
    celular1: '6671234567',
    celular2: '6679876543',
    correo: 'maria.garcia.demo@email.com',
    estadoCivil: 'CASADO',
    domicilioEntregaDocumentacion: 'Mismo domicilio del titular',
  };
  base.segundoContacto = {
    ...base.segundoContacto,
    apellidoPaterno: 'García',
    apellidoMaterno: 'Ruiz',
    nombres: 'José Luis',
    celular: '6675551212',
    parentesco: 'Esposo',
    direccion: 'Calle Hidalgo 245',
    colonia: 'Centro',
    cp: '80000',
    entreCalles: 'Juárez y Morelos',
    fechaNacimiento: '1982-07-22',
  };
  base.beneficiarios = [
    {
      apellidoPaterno: 'García',
      apellidoMaterno: 'García',
      nombres: 'Ana Sofía',
      parentesco: 'Hija',
      celular: '6674443322',
      fechaNacimiento: '2010-11-08',
    },
  ];
  base.derechohabientes = syncDerechos(base.beneficiarios);
  base.ubicacionPlan = {
    planKind: 'PARQUE',
    nombrePlan: 'Plan Familiar Premium',
    seccion: 'A',
    cuadrante: '3',
    numero: '128',
    servicioFunerario: 'Servicio completo',
    parqueFuneral: 'Parque San Martín Culiacán',
    preasignacion: 'N/A',
  };
  base.declaraciones = {
    aceptaMercadotecnia: 'NO',
    aceptaPublicidad: 'SI',
  };
  base.meta.fecha = today;
  return base;
}

export function fullName(p: SalePersonName): string {
  return [p.apellidoPaterno, p.apellidoMaterno, p.nombres]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(' ');
}

export function titularDisplayName(form: SaleFormData): string {
  return fullName(form.contacto) || 'Sin titular';
}

export function mergeSaleForm(raw: unknown): SaleFormData {
  const base = createEmptySaleForm();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Partial<SaleFormData> & {
    derechohabientes?: SaleFormData['derechohabientes'];
  };

  let beneficiarios = Array.isArray(src.beneficiarios)
    ? src.beneficiarios.map((b) => ({ ...emptyBeneficiary(), ...b }))
    : [];
  if (!beneficiarios.length && src.derechohabientes) {
    const d = src.derechohabientes;
    if (d.primerBeneficiario?.nombres || d.primerBeneficiario?.apellidoPaterno) {
      beneficiarios.push({ ...emptyBeneficiary(), ...d.primerBeneficiario });
    }
    if (d.segundoBeneficiario?.nombres || d.segundoBeneficiario?.apellidoPaterno) {
      beneficiarios.push({ ...emptyBeneficiary(), ...d.segundoBeneficiario });
    }
  }
  if (!beneficiarios.length) beneficiarios = [emptyBeneficiary()];
  beneficiarios = beneficiarios.slice(0, 2);

  return {
    ...base,
    meta: { ...base.meta, ...(src.meta ?? {}) },
    contacto: {
      ...base.contacto,
      ...(src.contacto ?? {}),
      sindicalizado:
        String(src.contacto?.sindicalizado ?? '')
          .trim()
          .toUpperCase() === 'SI'
          ? 'SI'
          : 'NO',
    },
    segundoContacto: {
      ...base.segundoContacto,
      ...(src.segundoContacto ?? {}),
    },
    beneficiarios,
    derechohabientes: syncDerechos(beneficiarios),
    ubicacionPlan: {
      ...base.ubicacionPlan,
      ...(src.ubicacionPlan ?? {}),
      planKind:
        src.ubicacionPlan?.planKind === 'PARQUE' ? 'PARQUE' : 'PLAN_FUTURO',
    },
    pago: { ...base.pago, ...(src.pago ?? {}) },
    declaraciones: { ...base.declaraciones, ...(src.declaraciones ?? {}) },
    documentos: {
      ine: src.documentos?.ine ?? null,
      comprobanteDomicilio: src.documentos?.comprobanteDomicilio ?? null,
      firmaCliente: src.documentos?.firmaCliente ?? null,
    },
  };
}

export function syncBeneficiariosToDerechos(form: SaleFormData) {
  form.derechohabientes = syncDerechos(form.beneficiarios);
}
