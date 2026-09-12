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
};

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return Number(amount) || 0;
  const fromRate = CURRENCY_RATES_TO_USD[fromCurrency] ?? 1;
  const toRate = CURRENCY_RATES_TO_USD[toCurrency] ?? 1;
  return ((Number(amount) || 0) * fromRate) / toRate;
}