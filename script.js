'use strict';

const STAGE_FILES = Array.from({length:10}, (_,i) => `dream${String(i+1).padStart(2,'0')}.json`);

let STAGES = [];          // [{stage, title, entries:[{id,title,meaning}]}]
let ALL_ENTRIES = [];     // flattened, each with stageNum + stageTitle attached
let currentView = 'home';

const $ = (sel) => document.querySelector(sel);
const homeView = $('#homeView');
const stageView = $('#stageView');
const searchView = $('#searchView');
const stageGrid = $('#stageGrid');
const stageBand = $('#stageBand');
const entryList = $('#entryList');
const searchResults = $('#searchResults');
const searchStatus = $('#searchStatus');
const searchInput = $('#searchInput');
const clearSearchBtn = $('#clearSearch');
const backBtn = $('#backBtn');
const appTitle = $('#appTitle');
const appSubtitle = $('#appSubtitle');
const loadingState = $('#loadingState');
const entryModal = $('#entryModal');
const entryClose = $('#entryClose');
const modalBackdrop = $('#modalBackdrop');

init();

async function init(){
  await loadAllStages();
  renderStageGrid();
  showView('home');
  wireEvents();
  registerServiceWorker();
  loadingState.hidden = true;
}

async function loadAllStages(){
  const results = await Promise.allSettled(
    STAGE_FILES.map(f => fetch(f).then(r => {
      if(!r.ok) throw new Error('fetch failed: ' + f);
      return r.json();
    }))
  );

  STAGES = [];
  results.forEach((res, idx) => {
    if(res.status === 'fulfilled'){
      STAGES.push(res.value);
    } else {
      console.error('Failed to load', STAGE_FILES[idx], res.reason);
    }
  });
  STAGES.sort((a,b) => a.stage - b.stage);

  ALL_ENTRIES = [];
  STAGES.forEach(s => {
    s.entries.forEach(e => {
      ALL_ENTRIES.push({...e, stageNum: s.stage, stageTitle: s.title});
    });
  });

  if(STAGES.length === 0){
    stageGrid.innerHTML = `<div class="empty-state">خوابوں کی کتاب لوڈ نہیں ہو سکی۔<br>براہ کرم انٹرنیٹ کنکشن چیک کر کے دوبارہ کوشش کریں۔</div>`;
  }
}

function renderStageGrid(){
  stageGrid.innerHTML = STAGES.map(s => `
    <div class="stage-card" data-stage="${s.stage}" role="button" tabindex="0">
      <div class="stage-num">${toUrdu(s.stage)}</div>
      <div class="stage-name">${escapeHtml(s.title)}</div>
      <div class="stage-count">${toUrdu(s.entries.length)} خواب</div>
    </div>
  `).join('');

  stageGrid.querySelectorAll('.stage-card').forEach(card => {
    card.addEventListener('click', () => openStage(Number(card.dataset.stage)));
    card.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openStage(Number(card.dataset.stage)); }
    });
  });
}

function openStage(stageNum){
  const stage = STAGES.find(s => s.stage === stageNum);
  if(!stage) return;

  stageBand.innerHTML = `
    <div class="band-num">${toUrdu(stage.stage)}</div>
    <div class="band-name">${escapeHtml(stage.title)}</div>
    <div class="band-range">${toUrdu(stage.entries[0].id)} تا ${toUrdu(stage.entries[stage.entries.length-1].id)}</div>
  `;

  entryList.innerHTML = stage.entries.map(e => entryRowHtml(e, stage.stage)).join('');
  wireEntryRows(entryList);

  showView('stage');
}

function entryRowHtml(e, stageNum){
  return `
    <li class="entry-row" data-id="${e.id}">
      <div class="row-num">${toUrdu(e.id)}</div>
      <div class="row-body">
        <div class="row-title">${escapeHtml(e.title)}</div>
        <div class="row-meaning">${escapeHtml(e.meaning)}</div>
      </div>
    </li>
  `;
}

function wireEntryRows(container){
  container.querySelectorAll('.entry-row').forEach(row => {
    row.addEventListener('click', () => openEntry(Number(row.dataset.id)));
  });
}

function openEntry(id){
  const entry = ALL_ENTRIES.find(e => e.id === id);
  if(!entry) return;
  $('#entryNum').textContent = `خواب نمبر ${toUrdu(entry.id)}`;
  $('#entryTitle').textContent = entry.title;
  $('#entryMeaning').textContent = entry.meaning;
  $('#entryStageLabel').textContent = `باب: ${entry.stageTitle}`;
  entryModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeEntry(){
  entryModal.hidden = true;
  document.body.style.overflow = '';
}

function showView(view){
  currentView = view;
  homeView.hidden = view !== 'home';
  stageView.hidden = view !== 'stage';
  searchView.hidden = view !== 'search';
  backBtn.hidden = view === 'home';
  appTitle.textContent = 'خواب نامہ یوسفی';
  appSubtitle.textContent = view === 'home' ? 'خوابوں کی تعبیر — ۵۰۰ عنوانات' : (view === 'stage' ? '' : '');
  window.scrollTo(0,0);
}

function goHome(){
  searchInput.value = '';
  clearSearchBtn.hidden = true;
  showView('home');
}

function runSearch(query){
  const q = query.trim();
  if(!q){
    showView('home');
    return;
  }
  const qNorm = normalize(q);
  const matches = ALL_ENTRIES.filter(e =>
    normalize(e.title).includes(qNorm) || normalize(e.meaning).includes(qNorm)
  );

  searchStatus.textContent = matches.length
    ? `${toUrdu(matches.length)} نتائج ملے`
    : 'کوئی نتیجہ نہیں ملا';

  searchResults.innerHTML = matches.length
    ? matches.map(e => `
        <li class="entry-row" data-id="${e.id}">
          <div class="row-num">${toUrdu(e.id)}</div>
          <div class="row-body">
            <div class="row-title">${escapeHtml(e.title)}</div>
            <div class="row-meaning">${escapeHtml(e.meaning)}</div>
          </div>
          <div class="row-stage">${escapeHtml(e.stageTitle)}</div>
        </li>
      `).join('')
    : `<div class="empty-state">اس لفظ سے متعلق کوئی خواب موجود نہیں۔<br>کوئی اور لفظ آزمائیں۔</div>`;

  wireEntryRows(searchResults);
  showView('search');
}

function normalize(str){
  return str
    .replace(/[\u064B-\u0652\u0670]/g, '')   // strip Arabic/Urdu diacritics
    .replace(/ٹ/g,'ت').replace(/ڈ/g,'د').replace(/ڑ/g,'ر')
    .replace(/ی|ے/g,'ی').replace(/ہ|ۃ/g,'ہ')
    .toLowerCase()
    .trim();
}

function toUrdu(num){
  const digits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(num).replace(/[0-9]/g, d => digits[d]);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function wireEvents(){
  backBtn.addEventListener('click', goHome);

  searchInput.addEventListener('input', (e) => {
    clearSearchBtn.hidden = !e.target.value;
    runSearch(e.target.value);
  });
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.hidden = true;
    goHome();
    searchInput.focus();
  });

  entryClose.addEventListener('click', closeEntry);
  modalBackdrop.addEventListener('click', closeEntry);
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && !entryModal.hidden) closeEntry();
  });
}

function registerServiceWorker(){
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.error('SW registration failed:', err);
      });
    });
  }
}
