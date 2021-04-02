var myName;
var gamePhase;
var players; // list of all players in the room
var attendees; // list of players currently in game (still alive)
var mover;
var playerStack;
var gameStack;
var gameStackOffsets = [];
var gameStackRotations = [];
var cardFlips = [5];
var gameDesk;
var attendeesCardStacks = [];
var coveredCard = {color: -1, value: -1};
var shufflingCard;
var messageInProgress;
var webradioStateLoaded = false; // get webradio state only the first time 


function onDocumentReady() {
    $("#loginConsole").text("Anmeldung vorbereiten...");
    createCards(function () {
        $("#connectBtn").prop("disabled", false);
        $("#loginConsole").html("&nbsp;");
    });
    gameDesk = $("#gameDesk");
    shufflingCard = $(getSvgCard(coveredCard).getUI()).clone();
    setGameDialogVisible($("#joinInOutDialog"), false);
    setGameDialogVisible($("#dealCardsDialog"), false);

    // connect the enter key to the input fields.
    $('#pName').focus();
    var loginOnEnter = function (e) {
        if (e.keyCode === 13) {
            login();
        }
    };
    $('#pName').keyup(loginOnEnter);
    $('#pPwd').keyup(loginOnEnter);
    $('#chatMessage').keyup(function (e) {
        if (e.keyCode === 13) {
            sendChatMessage();
        }
    });

    var layoutFunction = function () {
        updateAttendeeList();
        updateAttendeeStacks();
        updateCardStack($("#gameStack"), gameStack);
        setShuffling(false);
        onGamePhase(gamePhase);
    };
    $(window).on("orientationchange", function () {
        setTimeout(layoutFunction(), 1000);
    });
    $(window).resize(layoutFunction);
}

function onMessageBuffer() {
//    log("messageInProgress: " + messageInProgress + ", messageBuffer: " + messageBuffer.length);
    while (!messageInProgress && messageBuffer.length > 0) {
        messageInProgress = true;
        var action = messageBuffer.shift();
        try {
            action();
        } catch (e) {
            error("Fehler in onMessageBuffer -> " + action + " '" + e + "'");
            messageInProgress = false;
        }
//        log("messageInProgress: " + messageInProgress + ", messageBuffer: " + messageBuffer.length);
    }
}


function onGameState(message) {
    gamePhase = message.phase;
    players = message.playerList.players;
    attendees = message.attendeeList.attendees;
    mover = message.attendeeList.mover;
//    gameStack = message.gameStack.cards;
//    gameStackOffsets = message.gameStack.offset;
//    gameStackRotations = message.gameStack.rotation;
    playerStack = message.playerStack.cards;
    updatePlayerList();
    updateAttendeeList();
    updateAttendeeStacks(message);
    var msg = mover === myName ? "" : "Warte auf " + mover;
//    $("#discoverMessage").html(msg);
//    $("#knockMessage").html(msg);
//    $("#passMessage").html(msg);
//    $("#stackSelectMessage").html(msg);
    onGamePhase(gamePhase);
    setWebRadioUrl(message.radioUrl.url);
    if (!webradioStateLoaded) {
        setWebRadioPlaying(message.webradioPlaying);
        webradioStateLoaded = true;
    }
}

function onGamePhaseMessage(message) {
    mover = undefined;
    gamePhase = message.phase;
    mover = message.actor;
    switch (gamePhase) {
        case "shuffle":
            updateAttendeeStacks(undefined);
            onGamePhase(gamePhase);
            break;
//        case "dealCards":
//            viewerStacks = message.viewerStackList.viewerStacks;
//            updateAttendeeList();
//            updateAttendeeStacks(undefined);
//            sound.deal.play();
//            animateDealCards(function () {
//                onGamePhase(gamePhase);
//                onMessageBuffer();
//            });
//            break;
        case "waitForAttendees":
            updateAttendeeList();
            onGamePhase(gamePhase);
            break;
//        case "waitForPlayerMove":
//            updateAttendeeStacks(undefined);
//            onGamePhase(gamePhase);
//            break;
//        case "moveResult":
//            viewerStacks = message.viewerStackList.viewerStacks;
//            onMoveResult(message.moveResult);
//            break;
    }
}

function onGamePhase(phase) {
    log("onGamePhase: " + phase);
    var isWaitForAttendees = (phase === "waitForAttendees");
    var meIsMover = (mover === myName);
    var meIsShuffling = (phase === "shuffle" && meIsMover);
    var meIsDealing = ((phase === "dealCards" || phase === "finish31OnDeal") && meIsMover);
    var meIsMoverInGame = (phase === "waitForPlayerMove" && meIsMover);
    var isActive = isAttendee();
    setGameDialogVisible($("#joinInOutDialog"), isWaitForAttendees);
    setGameDialogVisible($("#dealCardsDialog"), meIsShuffling);
//    setGameDialogVisible($("#selectDealerStackDialog"), meIsDealing);
//    setGameDialogVisible($("#discoverDialog"), isDiscover);
    initDialogButtons();

    // reset all card selections and hovers
    resetUICards();

    // Game Area
    if (isWaitForAttendees || phase === "shuffle") {
        emptyAllStackDesks();
    }
    updatePlayerList();
//    updateControlPanelMessage();
//    updateCardStack($("#gameStack"), gameStack);
    updateCardStack(attendeesCardStacks[getMyAttendeeId()], playerStack);
    updateAttendeeDeskColor();
//
//    // Control Panel
//    if (meIsMoverInGame) {
//        controlPanel.show();
//    } else {
//        controlPanel.hide();
//    }
//    $("#logoffBtn").prop("disabled", !(isWaitForAttendees && isActive));
//
    setShuffling(phase === "shuffle");

    messageInProgress = false;
}

function initDialogButtons() {
    var isWaitForAttendees = (gamePhase === "waitForAttendees");
    var meIsMover = (mover === myName);
    if (isWaitForAttendees) {
        var myId = getMyAttendeeId();
        $("#addToAttendeesBtn").prop("disabled", (myId >= 0));
        $("#removeFromAttendeesBtn").prop("disabled", (myId < 0));
    }
    if (meIsMover) {
        $("#nextRoundBtn").show();
        $("#startGameBtn").prop("disabled", attendees === null || attendees === undefined || attendees.length < 2);
    } else {
        $("#nextRoundBtn").hide();
        $("#startGameBtn").prop("disabled", true);
    }
}

function onPlayerList(message) {
    messageInProgress = false;
    players = message.players;
    updatePlayerList();
}

function onPlayerOnline(message) {
    messageInProgress = false;
    players.forEach(function (player) {
        if (player.name === message.name) {
            player.online = message.online;
        }
    });
    updatePlayerList();
    if (message.online) {
        sound.online.play();
    } else {
        sound.offline.play();
    }
}

function onChatMessage(message) {
    messageInProgress = false;
    var text = "<span class='chatMsgTxt'>" + message.text + "</span>";
    if (message.sender !== undefined) {
        text = "<span class='chatMsgSender'>" + message.sender + ": " + "</span>" + text;
    }
    var chatArea = $("#chatArea");
    chatArea.append("&gt; " + text + "<br>");
    chatArea.scrollTop(chatArea[0].scrollHeight);
    if (message.sender !== undefined) {
        sound.chat.play();
    }
}

function onAttendeeList(message) {
    mover = (message.mover !== undefined) ? message.mover : mover;
    messageInProgress = false;
    attendees = message.attendees;
    var myId = getMyAttendeeId();
    $("#addToAttendeesBtn").prop("disabled", (myId >= 0));
    $("#removeFromAttendeesBtn").prop("disabled", (myId < 0));
    updateAttendeeList();
    initDialogButtons();
}


/* ---------------------------------------------------------------------------*/


function updatePlayerList() {
    var panel = $("#playerListPanel");
    panel.empty();
    players.forEach(function (player) {
        var className = player.online ? "playerOnline" : "playerOffline";
        var tokens = (0.1 * player.totalTokens).toFixed(2);
        var container = $("<div class='" + className + "'></div>");
        container.append(player.name);
        container.append("<br>&euro; " + tokens);
        panel.append(container);
    });
}


function updateAttendeeList() {
    var panel = $("#attendeesPanel");
    gameDesk.remove();
    panel.empty();
    attendeesCardStacks = [];
    if (attendees !== undefined) {
        var numPl = attendees.length;
        var othersCount = numPl - 1;
        var myId = getMyAttendeeId();
        var step = (2 * Math.PI) / (numPl + ((myId < 0) ? 1 : 0));
        var angle = Math.PI / 2 + step;
        var id = myId;
        var isSmallSize = panel.width() < 800;
        var rx = panel.width() * (!isSmallSize ? 0.35 : 0.25);
        var ry = panel.height() * 0.26;
        for (var i = 0; i < numPl; i++) {
            id = getNextAttendeeId(id);
            attendeesCardStacks[id] = createCardStack();
            var player = players[ id ];
            var attendeeDesk = createAttendeeDesk(player, attendeesCardStacks[id]);
            if (id === myId) { // add the game desk here
                panel.append(gameDesk);
            }
            panel.append(attendeeDesk);
            var l = (panel.width() * 0.5) + rx * Math.cos(angle) - (attendeeDesk.outerWidth() >> 1);
            var t = ((panel.height() * 0.5) + ry * Math.sin(angle)
                    - (1.1 * attendeesCardStacks[id].outerHeight() * ((isSmallSize && othersCount > 1) ? 1.4 : 1)));
            attendeeDesk.css({left: l + "px", top: t + "px"});
            if (id === myId) { // set the control panel position here
//                controlPanel.css({left: l + attendeeDesk.outerWidth() + 4 + "px", top: t + "px"});
            }
            angle += step;
        }
        if (!isAttendee()) {
            panel.append(gameDesk);
        }
        gameDesk.css({top: (panel.height() - gameDesk.height()) * 0.5 - ((isSmallSize) ? 0.075 : 0.085) * panel.height() + "px", left: (panel.width() - gameDesk.width()) * 0.5 + "px"});

        updateAttendeeDeskColor();
        if (getMyAttendeeId() < 0) {
            $("#addToAttendeesBtn").show();
            $("#removeFromAttendeesBtn").hide();
        } else {
            $("#addToAttendeesBtn").hide();
            $("#removeFromAttendeesBtn").show();
        }
    }
}

function updateAttendeeDeskColor() {
    if (attendees !== undefined) {
        var numPl = attendees.length;
        var id = getMyAttendeeId();
        for (var i = 0; i < numPl; i++) {
            id = getNextAttendeeId(id);
            var attendee = players[id];
            var className = (mover === attendee.name) ? "moverDesk" : "attendeeDesk";
            attendeesCardStacks[id].parent().prop("class", className);
        }
    }
}

function createCardStack() {
    var cardDesk = $("<div class='cardStack'></div>");
    return cardDesk;
}

function createAttendeeDesk(player, stackDesk) {
    var playerDesk = $("<div class='attendeeDesk'></div>");
    var nameContainer = $("<div class='attendeeNameContainer'></div>");
    var nameDiv = $("<div class='attendeeName'>" + player.name + "</div>");
    nameContainer.append(nameDiv);
    playerDesk.append(stackDesk).append(nameContainer);
    return playerDesk;
}


function emptyAllStackDesks() {
    playerStack = undefined;
    gameStack = undefined;
    attendeesCardStacks.forEach(function (desk) {
        desk.empty();
    });
    $("#gameStack").empty();
}

function updateAttendeeStacks(message) {
    try {
        var id = getAttendeeId();
        var myDesk = id >= 0 ? attendeesCardStacks[id] : undefined;
        for (var i = 0; i < attendees.length; i++) {
            id = getNextAttendeeId(id);
            var desk = attendeesCardStacks[id];
            if (desk !== myDesk) {
                var playerName = players[id].name;
                var isAttendee = getAttendeeIdByName(playerName) >= 0;
//                updateCardStack(desk, isAttendee
//                        ? (viewerStack !== undefined
//                                ? viewerStack
//                                : ((gamePhase !== "waitForAttendees" && gamePhase != "shuffle")
//                                        ? coveredStack
//                                        : undefined))
//                        : undefined);
            } else {
                updateCardStack(desk, playerStack);
            }
        }
    } catch (e) {
        log("Fehler in updateAttendeeStacks(): '" + e + "'");
    }
}

function getGameStackProperties(id, card, desk) {
    return {
        y: desk.offset().top + ((desk.height() - card.height()) >> 1) + gameStackOffsets[id].y + "px",
        x: desk.offset().left + ((desk.width() - card.width()) >> 1) - card.width() + id * card.width() + gameStackOffsets[id].x + "px",
        r: gameStackRotations[id]
    };
}

function updateCardStack(desk, cards) {
    try {
        if (desk !== undefined) {
            var isGameStack = cards === gameStack;
            desk.empty();
            if (cards !== undefined && cards.length > 0) {
                var isCovered = (cards === coveredStack);
                var rotStepX = 7.5; // in degrees
                for (var i = 0; i < cards.length; i++) {
                    var svg = (isCovered) ? getSvgCard(cards[i]).getUI().clone() : getSvgCard(cards[i]).getUI();
                    var card = $(svg);
                    card.css("position", "fixed");
                    desk.append(card);
                    if (isGameStack) {
                        var props = getGameStackProperties(i, card, desk);
                        card.css({top: props.y, left: props.x, transform: "rotate(" + props.r + "deg)"});
                    } else {
                        var shiftX = 0.5 * card.width();
                        var y = ((desk.height() - card.height()) >> 1);
                        var x = ((desk.width() - card.width()) >> 1) - shiftX;
                        card.css("top", desk.offset().top + y + "px");
                        card.css("left", desk.offset().left + x + i * shiftX + "px");
                        card.css("transform", "rotate(" + (-rotStepX + i * rotStepX) + "deg)");
                    }
                    card.css("transform-origin", "50% 50%");
                }
            }
        }
    } catch (e) {
        log("Fehler in updateAttendeeStacks(): '" + e + "'");
    }
}

/* ---------------------------------------------------------------------------*/



function animateGameDialog(dialog, readyFunction) {
    var time = 3000;
    setGameDialogVisible(dialog, true);
    setTimeout(function () {
        setGameDialogVisible(dialog, false);
        if (typeof readyFunction === "function") {
            readyFunction();
        }
    }, time);
}

function setGameDialogVisible(dialog, visible) {
    if (visible) {
        dialog.slideDown(fadePanelSpeed);
    } else {
        dialog.slideUp(fadePanelSpeed);
    }
}

function getShuffleCardsPosition(card) {
    var dealerStack = attendeesCardStacks[getPlayerIdByName(mover)];
    var off = dealerStack.offset();
    return {
        top: off.top + (dealerStack.height() - card.height()),
        left: off.left + (dealerStack.width() - card.width()) * 0.5,
        stack: dealerStack
    };
}

function setShuffling(isShuffling) {
    if (isShuffling) {
        sound.shuffle.loop = true;
        sound.shuffle.play();
        $("body").prepend(shufflingCard);
        var pos = getShuffleCardsPosition(shufflingCard);
        shufflingCard.css({position: "fixed", top: pos.top, left: pos.left});
        pos.stack.append(shufflingCard);
        var shakeTime = 1000;
        var shakes = 6;
        var shakeAmount = 2;
        function loopShake() {
            shufflingCard.effect("shake", {distance: shakeAmount, times: shakes}, shakeTime, loopShake);
        }
        loopShake();
    } else if (sound !== undefined && !(sound.shuffle.paused)) {
        sound.shuffle.pause();
        shufflingCard.stop();
        shufflingCard.remove();
    }
}


/* ---------------------------------------------------------------------------*/


function isAttendee() {
    return getMyAttendeeId() >= 0;
}

function getMyPlayerId() {
    return  getIdByName(myName, players);
}

function getMyAttendeeId() {
    return  getAttendeeIdByName(myName);
}

function getAttendeeIdByName(name) {
    return getIdByName(name, attendees);
}

function getPlayerIdByName(name) {
    return getIdByName(name, players);
}

function getIdByName(name, aList) {
    if (aList !== undefined) {
        for (var i = 0; i < aList.length; i++) {
            if (name === aList[i].name) {
                return i;
            }
        }
    }
    return -1;
}

function getPlayerId(player) {
    return getIdByName(player.name, players);
}

function getNextAttendeeId(currentId) {
    var id = currentId + 1;
    return id < attendees.length ? id : 0;
}


/* ---------------------------------------------------------------------------*/


function sendChatMessage() {
    var msgField = $("#chatMessage");
    var msg = {"action": "chat", "text": msgField.val()};
    webSocket.send(JSON.stringify(msg));
    msgField.val("");
}

function startGame() {
    var msg = {"action": "startGame"};
    webSocket.send(JSON.stringify(msg));
}

function addToAttendees() {
    var msg = {"action": "addToAttendees"};
    webSocket.send(JSON.stringify(msg));
}

function removeFromAttendees() {
    var msg = {"action": "removeFromAttendees"};
    webSocket.send(JSON.stringify(msg));
}

