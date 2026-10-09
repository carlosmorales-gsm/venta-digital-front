import { http } from '../../../shared/api/http';

export type MascotaCatalogo = {
  id: number;
  name: string;
  code?: string;
};

function mapRows(rows: unknown): MascotaCatalogo[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const item = row as { id?: unknown; name?: unknown; code?: unknown };
      const code = String(item.code ?? '').trim().toLowerCase();
      return {
        id: Number(item.id) || 0,
        name: String(item.name ?? '').trim(),
        code: code || undefined,
      };
    })
    .filter((item) => item.id > 0 && item.name);
}

export async function fetchMascotaEspecies(): Promise<MascotaCatalogo[]> {
  const { data } = await http.get('/odoo/mascotas/especies', {
    skipGlobalLoading: true,
  });
  return mapRows(data);
}

export async function fetchMascotaRazas(
  especieId: number,
): Promise<MascotaCatalogo[]> {
  if (!especieId) return [];
  const { data } = await http.get('/odoo/mascotas/razas', {
    params: { especieId },
    skipGlobalLoading: true,
  });
  return mapRows(data);
}

export async function fetchMascotaTamanos(): Promise<MascotaCatalogo[]> {
  const { data } = await http.get('/odoo/mascotas/tamanos', {
    skipGlobalLoading: true,
  });
  return mapRows(data);
}
