export const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Fictional example data (no personal data should live here: the user's real
// data stays only in their browser's localStorage and is never committed).
// Label and month values are intentionally left in French, matching the
// app's fr-FR/EUR locale and the example budget items a French user would enter.
export function seedData() {
  return {
    view: 'cards',
    income: [
      { id: uid(), label: 'Salaire', amount: 2500, day: 28 },
      { id: uid(), label: 'Revenu complémentaire', amount: 300, day: 5 }
    ],
    recurring: [
      { id: uid(), label: 'Assurance habitation', amount: 45, day: 9 },
      { id: uid(), label: 'Courses', amount: 250, day: '' },
      { id: uid(), label: 'Taxe foncière', amount: 200, day: '' },
      { id: uid(), label: 'Téléphone', amount: 25, day: 5 },
      { id: uid(), label: 'Électricité', amount: 70, day: 5 },
      { id: uid(), label: 'Comptable', amount: 30, day: 25 },
      { id: uid(), label: 'Box internet', amount: 35, day: '' },
      { id: uid(), label: 'Streaming vidéo', amount: 15, day: 3 },
      { id: uid(), label: 'Musique', amount: 10, day: 16 },
      { id: uid(), label: 'Salle de sport', amount: 30, day: 10 }
    ],
    loans: [
      { id: uid(), label: 'Prêt immobilier', amount: 700, totalMonths: 240, endDate: '2043-05-01' },
      { id: uid(), label: 'Crédit auto', amount: 300, totalMonths: 48, endDate: '2028-03-01' },
      { id: uid(), label: 'Crédit conso', amount: 150, totalMonths: 36, endDate: '2029-01-01' }
    ],
    oneOff: [
      { id: uid(), label: 'Entretien voiture', amount: 150, month: 'Mars' },
      { id: uid(), label: 'Assurance annuelle', amount: 90, month: 'Janvier' },
      { id: uid(), label: 'Vacances', amount: 500, month: 'Août' },
      { id: uid(), label: 'Cadeaux fêtes', amount: 200, month: 'Décembre' }
    ],
    quarterly: [
      {
        id: uid(),
        label: 'Charges copropriété',
        amount: 400,
        occurrences: 4,
        monthsLabel: 'Janvier, Avril, Juillet, Octobre'
      }
    ],
    savings: []
  };
}

// Accepts both the current English-keyed schema and the legacy French-keyed
// schema (revenus/courantes/credits/ponctuelles/trimestrielles/epargne) so
// data saved by earlier versions of the app keeps working.
export function normalizeState(data = {}) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    view: data.view === 'compact' ? 'compact' : 'cards',
    income: arr(data.income ?? data.revenus),
    recurring: arr(data.recurring ?? data.courantes),
    loans: arr(data.loans ?? data.credits),
    oneOff: arr(data.oneOff ?? data.ponctuelles),
    quarterly: arr(data.quarterly ?? data.trimestrielles),
    savings: arr(data.savings ?? data.epargne)
  };
}

export const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    Math.round(n) || 0
  );

export function monthsBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function computeTotals(state) {
  const sum = (arr) => arr.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalIn = sum(state.income);
  const totalRecurring = sum(state.recurring);
  const totalLoans = sum(state.loans);
  const totalOut = totalRecurring + totalLoans;
  const totalSavings = sum(state.savings);
  const remainingBeforeSavings = totalIn - totalOut;
  const remainingAfterSavings = remainingBeforeSavings - totalSavings;
  const totalOneOff = sum(state.oneOff);
  const totalQuarterly = state.quarterly.reduce(
    (s, i) => s + (Number(i.amount) || 0) * (Number(i.occurrences) || 1),
    0
  );
  const monthlyOneOff = totalOneOff / 12;
  const monthlyQuarterly = totalQuarterly / 12;
  const smoothedRemaining = remainingAfterSavings - monthlyOneOff - monthlyQuarterly;
  return {
    totalIn,
    totalRecurring,
    totalLoans,
    totalOut,
    totalSavings,
    remainingBeforeSavings,
    remainingAfterSavings,
    totalOneOff,
    totalQuarterly,
    monthlyOneOff,
    monthlyQuarterly,
    smoothedRemaining
  };
}

export function loanElapsedMonths(item, today = new Date()) {
  const end = new Date(item.endDate || today);
  const remaining = Math.max(0, monthsBetween(today, end));
  const total = Number(item.totalMonths) || 1;
  return Math.min(total, Math.max(0, total - remaining));
}

export function loanProgressPct(item, today = new Date()) {
  const total = Number(item.totalMonths) || 1;
  return Math.min(100, Math.max(0, (loanElapsedMonths(item, today) / total) * 100));
}

export function loanProgressLabel(item, today = new Date()) {
  const total = Number(item.totalMonths) || 1;
  return `${loanElapsedMonths(item, today)} / ${total} months`;
}
