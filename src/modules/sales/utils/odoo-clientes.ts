import { http } from '../../../shared/api/http';
import type { SaleBeneficiary } from '../types/sale-form';

export type CatalogClienteContacto = {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
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
