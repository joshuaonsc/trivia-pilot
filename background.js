// TriviaPilot - MV3 background service worker
//
// PHASE 0 SKELETON. This file only needs to register without errors so the
// extension loads cleanly as Manifest V3. The real quiz-orchestration logic
// (tab management, quiz sequencing, rate-limit pacing, the countdown) is ported
// from the MV2 background page in later phases.
//
// The original MV2 logic lives in this repo's git history (the pre-restructure
// "Old Chrome Extension/background.js") and in the joshuaonsc/DCQAE archive.
// Porting notes (Phase 1+):
//   - window.open(...) has no equivalent in a service worker -> chrome.tabs
//     create/update, tracking the reused "Quiz" tab id in chrome.storage.session
//   - module-global state (satisfy, currentQuiz, openThisQuiz, time, interval)
//     must not rely on the worker staying alive -> pass context in messages,
//     persist only what must survive
//   - setInterval countdown -> page-driven advance (the wait pages message the
//     worker when their countdown completes), so no chrome.alarms needed
//   - chrome.browserAction -> chrome.action (already reflected in the manifest)

chrome.runtime.onInstalled.addListener((details) => {
    console.log("TriviaPilot service worker installed:", details.reason);
});
