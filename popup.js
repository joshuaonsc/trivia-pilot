// TriviaPilot toolbar menu: start / pause / resume the run, jump to options.

function send(greeting, callback) {
    chrome.runtime.sendMessage({ greeting: greeting }, function (response) {
        void chrome.runtime.lastError; // worker hiccup -> treat as no status
        if (callback) callback(response);
    });
}

function render() {
    send("getStatus", function (status) {
        status = status || {};
        var text = document.getElementById("status");
        var start = document.getElementById("startButton");
        var pause = document.getElementById("pauseButton");
        var resume = document.getElementById("resumeButton");
        var idle = !status.currentQuiz && !status.pendingQuiz;

        if (status.paused) {
            text.textContent = status.pendingQuiz
                ? "Paused — next up: " + status.pendingQuiz
                : "Paused";
            start.textContent = "Start over";
        } else if (!idle) {
            text.textContent = "Running — current quiz: " + (status.currentQuiz || "…");
        } else {
            text.textContent = "Idle — ready when you are.";
            start.textContent = "Start quizzes";
        }

        start.hidden = !(status.paused || idle);
        resume.hidden = !status.paused;
        pause.hidden = !!status.paused || idle;
    });
}

document.getElementById("startButton").addEventListener("click", function () {
    send("startAutomation", function () { window.close(); });
});
document.getElementById("resumeButton").addEventListener("click", function () {
    send("resumeAutomation", function () { window.close(); });
});
document.getElementById("pauseButton").addEventListener("click", function () {
    send("pauseAutomation", render);
});
document.getElementById("optionsButton").addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
});

render();
