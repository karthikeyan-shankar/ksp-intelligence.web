/**
 * ═══════════════════════════════════════════════════
 *  KSP Crime Intelligence — Chat Logic
 *  Core chat controller: sends/receives messages,
 *  renders smart cards, handles session, and manages
 *  the complete chat lifecycle.
 * ═══════════════════════════════════════════════════
 */

(() => {
    'use strict';

    // ── State ────────────────────────────────────
    let session = null;       // { token, user }
    let sessionId = '';        // Chat session UUID
    let currentLang = 'en';    // 'en' or 'kn'
    let messages = [];         // Full message history for export
    let isProcessing = false;  // Prevent double-sends

    // ── DOM Elements ─────────────────────────────
    const $ = (id) => document.getElementById(id);
    const chatMessages   = $('chatMessages');
    const chatInput      = $('chatInput');
    const sendBtn        = $('sendBtn');
    const voiceBtn       = $('voiceBtn');
    const typingIndicator = $('typingIndicator');
    const suggestionChips = $('suggestionChips');
    const sidebar        = $('sidebar');
    const sidebarOverlay = $('sidebarOverlay');
    const hamburgerBtn   = $('hamburgerBtn');
    const exportBtn      = $('exportBtn');
    const langToggle     = $('langToggle');
    const langLabel      = $('langLabel');
    const logoutBtn      = $('logoutBtn');
    const authGuard      = $('authGuard');
    const headerUser     = $('headerUser');
    const userName       = $('userName');
    const userRole       = $('userRole');
    const userAvatar     = $('userAvatar');
    const sidebarSessionId = $('sidebarSessionId');

    // ── KSP AI Avatar SVG (reused in messages) ───
    const AI_AVATAR_SVG = `
        <svg viewBox="0 0 100 100" width="20" height="20" fill="none">
            <path d="M50 5 L90 20 L90 50 Q90 80 50 95 Q10 80 10 50 L10 20 Z"
                  fill="rgba(255,13,58,0.2)" stroke="#FF0D3A" stroke-width="2"/>
            <polygon points="50,30 53,39 63,39 55,45 58,55 50,49 42,55 45,45 37,39 47,39"
                     fill="#FF0D3A" opacity="0.8"/>
        </svg>`;

    // ═══════════════════════════════════════════════
    //  INITIALIZATION
    // ═══════════════════════════════════════════════

    function init() {
        // 1. Auth check
        const raw = localStorage.getItem('ksp_session');
        if (!raw) { window.location.href = 'index.html'; return; }

        try {
            session = JSON.parse(raw);
            if (!session || !session.token) throw new Error('No token');
        } catch (e) {
            localStorage.removeItem('ksp_session');
            window.location.href = 'index.html';
            return;
        }

        // 2. Show app (auth guard)
        authGuard.style.display = 'block';

        // 3. Set user info in header
        const user = session.user || {};
        userName.textContent = user.name || user.username || 'Officer';
        userRole.textContent = user.role || 'User';
        userAvatar.textContent = (user.name || user.username || 'O').charAt(0).toUpperCase();

        // 4. Generate session ID
        sessionId = generateSessionId();
        sidebarSessionId.textContent = sessionId.substring(0, 8) + '...';

        // 5. Show welcome message
        showWelcome(user);

        // 6. Bind events
        bindEvents();

        // 7. Init voice
        if (KSPVoice.isSupported()) {
            KSPVoice.init((transcript) => {
                if (transcript) sendMessage(transcript);
            });
        } else {
            voiceBtn.style.opacity = '0.3';
            voiceBtn.style.cursor = 'not-allowed';
            voiceBtn.title = 'Voice input not supported in this browser';
        }

        // 8. Focus input
        chatInput.focus();

        // 9. Load dashboard statistics
        fetchDashboardData();

        console.log('[KSP Chat] Initialized. Session:', sessionId);
    }

    // ═══════════════════════════════════════════════
    //  EVENT BINDING
    // ═══════════════════════════════════════════════

    function bindEvents() {
        // Send button
        sendBtn.addEventListener('click', () => {
            const text = chatInput.value.trim();
            if (text) sendMessage(text);
        });

        // Enter key
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = chatInput.value.trim();
                if (text) sendMessage(text);
            }
        });

        // Voice button
        voiceBtn.addEventListener('click', () => {
            if (KSPVoice.isSupported()) KSPVoice.toggle();
        });

        // Sidebar quick actions
        document.querySelectorAll('.sidebar-action-btn[data-query]').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                if (query) {
                    switchTab('chat');
                    sendMessage(query);
                }
                closeSidebar();
            });
        });

        // Suggestion chips
        document.querySelectorAll('.chip[data-query]').forEach(chip => {
            chip.addEventListener('click', () => {
                sendMessage(chip.dataset.query);
            });
        });

        // Export (sidebar)
        exportBtn.addEventListener('click', () => {
            KSPExport.exportChat(messages, session.user, sessionId);
            closeSidebar();
        });

        // Language toggle
        langToggle.addEventListener('click', () => toggleLanguage());

        // Logout
        logoutBtn.addEventListener('click', logout);

        // Hamburger menu (mobile)
        hamburgerBtn.addEventListener('click', toggleSidebar);
        sidebarOverlay.addEventListener('click', closeSidebar);

        // Tab Switching bindings (Sidebar & Bottom Nav)
        document.querySelectorAll('.sidebar-tab-btn, .mobile-bottom-nav .nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tabId = item.dataset.tab;
                if (tabId) {
                    switchTab(tabId);
                    closeSidebar();
                }
            });
        });

        // Profile Panel specific bindings
        const profLogout = $('profileLogoutBtn');
        const profExport = $('profileExportBtn');
        if (profLogout) profLogout.addEventListener('click', logout);
        if (profExport) profExport.addEventListener('click', () => KSPExport.exportChat(messages, session.user, sessionId));

        // Hotspot filtering bindings
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updateMapHotspots(btn.dataset.filter);
            });
        });

        // Map HUD close binding
        const hudCloseBtn = $('hudCloseBtn');
        if (hudCloseBtn) {
            hudCloseBtn.addEventListener('click', () => {
                $('mapHudPanel').style.display = 'none';
                resetMapZoom();
                document.querySelectorAll('.map-node').forEach(n => n.classList.remove('active'));
            });
        }

        // Map zoom controls
        const zoomInBtn = $('mapZoomIn');
        const zoomOutBtn = $('mapZoomOut');
        const zoomResetBtn = $('mapZoomReset');

        if (zoomInBtn) zoomInBtn.addEventListener('click', () => adjustMapZoom(0.2));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => adjustMapZoom(-0.2));
        if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetMapZoom);
    }

    // ═══════════════════════════════════════════════
    //  SPA TAB SWITCHING
    // ═══════════════════════════════════════════════

    let activeTabId = 'home';
    let globeInterval = null;
    let mapZoomScale = 1;
    let mapTranslateX = 0;
    let mapTranslateY = 0;

    function switchTab(tabId) {
        if (!tabId || tabId === activeTabId) return;

        // Update active classes in navigation items
        document.querySelectorAll('.sidebar-tab-btn, .mobile-bottom-nav .nav-item').forEach(item => {
            if (item.dataset.tab === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Toggle view panes
        document.querySelectorAll('.view-pane').forEach(pane => {
            if (pane.id === 'pane' + tabId.charAt(0).toUpperCase() + tabId.slice(1)) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        activeTabId = tabId;

        // Perform specific tab initialization
        if (tabId === 'home') {
            fetchDashboardData();
        } else if (tabId === 'hotspot') {
            triggerGlobeAnimation();
        } else if (tabId === 'profile') {
            // Update profile info card
            const user = session.user || {};
            $('profileName').textContent = user.name || user.username || 'Officer';
            $('profileRole').textContent = user.role || 'User';
        }
    }

    // ═══════════════════════════════════════════════
    //  DASHBOARD STATISTICS FETCH
    // ═══════════════════════════════════════════════

    async function fetchDashboardData() {
        try {
            const response = await fetch('/api/stats/overview', {
                headers: { 'Authorization': 'Bearer ' + session.token }
            });
            if (!response.ok) return;
            const data = await response.json();

            // Update KPI numbers
            $('kpiTotalCases').textContent = formatNumber(data.totalFIRs || data.totalFirs);
            $('kpiActiveCases').textContent = formatNumber(data.openCases || data.activeCases);
            $('kpiSolvedCases').textContent = formatNumber(data.closedCases || data.solvedCases);
            $('kpiRepeatOffenders').textContent = formatNumber(data.repeatOffenders);
            
            // Set officer header
            const user = session.user || {};
            document.querySelectorAll('.officer-name-highlight').forEach(el => {
                el.textContent = user.name || user.username || 'Officer';
            });

            // Fetch district list for dashboard progress bars
            const distRes = await fetch('/api/stats/by-district', {
                headers: { 'Authorization': 'Bearer ' + session.token }
            });
            if (distRes.ok) {
                const dists = await distRes.json();
                const distListEl = $('dashboardDistricts');
                if (distListEl && dists.length > 0) {
                    distListEl.innerHTML = '';
                    const maxVal = dists[0].count || 1;
                    dists.slice(0, 4).forEach(d => {
                        const pct = Math.round((d.count / maxVal) * 100);
                        distListEl.innerHTML += `
                            <div class="district-progress-item animate-fade-in">
                                <div class="district-info">
                                    <span>${d.district}</span>
                                    <span>${formatNumber(d.count)} cases</span>
                                </div>
                                <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>
                            </div>
                        `;
                    });
                }
            }
        } catch (e) {
            console.error('[Dashboard] Stats fetch error:', e);
        }
    }

    // ═══════════════════════════════════════════════
    //  TACTICAL GLOBE & SATELLITE SCAN ANIMATION
    // ═══════════════════════════════════════════════

    function triggerGlobeAnimation() {
        const overlay = $('globeOverlay');
        const canvas = $('globeCanvas');
        if (!overlay || !canvas) return;

        // Reset overlay state
        overlay.classList.remove('zoom-lock');
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.transform = 'scale(1)';

        const ctx = canvas.getContext('2d');
        let width = canvas.width = overlay.offsetWidth;
        let height = canvas.height = overlay.offsetHeight || 380;

        let frame = 0;
        let lockTime = 0;
        let isLocked = false;
        
        let R = 120; // Globe base radius
        const D = 400; // Perspective depth
        const tilt = 23.5 * Math.PI / 180; // Earth axis tilt

        if (globeInterval) clearInterval(globeInterval);

        globeInterval = setInterval(() => {
            frame++;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // Base center of projection
            let baseX = width / 2;
            let baseY = height / 2;
            
            // 3D rotation angle
            let angle = (frame * 1.2) * Math.PI / 180;

            // Target coordinate: Karnataka (12.97° N, 77.59° E)
            // Align targetLng to face camera at frame 50 when locking starts
            let targetLat = 13.5 * Math.PI / 180;
            let targetLngOnGlobe = -60 * Math.PI / 180; // Facing front when rotation matches
            let currentTargetLng = targetLngOnGlobe + angle;

            // Target 3D coordinates relative to globe center
            let tx = R * Math.cos(targetLat) * Math.sin(currentTargetLng);
            let ty = R * Math.sin(targetLat);
            let tz = R * Math.cos(targetLat) * Math.cos(currentTargetLng);

            // Apply Earth tilt (rotate around X-axis)
            let tyt = ty * Math.cos(tilt) - tz * Math.sin(tilt);
            let tzt = ty * Math.sin(tilt) + tz * Math.cos(tilt);

            // Perspective scale
            let tscale = D / (D + tzt);
            let rx = tx * tscale;
            let ry = tyt * tscale;

            // Shift camera center towards target if locked
            let centerX = baseX;
            let centerY = baseY;
            if (isLocked) {
                lockTime++;
                let tProgress = Math.min(lockTime / 40, 1);
                // Ease progress
                let easeProgress = tProgress * tProgress * (3 - 2 * tProgress);
                centerX = baseX - rx * easeProgress;
                centerY = baseY + ry * easeProgress;

                // Zoom scale R
                let zoomFactor = 1 + easeProgress * 15;
                R = 120 * zoomFactor;
            }

            // Target screen coordinates
            let tsx = centerX + rx;
            let tsy = centerY - ry;
            let isTargetFront = tzt > 0;

            // Project 3D coordinate function
            function getProjectedPoint(latDeg, lngDeg) {
                let rLat = latDeg * Math.PI / 180;
                let rLng = (lngDeg * Math.PI / 180) + angle;
                
                let x = R * Math.cos(rLat) * Math.sin(rLng);
                let y = R * Math.sin(rLat);
                let z = R * Math.cos(rLat) * Math.cos(rLng);
                
                let yt = y * Math.cos(tilt) - z * Math.sin(tilt);
                let zt = y * Math.sin(tilt) + z * Math.cos(tilt);
                
                let scaleFactor = D / (D + zt);
                let sx = centerX + x * scaleFactor;
                let sy = centerY - yt * scaleFactor;
                
                return { x: sx, y: sy, z: zt };
            }

            // Draw holographic glowing atmosphere horizon
            let atmGrad = ctx.createRadialGradient(centerX, centerY, R * 0.9, centerX, centerY, R * 1.15);
            atmGrad.addColorStop(0, 'rgba(255, 13, 58, 0)');
            atmGrad.addColorStop(0.65, 'rgba(255, 13, 58, 0.12)');
            atmGrad.addColorStop(0.85, 'rgba(255, 13, 58, 0.22)');
            atmGrad.addColorStop(1, 'rgba(255, 13, 58, 0)');
            ctx.fillStyle = atmGrad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, R * 1.2, 0, Math.PI * 2);
            ctx.fill();

            // 1. Draw Latitudinal rings
            for (let lat = -75; lat <= 75; lat += 15) {
                ctx.beginPath();
                let started = false;
                for (let lng = 0; lng <= 360; lng += 8) {
                    let pt = getProjectedPoint(lat, lng);
                    if (pt.z > -40) { // front hemisphere margin
                        if (!started) {
                            ctx.moveTo(pt.x, pt.y);
                            started = true;
                        } else {
                            ctx.lineTo(pt.x, pt.y);
                        }
                    } else {
                        started = false;
                    }
                }
                ctx.strokeStyle = `rgba(255, 13, 58, ${isLocked ? 0.08 : 0.15})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // 2. Draw Longitudinal rings
            for (let lng = 0; lng < 360; lng += 20) {
                ctx.beginPath();
                let started = false;
                for (let lat = -90; lat <= 90; lat += 5) {
                    let pt = getProjectedPoint(lat, lng);
                    if (pt.z > -40) {
                        if (!started) {
                            ctx.moveTo(pt.x, pt.y);
                            started = true;
                        } else {
                            ctx.lineTo(pt.x, pt.y);
                        }
                    } else {
                        started = false;
                    }
                }
                ctx.strokeStyle = `rgba(255, 13, 58, ${isLocked ? 0.08 : 0.15})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // 3. Draw sparse glowing data hotspots
            const cities = [
                { lat: 12.97, lng: 77.59, label: 'BENGALURU' },
                { lat: 15.36, lng: 75.12, label: 'HUBBALLI' },
                { lat: 12.31, lng: 76.65, label: 'MYSURU' },
                { lat: 12.91, lng: 74.85, label: 'MANGALURU' },
                { lat: 17.32, lng: 76.83, label: 'KALABURAGI' },
                { lat: 15.84, lng: 74.49, label: 'BELAGAVI' }
            ];

            cities.forEach((city, idx) => {
                let latOffset = city.lat - 12.97;
                let lngOffset = city.lng - 77.59;
                let pt = getProjectedPoint(13.5 + latOffset, (targetLngOnGlobe * 180 / Math.PI) + lngOffset);
                
                if (pt.z > 0) {
                    let pulse = Math.abs(Math.sin(frame * 0.08 + idx));
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + pulse * 0.6})`;
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 2 + pulse * 1.5, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = `rgba(255, 13, 58, ${0.4 - pulse * 0.4})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 4 + pulse * 8, 0, Math.PI * 2);
                    ctx.stroke();

                    if (!isLocked) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                        ctx.font = '7px monospace';
                        ctx.fillText(city.label, pt.x + 8, pt.y + 3);
                    }
                }
            });

            // 4. Draw lock-on reticle
            if (isTargetFront && frame >= 20) {
                let boxSize = isLocked ? 20 : Math.max(120 - (frame - 20) * 3.8, 20);
                
                ctx.strokeStyle = isLocked ? '#FF0D3A' : 'rgba(255, 13, 58, 0.7)';
                ctx.lineWidth = isLocked ? 2 : 1;
                
                ctx.beginPath();
                // Top-Left
                ctx.moveTo(tsx - boxSize, tsy - boxSize + 6);
                ctx.lineTo(tsx - boxSize, tsy - boxSize);
                ctx.lineTo(tsx - boxSize + 6, tsy - boxSize);
                // Top-Right
                ctx.moveTo(tsx + boxSize, tsy - boxSize + 6);
                ctx.lineTo(tsx + boxSize, tsy - boxSize);
                ctx.lineTo(tsx + boxSize - 6, tsy - boxSize);
                // Bottom-Left
                ctx.moveTo(tsx - boxSize, tsy + boxSize - 6);
                ctx.lineTo(tsx - boxSize, tsy + boxSize);
                ctx.lineTo(tsx - boxSize + 6, tsy + boxSize);
                // Bottom-Right
                ctx.moveTo(tsx + boxSize, tsy + boxSize - 6);
                ctx.lineTo(tsx + boxSize, tsy + boxSize);
                ctx.lineTo(tsx + boxSize - 6, tsy + boxSize);
                ctx.stroke();

                ctx.fillStyle = isLocked ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)';
                ctx.font = '9px monospace';
                ctx.fillText(`TARGET: KARNATAKA_HQ`, tsx + boxSize + 8, tsy - 4);
                ctx.fillStyle = '#FF0D3A';
                ctx.fillText(`COORD: 12.9716° N / 77.5946° E`, tsx + boxSize + 8, tsy + 6);
                if (isLocked) {
                    ctx.fillStyle = '#00D4AA';
                    ctx.fillText(`STATUS: LOCKED`, tsx + boxSize + 8, tsy + 16);
                } else {
                    ctx.fillStyle = '#FF6B35';
                    ctx.fillText(`STATUS: SCANNING COORDS...`, tsx + boxSize + 8, tsy + 16);
                }
            }

            // 5. Render High-Tech Tactical HUD Text & Data Metrics
            ctx.fillStyle = 'rgba(255, 13, 58, 0.85)';
            ctx.font = '9px monospace';
            ctx.fillText(`SYS: KSP_ORBITAL_SCAN_v2.5`, 20, 30);
            ctx.fillText(`SATELLITE: IND_INSAT_3DR`, 20, 42);
            ctx.fillText(`ALTITUDE: ${formatNumber(Math.max(35786 - (isLocked ? lockTime * 850 : 0), 120))} KM`, 20, 54);
            ctx.fillText(`GRID RESOLUTION: 10M Lidar`, 20, 66);
            ctx.fillText(`SWEEP SCAN STATUS: ACTIVE`, 20, 78);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.fillText(`RAG DATA INDEX: LOGGED (520 FIRs)`, width - 210, 30);
            ctx.fillText(`LLM PIPELINE: GEMMA-2B ACTIVE`, width - 210, 42);
            ctx.fillText(`PING: 14ms (SSL_SECURE)`, width - 210, 54);
            ctx.fillText(`MODE: SATELLITE DEEP LOCK`, width - 210, 66);
            ctx.fillText(`FPS: 33.3 (FRAME_${frame})`, width - 210, 78);

            // Draw lock status message
            if (isLocked) {
                ctx.font = 'bold 12px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`LOCK ACQUIRED - INITIATING GROUND OVERFLIGHT ZOOM`, width / 2, height - 30);
                ctx.textAlign = 'left'; // reset
            }

            // Lock trigger logic
            if (frame >= 50 && !isLocked) {
                isLocked = true;
            }

            if (isLocked) {
                overlay.style.opacity = (1 - (lockTime / 40)).toString();
                overlay.style.transform = `scale(${1 + lockTime * 0.05})`;

                if (lockTime > 40) { // complete transition
                    clearInterval(globeInterval);
                    globeInterval = null;
                    overlay.style.display = 'none';
                    initHotspotMap();
                }
            }
        }, 30);
    }

    // ═══════════════════════════════════════════════
    //  TACTICAL MAP CONTROLLER (SVG GEOSPATIAL MAP)
    // ═══════════════════════════════════════════════

    let districtStats = {};

    async function initHotspotMap() {
        resetMapZoom();
        
        // Fetch current cases by district
        try {
            const res = await fetch('/api/stats/by-district', {
                headers: { 'Authorization': 'Bearer ' + session.token }
            });
            if (res.ok) {
                const dists = await res.json();
                districtStats = {};
                dists.forEach(d => {
                    districtStats[d.district] = d.count;
                });
            }
        } catch (e) { console.warn('[Map] Failed fetching district stats', e); }

        // Bind interactive mouse click on map node circles
        document.querySelectorAll('.map-node').forEach(node => {
            const distName = node.dataset.district;
            
            // Set initial scale/pulse based on mock counts
            const count = districtStats[distName] || Math.round(Math.random() * 20 + 2);
            const radius = Math.min(Math.max(count / 10 + 3, 5), 24);
            
            const baseCircle = node.querySelector('.hotspot-base');
            const pulseCircle = node.querySelector('.hotspot-pulse');
            if (baseCircle) baseCircle.setAttribute('r', radius);
            if (pulseCircle) pulseCircle.setAttribute('r', radius);

            node.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Highlight active district
                document.querySelectorAll('.map-node').forEach(n => n.classList.remove('active'));
                node.classList.add('active');
                
                // Zoom in Google Earth-style to the node coordinates
                const x = parseFloat(node.dataset.x);
                const y = parseFloat(node.dataset.y);
                zoomToCoordinates(x, y, 2.0);

                // Show tactical HUD details
                showMapHud(distName, count);
            });
        });

        // Initialize general map clicks to close details
        const mapWrapper = $('mapViewWrapper');
        if (mapWrapper) {
            mapWrapper.addEventListener('click', () => {
                $('mapHudPanel').style.display = 'none';
                resetMapZoom();
                document.querySelectorAll('.map-node').forEach(n => n.classList.remove('active'));
            });
        }

        // Initialize display list details
        updateMapHotspots('All');
    }

    function updateMapHotspots(category) {
        let totalFiltered = 520;
        
        // Simulating data updates based on crime category filter
        const categoryMultipliers = {
            'All': 1.0,
            'Theft': 0.35,
            'Murder': 0.08,
            'Cyber Crime': 0.18,
            'Robbery': 0.12,
            'Assault': 0.22
        };

        const mult = categoryMultipliers[category] || 1.0;
        totalFiltered = Math.round(520 * mult);
        const countText = $('hotspotCountText');
        if (countText) countText.textContent = totalFiltered;

        // Scale nodes accordingly
        document.querySelectorAll('.map-node').forEach(node => {
            const distName = node.dataset.district;
            const baseCount = districtStats[distName] || Math.round(Math.random() * 20 + 2);
            const count = Math.max(Math.round(baseCount * mult), 0);
            
            const baseCircle = node.querySelector('.hotspot-base');
            const pulseCircle = node.querySelector('.hotspot-pulse');
            const coreCircle = node.querySelector('.hotspot-core');
            
            if (count === 0) {
                if (baseCircle) baseCircle.setAttribute('r', 0);
                if (pulseCircle) pulseCircle.style.display = 'none';
                if (coreCircle) coreCircle.setAttribute('r', 0);
            } else {
                const radius = Math.min(Math.max(count / 10 + 3, 5), 24);
                if (baseCircle) baseCircle.setAttribute('r', radius);
                if (pulseCircle) {
                    pulseCircle.style.display = 'block';
                    pulseCircle.setAttribute('r', radius);
                }
                if (coreCircle) coreCircle.setAttribute('r', radius > 10 ? 4 : 2.5);
            }
        });

        // Auto focus top district for the filter
        if (category === 'Theft' || category === 'Cyber Crime') {
            // Focus Bangalore
            zoomToCoordinates(330, 480, 1.8);
            showMapHud('Bengaluru Urban', Math.round(234 * mult), category);
        } else if (category === 'Murder') {
            // Focus Kalaburagi
            zoomToCoordinates(350, 80, 1.8);
            showMapHud('Kalaburagi', Math.round(64 * mult), category);
        } else {
            resetMapZoom();
            $('mapHudPanel').style.display = 'none';
        }
    }

    function showMapHud(district, count, category = 'All') {
        const hud = $('mapHudPanel');
        if (!hud) return;

        $('hudDistrictName').textContent = district;
        $('hudTotalCrimes').textContent = count + ' Cases';
        $('hudTopCrime').textContent = category !== 'All' ? category : 'Theft (General)';
        
        const riskEl = $('hudRiskIndex');
        if (count > 80) {
            riskEl.textContent = 'HIGH RISK';
            riskEl.style.color = '#FF0D3A';
            riskEl.style.background = 'rgba(255, 13, 58, 0.15)';
        } else if (count > 25) {
            riskEl.textContent = 'ELEVATED';
            riskEl.style.color = '#FF6B35';
            riskEl.style.background = 'rgba(255, 107, 53, 0.15)';
        } else {
            riskEl.textContent = 'STABLE';
            riskEl.style.color = '#00D4AA';
            riskEl.style.background = 'rgba(0, 212, 170, 0.15)';
        }

        hud.style.display = 'block';
    }

    function zoomToCoordinates(x, y, scale) {
        const mapContainer = $('svgMapContainer');
        if (!mapContainer) return;

        mapZoomScale = scale;
        // Invert translations to center on coordinate
        // Base width 500, height 600
        mapTranslateX = (250 - x) * scale;
        mapTranslateY = (300 - y) * scale;
        
        applyMapTransform();
    }

    function adjustMapZoom(delta) {
        mapZoomScale = Math.min(Math.max(mapZoomScale + delta, 0.8), 4);
        applyMapTransform();
    }

    function resetMapZoom() {
        mapZoomScale = 1;
        mapTranslateX = 0;
        mapTranslateY = 0;
        applyMapTransform();
    }

    function applyMapTransform() {
        const mapContainer = $('svgMapContainer');
        if (mapContainer) {
            mapContainer.style.transform = `translate(${mapTranslateX}px, ${mapTranslateY}px) scale(${mapZoomScale})`;
        }
    }


    // ═══════════════════════════════════════════════
    //  MESSAGE SENDING
    // ═══════════════════════════════════════════════

    async function sendMessage(text) {
        if (!text || isProcessing) return;
        isProcessing = true;

        // Clear input
        chatInput.value = '';
        chatInput.focus();

        // Hide suggestion chips after first message
        suggestionChips.style.display = 'none';

        // Render user message
        const timeStr = formatTime(new Date());
        renderMessage('user', text, timeStr);
        messages.push({ role: 'user', content: text, time: timeStr });

        // Show typing indicator
        showTypingIndicator();
        scrollToBottom();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + session.token
                },
                body: JSON.stringify({
                    message: text,
                    sessionId: sessionId,
                    language: currentLang
                })
            });

            if (res.status === 401) {
                logout();
                return;
            }

            const data = await res.json();
            hideTypingIndicator();

            if (!res.ok) {
                throw new Error(data.error || 'Server error');
            }

            // Render AI response
            const aiTime = formatTime(new Date());
            renderAIResponse(data, aiTime);
            messages.push({ role: 'ai', content: data.response, time: aiTime });

        } catch (err) {
            hideTypingIndicator();
            const errTime = formatTime(new Date());
            renderMessage('ai', 'SYSTEM ERROR: ' + err.message + '. Please try again.', errTime);
            messages.push({ role: 'ai', content: 'Error: ' + err.message, time: errTime });
        } finally {
            isProcessing = false;
            scrollToBottom();
        }
    }

    // ═══════════════════════════════════════════════
    //  MESSAGE RENDERING
    // ═══════════════════════════════════════════════

    function renderMessage(role, content, time) {
        const wrapper = document.createElement('div');
        wrapper.className = `message message--${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';

        if (role === 'user') {
            avatar.textContent = (session.user?.name || 'O').charAt(0).toUpperCase();
        } else {
            avatar.innerHTML = AI_AVATAR_SVG;
        }

        const bubbleWrap = document.createElement('div');

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = formatMessageContent(content);

        const timeEl = document.createElement('div');
        timeEl.className = 'message-time';
        timeEl.textContent = time;

        bubbleWrap.appendChild(bubble);
        bubbleWrap.appendChild(timeEl);

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubbleWrap);

        chatMessages.appendChild(wrapper);
        scrollToBottom();
    }

    /**
     * Render a full AI response with optional smart cards
     */
    function renderAIResponse(data, time) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message message--ai';

        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = AI_AVATAR_SVG;

        const bubbleWrap = document.createElement('div');
        bubbleWrap.style.flex = '1';
        bubbleWrap.style.minWidth = '0';

        // Text bubble
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = formatMessageContent(data.response);

        bubbleWrap.appendChild(bubble);

        // Smart cards based on visualType
        if (data.visualType && data.visualData) {
            const cardEl = renderSmartCard(data.visualType, data.visualData);
            if (cardEl) {
                bubble.appendChild(cardEl);
            }
        }

        // Confidence bar
        if (data.confidence != null) {
            bubble.appendChild(renderConfidenceBar(data.confidence));
        }

        // SQL audit badge
        if (data.sql) {
            bubble.appendChild(renderSQLBadge(data.sql));
        }

        // Time
        const timeEl = document.createElement('div');
        timeEl.className = 'message-time';
        timeEl.textContent = time;
        bubbleWrap.appendChild(timeEl);

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubbleWrap);
        chatMessages.appendChild(wrapper);
    }

    // ═══════════════════════════════════════════════
    //  SMART CARD RENDERING
    // ═══════════════════════════════════════════════

    function renderSmartCard(type, data) {
        switch (type) {
            case 'stats':   return renderStatCards(data);
            case 'table':   return renderTableCard(data);
            case 'alert':   return renderAlertCard(data);
            case 'network': return renderNetworkCard(data);
            default:        return null;
        }
    }

    /**
     * Stat cards — grid of number + label + trend
     */
    function renderStatCards(data) {
        const items = data.items || data;
        if (!Array.isArray(items) || items.length === 0) return null;

        const grid = document.createElement('div');
        grid.className = 'smart-cards';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'stat-card';

            const value = document.createElement('div');
            value.className = 'stat-card__value';
            value.textContent = formatNumber(item.value);

            const label = document.createElement('div');
            label.className = 'stat-card__label';
            label.textContent = item.label || '';

            card.appendChild(value);
            card.appendChild(label);

            if (item.trend != null) {
                const trend = document.createElement('div');
                const isUp = item.trend > 0;
                trend.className = 'stat-card__trend ' + (isUp ? 'stat-card__trend--up' : 'stat-card__trend--down');
                trend.textContent = (isUp ? '↑' : '↓') + ' ' + Math.abs(item.trend) + '%';
                card.appendChild(trend);
            }

            grid.appendChild(card);
        });

        return grid;
    }

    /**
     * Table card — formatted data table
     */
    function renderTableCard(data) {
        const headers = data.headers || [];
        const rows = data.rows || [];
        if (headers.length === 0 || rows.length === 0) return null;

        const container = document.createElement('div');
        container.className = 'table-card';

        const table = document.createElement('table');
        table.className = 'data-table';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        rows.forEach(row => {
            const tr = document.createElement('tr');
            const cells = Array.isArray(row) ? row : Object.values(row);
            cells.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell != null ? String(cell) : '—';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        container.appendChild(table);
        return container;
    }

    /**
     * Alert card — warning/danger/info styled card
     */
    function renderAlertCard(data) {
        const alerts = Array.isArray(data) ? data : [data];

        const fragment = document.createDocumentFragment();

        alerts.forEach(alert => {
            const level = alert.level || 'info';
            const card = document.createElement('div');
            card.className = 'alert-card alert-card--' + level;

            const icon = document.createElement('div');
            icon.className = 'alert-card__icon';
            const alertIcons = {
                danger: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke: var(--accent-red); vertical-align: middle;"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
                warning: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke: var(--accent-orange); vertical-align: middle;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
                success: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke: var(--accent-green); vertical-align: middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
                info: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke: var(--accent-blue); vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
            };
            icon.innerHTML = alertIcons[level] || alertIcons.info;

            const content = document.createElement('div');
            content.className = 'alert-card__content';

            const title = document.createElement('div');
            title.className = 'alert-card__title';
            title.textContent = alert.title || 'Alert';

            const text = document.createElement('div');
            text.className = 'alert-card__text';
            text.textContent = alert.message || alert.text || '';

            content.appendChild(title);
            content.appendChild(text);
            card.appendChild(icon);
            card.appendChild(content);
            fragment.appendChild(card);
        });

        return fragment;
    }

    /**
     * Network card — placeholder for future graph visualization
     */
    function renderNetworkCard(data) {
        const card = document.createElement('div');
        card.className = 'network-card';

        const icon = document.createElement('div');
        icon.className = 'network-card__icon';
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke: var(--accent-red); vertical-align: middle;"><circle cx="12" cy="12" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="6" cy="18" r="3"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="6" y1="9" x2="6" y2="15"/><line x1="18" y1="9" x2="18" y2="15"/></svg>`;

        const text = document.createElement('div');
        text.className = 'network-card__text';
        text.innerHTML = '<strong>Criminal Network Analysis</strong><br>' +
            (data.description || 'Network visualization will be available here.') +
            '<br><br>' +
            (data.nodes ? `<em>${data.nodes} nodes, ${data.edges || 0} connections identified</em>` : '');

        card.appendChild(icon);
        card.appendChild(text);
        return card;
    }

    /**
     * Confidence bar
     */
    function renderConfidenceBar(confidence) {
        const pct = Math.round(confidence * 100);
        const color = pct >= 80 ? 'var(--accent-green)' :
                      pct >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)';

        const bar = document.createElement('div');
        bar.className = 'confidence-bar';
        bar.innerHTML = `
            <span class="confidence-bar__label">Confidence</span>
            <div class="confidence-bar__track">
                <div class="confidence-bar__fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <span class="confidence-bar__value">${pct}%</span>
        `;
        return bar;
    }

    /**
     * SQL audit badge (collapsible)
     */
    function renderSQLBadge(sql) {
        const container = document.createElement('div');

        const badge = document.createElement('div');
        badge.className = 'sql-badge';
        const searchSvg = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sql-badge__svg" style="vertical-align: middle; margin-right: 4px; display: inline-block;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
        badge.innerHTML = `<span class="sql-badge__icon">${searchSvg}</span> View Generated SQL`;

        const expanded = document.createElement('div');
        expanded.className = 'sql-expanded';
        expanded.textContent = sql;

        badge.addEventListener('click', () => {
            expanded.classList.toggle('show');
            badge.innerHTML = expanded.classList.contains('show')
                ? `<span class="sql-badge__icon">${searchSvg}</span> Hide SQL`
                : `<span class="sql-badge__icon">${searchSvg}</span> View Generated SQL`;
        });

        container.appendChild(badge);
        container.appendChild(expanded);
        return container;
    }

    // ═══════════════════════════════════════════════
    //  WELCOME MESSAGE
    // ═══════════════════════════════════════════════

    function showWelcome(user) {
        const officerName = user.name || user.username || 'Officer';

        const welcomeHtml = `
            <div class="welcome-message">
                <div class="welcome-card">
                    <div class="welcome-icon"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                    <div class="welcome-title">Welcome, ${escapeHtml(officerName)}</div>
                    <div class="welcome-subtitle">
                        I'm the KSP Crime Intelligence Assistant. How can I help you today?
                    </div>
                    <div class="welcome-capabilities">
                        <div class="capability-item">
                            <span class="capability-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
                            <span>Crime statistics & trend analysis</span>
                        </div>
                        <div class="capability-item">
                            <span class="capability-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                            <span>Suspect information & criminal networks</span>
                        </div>
                        <div class="capability-item">
                            <span class="capability-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></span>
                            <span>FIR record lookups & case details</span>
                        </div>
                        <div class="capability-item">
                            <span class="capability-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg></span>
                            <span>District-wise crime analysis</span>
                        </div>
                        <div class="capability-item">
                            <span class="capability-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></span>
                            <span>Predictive insights & anomaly detection</span>
                        </div>
                    </div>
                    <div class="welcome-hint">
                        Try asking: <strong>"How many thefts happened in Bangalore this year?"</strong>
                    </div>
                </div>
            </div>
        `;

        chatMessages.innerHTML = welcomeHtml;
    }

    // ═══════════════════════════════════════════════
    //  TYPING INDICATOR
    // ═══════════════════════════════════════════════

    function showTypingIndicator() {
        typingIndicator.classList.add('show');
        scrollToBottom();
    }

    function hideTypingIndicator() {
        typingIndicator.classList.remove('show');
    }

    // ═══════════════════════════════════════════════
    //  SIDEBAR
    // ═══════════════════════════════════════════════

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('show');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('show');
    }

    // ═══════════════════════════════════════════════
    //  LANGUAGE TOGGLE
    // ═══════════════════════════════════════════════

    function toggleLanguage() {
        currentLang = currentLang === 'en' ? 'kn' : 'en';
        langLabel.textContent = currentLang === 'en' ? 'English' : 'ಕನ್ನಡ';
        KSPVoice.setLanguage(currentLang);
        console.log('[KSP Chat] Language switched to:', currentLang);
    }

    // ═══════════════════════════════════════════════
    //  LOGOUT
    // ═══════════════════════════════════════════════

    function logout() {
        localStorage.removeItem('ksp_session');
        window.location.href = 'index.html';
    }

    // ═══════════════════════════════════════════════
    //  UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════

    function scrollToBottom() {
        requestAnimationFrame(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    function generateSessionId() {
        // Simple UUID-like ID
        return 'ksp-' + Date.now().toString(36) + '-' +
               Math.random().toString(36).substring(2, 9);
    }

    function formatTime(date) {
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    function formatNumber(num) {
        if (num == null) return '—';
        const n = Number(num);
        if (isNaN(n)) return String(num);
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toLocaleString('en-IN');
    }

    function formatMessageContent(text) {
        if (!text) return '';

        // Basic markdown-like formatting
        let html = escapeHtml(text);

        // Bold: **text** or __text__
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

        // Italic: *text* or _text_
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Code: `text`
        html = html.replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-size:12px;">$1</code>');

        // Bullet points: lines starting with • or -
        html = html.replace(/^[•\-]\s+(.+)/gm, '<div style="padding-left:16px;position:relative;margin:3px 0;">• $1</div>');

        // Newlines
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text || ''));
        return div.innerHTML;
    }

    // ═══════════════════════════════════════════════
    //  BOOT
    // ═══════════════════════════════════════════════

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
