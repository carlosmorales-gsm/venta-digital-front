import { http } from '../../../shared/api/http';
import {
  emptyBeneficiary,
  syncBeneficiariosToDerechos,
  type ReconocimientoVenta,
  type SaleBeneficiary,
  type SaleFormData,
} from '../types/sale-form';

export type CatalogClienteContacto = {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  sexo: string;
  curp: string;
  factura: string;
  tipoPersona?: string;
  razonSocial?: string;
  rfc?: string;
  facturaCp?: string;
  regimenFiscal?: string;
  regimenFiscalOtro?: string;
  telefonoFactura?: string;
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

export type CatalogClienteSegundo = {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  celular: string;
  parentesco: string;
  direccion: string;
  colonia: string;
  cp: string;
  entreCalles: string;
  fechaNacimiento: string;
  domicilioEntregaDocumentacion: string;
};

export type CatalogCliente = {
  id: number;
  name: string;
  contacto: CatalogClienteContacto;
  segundoContacto: CatalogClienteSegundo | null;
  titularSustituto?: SaleBeneficiary;
  beneficiarios?: SaleBeneficiary[];
};

export function clienteDisplayName(c: CatalogCliente): string {
  const p = c.contacto;
  const full = [p.nombres, p.apellidoPaterno, p.apellidoMaterno]
    .filter(Boolean)
    .join(' ')
    .trim();
  return full || c.name || `Cliente #${c.id}`;
}

export function clienteHasSustituto(c: CatalogCliente): boolean {
  const t = c.titularSustituto;
  return Boolean(t?.nombres || t?.apellidoPaterno || t?.apellidoMaterno);
}

export function clienteHasBeneficiarios(c: CatalogCliente): boolean {
  return Boolean(c.beneficiarios?.some((b) => b.nombres || b.apellidoPaterno));
}

export type CatalogApplyGroups = {
  contacto: boolean;
  segundoContacto: boolean;
  titularSustituto: boolean;
  beneficiarios: boolean;
};

export const ALL_CATALOG_GROUPS: CatalogApplyGroups = {
  contacto: true,
  segundoContacto: true,
  titularSustituto: true,
  beneficiarios: true,
};

export type VentasSuspendidas = {
  titular: ReconocimientoVenta[];
  beneficiario: ReconocimientoVenta[];
};

export async function searchCatalogClientes(
  q: string,
  limit = 20,
): Promise<CatalogCliente[]> {
  const { data } = await http.get<CatalogCliente[]>('/odoo/clientes', {
    params: { q, limit },
    skipGlobalLoading: true,
  });
  return Array.isArray(data) ? data : [];
}

export async function listClienteSuspendidas(
  partnerId: number,
): Promise<VentasSuspendidas> {
  return listClienteVentas(partnerId, 'suspendidas');
}

export async function listClienteActivas(
  partnerId: number,
): Promise<VentasSuspendidas> {
  return listClienteVentas(partnerId, 'activas');
}

async function listClienteVentas(
  partnerId: number,
  kind: 'suspendidas' | 'activas',
): Promise<VentasSuspendidas> {
  const { data } = await http.get<VentasSuspendidas>(
    `/odoo/clientes/${partnerId}/${kind}`,
    { skipGlobalLoading: true },
  );
  return {
    titular: Array.isArray(data?.titular) ? data.titular : [],
    beneficiario: Array.isArray(data?.beneficiario) ? data.beneficiario : [],
  };
}

export function applyCatalogClienteToForm(
  form: SaleFormData,
  cliente: CatalogCliente,
  groups: CatalogApplyGroups = ALL_CATALOG_GROUPS,
) {
  if (groups.contacto) Object.assign(form.contacto, cliente.contacto);
  if (groups.segundoContacto && cliente.segundoContacto) {
    Object.assign(form.segundoContacto, cliente.segundoContacto);
  }
  if (groups.titularSustituto && clienteHasSustituto(cliente)) {
    Object.assign(form.derechohabientes.titularSustituto, {
      ...emptyBeneficiary(),
      ...cliente.titularSustituto,
    });
  }
  if (groups.beneficiarios && clienteHasBeneficiarios(cliente)) {
    form.beneficiarios.splice(
      0,
      form.beneficiarios.length,
      ...(cliente.beneficiarios || []).map((b) => ({
        ...emptyBeneficiary(),
        ...b,
      })),
    );
  }
  if (!form.beneficiarios.length) {
    form.beneficiarios.push(emptyBeneficiary());
  }
  syncBeneficiariosToDerechos(form);
}
