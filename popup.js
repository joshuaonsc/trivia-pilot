// TriviaPilot toolbar menu: start, pause/resume (one toggle), jump to options.

var paused = false; // mirrors the worker's paused flag; kept current by render()

function send(greeting, callback) {
    chrome.runtime.sendMessage({ greeting: greeting }, function (response) {
        void chrome.runtime.lastError; // worker hiccup -> treat as no status
        if (callback) callback(response);
    });
}

function render() {
    send("getStatus", function (status) {
        status = status || {};
        paused = !!status.paused;
        var text = document.getElementById("status");
        var start = document.getElementById("startButton");
        var toggle = document.getElementById("pauseResumeButton");
        var idle = !status.currentQuiz && !status.pendingQuiz;

        if (paused) {
            text.textContent = status.pendingQuiz
                ? "Paused — next up: " + status.pendingQuiz
                : "Paused";
            start.textContent = "Start over";
            start.className = "secondary"; // Resume is the primary action here
        } else if (!idle) {
            text.textContent = "Running — current quiz: " + (status.currentQuiz || "…");
        } else {
            text.textContent = "Idle — ready when you are.";
            start.textContent = "Start quizzes";
            start.className = "primary";
        }

        start.hidden = !(paused || idle);

        // One toggle: red Pause while running, green Resume while paused.
        // Hidden when idle -- nothing to pause, and pausing while paused is
        // impossible by construction.
        toggle.hidden = idle && !paused;
        toggle.textContent = paused ? "Resume" : "Pause";
        toggle.className = paused ? "primary" : "danger";
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
