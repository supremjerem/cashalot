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

// Données d'exemple fictives (aucune donnée personnelle ne doit vivre ici :
// les vraies données de l'utilisateur restent uniquement dans le localStorage
// de son navigateur et ne sont jamais commitées).
function seedData() {
  return {
    view: 'cards',
    revenus: [
      { id: uid(), label: 'Salaire', amount: 2500, day: 28 },
      { id: uid(), label: 'Revenu complémentaire', amount: 300, day: 5 }
    ],
    courantes: [
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
    credits: [
      { id: uid(), label: 'Prêt immobilier', amount: 700, totalMonths: 240, endDate: '2043-05-01' },
      { id: uid(), label: 'Crédit auto', amount: 300, totalMonths: 48, endDate: '2028-03-01' },
      { id: uid(), label: 'Crédit conso', amount: 150, totalMonths: 36, endDate: '2029-01-01' }
    ],
    ponctuelles: [
      { id: uid(), label: 'Entretien voiture', amount: 150, month: 'Mars' },
      { id: uid(), label: 'Assurance annuelle', amount: 90, month: 'Janvier' },
      { id: uid(), label: 'Vacances', amount: 500, month: 'Août' },
      { id: uid(), label: 'Cadeaux fêtes', amount: 200, month: 'Décembre' }
    ],
    trimestrielles: [
      {
        id: uid(),
        label: 'Charges copropriété',
        amount: 400,
        occurrences: 4,
        monthsLabel: 'Janvier, Avril, Juillet, Octobre'
      }
    ],
    epargne: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
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
    const anim = reactive({ totalIn: 0, totalOut: 0, resteApresEco: 0, totalEpargne: 0 });

    const totals = computed(() => {
      const sum = (arr) => arr.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const totalIn = sum(state.revenus);
      const totalCourantes = sum(state.courantes);
      const totalCredits = sum(state.credits);
      const totalOut = totalCourantes + totalCredits;
      const totalEpargne = sum(state.epargne);
      const resteAvantEco = totalIn - totalOut;
      const resteApresEco = resteAvantEco - totalEpargne;
      const totalPonctuelles = sum(state.ponctuelles);
      const totalTrimestrielles = state.trimestrielles.reduce(
        (s, i) => s + (Number(i.amount) || 0) * (Number(i.occurrences) || 1),
        0
      );
      const monthlyPonctuelles = totalPonctuelles / 12;
      const monthlyTrimestrielles = totalTrimestrielles / 12;
      const resteLisse = resteApresEco - monthlyPonctuelles - monthlyTrimestrielles;
      return {
        totalIn,
        totalCourantes,
        totalCredits,
        totalOut,
        totalEpargne,
        resteAvantEco,
        resteApresEco,
        totalPonctuelles,
        totalTrimestrielles,
        monthlyPonctuelles,
        monthlyTrimestrielles,
        resteLisse
      };
    });

    const resteColor = computed(() => (totals.value.resteApresEco >= 0 ? '#56d364' : '#f85149'));

    const segmentsRaw = computed(() => [
      { key: 'credits', label: 'Crédits', value: totals.value.totalCredits, color: '#a371f7' },
      { key: 'courantes', label: 'Dépenses', value: totals.value.totalCourantes, color: '#58a6ff' },
      {
        key: 'trimestrielles',
        label: 'Trimestrielles (lissé)',
        value: totals.value.monthlyTrimestrielles,
        color: '#545d7a'
      },
      { key: 'ponctuelles', label: 'Ponctuelles (lissé)', value: totals.value.monthlyPonctuelles, color: '#39c5cf' }
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
      { key: 'credits', label: 'Crédits', value: totals.value.totalCredits, color: '#a371f7' },
      { key: 'courantes', label: 'Dépenses', value: totals.value.totalCourantes, color: '#58a6ff' }
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

    function creditElapsedMonths(item) {
      const today = new Date();
      const end = new Date(item.endDate || today);
      const remaining = Math.max(0, monthsBetween(today, end));
      const total = Number(item.totalMonths) || 1;
      return Math.min(total, Math.max(0, total - remaining));
    }
    function creditProgressPct(item) {
      const total = Number(item.totalMonths) || 1;
      return Math.min(100, Math.max(0, (creditElapsedMonths(item) / total) * 100));
    }
    function creditProgressLabel(item) {
      const total = Number(item.totalMonths) || 1;
      return `${creditElapsedMonths(item)} / ${total} mois`;
    }

    let raf = null;
    function startAnimLoop() {
      if (raf) return;
      const step = () => {
        const targets = {
          totalIn: totals.value.totalIn,
          totalOut: totals.value.totalOut,
          resteApresEco: totals.value.resteApresEco,
          totalEpargne: totals.value.totalEpargne
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
          revenus: state.revenus,
          courantes: state.courantes,
          credits: state.credits,
          ponctuelles: state.ponctuelles,
          trimestrielles: state.trimestrielles,
          epargne: state.epargne
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

    function addRevenu() {
      addRow('revenus', { label: 'Nouveau revenu', amount: 0, day: '' });
    }
    function addCourante() {
      addRow('courantes', { label: 'Nouvelle dépense', amount: 0, day: '' });
    }
    function addCredit() {
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 5);
      addRow('credits', {
        label: 'Nouveau crédit',
        amount: 0,
        totalMonths: 60,
        endDate: endDate.toISOString().slice(0, 10)
      });
    }
    function addPonctuelle() {
      addRow('ponctuelles', { label: 'Nouvelle dépense', amount: 0, month: 'Janvier' });
    }
    function addTrimestrielle() {
      addRow('trimestrielles', { label: 'Nouvelle charge', amount: 0, occurrences: 4, monthsLabel: '' });
    }
    function addEpargne() {
      addRow('epargne', { label: 'Épargne', amount: 0 });
    }

    function applyState(data) {
      state.view = data.view === 'compact' ? 'compact' : 'cards';
      state.revenus = Array.isArray(data.revenus) ? data.revenus : [];
      state.courantes = Array.isArray(data.courantes) ? data.courantes : [];
      state.credits = Array.isArray(data.credits) ? data.credits : [];
      state.ponctuelles = Array.isArray(data.ponctuelles) ? data.ponctuelles : [];
      state.trimestrielles = Array.isArray(data.trimestrielles) ? data.trimestrielles : [];
      state.epargne = Array.isArray(data.epargne) ? data.epargne : [];
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
        revenus: state.revenus,
        courantes: state.courantes,
        credits: state.credits,
        ponctuelles: state.ponctuelles,
        trimestrielles: state.trimestrielles,
        epargne: state.epargne
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cashalot-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flashStatus('Export téléchargé.');
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
        flashStatus('Import réussi.');
      } catch {
        flashStatus('Fichier invalide, import annulé.');
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
      resteColor,
      chartTotal,
      segments,
      donutGradient,
      segmentsFixed,
      donutGradientFixed,
      MONTHS,
      fmt,
      enterStyle,
      creditProgressPct,
      creditProgressLabel,
      addRevenu,
      addCourante,
      addCredit,
      addPonctuelle,
      addTrimestrielle,
      addEpargne,
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
