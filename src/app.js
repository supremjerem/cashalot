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

let csrfToken = '';

async function fetchJson(url, options) {
  const headers = { 'Content-Type': 'application/json', ...options?.headers };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error(`${url} responded with ${res.status}`);
  return res.json();
}

const App = {
  setup() {
    const state = reactive(seedData());
    const mounted = ref(false);
    const loaded = ref(false);
    const auth = reactive({ status: 'loading', password: '', error: '' });
    const saveState = ref('idle'); // idle | saving | saved | error
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
        if (!loaded.value) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
          saveState.value = 'saving';
          try {
            await fetchJson('/api/state', { method: 'PUT', body: val });
            saveState.value = 'saved';
          } catch {
            saveState.value = 'error';
          }
        }, 400);
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
      applyState(seedData());
    }

    async function loadRemoteState() {
      try {
        applyState(await fetchJson('/api/state'));
      } finally {
        loaded.value = true;
      }
    }

    async function checkSession() {
      try {
        const data = await fetchJson('/api/session');
        csrfToken = data.csrfToken || '';
        if (data.authenticated) {
          await loadRemoteState();
          auth.status = 'authenticated';
        } else {
          auth.status = 'unauthenticated';
        }
      } catch {
        auth.status = 'unauthenticated';
        auth.error = 'Could not reach the server. Please retry.';
      }
    }

    async function login() {
      auth.error = '';
      try {
        await fetchJson('/api/login', { method: 'POST', body: JSON.stringify({ password: auth.password }) });
        auth.password = '';
        await loadRemoteState();
        auth.status = 'authenticated';
      } catch {
        auth.error = 'Incorrect password.';
      }
    }

    async function logout() {
      await fetchJson('/api/logout', { method: 'POST' }).catch(() => {});
      loaded.value = false;
      await checkSession();
    }

    onMounted(() => {
      startAnimLoop();
      checkSession();
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
      auth,
      saveState,
      login,
      logout
    };
  }
};

createApp(App).mount('#app');
