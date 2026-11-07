/* 啟動、分頁切換、全域工具列 */
const App = {
  tab: 'list',
  TABS: ['list', 'insured', 'cover', 'policy', 'stats', 'schedule', 'todo'],
  async init() {
    const q = id => document.getElementById(id);
    try { await Store.load(); } catch (e) { console.error(e); this.notice('讀取資料失敗：' + e.message); }
    Schedule.init();
    this.setBadge();
    Bundle.bind(); Sync.bind();
    Bundle.showPanel();   // 預設是空白的：要先載入客戶資料才能使用
    q('maskToggle').checked = Store.ov.settings.mask !== false;
    q('maskToggle').onchange = e => { Store.setting('mask', e.target.checked); this.refresh(); };
    document.querySelectorAll('.tabs button').forEach(bt => bt.onclick = () => this.show(bt.dataset.tab));
    window.addEventListener('beforeunload', e => { if (Store.bundle && Store.dirty) { e.preventDefault(); e.returnValue = ''; } });
    q('btnLock').onclick = () => this.lock();
    q('btnPrint').onclick = () => window.print();
    q('btnExport').onclick = () => this.exportData();
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
    this.notice(Store.bundle ? '已載入資料檔（資料日期 ' + (Store.bundle.built ? Store.bundle.built.replace('T', ' ').slice(0, 16) : '不明') + '）。客戶資料只在這個頁面的記憶體裡，關閉或重新整理就清掉；修改後請按右上「匯出資料檔」存成新檔' + (Sync.on ? '，或登入「同步」帶到其他裝置。' : '。') : '已從本機伺服器載入。補填資料會自動存回資料資料夾的 _overlay.json；關閉頁面後再開會是空白，要重新按「載入」。');
    document.getElementById('maskToggle').checked = Store.ov.settings.mask !== false;
    Schedule.init();
    this.refresh();
  },
  /* 鎖定：清掉記憶體裡的客戶資料，回到空白 */
  lock() {
    const safe = Sync.token && !Sync.pending();   // 已全部同步到伺服器
    if (Store.bundle && Store.changed && !safe && !confirm('有修改還沒匯出資料檔' + (Sync.on ? '（也還沒同步）；暫存在這個瀏覽器，下次載入同一個資料檔會還原，但其他裝置看不到' : '，鎖定後會消失') + '。確定鎖定嗎？')) return;
    Store.unload();
    document.getElementById('drawer').hidden = true;
    document.getElementById('notice').hidden = true;
    this.setBadge(); this.refresh(); Bundle.showPanel();
  },
  /* 匯出資料檔：把目前資料（含修改與已同步的更新）存成新的加密 .cbundle；沒有密碼的舊檔會要求設定密碼 */
  async exportData() {
    try {
      if (!Store.bundle && !this.canExportServer()) throw new Error('請先載入資料檔');
      let n;
      if (Sync.on) n = await Sync.exportCheckpoint();
      else n = await Bundle.exportPlain(() => this.newPassword());
      if (n == null) return;
      Store.changed = false; Store.dirty = false; this.updateExport();
      U.toast('已匯出資料檔（' + (n / 1024).toFixed(0) + ' KB），請存到「檔案」App 或你的資料夾；其他裝置載入這個檔即可');
    } catch (e) { U.toast('匯出失敗：' + e.message); }
  },
  async newPassword() {
    for (let msg = '設定資料檔密碼（至少 8 個字元；忘記無法救回）'; ;) {
      const a = await Bundle.askPassword(msg); if (a === null) return null;
      if (a.length < 8) { msg = '至少 8 個字元，請重新設定'; continue; }
      const b = await Bundle.askPassword('再輸入一次確認'); if (b === null) return null;
      if (a === b) return a;
      msg = '兩次不一致，請重新設定';
    }
  },
  /* 本機伺服器模式也能匯出：把「最新的 adoc 客戶資料＋補填資料」合成一個加密 .cbundle，自成一體（不需要 _overlay.json） */
  canExportServer() { return Store.mode === 'server' && !!Store.raw && !Store.bundle; },
  updateExport() {
    const b = document.getElementById('btnExport'); if (!b) return;
    if (this.canExportServer()) { b.disabled = false; b.textContent = '匯出資料檔'; b.className = ''; b.title = '把目前最新的客戶資料（adoc）＋補填資料打包成加密 .cbundle，自成一體，不需要另外帶 _overlay.json'; return; }
    b.disabled = !Store.bundle; b.textContent = Store.changed ? '匯出資料檔 ●' : '匯出資料檔';
    b.className = Store.changed ? 'warn' : '';
    b.title = !Store.bundle ? '載入資料檔後可用（本機伺服器模式的修改已自動存回資料資料夾）' : Store.changed ? '有修改還沒匯出：按這裡存成新的加密資料檔' : '把目前資料存成新的加密資料檔，沿用原本的密碼';
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
    ({ list: List, insured: Insured, cover: Cover, policy: Policy, stats: Stats, schedule: Schedule, rem: Reminders, todo: Todo })[this.tab].render(); this.updateBadges(); },
  updateBadges() { Todo.updateBadge(); Policy.updateBadge(); Reminders.updateBadge(); this.updateExport(); },
};
App.init();
