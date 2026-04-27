// ==========================================
// 0. Supabase 設定
// ==========================================
const SUPABASE_URL = 'https://bewqvxdwlyqjwklkqinm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJld3F2eGR3bHlxandrbGtxaW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjY1ODksImV4cCI6MjA5MTk0MjU4OX0.IGZntAhJy_NVxhQQp-R8YUvrLyLN8rcUmBxnHqE3MMc';
let supabaseClient; // 必ず supabaseClient という名前にします
if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ==========================================
// 1. 設定・定数 (Config)
// ==========================================
const AppConfig = {
    COLORS: { 
        'エース': '#007BFF', 'イン': '#000000', 'アウト': '#ff4d4d', 'ネット': '#ff4d4d', 
        '決定': '#007BFF', 'Good': '#000000', 'ブロックシャット': '#ff4d4d',
        '成功': '#007BFF', 'ミス': '#ff4d4d',
        '失点': '#ff4d4d',
        'temp': '#FFFF00' 
    },
    DEFAULT_PLAYERS: {1:"1", 2:"2", 3:"3", 4:"4", 5:"5", 6:"6", 7:"7", 8:"8", 9:"9", 10:"10", 11:"11", 12:"12"},
    CANVAS: { width: 220, height: 440 },
    TYPES: ['serve', 'spike', 'serve_receive', 'receive', 'toss']
};

// ==========================================
// 2. 状態管理 (State)
// ==========================================
const AppState = {
    session: { id: "session_" + Date.now() },
    data: {
        players: { ...AppConfig.DEFAULT_PLAYERS },
        logs: [],
        activePlayerCount: 7,
        teams: []
    },
    ui: {
        currentTab: 'input',
        selectedPlayerId: null,
        statsPlayers: [],
        comparePlayers: [],
        pstatsPlayers: [],
        compareType: 'serve',
        isMultiSelect: false,
        isTeamAll: false,
        isLargeScreen: false,
        ownCourt: 'bottom'
    },
    settings: {
        preRoll: 6,         
        playDuration: 11    
    },
    input: { state: 'idle', start: null, end: null },
    filters: { serve: 'all', spike: 'all' },
    hoverFilters: { serve: null, spike: null },
    lockedZones: { serve: [], spike: [] },
    hoverZones: { serve: null, spike: null },
    video: { type: null, id: null, name: "", time: 0, seekDuration: 5, isRunning: false, ytPlayer: null },
    playlist: { active: false, type: null, queue: [], index: 0, timeout: null },
    videoHistory: []
};

// ==========================================
// 3. UI・タブ制御 (UI & Tabs Manager)
// ==========================================
function switchTab(target) {
    AppState.ui.currentTab = target;
    
    document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${target}`).classList.add('active');
    
    if(target !== 'rename' && target !== 'finish') {
        const tabBtn = document.getElementById(`tab-${target}`);
        if (tabBtn) tabBtn.classList.add('active');
    }

    const videoArea = document.getElementById('shared-video-area');
    const logArea = document.getElementById('shared-log-area');
    const splitLayout = document.getElementById('shared-split-layout');

    logArea.style.display = (target === 'input') ? 'flex' : 'none';
    
    if (target === 'input') {
        videoArea.style.display = 'flex';
        splitLayout.classList.remove('single-view');
        if (AppState.playlist.active) resetPlaylistUI(); 
    } else if (AppConfig.TYPES.includes(target)) {
        if (AppState.playlist.active && AppState.playlist.type === target) {
            videoArea.style.display = 'flex'; 
            splitLayout.classList.remove('single-view');
        } else {
            videoArea.style.display = 'none';
            splitLayout.classList.add('single-view');
            if (AppState.playlist.active) resetPlaylistUI();
            else pauseManualVideo();
        }
    } else {
        videoArea.style.display = 'none';
        splitLayout.classList.add('single-view');
        if (AppState.playlist.active) resetPlaylistUI();
        else pauseManualVideo();
    }
    
    if(['serve', 'spike'].includes(target)) drawStatsCanvas(target);
    
    if(target === 'compare') {
        document.getElementById('cmp-btn-serve').className = `action-btn cmp-mode-btn ${AppState.ui.compareType === 'serve' ? 'btn-ace' : 'btn-utility'}`;
        document.getElementById('cmp-btn-spike').className = `action-btn cmp-mode-btn ${AppState.ui.compareType === 'spike' ? 'btn-ace' : 'btn-utility'}`;
        
        const btnAll = document.getElementById('btn-compare-all');
        if(btnAll) {
            if(AppState.ui.comparePlayers.length === AppState.data.activePlayerCount && AppState.data.activePlayerCount > 0) {
                btnAll.innerHTML = '☐ 全解除'; btnAll.style.background = '#6c757d';
            } else {
                btnAll.innerHTML = '☑️ 一括表示'; btnAll.style.background = '#17a2b8';
            }
        }
        renderCompareVisual();
    }
    
    if(target === 'player-stats') {
        const pContainer = document.getElementById('player-stats-container');
        if(pContainer) pContainer.style.maxWidth = AppState.playlist.active ? '650px' : '1200px';
        renderPlayerStatsTable();
    }
    
    renderPlayerGrids();
}

function openSettings() { document.getElementById('settings-modal-overlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-modal-overlay').style.display = 'none'; }
function openFinishView() { switchTab('finish'); }
function goToCompare() { AppState.ui.compareType = (AppState.ui.currentTab === 'serve') ? 'serve' : 'spike'; switchTab('compare'); }

function toggleLargeScreen() {
    AppState.ui.isLargeScreen = !AppState.ui.isLargeScreen;
    const sourceUi = document.getElementById('video-source-ui');
    const splitLayout = document.getElementById('shared-split-layout');
    const btn = document.getElementById('btn-large-screen');
    const btnPlaylist = document.getElementById('btn-playlist-large-screen');

    if (AppState.ui.isLargeScreen) {
        if(sourceUi) sourceUi.style.display = 'none';
        splitLayout.style.maxWidth = '100%'; 
        if(btn) { btn.innerText = '🗗 縮小'; btn.style.background = '#ff9800'; }
        if(btnPlaylist) { btnPlaylist.innerText = '🗗 縮小'; btnPlaylist.style.background = '#ff9800'; }
    } else {
        if(sourceUi && !AppState.playlist.active) sourceUi.style.display = 'block';
        splitLayout.style.maxWidth = '1600px'; 
        if(btn) { btn.innerText = '🔲 大画面'; btn.style.background = '#17a2b8'; }
        if(btnPlaylist) { btnPlaylist.innerText = '🔲 大画面'; btnPlaylist.style.background = '#17a2b8'; }
    }
}

function toggleCourt() {
    AppState.ui.ownCourt = AppState.ui.ownCourt === 'bottom' ? 'top' : 'bottom';
    const btn = document.getElementById('btn-court-toggle');
    if(btn) {
        btn.innerHTML = AppState.ui.ownCourt === 'bottom' ? '🔄 自コート: 下側' : '🔄 自コート: 上側';
    }
    resetInput();
    draw('input-canvas');
}

function renderPlayerGrids() {
    let wrapperHeight = '66px'; let fontSize = '20px';     

    let totalButtons = AppState.data.activePlayerCount;
    if (AppState.data.activePlayerCount < 12) totalButtons++; 
    if (AppState.data.activePlayerCount > 1) totalButtons++;  

    if (totalButtons > 10) { wrapperHeight = '48px'; fontSize = '16px'; } 
    else if (totalButtons > 8) { wrapperHeight = '56px'; fontSize = '18px'; }

    // 色情報をローカルストレージから読み込み
    if (!AppState.data.playerColors) {
        AppState.data.playerColors = JSON.parse(localStorage.getItem('vlink_player_colors') || '{}');
    }

    ['input', 'serve', 'spike', 'compare'].forEach(type => {
        const container = document.getElementById(`player-grid-${type}`); if(!container) return;
        container.innerHTML = '';
        for(let i=1; i<=AppState.data.activePlayerCount; i++) {
            const wrapper = document.createElement('div');
            let currentWrapperHeight = wrapperHeight;
            let currentFontSize = fontSize;

            if (type === 'compare') {
                currentWrapperHeight = '46px';
                currentFontSize = '12px';
            }

            wrapper.style.height = currentWrapperHeight;
            let isActive = false, isCompareActive = false;

            if (type === 'input') isActive = (AppState.ui.selectedPlayerId == i);
            else if (type === 'compare') isCompareActive = AppState.ui.comparePlayers.includes(i);
            else isActive = AppState.ui.statsPlayers.includes(i);

            wrapper.className = `player-wrapper ${isActive ? 'active' : ''} ${isCompareActive ? 'compare-active' : ''}`;
            
            // ★ カスタム背景色を「常に」適用する（選択時も色はそのまま）
            if (AppState.data.playerColors[i]) {
                wrapper.style.background = AppState.data.playerColors[i];
            } else {
                wrapper.style.background = 'linear-gradient(135deg, #ffffff, #e6e9ec)';
            }

            const btn = document.createElement('button'); btn.className = `player-btn`;
            btn.onclick = () => selectPlayer(i);
            // ★ 選択時に文字が消えないよう、色は常に黒(#333)で固定
            btn.innerHTML = `<span style="font-size:${currentFontSize}; color:#333;">${AppState.data.players[i]}</span>`;
            wrapper.appendChild(btn);
            
            if (type === 'input') {
                // ★ 編集ボタンを「✏️」のみに変更
                const editBtn = document.createElement('div'); 
                editBtn.className = 'edit-single-btn';
                editBtn.innerHTML = '✏️'; 
                editBtn.onclick = (e) => editSingleName(e, i);
                wrapper.appendChild(editBtn);
            }
            container.appendChild(wrapper);
        }
        
        if (AppState.data.activePlayerCount < 12) {
            const addWrapper = document.createElement('div');
            addWrapper.className = 'player-wrapper player-add-btn';
            let currentWrapperHeight = (type === 'compare') ? '46px' : wrapperHeight;
            let currentFontSize = (type === 'compare') ? '12px' : fontSize;

            addWrapper.style.height = currentWrapperHeight;
            addWrapper.onclick = () => {
                AppState.data.activePlayerCount++;
                if (!AppState.data.players[AppState.data.activePlayerCount]) AppState.data.players[AppState.data.activePlayerCount] = String(AppState.data.activePlayerCount);
                saveToLocal(); renderPlayerGrids();
            };
            addWrapper.innerHTML = `<span style="font-size:${currentFontSize}; color:#333;">＋</span>`;
            container.appendChild(addWrapper);
        }
        
        if (AppState.data.activePlayerCount > 1) {
            const removeWrapper = document.createElement('div');
            removeWrapper.className = 'player-wrapper player-add-btn';
            let currentWrapperHeight = (type === 'compare') ? '46px' : wrapperHeight;

            removeWrapper.style.height = currentWrapperHeight; 
            removeWrapper.style.borderColor = '#dc3545';
            removeWrapper.onmouseover = () => removeWrapper.style.backgroundColor = '#fff5f5';
            removeWrapper.onmouseout = () => removeWrapper.style.backgroundColor = 'transparent';
            removeWrapper.onclick = () => {
                if(confirm(`No.${AppState.data.activePlayerCount} (${AppState.data.players[AppState.data.activePlayerCount]}) の選手枠を削除しますか？\n※記録済みのデータ自体は残りますが、選択できなくなります。`)) {
                    const removingId = AppState.data.activePlayerCount;
                    AppState.data.activePlayerCount--;
                    
                    if(AppState.ui.selectedPlayerId === removingId) {
                        AppState.ui.selectedPlayerId = null; resetInput(); draw('input-canvas');
                    }
                    AppState.ui.comparePlayers = AppState.ui.comparePlayers.filter(p => p !== removingId);
                    AppState.ui.pstatsPlayers = AppState.ui.pstatsPlayers.filter(p => p !== removingId);
                    AppState.ui.statsPlayers = AppState.ui.statsPlayers.filter(p => p !== removingId);
                    
                    if (AppState.data.playerColors && AppState.data.playerColors[removingId]) {
                        delete AppState.data.playerColors[removingId];
                        localStorage.setItem('vlink_player_colors', JSON.stringify(AppState.data.playerColors));
                    }
                    
                    saveToLocal(); renderPlayerGrids();
                    if(AppState.ui.currentTab === 'compare') renderCompareVisual();
                    if(AppState.ui.currentTab === 'player-stats') renderPlayerStatsTable();
                }
            };
            removeWrapper.innerHTML = `<span style="color:#dc3545; font-size:24px; font-weight:bold; pointer-events:none; margin-top:-2px;">－</span>`;
            container.appendChild(removeWrapper);
        }
    });
}

function selectPlayer(id) { 
    if (AppState.ui.currentTab === 'input') {
        if (AppState.ui.selectedPlayerId !== id) {
            AppState.ui.selectedPlayerId = id; 
            resetInput(); draw('input-canvas');
        }
    } 
    else if (AppState.ui.currentTab === 'compare') {
        if (AppState.ui.comparePlayers.includes(id)) {
            AppState.ui.comparePlayers = AppState.ui.comparePlayers.filter(p => p !== id); 
        } else {
            AppState.ui.comparePlayers.push(id);
        }
        
        const btnAll = document.getElementById('btn-compare-all');
        if(btnAll) {
            if(AppState.ui.comparePlayers.length === AppState.data.activePlayerCount) {
                btnAll.innerHTML = '☐ 全解除'; btnAll.style.background = '#6c757d';
            } else {
                btnAll.innerHTML = '☑️ 一括表示'; btnAll.style.background = '#17a2b8';
            }
        }
        renderCompareVisual();
    } else {
        if (AppState.ui.isTeamAll) {
            AppState.ui.isTeamAll = false;
            document.querySelectorAll('.btn-team-all').forEach(b => { b.innerHTML = '👨‍👩‍👦 チーム全体表示：OFF'; b.style.background = '#28a745'; });
        }

        if (AppState.ui.isMultiSelect) {
            if (AppState.ui.statsPlayers.includes(id)) AppState.ui.statsPlayers = AppState.ui.statsPlayers.filter(p => p !== id);
            else AppState.ui.statsPlayers.push(id);
        } else {
            if (AppState.ui.statsPlayers.length === 1 && AppState.ui.statsPlayers[0] === id) AppState.ui.statsPlayers = []; 
            else AppState.ui.statsPlayers = [id]; 
        }
        
        AppConfig.TYPES.forEach(t => { 
            if(AppState.filters[t]) AppState.filters[t] = 'all'; 
            if(AppState.lockedZones[t]) AppState.lockedZones[t] = []; 
            updateZoneClasses(t); 
        });
        if (['serve', 'spike'].includes(AppState.ui.currentTab)) { drawStatsCanvas(AppState.ui.currentTab); updateDynamicPlaylist(); }
    }
    renderPlayerGrids(); 
}

function toggleAllCompare() {
    const btnAll = document.getElementById('btn-compare-all');
    if (AppState.ui.comparePlayers.length === AppState.data.activePlayerCount) {
        AppState.ui.comparePlayers = [];
        if(btnAll) { btnAll.innerHTML = '☑️ 一括表示'; btnAll.style.background = '#17a2b8'; }
    } else {
        AppState.ui.comparePlayers = Array.from({length: AppState.data.activePlayerCount}, (_, i) => i + 1);
        if(btnAll) { btnAll.innerHTML = '☐ 全解除'; btnAll.style.background = '#6c757d'; }
    }
    renderPlayerGrids();
    renderCompareVisual();
}

function toggleAllTeam() {
    AppState.ui.isTeamAll = !AppState.ui.isTeamAll;
    const btns = document.querySelectorAll('.btn-team-all');
    if (AppState.ui.isTeamAll) {
        AppState.ui.statsPlayers = Array.from({length: AppState.data.activePlayerCount}, (_, i) => i + 1);
        btns.forEach(b => { b.innerHTML = '☑️ チーム全体表示：ON'; b.style.background = '#17a2b8'; });
    } else {
        AppState.ui.statsPlayers = [];
        btns.forEach(b => { b.innerHTML = '👨‍👩‍👦 チーム全体表示：OFF'; b.style.background = '#28a745'; });
    }
    AppConfig.TYPES.forEach(t => { if(AppState.filters[t]) AppState.filters[t] = 'all'; if(AppState.lockedZones[t]) AppState.lockedZones[t] = []; updateZoneClasses(t); });
    
    if (['serve', 'spike'].includes(AppState.ui.currentTab)) { drawStatsCanvas(AppState.ui.currentTab); updateDynamicPlaylist(); }
    renderPlayerGrids();
}

function toggleMultiSelect() {
    AppState.ui.isMultiSelect = !AppState.ui.isMultiSelect;
    const btnServe = document.getElementById('btn-multi-serve'); const btnSpike = document.getElementById('btn-multi-spike');
    
    if (AppState.ui.isMultiSelect) {
        if(btnServe) { btnServe.innerHTML = '☑️ 複数選択：ON'; btnServe.style.background = '#17a2b8'; }
        if(btnSpike) { btnSpike.innerHTML = '☑️ 複数選択：ON'; btnSpike.style.background = '#17a2b8'; }
    } else {
        if(btnServe) { btnServe.innerHTML = '✅ 複数選択：OFF'; btnServe.style.background = '#6c757d'; }
        if(btnSpike) { btnSpike.innerHTML = '✅ 複数選択：OFF'; btnSpike.style.background = '#6c757d'; }
        
        if (AppState.ui.statsPlayers.length > 1) {
            AppState.ui.statsPlayers = [AppState.ui.statsPlayers[AppState.ui.statsPlayers.length - 1]];
            AppConfig.TYPES.forEach(t => { if(AppState.lockedZones[t]) AppState.lockedZones[t] = []; updateZoneClasses(t); });
            
            if(['serve', 'spike'].includes(AppState.ui.currentTab)) { drawStatsCanvas(AppState.ui.currentTab); updateDynamicPlaylist(); }
            renderPlayerGrids();
        }
    }
}

// ==========================================
// 4. 分析・フィルタ・Canvas描画制御 (Analytics Manager)
// ==========================================
const canvasContexts = {};
function getCanvasContext(id) {
    const cv = document.getElementById(id);
    if (!cv) return null;

    if (id.startsWith('cmp-canvas-')) {
        const ct = cv.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        cv.width = AppConfig.CANVAS.width * dpr; cv.height = AppConfig.CANVAS.height * dpr;
        cv.style.width = AppConfig.CANVAS.width + 'px'; cv.style.height = AppConfig.CANVAS.height + 'px';
        ct.setTransform(dpr, 0, 0, dpr, 0, 0);
        return ct;
    }

    if (!canvasContexts[id]) {
        const ct = cv.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        cv.width = AppConfig.CANVAS.width * dpr; cv.height = AppConfig.CANVAS.height * dpr;
        cv.style.width = AppConfig.CANVAS.width + 'px'; cv.style.height = AppConfig.CANVAS.height + 'px';
        ct.setTransform(dpr, 0, 0, dpr, 0, 0);
        canvasContexts[id] = { cv, ct };
    }
    return canvasContexts[id].ct;
}

function getColorForLog(result) {
    if (AppConfig.COLORS[result]) return AppConfig.COLORS[result];
    if (result.includes('成功')) return '#007BFF';
    if (result.includes('ミス') || result.includes('失点')) return '#ff4d4d';
    return '#000000'; 
}

function draw(id) {
    const ct = getCanvasContext(id); 
    if (!ct) return;
    ct.clearRect(0,0,AppConfig.CANVAS.width, AppConfig.CANVAS.height); 
    
    ct.fillStyle = '#e8a365'; 
    ct.fillRect(20,60,180,360); 

    if (id === 'input-canvas') {
        ct.fillStyle = '#5c5c5c';
        if (AppState.ui.ownCourt === 'bottom') {
            ct.fillRect(20, 60, 180, 180); 
        } else {
            ct.fillRect(20, 240, 180, 180); 
        }
    }

    ct.strokeStyle = 'white'; ct.lineWidth = 2; ct.strokeRect(20,60,180,360);
    ct.beginPath(); ct.moveTo(20,180); ct.lineTo(200,180); ct.moveTo(20,300); ct.lineTo(200,300); ct.stroke();

    // ★ センターライン（白の実線のみ）
    ct.strokeStyle = 'white'; ct.lineWidth = 4; ct.beginPath(); ct.moveTo(20,240); ct.lineTo(200,240); ct.stroke();
    
    if (id === 'input-canvas') {
        ct.fillStyle = 'rgba(255,255,255,0.7)';
        ct.font = 'bold 18px sans-serif';
        ct.textAlign = 'center';
        if (AppState.ui.ownCourt === 'bottom') {
            ct.fillText('自コート', 110, 340);
            ct.fillText('相手コート', 110, 160);
        } else {
            ct.fillText('自コート', 110, 160);
            ct.fillText('相手コート', 110, 340);
        }
    }
    
    if (id === 'input-canvas') {
        if (AppState.input.start) dot(ct, AppState.input.start.x, AppState.input.start.y, 3.5, AppConfig.COLORS['temp']); 
        if (AppState.input.start && AppState.input.end) line(ct, AppState.input.start, AppState.input.end, AppConfig.COLORS['temp']);
    } else if (id === 'serve-canvas' || id === 'spike-canvas') {
        const type = id === 'serve-canvas' ? 'serve' : 'spike';
        const sFilter = AppState.filters[type];
        const hFilter = AppState.hoverFilters[type];
        const lZones = AppState.lockedZones[type] || [];
        const hZone = AppState.hoverZones[type];

        let mainLogs = [];
        let thinLogs = [];

        if (lZones.length === 0) {
            mainLogs = getFilteredLogs(type, sFilter, []);
        } else {
            mainLogs = getFilteredLogs(type, sFilter, lZones);

            if (hZone && !lZones.some(z => z.x === hZone.x && z.y === hZone.y)) {
                thinLogs = getFilteredLogs(type, sFilter, [hZone]);
            }
        }

        if (thinLogs.length > 0) {
            ct.globalAlpha = 0.25; 
            thinLogs.forEach(l => { if (l.startX != null && l.startY != null) line(ct, {x:l.startX, y:l.startY}, {x:l.endX, y:l.endY}, getColorForLog(l.result)); });
        }

        ct.globalAlpha = 1.0; 
        if (mainLogs.length > 0) {
            mainLogs.forEach(l => { if (l.startX != null && l.startY != null) line(ct, {x:l.startX, y:l.startY}, {x:l.endX, y:l.endY}, getColorForLog(l.result)); });
        }

        if (hFilter !== null && hFilter !== sFilter) {
            let activeZones = lZones.length > 0 ? lZones : [];
            let filterPreviewLogs = getFilteredLogs(type, hFilter, activeZones);
            let previewOnlyLogs = filterPreviewLogs.filter(pl => !mainLogs.some(ml => ml.id === pl.id));
            
            ct.globalAlpha = 0.25; 
            previewOnlyLogs.forEach(l => { if (l.startX != null && l.startY != null) line(ct, {x:l.startX, y:l.startY}, {x:l.endX, y:l.endY}, getColorForLog(l.result)); });
            ct.globalAlpha = 1.0;
        }
    }
}

function line(ct, p1, p2, c) { ct.beginPath(); ct.moveTo(p1.x, p1.y); ct.lineTo(p2.x, p2.y); ct.strokeStyle = c; ct.lineWidth = 2; ct.stroke(); dot(ct, p1.x, p1.y, 3.5, c); dot(ct, p2.x, p2.y, 3.5, c); }
function dot(ct, x, y, r, c) { ct.beginPath(); ct.arc(x,y,r,0,Math.PI*2); ct.fillStyle=c; ct.fill(); ct.strokeStyle = (c === '#FFFF00') ? '#333' : 'white'; ct.stroke(); }

function getFilteredLogs(type, targetFilter, zones) {
    let logs = AppState.data.logs.filter(l => AppState.ui.statsPlayers.includes(l.playerId) && l.type === type);
    if (zones && zones.length > 0) logs = logs.filter(l => zones.some(z => isLogInZone(l, z)));

    if (targetFilter && targetFilter !== 'all') {
        logs = logs.filter(l => {
            if (type === 'serve') {
                if (targetFilter === 'in') return l.result === 'イン' || l.result === 'エース';
                if (targetFilter === 'miss') return l.result === 'アウト' || l.result === 'ネット';
                if (targetFilter === 'ace') return l.result === 'エース';
            } else if (type === 'spike') {
                if (targetFilter === 'in') return l.result === 'Good' || l.result === '決定';
                if (targetFilter === 'miss') return ['アウト', 'ネット', 'ブロックシャット'].includes(l.result);
                if (targetFilter === 'ace') return l.result === '決定';
            }
            return true;
        });
    }
    return logs;
}

function isLogInZone(log, z) {
    if (log.startX == null) return false;
    
    if (log.type === 'serve') {
        let xIndex = Math.floor((Math.max(20, Math.min(log.startX, 199.9)) - 20) / 60);
        return xIndex === z.x;
    } else if (log.type === 'spike') {
        let correctedX = log.startX;
        if (correctedX === 40) correctedX = 50; 
        if (correctedX === 180) correctedX = 170;
        
        let xIndex = Math.floor((Math.max(20, Math.min(correctedX, 199.9)) - 20) / 60);
        let yIndex = Math.floor((Math.max(240, Math.min(log.startY, 419.9)) - 240) / 60);
        return xIndex === z.x && yIndex === z.y;
    }
    return false;
}

function drawStatsCanvas(type) {
    document.querySelectorAll(`#view-${type} .clickable-stat`).forEach(el => el.classList.remove('active-filter'));
    const activeEl = document.getElementById(`filter-${type}-${AppState.filters[type]}`); 
    if(activeEl) activeEl.classList.add('active-filter');
    
    draw(type + '-canvas');
    
    let statZones = AppState.lockedZones[type].length > 0 ? AppState.lockedZones[type] : (AppState.hoverZones[type] ? [AppState.hoverZones[type]] : []);
    updateStatsUI(type, getFilteredLogs(type, 'all', statZones));
}

function setStatFilter(type, filter) { 
    AppState.filters[type] = (AppState.filters[type] === filter) ? 'all' : filter;
    
    AppState.lockedZones[type] = []; 
    updateZoneClasses(type);

    drawStatsCanvas(type); 
    updateDynamicPlaylist(); 
}

function setHoverFilter(type, filter) {
    AppState.hoverFilters[type] = filter; 
    draw(type + '-canvas');
}
function clearHoverFilter(type) {
    AppState.hoverFilters[type] = null; 
    draw(type + '-canvas');
}

function setZoneHover(type, x, y) {
    AppState.hoverZones[type] = {x, y};
    if(AppState.ui.currentTab === type) drawStatsCanvas(type);
}
function clearZoneHover(type) {
    AppState.hoverZones[type] = null;
    if(AppState.ui.currentTab === type) drawStatsCanvas(type);
}

function toggleZoneLock(type, x, y) {
    let lockedZones = AppState.lockedZones[type];
    if(!lockedZones) return;
    
    let index = lockedZones.findIndex(z => z.x === x && z.y === y);
    
    if (index > -1) {
        lockedZones.splice(index, 1);
    } else {
        lockedZones.push({x, y});
    }
    
    updateZoneClasses(type);
    drawStatsCanvas(type);
    updateDynamicPlaylist(); 
}

function updateZoneClasses(type) {
    let lockedZones = AppState.lockedZones[type];
    if(!lockedZones) return;
    for(let x=0; x<3; x++) {
        for(let y=0; y<3; y++) {
            let el = document.getElementById(`zone-${type}-${x}-${y}`); if(!el) continue;
            if(lockedZones.some(z => z.x === x && z.y === y)) el.classList.add('locked'); else el.classList.remove('locked');
        }
    }
}

function updateStatsUI(type, logs) {
    const tot = logs.length; let ace, goodOrIn, miss;
    if (type === 'serve') {
        ace = logs.filter(l => l.result === 'エース').length; goodOrIn = logs.filter(l => l.result === 'イン').length; miss = logs.filter(l => l.result === 'アウト' || l.result === 'ネット').length;
    } else if (type === 'spike') {
        ace = logs.filter(l => l.result === '決定').length; goodOrIn = logs.filter(l => l.result === 'Good').length; miss = logs.filter(l => ['アウト', 'ネット', 'ブロックシャット'].includes(l.result)).length;
    } else return;
    
    const totalIn = ace + goodOrIn, rate = (v) => tot === 0 ? "0%" : Math.round((v/tot)*100) + "%";
    const p = type === 'serve' ? 'st' : 'sp', pie = type === 'serve' ? '' : '-sp';

    document.getElementById(`${p}-total`).innerText = tot; document.getElementById(`${p}-in`).innerText = totalIn; document.getElementById(`${p}-in-rate`).innerText = rate(totalIn);
    document.getElementById(`${p}-miss`).innerText = miss; document.getElementById(`${p}-miss-rate`).innerText = rate(miss); document.getElementById(`${p}-ace-chart-val`).innerText = ace; document.getElementById(`${p}-ace-chart-rate`).innerText = rate(ace);

    const chart = document.getElementById(`pie-chart${pie}`); const labelsContainer = document.getElementById(`pie-labels${pie}`); labelsContainer.innerHTML = ''; document.getElementById(`pie-total-val${pie}`).innerText = tot + "本";

    if (tot === 0) chart.style.backgroundImage = "conic-gradient(#eee 0% 100%)";
    else {
        const pIn = (totalIn / tot) * 100; chart.style.backgroundImage = `conic-gradient(#000000 0% ${pIn}%, #ff4d4d ${pIn}% 100%)`;
        const addLabel = (count, startPct, endPct) => { 
            if (count === 0) return; const midAngle = (startPct + endPct) / 2 * 3.6; const centerX = 60, centerY = 60, r = 42;
            const x = centerX + r * Math.sin(midAngle * Math.PI / 180), y = centerY - r * Math.cos(midAngle * Math.PI / 180); 
            const span = document.createElement('span'); span.className = 'pie-label'; span.style.left = x + 'px'; span.style.top = y + 'px'; span.innerText = count; labelsContainer.appendChild(span); 
        };
        addLabel(totalIn, 0, pIn); addLabel(miss, pIn, 100); 
    }
}

function clearStatsDOM() {
    draw('serve-canvas'); draw('spike-canvas');
    document.getElementById('st-total').innerText = '0'; document.getElementById('st-in').innerText = '0'; document.getElementById('st-in-rate').innerText = '0%';
    document.getElementById('st-miss').innerText = '0'; document.getElementById('st-miss-rate').innerText = '0%'; document.getElementById('st-ace-chart-val').innerText = '0'; document.getElementById('st-ace-chart-rate').innerText = '0%';
    document.getElementById('pie-total-val').innerText = '0本'; document.getElementById('pie-labels').innerHTML = ''; document.getElementById('pie-chart').style.backgroundImage = "conic-gradient(#eee 0% 100%)";
    document.getElementById('sp-total').innerText = '0'; document.getElementById('sp-in').innerText = '0'; document.getElementById('sp-in-rate').innerText = '0%';
    document.getElementById('sp-miss').innerText = '0'; document.getElementById('sp-miss-rate').innerText = '0%'; document.getElementById('sp-ace-chart-val').innerText = '0'; document.getElementById('sp-ace-chart-rate').innerText = '0%';
    document.getElementById('pie-total-val-sp').innerText = '0本'; document.getElementById('pie-labels-sp').innerHTML = ''; document.getElementById('pie-chart-sp').style.backgroundImage = "conic-gradient(#eee 0% 100%)";
    document.getElementById('compare-cards-container').innerHTML = '';
    
    const pStatsBody = document.getElementById('player-stats-tbody');
    if (pStatsBody) pStatsBody.innerHTML = '';
}

function setCompareType(type) {
    AppState.ui.compareType = type;
    document.getElementById('cmp-btn-serve').className = `action-btn cmp-mode-btn ${type === 'serve' ? 'btn-ace' : 'btn-utility'}`;
    document.getElementById('cmp-btn-spike').className = `action-btn cmp-mode-btn ${type === 'spike' ? 'btn-ace' : 'btn-utility'}`;
    renderCompareVisual();
}

function renderCompareVisual() {
    const container = document.getElementById('compare-cards-container');
    container.innerHTML = (AppState.ui.comparePlayers.length === 0) ? '<p style="margin-top:20px; color:#666; font-size:12px; text-align:center; width:100%;">上のリストから比較する選手を選択、または「一括表示」を押してください</p>' : '';
    AppState.ui.comparePlayers.forEach(pid => {
        let logs = AppState.data.logs.filter(l => l.playerId === pid && l.type === AppState.ui.compareType);
        const tot = logs.length; let aceOrDecide = logs.filter(l => l.result === (AppState.ui.compareType === 'serve' ? 'エース' : '決定')).length; let goodOrIn = logs.filter(l => l.result === (AppState.ui.compareType === 'serve' ? 'イン' : 'Good')).length; let miss = logs.filter(l => AppState.ui.compareType === 'serve' ? (l.result === 'アウト' || l.result === 'ネット') : ['アウト', 'ネット', 'ブロックシャット'].includes(l.result)).length;
        const rate = (v) => tot === 0 ? "0%" : Math.round((v/tot)*100) + "%";
        const card = document.createElement('div'); card.className = 'compare-card';
        card.innerHTML = `<div style="font-weight:bold; margin-bottom:4px; font-size:14px; text-align:center; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${AppState.data.players[pid]}</div><canvas id="cmp-canvas-${pid}" class="compare-canvas"></canvas><table class="compare-table"><tbody><tr><td style="text-align:left;">Total</td><td colspan="2">${tot}</td></tr><tr class="row-in"><td style="text-align:left;">${AppState.ui.compareType === 'serve' ? 'イン' : 'Good'}</td><td>${goodOrIn}</td><td>${rate(goodOrIn)}</td></tr><tr class="row-miss"><td style="text-align:left;">ミス</td><td>${miss}</td><td>${rate(miss)}</td></tr><tr class="row-ace"><td style="text-align:left;">${AppState.ui.compareType === 'serve' ? 'エース' : '決定'}</td><td>${aceOrDecide}</td><td>${rate(aceOrDecide)}</td></tr></tbody></table>`;
        container.appendChild(card);
        
        const ct = getCanvasContext(`cmp-canvas-${pid}`);
        if (!ct) return;
        ct.clearRect(0,0,AppConfig.CANVAS.width, AppConfig.CANVAS.height);
        
        ct.fillStyle = '#e8a365'; ct.fillRect(20,60,180,360); 
        
        ct.strokeStyle = 'white'; ct.lineWidth = 2; ct.strokeRect(20,60,180,360);
        ct.beginPath(); ct.moveTo(20,180); ct.lineTo(200,180); ct.moveTo(20,300); ct.lineTo(200,300); ct.stroke();

        // ★ 比較画面のセンターライン（白の実線のみ）
        ct.strokeStyle = 'white'; ct.lineWidth = 4; ct.beginPath(); ct.moveTo(20,240); ct.lineTo(200,240); ct.stroke();
        
        logs.forEach(l => { if (l.startX != null && l.startY != null) line(ct, {x:l.startX, y:l.startY}, {x:l.endX, y:l.endY}, getColorForLog(l.result)); });
    });
}

function renderPlayerStatsTable() {
    const tbody = document.getElementById('player-stats-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let activePlayerIds = [...new Set(AppState.data.logs.map(l => l.playerId))];
    activePlayerIds.sort((a, b) => parseInt(a) - parseInt(b));

    if (activePlayerIds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="16" style="padding: 20px; color: #666; text-align:center;">記録されたデータがありません</td></tr>';
        return;
    }

    let tSrvTot = 0, tSrvAce = 0, tSrvMiss = 0;
    let tSpkTot = 0, tSpkDec = 0, tSpkMiss = 0;
    let tSrTot = 0, tSrSuc = 0, tSrMiss = 0;
    let tRecTot = 0, tRecSuc = 0, tRecMiss = 0;
    let tTsTot = 0, tTsSuc = 0, tTsMiss = 0;

    activePlayerIds.forEach(pid => {
        const pLogs = AppState.data.logs.filter(l => l.playerId == pid);
        
        const srvLogs = pLogs.filter(l => l.type === 'serve');
        const srvTot = srvLogs.length;
        const srvAce = srvLogs.filter(l => l.result === 'エース').length;
        const srvMiss = srvLogs.filter(l => l.result === 'アウト' || l.result === 'ネット').length;
        
        const spkLogs = pLogs.filter(l => l.type === 'spike');
        const spkTot = spkLogs.length;
        const spkDec = spkLogs.filter(l => l.result === '決定').length;
        const spkMiss = spkLogs.filter(l => ['アウト', 'ネット', 'ブロックシャット'].includes(l.result)).length;
        
        const srLogs = pLogs.filter(l => l.type === 'serve_receive');
        const srTot = srLogs.length;
        const srSuc = srLogs.filter(l => l.result === '成功').length;
        const srMiss = srLogs.filter(l => l.result === 'ミス').length;
        
        const recLogs = pLogs.filter(l => l.type === 'receive');
        const recTot = recLogs.length;
        const recSuc = recLogs.filter(l => l.result === '成功').length;
        const recMiss = recLogs.filter(l => l.result === 'ミス').length;
        
        const tsLogs = pLogs.filter(l => l.type === 'toss');
        const tsTot = tsLogs.length;
        const tsSuc = tsLogs.filter(l => ['レフト', 'センター', 'ライト', '２アタック', 'クイック'].includes(l.result)).length;
        const tsMiss = tsLogs.filter(l => l.result === 'ミス' || l.result === '失点').length; 

        tSrvTot += srvTot; tSrvAce += srvAce; tSrvMiss += srvMiss;
        tSpkTot += spkTot; tSpkDec += spkDec; tSpkMiss += spkMiss;
        tSrTot += srTot; tSrSuc += srSuc; tSrMiss += srMiss;
        tRecTot += recTot; tRecSuc += recSuc; tRecMiss += recMiss;
        tTsTot += tsTot; tTsSuc += tsSuc; tTsMiss += tsMiss;

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f0f0f0';
        const tdCls = 'clickable-cell';
        const tdStyle = "padding: 8px 2px; height: 35px; font-size: 14px; white-space: nowrap; text-align: center;";
        const nameStyle = "font-weight:bold; background:#f8f9fa; border-right: 1px solid #ddd; padding: 8px 2px; height: 35px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center;";
        
        const pName = AppState.data.players[pid] || pid;

        tr.innerHTML = `
            <td class="${tdCls}" style="${nameStyle}" onclick="playFilteredLogs(${pid}, 'all', 'all')" title="クリックでこの選手の全プレーを再生">${pName}</td>
            <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs(${pid}, 'serve', 'all')" title="クリックで再生">${srvTot}</td>
            <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs(${pid}, 'serve', 'エース')" title="クリックで再生">${srvAce}</td>
            <td class="${tdCls}" style="${tdStyle} color:#dc3545; border-right: 1px solid #ddd;" onclick="playFilteredLogs(${pid}, 'serve', 'serve_miss')" title="クリックで再生">${srvMiss}</td>
            
            <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs(${pid}, 'spike', 'all')" title="クリックで再生">${spkTot}</td>
            <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs(${pid}, 'spike', '決定')" title="クリックで再生">${spkDec}</td>
            <td class="${tdCls}" style="${tdStyle} color:#dc3545; border-right: 1px solid #ddd;" onclick="playFilteredLogs(${pid}, 'spike', 'spike_miss')" title="クリックで再生">${spkMiss}</td>
            
            <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs(${pid}, 'serve_receive', 'all')" title="クリックで再生">${srTot}</td>
            <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs(${pid}, 'serve_receive', '成功')" title="クリックで再生">${srSuc}</td>
            <td class="${tdCls}" style="${tdStyle} color:#dc3545; border-right: 1px solid #ddd;" onclick="playFilteredLogs(${pid}, 'serve_receive', 'ミス')" title="クリックで再生">${srMiss}</td>
            
            <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs(${pid}, 'receive', 'all')" title="クリックで再生">${recTot}</td>
            <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs(${pid}, 'receive', '成功')" title="クリックで再生">${recSuc}</td>
            <td class="${tdCls}" style="${tdStyle} color:#dc3545; border-right: 1px solid #ddd;" onclick="playFilteredLogs(${pid}, 'receive', 'ミス')" title="クリックで再生">${recMiss}</td>
            
            <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs(${pid}, 'toss', 'all')" title="クリックで再生">${tsTot}</td>
            <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs(${pid}, 'toss', 'toss_suc')" title="クリックで再生">${tsSuc}</td>
            <td class="${tdCls}" style="${tdStyle} color:#dc3545;" onclick="playFilteredLogs(${pid}, 'toss', 'toss_miss')" title="クリックで再生">${tsMiss}</td>
        `;
        tbody.appendChild(tr);
    });

    const teamTr = document.createElement('tr');
    teamTr.style.background = '#e9ecef';
    teamTr.style.borderTop = '2px solid #ccc';
    const tdCls = 'clickable-cell';
    const tdStyle = "padding: 8px 2px; height: 35px; font-size: 14px; white-space: nowrap; text-align: center;";
    const nameStyle = "font-weight:bold; border-right: 1px solid #ddd; padding: 8px 2px; height: 35px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center;";
    
    teamTr.innerHTML = `
        <td class="${tdCls}" style="${nameStyle}" onclick="playFilteredLogs('all', 'all', 'all')" title="クリックでチーム全体の全プレーを再生">チーム</td>
        <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs('all', 'serve', 'all')" title="クリックで再生">${tSrvTot}</td>
        <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs('all', 'serve', 'エース')" title="クリックで再生">${tSrvAce}</td>
        <td class="${tdCls}" style="${tdStyle} color:#dc3545; border-right: 1px solid #ddd;" onclick="playFilteredLogs('all', 'serve', 'serve_miss')" title="クリックで再生">${tSrvMiss}</td>
        
        <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs('all', 'spike', 'all')" title="クリックで再生">${tSpkTot}</td>
        <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs('all', 'spike', '決定')" title="クリックで再生">${tSpkDec}</td>
        <td class="${tdCls}" style="${tdStyle} color:#dc3545; border-right: 1px solid #ddd;" onclick="playFilteredLogs('all', 'spike', 'spike_miss')" title="クリックで再生">${tSpkMiss}</td>
        
        <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs('all', 'serve_receive', 'all')" title="クリックで再生">${tSrTot}</td>
        <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs('all', 'serve_receive', '成功')" title="クリックで再生">${tSrSuc}</td>
        <td class="${tdCls}" style="${tdStyle} color:#dc3545; border-right: 1px solid #ddd;" onclick="playFilteredLogs('all', 'serve_receive', 'ミス')" title="クリックで再生">${tSrMiss}</td>
        
        <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs('all', 'receive', 'all')" title="クリックで再生">${tRecTot}</td>
        <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs('all', 'receive', '成功')" title="クリックで再生">${tRecSuc}</td>
        <td class="${tdCls}" style="${tdStyle} color:#dc3545; border-right: 1px solid #ddd;" onclick="playFilteredLogs('all', 'receive', 'ミス')" title="クリックで再生">${tRecMiss}</td>
        
        <td class="${tdCls}" style="${tdStyle}" onclick="playFilteredLogs('all', 'toss', 'all')" title="クリックで再生">${tTsTot}</td>
        <td class="${tdCls}" style="${tdStyle} color:#007BFF; font-weight:bold;" onclick="playFilteredLogs('all', 'toss', 'toss_suc')" title="クリックで再生">${tTsSuc}</td>
        <td class="${tdCls}" style="${tdStyle} color:#dc3545;" onclick="playFilteredLogs('all', 'toss', 'toss_miss')" title="クリックで再生">${tTsMiss}</td>
    `;
    tbody.appendChild(teamTr);
}

// ==========================================
// 5. データ入力管理 (Input Manager)
// ==========================================

function resetInput() { 
    AppState.input.state = 'idle'; AppState.input.start = null; AppState.input.end = null; 
    
    const hasPlayer = AppState.ui.selectedPlayerId !== null;
    document.querySelectorAll('.serve-action-btn, .spike-action-btn').forEach(b => b.disabled = !hasPlayer); 
    document.querySelectorAll('.direct-btn, .toss-btn').forEach(b => b.disabled = !hasPlayer);
}

function handleCourtClick(e) {
    if (!AppState.ui.selectedPlayerId) return;
    const cv = document.getElementById('input-canvas'); const r = cv.getBoundingClientRect();
    const x = Math.round(e.clientX - r.left), y = Math.round(e.clientY - r.top);
    
    if (AppState.input.state === 'idle') { 
        AppState.input.start = {x, y}; 
        AppState.input.state = 'waiting'; 
    } else if (AppState.input.state === 'waiting') { 
        AppState.input.end = {x, y}; 
        AppState.input.state = 'ready'; 
    }
    
    if (AppState.input.start) {
        let isServe = false;
        if (AppState.ui.ownCourt === 'bottom') isServe = AppState.input.start.y >= 400;
        else isServe = AppState.input.start.y <= 80;

        document.querySelectorAll('.serve-action-btn').forEach(b => b.disabled = !isServe);
        document.querySelectorAll('.spike-action-btn').forEach(b => b.disabled = isServe);
        
        document.querySelectorAll('.direct-btn, .toss-btn').forEach(b => b.disabled = true);
    }
    
    draw('input-canvas');
}

function cancelCurrentInput() {
    if (AppState.input.state === 'ready') {
        AppState.input.end = null; AppState.input.state = 'waiting';
        if (AppState.input.start) {
            let isServe = false;
            if (AppState.ui.ownCourt === 'bottom') isServe = AppState.input.start.y >= 400;
            else isServe = AppState.input.start.y <= 80;

            document.querySelectorAll('.serve-action-btn').forEach(b => b.disabled = !isServe);
            document.querySelectorAll('.spike-action-btn').forEach(b => b.disabled = isServe);
            document.querySelectorAll('.direct-btn, .toss-btn').forEach(b => b.disabled = true);
        }
        draw('input-canvas');
    } else if (AppState.input.state === 'waiting') {
        resetInput(); draw('input-canvas');
    } else {
        resetInput();
    }
}

let pendingSpikeResult = null;

function showSpikePositionModal(result) {
    pendingSpikeResult = result;
    document.getElementById('spike-pos-modal-overlay').style.display = 'flex';
}

function selectSpikePos(pos) {
    document.getElementById('spike-pos-modal-overlay').style.display = 'none';
    finalizeSaveAction('spike', pendingSpikeResult, null, null, null, null, pos);
    pendingSpikeResult = null;
}

function cancelSpikePos() {
    document.getElementById('spike-pos-modal-overlay').style.display = 'none';
    pendingSpikeResult = null;
}

function normalizePt(pt) {
    if (!pt) return null;
    if (AppState.ui.ownCourt === 'top') {
        return { x: 220 - pt.x, y: 480 - pt.y };
    }
    return pt;
}

function saveAction(type, result) {
    if (!AppState.ui.selectedPlayerId) return;
    
    let finalX = null, finalY = null, endX = null, endY = null;
    let attackPos = null;

    if (AppState.input.start) {
        let normStart = normalizePt(AppState.input.start);
        let normEnd = AppState.input.end ? normalizePt(AppState.input.end) : normStart;

        finalX = normStart.x; finalY = normStart.y;
        endX = normEnd.x; endY = normEnd.y;
        
        if (type === 'serve') {
            let zoneIndex = Math.floor((Math.max(20, Math.min(finalX, 199.9)) - 20) / 60); finalX = 20 + (zoneIndex * 60) + 30; finalY = 420; 
        } else if (type === 'spike') {
            let xIndex = Math.floor((Math.max(20, Math.min(finalX, 199.9)) - 20) / 60);
            let yIndex = Math.floor((Math.max(240, Math.min(finalY, 419.9)) - 240) / 60); 
            finalX = 20 + (xIndex * 60) + 30; finalY = 240 + (yIndex * 60) + 30 - 10;
            if (xIndex === 0 && (yIndex === 0 || yIndex === 1)) finalX -= 10; 
            if (xIndex === 2 && (yIndex === 0 || yIndex === 1)) finalX += 10; 

            if (yIndex > 0) attackPos = "バックアタック";
            else if (xIndex === 0) attackPos = "レフト";
            else if (xIndex === 1) attackPos = "センター";
            else if (xIndex === 2) attackPos = "ライト";
        }
    } else {
        if (type === 'spike') {
            showSpikePositionModal(result);
            return;
        }
    }
    
    finalizeSaveAction(type, result, finalX, finalY, endX, endY, attackPos);
}

function finalizeSaveAction(type, result, startX, startY, endX, endY, attackPos) {
    AppState.data.logs.push({ 
        id: Date.now(), 
        sessionId: AppState.session.id, 
        playerId: AppState.ui.selectedPlayerId, 
        type: type, 
        result: result, 
        startX: startX, 
        startY: startY, 
        endX: endX, 
        endY: endY, 
        attackPos: attackPos, 
        time: new Date().toLocaleString(), 
        videoTime: formatTime(AppState.video.time) 
    });
    resetInput(); saveToLocal(); updateLog(); draw('input-canvas');
}

function saveDirectAction(type, result) {
    if (!AppState.ui.selectedPlayerId) return;
    
    AppState.data.logs.push({ 
        id: Date.now(), sessionId: AppState.session.id, playerId: AppState.ui.selectedPlayerId, 
        type: type, result: result, startX: null, startY: null, endX: null, endY: null, 
        time: new Date().toLocaleString(), videoTime: formatTime(AppState.video.time) 
    });
    resetInput(); saveToLocal(); updateLog(); draw('input-canvas');
}

function updateLog() { 
    const container = document.getElementById('log-container');
    const displayLogs = [...AppState.data.logs].reverse();
    container.innerHTML = displayLogs.map(l => {
        let resClass = 'res-in';
        if (l.result.includes('成功') || l.result === 'エース' || l.result === '決定') resClass = 'res-ace';
        else if (l.result.includes('ミス') || l.result === 'アウト' || l.result === 'ネット' || l.result === 'ブロックシャット' || l.result === '失点') resClass = 'res-err';

        let timeStr = l.videoTime ? `<span class="log-time">[${l.videoTime}]</span>` : '';
        let clickAction = l.videoTime ? `onclick="seekToLogTime('${l.videoTime}')"` : '';
        let posText = (l.type === 'spike' && l.attackPos) ? `(${l.attackPos})` : '';
        return `<div class="log-row" ${clickAction} title="クリックでこのシーンの${AppState.settings.preRoll}秒前から再生">${timeStr}<span class="log-name">${AppState.data.players[l.playerId]}</span><span class="log-res ${resClass}">${l.result}${posText}</span></div>`;
    }).join('');
}

function undoLast() { if(AppState.data.logs.length > 0) { AppState.data.logs.pop(); saveToLocal(); updateLog(); draw('input-canvas'); } }

function openRenameView() {
    const container = document.getElementById('rename-inputs-container'); container.innerHTML = ''; 
    for(let i = 1; i <= AppState.data.activePlayerCount; i++) {
        const wrapper = document.createElement('div'); wrapper.className = 'rename-item';
        wrapper.innerHTML = `<label style="font-size:10px; color:#666; margin-bottom:2px;">No.${i}</label><input type="text" id="rename-input-${i}" value="${AppState.data.players[i]}">`; container.appendChild(wrapper);
    }
    for(let i = 1; i <= AppState.data.activePlayerCount; i++) {
        const input = document.getElementById(`rename-input-${i}`);
        // 【変更点】Enterキーで直接保存(saveBatchRename)を実行するように変更
        input.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); saveBatchRename(); } });
    }
    switchTab('rename');
}

function saveBatchRename() {
    for(let i = 1; i <= AppState.data.activePlayerCount; i++) {
        const val = document.getElementById(`rename-input-${i}`).value.trim();
        AppState.data.players[i] = val === "" ? String(i) : val;
    }
    saveToLocal(); renderPlayerGrids(); switchTab('input');
}

// ==========================================
// 選手カラー編集用 補助関数
// ==========================================
window.selectPlayerColor = function(hex) {
    document.getElementById('edit-player-color').value = hex;
    document.getElementById('current-color-preview').style.background = hex;
};

window.renderCustomColors = function() {
    // マイカラーの初期値（保存されていなければこの色セット）
    let customColors = JSON.parse(localStorage.getItem('vlink_custom_colors') || '["#ff4d4d", "#007bff", "#28a745", "#ffc107", "#e83e8c", "#6f42c1"]');
    const container = document.getElementById('custom-colors-container');
    if(!container) return;
    container.innerHTML = '';

    let isDeleteMode = container.dataset.deleteMode === 'true';

    customColors.forEach((color, index) => {
        let div = document.createElement('div');
        div.style.cssText = `width:26px; height:26px; border-radius:4px; background:${color}; cursor:pointer; border:1px solid #aaa; box-shadow:0 1px 3px rgba(0,0,0,0.2); position:relative;`;

        if (isDeleteMode) {
            // 削除モード時
            div.innerHTML = `<div style="position:absolute; top:-6px; right:-6px; background:#dc3545; color:white; font-size:10px; font-weight:bold; width:16px; height:16px; display:flex; align-items:center; justify-content:center; border-radius:50%; box-shadow:0 1px 2px rgba(0,0,0,0.3);">×</div>`;
            div.onclick = () => deleteCustomColor(index);
        } else {
            // 通常時（選択）
            div.onclick = () => selectPlayerColor(color);
        }
        container.appendChild(div);
    });
};

window.addCustomColor = function(hex) {
    let customColors = JSON.parse(localStorage.getItem('vlink_custom_colors') || '["#ff4d4d", "#007bff", "#28a745", "#ffc107", "#e83e8c", "#6f42c1"]');
    if (!customColors.includes(hex)) {
        customColors.push(hex);
        localStorage.setItem('vlink_custom_colors', JSON.stringify(customColors));
    }
    selectPlayerColor(hex);
    renderCustomColors();
};

window.deleteCustomColor = function(index) {
    let customColors = JSON.parse(localStorage.getItem('vlink_custom_colors') || '[]');
    customColors.splice(index, 1);
    localStorage.setItem('vlink_custom_colors', JSON.stringify(customColors));
    renderCustomColors();
};

window.toggleColorDeleteMode = function() {
    const container = document.getElementById('custom-colors-container');
    let isDeleteMode = container.dataset.deleteMode === 'true';
    container.dataset.deleteMode = !isDeleteMode;

    const btn = document.getElementById('toggle-color-delete-btn');
    if (btn) {
        btn.innerText = !isDeleteMode ? "完了" : "削除";
        btn.style.background = !isDeleteMode ? "#dc3545" : "#f8f9fa";
        btn.style.color = !isDeleteMode ? "white" : "#333";
    }
    renderCustomColors();
};


// ==========================================
// 選手名・カラー編集モーダル (書き換え部分)
// ==========================================
function editSingleName(e, id) {
    e.stopPropagation();

    let modal = document.getElementById('player-edit-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'player-edit-modal';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; align-items:center; justify-content:center;';

        // エクセル風基本カラーパレット（4段x7列 = 28色）
        const standardColorsHTML = [
            '#000000', '#444444', '#666666', '#999999', '#cccccc', '#eeeeee', '#ffffff',
            '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff',
            '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9',
            '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7'
        ].map(c => `<div onclick="selectPlayerColor('${c}')" style="background:${c}; width:100%; aspect-ratio:1; border:1px solid #ddd; cursor:pointer; box-sizing:border-box;"></div>`).join('');

        modal.innerHTML = `
            <div style="background:white; padding:20px; border-radius:12px; width:90%; max-width:320px; display:flex; flex-direction:column; gap:12px; box-shadow:0 10px 30px rgba(0,0,0,0.3);">
                <h3 style="margin:0; border-bottom:2px solid #007bff; padding-bottom:8px; font-size:16px;">✏️ 選手編集</h3>
                <input type="hidden" id="edit-player-id">

                <div>
                    <label style="font-size:12px; font-weight:bold;">名前:</label>
                    <input type="text" id="edit-player-name" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; margin-top:4px;" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); savePlayerEdit(); }">
                </div>

                <div>
                    <label style="font-size:12px; font-weight:bold;">背景カラー:</label>
                    <div style="display:flex; align-items:center; gap:10px; margin-top:4px; margin-bottom:10px;">
                        <div id="current-color-preview" style="width:40px; height:30px; border:2px solid #333; border-radius:4px; box-shadow:inset 0 0 4px rgba(0,0,0,0.1);"></div>
                        <input type="hidden" id="edit-player-color">
                        <button type="button" class="action-btn btn-utility" style="padding:6px 10px; font-size:11px; box-shadow:none;" onclick="selectPlayerColor('#ffffff')">白(標準)に戻す</button>
                    </div>

                    <div style="font-size:11px; color:#666; margin-bottom:4px; font-weight:bold;">基本カラー</div>
                    <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:2px; margin-bottom:12px; border:1px solid #ccc; padding:2px; background:#f8f9fa;">
                        ${standardColorsHTML}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <div style="font-size:11px; color:#666; font-weight:bold;">マイカラー</div>
                        <div style="display:flex; gap:4px;">
                            <button type="button" style="background:#007bff; color:white; border:none; border-radius:3px; font-size:10px; padding:4px 8px; cursor:pointer;" onclick="document.getElementById('native-color-picker').click()">+ 追加</button>
                            <button id="toggle-color-delete-btn" type="button" style="background:#f8f9fa; color:#333; border:1px solid #ccc; border-radius:3px; font-size:10px; padding:4px 8px; cursor:pointer;" onclick="toggleColorDeleteMode()">削除</button>
                        </div>
                    </div>
                    <div id="custom-colors-container" style="display:flex; flex-wrap:wrap; gap:8px; min-height:30px; padding-bottom:4px;"></div>

                    <input type="color" id="native-color-picker" style="display:none;" onchange="addCustomColor(this.value)">
                </div>

                <div style="display:flex; justify-content:center; gap:15px; margin-top:10px;">
                    <button class="action-btn" style="background:#6c757d; width:100px; padding:8px; box-shadow:none;" onclick="document.getElementById('player-edit-modal').style.display='none'">キャンセル</button>
                    <button class="action-btn" style="background:#007bff; width:100px; padding:8px; box-shadow:none;" onclick="savePlayerEdit()">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // データのセット
    document.getElementById('edit-player-id').value = id;
    document.getElementById('edit-player-name').value = AppState.data.players[id] || '';

    if (!AppState.data.playerColors) AppState.data.playerColors = JSON.parse(localStorage.getItem('vlink_player_colors') || '{}');
    const initialColor = AppState.data.playerColors[id] || '#ffffff';
    selectPlayerColor(initialColor);

    // 削除モードを「通常」にリセットしてからマイカラーを描画
    const customContainer = document.getElementById('custom-colors-container');
    if (customContainer) {
        customContainer.dataset.deleteMode = 'false';
        const btn = document.getElementById('toggle-color-delete-btn');
        if(btn) {
            btn.innerText = "削除";
            btn.style.background = "#f8f9fa";
            btn.style.color = "#333";
        }
    }
    renderCustomColors();

    modal.style.display = 'flex';
    setTimeout(() => { document.getElementById('edit-player-name').focus(); }, 10);
}

window.savePlayerEdit = function() {
    const id = document.getElementById('edit-player-id').value;
    const name = document.getElementById('edit-player-name').value.trim();
    const color = document.getElementById('edit-player-color').value;

    // 名前と色の保存
    AppState.data.players[id] = name === "" ? String(id) : name;
    if (!AppState.data.playerColors) AppState.data.playerColors = {};

    if (color === '#ffffff') {
        delete AppState.data.playerColors[id]; // 白の場合は標準のグラデーションに戻す
    } else {
        AppState.data.playerColors[id] = color;
    }

    localStorage.setItem('vlink_player_colors', JSON.stringify(AppState.data.playerColors));
    document.getElementById('player-edit-modal').style.display = 'none';

    saveToLocal(); renderPlayerGrids(); updateLog();
    if (AppState.ui.currentTab === 'compare') renderCompareVisual();
    if (AppState.ui.currentTab === 'player-stats') renderPlayerStatsTable();
};

// ==========================================
// 6. 動画制御 (Video Manager) & 履歴機能
// ==========================================

window.updatePlaybackSettings = function() {
    AppState.settings.preRoll = parseInt(document.getElementById('preroll-time-select').value, 10);
    AppState.settings.playDuration = parseInt(document.getElementById('playduration-time-select').value, 10);
    updateLog(); 
};

function toggleVideoSource(forceState) {
    const content = document.getElementById('video-source-content');
    const icon = document.getElementById('video-source-toggle-icon');
    if (!content) return;
    
    if (forceState === 'hide' || (forceState !== 'show' && content.style.display !== 'none')) {
        content.style.display = 'none';
        if(icon) icon.innerText = '◀ (ソース変更)';
    } else {
        content.style.display = 'block';
        if(icon) icon.innerText = '▼';
    }
}

function initVideoSourceUI() {
    renderVideoHistory();
}

function showYouTubeInput() {
    let ytGroup = document.getElementById('youtube-input-group');
    if (ytGroup) ytGroup.style.display = 'flex';
}

function toggleYtMode() {
    let modeNode = document.querySelector('input[name="yt-mode"]:checked');
    if(!modeNode) return;
    let mode = modeNode.value;
    let btn = document.querySelector('#youtube-input-group button[onclick="loadYouTubeVideo()"]');
    let listContainer = document.getElementById('yt-playlist-container');
    let inputField = document.getElementById('yt-url-input');
    
    if(mode === 'single') {
        inputField.placeholder = "YouTube URLを貼り付け...";
        if(btn) btn.innerHTML = "読込";
        listContainer.style.display = 'none';
    } else {
        inputField.placeholder = "再生リスト(list=...)のURLを貼り付け...";
        if(btn) btn.innerHTML = "リスト取得";
        listContainer.style.display = 'none';
        listContainer.innerHTML = '';
    }
}

function hideYouTubeInput() {
    let ytGroup = document.getElementById('youtube-input-group');
    if (ytGroup) ytGroup.style.display = 'none';
    document.getElementById('yt-url-input').value = '';
    if (document.getElementById('yt-playlist-container')) {
        document.getElementById('yt-playlist-container').style.display = 'none';
        document.getElementById('yt-playlist-container').innerHTML = '';
    }
}

function showPlayer(type) {
    document.getElementById('video-player-wrapper').style.display = 'block';
    const controls = document.getElementById('video-seek-controls');
    controls.style.display = 'flex'; controls.style.marginTop = '10px';

    const ytNode = document.getElementById('yt-player'); const localNode = document.getElementById('local-player');
    if (type === 'youtube') { if (ytNode) ytNode.style.display = 'block'; if (localNode) localNode.style.display = 'none'; } 
    else if (type === 'local') { if (ytNode) ytNode.style.display = 'none'; if (localNode) localNode.style.display = 'block'; }

    // ★ 以下の3行を追記：動画表示時に、まだ大画面でなければ大画面モードにする
    if (!AppState.ui.isLargeScreen) {
        toggleLargeScreen();
    }
}

function loadLocalVideo(event) {
    const file = event.target.files[0]; if (!file) return;
    AppState.video.name = file.name.replace(/\.[^/.]+$/, "");
    AppState.video.id = "local_" + AppState.video.name; 
    AppState.video.type = 'local'; 
    
    addToHistory(AppState.video.id, AppState.video.name, 'local', '');

    showPlayer('local');
    if (AppState.video.ytPlayer && typeof AppState.video.ytPlayer.pauseVideo === 'function') AppState.video.ytPlayer.pauseVideo();
    const lp = document.getElementById('local-player');
    lp.src = URL.createObjectURL(file);
    
    AppState.video.time = 0; updateTimerDisplay(); lp.play();
    checkAndLoadVideoData(AppState.video.id);
    toggleVideoSource('hide'); 
}

function loadYouTubeVideo() {
    const url = document.getElementById('yt-url-input').value;
    if (!url) { alert("URLを入力してください。"); return; }
    
    let modeNode = document.querySelector('input[name="yt-mode"]:checked');
    let mode = modeNode ? modeNode.value : 'single';
    
    if (mode === 'single') {
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regExp); let videoId = '';
        if (match && match[1].length === 11) videoId = match[1]; 
        else { alert("⚠️ URLから動画IDを読み取れませんでした。"); return; }

        let existingItem = (AppState.videoHistory || []).find(h => h.id === "yt_" + videoId);
        let vidName = (existingItem && existingItem.name !== "YouTube Video") ? existingItem.name : "YouTube Video";

        AppState.video.name = vidName; 
        AppState.video.id = "yt_" + videoId;
        AppState.video.type = 'youtube'; 
        
        addToHistory(AppState.video.id, AppState.video.name, 'youtube', url);
        showPlayer('youtube');
        
        const localPlayer = document.getElementById('local-player'); if (localPlayer) localPlayer.pause();
        if (typeof YT === 'undefined' || !YT.Player) { alert("⏳ YouTubeのシステムを準備中です。数秒待ってからもう一度ボタンを押してください。"); return; }

        if (AppState.video.ytPlayer && typeof AppState.video.ytPlayer.loadVideoById === 'function') {
            try { AppState.video.ytPlayer.loadVideoById(videoId); } catch (e) { rebuildYTPlayer(videoId); }
        } else { rebuildYTPlayer(videoId); }
        
        document.getElementById('yt-url-input').blur();
        AppState.video.time = 0; updateTimerDisplay(); checkAndLoadVideoData(AppState.video.id);
        toggleVideoSource('hide');
    } else {
        const listRegExp = /[?&]list=([^#\&\?]+)/;
        const match = url.match(listRegExp);
        if (match && match[1]) {
            fetchPlaylistData(match[1]);
        } else {
            alert("⚠️ URLから再生リストIDを読み取れませんでした。\nURLに「list=...」が含まれているか確認してください。");
        }
    }
}

function fetchPlaylistData(listId) {
    let listContainer = document.getElementById('yt-playlist-container');
    listContainer.style.display = 'flex';
    listContainer.innerHTML = '<p style="font-size:12px; color:#666; text-align:center; padding:10px;">⏳ リスト情報を取得中...<br>(数秒かかる場合があります)</p>';
    
    let hiddenDiv = document.getElementById('hidden-yt-player-wrapper');
    if (!hiddenDiv) {
        hiddenDiv = document.createElement('div');
        hiddenDiv.id = 'hidden-yt-player-wrapper';
        hiddenDiv.style.position = 'absolute';
        hiddenDiv.style.left = '-9999px'; 
        hiddenDiv.innerHTML = '<div id="hidden-yt-player"></div>';
        document.body.appendChild(hiddenDiv);
    } else {
        hiddenDiv.innerHTML = '<div id="hidden-yt-player"></div>';
    }
    
    const originUrl = window.location.origin !== "null" ? window.location.origin : "http://localhost";
    window.hiddenYtPlayer = new YT.Player('hidden-yt-player', {
        height: '1', width: '1',
        playerVars: { listType: 'playlist', list: listId, origin: originUrl, mute: 1, autoplay: 1 },
        events: {
            onReady: (e) => {
                setTimeout(() => {
                    let ids = e.target.getPlaylist();
                    if(ids && ids.length > 0) {
                        e.target.stopVideo();
                        renderPlaylistSelection(ids);
                    }
                }, 1500);
            },
            onStateChange: (e) => {
                if (e.data !== -1) {
                    let ids = e.target.getPlaylist();
                    if(ids && ids.length > 0) {
                        e.target.stopVideo();
                        renderPlaylistSelection(ids);
                    }
                }
            },
            onError: (e) => {
                listContainer.innerHTML = '<p style="color:#dc3545; font-size:12px; text-align:center; padding:10px;">⚠️ リストの取得に失敗しました。<br>非公開リスト、またはURLが間違っている可能性があります。</p>';
            }
        }
    });
    
    setTimeout(() => {
        if(listContainer.innerHTML.includes('取得中')) {
             listContainer.innerHTML = '<p style="color:#dc3545; font-size:12px; text-align:center; padding:10px;">⚠️ タイムアウト: 取得できませんでした。<br>動画数が多すぎるか、ネットワークに問題があります。</p>';
        }
    }, 10000);
}

function renderPlaylistSelection(ids) {
    let listContainer = document.getElementById('yt-playlist-container');
    let html = '<div style="font-size:12px; font-weight:bold; margin-bottom:5px;">インポートする動画を選択してください:</div>';
    
    html += '<p style="font-size:10px; color:#dc3545; margin-bottom:10px; line-height:1.2;">※YouTubeのシステム制約上、一括取得時は再生するまで動画のタイトルを取得できません。再生した際に正しいタイトルに自動更新されます。</p>';

    html += `<div style="margin-bottom:8px; font-size:12px;">
        <button type="button" onclick="toggleAllPlaylistItems(true)" style="background:#6c757d; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:10px; margin-right:5px;">全選択</button>
        <button type="button" onclick="toggleAllPlaylistItems(false)" style="background:#6c757d; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:10px;">全解除</button>
    </div>`;

    html += '<div id="playlist-checkboxes" style="display:flex; flex-direction:column; gap:5px;">';
    
    ids.forEach((id, index) => {
        let existing = (AppState.videoHistory || []).find(h => h.id === 'yt_' + id);
        let name = (existing && existing.name && existing.name !== 'YouTube Video') ? existing.name : `動画 ${index + 1} (ID: ${id})`;
        
        html += `<label style="font-size:12px; display:flex; align-items:center; gap:5px; cursor:pointer;">
            <input type="checkbox" class="yt-playlist-item-cb" value="${id}" checked>
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${name}</span>
        </label>`;
    });
    
    html += '</div>';
    html += `<button type="button" onclick="importSelectedPlaylistItems()" style="margin-top:10px; background:#28a745; color:white; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;">選択した動画を履歴に保存</button>`;
    
    listContainer.innerHTML = html;
}

window.toggleAllPlaylistItems = function(check) {
    document.querySelectorAll('.yt-playlist-item-cb').forEach(cb => {
        cb.checked = check;
        if (check) {
            cb.setAttribute('checked', 'checked');
        } else {
            cb.removeAttribute('checked');
        }
    });
};

window.importSelectedPlaylistItems = function() {
    let checkboxes = document.querySelectorAll('.yt-playlist-item-cb:checked');
    if(checkboxes.length === 0) {
        alert("インポートする動画を選択してください。");
        return;
    }
    
    let importedCount = 0;
    checkboxes.forEach(cb => {
        let id = cb.value;
        let existing = (AppState.videoHistory || []).find(h => h.id === 'yt_' + id);
        let name = existing ? existing.name : "YouTube Video";
        let url = "https://www.youtube.com/watch?v=" + id;
        
        addToHistory('yt_' + id, name, 'youtube', url, true);
        importedCount++;
    });
    
    renderVideoHistory();
    alert(`${importedCount}件の動画を履歴に保存しました。\n「🕒過去の履歴から」ボタンを開いて確認してください。`);
    
    hideYouTubeInput(); 
};

function toggleVideoHistory() {
    const container = document.getElementById('video-history-dropdown');
    if (container) {
        container.style.display = (container.style.display === 'none') ? 'block' : 'none';
    }
}

function addToHistory(id, name, type, url, skipRender = false) {
    let history = AppState.videoHistory || [];
    let index = history.findIndex(h => h.id === id);
    
    if (index > -1) {
        history[index].lastAccessed = Date.now();
        if(name && name !== "YouTube Video") history[index].name = name; 
        if (url) history[index].url = url;
    } else {
        history.push({ id, name, type, url, hasData: false, lastAccessed: Date.now() });
    }
    
    history.sort((a, b) => b.lastAccessed - a.lastAccessed);
    if (history.length > 50) history = history.slice(0, 50);
    
    AppState.videoHistory = history;
    saveVideoHistory();
    if (!skipRender) renderVideoHistory();
}

function updateHistoryName(id, name) {
    let item = (AppState.videoHistory || []).find(h => h.id === id);
    if (item) {
        item.name = name;
        saveVideoHistory();
        renderVideoHistory();
    }
}

function updateHistoryDataFlag(id, hasData) {
    let item = (AppState.videoHistory || []).find(h => h.id === id);
    if (item && item.hasData !== hasData) {
        item.hasData = hasData;
        saveVideoHistory();
        renderVideoHistory();
    }
}

function saveVideoHistory() {
    localStorage.setItem('vlink_video_history', JSON.stringify(AppState.videoHistory || []));

    // Supabaseへのクラウド保存
    if (supabaseClient) {
        supabaseClient.from('vlink_cloud_data').upsert([
            { id: 'shared_user', history: AppState.videoHistory }
        ]).then(({ error }) => {
            if (error) console.error("Supabase保存エラー:", error);
        });
    }
}

function loadHistoryFromCloud() {
    // Supabaseからのクラウド読み込み
    if (supabaseClient) {
        supabaseClient.from('vlink_cloud_data')
            .select('history')
            .eq('id', 'shared_user')
            .single()
            .then(({ data, error }) => {
                if (data && data.history) {
                    try {
                        const serverHistory = typeof data.history === 'string' ? JSON.parse(data.history) : data.history;
                        AppState.videoHistory = serverHistory;
                        localStorage.setItem('vlink_video_history', JSON.stringify(serverHistory));
                        renderVideoHistory();
                    } catch (e) {
                        console.error("履歴データの解析エラー", e);
                    }
                } else if (error && error.code !== 'PGRST116') {
                    console.error("Supabase読込エラー:", error);
                }
            });
    }
}

function renderVideoHistory() {
    let container = document.getElementById('video-history-dropdown');
    if (!container) return; 
    
    if (!AppState.videoHistory || AppState.videoHistory.length === 0) {
        container.innerHTML = '<p style="font-size:12px; color:#666; text-align:center; margin:0;">動画の履歴はありません</p>';
        return;
    }
    
    let html = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
    html += '<span style="font-size:11px; font-weight:bold; color:#666;">履歴一覧 (最大50件)</span>';
    html += '<button type="button" onclick="clearAllHistory()" style="background:#dc3545; color:white; border:none; padding:3px 8px; border-radius:3px; font-size:10px; cursor:pointer;">すべて削除</button>';
    html += '</div>';
    
    html += '<div style="display:flex; flex-direction:column; gap:6px;">';
    
    AppState.videoHistory.forEach(item => {
        const iconHTML = item.hasData 
            ? '<div style="position:relative; display:inline-block; font-size:16px;">📁<span style="position:absolute; top:-2px; right:-2px; background:white; border:2px solid #28a745; border-radius:50%; width:11px; height:11px; box-sizing:border-box;"></span></div>' 
            : '<div style="position:relative; display:inline-block; font-size:16px;">📁<span style="position:absolute; top:-2px; right:-2px; color:white; font-size:8px; font-weight:bold; background:#dc3545; border-radius:50%; width:12px; height:12px; line-height:12px; text-align:center;">✕</span></div>';
            
        const typeStr = item.type === 'youtube' ? 'YouTube' : '端末動画';
        const bgColor = item.type === 'youtube' ? '#fff0f0' : '#f0f8ff';
        
        html += `
            <div style="display:flex; align-items:center; background:${bgColor}; border:1px solid #ddd; padding:8px 10px; border-radius:4px; cursor:pointer;">
                <div style="width:24px; text-align:center; margin-right:8px;" onclick="loadFromHistory('${item.id}')">${iconHTML}</div>
                <div style="flex:1; overflow:hidden;" onclick="loadFromHistory('${item.id}')">
                    <div style="font-size:12px; font-weight:bold; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</div>
                    <div style="font-size:10px; color:#666;">${typeStr}</div>
                </div>
                <div style="margin-left:8px;">
                    <button type="button" onclick="deleteHistoryItem(event, '${item.id}')" style="background:transparent; border:none; color:#dc3545; font-size:16px; cursor:pointer; padding:4px;" title="履歴から削除">🗑️</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

window.deleteHistoryItem = function(e, id) {
    e.stopPropagation();
    if(confirm("この履歴を削除しますか？\n（記録されたデータ自体は消えません）")) {
        AppState.videoHistory = AppState.videoHistory.filter(h => h.id !== id);
        saveVideoHistory();
        renderVideoHistory();
    }
};

window.clearAllHistory = function() {
    if(confirm("すべての履歴を削除しますか？\n（記録されたデータ自体は消えません）")) {
        AppState.videoHistory = [];
        saveVideoHistory();
        renderVideoHistory();
    }
};

function loadFromHistory(id) {
    const item = AppState.videoHistory.find(h => h.id === id);
    if (!item) return;
    
    const container = document.getElementById('video-history-dropdown');
    if(container) container.style.display = 'none';
    
    if (item.type === 'youtube') {
        showYouTubeInput(); 
        let singleModeRadio = document.querySelector('input[name="yt-mode"][value="single"]');
        if (singleModeRadio) {
            singleModeRadio.checked = true;
            toggleYtMode();
        }
        document.getElementById('yt-url-input').value = item.url;
        loadYouTubeVideo();
    } else if (item.type === 'local') {
        alert(`「${item.name}」は端末内の動画です。\nセキュリティ上、自動で読み込むことはできません。\n「端末から選択」ボタンを押し、対象のファイルを再度選択してください。`);
    }
}

function rebuildYTPlayer(videoId) {
    const wrapper = document.getElementById('video-player-wrapper'); const oldPlayer = document.getElementById('yt-player');
    if (oldPlayer) oldPlayer.remove();
    const newDiv = document.createElement('div'); newDiv.id = 'yt-player';
    newDiv.style.position = 'absolute'; newDiv.style.top = '0'; newDiv.style.left = '0';
    newDiv.style.width = '100%'; newDiv.style.height = '100%'; newDiv.style.border = '0';
    wrapper.insertBefore(newDiv, wrapper.firstChild);
    buildYTPlayer(videoId);
}

function buildYTPlayer(videoId) {
    const originUrl = window.location.origin !== "null" ? window.location.origin : "http://localhost";
    AppState.video.ytPlayer = new YT.Player('yt-player', {
        height: '100%', width: '100%', videoId: videoId,
        playerVars: { 'playsinline': 1, 'rel': 0, 'enablejsapi': 1, 'origin': originUrl },
        events: { 
            'onStateChange': onYouTubeStateChange,
            'onError': function(e) {
                if (e.data === 150 || e.data === 101 || e.data === 153) alert("⚠️ 【再生エラー】\n外部アプリでの再生が制限されています。");
                else if (e.data === 100) alert("⚠️ 【再生エラー】\n動画が見つかりません。");
                else alert("⚠️ 読み込みエラーが発生しました (コード: " + e.data + ")");
            }
        }
    });
}

function formatTime(sec) { const m = Math.floor(sec / 60).toString().padStart(2, '0'); const s = (sec % 60).toString().padStart(2, '0'); return `${m}:${s}`; }
function updateTimerDisplay() { document.getElementById('match-timer-display').innerText = formatTime(AppState.video.time); }

let timerInterval = null;
function setTimerState(running) {
    if (AppState.video.isRunning === running) return;
    const btn = document.getElementById('btn-timer-toggle');
    if (running) {
        timerInterval = setInterval(() => { AppState.video.time++; updateTimerDisplay(); }, 1000);
        AppState.video.isRunning = true; btn.innerHTML = '⏸ 一時停止'; btn.style.background = '#ff9800';
    } else {
        clearInterval(timerInterval);
        AppState.video.isRunning = false; btn.innerHTML = '▶ 再生'; btn.style.background = '#28a745';
    }
}

function toggleTimer() {
    if (AppState.video.isRunning) {
        setTimerState(false);
        if (AppState.video.type === 'youtube' && AppState.video.ytPlayer && typeof AppState.video.ytPlayer.pauseVideo === 'function') AppState.video.ytPlayer.pauseVideo();
        else if (AppState.video.type === 'local') document.getElementById('local-player').pause();
    } else {
        setTimerState(true);
        if (AppState.video.type === 'youtube' && AppState.video.ytPlayer && typeof AppState.video.ytPlayer.playVideo === 'function') AppState.video.ytPlayer.playVideo();
        else if (AppState.video.type === 'local') document.getElementById('local-player').play();
    }
}

function resetTimerInternal() {
    setTimerState(false); AppState.video.time = 0; updateTimerDisplay();
    if (AppState.video.type === 'youtube' && AppState.video.ytPlayer && typeof AppState.video.ytPlayer.pauseVideo === 'function') {
        AppState.video.ytPlayer.pauseVideo(); AppState.video.ytPlayer.seekTo(0);
    } else if (AppState.video.type === 'local') {
        const lp = document.getElementById('local-player'); lp.pause(); lp.currentTime = 0;
    }
}
function resetTimer() { if(confirm("タイマーと動画を最初からリセットしますか？")) resetTimerInternal(); }

function editTimer() {
    const input = prompt("タイマーの時間を設定してください (例: 12:34)", formatTime(AppState.video.time));
    if (input) {
        const parts = input.split(':');
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            AppState.video.time = parseInt(parts[0]) * 60 + parseInt(parts[1]); updateTimerDisplay();
            if (AppState.video.type === 'youtube' && AppState.video.ytPlayer && typeof AppState.video.ytPlayer.seekTo === 'function') AppState.video.ytPlayer.seekTo(AppState.video.time);
            else if (AppState.video.type === 'local') document.getElementById('local-player').currentTime = AppState.video.time;
        } else alert("正しい形式(mm:ss)で入力してください。");
    }
}

function seekToLogTime(timeStr) {
    if (!timeStr || !AppState.video.type) return;
    const parts = timeStr.split(':');
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        let targetSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        let playSeconds = Math.max(0, targetSeconds - AppState.settings.preRoll); 
        AppState.video.time = playSeconds; updateTimerDisplay();

        if (AppState.video.type === 'youtube' && AppState.video.ytPlayer && typeof AppState.video.ytPlayer.seekTo === 'function') {
            AppState.video.ytPlayer.seekTo(playSeconds, true); AppState.video.ytPlayer.playVideo(); setTimerState(true);
        } else if (AppState.video.type === 'local') {
            const lp = document.getElementById('local-player'); lp.currentTime = playSeconds; lp.play(); setTimerState(true);
        }
    }
}

function onYouTubeStateChange(event) {
    if (AppState.video.ytPlayer && typeof AppState.video.ytPlayer.getVideoData === 'function') {
        let vData = AppState.video.ytPlayer.getVideoData(); 
        if (vData && vData.title && AppState.video.name !== vData.title) {
            AppState.video.name = vData.title;
            updateHistoryName(AppState.video.id, vData.title); 
        }
    }
    if (event.data === 1) { setTimerState(true); AppState.video.time = Math.floor(AppState.video.ytPlayer.getCurrentTime()); updateTimerDisplay(); } 
    else if (event.data === 2 || event.data === 0) { setTimerState(false); AppState.video.time = Math.floor(AppState.video.ytPlayer.getCurrentTime()); updateTimerDisplay(); }
}

function updateSeekDuration() { AppState.video.seekDuration = parseInt(document.getElementById('seek-time-select').value, 10); }

function seekVideo(direction) {
    if (!AppState.video.type) return;
    const offset = direction * AppState.video.seekDuration;
    if (AppState.video.type === 'youtube' && AppState.video.ytPlayer && typeof AppState.video.ytPlayer.getCurrentTime === 'function') {
        let newTime = Math.max(0, AppState.video.ytPlayer.getCurrentTime() + offset);
        AppState.video.ytPlayer.seekTo(newTime, true); AppState.video.time = Math.floor(newTime); updateTimerDisplay();
    } else if (AppState.video.type === 'local') {
        const lp = document.getElementById('local-player'); let newTime = Math.max(0, lp.currentTime + offset);
        lp.currentTime = newTime; AppState.video.time = Math.floor(newTime); updateTimerDisplay();
    }
}

function pauseManualVideo() {
    if (AppState.video.type === 'youtube' && AppState.video.ytPlayer && typeof AppState.video.ytPlayer.pauseVideo === 'function') AppState.video.ytPlayer.pauseVideo();
    else if (AppState.video.type === 'local') { const lp = document.getElementById('local-player'); if (lp && !lp.paused) lp.pause(); }
}

// --- プレイリスト制御 ---
function resetPlaylistUI() {
    AppState.playlist.active = false; AppState.playlist.type = null; clearTimeout(AppState.playlist.timeout);
    pauseManualVideo();
    document.getElementById('video-source-ui').style.display = AppState.ui.isLargeScreen ? 'none' : 'block';
    document.getElementById('video-seek-controls').style.display = 'flex';
    document.getElementById('playlist-controls').style.display = 'none';
    if (!AppState.ui.isLargeScreen) document.getElementById('shared-split-layout').style.maxWidth = '1600px';
    
    const pStatsContainer = document.getElementById('player-stats-container');
    if (pStatsContainer) pStatsContainer.style.maxWidth = '1200px';
}

function getPlaylistLogs(type) {
    const sFilter = AppState.filters[type]; const lZones = AppState.lockedZones[type];
    let logs = getFilteredLogs(type, sFilter, lZones).filter(l => l.videoTime);
    logs.sort((a, b) => {
        let ta = a.videoTime.split(':'); let sa = parseInt(ta[0])*60 + parseInt(ta[1]);
        let tb = b.videoTime.split(':'); let sb = parseInt(tb[0])*60 + parseInt(tb[1]);
        return sa - sb;
    });
    return logs;
}

window.playFilteredLogs = function(playerId, type, resultCat) {
    let logs = AppState.data.logs;
    
    if (playerId !== 'all') {
        logs = logs.filter(l => l.playerId == playerId);
    }

    if (type !== 'all') {
        logs = logs.filter(l => l.type === type);
    }

    if (resultCat === 'serve_miss') logs = logs.logs.filter(l => ['アウト', 'ネット'].includes(l.result));
    else if (resultCat === 'spike_miss') logs = logs.filter(l => ['アウト', 'ネット', 'ブロックシャット'].includes(l.result));
    else if (resultCat === 'toss_suc') logs = logs.filter(l => ['レフト', 'センター', 'ライト', '２アタック', 'クイック'].includes(l.result));
    else if (resultCat === 'toss_miss') logs = logs.filter(l => ['ミス', '失点'].includes(l.result));
    else if (resultCat !== 'all') logs = logs.filter(l => l.result === resultCat);
    
    window.playCustomPlaylist(logs);
};

window.playCustomPlaylist = function(logs) {
    if (!AppState.video.type) { alert("動画が読み込まれていません。\nまずは「データ入力」タブで動画を設定してください。"); return; }
    let validLogs = logs.filter(l => l.videoTime).sort((a, b) => {
        let ta = a.videoTime.split(':'); let sa = parseInt(ta[0])*60 + parseInt(ta[1]);
        let tb = b.videoTime.split(':'); let sb = parseInt(tb[0])*60 + parseInt(tb[1]);
        return sa - sb;
    });
    if (validLogs.length === 0) { alert("再生できる動画データがありません。\n（動画の時間が記録されているログのみ再生可能です）"); return; }

    AppState.playlist.active = true; AppState.playlist.type = 'custom'; 
    AppState.playlist.queue = validLogs; AppState.playlist.index = 0;
    
    document.getElementById('shared-split-layout').classList.remove('single-view');
    document.getElementById('shared-video-area').style.display = 'flex'; 
    document.getElementById('shared-split-layout').style.maxWidth = '100%';
    document.getElementById('video-source-ui').style.display = 'none'; 
    document.getElementById('video-seek-controls').style.display = 'none';
    document.getElementById('playlist-controls').style.display = 'flex';
    
    const pStatsContainer = document.getElementById('player-stats-container');
    if (pStatsContainer) pStatsContainer.style.maxWidth = '650px';
    
    playCurrentQueueItem();
};

function startPlaylist(type) {
    if (!AppState.video.type) { alert("動画が読み込まれていません。\nまずは「データ入力」タブで動画を設定してください。"); return; }
    let logs = getPlaylistLogs(type);
    if (logs.length === 0) { alert("再生できる動画データがありません。\n（動画の時間が記録されているログのみ再生可能です）"); return; }

    AppState.playlist.active = true; AppState.playlist.type = type; AppState.playlist.queue = logs; AppState.playlist.index = 0;
    
    document.getElementById('shared-split-layout').classList.remove('single-view');
    
    document.getElementById('shared-video-area').style.display = 'flex'; document.getElementById('shared-split-layout').style.maxWidth = '100%';
    document.getElementById('video-source-ui').style.display = 'none'; document.getElementById('video-seek-controls').style.display = 'none';
    document.getElementById('playlist-controls').style.display = 'flex';
    playCurrentQueueItem();
}

function playCurrentQueueItem() {
    if (AppState.playlist.index >= AppState.playlist.queue.length || AppState.playlist.index < 0) {
        document.getElementById('playback-status-text').innerText = "⏹ 再生終了"; clearTimeout(AppState.playlist.timeout); return;
    }
    let log = AppState.playlist.queue[AppState.playlist.index];
    
    let posText = (log.type === 'spike' && log.attackPos) ? `(${log.attackPos})` : '';
    let typeStr = log.type === 'serve' ? 'サーブ' : log.type === 'spike' ? 'スパイク' : log.type === 'serve_receive' ? 'サーブレシーブ' : log.type === 'receive' ? 'レシーブ' : log.type === 'toss' ? 'トス' : log.type;
    
    document.getElementById('playback-status-text').innerText = `[${AppState.playlist.index + 1}/${AppState.playlist.queue.length}] ${AppState.data.players[log.playerId]} : ${typeStr}${posText} - ${log.result}`;
    seekToLogTime(log.videoTime); 
    
    clearTimeout(AppState.playlist.timeout);
    AppState.playlist.timeout = setTimeout(() => {
        if (AppState.playlist.index < AppState.playlist.queue.length - 1) { AppState.playlist.index++; playCurrentQueueItem(); } 
        else document.getElementById('playback-status-text').innerText = "⏹ すべての再生が終了しました";
    }, AppState.settings.playDuration * 1000);
}

function skipNextPlayback() { if (AppState.playlist.index < AppState.playlist.queue.length - 1) { AppState.playlist.index++; playCurrentQueueItem(); } }
function skipPrevPlayback() { if (AppState.playlist.index > 0) { AppState.playlist.index--; playCurrentQueueItem(); } }

function updateDynamicPlaylist() {
    if (!AppState.playlist.active || AppState.playlist.type === 'custom' || AppState.ui.currentTab !== AppState.playlist.type) return;
    let newLogs = getPlaylistLogs(AppState.playlist.type); AppState.playlist.queue = newLogs;
    if (newLogs.length === 0) {
        document.getElementById('playback-status-text').innerText = "⏹ 該当する動画データがありません";
        clearTimeout(AppState.playlist.timeout); pauseManualVideo();
    } else { AppState.playlist.index = 0; playCurrentQueueItem(); }
}

function closePlaybackModal() {
    if (AppState.ui.isLargeScreen) {
        toggleLargeScreen(); 
    }
    resetPlaylistUI();
    if (AppState.ui.currentTab !== 'input') {
        document.getElementById('shared-video-area').style.display = 'none';
        document.getElementById('shared-split-layout').classList.add('single-view');
    }
}

// ==========================================
// 7. データ管理＆ファイル出力 (Storage Manager)
// ==========================================
const DB_NAME = 'VLinkDB'; const STORE_NAME = 'vlinkStore'; let db;

function initDB(callback) {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => { db = e.target.result; if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME); };
    req.onsuccess = (e) => { db = e.target.result; loadFromDB(callback); };
    req.onerror = (e) => { console.error("IndexedDBエラー", e); fallbackLoad(); callback(); };
}

function loadFromDB(callback) {
    const tx = db.transaction(STORE_NAME, 'readonly'); const store = tx.objectStore(STORE_NAME);
    const reqP = store.get('players'), reqL = store.get('log'), reqS = store.get('session'), reqT = store.get('teams'); 
    tx.oncomplete = () => {
        let needsMigration = false;
        if (reqP.result) AppState.data.players = reqP.result; else needsMigration = true;
        if (reqL.result) AppState.data.logs = reqL.result; else needsMigration = true;
        if (reqS.result) AppState.session.id = reqS.result; else needsMigration = true;
        if (reqT.result) AppState.data.teams = reqT.result; 
        if (needsMigration) fallbackLoad(); callback();
    };
}

function fallbackLoad() {
    if (localStorage.getItem('vlink_players')) AppState.data.players = JSON.parse(localStorage.getItem('vlink_players'));
    if (localStorage.getItem('vlink_data')) AppState.data.logs = JSON.parse(localStorage.getItem('vlink_data'));
    if (localStorage.getItem('vlink_current_session')) AppState.session.id = localStorage.getItem('vlink_current_session');
    if (localStorage.getItem('vlink_player_count')) AppState.data.activePlayerCount = parseInt(localStorage.getItem('vlink_player_count'), 10);
    else if (localStorage.getItem('vlink_players')) AppState.data.activePlayerCount = 7; 
    
    if (localStorage.getItem('vlink_teams')) AppState.data.teams = JSON.parse(localStorage.getItem('vlink_teams'));
    else AppState.data.teams = [];
    
    if (localStorage.getItem('vlink_video_history')) AppState.videoHistory = JSON.parse(localStorage.getItem('vlink_video_history'));
    else AppState.videoHistory = [];
    
    loadHistoryFromCloud();

    if (db) saveToDB(); 
}

function saveToDB() {
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME);
    store.put(AppState.data.players, 'players'); store.put(AppState.data.logs, 'log'); store.put(AppState.session.id, 'session');
    store.put(AppState.data.teams, 'teams'); 
    if (AppState.video.id) {
        store.put({ players: AppState.data.players, log: AppState.data.logs, playerCount: AppState.data.activePlayerCount, updatedAt: Date.now() }, 'proj_' + AppState.video.id);
        updateHistoryDataFlag(AppState.video.id, AppState.data.logs.length > 0);
    }
}

function saveToLocal() {
    localStorage.setItem('vlink_players', JSON.stringify(AppState.data.players));
    localStorage.setItem('vlink_data', JSON.stringify(AppState.data.logs));
    localStorage.setItem('vlink_current_session', AppState.session.id);
    localStorage.setItem('vlink_player_count', AppState.data.activePlayerCount);
    localStorage.setItem('vlink_teams', JSON.stringify(AppState.data.teams)); 
    saveToDB(); 
}

function updateAfterDataLoad() {
    AppState.ui.selectedPlayerId = null; AppState.ui.statsPlayers = []; AppState.ui.comparePlayers = []; AppState.ui.pstatsPlayers = []; 
    resetInput(); AppConfig.TYPES.forEach(t => { if(AppState.filters[t]) AppState.filters[t] = 'all'; if(AppState.lockedZones[t]) AppState.lockedZones[t] = []; AppState.hoverZones[t] = null; });
    updateZoneClasses('serve'); updateZoneClasses('spike');
    renderPlayerGrids(); updateLog(); draw('input-canvas'); clearStatsDOM(); switchTab('input'); 
}

function checkAndLoadVideoData(vidId) {
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readonly'); const store = tx.objectStore(STORE_NAME);
    const req = store.get('proj_' + vidId);
    req.onsuccess = (e) => {
        const savedData = e.target.result;
        if (savedData) {
            if (AppState.data.logs.length === 0 || confirm("この動画の過去のデータが保存されています。\n現在のデータを上書きして読み込みますか？")) {
                AppState.data.logs = savedData.log || []; AppState.data.players = savedData.players || AppState.data.players; AppState.data.activePlayerCount = savedData.playerCount || 7;
                updateAfterDataLoad();
            }
        } else if (AppState.data.logs.length > 0) {
            if(confirm("新しい動画が読み込まれました。\n現在の記録をリセットして新しく始めますか？\n\n（「キャンセル」を押すと、現在の記録をこの動画に引き継ぎます）")) resetAllData(true); 
        }
        saveToLocal(); 
    };
}

function getSuggestFileName(prefix) { return `${AppState.video.name || "VLink"}_${prefix}_${new Date().toISOString().slice(0,10)}`; }

async function exportData() {
    let inputName = prompt("保存するファイル名を入力してください。\nこの名前で保存しますか？", getSuggestFileName("Data"));
    if (inputName === null) return; if (inputName.trim() === "") inputName = getSuggestFileName("Data"); if (!inputName.endsWith('.json')) inputName += '.json';

    const data = { players: AppState.data.players, log: AppState.data.logs, playerCount: AppState.data.activePlayerCount };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    downloadBlob(blob, inputName, 'application/json', '.json', 'JSON File');
}

async function exportCSV() {
    let inputName = prompt("保存するファイル名を入力してください。\nこの名前で保存しますか？", getSuggestFileName("Report"));
    if (inputName === null) return; if (inputName.trim() === "") inputName = getSuggestFileName("Report"); if (!inputName.endsWith('.csv')) inputName += '.csv';

    let csvContent = "\uFEFF日時,セッションID,動画時間,選手名,プレー種類,結果\n";
    AppState.data.logs.forEach(l => {
        let typeStr = l.type === 'serve' ? 'サーブ' : 
                      l.type === 'spike' ? 'スパイク' : 
                      l.type === 'serve_receive' ? 'サーブレシーブ' : 
                      l.type === 'receive' ? 'レシーブ' : 
                      l.type === 'toss' ? 'トス' : l.type;
        csvContent += `${l.time},${l.sessionId},${l.videoTime || ''},${AppState.data.players[l.playerId]},${typeStr},${l.result}\n`;
    });
    downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), inputName, 'text/csv', '.csv', 'CSVファイル');
}

async function downloadBlob(blob, defaultName, mimeType, ext, desc) {
    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: desc, accept: {[mimeType]: [ext]} }] });
            const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
        } else {
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = defaultName;
            a.click(); URL.revokeObjectURL(url);
        }
    } catch (err) { if (err.name !== 'AbortError') alert("保存に失敗しました。"); }
}

function importData(e) {
    const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (data.players && data.log) {
                AppState.data.players = data.players; AppState.data.logs = data.log; AppState.data.activePlayerCount = data.playerCount || 10;
                saveToLocal(); updateAfterDataLoad(); alert("データの復元が完了しました。");
            } else alert("データ形式が正しくありません。");
        } catch (err) { alert("ファイルの読み込みに失敗しました。"); }
    };
    reader.readAsText(file); e.target.value = ''; 
}

function resetAllData(skipConfirm = false) {
    if(skipConfirm || confirm("すべての記録を消去して、新しいデータの入力を始めますか？\n※保存していないデータは失われます。")) {
        AppState.data.logs = []; AppState.ui.selectedPlayerId = null; AppState.ui.statsPlayers = []; AppState.ui.comparePlayers = []; AppState.ui.pstatsPlayers = []; 
        AppState.data.activePlayerCount = 7; AppState.data.players = { ...AppConfig.DEFAULT_PLAYERS };
        resetInput(); AppState.session.id = "session_" + Date.now(); 
        if(!skipConfirm) resetTimerInternal(); 
        saveToLocal(); updateAfterDataLoad();
    }
}

// ==========================================
// 8. チーム管理機能 (Team Manager)
// ==========================================
function registerCurrentTeam() {
    if (AppState.data.teams.length >= 10) {
        alert("登録できるチームは最大10チームまでです。\n不要なチームを削除してから登録してください。");
        return;
    }
    const teamName = prompt("現在の選手セットを保存します。\nチーム名を入力してください:");
    if (teamName) {
        const newTeam = {
            id: Date.now(),
            name: teamName,
            players: JSON.parse(JSON.stringify(AppState.data.players)),
            count: AppState.data.activePlayerCount
        };
        AppState.data.teams.push(newTeam);
        saveToLocal();
        alert(`チーム「${teamName}」を保存しました。`);
    }
}

function openTeamSelectModal() {
    const container = document.getElementById('team-list-container');
    if (AppState.data.teams.length === 0) {
        container.innerHTML = '<p style="font-size:13px; color:#666; text-align:center;">登録されているチームはありません。</p>';
    } else {
        container.innerHTML = AppState.data.teams.map(team => `
            <div style="display:flex; gap:8px; align-items:center;">
                <button class="action-btn" style="flex:1; background:#007bff; font-size:13px; padding:10px;" onclick="loadTeam(${team.id})">${team.name}</button>
                <button class="action-btn" style="background:#dc3545; padding:10px; font-size:12px;" onclick="deleteTeam(${team.id})" title="削除">✖</button>
            </div>
        `).join('');
    }
    document.getElementById('team-modal-overlay').style.display = 'flex';
}

function closeTeamSelectModal() {
    document.getElementById('team-modal-overlay').style.display = 'none';
}

function loadTeam(teamId) {
    const team = AppState.data.teams.find(t => t.id === teamId);
    if (!team) return;
    if (confirm(`チーム「${team.name}」の選手データを呼び出しますか？\n※現在入力されている選手名は上書きされます。`)) {
        AppState.data.players = JSON.parse(JSON.stringify(team.players));
        AppState.data.activePlayerCount = team.count;
        saveToLocal();
        renderPlayerGrids();
        closeTeamSelectModal();
    }
}

function deleteTeam(teamId) {
    if (confirm("このチームの登録を削除しますか？")) {
        AppState.data.teams = AppState.data.teams.filter(t => t.id !== teamId);
        saveToLocal();
        openTeamSelectModal(); 
    }
}

// ==========================================
// 10. 画像エクスポート機能 (Image Export Manager)
// ==========================================
async function captureAndExport(elementId, fileNamePrefix, mode = 'download') {
    if (typeof html2canvas === 'undefined') {
        alert("画像生成ライブラリが読み込まれていません。ページを再読み込みしてください。");
        return;
    }

    const targetEl = document.getElementById(elementId);
    if (!targetEl || targetEl.innerHTML.trim() === '') {
        alert("画像化するデータがありません。");
        return;
    }

    try {
        const canvas = await html2canvas(targetEl, {
            scale: 2,
            backgroundColor: '#f4f7f6',
            logging: false,
            useCORS: true 
        });

        if (mode === 'download') {
            const link = document.createElement('a');
            link.download = getSuggestFileName(fileNamePrefix) + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        } else if (mode === 'copy') {
            canvas.toBlob(async (blob) => {
                try {
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                    alert("クリップボードに画像をコピーしました！\nそのままSNSや資料に貼り付け(Ctrl+V)できます。");
                } catch (err) {
                    alert("コピーに失敗しました。\nブラウザの権限を確認するか、「保存」機能を使用してください。");
                    console.error("Clipboard API Error:", err);
                }
            }, 'image/png');
        }
    } catch (err) {
        console.error("キャプチャエラー:", err);
        alert("画像の生成に失敗しました。");
    }
}

// ==========================================
// YouTube書き出しウィザード機能
// ==========================================
let ytWizState = {
    step: 1, history: [], scope: null, format: null, playMode: null,
    selectedPlayers: [],
    customPlays: [
        { id: 'serve', name: 'サーブ', selected: true },
        { id: 'spike', name: 'スパイク', selected: true },
        { id: 'serve_receive', name: 'サーブレシーブ', selected: true },
        { id: 'receive', name: 'レシーブ', selected: true },
        { id: 'toss', name: 'トス', selected: true }
    ]
};

function openYtExportWizard() {
    let logsWithTime = AppState.data.logs.filter(l => l.videoTime);
    if (logsWithTime.length === 0) {
        alert("動画の時間が記録されたデータがありません。\n動画を読み込み、再生しながらデータを入力してください。");
        return;
    }
    
    // 状態リセット
    ytWizState = { 
        step: 1, history: [], scope: null, format: null, playMode: null, selectedPlayers: [],
        customPlays: [
            { id: 'serve', name: 'サーブ', selected: true },
            { id: 'spike', name: 'スパイク', selected: true },
            { id: 'serve_receive', name: 'サーブレシーブ', selected: true },
            { id: 'receive', name: 'レシーブ', selected: true },
            { id: 'toss', name: 'トス', selected: true }
        ]
    };
    
    showYtStep(1);
    document.getElementById('yt-wizard-overlay').style.display = 'flex';
}

function closeYtWizard() {
    document.getElementById('yt-wizard-overlay').style.display = 'none';
}

function showYtStep(stepNum) {
    document.querySelectorAll('.yt-wizard-step').forEach(el => el.style.display = 'none');
    document.getElementById('yt-step-' + stepNum).style.display = 'block';
    ytWizState.step = stepNum;
    document.getElementById('yt-wiz-back-btn').style.display = (ytWizState.history.length > 0) ? 'block' : 'none';
}

function ytWizGoTo(stepNum) {
    ytWizState.history.push(ytWizState.step);
    showYtStep(stepNum);
}

function ytWizBack() {
    if (ytWizState.history.length > 0) {
        let prevStep = ytWizState.history.pop();
        showYtStep(prevStep);
    }
}

// Step 1: 範囲選択
function ytWizSelectScope(scope) {
    ytWizState.scope = scope;
    if (scope === 'all') {
        ytWizGoTo('2'); // 全員なら並び順へ
    } else {
        renderYtPlayerList();
        ytWizGoTo('1-5'); // 特定の選手なら選択画面へ
    }
}

// Step 1.5: 選手選択レンダリング
function renderYtPlayerList() {
    const container = document.getElementById('yt-wiz-player-list');
    container.innerHTML = '';
    
    // ログを持つ選手IDを抽出
    let validPlayerIds = [...new Set(AppState.data.logs.filter(l => l.videoTime).map(l => l.playerId))];
    
    validPlayerIds.forEach(pid => {
        let btn = document.createElement('div');
        let isSelected = ytWizState.selectedPlayers.includes(pid);
        btn.className = `yt-player-btn ${isSelected ? 'selected' : ''}`;
        btn.innerText = AppState.data.players[pid] || pid;
        btn.onclick = () => {
            if (ytWizState.selectedPlayers.includes(pid)) {
                ytWizState.selectedPlayers = ytWizState.selectedPlayers.filter(p => p !== pid);
                btn.classList.remove('selected');
            } else {
                ytWizState.selectedPlayers.push(pid);
                btn.classList.add('selected');
            }
        };
        container.appendChild(btn);
    });
}

function ytWizGoToOrder() {
    if (ytWizState.selectedPlayers.length === 0) {
        alert("少なくとも1人の選手を選択してください。");
        return;
    }
    ytWizGoTo('2');
}

// Step 2: 形式選択
function ytWizSelectFormat(format) {
    ytWizState.format = format;
    if (format === 'chrono') {
        executeYtExport(); // 時系列順なら即座に書き出し実行
    } else {
        ytWizGoTo('3'); // 項目別なら項目選択へ
    }
}

// Step 3: プレー項目モード選択
function ytWizSelectPlayTypes(mode) {
    ytWizState.playMode = mode;
    if (mode === 'all') {
        // すべてのプレー（標準順）なら即座に実行
        ytWizState.customPlays.forEach(p => p.selected = true);
        executeYtExport();
    } else {
        renderYtPlayList();
        ytWizGoTo('4'); // 並び替え画面へ
    }
}

// Step 4: プレー項目の並び替えレンダリング（ドラッグ対応版）
function renderYtPlayList() {
    const container = document.getElementById('yt-wiz-play-list');
    container.innerHTML = '';

    ytWizState.customPlays.forEach((play) => {
        let item = document.createElement('div');
        item.className = `yt-play-item ${play.selected ? 'selected' : ''}`;

        // 矢印ボタンの代わりに、ドラッグ可能なハンドル（≡）を左に配置
        item.innerHTML = `
            <div class="drag-handle" style="cursor: grab; padding: 0 10px 0 0; color: #aaa; font-size: 20px; display: flex; align-items: center;">≡</div>
            <label style="flex:1; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${play.selected ? 'checked' : ''} onchange="toggleYtPlaySelection('${play.id}', this.checked)">
                ${play.name}
            </label>
        `;
        container.appendChild(item);
    });

    // SortableJSを適用してドラッグ＆ドロップを有効化
    if (window.ytSortableInstance) {
        window.ytSortableInstance.destroy(); // 既存のものがあればリセット
    }

    window.ytSortableInstance = new Sortable(container, {
        animation: 150, // 並び替え時のアニメーション速度(ms)
        handle: '.drag-handle', // 「≡」の部分を掴んだ時だけドラッグ可能にする
        ghostClass: 'sortable-ghost', // ドラッグ中の見た目クラス
        onEnd: function (evt) {
            // ドラッグ終了時に内部の配列データを並び替える
            const movedItem = ytWizState.customPlays.splice(evt.oldIndex, 1)[0];
            ytWizState.customPlays.splice(evt.newIndex, 0, movedItem);
        }
    });
}

// 選択切り替え関数の修正 (IndexではなくIDで検索するように変更)
window.toggleYtPlaySelection = function (id, isChecked) {
    let play = ytWizState.customPlays.find(p => p.id === id);
    if (play) {
        play.selected = isChecked;
    }
    renderYtPlayList(); // 背景色(.selected)を反映するために再描画
};

// ==========================================
// テキスト生成＆クリップボード書き出し処理
// ==========================================
function executeYtExport() {
    // 1. ベースとなるログ（時間があるもの）
    let baseLogs = AppState.data.logs.filter(l => l.videoTime);
    
    // 2. 選手フィルタリング
    if (ytWizState.scope === 'specific') {
        baseLogs = baseLogs.filter(l => ytWizState.selectedPlayers.includes(l.playerId));
    }

    if (baseLogs.length === 0) {
        alert("条件に一致するデータがありません。");
        return;
    }

    let copyText = "00:00 プレー詳細\n";

    // ログ1行を文字列にするヘルパー関数
    const formatLogLine = (l) => {
        let parts = l.videoTime.split(':'); 
        let playSeconds = Math.max(0, (parseInt(parts[0]) * 60 + parseInt(parts[1])) - AppState.settings.preRoll); 
        let posText = (l.type === 'spike' && l.attackPos) ? `(${l.attackPos})` : '';
        let typeStr = l.type === 'serve' ? 'サーブ' : 
                      l.type === 'spike' ? `スパイク${posText}` : 
                      l.type === 'serve_receive' ? 'サーブレシーブ' : 
                      l.type === 'receive' ? 'レシーブ' : 
                      l.type === 'toss' ? 'トス' : l.type;
        return `${formatTime(playSeconds)} ${AppState.data.players[l.playerId]} : ${typeStr} - ${l.result}\n`;
    };

    // 時間順にソートするヘルパー関数
    const sortByTime = (logs) => {
        return logs.sort((a, b) => {
            let ta = a.videoTime.split(':'), tb = b.videoTime.split(':');
            return (parseInt(ta[0])*60 + parseInt(ta[1])) - (parseInt(tb[0])*60 + parseInt(tb[1]));
        });
    };

    // 3. 形式に応じたテキスト生成
    if (ytWizState.format === 'chrono') {
        copyText += "【 タイムスタンプ 】\n";
        sortByTime(baseLogs).forEach(l => { copyText += formatLogLine(l); });
    } else {
        // 項目別（プレー項目ごとの処理）
        let selectedOrder = ytWizState.customPlays.filter(p => p.selected);
        if (selectedOrder.length === 0) {
            alert("最低でも1つのプレー項目を選択してください。");
            return;
        }

        selectedOrder.forEach(playObj => {
            let typeLogs = baseLogs.filter(l => l.type === playObj.id);
            if (typeLogs.length > 0) {
                copyText += `\n【 ${playObj.name} 】\n`;
                sortByTime(typeLogs).forEach(l => { copyText += formatLogLine(l); });
            }
        });
    }

    // 4. クリップボードへコピー
    navigator.clipboard.writeText(copyText).then(() => {
        alert("クリップボードにコピーしました！\nYouTubeの動画説明欄にそのまま貼り付け(Ctrl+V)できます。");
        closeYtWizard();
    }).catch(err => {
        alert("コピーに失敗しました。お使いのブラウザの権限を確認してください。");
    });
}

// ==========================================
// 9. 初期化・イベントバインディング (Init)
// ==========================================
window.onload = () => { 
    const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    const lp = document.getElementById('local-player');
    lp.addEventListener('play', () => setTimerState(true));
    lp.addEventListener('pause', () => setTimerState(false));
    lp.addEventListener('ended', () => setTimerState(false));
    lp.addEventListener('seeked', () => { AppState.video.time = Math.floor(lp.currentTime); updateTimerDisplay(); });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && AppState.ui.isLargeScreen) { e.preventDefault(); toggleLargeScreen(); return; }
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (AppState.video.type) {
            if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); toggleTimer(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); seekVideo(-1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); seekVideo(1); }
        }
    });

    const ytUrlInput = document.getElementById('yt-url-input');
    if (ytUrlInput) {
        ytUrlInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                loadYouTubeVideo();
            }
        });
    }

    initDB(() => {
        initVideoSourceUI(); 
        updatePlaybackSettings(); // DOMに設定されている初期値をAppStateに同期
        renderPlayerGrids(); updateLog(); draw('input-canvas');
        clearStatsDOM(); 
        drawStatsCanvas('serve'); drawStatsCanvas('spike'); 
        updateTimerDisplay();
        document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - (window.lastTouchEnd || 0) <= 300) e.preventDefault(); window.lastTouchEnd = now; }, false);
    });
};