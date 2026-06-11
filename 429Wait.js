var timeToWait;
var totalCrowns;
var time;
var interval;

function countDown() {
    document.getElementById('crownsEarned').innerText = totalCrowns;
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

// "Stop automation": pause, then close. The worker sees `paused` when this
// tab's onRemoved fires and halts instead of advancing; resume from the
// toolbar menu.
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
