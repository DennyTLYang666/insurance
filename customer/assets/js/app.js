/* 啟動、分頁切換、全域工具列 */
const App = {
  tab: 'list',
  TABS: ['list', 'insured', 'cover', 'policy', 'stats', 'schedule', 'todo'],
  async init() {
    const q = id => document.getElementById(id);
    try { await Store.load(); } catch (e) { console.error(e); this.notice('讀取資料失敗：' + e.message); }
    Schedule.init();
    this.setBadge();
    Bundle.bind();
    Bundle.showPanel();   // 預設是空白的：要先載入客戶資料才能使用
    q('maskToggle').checked = Store.ov.settings.mask !== false;
    q('maskToggle').onchange = e => { Store.setting('mask', e.target.checked); this.refresh(); };
    document.querySelectorAll('.tabs button').forEach(bt => bt.onclick = () => this.show(bt.dataset.tab));
    window.addEventListener('beforeunload', e => { if (Store.bundle && Store.dirty) { e.preventDefault(); e.returnValue = ''; } });
    q('btnLock').onclick = () => this.lock();
    q('btnPrint').onclick = () => window.print();
    q('btnExport').onclick = () => U.download(`客戶補填備份_${U.iso(U.today())}.json`, Store.exportJson(), 'application/json');
    q('btnImport').onclick = () => q('fileImport').click();
    q('fileImport').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { if (!confirm('匯入會覆蓋目前的補填資料與排程，確定嗎？')) return; Store.importJson(await f.text()); this.refresh(); U.toast('已匯入'); }
      catch (err) { U.toast('匯入失敗：' + err.message); }
      e.target.value = '';
    };
    Stats.bind();
    // 全域：點擊撥號／導航（capture 階段處理，避免觸發列點擊開明細）
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-tel],[data-nav]');
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      if (t.dataset.tel) { location.href = 'tel:' + t.dataset.tel; U.toast('撥號：若電腦沒有電話程式，請在手機開啟或手動撥打'); }
      else window.open(Store.navUrl(t.dataset.nav), '_blank', 'noopener');
    }, true);
    const h = (location.hash || '').slice(1);
    this.show(this.TABS.includes(h) ? h : 'list');
  },
  setBadge() {
    const b = document.getElementById('modeBadge');
    if (!Store.raw) { b.textContent = '未載入客戶資料'; b.className = 'badge'; }
    else if (Store.bundle) { b.textContent = '資料檔：' + (Store.bundle.built ? Store.bundle.built.replace('T', ' ').slice(0, 16) : '日期不明'); b.className = 'badge ok'; }
    else { b.textContent = '本機伺服器：自動同步 adoc、補填資料存檔'; b.className = 'badge ok'; }
  },
  /* 載入客戶資料之後（資料檔或本機伺服器）：更新標示、提示，重畫目前分頁 */
  afterLoad() {
    this.setBadge();
    document.getElementById('notice').hidden = true;
    this.notice(Store.bundle ? '已載入資料檔（資料日期 ' + (Store.bundle.built ? Store.bundle.built.replace('T', ' ').slice(0, 16) : '不明') + '）。資料只在這個頁面的記憶體裡，關閉或重新整理就清掉，不會存在這個裝置；修改請用「匯出備份」帶走。' : '已從本機伺服器載入。補填資料會存回資料資料夾的 _overlay.json；關閉頁面後再開會是空白，要重新按「載入」。');
    document.getElementById('maskToggle').checked = Store.ov.settings.mask !== false;
    Schedule.init();
    this.refresh();
  },
  /* 鎖定：清掉記憶體裡的客戶資料，回到空白 */
  lock() {
    if (Store.bundle && Store.dirty && !confirm('有尚未匯出的修改，鎖定後會消失。確定鎖定嗎？')) return;
    Store.unload();
    document.getElementById('drawer').hidden = true;
    document.getElementById('notice').hidden = true;
    this.setBadge(); this.refresh(); Bundle.showPanel();
  },
  notice(msg) { const n = document.getElementById('notice'); n.textContent = msg; n.hidden = false; },
  show(t) {
    this.tab = t; location.hash = t;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
    this.refresh();
  },
  refresh() {
    if (!Store.raw) {
      document.querySelector('main').classList.add('empty'); this.updateBadges(); return;
    }
    document.querySelector('main').classList.remove('empty');
    ({ list: List, insured: Insured, cover: Cover, policy: Policy, stats: Stats, schedule: Schedule, todo: Todo })[this.tab].render(); this.updateBadges(); },
  updateBadges() { Todo.updateBadge(); Policy.updateBadge(); },
};
App.init();
