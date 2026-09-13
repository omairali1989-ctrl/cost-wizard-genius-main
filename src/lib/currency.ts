export interface CurrencyOption {
  code: string;
  label: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "PKR", label: "PKR - Pakistani Rupee" },
  { code: "AED", label: "AED - UAE Dirham" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "GBP", label: "GBP - Pound Sterling" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "SAR", label: "SAR - Saudi Riyal" },
  { code: "CAD", label: "CAD - Canadian Dollar" },
  { code: "AUD", label: "AUD - Australian Dollar" },
  { code: "INR", label: "INR - Indian Rupee" },
  { code: "QAR", label: "QAR - Qatari Riyal" },
  { code: "SGD", label: "SGD - Singapore Dollar" },
  { code: "ZAR", label: "ZAR - South African Rand" },
];

// Rates are relative to USD and can be replaced when the workspace adds live FX settings.
export const CURRENCY_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  PKR: 0.00358,
  AED: 0.2723,
  GBP: 1.27,
  EUR: 1.08,
  SAR: 0.2667,
  CAD: 0.74,
  AUD: 0.66,
  INR: 0.012,
  QAR: 0.2747,
  SGD: 0.74,
  ZAR: 0.055,
};

export const normalizeCurrency = (code: string): string =>
  String(code ?? "")
    .trim()
    .toUpperCase();

export function isSupportedCurrency(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(CURRENCY_RATES_TO_USD, normalizeCurrency(code));
}

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  const value = Number(amount) || 0;
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return value;
  const fromRate = CURRENCY_RATES_TO_USD[from];
  const toRate = CURRENCY_RATES_TO_USD[to];
  // An unrecognised code must not be silently valued as USD — leave the amount
  // untouched rather than scaling it by a rate that does not apply.
  if (!fromRate || !toRate) return value;
  return (value * fromRate) / toRate;
}
