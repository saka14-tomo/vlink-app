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
            compareType: 'serve',
            isMultiSelect: false,
            isTeamAll: false,
            isLargeScreen: false
        },
        input: { state: 'idle', start: null, end: null },
        filters: { serve: 'all', spike: 'all' },
        hoverFilters: { serve: null, spike: null },
        lockedZones: { serve: [], spike: [] },
        hoverZones: { serve: null, spike: null },
        video: { type: null, id: null, name: "", time: 0, seekDuration: 5, isRunning: false, ytPlayer: null },
        playlist: { active: false, type: null, queue: [], index: 0, timeout: null }
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

        logArea.style.display = (target === 'input') ? 'flex' : 'none';
        
        if (target === 'input') {
            videoArea.style.display = 'flex';
            if (AppState.playlist.active) resetPlaylistUI(); 
        } else if (AppConfig.TYPES.includes(target)) {
            if (AppState.playlist.active && AppState.playlist.type === target) {
                videoArea.style.display = 'flex'; 
            } else {
                videoArea.style.display = 'none';
                if (AppState.playlist.active) resetPlaylistUI();
                else pauseManualVideo();
            }
        } else {
            videoArea.style.display = 'none';
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

        if (AppState.ui.isLargeScreen) {
            sourceUi.style.display = 'none';
            splitLayout.style.maxWidth = '100%'; 
            btn.innerText = '🗗 縮小';
            btn.style.background = '#ff9800';
        } else {
            sourceUi.style.display = 'block';
            splitLayout.style.maxWidth = '1600px'; 
            btn.innerText = '🔲 大画面';
            btn.style.background = '#17a2b8';
        }
    }

    function renderPlayerGrids() {
        let wrapperHeight = '66px'; let fontSize = '20px';      
        let editHeight = '20px'; let editFontSize = '10px';

        let totalButtons = AppState.data.activePlayerCount;
        if (AppState.data.activePlayerCount < 12) totalButtons++; 
        if (AppState.data.activePlayerCount > 1) totalButtons++;  

        if (totalButtons > 10) { wrapperHeight = '48px'; fontSize = '16px'; editHeight = '16px'; editFontSize = '9px'; } 
        else if (totalButtons > 8) { wrapperHeight = '56px'; fontSize = '18px'; editHeight = '18px'; editFontSize = '9px'; }

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
                const btn = document.createElement('button'); btn.className = `player-btn`;
                btn.onclick = () => selectPlayer(i);
                btn.innerHTML = `<span style="font-size:${currentFontSize};">${AppState.data.players[i]}</span>`;
                wrapper.appendChild(btn);
                
                if (type === 'input') {
                    const editBtn = document.createElement('div'); editBtn.className = 'edit-single-btn';
                    editBtn.style.height = editHeight; editBtn.style.fontSize = editFontSize;
                    editBtn.innerHTML = '✏️ 編集'; editBtn.onclick = (e) => editSingleName(e, i);
                    wrapper.appendChild(editBtn);
                }
                container.appendChild(wrapper);
            }
            
            if (AppState.data.activePlayerCount < 12) {
                const addWrapper = document.createElement('div');
                addWrapper.className = 'player-wrapper player-add-btn';
                let currentWrapperHeight = type === 'compare' ? '46px' : wrapperHeight;
                let currentFontSize = type === 'compare' ? '12px' : fontSize;

                addWrapper.style.height = currentWrapperHeight;
                addWrapper.onclick = () => {
                    AppState.data.activePlayerCount++;
                    if (!AppState.data.players[AppState.data.activePlayerCount]) AppState.data.players[AppState.data.activePlayerCount] = String(AppState.data.activePlayerCount);
                    saveToLocal(); renderPlayerGrids();
                };
                addWrapper.innerHTML = `<span style="font-size:${currentFontSize};">＋</span>`;
                container.appendChild(addWrapper);
            }
            
            if (AppState.data.activePlayerCount > 1) {
                const removeWrapper = document.createElement('div');
                removeWrapper.className = 'player-wrapper player-add-btn';
                let currentWrapperHeight = type === 'compare' ? '46px' : wrapperHeight;

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
                        AppState.ui.statsPlayers = AppState.ui.statsPlayers.filter(p => p !== removingId);
                        
                        const btnAll = document.getElementById('btn-compare-all');
                        if(btnAll && AppState.ui.currentTab === 'compare') {
                            if(AppState.ui.comparePlayers.length === AppState.data.activePlayerCount) {
                                btnAll.innerHTML = '☐ 全解除'; btnAll.style.background = '#6c757d';
                            } else {
                                btnAll.innerHTML = '☑️ 一括表示'; btnAll.style.background = '#17a2b8';
                            }
                        }
                        
                        saveToLocal(); renderPlayerGrids();
                        if(AppState.ui.currentTab === 'compare') renderCompareVisual();
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
            
            // ★他の選手選択時にゾーンロックを解除
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
        ct.fillStyle = '#e8a365'; ct.fillRect(20,60,180,360); ct.strokeStyle = 'white'; ct.lineWidth = 2; ct.strokeRect(20,60,180,360);
        ct.beginPath(); ct.moveTo(20,180); ct.lineTo(200,180); ct.moveTo(20,300); ct.lineTo(200,300); ct.stroke();
        ct.strokeStyle = '#333'; ct.lineWidth = 4; ct.beginPath(); ct.moveTo(20,240); ct.lineTo(200,240); ct.stroke();
        
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

            // ★ 新しい描画・プレビュー判定ロジック
            if (lZones.length === 0) {
                // 条件1＆2: ロックなし -> 常に全ログを実線で表示（ホバーしても消えない）
                mainLogs = getFilteredLogs(type, sFilter, []);
            } else {
                // 条件3: ロックあり -> ロックされたゾーンのログのみ実線表示
                mainLogs = getFilteredLogs(type, sFilter, lZones);

                // 条件4: ロック中に別ゾーンにカーソルが置かれたら、そのゾーンのログを薄くプレビュー
                if (hZone && !lZones.some(z => z.x === hZone.x && z.y === hZone.y)) {
                    thinLogs = getFilteredLogs(type, sFilter, [hZone]);
                }
            }

            // まず背景に薄いログ（ロック中のホバープレビュー）を描画
            if (thinLogs.length > 0) {
                ct.globalAlpha = 0.25; // 薄く表示
                thinLogs.forEach(l => line(ct, {x:l.startX, y:l.startY}, {x:l.endX, y:l.endY}, getColorForLog(l.result)));
            }

            // 次に前面に実線のログを描画
            ct.globalAlpha = 1.0; // 実線表示に戻す
            if (mainLogs.length > 0) {
                mainLogs.forEach(l => line(ct, {x:l.startX, y:l.startY}, {x:l.endX, y:l.endY}, getColorForLog(l.result)));
            }

            // 統計ボタン（イン、ミスなど）のホバープレビュー処理は現状維持
            if (hFilter !== null && hFilter !== sFilter) {
                let activeZones = lZones.length > 0 ? lZones : [];
                let filterPreviewLogs = getFilteredLogs(type, hFilter, activeZones);
                let previewOnlyLogs = filterPreviewLogs.filter(pl => !mainLogs.some(ml => ml.id === pl.id));
                
                ct.globalAlpha = 0.25; // 薄く表示
                previewOnlyLogs.forEach(l => line(ct, {x:l.startX, y:l.startY}, {x:l.endX, y:l.endY}, getColorForLog(l.result)));
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
        
        // ★ 各統計ボタン（イン、ミスなど）が選択されたら固定表示を解除する
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
        if (index > -1) lockedZones.splice(index, 1); else lockedZones.push({x, y});
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
            ct.fillStyle = '#e8a365'; ct.fillRect(20,60,180,360); ct.strokeStyle = 'white'; ct.lineWidth = 2; ct.strokeRect(20,60,180,360); ct.beginPath(); ct.moveTo(20,180); ct.lineTo(200,180); ct.moveTo(20,300); ct.lineTo(200,300); ct.stroke(); ct.strokeStyle = '#333'; ct.lineWidth = 4; ct.beginPath(); ct.moveTo(20,240); ct.lineTo(200,240); ct.stroke();
            logs.forEach(l => { line(ct, {x:l.startX, y:l.startY}, {x:l.endX, y:l.endY}, getColorForLog(l.result)); });
        });
    }

    // ==========================================
    // 5. データ入力管理 (Input Manager)
    // ==========================================

    function setRightPanelMode(mode) {
        document.getElementById('panel-direct').style.display = (mode === 'direct') ? 'flex' : 'none';
        document.getElementById('panel-court').style.display = (mode === 'court') ? 'flex' : 'none';
    }

    function resetInput() { 
        AppState.input.state = 'idle'; AppState.input.start = null; AppState.input.end = null; 
        setRightPanelMode('direct');

        document.querySelectorAll('.serve-action-btn, .spike-action-btn').forEach(b => b.disabled = true); 
        
        const hasPlayer = AppState.ui.selectedPlayerId !== null;
        document.querySelectorAll('.direct-btn, .toss-btn').forEach(b => b.disabled = !hasPlayer);
    }

    function handleCourtClick(e) {
        if (!AppState.ui.selectedPlayerId) return;
        const cv = document.getElementById('input-canvas'); const r = cv.getBoundingClientRect();
        const x = Math.round(e.clientX - r.left), y = Math.round(e.clientY - r.top);
        
        if (AppState.input.state === 'idle') { 
            AppState.input.start = {x, y}; 
            AppState.input.state = 'waiting'; 
            setRightPanelMode('court'); 
        } else if (AppState.input.state === 'waiting') { 
            AppState.input.end = {x, y}; 
            AppState.input.state = 'ready'; 
        }
        
        if (AppState.input.start) {
            const isServe = AppState.input.start.y >= 400;
            document.querySelectorAll('.serve-action-btn').forEach(b => b.disabled = !isServe);
            document.querySelectorAll('.spike-action-btn').forEach(b => b.disabled = isServe);
        }
        
        draw('input-canvas');
    }

    function cancelCurrentInput() {
        if (AppState.input.state === 'ready') {
            AppState.input.end = null; AppState.input.state = 'waiting';
            if (AppState.input.start) {
                const isServe = AppState.input.start.y >= 400;
                document.querySelectorAll('.serve-action-btn').forEach(b => b.disabled = !isServe);
                document.querySelectorAll('.spike-action-btn').forEach(b => b.disabled = isServe);
            }
            draw('input-canvas');
        } else if (AppState.input.state === 'waiting') {
            resetInput(); draw('input-canvas');
        } else {
            resetInput();
        }
    }

    function saveAction(type, result) {
        let finalX = AppState.input.start.x, finalY = AppState.input.start.y;
        if (type === 'serve') {
            let zoneIndex = Math.floor((Math.max(20, Math.min(finalX, 199.9)) - 20) / 60); finalX = 20 + (zoneIndex * 60) + 30; finalY = 420; 
        } else if (type === 'spike') {
            let xIndex = Math.floor((Math.max(20, Math.min(finalX, 199.9)) - 20) / 60), yIndex = Math.floor((Math.max(240, Math.min(finalY, 419.9)) - 240) / 60); 
            finalX = 20 + (xIndex * 60) + 30; finalY = 240 + (yIndex * 60) + 30 - 10;
            if (xIndex === 0 && (yIndex === 0 || yIndex === 1)) finalX -= 10; if (xIndex === 2 && (yIndex === 0 || yIndex === 1)) finalX += 10; 
        }
        AppState.data.logs.push({ id: Date.now(), sessionId: AppState.session.id, playerId: AppState.ui.selectedPlayerId, type: type, result: result, startX: finalX, startY: finalY, endX: AppState.input.end.x, endY: AppState.input.end.y, time: new Date().toLocaleString(), videoTime: formatTime(AppState.video.time) });
        resetInput(); saveToLocal(); updateLog(); draw('input-canvas');
    }

    function saveDirectAction(type, result) {
        if (!AppState.ui.selectedPlayerId) return;
        let finalX = 110, finalY = 240; 
        
        AppState.data.logs.push({ 
            id: Date.now(), sessionId: AppState.session.id, playerId: AppState.ui.selectedPlayerId, 
            type: type, result: result, startX: finalX, startY: finalY, endX: finalX, endY: finalY, 
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
            return `<div class="log-row" ${clickAction} title="クリックでこのシーンの7秒前から再生">${timeStr}<span class="log-name">${AppState.data.players[l.playerId]}</span><span class="log-res ${resClass}">${l.result}</span></div>`;
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
            input.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); document.getElementById('save-rename-btn').focus(); } });
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

    function editSingleName(e, id) {
        e.stopPropagation();
        const newName = prompt(`No.${id} の選手名を入力してください:`, AppState.data.players[id]);
        if (newName !== null) {
            const trimmed = newName.trim();
            AppState.data.players[id] = trimmed === "" ? String(id) : trimmed;
            saveToLocal(); renderPlayerGrids(); updateLog();
            if (AppState.ui.currentTab === 'compare') renderCompareVisual();
        }
    }

    // ==========================================
    // 6. 動画制御 (Video Manager)
    // ==========================================
    function showYouTubeInput() {
        document.getElementById('source-btn-group').style.display = 'none';
        document.getElementById('youtube-input-group').style.display = 'flex';
    }
    function hideYouTubeInput() {
        document.getElementById('source-btn-group').style.display = 'flex';
        document.getElementById('youtube-input-group').style.display = 'none';
    }

    function showPlayer(type) {
        document.getElementById('video-player-wrapper').style.display = 'block';
        const controls = document.getElementById('video-seek-controls');
        controls.style.display = 'flex'; controls.style.marginTop = 'auto';

        const ytNode = document.getElementById('yt-player'); const localNode = document.getElementById('local-player');
        if (type === 'youtube') { if (ytNode) ytNode.style.display = 'block'; if (localNode) localNode.style.display = 'none'; } 
        else if (type === 'local') { if (ytNode) ytNode.style.display = 'none'; if (localNode) localNode.style.display = 'block'; }
    }

    function loadLocalVideo(event) {
        const file = event.target.files[0]; if (!file) return;
        AppState.video.name = file.name.replace(/\.[^/.]+$/, "");
        AppState.video.id = "local_" + AppState.video.name; 

        AppState.video.type = 'local'; showPlayer('local');
        if (AppState.video.ytPlayer && typeof AppState.video.ytPlayer.pauseVideo === 'function') AppState.video.ytPlayer.pauseVideo();
        const lp = document.getElementById('local-player');
        lp.src = URL.createObjectURL(file);
        
        AppState.video.time = 0; updateTimerDisplay(); lp.play();
        checkAndLoadVideoData(AppState.video.id);
    }

    function loadYouTubeVideo() {
        const url = document.getElementById('yt-url-input').value;
        if (!url) { alert("URLを入力してください。"); return; }
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regExp); let videoId = '';
        if (match && match[1].length === 11) videoId = match[1]; else { alert("⚠️ URLから動画IDを読み取れませんでした。"); return; }

        AppState.video.name = "YouTube Video"; AppState.video.id = "yt_" + videoId;
        AppState.video.type = 'youtube'; showPlayer('youtube');
        
        const localPlayer = document.getElementById('local-player'); if (localPlayer) localPlayer.pause();
        if (typeof YT === 'undefined' || !YT.Player) { alert("⏳ YouTubeのシステムを準備中です。数秒待ってからもう一度ボタンを押してください。"); return; }

        if (AppState.video.ytPlayer && typeof AppState.video.ytPlayer.loadVideoById === 'function') {
            try { AppState.video.ytPlayer.loadVideoById(videoId); } catch (e) { rebuildYTPlayer(videoId); }
        } else { rebuildYTPlayer(videoId); }
        
        document.getElementById('yt-url-input').blur();
        AppState.video.time = 0; updateTimerDisplay(); checkAndLoadVideoData(AppState.video.id);
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
            let playSeconds = Math.max(0, targetSeconds - 7);
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
            let vData = AppState.video.ytPlayer.getVideoData(); if (vData && vData.title) AppState.video.name = vData.title;
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

    function startPlaylist(type) {
        if (!AppState.video.type) { alert("動画が読み込まれていません。\nまずは「データ入力」タブで動画を設定してください。"); return; }
        let logs = getPlaylistLogs(type);
        if (logs.length === 0) { alert("再生できる動画データがありません。\n（動画の時間が記録されているログのみ再生可能です）"); return; }

        AppState.playlist.active = true; AppState.playlist.type = type; AppState.playlist.queue = logs; AppState.playlist.index = 0;
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
        document.getElementById('playback-status-text').innerText = `[${AppState.playlist.index + 1}/${AppState.playlist.queue.length}] ${AppState.data.players[log.playerId]} : ${log.result}`;
        seekToLogTime(log.videoTime); 
        
        clearTimeout(AppState.playlist.timeout);
        AppState.playlist.timeout = setTimeout(() => {
            if (AppState.playlist.index < AppState.playlist.queue.length - 1) { AppState.playlist.index++; playCurrentQueueItem(); } 
            else document.getElementById('playback-status-text').innerText = "⏹ すべての再生が終了しました";
        }, 11000);
    }

    function skipNextPlayback() { if (AppState.playlist.index < AppState.playlist.queue.length - 1) { AppState.playlist.index++; playCurrentQueueItem(); } }
    function skipPrevPlayback() { if (AppState.playlist.index > 0) { AppState.playlist.index--; playCurrentQueueItem(); } }

    function updateDynamicPlaylist() {
        if (!AppState.playlist.active || AppState.ui.currentTab !== AppState.playlist.type) return;
        let newLogs = getPlaylistLogs(AppState.playlist.type); AppState.playlist.queue = newLogs;
        if (newLogs.length === 0) {
            document.getElementById('playback-status-text').innerText = "⏹ 該当する動画データがありません";
            clearTimeout(AppState.playlist.timeout); pauseManualVideo();
        } else { AppState.playlist.index = 0; playCurrentQueueItem(); }
    }

    function closePlaybackModal() {
        resetPlaylistUI();
        if (AppState.ui.currentTab !== 'input') document.getElementById('shared-video-area').style.display = 'none';
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
        
        if (db) saveToDB(); 
    }

    function saveToDB() {
        if (!db) return;
        const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME);
        store.put(AppState.data.players, 'players'); store.put(AppState.data.logs, 'log'); store.put(AppState.session.id, 'session');
        store.put(AppState.data.teams, 'teams'); 
        if (AppState.video.id) {
            store.put({ players: AppState.data.players, log: AppState.data.logs, playerCount: AppState.data.activePlayerCount, updatedAt: Date.now() }, 'proj_' + AppState.video.id);
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
        AppState.ui.selectedPlayerId = null; AppState.ui.statsPlayers = []; AppState.ui.comparePlayers = []; 
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
            AppState.data.logs = []; AppState.ui.selectedPlayerId = null; AppState.ui.statsPlayers = []; AppState.ui.comparePlayers = []; 
            AppState.data.activePlayerCount = 7; AppState.data.players = { ...AppConfig.DEFAULT_PLAYERS };
            resetInput(); AppState.session.id = "session_" + Date.now(); 
            if(!skipConfirm) resetTimerInternal(); 
            saveToLocal(); updateAfterDataLoad();
        }
    }

    function copyForYouTube() {
        if (AppState.data.logs.length === 0) { alert("コピーするデータがありません。"); return; }
        const logsWithTime = AppState.data.logs.filter(l => l.videoTime).sort((a, b) => {
            let ta = a.videoTime.split(':'), tb = b.videoTime.split(':');
            return (parseInt(ta[0])*60 + parseInt(ta[1])) - (parseInt(tb[0])*60 + parseInt(tb[1]));
        });
        if (logsWithTime.length === 0) { alert("動画の時間が記録されたデータがありません。"); return; }

        let copyText = "タイムスタンプ : 選手名 - プレー項目 - プレー結果\n";
        logsWithTime.forEach(l => {
            let parts = l.videoTime.split(':'); 
            let playSeconds = Math.max(0, (parseInt(parts[0]) * 60 + parseInt(parts[1])) - 8);
            let typeStr = l.type === 'serve' ? 'サーブ' : 
                          l.type === 'spike' ? 'スパイク' : 
                          l.type === 'serve_receive' ? 'サーブレシーブ' : 
                          l.type === 'receive' ? 'レシーブ' : 
                          l.type === 'toss' ? 'トス' : l.type;
            copyText += `${formatTime(playSeconds)} ${AppState.data.players[l.playerId]} : ${typeStr} - ${l.result}\n`;
        });
        navigator.clipboard.writeText(copyText).then(() => alert("クリップボードにコピーしました！\nYouTubeの動画説明欄にそのまま貼り付け(Ctrl+V)できます。"))
        .catch(err => alert("コピーに失敗しました。お使いのブラウザの権限を確認してください。"));
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

        initDB(() => {
            renderPlayerGrids(); updateLog(); draw('input-canvas');
            clearStatsDOM(); 
            drawStatsCanvas('serve'); drawStatsCanvas('spike'); 
            updateTimerDisplay();
            document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - (window.lastTouchEnd || 0) <= 300) e.preventDefault(); window.lastTouchEnd = now; }, false);
        });
    };