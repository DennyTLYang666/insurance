/* defaults.js — 常數、預設狀態、舊資料轉換（merge）。以 IC.def 對外提供。 */
(function (root) {
  'use strict';
  var IC = root.IC = root.IC || {}, U = IC.util, num = U.num, clone = U.clone;
  var D = IC.def = {};

  D.SCHEMA_PRODUCT = 'twlife.ic.product/1';
  D.MODES = {
    annual: { m: 1, label: '年繳' }, semi: { m: 2, label: '半年繳' },
    quarter: { m: 4, label: '季繳' }, monthly: { m: 12, label: '月繳' }
  };
  D.KINDS = {
    payend: '繳費期滿', mult: '倍數（價值÷累計實繳）', ret: '總報酬率 %', simple: '單利年化 %',
    irr: '複利年化 IRR %', age: '年齡達 N 歲', year: '第 N 年', maturity: '滿期／祝壽領回'
  };
  D.PREM_CHIPS = [5000, 10000, 18000, 30000, 38000, 50000, 100000];
  D.SUM_CHIPS = [10000, 50000, 100000, 200000];

  D.targets = function () {
    return [
      { label: '繳費期滿', kind: 'payend', value: 0 }, { label: '回本', kind: 'ret', value: 0 },
      { label: '+50%', kind: 'ret', value: 50 }, { label: '翻倍', kind: 'mult', value: 2 },
      { label: '翻3倍', kind: 'mult', value: 3 }, { label: '翻10倍', kind: 'mult', value: 10 },
      { label: '第10年', kind: 'year', value: 10 }, { label: '50歲', kind: 'age', value: 50 },
      { label: '55歲', kind: 'age', value: 55 }, { label: '60歲', kind: 'age', value: 60 },
      { label: '65歲', kind: 'age', value: 65 }, { label: '祝壽(111歲)', kind: 'maturity', value: 0 }
    ];
  };

  /* 折扣：type = pct（百分比）| amt（每年減金額）| tier（依保費／保額分階梯） */
  D.disc = function (name, type, value, min, max, basis, scope) {
    return { name: name, type: type, value: value, basis: basis || 'prem', minPrem: min || 0, maxPrem: max || 0, scope: scope || 'all', on: true, tiers: [] };
  };
  D.tier = function (name, tiers, basis) {
    return { name: name, type: 'tier', value: 0, basis: basis || 'prem', minPrem: 0, maxPrem: 0, scope: 'all', on: true, tiers: tiers };
  };
  D.PRESETS = {
    high: function () { return D.tier('高保費折扣', [{ min: 0, max: 0, value: 0 }]); },
    bank: function () { return D.disc('自動轉帳折扣', 'pct', 0); },
    pay: function () { return D.disc('年繳折扣', 'pct', 0); },
    custom: function () { return D.disc('自訂折扣', 'pct', 0); }
  };

  D.blank = function () {
    return {
      name: '', productName: '', dm: '', ccy: 'USD', payYears: 1, mode: 'annual', age1: 0, refAge: 0, ageNote: '',
      sumInsured: 0, premium: 0, paidInput: 0, inputBy: 'sum', /* sum 保額 | list 表定年繳保費 | paid 實繳年繳保費 */
      refSum: 0, refList: 0, minSum: 0, maxSum: 0,
      paidMode: 'calc', cvMode: 'table',
      mf: { annual: 1, semi: 1, quarter: 1, monthly: 1 }, stack: 'add', discCap: 0, discounts: [],
      rows: [], extra: [], bene: 0,
      rate: { r: 3.7, load: 0, fee0: 0, feeYears: 0, maxYear: 30 },
      targets: D.targets(), showBase: false, keyOnly: false, tableMode: 'profit', /* profit 獲利狀況 | full 完整 */ hideInputs: true, /* true＝上方為簡易模式 */ uiVer: 2
    };
  };

  /* 由任意 JSON（含舊版存檔）還原成完整狀態 */
  D.merge = function (src) {
    var d = D.blank();
    if (!src || typeof src !== 'object') return d;
    Object.keys(d).forEach(function (k) {
      if (src[k] === undefined) return;
      if (k === 'mf' || k === 'rate') d[k] = Object.assign(d[k], src[k]); else d[k] = clone(src[k]);
    });
    if (d.inputBy === 'prem') d.inputBy = 'list';
    /* 介面預設改版（uiVer 2）：舊存檔只套用一次新預設（簡易模式、獲利狀況），資料不動 */
    if (!(num(src.uiVer) >= 2)) { d.hideInputs = true; d.tableMode = 'profit'; }
    d.uiVer = 2;
    if (src.cvUnit > 0 && src.refSum === undefined) d.refSum = src.cvUnit;
    var rows = src.rows || (src.cvRows ? src.cvRows.map(function (r) { return { y: r.y, cv: r.v }; }) : []);
    if (!(num(d.age1) > 0) && rows.length && rows[0].age !== undefined && rows[0].age !== '' && num(rows[0].y) >= 1)
      d.age1 = num(rows[0].age) - (num(rows[0].y) - 1);
    if (src.paidMode === undefined) d.paidMode = 'calc';
    d.discounts = (d.discounts || []).map(function (x) {
      var o = Object.assign(D.disc('', 'pct', 0), x);
      o.tiers = (x.tiers || []).map(function (t) { return { min: num(t.min), max: num(t.max), value: num(t.value) }; });
      return o;
    });
    d.rows = rows.map(function (r) {
      var x = (r.x || []).slice(0, d.extra.length);
      while (x.length < d.extra.length) x.push('');
      return {
        y: r.y === undefined ? '' : r.y, cum: r.cum === undefined ? '' : r.cum,
        cv: r.cv === undefined ? '' : r.cv, x: x, pay: r.pay === undefined ? '' : r.pay
      };
    });
    return d;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IC;
})(typeof window !== 'undefined' ? window : globalThis);
