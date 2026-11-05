/* 共用小工具：跳脫、日期/年齡、遮蔽、格式化 */
const U = {
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  pad: n => String(n).padStart(2, '0'),
  today() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); },
  iso(d) { return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); },
  addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; },
  parseIso(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; },
  weekday(s) { const d = U.parseIso(s); return d ? '日一二三四五六'[d.getDay()] : ''; },

  /* 足歲與「保險年齡」（常見算法：足歲，超過 6 個月加 1 歲；實際以各商品條款為準） */
  ageInfo(birthIso, now) {
    const b = U.parseIso(birthIso);
    if (!b) return null;
    now = now || U.today();
    let age = now.getFullYear() - b.getFullYear();
    const bd = (y) => new Date(y, b.getMonth(), b.getDate());
    if (now < bd(b.getFullYear() + age)) age--;
    const last = bd(b.getFullYear() + age);
    const sixMonths = U.addMonths(last, 6);
    const insAge = age + (now > sixMonths ? 1 : 0);
    return { age, insAge };
  },
  /* 月份加減（日期超出當月天數時取月底，例如 8/31 + 6 個月 = 2/28） */
  addMonths(d, n) {
    const m = d.getMonth() + n, last = new Date(d.getFullYear(), m + 1, 0).getDate();
    return new Date(d.getFullYear(), m, Math.min(d.getDate(), last));
  },
  daysBetween(a, b) { return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000); },
  /* 下一次「保險年齡 +1」的日期：生日後滿 6 個月的隔天（對應 ageInfo 的「超過 6 個月加 1 歲」） */
  nextAgeBump(birthIso, now) {
    const b = U.parseIso(birthIso), ai = U.ageInfo(birthIso, now);
    if (!b || !ai) return null;
    now = now || U.today();
    const bd = y => new Date(y, b.getMonth(), b.getDate());
    let six = U.addMonths(bd(b.getFullYear() + ai.age), 6), from = ai.insAge;
    if (now > six) { six = U.addMonths(bd(b.getFullYear() + ai.age + 1), 6); }
    const date = new Date(six.getFullYear(), six.getMonth(), six.getDate() + 1);
    return { date, days: U.daysBetween(now, date), from, to: from + 1 };
  },
  /* 繳別 → 幾個月一期（躉繳／一次繳清回傳 null） */
  payPeriod(mode) {
    const s = mode || '年繳';
    return /躉|一次/.test(s) ? null : /半年/.test(s) ? 6 : /季/.test(s) ? 3 : /月/.test(s) ? 1 : 12;
  },
  /* 由保險始期與繳別推算下一個繳費日（今天或之後）：始期 + k×期距 */
  nextDue(startIso, period, now) {
    const s = U.parseIso(startIso); if (!s) return null;
    now = now || U.today();
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let k = Math.max(0, Math.floor(((now.getFullYear() - s.getFullYear()) * 12 + now.getMonth() - s.getMonth()) / period));
    while (U.addMonths(s, k * period) < t0) k++;
    while (k > 0 && U.addMonths(s, (k - 1) * period) >= t0) k--;
    const date = U.addMonths(s, k * period);
    return { date, days: U.daysBetween(now, date), k };
  },
  fmtDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  ageBand(age) {
    if (age == null) return '未填生日';
    if (age < 30) return '30 歲以下';
    const lo = Math.floor(age / 10) * 10;
    return age >= 70 ? '70 歲以上' : lo + '–' + (lo + 9) + ' 歲';
  },
  bandOrder: ['30 歲以下', '30–39 歲', '40–49 歲', '50–59 歲', '60–69 歲', '70 歲以上', '未填生日'],

  maskId: id => (id && id.length >= 8) ? id.slice(0, 3) + '****' + id.slice(-3) : id,
  fmtPhone(d) {
    if (!d) return '';
    if (/^09\d{8}$/.test(d)) return d.slice(0, 4) + '-' + d.slice(4, 7) + '-' + d.slice(7);
    const a2 = ['02', '03', '04', '05', '06', '07', '08'].includes(d.slice(0, 2)) ? 2 : 3;
    return d.slice(0, a2) + '-' + d.slice(a2);
  },
  maskPhone(d) { const f = U.fmtPhone(d); return f.length > 6 ? f.slice(0, f.length - 6) + '***' + f.slice(-3) : f; },

  enc: encodeURIComponent,
  download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(U._tt); U._tt = setTimeout(() => { t.hidden = true; }, 2600);
  },
  haversine(a, b) {
    const R = 6371, rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  },
  parseLatLng(s) {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s || '');
    if (!m) return null;
    const lat = +m[1], lng = +m[2];
    // 台灣大致範圍，擋掉貼反或貼錯
    return (lat > 21 && lat < 27 && lng > 117 && lng < 123) ? { lat, lng } : null;
  },
};
