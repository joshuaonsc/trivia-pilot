// TriviaPilot toolbar menu: start / restart, pause-resume toggle, options.

var paused = false; // mirrors the worker's paused flag; kept current by render()

function send(greeting, callback) {
    chrome.runtime.sendMessage({ greeting: greeting }, function (response) {
        void chrome.runtime.lastError; // worker hiccup -> treat as no status
        if (callback) callback(response);
    });
}

function set(el, opts) {
    el.hidden = !!opts.hidden;
    if (opts.text !== undefined) el.textContent = opts.text;
    if (opts.cls !== undefined) el.className = opts.cls;
}

function render() {
    send("getStatus", function (status) {
        status = status || {};
        paused = !!status.paused;
        var text = document.getElementById("status");
        var start = document.getElementById("startButton");
        var toggle = document.getElementById("pauseResumeButton");
        var inProgress = !!(status.currentQuiz || status.pendingQuiz);

        // status line
        if (status.done) {
            text.textContent = "Done";
        } else if (paused) {
            text.textContent = status.pendingQuiz ? "Paused, next up: " + status.pendingQuiz : "Paused";
        } else if (inProgress) {
            text.textContent = "Running " + (status.currentQuiz || "…");
        } else {
            text.textContent = "Idle";
        }

        // pause/resume: one toggle (red Pause running, green Resume paused),
        // hidden when there's no run to act on. The gold sweep on Pause is the
        // "automation is active" signal.
        set(toggle, paused
            ? { hidden: false, text: "Resume", cls: "primary" }
            : { hidden: !inProgress, text: "Pause", cls: "danger sweep" });

        // start/restart: Start when nothing's going, Restart while paused
        // mid-run. Amber so it doesn't clash with Options (grey) or Resume (green).
        var showStart = paused || !inProgress;
        set(start, paused && inProgress
            ? { hidden: false, text: "Restart", cls: "warn" }
            : { hidden: !showStart, text: "Start", cls: "primary" });
    });
}

document.getElementById("startButton").addEventListener("click", function () {
    send("startAutomation", function () { window.close(); });
});
document.getElementById("pauseResumeButton").addEventListener("click", function () {
    if (paused) {
        send("resumeAutomation", function () { window.close(); });
    } else {
        send("pauseAutomation", render);
    }
});
document.getElementById("optionsButton").addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
});

render();
