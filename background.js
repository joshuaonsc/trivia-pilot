// TriviaPilot - MV3 background service worker
//
// Event-driven and effectively stateless: only the reused "Quiz" tab id, the
// wait-screen tab id, the current/pending quiz, and a `paused` flag live in
// chrome.storage.session (which survives worker restarts but resets when the
// browser closes). The toolbar popup (popup.html) drives start / pause / resume
// via messages. Wait screens are cosmetic countdown UIs -- when a wait tab
// closes (countdown done, skip, stop, or user-closed), chrome.tabs.onRemoved
// fires and the worker advances unless paused. Pause also gates answering:
// quizScript asks `isPaused` before touching a quiz page.

const DEBUG = true;
const log = (...a) => { if (DEBUG) console.log("[TriviaPilot]", ...a); };

const QUIZ_LIST = ["Adventuring", "Conjuring", "Magical", "Marleybone", "Mystical",
                   "Spellbinding", "Spells", "Valencia", "Wizard City", "Zafaria"];

const QUIZ_URLS = {
  "Adventuring":  "https://www.wizard101.com/quiz/trivia/game/wizard101-adventuring-trivia",
  "Conjuring":    "https://www.wizard101.com/quiz/trivia/game/wizard101-conjuring-trivia",
  "Magical":      "https://www.wizard101.com/quiz/trivia/game/wizard101-magical-trivia",
  "Marleybone":   "https://www.wizard101.com/quiz/trivia/game/wizard101-marleybone-trivia",
  "Mystical":     "https://www.wizard101.com/quiz/trivia/game/wizard101-mystical-trivia",
  "Spellbinding": "https://www.wizard101.com/quiz/trivia/game/wizard101-spellbinding-trivia",
  "Spells":       "https://www.wizard101.com/quiz/trivia/game/wizard101-spells-trivia",
  "Valencia":     "https://www.wizard101.com/quiz/trivia/game/pirate101-valencia-trivia",
  "Wizard City":  "https://www.wizard101.com/quiz/trivia/game/wizard101-wizard-city-trivia",
  "Zafaria":      "https://www.wizard101.com/quiz/trivia/game/wizard101-zafaria-trivia",
};

const LOGIN_URL = "https://www.wizard101.com/quiz/trivia/game/wizard101-trivia";

const DEFAULTS = {
  playSound: true, soundFile: "windows.wav", automaticSelection: true,
  color: "#00b300", timeToWaitQuestion: 2, satisfy: true, satisfyRate: 3,
  timeToWait: 30, timeToWait429: 60, totalCrowns: 0,
};

// Seed any missing default options. Runs on first install AND on reload/update,
// so a dev reload after an empty install still gets a full set of defaults.
// On update we also re-enable automaticSelection, matching the MV2 behavior.
chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const missing = {};
  for (const k in DEFAULTS) {
    if (current[k] === undefined) missing[k] = DEFAULTS[k];
  }
  if (Object.keys(missing).length) await chrome.storage.sync.set(missing);
  if (details.reason === "update") await chrome.storage.sync.set({ automaticSelection: true });
  log("onInstalled:", details.reason, "| seeded:", Object.keys(missing));
});

// ---- session-state helpers (survive worker restarts) ----
async function sget(key) {
  return (await chrome.storage.session.get(key))[key];
}
function sset(obj) {
  return chrome.storage.session.set(obj);
}

// Open url in the single reused "Quiz" tab; create it if missing or closed.
async function openInQuizTab(url) {
  const tabId = await sget("quizTabId");
  if (tabId !== undefined) {
    try {
      await chrome.tabs.update(tabId, { url, active: true });
      log("reuse Quiz tab", tabId);
      return;
    } catch (e) {
      log("Quiz tab gone; creating a new one");
    }
  }
  const tab = await chrome.tabs.create({ url });
  await sset({ quizTabId: tab.id });
  log("created Quiz tab", tab.id);
}

function openQuiz(quizName) {
  log("openQuiz:", quizName);
  return openInQuizTab(QUIZ_URLS[quizName] || QUIZ_URLS["Adventuring"]);
}

// Open a cosmetic wait screen and remember its tab id + the quiz to resume after.
async function openWait(page, quizName) {
  await sset({ pendingQuiz: quizName });
  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL(page) });
  await sset({ waitTabId: tab.id });
  log("wait screen", page, "-> will resume", quizName);
}

// Advance to the pending quiz, exactly once. No-op while paused (keeps the
// pending quiz so the popup's Resume can continue from it).
async function advance() {
  if (await sget("paused")) { log("paused; not advancing"); return; }
  const q = await sget("pendingQuiz");
  if (q === undefined) return;
  await chrome.storage.session.remove("pendingQuiz");
  log("advancing to", q);
  await openQuiz(q);
}

// When the wait tab closes (countdown done / skip / stop / user-closed), advance.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === await sget("waitTabId")) {
    await chrome.storage.session.remove("waitTabId");
    log("wait tab closed -> advancing");
    advance().catch(console.error);
  }
});

// ---- popup actions ----
async function startAutomation() {
  await sset({ paused: false });
  await chrome.storage.session.remove(["pendingQuiz", "currentQuiz"]);
  log("start -> login page");
  await openInQuizTab(LOGIN_URL);
}

async function resumeAutomation() {
  await sset({ paused: false });
  const pending = await sget("pendingQuiz");
  if (pending !== undefined) {
    await chrome.storage.session.remove("pendingQuiz");
    log("resume ->", pending);
    await openQuiz(pending);
  } else {
    log("resume; nothing pending -> login page");
    await openInQuizTab(LOGIN_URL);
  }
}

// ---- message router ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.greeting) {
    case "startQuiz":
      // sent by login.js once the user is logged in; ignored while paused
      sget("paused").then((paused) => {
        if (paused) { log("paused; ignoring startQuiz"); return; }
        log("startQuiz");
        openQuiz(QUIZ_LIST[0]);
      });
      break;

    case "setCurrentQuiz":
      sset({ currentQuiz: message.currentQuiz });
      break;

    case "isPaused":
      sget("paused").then((paused) => sendResponse({ paused: !!paused }));
      return true; // keep the channel open for the async response

    case "getStatus":
      Promise.all([sget("paused"), sget("currentQuiz"), sget("pendingQuiz")])
        .then(([paused, currentQuiz, pendingQuiz]) =>
          sendResponse({ paused: !!paused, currentQuiz, pendingQuiz }));
      return true;

    case "startAutomation":
      startAutomation().then(() => sendResponse({ ok: true })).catch(console.error);
      return true;

    case "pauseAutomation":
      sset({ paused: true }).then(() => { log("paused via popup"); sendResponse({ ok: true }); });
      return true;

    case "resumeAutomation":
      resumeAutomation().then(() => sendResponse({ ok: true })).catch(console.error);
      return true;

    case "nextQuiz":
      handleNextQuiz(message).catch(console.error);
      break;

    case "error429":
      handle429().catch(console.error);
      break;
  }
});

async function handleNextQuiz(message) {
  if (await sget("paused")) { log("paused; ignoring nextQuiz"); return; }
  const { satisfy, satisfyRate } = await chrome.storage.sync.get(["satisfy", "satisfyRate"]);
  const currentQuiz = await sget("currentQuiz");
  const quizIndex = QUIZ_LIST.indexOf(currentQuiz) + 1;
  const nextQuiz = QUIZ_LIST[quizIndex];
  log("nextQuiz: current", currentQuiz, "| index", quizIndex, "-> next", nextQuiz);

  if (!satisfy || message.when || quizIndex % satisfyRate !== 0) {
    await openQuiz(nextQuiz);
  } else {
    log("satisfy pacing -> wait screen");
    await openWait("waitScreen.html", nextQuiz);
  }
}

async function handle429() {
  const currentQuiz = await sget("currentQuiz");
  log("429 throttle -> cooldown, will retry", currentQuiz);
  await openWait("429Wait.html", currentQuiz);
}
