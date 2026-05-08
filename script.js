const MIN_N = 12;
const MAX_N = 48;
let currentN = 24; 
let isSecondsVisible = true; 
let currentLang = 'ja'; 

// ★★★ 修正・追加: プリセットの表示状態を管理 ★★★
let isPresetFeatureEnabled = true; // 初期値はON
const PRESET_TOGGLE_KEY = 'nClockPresetEnabled';

// N値プリセット関連の変数/初期設定
let presets = []; 
const PRESET_STORAGE_KEY = 'nClockPresets';

// タブバーの翻訳マップ
const translations = {
    'ja': {
        'nav-clock': '時計',
        'nav-stopwatch': 'ストップウォッチ',
        'nav-alarm': 'アラーム',
        'nav-settings': '設定',
    },
    'en': {
        'nav-clock': 'Clock',
        'nav-stopwatch': 'Stopwatch',
        'nav-alarm': 'Alarm',
        'nav-settings': 'Settings',
    }
};

// ストップウォッチ関連の変数
let stopwatchStartTime = 0;
let stopwatchElapsedTime = 0; 
let stopwatchTimer = null;
let lapTimes = []; // 区間タイムを格納
let lastLapTimeTotal = 0; // 前回のラップ時の合計経過時間（N値換算）


// アラーム関連の変数
let alarms = [
    {id: 1, h: 7, m: 0, enabled: true, label: 'Alarm'},
]; 
let nextAlarmId = 2;


// ----------------------------------------------------
// N値に基づいた時計の「速さ」調整ロジック 
// ----------------------------------------------------

function calculateNTime(realTime) {
    const speedFactor = 24 / currentN; 
    const real_elapsed_seconds = realTime / 1000;
    const n_world_elapsed_seconds = real_elapsed_seconds * speedFactor;
    
    const totalSecondsIn24h = n_world_elapsed_seconds;

    const h_24 = Math.floor((totalSecondsIn24h / 3600) % 24); 
    const m_24 = Math.floor((totalSecondsIn24h % 3600) / 60);
    const s_24 = Math.floor(totalSecondsIn24h % 60);

    return { h: h_24, m: m_24, s: s_24 };
}

function updateClock() {
    const now = new Date();
    const realTimeOfDay = now.getTime() - new Date(now.toDateString()).getTime(); 
    
    const { h, m, s } = calculateNTime(realTimeOfDay); 
    
    const formattedH = String(h).padStart(2, '0');
    const formattedM = String(m).padStart(2, '0');
    const formattedS = String(s).padStart(2, '0');
    
    let timeString = `${formattedH}:${formattedM}`;
    if (isSecondsVisible) {
        timeString += `:${formattedS}`;
    }

    const clockDisplay = document.getElementById('n-clock-display');
    if (clockDisplay) {
        clockDisplay.textContent = timeString;
    }
    const nValueDisplay = document.getElementById('n-value-display');
    if (nValueDisplay) {
        nValueDisplay.textContent = `N = ${currentN} ${currentLang === 'ja' ? '時間' : 'Hours'}`;
    }

    checkAlarms(h, m, s); 
}


// ----------------------------------------------------
// N値プリセット ロジック 
// ----------------------------------------------------

function loadPresets() {
    const savedPresets = localStorage.getItem(PRESET_STORAGE_KEY);
    if (savedPresets) {
        presets = JSON.parse(savedPresets);
    } else {
        // 初期プリセット (ユーザーにわかりやすい例を提供)
        presets = [
            { id: 1, name: "標準 (24H)", n: 24 },
            { id: 2, name: "集中モード (18H)", n: 18 },
            { id: 3, name: "リラックス (36H)", n: 36 }
        ];
    }
    nextPresetId = presets.length > 0 ? Math.max(...presets.map(p => p.id)) + 1 : 4; 
}

function savePresets() {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

// ★★★ プリセットトグルの状態を管理する関数 (追加) ★★★
function loadPresetToggleState() {
    const savedState = localStorage.getItem(PRESET_TOGGLE_KEY);
    // nullでなければ、保存された状態を適用
    if (savedState !== null) {
        isPresetFeatureEnabled = (savedState === 'true');
    }
}

function savePresetToggleState() {
    localStorage.setItem(PRESET_TOGGLE_KEY, isPresetFeatureEnabled.toString());
}

let nextPresetId = 4; 

function applyPreset(n) {
    currentN = n;
    // スライダーと表示を更新するため、時計モードを再レンダリング
    renderClockMode(); 
    updateClock();
}

function addCurrentNToPresets() {
    const presetName = prompt(currentLang === 'ja' ? 'プリセット名を入力してください:' : 'Enter preset name:');
    if (presetName && presetName.trim() !== "") {
        presets.push({
            id: nextPresetId++,
            name: presetName.trim(),
            n: currentN
        });
        savePresets();
        renderClockMode(); // UIを更新
    }
}

function deletePreset(id) {
    presets = presets.filter(p => p.id !== id);
    savePresets();
    renderClockMode(); // UIを更新
}


// ----------------------------------------------------
// ストップウォッチ ロジック (既存)
// ----------------------------------------------------

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const msRemainder = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');
    
    if (totalSeconds >= 3600) {
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        return `${h}:${m}:${s}.${msRemainder}`;
    } else {
        const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        return `${m}:${s}.${msRemainder}`;
    }
}

function updateStopwatch() {
    const now = Date.now();
    const realTimeElapsedSinceStart = now - stopwatchStartTime;
    let totalRealAccumulated = stopwatchElapsedTime + realTimeElapsedSinceStart;
    
    const speedFactor = 24 / currentN;
    let nWorldTimeForDisplay = totalRealAccumulated * speedFactor;

    document.getElementById('stopwatch-display').textContent = formatTime(nWorldTimeForDisplay);
}

function startStopwatch() {
    if (!stopwatchTimer) {
        stopwatchStartTime = Date.now();
        stopwatchTimer = setInterval(updateStopwatch, 10); 
        document.getElementById('start-stop-btn').textContent = currentLang === 'ja' ? 'ストップ' : 'Stop';
        document.getElementById('start-stop-btn').classList.remove('start');
        document.getElementById('start-stop-btn').classList.add('stop');
        document.getElementById('lap-reset-btn').textContent = currentLang === 'ja' ? 'ラップ' : 'Lap';
        document.getElementById('lap-reset-btn').classList.remove('reset');
    } else {
        clearInterval(stopwatchTimer);
        stopwatchElapsedTime += Date.now() - stopwatchStartTime; 
        stopwatchTimer = null;
        document.getElementById('start-stop-btn').textContent = currentLang === 'ja' ? 'スタート' : 'Start';
        document.getElementById('start-stop-btn').classList.remove('stop');
        document.getElementById('start-stop-btn').classList.add('start');
        document.getElementById('lap-reset-btn').textContent = currentLang === 'ja' ? 'リセット' : 'Reset';
        document.getElementById('lap-reset-btn').classList.add('reset');
    }
}

function lapOrResetStopwatch() {
    if (stopwatchTimer) { 
        const totalRealTime = (Date.now() - stopwatchStartTime) + stopwatchElapsedTime;
        const speedFactor = 24 / currentN;
        const nWorldTotalTime = totalRealTime * speedFactor;
        
        const currentLapTime = nWorldTotalTime - lastLapTimeTotal; 
        
        lapTimes.push(currentLapTime);
        
        lastLapTimeTotal = nWorldTotalTime; 
        
        renderLaps();
    } else if (stopwatchElapsedTime > 0) { 
        stopwatchStartTime = 0;
        stopwatchElapsedTime = 0; 
        lapTimes = [];
        lastLapTimeTotal = 0; 
        
        document.getElementById('stopwatch-display').textContent = formatTime(0);
        document.getElementById('lap-reset-btn').textContent = currentLang === 'ja' ? 'ラップ' : 'Lap';
        document.getElementById('lap-reset-btn').classList.remove('reset');
        renderLaps();
    }
}

function renderLaps() {
    const lapsList = document.getElementById('lap-list');
    if (!lapsList) return;
    
    lapsList.innerHTML = '';
    
    lapTimes.slice().reverse().forEach((lap, index) => {
        const li = document.createElement('li');
        const lapNumber = lapTimes.length - index; 
        li.textContent = `${currentLang === 'ja' ? 'ラップ' : 'Lap'} ${lapNumber}: ${formatTime(lap)}`;
        lapsList.appendChild(li); 
    });
}


// ----------------------------------------------------
// アラーム ロジック (既存)
// ----------------------------------------------------

function addAlarm() {
    const newAlarm = {
        id: nextAlarmId++,
        h: 7, 
        m: 0, 
        enabled: true,
        label: currentLang === 'ja' ? 'アラーム' : 'Alarm',
    };
    alarms.push(newAlarm);
    renderAlarmMode(); 
}

function toggleAlarm(id) {
    const alarm = alarms.find(a => a.id === id);
    if (alarm) {
        alarm.enabled = !alarm.enabled;
        renderAlarmsList(); 
    }
}

function deleteAlarm(id) {
    alarms = alarms.filter(a => a.id !== id);
    renderAlarmMode(); 
}

function checkAlarms(currentH_24, currentM_24, currentS_24) {
    if (currentS_24 === 0) { 
        alarms.forEach(alarm => {
            if (alarm.enabled) {
                if (alarm.h === currentH_24 && alarm.m === currentM_24) {
                    alert(`${currentLang === 'ja' ? 'アラームが鳴りました！' : 'Alarm Triggered!'}\n${String(alarm.h).padStart(2, '0')}:${String(alarm.m).padStart(2, '0')}`);
                }
            }
        });
    }
}

function handleTimeClick(id) {
    const alarm = alarms.find(a => a.id === id);
    if (!alarm) return;

    const itemDiv = document.getElementById(`alarm-item-${id}`); 
    if (!itemDiv) return;

    const hourSelect = Array.from({ length: 24 }, (_, i) => 
        `<option value="${i}" ${i === alarm.h ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`
    ).join('');
    
    const minuteSelect = Array.from({ length: 60 }, (_, i) => 
        `<option value="${i}" ${i === alarm.m ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`
    ).join('');

    itemDiv.innerHTML = `
        <div class="alarm-time-setting-container">
            <select id="hour-${id}" class="time-select">${hourSelect}</select>
            <span>:</span>
            <select id="minute-${id}" class="time-select">${minuteSelect}</select>
        </div>
        <div class="alarm-actions">
             <button onclick="saveAlarmTime(${id})" class="save-btn action-button">
                ${currentLang === 'ja' ? '保存' : 'Save'}
            </button>
        </div>
    `;
}

function saveAlarmTime(id) {
    const alarm = alarms.find(a => a.id === id);
    if (!alarm) return;

    const hourSelect = document.getElementById(`hour-${id}`);
    const minuteSelect = document.getElementById(`minute-${id}`);

    if (hourSelect && minuteSelect) {
        alarm.h = parseInt(hourSelect.value);
        alarm.m = parseInt(minuteSelect.value);
        renderAlarmsList(); 
    } else {
        console.error(`Error: Could not find hour/minute selects for alarm ID: ${id}`);
    }
}

function renderAlarmsList() {
    const list = document.getElementById('alarms-list');
    if (!list) return;

    list.innerHTML = alarms.map(alarm => `
        <li class="alarm-item" id="alarm-item-${alarm.id}">
            <div id="alarm-time-${alarm.id}" class="alarm-time" onclick="handleTimeClick(${alarm.id})">
                ${String(alarm.h).padStart(2, '0')}:${String(alarm.m).padStart(2, '0')}
            </div>
            <div class="alarm-actions">
                <button onclick="deleteAlarm(${alarm.id})" class="delete-btn action-button">
                    ${currentLang === 'ja' ? '削除' : 'Delete'}
                </button>
                <label class="toggle-switch" style="float:none; margin-left: 10px;">
                    <input type="checkbox" ${alarm.enabled ? 'checked' : ''} onchange="toggleAlarm(${alarm.id})">
                    <span class="slider"></span>
                </label>
            </div>
        </li>
    `).join('');
}


// ----------------------------------------------------
// アコーディオンロジック (既存)
// ----------------------------------------------------

function toggleAccordion() {
    const header = document.getElementById('accordion-header');
    const content = document.getElementById('clock-explanation');
    
    header.classList.toggle('active');
    content.classList.toggle('open');
    
    if (content.classList.contains('open')) {
        content.style.maxHeight = content.scrollHeight + 36 + "px"; 
    } else {
        content.style.maxHeight = null;
    }
}


// ----------------------------------------------------
// モードのレンダリング関数 (時計モードにプリセットUIを追加)
// ----------------------------------------------------

function renderClockMode() {
    document.getElementById('content-area').innerHTML = `
        <div class="mode-title">${currentLang === 'ja' ? '時計' : 'Clock'}</div>
        <div id="n-clock-display" class="clock-display">--:--</div>
        
        <div class="control-panel">
            <label for="n-slider" style="font-weight: 700;">1日の時間 (N)</label>
            <input type="range" id="n-slider" min="${MIN_N}" max="${MAX_N}" value="${currentN}">
            <div id="n-value-display" style="text-align: center; font-weight: 700;">N = ${currentN} ${currentLang === 'ja' ? '時間' : 'Hours'}</div>
        </div>
        
        ${isPresetFeatureEnabled ? `
            <div class="preset-container">
                <div class="preset-header">
                    <h3>${currentLang === 'ja' ? 'N値プリセット' : 'N Value Presets'}</h3>
                    <button onclick="addCurrentNToPresets()" class="action-button save-preset-btn">
                        ${currentLang === 'ja' ? '現在のN値を保存' : 'Save Current N'}
                    </button>
                </div>
                <ul class="preset-list">
                    ${presets.map(p => `
                        <li class="preset-item" onclick="applyPreset(${p.n})">
                            <span class="preset-name">${p.name}</span>
                            <span class="preset-value">N = ${p.n}</span>
                            <button onclick="event.stopPropagation(); deletePreset(${p.id})" class="delete-preset-btn">
                                ${currentLang === 'ja' ? '削除' : 'Del'}
                            </button>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : ''} 
        <button id="accordion-header" class="accordion-header" onclick="toggleAccordion()">
            <span>N Clock アプリの説明と使い方</span>
            <span class="accordion-icon">▼</span>
        </button>
        
        <div id="clock-explanation" class="accordion-content">
            
            <h2>N Clock：時間の進みを操るカスタム時計 PWA</h2>
            
            <p>N Clockは、**「N値」**という独自の基準に基づき、時間の速さを自由に設定できるユニークな時計アプリです。現実世界の24時間を、設定したN時間として計算・表示します。</p>
            
            <h3>N値で体験する擬似タイムマシン</h3>
            
            <p style="margin-bottom: 5px;">
                **Nを大きくする（N > 24）**: 
                <span style="font-weight: 700;">時間の進みがゆっくりに。</span>相対性理論の「未来へのタイムトラベル」を擬似体験。あなたの時計はゆっくりなのに、周りの時間は早く進みます。
            </p>
            <p>
                **Nを小さくする（N < 24）**: 
                <span style="font-weight: 700;">時間の進みが早くに。</span>N Clockに従って行動すれば、現実の時間よりも早くタスクが完了し、「時間の貯金」が可能です。
            </p>

            <h3 style="margin-top: 30px;">主な機能と利用方法</h3>
            
            <ul>
                <li>**全機能N値連動**: 時計、ストップウォッチ、アラーム全てがN値に連動して動作します。</li>
                <li>**PWA対応**: スマートフォンのホーム画面に追加することで、オフラインでもアプリとして高速利用できます。</li>
            </ul>

            <p style="font-size: 14px; color: #555;">※ ホーム画面への追加は、ブラウザの共有メニューから「ホーム画面に追加」を選択してください。</p>
            
        </div>
    `;
    setupNControl(); 
    updateClock();
}

function renderStopwatchMode() {
    const totalRealTime = stopwatchElapsedTime + (stopwatchTimer ? Date.now() - stopwatchStartTime : 0);
    const speedFactor = 24 / currentN;
    const displayTime = formatTime(totalRealTime * speedFactor);
    
    document.getElementById('content-area').innerHTML = `
        <div class="mode-title">${currentLang === 'ja' ? 'ストップウォッチ' : 'Stopwatch'}</div>
        <div id="stopwatch-display" class="clock-display">${displayTime}</div>
        
        <div class="stopwatch-controls">
            <button id="lap-reset-btn" class="control-button rounded-square-btn gray-btn ${stopwatchTimer ? '' : (stopwatchElapsedTime > 0 ? 'reset' : '')}">
                ${stopwatchTimer ? (currentLang === 'ja' ? 'ラップ' : 'Lap') : (stopwatchElapsedTime > 0 ? (currentLang === 'ja' ? 'リセット' : 'Reset') : (currentLang === 'ja' ? 'ラップ' : 'Lap'))}
            </button>
            <button id="start-stop-btn" class="control-button rounded-square-btn ${stopwatchTimer ? 'stop' : (stopwatchElapsedTime > 0 ? 'start' : 'start')}">
                ${stopwatchTimer ? (currentLang === 'ja' ? 'ストップ' : 'Stop') : (currentLang === 'ja' ? 'スタート' : 'Start')}
            </button>
        </div>
        
        <ul id="lap-list" class="lap-list">
            </ul>
    `;
    
    document.getElementById('start-stop-btn').addEventListener('click', startStopwatch);
    document.getElementById('lap-reset-btn').addEventListener('click', lapOrResetStopwatch);
    
    renderLaps();
}

function renderAlarmMode() {
    document.getElementById('content-area').innerHTML = `
        <div class="mode-title">${currentLang === 'ja' ? 'アラーム' : 'Alarm'}</div>
        
        <div style="text-align:center; padding: 10px 0;">
            <button id="add-alarm-btn" onclick="addAlarm()" class="add-button action-button">
                ${currentLang === 'ja' ? '＋ アラームを追加' : '＋ Add Alarm'}
            </button>
        </div>
        
        <ul id="alarms-list" class="alarms-list">
            </ul>
    `;
    renderAlarmsList();
}

function renderSettingsMode() {
    document.getElementById('content-area').innerHTML = `
        <div class="mode-title">${currentLang === 'ja' ? '設定' : 'Settings'}</div>
        <ul class="settings-list">
            <li>
                <span>${currentLang === 'ja' ? '秒数表示' : 'Show Seconds'}</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="seconds-toggle">
                    <span class="slider"></span>
                </label>
            </li>
            
            <li>
                <span>${currentLang === 'ja' ? 'N値プリセット機能' : 'N Preset Feature'}</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="preset-toggle">
                    <span class="slider"></span>
                </label>
            </li>
            
            <li>
                <span>${currentLang === 'ja' ? '言語表示' : 'Language'}</span>
                <div class="segmented-control" id="language-control">
                    <button data-lang="ja" class="segment-button ${currentLang === 'ja' ? 'active' : ''}">${currentLang === 'ja' ? '日本語' : 'Japanese'}</button>
                    <button data-lang="en" class="segment-button ${currentLang === 'en' ? 'active' : ''}">${currentLang === 'ja' ? '英語' : 'English'}</button>
                </div>
            </li>
            
            <li>
                <a href="./privacy.html" class="settings-link">
                    ${currentLang === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy'}
                </a>
                <span class="disclosure-arrow">></span>
            </li>
            
            <li>
                <a href="./contact.html" class="settings-link">
                    ${currentLang === 'ja' ? 'お問い合わせ・運営者情報' : 'Contact & About'}
                </a>
                <span class="disclosure-arrow">></span>
            </li>
            
        </ul>
    `;
    setupSettings(); 
}


// ----------------------------------------------------
// コントロール/イベントハンドラの設定 (トグルロジックを追加)
// ----------------------------------------------------

function setupNControl() {
    const slider = document.getElementById('n-slider');
    if (slider) {
        slider.min = MIN_N;
        slider.max = MAX_N;
        slider.value = currentN;

        slider.oninput = (e) => {
            currentN = parseInt(e.target.value);
            updateClock();
        };
    }
}

function setupSettings() {
    const secondsToggle = document.getElementById('seconds-toggle');
    if (secondsToggle) {
        secondsToggle.checked = isSecondsVisible;
        secondsToggle.onchange = (e) => {
            isSecondsVisible = e.target.checked;
            updateClock(); 
        };
    }
    
    // ★★★ 追加: プリセットトグルのロジック ★★★
    const presetToggle = document.getElementById('preset-toggle');
    if (presetToggle) {
        presetToggle.checked = isPresetFeatureEnabled;
        presetToggle.onchange = (e) => {
            isPresetFeatureEnabled = e.target.checked;
            savePresetToggleState(); // 状態を保存
            
            // プリセットの表示/非表示を即座に反映するため、時計モードを再レンダリング
            if (document.querySelector('.tab-item.active').id === 'nav-clock') {
                renderClockMode();
            }
        };
    }

    const langControl = document.getElementById('language-control');
    if (langControl) {
        langControl.querySelectorAll('.segment-button').forEach(button => {
            button.addEventListener('click', () => {
                langControl.querySelectorAll('.segment-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                currentLang = button.dataset.lang;
                
                renderCurrentMode(); 
                updateClock();
                updateTabBarText(); 
            });
        });
    }
}

function renderCurrentMode() {
    const activeTab = document.querySelector('.tab-item.active');
    if (!activeTab) return;

    switch (activeTab.id) {
        case 'nav-clock':
            renderClockMode();
            break;
        case 'nav-stopwatch':
            renderStopwatchMode();
            break;
        case 'nav-alarm':
            renderAlarmMode();
            break;
        case 'nav-settings':
            renderSettingsMode();
            break;
    }
}

// タブバーのテキストを更新する関数
function updateTabBarText() {
    document.querySelectorAll('.tab-item').forEach(button => {
        const key = button.id;
        const text = translations[currentLang][key];
        const label = button.querySelector('.label');
        if (label) {
            label.textContent = text;
        }
    });
}

function setupNavigation() {
    document.querySelectorAll('.tab-item').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-item').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            renderCurrentMode();
        });
    });
}


// ----------------------------------------------------
// アプリの初期化 (トグル状態のロードを追加)
// ----------------------------------------------------

// PWA対応: Service Workerの登録
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js', { scope: './' }) 
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
}

function initApp() {
    registerServiceWorker(); 
    
    // ★★★ 修正・追加: トグル状態をロードする ★★★
    loadPresets(); 
    loadPresetToggleState(); 

    setInterval(updateClock, 100); 
    setupNavigation();
    updateTabBarText(); 
    renderClockMode(); 
}

document.addEventListener('DOMContentLoaded', initApp);
