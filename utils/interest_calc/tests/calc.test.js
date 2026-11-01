/* 計算核心測試：node tests/calc.test.js
 * 對照數字來源：建議書（44歲女）、DM 第3頁範例（40歲男）、DM 投保規則（折扣階梯）。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
['util', 'defaults', 'calc'].forEach(m => require(path.join(root, 'js', m + '.js')));
const IC = globalThis.IC, C = IC.calc;

function product(file, over) {
  const p = JSON.parse(fs.readFileSync(path.join(root, 'products', file), 'utf8'));
  const s = IC.def.merge(p.state);
  s.sumInsured = s.refSum; s.inputBy = 'sum';
  return Object.assign(s, over || {});
}
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' expected ' + b + ' got ' + a);

t('44歲女：表定39,266 → 折扣3% → 實繳38,088，累計114,264，折扣共省3,534', () => {
  const s = product('meili33-3y-44f.json'), r = C.compute(s);
  assert.strictEqual(r.e.prem, 39266);
  assert.strictEqual(C.annualPremium(s, 1, true, r.e), 38088);
  assert.strictEqual(r.rows[2].cum, 114264);
  assert.strictEqual(r.totBase - r.totPaid, 3534);
});
t('44歲女：各繳別實繳＝建議書（年繳38,088／半年19,806／季9,979／月3,352）', () => {
  const s = product('meili33-3y-44f.json'), e = C.eff(s);
  const m = {}; C.perMode(s, e).forEach(x => m[x.key] = x.per);
  assert.deepStrictEqual(m, { annual: 38088, semi: 19806, quarter: 9979, monthly: 3352 });
});
t('44歲女：逐年表對照（第10年解約金150,875.23、67年、祝壽金1,234,209.96）', () => {
  const r = C.compute(product('meili33-3y-44f.json'));
  assert.strictEqual(r.rows.length, 67);
  near(r.rows[9].cv, 150875.23, 0.005);
  const last = r.rows[66];
  near(last.pay, 1234209.96, 0.005); near(last.value, 1234209.96, 0.005);
  near(last.mult, 1234209.96 / 114264, 1e-9);
  near(last.irr, 0.0367, 0.0005, 'IRR 應接近宣告利率約3.7%');
});
t('折扣階梯：1.8萬–3.8萬共 1%+1%＝2%；3.8萬以上共 2%+1%＝3%；未達1.8萬僅轉帳 1%', () => {
  const s = product('meili33-3y-44f.json'), e = {};
  const pctAt = L => C.discFactor(s, 1, L, 0).pct;
  near(pctAt(17999), 1, 1e-9); near(pctAt(18000), 2, 1e-9); near(pctAt(37999), 2, 1e-9);
  near(pctAt(38000), 3, 1e-9); near(pctAt(120000), 3, 1e-9);
  const names = C.discFactor(s, 1, 38000, 0).items.map(x => x.value);
  assert.deepStrictEqual(names.sort(), [1, 2]);          // 只有兩筆：轉帳1 + 高保費2（不再出現 1+2+1）
  assert.strictEqual(C.discFactor(s, 1, 28000, 0).items.length, 2);
});
t('折扣階梯一覽（顯示用）三個區間', () => {
  const segs = C.discountSummary(product('meili33-3y-44f.json'));
  assert.deepStrictEqual(segs.map(x => Math.round(x.pct)), [1, 2, 3]);
  assert.deepStrictEqual(segs.map(x => x.lo), [0, 18000, 38000]);
});
t('以表定年繳保費 38,000 設定：實繳 36,860（折3%）', () => {
  const s = product('meili33-3y-44f.json', { inputBy: 'list', premium: 38000 }), r = C.compute(s);
  assert.strictEqual(r.e.prem, 38000);
  assert.strictEqual(C.annualPremium(s, 1, true, r.e), 36860);
  assert.strictEqual(r.totBase - r.totPaid, 3420);
});
t('以實繳年繳保費 38,000 設定：反推表定 39,175（＝DM 範例）', () => {
  const s = product('meili33-3y-44f.json', { inputBy: 'paid', paidInput: 38000 }), e = C.eff(s);
  assert.strictEqual(Math.round(e.prem), 39175);
  assert.strictEqual(e.paidAnnual, 38000);
});
t('以實繳 38,088 設定：反推表定 39,266（＝建議書）', () => {
  const e = C.eff(product('meili33-3y-44f.json', { inputBy: 'paid', paidInput: 38088 }));
  assert.strictEqual(Math.round(e.prem), 39266);
});
t('以實繳反推：跨階梯跳點仍吻合（1.8萬階梯邊界）', () => {
  const s = product('meili33-3y-44f.json');
  [5000, 17000, 17640, 30000, 36860, 37239, 50000].forEach(p => {
    s.inputBy = 'paid'; s.paidInput = p; const e = C.eff(s);
    assert.ok(Math.abs(e.paidAnnual - p) <= 1, '實繳 ' + p + ' 反推後得 ' + e.paidAnnual);
  });
});
t('小保費：5,000 只有轉帳 1%；18,000 為 2%', () => {
  let s = product('meili33-3y-44f.json', { inputBy: 'list', premium: 5000 }), e = C.eff(s);
  assert.strictEqual(C.annualPremium(s, 1, true, e), 4950);
  s = product('meili33-3y-44f.json', { inputBy: 'list', premium: 18000 }); e = C.eff(s);
  assert.strictEqual(C.annualPremium(s, 1, true, e), 17640);
});
t('保額改 18,000／5,000：等比例縮放解約金', () => {
  const s = product('meili33-3y-44f.json', { inputBy: 'sum', sumInsured: 18000 }), r = C.compute(s);
  near(r.e.scale, 18000 / 126868, 1e-12);
  near(r.rows[9].cv, 150875.23 * 18000 / 126868, 0.01);
});
t('40歲男（DM範例）：表定39,175 → 實繳38,000；第10年解約金150,424.24；71年祝壽金', () => {
  const s = product('meili33-3y-40m.json'), r = C.compute(s);
  assert.strictEqual(C.annualPremium(s, 1, true, r.e), 38000);
  near(r.rows[9].cv, 150424.24, 0.005);
  near(r.rows[70].pay, 1400969.97, 0.005);
  assert.strictEqual(r.rows.length, 71);
});
t('IRR 驗算：單筆 100 → 10 年後 200，年利率 7.177%', () => {
  near(C.irr([{ time: 0, amt: 100, year: 1 }], 10, 200, []), 0.07177, 1e-4);
});
t('概估模型範例可計算', () => {
  const s = product('sample-rate-model.json', { inputBy: 'list', premium: 39266 }), r = C.compute(s);
  assert.ok(r.rows.length === 30 && r.rows[29].value > r.rows[0].value);
});
t('舊版存檔相容（cvRows／cvUnit／inputBy=prem）', () => {
  const s = IC.def.merge({ premium: 1000, payYears: 2, cvMode: 'table', cvUnit: 1000, sumInsured: 100000, inputBy: 'prem',
    cvRows: [{ y: 1, v: 8 }, { y: 2, v: 19 }], discounts: [{ name: 'x', type: 'pct', value: 3, minPrem: 800, scope: 'all', on: true }] });
  const r = C.compute(s);
  assert.strictEqual(s.inputBy, 'list');
  assert.deepStrictEqual(r.rows.map(x => [x.t, Math.round(x.cv), Math.round(x.cum)]), [[1, 800, 970], [2, 1900, 1940]]);
});
t('顯示一律無條件捨去（金額／百分比／倍數），並抹除浮點雜訊', () => {
  const U = IC.util;
  assert.strictEqual(U.fmt(22378.25), '22,378');
  assert.strictEqual(U.fmt(22378.99), '22,378');
  assert.strictEqual(U.fmt(-15710.99), '−15,710');
  assert.strictEqual(U.fmt(38087.9999999999), '38,088');
  assert.strictEqual(U.fmt(0.9), '0');
  assert.strictEqual(U.pct(0.3204), '32.0%');
  assert.strictEqual(U.pct(0.32999), '32.9%');
  assert.strictEqual(U.pct(0.07), '7.0%');
  assert.strictEqual(U.pct(-0.41259), '−41.2%');
  assert.strictEqual(U.pct(-0.0004), '0.0%');
  assert.strictEqual(U.mulf(1.4299), '1.42×');
  assert.strictEqual(U.mulf(2), '2.00×');
  assert.strictEqual(U.trs(3, 2), '3.00');
  assert.strictEqual(U.trn(3.0000000000000004, 2), '3');
});
t('保費仍依建議書四捨五入（半年繳 19,805.77 → 19,806），不受顯示捨去影響', () => {
  const s = product('meili33-3y-44f.json'), e = C.eff(s);
  assert.strictEqual(C.perInstallment(s, 1, 'semi', true, e), 19806);
});
console.log('\n全部通過：' + n + ' 項');
