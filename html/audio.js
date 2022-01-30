var sound;
var radioUrl = "https://onlineradiobox.com/json/de/radioseefunk/play?platform=web"; // fallback

// following two lines removes (however) the audio delay on Safari (MacOS/iOS)
// https://stackoverflow.com/questions/9811429/html5-audio-tag-on-safari-has-a-delay
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioCtx = new AudioContext();

function SoundFiles() {
    this.chat = new Audio();
    this.online = new Audio();
    this.offline = new Audio();
    this.shuffle = new Audio();
    this.deal = new Audio();
    this.dealBuy = [];
    this.dealBuy[0] = new Audio();
    this.dealBuy[1] = new Audio();
    this.dealBuy[2] = new Audio();
    this.tension = new Audio();
    this.startround = new Audio();
    this.click = new Audio();
    this.trump = new Audio();
    this.hblind = new Audio();
    this.pass = new Audio();
    this.sort = new Audio();
    this.dropcards = new Audio();
    this.wrong = new Audio();
    this.points = new Audio();
    this.cash = new Audio();
    this.gameover = new Audio();
    this.finishSound = [];
    this.finishSound.length = 0;
    for (var i = 0; i < this.finishSound.length; i++) {
        this.finishSound[i] = new Audio();
    }
    this.radio = new Audio();
}

function initAudio(readyFunction) {
    if (sound === undefined) {
        sound = new SoundFiles();

        initSound(sound.chat);
        initSound(sound.online);
        initSound(sound.offline);
        initSound(sound.shuffle);
        initSound(sound.deal);
        initSound(sound.dealBuy[0]);
        initSound(sound.dealBuy[1]);
        initSound(sound.dealBuy[2]);
        initSound(sound.tension);
        initSound(sound.startround);
        initSound(sound.click);
        initSound(sound.trump);
        initSound(sound.hblind);
        initSound(sound.pass);
        initSound(sound.sort);
        initSound(sound.dropcards);
        initSound(sound.wrong);
        initSound(sound.points);
        initSound(sound.cash);
        initSound(sound.gameover);
        for (var i = 0; i < sound.finishSound.length; i++) {
            initSound(sound.finishSound[i]);
        }
        initSound(sound.radio);
        radioVolumeChanged();

        sound.chat.src = 'snd-chat.mp3';
        sound.online.src = 'snd-online.mp3';

        // load the sounds asynchronous in background
        setTimeout(function () {
            loadAudio(readyFunction);
        });
    }
    if (typeof readyFunction === "function") {
        readyFunction();
    }
}

function initSound(snd) {
    snd.play();
    snd.pause();
}

function loadAudio(readyFunction) {
    console.log("Start loading Audio");
    sound.offline.src = 'snd-offline.mp3';
    sound.shuffle.src = 'snd-shuffle.mp3';
    sound.deal.src = 'snd-deal.mp3';
    sound.dealBuy[0].src = 'snd-deal1.mp3';
    sound.dealBuy[1].src = 'snd-deal2.mp3';
    sound.dealBuy[2].src = 'snd-deal3.mp3';
    sound.tension.src = 'snd-tension.mp3';
    sound.startround.src = 'snd-startround.mp3';
    sound.click.src = 'snd-click.mp3';
    sound.trump.src = 'snd-trump.mp3';
    sound.hblind.src = 'snd-hblind.mp3';
    sound.pass.src = 'snd-pass.mp3';
    sound.sort.src = 'snd-sort.mp3';
    sound.dropcards.src = 'snd-dropcards.mp3';
    sound.wrong.src = 'snd-wrong.mp3';
    sound.points.src = 'snd-points.mp3';
    sound.cash.src = 'snd-cash.mp3';
    sound.gameover.src = 'snd-gameover.mp3';
    for (var i = 0; i < sound.finishSound.length; i++) {
        sound.finishSound[i].src = 'finish/snd-finish-' + ((i < 10) ? "0" : "") + i + '.mp3';
    }
    console.log("Audio loaded successfully");
    if (typeof readyFunction === "function") {
        readyFunction();
    }
}

function  toogleWebRadio() {
    setWebRadioPlaying(sound.radio.paused);
}

function setWebRadioUrl(url) {
    console.log("setWebRadioUrl: " + url);
    if (url !== undefined && url !== null && url !== radioUrl) {
        radioUrl = url;
        if (!sound.radio.paused) {
            // restart the radio
            toogleWebRadio();
            toogleWebRadio();
        }
    }
}

function setWebRadioPlaying(playing) {
    console.log("setWebRadioPlaying: " + playing);
    if (playing && sound.radio.paused) {
        sound.radio.src = radioUrl;
        sound.radio.play();
        $("#webRadioBtn").css("background-image", "url('wr-pause-24.png')");
    } else if (!sound.radio.paused) {
        sound.radio.pause();
        sound.radio.src = "";
        $("#webRadioBtn").css("background-image", "url('wr-start-24.png')");
    }
}

function radioVolumeChanged() {
    sound.radio.volume = $("#webRadioSlider").val() / 100.0;
}
