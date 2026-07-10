import { createApp, reactive, computed, ref, watch, onMounted, nextTick } from '../vendor/vue.esm-browser.prod.js';

const STORAGE_KEY = 'fin-dash-v1';
const MONTHS = [
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

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Fictional example data (no personal data should live here: the user's real
// data stays only in their browser's localStorage and is never committed).
// Label and month values are intentionally left in French, matching the
// app's fr-FR/EUR locale and the example budget items a French user would enter.
function seedData() {
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
function normalizeState(data = {}) {
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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {
    /* ignore corrupt storage */
  }
  return seedData();
}

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    Math.round(n) || 0
  );

function monthsBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

const App = {
  setup() {
    const state = reactive(loadState());
    const mounted = ref(false);
    const anim = reactive({ totalIn: 0, totalOut: 0, remainingAfterSavings: 0, totalSavings: 0 });

    const totals = computed(() => {
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
    });

    const remainingColor = computed(() => (totals.value.remainingAfterSavings >= 0 ? '#56d364' : '#f85149'));

    const segmentsRaw = computed(() => [
      { key: 'loans', label: 'Loans', value: totals.value.totalLoans, color: '#a371f7' },
      { key: 'recurring', label: 'Expenses', value: totals.value.totalRecurring, color: '#58a6ff' },
      {
        key: 'quarterly',
        label: 'Quarterly (smoothed)',
        value: totals.value.monthlyQuarterly,
        color: '#545d7a'
      },
      { key: 'oneOff', label: 'One-off (smoothed)', value: totals.value.monthlyOneOff, color: '#39c5cf' }
    ]);
    const chartTotal = computed(() => segmentsRaw.value.reduce((s, x) => s + x.value, 0) || 1);
    const segments = computed(() =>
      segmentsRaw.value.map((seg) => ({ ...seg, pct: Math.round((seg.value / chartTotal.value) * 100) }))
    );
    const donutGradient = computed(() => {
      let acc = 0;
      const stops = segmentsRaw.value
        .map((seg) => {
          const pctExact = (seg.value / chartTotal.value) * 100;
          const start = acc;
          acc += pctExact;
          return `${seg.color} ${start}% ${acc}%`;
        })
        .join(', ');
      return `conic-gradient(${stops})`;
    });

    const segmentsFixedRaw = computed(() => [
      { key: 'loans', label: 'Loans', value: totals.value.totalLoans, color: '#a371f7' },
      { key: 'recurring', label: 'Expenses', value: totals.value.totalRecurring, color: '#58a6ff' }
    ]);
    const chartTotalFixed = computed(() => segmentsFixedRaw.value.reduce((s, x) => s + x.value, 0) || 1);
    const segmentsFixed = computed(() =>
      segmentsFixedRaw.value.map((seg) => ({ ...seg, pct: Math.round((seg.value / chartTotalFixed.value) * 100) }))
    );
    const donutGradientFixed = computed(() => {
      let acc = 0;
      const stops = segmentsFixedRaw.value
        .map((seg) => {
          const pctExact = (seg.value / chartTotalFixed.value) * 100;
          const start = acc;
          acc += pctExact;
          return `${seg.color} ${start}% ${acc}%`;
        })
        .join(', ');
      return `conic-gradient(${stops})`;
    });

    function loanElapsedMonths(item) {
      const today = new Date();
      const end = new Date(item.endDate || today);
      const remaining = Math.max(0, monthsBetween(today, end));
      const total = Number(item.totalMonths) || 1;
      return Math.min(total, Math.max(0, total - remaining));
    }
    function loanProgressPct(item) {
      const total = Number(item.totalMonths) || 1;
      return Math.min(100, Math.max(0, (loanElapsedMonths(item) / total) * 100));
    }
    function loanProgressLabel(item) {
      const total = Number(item.totalMonths) || 1;
      return `${loanElapsedMonths(item)} / ${total} months`;
    }

    let raf = null;
    function startAnimLoop() {
      if (raf) return;
      const step = () => {
        const targets = {
          totalIn: totals.value.totalIn,
          totalOut: totals.value.totalOut,
          remainingAfterSavings: totals.value.remainingAfterSavings,
          totalSavings: totals.value.totalSavings
        };
        let moving = false;
        for (const k in targets) {
          const diff = targets[k] - anim[k];
          if (Math.abs(diff) > 0.5) {
            anim[k] += diff * 0.16;
            moving = true;
          } else {
            anim[k] = targets[k];
          }
        }
        if (moving) raf = requestAnimationFrame(step);
        else raf = null;
      };
      raf = requestAnimationFrame(step);
    }
    watch(() => totals.value, startAnimLoop);

    let saveTimer = null;
    watch(
      () =>
        JSON.stringify({
          view: state.view,
          income: state.income,
          recurring: state.recurring,
          loans: state.loans,
          oneOff: state.oneOff,
          quarterly: state.quarterly,
          savings: state.savings
        }),
      (val) => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, val);
          } catch {
            /* storage unavailable */
          }
        }, 250);
      }
    );

    function addRow(category, defaults) {
      state[category].push({ id: uid(), ...defaults });
    }
    function deleteRow(category, id) {
      const idx = state[category].findIndex((r) => r.id === id);
      if (idx !== -1) state[category].splice(idx, 1);
    }

    function addIncome() {
      addRow('income', { label: 'New income', amount: 0, day: '' });
    }
    function addRecurring() {
      addRow('recurring', { label: 'New expense', amount: 0, day: '' });
    }
    function addLoan() {
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 5);
      addRow('loans', {
        label: 'New loan',
        amount: 0,
        totalMonths: 60,
        endDate: endDate.toISOString().slice(0, 10)
      });
    }
    function addOneOff() {
      addRow('oneOff', { label: 'New one-off expense', amount: 0, month: 'Janvier' });
    }
    function addQuarterly() {
      addRow('quarterly', { label: 'New quarterly charge', amount: 0, occurrences: 4, monthsLabel: '' });
    }
    function addSavings() {
      addRow('savings', { label: 'Savings', amount: 0 });
    }

    function applyState(data) {
      const normalized = normalizeState(data);
      state.view = normalized.view;
      state.income = normalized.income;
      state.recurring = normalized.recurring;
      state.loans = normalized.loans;
      state.oneOff = normalized.oneOff;
      state.quarterly = normalized.quarterly;
      state.savings = normalized.savings;
      mounted.value = false;
      nextTick(() =>
        setTimeout(() => {
          mounted.value = true;
        }, 30)
      );
    }

    function resetSeed() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* storage unavailable */
      }
      applyState(seedData());
    }

    const statusMessage = ref('');
    let statusTimer = null;
    function flashStatus(msg) {
      statusMessage.value = msg;
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        statusMessage.value = '';
      }, 4000);
    }

    function exportData() {
      const payload = {
        view: state.view,
        income: state.income,
        recurring: state.recurring,
        loans: state.loans,
        oneOff: state.oneOff,
        quarterly: state.quarterly,
        savings: state.savings
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cashalot-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flashStatus('Export downloaded.');
    }

    const fileInputRef = ref(null);
    function triggerImport() {
      fileInputRef.value?.click();
    }
    async function importData(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        applyState(data);
        flashStatus('Import successful.');
      } catch {
        flashStatus('Invalid file, import cancelled.');
      }
    }

    onMounted(() => {
      startAnimLoop();
      setTimeout(() => {
        mounted.value = true;
      }, 30);
    });

    function enterStyle(delay) {
      return {
        opacity: mounted.value ? 1 : 0,
        transform: mounted.value ? 'translateY(0)' : 'translateY(10px)',
        transition: `opacity .5s ease ${delay}ms, transform .5s ease ${delay}ms`
      };
    }

    return {
      state,
      totals,
      anim,
      remainingColor,
      chartTotal,
      segments,
      donutGradient,
      segmentsFixed,
      donutGradientFixed,
      MONTHS,
      fmt,
      enterStyle,
      loanProgressPct,
      loanProgressLabel,
      addIncome,
      addRecurring,
      addLoan,
      addOneOff,
      addQuarterly,
      addSavings,
      deleteRow,
      resetSeed,
      statusMessage,
      exportData,
      importData,
      triggerImport,
      fileInputRef
    };
  }
};

createApp(App).mount('#app');
