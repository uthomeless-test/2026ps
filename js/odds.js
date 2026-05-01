// odds.js — オッズページ全ロジック

let teams    = [];
let oddsData = {};

let currentType = 'win-place';
let voteMode    = 'formation';
let sortMode    = 'num';
let filterMode  = false;
let cart        = [];
const BUDGET_LIMIT = 20000;
let npTargetId  = null;
let npBuffer    = '';
let npMode      = 'amount';
let npExpandId  = null;
let msRows      = [ new Set(), new Set(), new Set() ];
let _idCounter  = 1;
function genId() { return _idCounter++; }

// ── 初期化 ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const data = await loadAllData();
        teams    = data.teams;
        oddsData = data.odds;
        loadCart();
        loadMsState();
        renderTeamHeader();
        initMsHeader();
        renderCart();
        // 前回のタブを復元
        // URLパラメータからフォーメーションを復元（印ページからの遷移）
        const urlParams = new URLSearchParams(window.location.search);
        const urlTab  = urlParams.get('tab');
        const urlMode = urlParams.get('mode');
        const urlR0   = urlParams.get('r0');
        const urlR1   = urlParams.get('r1');
        const urlR2   = urlParams.get('r2');

        if (urlTab && urlMode === 'formation') {
            const tabEl2 = document.querySelector(`.tab-menu li[data-type="${urlTab}"]`);
            if (tabEl2) {
                switchTab(urlTab, tabEl2);
                // モードをフォーメーションに設定
                const fBtn = document.querySelector('[data-mode="formation"]');
                if (fBtn) switchVoteMode('formation', fBtn);
                // 各行に値をセット
                const parseNums = s => (s||'').split(',').map(n=>parseInt(n)).filter(n=>!isNaN(n));
                msRows[0] = new Set(parseNums(urlR0));
                msRows[1] = new Set(parseNums(urlR1));
                msRows[2] = new Set(parseNums(urlR2));
                getCurrentMsState().rows = msRows;
                buildMsRows();
                updateMsCombCount();
                saveMsState();
                render();
                // apply=1 のときはオッズ表示まで自動実行
                if (urlParams.get('apply') === '1') {
                    applyMarksheet();
                    setTimeout(() => {
                        document.getElementById('main-view').scrollIntoView({ behavior:'smooth', block:'start' });
                    }, 300);
                } else {
                    setTimeout(() => {
                        document.getElementById('marksheet-area').scrollIntoView({ behavior:'smooth', block:'start' });
                    }, 300);
                }
            }
        } else {
            const savedTab = localStorage.getItem(TAB_STORAGE_KEY) || 'win-place';
            const tabEl = document.querySelector(`.tab-menu li[data-type="${savedTab}"]`);
            if (tabEl) switchTab(savedTab, tabEl);
            else render();
        }
    } catch (e) {
        console.error('データ読み込み失敗:', e);
        document.body.insertAdjacentHTML('afterbegin',
            `<div style="background:#fdd;padding:10px;border:1px solid #d00;margin-bottom:10px;">
             ⚠️ データの読み込みに失敗しました。ローカルでの直接ファイル開きには対応していません。
             Live Serverなどのローカルサーバー経由で開いてください。</div>`);
    }
});

// ── チームヘッダー ───────────────────────────────────
function renderTeamHeader() {
    const table = document.getElementById('teamHeader');
    let h = '<tr>', t = '<tr>';
    teams.forEach((tm, i) => {
        h += `<th>${i + 1}</th>`;
        t += `<td><img src="${tm.logo}" class="team-logo" alt="${tm.tag}"><br>${tm.tag}</td>`;
    });
    table.innerHTML = h + '</tr>' + t + '</tr>';
}

const TAB_STORAGE_KEY  = 'tab_ps2627';

// タブごとのマークシート状態（ページ内のみ、保存なし）
const msState = {};

function saveMsState() {
    // 保持不要 - タブ・ページ移動でリセット
}

function loadMsState() {
    // 保持不要 - 常に空で開始
}

function getCurrentMsState() {
    if (!msState[currentType]) {
        msState[currentType] = { voteMode: 'formation', rows: [new Set(), new Set(), new Set()] };
    }
    return msState[currentType];
}

function resetCurrentMs() {
    msState[currentType] = { voteMode: 'formation', rows: [new Set(), new Set(), new Set()] };
    msRows = msState[currentType].rows;
    voteMode = 'formation';
}

// ── タブ切り替え ─────────────────────────────────────
function switchTab(type, el) {
    document.querySelectorAll('.tab-menu li').forEach(li => li.classList.remove('active'));
    el.classList.add('active');
    currentType = type;
    filterMode  = false;

    // タブ切り替えでマークシートをリセット
    msState[type] = { voteMode: 'formation', rows: [new Set(), new Set(), new Set()] };
    voteMode = 'formation';
    msRows   = msState[type].rows;

    const modeBar  = document.getElementById('vote-mode-bar');
    const msArea   = document.getElementById('marksheet-area');
    const axis1Btn = document.getElementById('btn-axis1');
    const axis2Btn = document.getElementById('btn-axis2');

    if (type === 'win-place') {
        modeBar.classList.add('hidden');
        msArea.classList.add('hidden');
    } else {
        modeBar.classList.remove('hidden');
        msArea.classList.remove('hidden');

        if (type === 'exacta') {
            axis1Btn.style.display = '';
            axis2Btn.style.display = 'none';
        } else if (type === 'trifecta') {
            axis1Btn.style.display = '';
            axis2Btn.style.display = '';
        } else {
            axis1Btn.style.display = 'none';
            axis2Btn.style.display = 'none';
        }
        resetVoteModeButtons('formation');
        buildMsRows();
        updateMsCombCount();
    }
    saveMsState();
    render();
}

function resetVoteModeButtons(mode) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const target = document.querySelector(`[data-mode="${mode}"]`);
    if (target) target.classList.add('active');
}

function switchVoteMode(mode, el) {
    voteMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    msRows = [ new Set(), new Set(), new Set() ];
    const st = getCurrentMsState();
    st.voteMode = mode;
    st.rows     = msRows;
    buildMsRows();
    updateMsCombCount();
    saveMsState();
}

// ── マークシート ─────────────────────────────────────
function initMsHeader() {
    const hNum = document.getElementById('ms-head-nums');
    const hTag = document.getElementById('ms-head-tags');
    teams.forEach((tm, i) => {
        hNum.innerHTML += `<td class="course_num">${i + 1}</td>`;
        hTag.innerHTML += `<td style="font-size:.7em;">${tm.tag}</td>`;
    });
    hNum.innerHTML += `<td colspan="2">操作</td>`;
    hTag.innerHTML += `<td colspan="2"></td>`;
}

function buildMsRows() {
    const body = document.getElementById('ms-body');
    body.innerHTML = '';
    const rowDefs = getMsRowDefs();
    rowDefs.forEach((def, ri) => {
        let html = `<tr><th class="ms-row-label">${def.label}</th>`;
        teams.forEach((_, ci) => {
            const num = ci + 1;
            const isMarked = msRows[ri].has(num);
            let cls = 'ms-cell';
            if (isMarked) {
                if (ri === 0 && (voteMode === 'axis1' || voteMode === 'axis2')) cls = 'ms-cell axis1';
                else if (ri === 1 && voteMode === 'axis2') cls = 'ms-cell axis2';
                else cls = 'ms-cell marked';
            }
            html += `<td class="${cls}" onclick="toggleMs(${ri},${num})">${num}</td>`;
        });
        html += `<td><input type="button" value="全" class="all_button" onclick="bulkMs(${ri},true)"></td>`;
        html += `<td><input type="button" value="消" class="all_button" onclick="bulkMs(${ri},false)"></td>`;
        html += `</tr>`;
        body.innerHTML += html;
    });

    const hints = {
        formation: '各行でそれぞれ選択したチームを組み合わせます',
        box:       '選択した全チームのボックス買いです',
        axis1: currentType === 'exacta'
            ? '軸は1チームのみ（赤）。軸が1着・2着どちらにも絡む全パターンを購入します'
            : '軸は1チームのみ（赤）。軸が1・2・3着どこにでも絡む全順列を購入します',
        axis2: '軸2チーム（赤）を固定し、相手を1チームずつ加えた3チームの全順列を購入します'
    };
    document.getElementById('ms-hint').innerText = hints[voteMode] || '';
}

function getMsRowDefs() {
    if (voteMode === 'box')   return [{ label: 'ボックス', rowIdx: 0 }];
    if (voteMode === 'axis1') return [{ label: '軸（1チーム）', rowIdx: 0 }, { label: '相手', rowIdx: 1 }];
    if (voteMode === 'axis2') return [{ label: '軸（2チーム）', rowIdx: 0 }, { label: '相手', rowIdx: 1 }];
    const rows = (currentType === 'trio' || currentType === 'trifecta') ? 3 : 2;
    return ['1列目', '2列目', '3列目'].slice(0, rows).map((label, i) => ({ label, rowIdx: i }));
}

function toggleMs(ri, num) {
    if (msRows[ri].has(num)) {
        msRows[ri].delete(num);
    } else {
        if (voteMode === 'axis1' && ri === 0) msRows[0].clear();
        if (voteMode === 'axis2' && ri === 0 && msRows[0].size >= 2) return;
        msRows[ri].add(num);
    }
    getCurrentMsState().rows = msRows;
    buildMsRows();
    updateMsCombCount();
    saveMsState();
}

function bulkMs(ri, val) {
    if (val) { teams.forEach((_, i) => msRows[ri].add(i + 1)); }
    else      { msRows[ri].clear(); }
    getCurrentMsState().rows = msRows;
    buildMsRows();
    updateMsCombCount();
    saveMsState();
}

function updateMsCombCount() {
    document.getElementById('ms-comb-count').innerText = getMsCombinations().length;
}

function getMsCombinations() {
    const r0 = [...msRows[0]];
    const r1 = [...msRows[1]];
    const r2 = [...msRows[2]];
    const uniqPair = (a, b) => [a, b].sort((x, y) => x - y).join('-');
    const uniqTrio = (a, b, c) => [a, b, c].sort((x, y) => x - y).join('-');
    let res = [];

    if (voteMode === 'box') {
        if (currentType === 'quinella' || currentType === 'wide') {
            for (let i = 0; i < r0.length; i++)
                for (let j = i + 1; j < r0.length; j++)
                    res.push(uniqPair(r0[i], r0[j]));
        } else if (currentType === 'exacta') {
            r0.forEach(a => r0.forEach(b => { if (a !== b) res.push(`${a}-${b}`); }));
        } else if (currentType === 'trio') {
            for (let i = 0; i < r0.length; i++)
                for (let j = i + 1; j < r0.length; j++)
                    for (let k = j + 1; k < r0.length; k++)
                        res.push(uniqTrio(r0[i], r0[j], r0[k]));
        } else if (currentType === 'trifecta') {
            r0.forEach(a => r0.forEach(b => r0.forEach(c => {
                if (a !== b && b !== c && a !== c) res.push(`${a}-${b}-${c}`);
            })));
        }

    } else if (voteMode === 'axis1') {
        const axis = r0[0]; if (!axis) return [];
        const aite = r1.filter(x => x !== axis);
        if (currentType === 'exacta') {
            const seen = new Set();
            aite.forEach(b => {
                [`${axis}-${b}`, `${b}-${axis}`].forEach(k => {
                    if (!seen.has(k)) { seen.add(k); res.push(k); }
                });
            });
        } else if (currentType === 'trifecta') {
            const seen = new Set();
            for (let i = 0; i < aite.length; i++) {
                for (let j = i + 1; j < aite.length; j++) {
                    const b = aite[i], c = aite[j];
                    [[axis,b,c],[axis,c,b],[b,axis,c],[b,c,axis],[c,axis,b],[c,b,axis]].forEach(([x,y,z]) => {
                        const k = `${x}-${y}-${z}`;
                        if (!seen.has(k)) { seen.add(k); res.push(k); }
                    });
                }
            }
        }

    } else if (voteMode === 'axis2') {
        const axes = r0.slice(0, 2); if (axes.length < 2) return [];
        const aite = r1.filter(x => !axes.includes(x));
        if (aite.length === 0) return [];
        if (currentType === 'trifecta') {
            const seen = new Set();
            aite.forEach(c => {
                const p = [axes[0], axes[1], c];
                [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]].forEach(([a,b,d]) => {
                    const k = `${p[a]}-${p[b]}-${p[d]}`;
                    if (!seen.has(k)) { seen.add(k); res.push(k); }
                });
            });
        }

    } else {
        // formation
        if (currentType === 'quinella' || currentType === 'wide') {
            r0.forEach(a => r1.forEach(b => {
                if (a === b) return;
                const p = uniqPair(a, b);
                if (!res.includes(p)) res.push(p);
            }));
        } else if (currentType === 'exacta') {
            r0.forEach(a => r1.forEach(b => { if (a !== b) res.push(`${a}-${b}`); }));
        } else if (currentType === 'trio') {
            r0.forEach(a => r1.forEach(b => r2.forEach(c => {
                if (a !== b && b !== c && a !== c) {
                    const t = uniqTrio(a, b, c);
                    if (!res.includes(t)) res.push(t);
                }
            })));
        } else if (currentType === 'trifecta') {
            r0.forEach(a => r1.forEach(b => r2.forEach(c => {
                if (a !== b && b !== c && a !== c) res.push(`${a}-${b}-${c}`);
            })));
        }
    }
    return res;
}

function applyMarksheet() {
    const combs = getMsCombinations();
    filterMode = combs.length > 0;
    render();
}

function setMarksheet() {
    const combs = getMsCombinations();
    if (combs.length === 0) return alert('買い目を選択してください');
    const modeNames = { formation: 'フォーメーション', box: 'ボックス', axis1: '1チーム軸マルチ', axis2: '2チーム軸マルチ' };
    const displayType = document.querySelector('.tab-menu li.active').innerText;
    let formationStr = '';
    if (voteMode === 'formation') {
        formationStr = getMsRowDefs().map((_, ri) => [...msRows[ri]].join(',')).join(' - ');
    } else if (voteMode === 'box') {
        formationStr = `BOX[${[...msRows[0]].join(',')}]`;
    } else if (voteMode === 'axis1') {
        formationStr = `軸${[...msRows[0]][0]} - 相手[${[...msRows[1]].join(',')}]`;
    } else if (voteMode === 'axis2') {
        formationStr = `軸[${[...msRows[0]].join(',')}] - 相手[${[...msRows[1]].join(',')}]`;
    }
    cart.push({ id: genId(), displayType: `${displayType}(${modeNames[voteMode]})`, type: currentType, formation: formationStr, combs, amountPerBet: 100 });
    saveCart();
    renderCart();
    document.getElementById('bet-management').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setSortMode(mode) {
    sortMode = mode;
    document.getElementById('btn-num').className = `sort-btn ${mode === 'num' ? 'active' : ''}`;
    document.getElementById('btn-pop').className = `sort-btn ${mode === 'pop' ? 'active' : ''}`;
    render();
}

// ── オッズ描画 ───────────────────────────────────────
function getOddsClass(valStr, type) {
    if (!valStr || valStr === '---') return '';
    const minVal = parseFloat(valStr.split('-')[0]);
    if (isNaN(minVal)) return '';
    const isMulti = ['quinella', 'exacta', 'trio', 'trifecta'].includes(type);
    if (isMulti) {
        if (minVal <= 100)  return 'odds-low';
        if (minVal >= 1000) return 'odds-high';
    } else {
        if (minVal <= 10)  return 'odds-low';
        if (minVal >= 100) return 'odds-high';
    }
    return '';
}

function render() {
    const container = document.getElementById('main-view');
    container.innerHTML = '';
    if (currentType === 'win-place') { renderWinPlace(); return; }
    const activeCombs = filterMode ? getMsCombinations() : Object.keys(oddsData[currentType] || {});
    let dataArr = activeCombs.map(key => {
        const val = (oddsData[currentType] || {})[key] || '---';
        return { key, val, sortVal: parseFloat(val.split('-')[0]) || 99999 };
    });
    if (sortMode === 'pop') {
        dataArr.sort((a, b) => a.sortVal - b.sortVal);
    } else {
        dataArr.sort((a, b) => {
            const ak = a.key.split('-').map(n => n.padStart(2, '0')).join('');
            const bk = b.key.split('-').map(n => n.padStart(2, '0')).join('');
            return ak.localeCompare(bk);
        });
    }
    let html = `<div class="list-wrapper"><table class="list-table odds-list"><thead><tr><th class="col-comb">組合せ</th><th class="col-odds">オッズ</th></tr></thead><tbody>`;
    dataArr.forEach(d => {
        html += `<tr class="odds_row" data-comb="${d.key}"><td class="col-comb">${d.key}</td><td class="col-odds odds-val ${getOddsClass(d.val, currentType)}" data-clickable="1">${d.val}</td></tr>`;
    });
    container.innerHTML = html + `</tbody></table></div>`;
}

function renderWinPlace() {
    const container = document.getElementById('main-view');
    let list = teams.map((t, i) => ({
        no: i + 1, tag: t.name,
        win:   (oddsData.win   || {})[i + 1],
        place: (oddsData.place || {})[i + 1]
    }));
    if (sortMode === 'pop') list.sort((a, b) => parseFloat(a.win) - parseFloat(b.win));
    let html = `<table class="list-table"><thead><tr><th>番号</th><th>チーム</th><th>単勝</th><th>複勝</th></tr></thead><tbody>`;
    list.forEach(item => {
        html += `<tr class="odds_row" data-no="${item.no}">
            <td>${item.no}</td><td>${item.tag}</td>
            <td class="odds-val ${getOddsClass(item.win, 'win-place')}"  data-bet-type="win">${item.win  || '---'}</td>
            <td class="odds-val ${getOddsClass(item.place, 'win-place')}" data-bet-type="place">${item.place || '---'}</td>
        </tr>`;
    });
    container.innerHTML = html + `</tbody></table>`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('main-view').addEventListener('click', function (e) {
        const row = e.target.closest('tr.odds_row');
        if (!row) return;
        let combKey, betType, displayType;
        if (currentType === 'win-place') {
            const cell = e.target.closest('td[data-bet-type]');
            if (!cell) return;
            betType     = cell.dataset.betType;
            combKey     = row.dataset.no;
            displayType = betType === 'win' ? '単勝' : '複勝';
        } else {
            // オッズセル（右側）のクリックのみ反応
            const cell = e.target.closest('td[data-clickable]');
            if (!cell) return;
            combKey     = row.dataset.comb;
            betType     = currentType;
            displayType = document.querySelector('.tab-menu li.active').innerText;
            if (!combKey) return;
        }
        cart.push({ id: genId(), displayType, type: betType, formation: combKey, combs: [combKey], amountPerBet: 100 });
        saveCart();
        renderCart();
        document.getElementById('bet-management').scrollIntoView({ behavior: 'smooth', block: 'start' });
        row.style.transition = 'none';
        row.style.backgroundColor = '#ffe082';
        setTimeout(() => { row.style.transition = 'background 0.4s'; row.style.backgroundColor = ''; }, 150);
    });
});

const CART_STORAGE_KEY = 'cart_ps2627';

function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function loadCart() {
    try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
            cart = JSON.parse(saved);
            // idカウンターを保存済みの最大idより大きくする
            const maxId = cart.reduce((m, i) => Math.max(m, i.id || 0), 0);
            _idCounter = maxId + 1;
        }
    } catch(e) {
        cart = [];
    }
}

// ── カート ───────────────────────────────────────────
function renderCart() {
    const tbody = document.getElementById('cart-body');
    tbody.innerHTML = '';
    if (cart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:#999;">買い目がありません</td></tr>';
        updateTotal(); return;
    }
    cart.forEach(item => {
        const tr = document.createElement('tr');
        const isSingle = item.combs.length === 1;
        const typeKey  = item.type === 'win' ? 'win' : item.type === 'place' ? 'place' : item.type;
        const oddsVal  = isSingle && oddsData[typeKey] ? (oddsData[typeKey][item.combs[0]] || '---') : null;
        const oddsInfo = oddsVal ? `<br><span style="color:#d00;font-size:.8em;">オッズ: ${oddsVal}</span>` : '';

        let returnInfo = '';
        if (isSingle) {
            const ret = calcExpectedReturn(item);
            returnInfo = `<br><span id="ret-${item.id}" style="color:#007d43;font-size:.8em;">${ret !== null ? '想定払戻: ' + ret.toLocaleString() + ' pt' : ''}</span>`;
        }

        const n = item.amountPerBet / 100;
        tr.innerHTML = `
            <td style="font-weight:bold;">${item.displayType}</td>
            <td style="font-family:monospace;">${item.formation}${oddsInfo}${returnInfo}</td>
            <td>${item.combs.length}点</td>
            <td><span class="pt-display" onclick="openNumpad(${item.id})">[<span class="pt-n" id="pt-n-${item.id}">${n}</span>]<span class="pt-fixed">00 pt</span></span></td>
            <td>
                ${!isSingle ? `<button class="btn-expand" onclick="expandBet(${item.id})">展開</button> <button class="btn-expand-budget" onclick="openExpandBudgetNumpad(${item.id})">予算分配して展開</button> ` : ''}
                <button class="btn-delete" onclick="removeFromCart(${item.id})">削除</button>
            </td>`;
        tbody.appendChild(tr);
    });
    updateTotal();
}

function removeFromCart(id) { cart = cart.filter(i => i.id !== id); saveCart(); renderCart(); }

function clearCart() {
    // スマホでconfirm()がブロックされる場合があるためカスタムダイアログを使用
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:8px;padding:24px 20px;max-width:300px;width:90%;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.3);';
    box.innerHTML = `<p style="margin:0 0 18px;font-size:.95em;line-height:1.6;">買い目をすべて削除します。<br>よろしいですか？</p>
        <div style="display:flex;gap:10px;justify-content:center;">
            <button id="_cc_ok" style="padding:8px 24px;background:#d00;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:.9em;">削除</button>
            <button id="_cc_cancel" style="padding:8px 24px;background:#f0f0f0;color:#333;border:none;border-radius:4px;cursor:pointer;font-size:.9em;">キャンセル</button>
        </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.getElementById('_cc_ok').onclick = () => {
        cart = []; saveCart(); renderCart();
        document.body.removeChild(overlay);
    };
    document.getElementById('_cc_cancel').onclick = () => document.body.removeChild(overlay);
}

function expandBet(id) {
    const item = cart.find(i => i.id === id); if (!item) return;
    item.combs.forEach(ck => cart.push({ id: genId(), displayType: item.displayType, type: item.type, formation: ck, combs: [ck], amountPerBet: item.amountPerBet }));
    cart = cart.filter(i => i.id !== id);
    saveCart();
    renderCart();
}

function updateTotal() {
    let total = 0;
    cart.forEach(item => { total += item.combs.length * item.amountPerBet; });
    document.getElementById('total-bet-amount').innerText = total.toLocaleString();
    const rem = BUDGET_LIMIT - total;
    const el  = document.getElementById('remaining-budget');
    el.innerText   = rem.toLocaleString();
    el.style.color = rem < 0 ? 'red' : 'white';
}

// ── オッズ計算ユーティリティ ──────────────────────────
function getOddsMidpoint(valStr) {
    if (!valStr || valStr === '---') return null;
    if (valStr.includes(' - ')) {
        const parts = valStr.split(' - ');
        const lo = parseFloat(parts[0]);
        const hi = parseFloat(parts[1]);
        if (isNaN(lo) || isNaN(hi)) return null;
        return Math.floor(((lo + hi) / 2) * 10) / 10;
    }
    const v = parseFloat(valStr);
    return isNaN(v) ? null : v;
}

function calcExpectedReturn(item) {
    if (item.combs.length !== 1) return null;
    const typeKey = item.type === 'win' ? 'win' : item.type === 'place' ? 'place' : item.type;
    const oddsStr = oddsData[typeKey] ? oddsData[typeKey][item.combs[0]] : null;
    if (!oddsStr) return null;
    const mid = getOddsMidpoint(oddsStr);
    if (mid === null) return null;
    return Math.round(item.amountPerBet * mid);
}

// ── テンキー ─────────────────────────────────────────
function openNumpad(id) {
    npTargetId = id;
    npExpandId = null;
    npMode     = 'amount';
    npBuffer   = '';
    document.getElementById('numpad-label').textContent = '× 100 pt で入力してください';
    updateNumpadPreview();
    document.getElementById('numpad-overlay').classList.remove('hidden');
}

function openExpandBudgetNumpad(id) {
    npExpandId = id;
    npTargetId = null;
    npMode     = 'expand-budget';
    npBuffer   = '';
    document.getElementById('numpad-label').textContent = '配分予算を × 100 pt で入力';
    updateNumpadPreview();
    document.getElementById('numpad-overlay').classList.remove('hidden');
}

function closeNumpad(e) {
    if (e && e.target !== document.getElementById('numpad-overlay')) return;
    _closeNumpadCleanup();
}

function _closeNumpadCleanup() {
    document.getElementById('numpad-overlay').classList.add('hidden');
    npTargetId = null;
    npBuffer   = '';
    npMode     = 'amount';
    npExpandId = null;
}

function updateNumpadPreview() {
    const n = npBuffer || '0';
    document.getElementById('numpad-preview').innerHTML =
        `[<span style="color:var(--jra-blue)">${n}</span>]<span style="font-size:.75em;color:#666">00 pt</span>` +
        `<br><span style="font-size:.6em;color:#aaa">= ${(parseInt(n) || 0) * 100} pt</span>`;
}

function npInput(digit) { if (npBuffer === '0') npBuffer = ''; if (npBuffer.length >= 4) return; npBuffer += String(digit); updateNumpadPreview(); }
function npBack()  { npBuffer = npBuffer.slice(0, -1); updateNumpadPreview(); }
function npClear() { npBuffer = ''; updateNumpadPreview(); }

function npConfirm() {
    const n = Math.max(1, parseInt(npBuffer) || 1);
    if (npMode === 'expand-budget') {
        _doExpandWithBudget(npExpandId, n * 100);
    } else if (npTargetId !== null) {
        const item = cart.find(i => i.id === npTargetId);
        if (item) {
            item.amountPerBet = n * 100;
            const el    = document.getElementById(`pt-n-${npTargetId}`);
            if (el) el.innerText = n;
            const retEl = document.getElementById(`ret-${npTargetId}`);
            if (retEl) {
                const ret = calcExpectedReturn(item);
                retEl.textContent = ret !== null ? `想定払戻: ${ret.toLocaleString()} pt` : '';
            }
            updateTotal();
            saveCart();
        }
    }
    _closeNumpadCleanup();
}function _doExpandWithBudget(id, budget) {
    const item = cart.find(i => i.id === id);
    if (!item || item.combs.length === 0) return;

    let currentTotal = 0;
    cart.forEach(i => { if (i.id !== id) currentTotal += i.combs.length * i.amountPerBet; });
    if (currentTotal + budget > BUDGET_LIMIT) {
        alert(`予算超過：残り利用可能は ${(BUDGET_LIMIT - currentTotal).toLocaleString()} pt です`);
        return;
    }

    const typeKey  = item.type === 'win' ? 'win' : item.type === 'place' ? 'place' : item.type;
    const combOdds = item.combs.map(ck => {
        const oddsStr = oddsData[typeKey] ? oddsData[typeKey][ck] : null;
        return { ck, mid: oddsStr ? (getOddsMidpoint(oddsStr) || 1) : 1 };
    });

    const n = item.combs.length;
    const minTotal = n * 100;

    // 最低100pt×点数が予算を超える場合は中断
    if (minTotal > budget) {
        alert(`点数が多すぎて予算内に収まりません。予算を増やすか、買い目を減らしてください。\n（最低必要: ${minTotal.toLocaleString()}pt / 設定予算: ${budget.toLocaleString()}pt）`);
        return;
    }

    // Step1: 全点に最低100ptを配分
    const amounts = combOdds.map(() => 100);

    // Step2: 残り予算を払い戻し均一になるよう100ptずつ追加
    let remainder = budget - minTotal;
    while (remainder >= 100) {
        const returns = amounts.map((amt, i) => amt * combOdds[i].mid);
        const minIdx  = returns.indexOf(Math.min(...returns));
        amounts[minIdx] += 100;
        remainder -= 100;
    }

    const insertIdx = cart.findIndex(i => i.id === id);
    const newItems  = combOdds.map((c, idx) => ({
        id: genId(), displayType: item.displayType, type: item.type,
        formation: c.ck, combs: [c.ck], amountPerBet: amounts[idx]
    }));
    cart.splice(insertIdx, 1, ...newItems);
    saveCart();
    renderCart();
}

// ── フォーム出力 ─────────────────────────────────────
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd3lkH75uSufuwNEllHmrXZQmxXnq-w1T2SBLne6kO7JiUJvA/viewform?usp=header';

function prepareGoogleForm() {
    if (cart.length === 0) return alert('買い目がありません');
    let exportData = '【Premier Series 26-27 買い目】\n';
    cart.forEach(item => {
        exportData += `[${item.displayType}] ${item.formation} / ${item.combs.length}点 / 各${item.amountPerBet}pt / 計${item.combs.length * item.amountPerBet}pt\n`;
    });
    exportData += `------------------\n合計: ${document.getElementById('total-bet-amount').innerText}pt`;
    document.getElementById('form-data-text').value = exportData;
    document.getElementById('copy-feedback').style.display = 'none';
    document.getElementById('btn-copy').textContent = '📋 コピーする';
    document.getElementById('form-export-area').classList.remove('hidden');
}

function copyFormData() {
    const text = document.getElementById('form-data-text').value;
    if (!text) return;

    const onSuccess = () => {
        const fb  = document.getElementById('copy-feedback');
        const btn = document.getElementById('btn-copy');
        fb.style.display  = 'inline';
        btn.textContent   = '✔ コピー済み';
        setTimeout(() => {
            fb.style.display = 'none';
            btn.textContent  = '📋 コピーする';
        }, 3000);
    };

    // clipboard API（HTTPS / localhost）
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
    } else {
        fallbackCopy(text, onSuccess);
    }
}

function fallbackCopy(text, onSuccess) {
    // readonlyを一時解除して選択→コピー→再設定
    const ta = document.getElementById('form-data-text');
    ta.removeAttribute('readonly');
    ta.focus();
    ta.select();
    try {
        const ok = document.execCommand('copy');
        if (ok) onSuccess();
        else alert('コピーできませんでした。手動で選択してコピーしてください。');
    } catch (e) {
        alert('コピーできませんでした。手動で選択してコピーしてください。');
    }
    ta.setAttribute('readonly', '');
}
