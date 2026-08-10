import { jsPDF } from 'jspdf';
import { formatUtcToLocal } from '../../../shared/utils/datetime';
import { mergeSaleForm, type SaleListItem } from '../types/sale-form';

const COLORS = {
  blue: [53, 100, 125] as const,
  ink: [32, 38, 42] as const,
  muted: [100, 110, 118] as const,
  line: [220, 226, 230] as const,
  headerBg: [53, 100, 125] as const,
  white: [255, 255, 255] as const,
  rowAlt: [248, 250, 251] as const,
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PENDING_SIGNATURE: 'Pendiente de firma',
  COMPLETED: 'Completada',
  SUBMITTED: 'Completada',
  DRAFT: 'Borrador',
};

export type MonitorSalesPdfFilters = {
  sellerName?: string;
  statusLabel?: string;
  dateFrom?: string;
  dateTo?: string;
  client?: string;
};

function setRgb(
  doc: jsPDF,
  mode: 'text' | 'draw' | 'fill',
  rgb: readonly [number, number, number],
) {
  if (mode === 'text') doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  else if (mode === 'draw') doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function formatCalendarDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return isoDate;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatMoney(raw: string | number | null | undefined): string {
  const n = Number(String(raw ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n) || String(raw ?? '').trim() === '') return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(n);
}

function formatDiscount(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim();
  if (!t) return '—';
  const n = Number(t.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return `${t}%`;
  return `${n}%`;
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function moneyParts(item: SaleListItem) {
  const form = mergeSaleForm(item.payload);
  return {
    precioPlan: form.ubicacionPlan.precioPlan || form.pago.precioPlan,
    descuento: form.pago.promocionDescuento,
    anticipo: form.pago.anticipo,
    saldo: form.pago.saldo,
  };
}

function filterSummary(filters: MonitorSalesPdfFilters): string[] {
  const parts: string[] = [];
  if (filters.dateFrom && filters.dateTo && filters.dateFrom === filters.dateTo) {
    parts.push(`Día: ${formatCalendarDate(filters.dateFrom)}`);
  } else if (filters.dateFrom || filters.dateTo) {
    parts.push(
      `Del ${filters.dateFrom ? formatCalendarDate(filters.dateFrom) : '…'} al ${
        filters.dateTo ? formatCalendarDate(filters.dateTo) : '…'
      }`,
    );
  }
  if (filters.sellerName) parts.push(`Vendedor: ${filters.sellerName}`);
  if (filters.statusLabel) parts.push(`Estatus: ${filters.statusLabel}`);
  if (filters.client) parts.push(`Cliente: "${filters.client}"`);
  return parts;
}

/**
 * Exporta el listado filtrado de ventas (monitor) a PDF horizontal.
 */
export async function downloadMonitorSalesPdf(
  items: SaleListItem[],
  filters: MonitorSalesPdfFilters = {},
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginBottom = 12;
  let y = 12;

  // Encabezado
  setRgb(doc, 'fill', COLORS.headerBg);
  doc.rect(0, 0, pageW, 22, 'F');
  setRgb(doc, 'text', COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Grupo San Martín · Venta Digital', marginX, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Reporte de ventas', marginX, 17);

  const generated = formatUtcToLocal(new Date().toISOString());
  doc.setFontSize(8);
  doc.text(`Generado: ${generated}`, pageW - marginX, 17, { align: 'right' });

  y = 28;

  const summary = filterSummary(filters);
  setRgb(doc, 'text', COLORS.muted);
  doc.setFontSize(8);
  if (summary.length) {
    doc.text(`Filtros: ${summary.join(' · ')}`, marginX, y);
  } else {
    doc.text('Filtros: sin aplicar (todas las ventas visibles)', marginX, y);
  }
  y += 5;
  setRgb(doc, 'text', COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.text(`${items.length} venta${items.length === 1 ? '' : 's'}`, marginX, y);
  y += 6;

  // Usa todo el ancho útil de la hoja horizontal
  const tableW = pageW - marginX * 2;
  const cols = [
    { key: 'fecha', label: 'Fecha', w: tableW * 0.12 },
    { key: 'titular', label: 'Titular', w: tableW * 0.2 },
    { key: 'vendedor', label: 'Vendedor', w: tableW * 0.15 },
    { key: 'estatus', label: 'Estatus', w: tableW * 0.13 },
    { key: 'precio', label: 'Costo plan', w: tableW * 0.11 },
    { key: 'descuento', label: 'Desc.', w: tableW * 0.07 },
    { key: 'anticipo', label: 'Anticipo', w: tableW * 0.11 },
    { key: 'saldo', label: 'Saldo', w: tableW * 0.11 },
  ] as const;
  const rowH = 7;

  function drawHeader() {
    setRgb(doc, 'fill', COLORS.headerBg);
    doc.rect(marginX, y, tableW, rowH, 'F');
    setRgb(doc, 'text', COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let x = marginX + 1.5;
    for (const col of cols) {
      doc.text(col.label, x, y + 4.6);
      x += col.w;
    }
    y += rowH;
  }

  function ensureSpace(needed: number) {
    if (y + needed <= pageH - marginBottom) return;
    doc.addPage();
    y = 12;
    drawHeader();
  }

  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  items.forEach((item, index) => {
    ensureSpace(rowH + 1);
    const money = moneyParts(item);
    const values: Record<(typeof cols)[number]['key'], string> = {
      fecha: formatUtcToLocal(item.createdAt, {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
      titular: item.titularName?.trim() || '—',
      vendedor: item.sellerName?.trim() || '—',
      estatus: statusLabel(item.status),
      precio: formatMoney(money.precioPlan),
      descuento: formatDiscount(money.descuento),
      anticipo: formatMoney(money.anticipo),
      saldo: formatMoney(money.saldo),
    };

    if (index % 2 === 1) {
      setRgb(doc, 'fill', COLORS.rowAlt);
      doc.rect(marginX, y, tableW, rowH, 'F');
    }

    setRgb(doc, 'draw', COLORS.line);
    doc.setLineWidth(0.15);
    doc.line(marginX, y + rowH, marginX + tableW, y + rowH);

    setRgb(doc, 'text', COLORS.ink);
    let x = marginX + 1.5;
    for (const col of cols) {
      const text = doc.splitTextToSize(values[col.key], col.w - 3);
      const line = Array.isArray(text) ? text[0] : text;
      doc.text(line || '—', x, y + 4.6);
      x += col.w;
    }
    y += rowH;
  });

  if (!items.length) {
    setRgb(doc, 'text', COLORS.muted);
    doc.setFontSize(9);
    doc.text('No hay ventas con los filtros actuales.', marginX, y + 8);
  }

  // Pie de página
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setRgb(doc, 'text', COLORS.muted);
    doc.setFontSize(7);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' },
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`ventas-monitor-${stamp}.pdf`);
}
