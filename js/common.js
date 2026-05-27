// common.js — データ読み込み・共通ユーティリティ

// ── 共通定数 ──────────────────────────────────────────
const GOOGLE_FORM_URL   = 'https://docs.google.com/forms/d/e/1FAIpQLSd3lkH75uSufuwNEllHmrXZQmxXnq-w1T2SBLne6kO7JiUJvA/viewform?usp=header';
const CART_STORAGE_KEY  = 'cart_ps2627';
const MY_MARKS_KEY      = 'mymarks_ps2627';
const TAB_STORAGE_KEY   = 'tab_ps2627';

// ── 開幕カウントダウン ────────────────────────────────
// 開幕戦日時をここに設定（未定の場合は null のまま）
// 例: new Date('2026-06-01T13:00:00+09:00')
const KICKOFF = null;

function renderCountdown() {
    const el = document.getElementById('countdown-bar');
    if (!el) return;

    if (!KICKOFF) {
        el.innerHTML = '<span class="cd-label">Premier Series開幕まで：</span><span class="cd-value">開幕日程未定</span>';
        el.classList.remove('cd-urgent');
        return;
    }

    const now  = new Date();
    const diff = KICKOFF - now;

    if (diff <= 0) {
        el.innerHTML = '<span class="cd-label">Premier Series開幕まで：</span><span class="cd-value cd-closed">開幕！</span>';
        el.classList.add('cd-urgent');
        return;
    }

    const totalHours = Math.floor(diff / (1000 * 60 * 60));
    const days       = Math.floor(totalHours / 24);
    const hours      = totalHours % 24;

    let text;
    if (days >= 1) {
        text = `あと <strong>${days}</strong> 日`;
    } else {
        text = `あと <strong>${hours}</strong> 時間`;
    }

    const isUrgent = days === 0;
    el.classList.toggle('cd-urgent', isUrgent);
    el.innerHTML = `<span class="cd-label">Premier Series開幕まで：</span><span class="cd-value">${text}</span>`;
}

document.addEventListener('DOMContentLoaded', renderCountdown);

async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
}

// teams.json・odds.json・results.json をまとめて読み込む
async function loadAllData() {
    const [teams, odds, results] = await Promise.all([
        loadJSON('data/teams.json'),
        loadJSON('data/odds.json'),
        loadJSON('data/results.json'),
    ]);
    return { teams, odds, results };
}

// predictions/ 以下の予想ファイルを読み込む（ファイル名リストを渡す）
async function loadPredictions(fileNames) {
    const results = await Promise.allSettled(
        fileNames.map(f => loadJSON(`data/predictions/${f}`))
    );
    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
}
