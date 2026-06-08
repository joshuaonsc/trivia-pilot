// TriviaPilot - MV3 background service worker
//
// Ported from the MV2 background page. The worker is event-driven and
// effectively stateless: only the reused "Quiz" tab id and the current/pending
// quiz are persisted, in chrome.storage.session (which survives worker
// restarts). Wait-screen timing is page-driven -- the wait pages message the
// worker when their countdown ends -- so there is no setInterval here and no
// chrome.alarms.

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
});

// Toolbar icon -> open the trivia/login page in the Quiz tab.
chrome.action.onClicked.addListener(() => openInQuizTab(LOGIN_URL));

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
      return;
    } catch (e) {
      // stored tab is gone; fall through and create a fresh one
    }
  }
  const tab = await chrome.tabs.create({ url });
  await sset({ quizTabId: tab.id });
}

function openQuiz(quizName) {
  return openInQuizTab(QUIZ_URLS[quizName] || QUIZ_URLS["Adventuring"]);
}

// ---- message router ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.greeting) {
    case "startQuiz":
      openQuiz(QUIZ_LIST[0]);
      break;

    case "setCurrentQuiz":
      sset({ currentQuiz: message.currentQuiz });
      break;

    case "getCurrentQuiz":
      sget("currentQuiz").then((quizName) => sendResponse({ quizName }));
      return true; // keep the channel open for the async response

    case "nextQuiz":
      handleNextQuiz(message).catch(console.error);
      break;

    case "error429":
      handle429().catch(console.error);
      break;

    case "advanceWait":
      // a wait page finished its countdown (or the user hit "skip")
      sget("pendingQuiz").then((q) => openQuiz(q || QUIZ_LIST[0]));
      break;
  }
});

async function handleNextQuiz(message) {
  const { satisfy, satisfyRate } = await chrome.storage.sync.get(["satisfy", "satisfyRate"]);
  const currentQuiz = await sget("currentQuiz");
  const quizIndex = QUIZ_LIST.indexOf(currentQuiz) + 1;
  const nextQuiz = QUIZ_LIST[quizIndex];

  if (!satisfy || message.when || quizIndex % satisfyRate !== 0) {
    await openQuiz(nextQuiz);
  } else {
    await sset({ pendingQuiz: nextQuiz });
    await chrome.tabs.create({ url: chrome.runtime.getURL("waitScreen.html") });
  }
}

async function handle429() {
  const currentQuiz = await sget("currentQuiz");
  await sset({ pendingQuiz: currentQuiz }); // retry the same quiz after the cooldown
  await chrome.tabs.create({ url: chrome.runtime.getURL("429Wait.html") });
}
