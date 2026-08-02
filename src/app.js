import { createApp, reactive, computed, ref, watch, onMounted, nextTick } from '../vendor/vue.esm-browser.prod.js';
import {
  MONTHS,
  uid,
  seedData,
  normalizeState,
  fmt,
  computeTotals,
  loanProgressPct,
  loanProgressLabel
} from './logic.js';

const STORAGE_KEY = 'fin-dash-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {
    /* ignore corrupt storage */
  }
  return seedData();
}

const App = {
  setup() {
    const state = reactive(loadState());
    const mounted = ref(false);
    const anim = reactive({ totalIn: 0, totalOut: 0, remainingAfterSavings: 0, totalSavings: 0 });

    const totals = computed(() => computeTotals(state));

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
