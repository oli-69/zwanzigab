var sound;
var radioUrl = "https://onlineradiobox.com/json/de/radioseefunk/play?platform=web"; // fallback

function SoundFiles() {
    this.chat = new Audio();
    this.online = new Audio();
    this.offline = new Audio();
    this.shuffle = new Audio();
    this.deal = new Audio();
    this.click = new Audio();
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
        initSound(sound.click);
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
    sound.click.src = 'snd-click.mp3';
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
        if(!sound.radio.paused) {
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
