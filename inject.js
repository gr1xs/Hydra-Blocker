/**
 * Hydra Blocker - Injector Script
 * Injected at document_start to hook Worker creation and patch Twitch's media worker thread.
 */
(function() {
    if (/(^|\.)twitch\.tv$/.test(document.location.hostname) === false) { return; }

    // Ensure we run in the main frame and not in nested iframe advertising context
    let isNested = false;
    try { isNested = window.frameElement !== null; } catch (e) { isNested = true; }
    if (isNested) {
        const host = document.location.hostname;
        const isEmbed = host === 'player.twitch.tv' || host === 'embed.twitch.tv' || document.location.pathname.startsWith('/embed/');
        if (!isEmbed) {
            return;
        }
    }

    const HYDRA_VERSION = 101;
    console.log(`[Hydra Shield] Ingesting Media Shield v${HYDRA_VERSION}`);

    if (window.hydraShieldVersion && window.hydraShieldVersion >= HYDRA_VERSION) {
        console.warn("[Hydra Shield] Warning: Hydra active, skipping duplicate injection.");
        return;
    }
    window.hydraShieldVersion = HYDRA_VERSION;

    // -------------------------------------------------------------
    // Hydra Video Overlay Badge (Saved Time Popup Indicator)
    // -------------------------------------------------------------
    let hydraStyleElement = null;
    let hydraBadgeElement = null;

    function injectHydraStyle() {
        if (hydraStyleElement) return;
        hydraStyleElement = document.createElement('style');
        hydraStyleElement.textContent = `
            .hydra-badge {
                position: absolute;
                bottom: 80px;
                right: 20px;
                background: rgba(15, 15, 22, 0.85);
                backdrop-filter: blur(12px) saturate(180%);
                -webkit-backdrop-filter: blur(12px) saturate(180%);
                border: 1px solid rgba(0, 255, 102, 0.4);
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 255, 102, 0.25);
                border-radius: 12px;
                padding: 10px 16px;
                color: #ffffff;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 13px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 9999;
                pointer-events: none;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                transform: translateY(10px) scale(0.95);
                opacity: 0;
            }
            .hydra-badge.visible {
                transform: translateY(0) scale(1);
                opacity: 1;
            }
            .hydra-pulse {
                width: 8px;
                height: 8px;
                background-color: #00ff66;
                border-radius: 50%;
                box-shadow: 0 0 0 0 rgba(0, 255, 102, 0.7);
                animation: hydra-pulse-anim 1.6s infinite;
            }
            @keyframes hydra-pulse-anim {
                0% {
                    transform: scale(0.95);
                    box-shadow: 0 0 0 0 rgba(0, 255, 102, 0.7);
                }
                70% {
                    transform: scale(1);
                    box-shadow: 0 0 0 8px rgba(0, 255, 102, 0);
                }
                100% {
                    transform: scale(0.95);
                    box-shadow: 0 0 0 0 rgba(0, 255, 102, 0);
                }
            }
            .hydra-badge-title {
                font-weight: 700;
                color: #00ff66;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                font-size: 10px;
            }
            .hydra-badge-stats {
                color: #e5e5e5;
                font-size: 12px;
            }
        `;
        document.head.appendChild(hydraStyleElement);
    }

    function updateHydraBadge(hasAds, strippedCount, backupType) {
        try {
            injectHydraStyle();
            
            const playerContainer = document.querySelector('.video-player__container') || 
                                    document.querySelector('.highwind-video-player') ||
                                    document.querySelector('video')?.parentElement;
            
            if (!playerContainer) return;

            if (!hydraBadgeElement || !hydraBadgeElement.parentElement) {
                hydraBadgeElement = document.createElement('div');
                hydraBadgeElement.className = 'hydra-badge';
                hydraBadgeElement.innerHTML = `
                    <div class="hydra-pulse"></div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span class="hydra-badge-title">Hydra Blocker Shielded</span>
                        <span class="hydra-badge-stats" id="hydra-stats-text">Bypassing ad stream...</span>
                    </div>
                `;
                playerContainer.appendChild(hydraBadgeElement);
            }

            const statsText = hydraBadgeElement.querySelector('#hydra-stats-text');
            if (hasAds) {
                const secondsSaved = (strippedCount || 0) * 2;
                const method = backupType ? `Alternative Stream (${backupType})` : 'Segment Stripping';
                statsText.textContent = `Blocked ${strippedCount} ads • Saved ${secondsSaved}s (${method})`;
                
                // Add visible class
                setTimeout(() => {
                    if (hydraBadgeElement) hydraBadgeElement.classList.add('visible');
                }, 50);
            } else {
                if (hydraBadgeElement) {
                    hydraBadgeElement.classList.remove('visible');
                    const badgeToRemove = hydraBadgeElement;
                    setTimeout(() => {
                        if (badgeToRemove && !badgeToRemove.classList.contains('visible')) {
                            badgeToRemove.remove();
                            if (hydraBadgeElement === badgeToRemove) hydraBadgeElement = null;
                        }
                    }, 500);
                }
            }
        } catch (err) {
            console.error("[Hydra Shield] Error updating overlay badge:", err);
        }
    }

    // -------------------------------------------------------------
    // Player Reload & Recovery Logic (Main Thread side)
    // -------------------------------------------------------------
    let lastReloadTime = 0;
    const reloadCooldownMs = 15000;

    function findTwitchPlayer() {
        try {
            const containers = document.querySelectorAll('.video-player, [data-a-target="video-player"]');
            for (const container of containers) {
                const keys = Object.keys(container);
                const reactKey = keys.find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
                if (!reactKey) continue;
                
                let node = container[reactKey];
                while (node) {
                    if (node.memoizedProps?.player) {
                        return node.memoizedProps.player;
                    }
                    if (node.memoizedProps?.mediaPlayer) {
                        return node.memoizedProps.mediaPlayer;
                    }
                    if (node.stateNode?.player) {
                        return node.stateNode.player;
                    }
                    node = node.return;
                }
            }
        } catch (e) {
            console.error("[Hydra Shield] Error searching React player:", e);
        }
        return null;
    }

    function executePlayerRecovery(kind) {
        const now = Date.now();
        if (now - lastReloadTime < reloadCooldownMs) {
            console.log("[Hydra Shield] Reload cooldown active. Ignoring request.");
            return;
        }
        lastReloadTime = now;
        console.log(`[Hydra Shield] Attempting player reload recovery [Kind: ${kind || 'standard'}]`);
        
        try {
            const player = findTwitchPlayer();
            if (player) {
                console.log("[Hydra Shield] Found React Twitch player instance.");
                
                // 1. Try Player reload/refresh methods
                if (typeof player.reload === 'function') {
                    console.log("[Hydra Shield] Triggering player.reload().");
                    player.reload();
                    return;
                }
                
                if (typeof player.refresh === 'function') {
                    console.log("[Hydra Shield] Triggering player.refresh().");
                    player.refresh();
                    return;
                }

                if (player.core && typeof player.core.reload === 'function') {
                    console.log("[Hydra Shield] Triggering player.core.reload().");
                    player.core.reload();
                    return;
                }

                // 2. Try Quality reset fallback to force HLS manifest reload
                try {
                    const qualities = typeof player.getQualities === 'function' ? player.getQualities() : [];
                    const currentQuality = typeof player.getQuality === 'function' ? player.getQuality() : null;
                    if (currentQuality && qualities.length > 0) {
                        console.log("[Hydra Shield] Resetting player quality to force manifest refresh:", currentQuality.group);
                        player.setQuality(currentQuality);
                        return;
                    }
                } catch (qe) {
                    console.warn("[Hydra Shield] React quality toggle failed:", qe);
                }
            }
        } catch (reactErr) {
            console.warn("[Hydra Shield] React-level recovery failed, falling back to video kick:", reactErr);
        }

        // 3. Fallback to safe, non-destructive video element kick
        try {
            const videoEl = document.querySelector('video');
            if (videoEl) {
                console.log("[Hydra Shield] Triggering safe HTML5 video playback kick.");
                videoEl.pause();
                
                // Seek back slightly to force the browser MSE buffer to re-request segments at current playback edge
                const originalTime = videoEl.currentTime;
                const seekTarget = Math.max(0, originalTime - 0.2);
                videoEl.currentTime = seekTarget;
                
                setTimeout(() => {
                    videoEl.play().catch(e => {
                        console.warn("[Hydra Shield] Autoplay/play kick blocked or failed:", e);
                    });
                }, 50);
            } else {
                console.log("[Hydra Shield] No active video element found to reload.");
            }
        } catch (err) {
            console.error("[Hydra Shield] Failed to execute video element reload kick:", err);
        }
    }

    let lastAdStatus = {
        hasAds: false,
        backupType: null
    };

    // Handle messages coming from our patched worker
    function handleWorkerMessage(event) {
        if (!event.data || !event.data.key) return;

        if (event.data.key === 'Hydra:RequestReload') {
            console.log("[Hydra Shield] Worker requested player reload.");
            executePlayerRecovery(event.data.kind);
        } else if (event.data.key === 'Hydra:AdStatus') {
            const hasAds = event.data.hasAds;
            const strippedCount = event.data.numStripped;
            const backupType = event.data.backupType;

            const stateChanged = hasAds !== lastAdStatus.hasAds || backupType !== lastAdStatus.backupType;
            lastAdStatus = { hasAds, backupType };

            if (hasAds) {
                if (stateChanged) {
                    console.log(`[Hydra Shield] Ad break active! Swapped to backup [${backupType || 'stripping fallback'}].`);
                }
                updateHydraBadge(true, strippedCount, backupType);
            } else {
                if (stateChanged) {
                    console.log("[Hydra Shield] Stream clean. Playing broadcast naturally.");
                }
                updateHydraBadge(false, strippedCount);
            }
        }
    }

    // GQL Access Token & Auth Extraction (For Backup Searching)
    // -------------------------------------------------------------
    let cachedAuthHeader = null;
    
    // Fallback public client ID used by Twitch's official web client.
    // This is overridden dynamically when the extension intercepts the browser's active page requests.
    let cachedClientId = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
    let cachedDeviceId = null;

    // Intercept client parameters from local storage & fetch requests
    try {
        const deviceId = localStorage.getItem('device-id');
        if (deviceId) cachedDeviceId = deviceId;
    } catch (e) {}

    // Hook fetch on the main thread to grab active authorization headers
    const rawFetch = window.fetch;
    window.fetch = function(resource, init) {
        if (init && init.headers) {
            const headers = init.headers;
            let auth = null;
            let clientId = null;
            if (headers instanceof Headers) {
                auth = headers.get('Authorization') || headers.get('authorization');
                clientId = headers.get('Client-Id') || headers.get('client-id');
            } else {
                auth = headers['Authorization'] || headers['authorization'];
                clientId = headers['Client-Id'] || headers['client-id'];
            }
            if (auth) cachedAuthHeader = auth;
            if (clientId) cachedClientId = clientId;
        } else if (resource instanceof Request && resource.headers) {
            const headers = resource.headers;
            const auth = headers.get('Authorization') || headers.get('authorization');
            const clientId = headers.get('Client-Id') || headers.get('client-id');
            if (auth) cachedAuthHeader = auth;
            if (clientId) cachedClientId = clientId;
        }
        return rawFetch(resource, init);
    };

    // -------------------------------------------------------------
    // Web Worker Interceptor (IVS Player Hook)
    // -------------------------------------------------------------
    let tasInjectedBlobUrl = null;

    // Prevent Twitch from cleaning up our generated blob URL
    const rawRevokeObjectURL = URL.revokeObjectURL;
    URL.revokeObjectURL = function(url) {
        if (url === tasInjectedBlobUrl) return;
        return rawRevokeObjectURL(url);
    };

    function fetchWorkerScript(blobUrl) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', blobUrl, false);
            xhr.overrideMimeType('text/javascript');
            xhr.send();
            return xhr.responseText;
        } catch (err) {
            console.error("[Hydra Shield] Failed to fetch worker script:", err);
            return null;
        }
    }

    // -------------------------------------------------------------
    // Worker Patch Function - CONVERTED TO STRING FOR INJECTION
    // -------------------------------------------------------------
    function hydraWorkerPatch(CONFIG) {
        'use strict';
        
        const self = this || globalThis;
        console.log("[Hydra Worker Patch] Core injection successful!");

        // State Config
        const AD_SIGNIFIERS = ['stitched-ad', 'EXT-X-CUE-OUT', 'twitch-stitched', 'EXT-X-DATERANGE:CLASS="twitch-maf-ad"'];
        const AD_URL_PATTERNS = ['/adsquared/', '/_404/', '/processing'];
        const TWITCH_AD_REWRITE_REGEX = /(X-TV-TWITCH-AD(?:-[A-Z]+)*-URLS?=")[^"]*(")/g;
        const BACKUP_PLAYER_TYPES = ['site', 'popout', 'mobile_web', 'embed'];
        
        let activeChannelName = null;
        let lastUsherParams = '';
        let isAdBreakActive = false;
        let strippedSegmentsCount = 0;
        let activeBackupType = null;
        let pinnedBackupType = 'popout';
        
        const adSegmentsCache = new Map();
        const failedBackupsMap = new Map();

        // 1-second blank silence video segment (minimal MP4)
        const BLANK_MP4_BLOB = new Blob([
            Uint8Array.from(atob(
                'AAAAKGZ0eXBtcDQyAAAAAWlzb21tcDQyZGFzaGF2YzFpc282aGxzZgAABEltb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAYagAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAABqHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAURtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAALuAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAADvbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAACzc3RibAAAAGdzdHNkAAAAAAAAAAEAAABXbXA0YQAAAAAAAAABAAAAAAAAAAAAAgAQAAAAALuAAAAAAAAzZXNkcwAAAAADgICAIgABAASAgIAUQBUAAAAAAAAAAAAAAAWAgIACEZAGgICAAQIAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0c2oAAAAAAAAAAAAAAeV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAoAAAAFoAAAAAAGBbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAA9CQAAAAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABLG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAOxzdGJsAAAAoHN0c2QAAAAAAAAAAQAAAJBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAoABaABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAOmF2Y0MBTUAe/+EAI2dNQB6WUoFAX/LgLUBAQFAAAD6AAA6mDgAAHoQAA9CW7y4KAQAEaOuPIAAAABBzdHRzAAAAAAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAAFHN0c3oAAAAAAAAAAAAAAAAAAAAQc3RjbwAAAAAAAAAAAAAASG12ZXgAAAAgdHJleAAAAAAAAAABAAAAAQAAAC4AAAAAAoAAAAAAACB0cmV4AAAAAAAAAAIAAAABAACCNQAAAAACQAAA'
            ), c => c.charCodeAt(0))
        ], {type: 'video/mp4'});

        function parseHlsAttributes(line) {
            if (!line) return {};
            const attrIdx = line.indexOf(':');
            if (attrIdx !== -1) line = line.slice(attrIdx + 1);
            const attrs = {};
            const parts = line.split(/(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/).filter(Boolean);
            for (const part of parts) {
                const eqIdx = part.indexOf('=');
                if (eqIdx === -1) continue;
                const key = part.substring(0, eqIdx).trim();
                let value = part.substring(eqIdx + 1).trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                attrs[key] = isNaN(value) ? value : Number(value);
            }
            return attrs;
        }

        function hasAdsInManifest(m3u8Text) {
            return AD_SIGNIFIERS.some(s => m3u8Text.includes(s));
        }

        // Dynamic Manifest Ad Segment Stripper
        function sanitizeManifest(m3u8Text) {
            let lines = m3u8Text.split(/\r?\n/);
            let cleanLines = [];
            let currentBlockIsAd = false;
            let upcomingBlockIsAd = false;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                
                // Scrub telemetry URL trackers in the manifest
                if (line.includes('X-TV-TWITCH-AD')) {
                    line = line.replace(TWITCH_AD_REWRITE_REGEX, '$1https://twitch.tv$2');
                }

                // Detect upcoming ad block from Twitch metadata
                if (line.includes('CLASS="twitch-maf-ad"') || line.includes('twitch-maf-ad')) {
                    upcomingBlockIsAd = true;
                }

                // Parse discontinuity boundaries
                if (line.startsWith('#EXT-X-DISCONTINUITY')) {
                    if (upcomingBlockIsAd) {
                        currentBlockIsAd = true;
                        upcomingBlockIsAd = false;
                    } else if (currentBlockIsAd) {
                        currentBlockIsAd = false;
                    }
                }

                // Reset state on cue-in tag
                if (line.startsWith('#EXT-X-CUE-IN')) {
                    currentBlockIsAd = false;
                    upcomingBlockIsAd = false;
                }

                if (line.startsWith('#EXTINF')) {
                    const nextLine = lines[i + 1] || '';
                    const matchesAdPattern = AD_URL_PATTERNS.some(pat => nextLine.includes(pat));
                    const isAd = currentBlockIsAd || matchesAdPattern;
                    
                    if (isAd) {
                        adSegmentsCache.set(nextLine, Date.now());
                        strippedSegmentsCount++;
                        i++; // Skip the segment URL line
                        continue;
                    }
                } else if (line.startsWith('#EXT-X-TWITCH-PREFETCH:') || line.startsWith('#EXT-X-PRELOAD-HINT:')) {
                    const matchesAdPattern = AD_URL_PATTERNS.some(pat => line.includes(pat));
                    const isAd = currentBlockIsAd || matchesAdPattern;
                    if (isAd) {
                        // Skip prefetch / preload hint if it represents an ad segment
                        continue;
                    }
                }

                cleanLines.push(line);
            }

            return cleanLines.join('\n');
        }

        // GQL Playback Access Token client refactoring
        async function fetchPlaybackAccessToken(channel, platform) {
            const query = {
                query: 'query StreamPlaybackAccessToken($channelName: String!, $params: PlaybackAccessTokenProperties!) { streamPlaybackAccessToken(channelName: $channelName, params: $params) { signature value } }',
                variables: {
                    channelName: channel,
                    params: {
                        platform: platform,
                        playerBackend: 'mediaplayer',
                        playerType: platform,
                        clientSupportsADS: false // Ask Twitch not to stitch ads if possible
                    }
                }
            };

            const response = await realWorkerFetch('https://gql.twitch.tv/gql', {
                method: 'POST',
                headers: {
                    'Client-Id': CONFIG.clientId,
                    'Content-Type': 'application/json',
                    ...(CONFIG.authHeader ? { 'Authorization': CONFIG.authHeader } : {}),
                    ...(CONFIG.deviceId ? { 'X-Device-Id': CONFIG.deviceId } : {})
                },
                body: JSON.stringify(query)
            });

            if (response.status !== 200) {
                throw new Error('GQL Access Token HTTP ' + response.status);
            }
            
            const json = await response.json();
            const tokenData = json?.data?.streamPlaybackAccessToken;
            if (!tokenData) {
                throw new Error('Token query failed or empty response');
            }
            return tokenData;
        }

        async function searchCleanBackupM3u8(resolution) {
            const typesToTry = [...BACKUP_PLAYER_TYPES];
            if (pinnedBackupType) {
                const pIdx = typesToTry.indexOf(pinnedBackupType);
                if (pIdx > 0) {
                    typesToTry.splice(pIdx, 1);
                    typesToTry.unshift(pinnedBackupType);
                }
            }

            for (const type of typesToTry) {
                const failedTime = failedBackupsMap.get(type);
                if (failedTime && Date.now() - failedTime < 10000) {
                    continue; // Skip recently failed backends
                }

                try {
                    const token = await fetchPlaybackAccessToken(activeChannelName, type);
                    const usherUrl = new URL('https://usher.ttvnw.net/api/channel/hls/' + activeChannelName + '.m3u8' + lastUsherParams);
                    usherUrl.searchParams.set('sig', token.signature);
                    usherUrl.searchParams.set('token', token.value);

                    const usherResponse = await realWorkerFetch(usherUrl.href);
                    if (usherResponse.status !== 200) continue;

                    const masterPlaylist = await usherResponse.text();
                    let targetStreamUrl = null;

                    // Parse resolution stream
                    const lines = masterPlaylist.split(/\r?\n/);
                    for (let i = 0; i < lines.length - 1; i++) {
                        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                            const attrs = parseHlsAttributes(lines[i]);
                            if (attrs['RESOLUTION'] === resolution || !targetStreamUrl) {
                                targetStreamUrl = lines[i + 1];
                                if (attrs['RESOLUTION'] === resolution) break;
                            }
                        }
                    }

                    if (!targetStreamUrl) continue;

                    const streamResponse = await realWorkerFetch(targetStreamUrl);
                    if (streamResponse.status !== 200) continue;

                    const streamM3u8 = await streamResponse.text();
                    if (!hasAdsInManifest(streamM3u8)) {
                        pinnedBackupType = type;
                        return { type, m3u8: streamM3u8 };
                    }
                } catch (err) {
                    failedBackupsMap.set(type, Date.now());
                    console.log('[Hydra SW Patch] Backup failed for ' + type + ': ' + err.message);
                }
            }

            return null;
        }

        // Process stream playlist manifests
        async function processTwitchM3u8(url, playlistText) {
            const isAdInPlay = hasAdsInManifest(playlistText);

            if (isAdInPlay) {
                if (!isAdBreakActive) {
                    isAdBreakActive = true;
                    strippedSegmentsCount = 0;
                    activeBackupType = null;
                    console.log('[Hydra Ad-Shield] Ad break initialized on channel: ' + activeChannelName);
                }

                // 1. Core Platform SSAI swapper
                let resolution = '1920x1080';
                const backupResult = await searchCleanBackupM3u8(resolution);

                if (backupResult) {
                    activeBackupType = backupResult.type;
                    playlistText = backupResult.m3u8;
                } else {
                    // 2. Fallback HLS manifest segment stripper
                    playlistText = sanitizeManifest(playlistText);
                }

                self.postMessage({
                    key: 'Hydra:AdStatus',
                    hasAds: true,
                    numStripped: strippedSegmentsCount,
                    backupType: activeBackupType
                });

            } else if (isAdBreakActive) {
                // Recover naturally
                isAdBreakActive = false;
                activeBackupType = null;
                console.log('[Hydra Ad-Shield] Ad break resolved naturally. Flushing player cache.');
                
                self.postMessage({
                    key: 'Hydra:AdStatus',
                    hasAds: false,
                    numStripped: strippedSegmentsCount
                });

                self.postMessage({
                    key: 'Hydra:RequestReload',
                    kind: 'end-of-ad'
                });
            }

            return playlistText;
        }

        // Core Fetch Interceptor inside WASM Worker
        const realWorkerFetch = self.fetch;
        self.fetch = async function(resource, options) {
            const url = typeof resource === 'string' ? resource : (resource?.url || '');
            if (url) {
                // Hook ad segments and replace them with silent MP4 frames instantly
                if (adSegmentsCache.has(url)) {
                    return new Response(BLANK_MP4_BLOB);
                }
                
                const trimmed = url.trimEnd();
                try {
                    const urlObj = new URL(trimmed);
                    const cleanPath = urlObj.pathname;
                    const isM3u8 = cleanPath.endsWith('.m3u8');
                    const isMaster = cleanPath.includes('/api/channel/hls/') || cleanPath.includes('/channel/hls/');

                    if (isM3u8) {
                        // Extract channel name only from master playlist path to avoid overwriting it with HLS session tokens
                        const match = cleanPath.match(/\/channel\/hls\/([^.]+)/);
                        if (match) {
                            activeChannelName = match[1];
                        }

                        if (isMaster) {
                            // Extract query strings for signature replication
                            lastUsherParams = urlObj.search;
                            console.log("[Hydra Worker Patch] Captured usher master playlist signature params for channel: " + activeChannelName);
                        } else {
                            // Media playlist request: intercept & patch
                            // console.log("[Hydra Worker Patch] Intercepting HLS media playlist for channel: " + activeChannelName);
                            try {
                                const response = await realWorkerFetch(resource, options);
                                if (response.status === 200) {
                                    const rawManifest = await response.text();
                                    const cleanManifest = await processTwitchM3u8(trimmed, rawManifest);
                                    const headers = new Headers(response.headers);
                                    headers.delete('content-length');
                                    return new Response(cleanManifest, {
                                        status: response.status,
                                        statusText: response.statusText,
                                        headers: headers
                                    });
                                }
                                return response;
                            } catch (fetchErr) {
                                console.error("[Hydra Worker Patch] HLS media fetch failed:", fetchErr);
                                return realWorkerFetch(resource, options);
                            }
                        }
                    }
                } catch (err) {
                    // Fail-safe fallthrough on URL parsing/fetch error
                }
            }

            return realWorkerFetch(resource, options);
        };
    }

    const nativeWorker = window.Worker;
    let nextWorkerTarget = nativeWorker;
    let isConstructing = false;

    const workerProxy = new Proxy(nativeWorker, {
        construct(target, args, newTarget) {
            if (isConstructing) {
                return Reflect.construct(nativeWorker, args, newTarget);
            }

            let [twitchBlobUrl, options] = args;
            let isTwitchWorker = false;
            try {
                const urlString = typeof twitchBlobUrl === 'string' ? twitchBlobUrl : twitchBlobUrl?.href || String(twitchBlobUrl);
                isTwitchWorker = new URL(urlString).origin.endsWith('.twitch.tv') || urlString.startsWith('blob:');
            } catch (e) {}

            if (!isTwitchWorker) {
                return Reflect.construct(nextWorkerTarget, args, newTarget);
            }

            const rawWorkerJs = fetchWorkerScript(twitchBlobUrl);
            if (!rawWorkerJs) {
                console.warn("[Hydra Shield] Worker script empty, falling back to clean worker");
                return Reflect.construct(nextWorkerTarget, args, newTarget);
            }

            console.log("[Hydra Shield] Intercepting IVS Player Worker! Embedding Hydra patch...");

            // Pass config values in safely by serializing them
            const config = {
                clientId: cachedClientId,
                authHeader: cachedAuthHeader,
                deviceId: cachedDeviceId
            };

            const embeddedPatchJs = `(${hydraWorkerPatch.toString()})(${JSON.stringify(config)});`;

            const fullWorkerBlobSource = `
                ${embeddedPatchJs}
                ${rawWorkerJs}
            `;

            isConstructing = true;
            try {
                tasInjectedBlobUrl = URL.createObjectURL(new Blob([fullWorkerBlobSource], {type: 'text/javascript'}));
                const instance = Reflect.construct(nextWorkerTarget, [tasInjectedBlobUrl, options], newTarget);
                instance.addEventListener('message', handleWorkerMessage);
                return instance;
            } catch (err) {
                console.error("[Hydra Shield] Error constructing patched worker, falling back:", err);
                return Reflect.construct(nativeWorker, args, newTarget);
            } finally {
                isConstructing = false;
            }
        }
    });

    // Override the global window.Worker
    Object.defineProperty(window, 'Worker', {
        get: () => workerProxy,
        set: (val) => {
            if (val === workerProxy) return;
            console.log("[Hydra Shield] Intercepted external override of Worker class. Chain-linking...");
            nextWorkerTarget = val;
        },
        configurable: true
    });

    console.log("[Hydra Shield] Patch engine successfully attached to window.Worker!");
})();
