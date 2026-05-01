// common.js — データ読み込み・共通ユーティリティ

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
