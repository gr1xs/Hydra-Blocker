// Background service worker for Hydra Blocker
console.log("[Hydra Service Worker] Initializing...");

const BROWSER_SCRIPTS = {
    HYDRA_INJECTOR: "hydra-injector-script"
};

// Dynamically register the content scripting injection on twitch.tv
async function registerTwitchScript() {
    try {
        const scripts = await chrome.scripting.getRegisteredContentScripts();
        const scriptIds = scripts.map(s => s.id);
        
        if (scriptIds.includes(BROWSER_SCRIPTS.HYDRA_INJECTOR)) {
            console.log("[Hydra SW] Script already registered, skipping duplicate registration.");
            return;
        }

        await chrome.scripting.registerContentScripts([
            {
                id: BROWSER_SCRIPTS.HYDRA_INJECTOR,
                matches: ["*://*.twitch.tv/*"],
                js: ["inject.js"],
                runAt: "document_start",
                allFrames: false,
                world: "MAIN"
            }
        ]);
        console.log("[Hydra SW] Injector script registered successfully.");
    } catch (err) {
        console.error("[Hydra SW] Script registration failed:", err);
    }
}

// Unregister the script if needed
async function unregisterTwitchScript() {
    try {
        await chrome.scripting.unregisterContentScripts({ ids: [BROWSER_SCRIPTS.HYDRA_INJECTOR] });
        console.log("[Hydra SW] Injector script unregistered.");
    } catch (err) {
        console.error("[Hydra SW] Failed to unregister script:", err);
    }
}

// Handle incoming messages from the injected script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) return;

    if (message.action === "hydra:reloadPlayer") {
        console.log(`[Hydra SW] Player reload requested by tab ${tabId}. Kind: ${message.kind || 'default'}`);
        // Communicate the player reload action to the specific tab
        chrome.tabs.sendMessage(tabId, { action: "hydra:triggerReload", kind: message.kind })
            .catch(err => console.log("[Hydra SW] Failed to dispatch reload message to tab:", err));
    }
});

// Run registration on startup and installation
chrome.runtime.onInstalled.addListener(async () => {
    console.log("[Hydra SW] Extension installed/updated.");
    await registerTwitchScript();
});

// Run startup trigger
chrome.runtime.onStartup.addListener(async () => {
    console.log("[Hydra SW] Browser started.");
    await registerTwitchScript();
});
