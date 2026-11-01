/* storage.js — localStorage 存取（情境、商品範本、最後一次內容）。以 IC.store 對外提供。 */
(function (root) {
  'use strict';
  var IC = root.IC = root.IC || {}, St = IC.store = {};
  var K = { last: 'twlife_ic_last_v3', sc: 'twlife_ic_scenarios_v1', prod: 'twlife_ic_products_v1' };

  function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  var timer = null;
  St.last = function () { return get(K.last); };
  St.persistLast = function (S) { clearTimeout(timer); timer = setTimeout(function () { set(K.last, S); }, 300); };
  St.scenarios = function () { return get(K.sc) || {}; };
  St.saveScenarios = function (o) { return set(K.sc, o); };
  St.userProducts = function () { return get(K.prod) || {}; };
  St.saveUserProducts = function (o) { return set(K.prod, o); };
})(window);
