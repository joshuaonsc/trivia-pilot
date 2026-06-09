var timeToWait;
var totalCrowns;
var currentQuiz;
var time;
var interval;

chrome.storage.onChanged.addListener(function (changes) {
    for (var key in changes) {
        var storageChange = changes[key];
        switch (key) {
            case "timeToWait429":
                timeToWait = storageChange.newValue;
                break;
            case "totalCrowns":
                totalCrowns = storageChange.newValue;
        }
    }
});

chrome.storage.sync.get(['timeToWait429', 'totalCrowns'], function (items) {
    timeToWait = items.timeToWait429;
    totalCrowns = items.totalCrowns;
});

chrome.runtime.onMessage.addListener(function (request) {
    if (request.greeting == "refresh")
        countDown();
});

function countDown() {
    chrome.runtime.sendMessage({ greeting: "getCurrentQuiz" }, function (response) {
        currentQuiz = response.quizName;
    });

    document.getElementById('DCQAEcrowns').innerText = totalCrowns;
    document.getElementById('progressBar').max = timeToWait;

    time = timeToWait;
    interval = setInterval(() => {
        time -= 1;
        document.getElementById('timeLeft').textContent = time + ' Seconds Remaining';
        document.getElementById('progressBar').value = timeToWait - time;
        if (time == 0) {
            clearInterval(interval);
            window.close();
        }
    }, 1000);
}

document.getElementById('nextQuizButton').addEventListener('click', stopCounter);

// "Stop automation": pause, then close. The worker sees `paused` on the wait
// tab's onRemoved and halts instead of advancing; the toolbar icon resumes.
document.getElementById('stopButton').addEventListener('click', function () {
    chrome.storage.session.set({ paused: true }, () => window.close());
});

function stopCounter() {
    clearInterval(interval);
    time = 0;
    document.getElementById('timeLeft').textContent = time + ' Seconds Remaining';
    document.getElementById('progressBar').value = timeToWait - time;
    window.close();
}

window.onload = function () {
    chrome.storage.sync.get(['timeToWait429', 'totalCrowns'], function (items) {
        timeToWait = items.timeToWait429;
        totalCrowns = items.totalCrowns;
        countDown();
    });
}