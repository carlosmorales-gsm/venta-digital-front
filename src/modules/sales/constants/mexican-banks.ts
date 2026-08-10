/** Bancos / instituciones frecuentes en México (referencia Banxico SPEI). */
export const MEXICAN_BANKS = [
  'BBVA México',
  'Banorte',
  'Santander',
  'Citibanamex',
  'HSBC',
  'Scotiabank',
  'Inbursa',
  'Banco del Bajío',
  'Banregio',
  'Afirme',
  'Banco Azteca',
  'BanCoppel',
  'Multiva',
  'Invex',
  'Mifel',
  'Compartamos Banco',
  'Hey Banco',
  'Nu México',
  'Ualá',
  'Actinver',
  'Banjercito',
  'Banobras',
] as const;

export const BANK_OTHER = 'Otro';

export const BANK_OPTIONS = [...MEXICAN_BANKS, BANK_OTHER] as const;

export function isOtherBank(value: string) {
  return (value || '').trim() === BANK_OTHER;
}
