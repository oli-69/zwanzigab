var myName;
var gamePhase;
var trump;
var players; // list of all players in the room
var attendees; // list of players currently in game
var mover;
var admin;
var dealer;
var attendeeStacks = [];
var gameStack;
var stackStarterId = -1;
var gameStackOffsets = [];
var gameStackRotations = [];
var cardFlips = [5];
var gameDesk;
var attendeesCardStacks = [];
var attendeesDropCardPositions = [];
var coveredCard = {color: -1, value: -1};
var shufflingCard;
var messageInProgress;
var webradioStateLoaded = false; // get webradio state only the first time 
var selectedCards = [];
var canSkip;
var allowedMoves;
var scoreboard;
var roundInfo;
var roundCounter;
var gameWinner;
var helpWindow;
var adminWindow;
var radioList = [];

function onDocumentReady() {
    $("#loginConsole").text("Anmeldung vorbereiten...");
    createCards(function () {
        $("#connectBtn").prop("disabled", false);
        $("#loginConsole").html("&nbsp;");
    });
    gameDesk = $("#gameDesk");
    controlPanel = $("#controlPanel");
    shufflingCard = $(getSvgCard(coveredCard).getUI()).clone();
    roundInfo = $("#roundInfo");
    scoreboard = $("#scoreboard");
    helpWindow = $("#helpWindow");
    helpWindow.hide();
    adminWindow = $("#adminWindow");
    adminWindow.hide();
    setGameDialogVisible($("#joinInOutDialog"), false);
    setGameDialogVisible($("#dealCardsDialog"), false);
    setGameDialogVisible($("#heartBlindDialog"), false);
    setGameDialogVisible($("#trumpDialog"), false);
    setGameDialogVisible($("#gameOverDialog"), false);
    setGameDialogVisible($("#buyDialog"), false);
    setGameDialogVisible($("#buyResultDialog"), false);
    setGameDialogVisible($("#startRoundDialog"), false);

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
        updateGameStack();
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
        log("Starting action " + action + " (" + messageBuffer.length + " messages left)");
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
    admin = message.playerList.admin;
    dealer = message.dealer;
    trump = message.trump;
    canSkip = message.canSkip;
    allowedMoves = message.allowedMoves;
    gameStack = message.gameStack.cards;
    stackStarterId = message.stackStarterId;
    gameStackOffsets = message.gameStack.offset;
    gameStackRotations = message.gameStack.rotation;
    roundCounter = message.roundCounter;
    gameWinner = message.gameWinner;
    parseAttendeeStacks(message.attendeeStacks);
    updatePlayerList();
    updateAttendeeList();
    updateAttendeeStacks();
    onGamePhase(gamePhase);
    setWebRadioUrl(message.radioUrl.url);
    updateRadioList(message.radioUrl.url);
    if (!webradioStateLoaded) {
        setWebRadioPlaying(message.webradioPlaying);
        webradioStateLoaded = true;
    }
}

function onGamePhaseMessage(message) {
    mover = undefined;
    gamePhase = message.phase;
    mover = message.actor;
    canSkip = message.canSkip;
    allowedMoves = message.allowedMoves;
    roundCounter = message.roundCounter;
    gameWinner = message.gameWinner;
    var readyFunction = function () {
        onGamePhase(gamePhase);
        onMessageBuffer();
    };
    switch (gamePhase) {
        case "shuffle":
            dealer = attendees[getPreviousAttendeeId(getPlayerIdByName(mover))].name;
            updateAttendeeStacks(undefined);
            readyFunction();
            break;
        case "deal3cards":
        case "deal2cards":
        case "deal5cards":
            updateAttendeeList();
            updateAttendeeStacks();
            sound.deal.play();
            var animateDeal = (gamePhase === "deal5cards") ? animateDeal5Cards : ((gamePhase === "deal3cards") ? animateDeal3Cards : animateDeal2Cards);
            animateDeal(readyFunction);
            break;
        case "waitForAttendees":
            updateAttendeeList();
            readyFunction();
            break;
        case "buy":
        case "waitForPlayerMove":
        case "gameOver":
            readyFunction();
            break;
        default:
            log("WARNING: unknown gamePhase: '" + gamePhase + "'");
            readyFunction();
            break;
    }
}

function onGamePhase(phase) {
    log("onGamePhase: " + phase);
    var isWaitForAttendees = (phase === "waitForAttendees");
    var meIsMover = (mover === myName);
    var isWaitForPlayerMove = phase === "waitForPlayerMove";
    var isBuy = phase === "buy";

    $("#gameOverMessage").html(gameWinner + " hat gewonnen");
    setGameDialogVisible($("#joinInOutDialog"), isWaitForAttendees);
    setGameDialogVisible($("#heartBlindDialog"), meIsMover && phase === "shuffle");
    setGameDialogVisible($("#trumpDialog"), meIsMover && phase === "deal3cards");
    setGameDialogVisible($("#buyDialog"), meIsMover && phase === "buy");
    setGameDialogVisible($("#gameOverDialog"), phase === "gameOver");
    initDialogButtons();

    // reset all card selections and hovers
    resetUICards();

    // Game Area
    if (isWaitForAttendees || phase === "shuffle") {
        trump = undefined;
        emptyAllStackDesks();
    }
    updatePlayerList();
    updateRoundInfo();
    updateScoreboard();
    updateControlPanelMessage();
    updateGameStack();
    updateAttendeeStacks();
    updateAttendeeDeskColor();
    updateAdminWindow();

    // Control Panel
    if (meIsMover && (isBuy || isWaitForPlayerMove)) {
        controlPanel.show();
    } else {
        controlPanel.hide();
    }
    if (meIsMover && isWaitForPlayerMove) {
        $("#playCardBtn").show();
        $("#confirmMoveContainer").show();
    } else {
        $("#playCardBtn").hide();
        $("#confirmMoveContainer").hide();
    }
    if (meIsMover && isBuy) {
        $("#skipBtn").show();
    } else {
        $("#skipBtn").hide();
    }
    $("#skipBtn").prop("disabled", !canSkip);
    $("#playCardBtn").prop("disabled", !($("#confirmMove").prop("checked") && selectedCards.length === 1))
//    $("#logoffBtn").prop("disabled", !(isWaitForAttendees && isActive));

    selectedCards = [];
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
        $("#startGameBtn").prop("disabled", attendees === null || attendees === undefined || attendees.length < 2);
        $("#confirmGameOverBtn").show();
    } else {
        $("#startGameBtn").prop("disabled", true);
        $("#confirmGameOverBtn").hide();
    }
}

function onRadioListChanged(list) {
    log("process onRadioListChanged");
    radioList = list;
    var adminRadioBox = $("#cfgRadioList");
    var id = 0;
    adminRadioBox.empty();
    radioList.forEach(function (radioUrl) {
        $("<option/>").val(id++).text(radioUrl.name).appendTo(adminRadioBox);
    });
    updateRadioList(radioUrl)
}

function onPlayerList(message) {
    messageInProgress = false;
    players = message.players;
    admin = message.admin;
    updatePlayerList();
    updateAdminWindow();
}

function onPlayerOnline(message) {
    messageInProgress = false;
    players.forEach(function (player) {
        if (player.name === message.name) {
            player.online = message.online;
        }
    });
    admin = message.admin;
    updatePlayerList();
    updateAdminWindow();
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
    updateAdminWindow();
}

function onAttendeeStacks(message) {
    messageInProgress = false;
    parseAttendeeStacks(message);
    logStack("Player Stack", attendeeStacks[getMyAttendeeId()]);
}

function parseAttendeeStacks(attendeeStacksMessage) {
    var keys = Object.keys(attendeeStacksMessage.stackMap);
    if (keys !== undefined && keys !== null) {
        keys.forEach(function (id) {
            attendeeStacks[id] = attendeeStacksMessage.stackMap[id].cards;
        });
    }
}

function onSortedStack(message) {
    var id = getMyAttendeeId();
    var srcStack = attendeeStacks[id];
    attendeeStacks[id] = message.stack.cards;

    var readyFunction = function () {
        logStack("Player Stack", attendeeStacks[id]);
        messageInProgress = false;
        onMessageBuffer();
    };
    var childs = attendeesCardStacks[id].children();
    var dstStack = attendeeStacks[id];
    var card;
    var refProps = getCardAnimProps($(childs[Math.round(dstStack.length * 0.5) - 1]));
    var dstProps = [];
    for (var i = 0; i < srcStack.length; i++) {
        dstProps[i] = getCardAnimProps($(childs[i]));
    }
    var animTime = 400;
    var loopBack = function () {
        updateAttendeeStack(attendeesCardStacks[id], attendeeStacks[id]);
        childs = attendeesCardStacks[id].children();
        for (var i = 0; i < childs.length; i++) {
            card = $(childs[i]);
            animateSingleCard(card, refProps.y, refProps.x, refProps.r, dstProps[i],
                    0, animTime, (i === dstStack.length - 1) ? readyFunction : undefined);
        }
    };
    var srcProps;
    sound.sort.play();
    for (var i = 0; i < srcStack.length; i++) {
        card = $(childs[i]);
        srcProps = getCardAnimProps(card);
        animateSingleCard(card, srcProps.y, srcProps.x, srcProps.r, refProps,
                0, animTime, (i === srcStack.length - 1) ? loopBack : undefined);
    }
}

function onTrump(message) {
    trump = message;
    var animateTrumpFunction = function () {
        if (!trump.blind) {
            sound.trump.play();
        }
        animateTrumpSelected(function () {
            messageInProgress = false;
            onMessageBuffer();
        });
    };
    if (trump !== undefined && trump !== null && trump.value > 0) {
        animateNextCardTrump({color: trump.color, value: trump.value}, trump.dt, animateTrumpFunction);
    } else {
        if (trump.blind) {
            setShuffling(false);
            sound.hblind.play();
        }
        animateTrumpFunction();
    }
}

function onBuyResult(message) {
    var messageDialog = $("#buyResultDialog");
    var messageField = $("#buyResultDialogMessage");
    var meIsMover = mover === myName
    var readyFunction = function () {
        updateScoreboard();
        messageInProgress = false;
        onMessageBuffer();
    };
    if (message.skip) {
        attendees[getAttendeeIdByName(mover)].skipcount++;
        messageField.html((meIsMover ? "Du" : mover) + " setzt aus");
        animateGameDialog(messageDialog);
        animateDropCards([0, 1, 2, 3, 4], function () {
            attendeeStacks[getAttendeeIdByName(mover)] = [];
            setTimeout(function () {
                readyFunction();
            }, 1000);
        });
    } else if (message.cardIDs !== undefined && message.cardIDs !== null && message.cardIDs.length > 0) {
        attendees[getAttendeeIdByName(mover)].skipcount = 0;
        messageField.html((meIsMover ? "Du nimmst " : (mover + " nimmt ")) + message.cardIDs.length + " Karten");
        animateGameDialog(messageDialog);
        animateDropCards(message.cardIDs, function () {
            setTimeout(function () {
                animateDealBuyCards(message.cardIDs, message.stack, readyFunction);
            }, 1000);
        });
    } else {
        sound.pass.play();
        attendees[getAttendeeIdByName(mover)].skipcount = 0;
        messageField.html((meIsMover ? "Du nimmst " : (mover + " nimmt ")) + "keine Karten");
        animateGameDialog(messageDialog, readyFunction);
    }
}

function onStartRound(message) {
    var readyFunction = function () {
        messageInProgress = false;
        onMessageBuffer();
    };
    mover = message.mover;
    var dialog = $("#startRoundDialog");
    $("#startRoundDialogMessage").html(mover === myName ? "Du beginnst" : (mover + " beginnt"));
    sound.startround.play();
    animateGameDialog(dialog, readyFunction);
}

function onMoveResult(message) {
    stackStarterId = message.stackStarterId;
    gameStackOffsets = message.gameStack.offset;
    gameStackRotations = message.gameStack.rotation;
    cardFlips = message.gameStack.cardFlips;
    var moverID = getAttendeeIdByName(mover);
    var readyFunction = function () {
        if (moverID === getMyAttendeeId()) {
            attendeeStacks[moverID] = message.playerStack.cards;
        } else {
            attendeeStacks[moverID].pop();
        }
        gameStack = message.gameStack.cards;
        onGamePhase(gamePhase);
        messageInProgress = false;
        onMessageBuffer();
    };
    sound.click.play();
    animatePlayCard(moverID, message.cardID, message.card, readyFunction);
}

function onStackResult(message) {
    var readyFunction = function () {
        gameStack = message.gameStack.cards;
        gameStackOffsets = message.gameStack.offset;
        gameStackRotations = message.gameStack.rotation;
        cardFlips = message.gameStack.cardFlips;
        attendees = message.attendees.attendees;
        updateAttendeeList();
        messageInProgress = false;
        onMessageBuffer();
    };
    setTimeout(function () {
        animateStackResult(message.stackWinnerId, readyFunction);
    }, 1000);
}

function onRoundResult(message) {
    var readyFunction = function () {
        updateAttendeeList();
        messageInProgress = false;
        onMessageBuffer();
    };
    attendees = message.attendees.attendees;
    animateRoundResult(readyFunction);
}

function onGameResult(message) {
    var readyFunction = function () {
        messageInProgress = false;
        onMessageBuffer();
    };
    sound.gameover.onended = function () {
        players = message.players.players;
        updatePlayerList();
        animateGameResult(readyFunction);
    };
    sound.gameover.play();
}

function logStack(name, stack) {
    var msg = name + ": ";
    if (stack !== undefined) {
        for (var i = 0; i < stack.length; i++) {
            msg = msg + (i + 1) + ":'" + card2String(stack[i].color, stack[i].value) + "' ";
        }
    }
    log(msg);
}

/* ---------------------------------------------------------------------------*/


function updateControlPanelMessage() {
    var msg = "";
    if (myName === mover) {
        msg = "Du bist dran";
    } else {
        if (mover !== undefined && mover !== "") {
            msg = mover + " ist dran";
        }
    }
    $("#bottomPanelMessage").html(msg);
}

function updatePlayerList() {
    var panel = $("#playerListPanel");
    panel.empty();
    players.forEach(function (player) {
        var className = player.online ? "playerOnline" : "playerOffline";
        var admnImg = (admin === player.name) ? "dot-blue-8.png" : "dot-empty-8.png";
        var tokens = (0.1 * player.totalTokens).toFixed(2);
        var container = $("<div class='" + className + "'></div>");
        container.append($("<img src='" + admnImg + "' border=0>"));
        container.append(player.name);
        container.append("<br>&euro; " + tokens);
        panel.append(container);
    });
}

function updateRoundInfo() {
    if (gamePhase === "waitForAttendees") {
        roundInfo.hide();
    } else {
        roundInfo.show();
        $("#roundCounter").html("" + roundCounter);
        var trumpHtml = "";
        if (trump !== undefined && trump !== null) {
            var factor = trump.color === HERZ ? (trump.blind ? "x4" : "x2") : "";
            trumpHtml = "<div class='trumpSymbol" + cardColorToString(trump.color) + "'>" + factor + "</div>";
        }
        $("#trumpSymbolContainer").html(trumpHtml);
    }
}

function updateScoreboard() {
    if (gamePhase === "waitForAttendees") {
        scoreboard.hide();
    } else {
        scoreboard.empty();
        for (var i = 0; i < attendees.length; i++) {
            scoreboard.append(
                    "<div class='scoreboardEntryName'>" +
                    attendees[i].name +
                    "</div><div class='scoreboardEntryColon'>:</div><div class='scoreboardEntryScore'>" +
                    attendees[i].gameTokens +
                    "</div><div class='scoreboardEntrySkips'>" +
                    getTallymarks(attendees[i].skipcount) +
                    "</div>"
                    );
        }
        scoreboard.show();
    }
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
        panel.append(gameDesk);
        gameDesk.css({top: (panel.height() - gameDesk.height()) * 0.5 - ((isSmallSize) ? 0.075 : 0.085) * panel.height() + "px", left: (panel.width() - gameDesk.width()) * 0.5 + "px"});
        var gdOff = gameDesk.offset();
        var gdCenter = {y: gdOff.top + 0.5 * gameDesk.height(), x: gdOff.left + 0.5 * gameDesk.width()};
        for (var i = 0; i < numPl; i++) {
            id = getNextAttendeeId(id);
            attendeesCardStacks[id] = createCardStack();
            var player = attendees[ id ];
            var attendeeDesk = createAttendeeDesk(player, attendeesCardStacks[id]);
            if (id === myId) { // add the game desk here
                panel.append(gameDesk);
            }
            panel.append(attendeeDesk);
            var l = (panel.width() * 0.5) + rx * Math.cos(angle) - (attendeeDesk.outerWidth() >> 1);
            var t = ((panel.height() * 0.5) + ry * Math.sin(angle)
                    - (1.1 * attendeesCardStacks[id].outerHeight() * ((isSmallSize && othersCount > 1) ? 1.4 : 1)));
            attendeeDesk.css({left: l + "px", top: t + "px"});

            attendeesDropCardPositions[id] = {
                y: gdCenter.y + (0.15 * gameDesk.height()) * Math.sin(angle),
                x: gdCenter.x + (0.15 * gameDesk.width()) * Math.cos(angle)
            };

            if (id === myId) { // set the control panel position here
                controlPanel.css({left: l + attendeeDesk.outerWidth() + 4 + "px", top: t + "px"});
            }
            angle += step;
        }
        if (!isAttendee()) {
            gameDesk.remove();
            panel.append(gameDesk);
        }

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
    var tallymarks = getTallymarks(player.roundTokens);
    nameContainer.append(nameDiv);
    nameContainer.append($("<div class='tallymarks'>" + tallymarks + "</div>"));
    playerDesk.append(stackDesk).append(nameContainer);
    return playerDesk;
}

function emptyAllStackDesks() {
    for (var i = 0; i < attendeeStacks.length; i++) {
        attendeeStacks[i] = [];
    }
    gameStack = [];
    attendeesCardStacks.forEach(function (desk) {
        desk.empty();
    });
    $("#gameStack").empty();
}

function updateAttendeeStacks() {
    try {
        for (var i = 0; i < attendees.length; i++) {
            updateAttendeeStack(attendeesCardStacks[i], attendeeStacks[i]);
        }
    } catch (e) {
        log("Fehler in updateAttendeeStacks(): '" + e + "'");
    }
}

function updateAttendeeStack(desk, cards) {
    desk.empty();
    if (cards !== undefined && cards.length > 0) {
        var rotStepX = 7; // in degrees
        var rotBase = Math.ceil(-0.5 * cards.length) * rotStepX;
        for (var i = 0; i < cards.length; i++) {
            var isCovered = cards[i].color < 0 || cards[i].value < 0;
            var cardObj = $((isCovered) ? getSvgCard(cards[i]).getUI().clone() : getSvgCard(cards[i]).getUI());
            cardObj.css("position", "fixed");
            desk.append(cardObj);
            var shiftX = 0.3 * cardObj.width();
            var y = ((desk.height() - cardObj.height()) >> 1);
            var x = ((desk.width() - cardObj.width()) >> 1) - ((cards.length - 1) * 0.5 * shiftX);
            cardObj.css({
                "top": desk.offset().top + y + "px",
                "left": desk.offset().left + x + i * shiftX + "px",
                "transform": "rotate(" + (rotBase + i * rotStepX) + "deg)",
                "transform-origin": "50% 50%"
            });
        }
    }
}

function getGameStackProperties(id, card) {
    return  {
        y: attendeesDropCardPositions[id].y - 0.5 * card.height() + gameStackOffsets[id].y + "px",
        x: attendeesDropCardPositions[id].x - 0.5 * card.width() + gameStackOffsets[id].x + "px",
        r: gameStackRotations[id]
    };
}

function updateGameStack() {
    try {
        var desk = $("#gameStack");
        var cards = gameStack;
        desk.empty();
        var id = stackStarterId;
        if (id >= 0 && cards !== undefined) {
            for (var i = 0; i < cards.length; i++) {
                if (cards[id].color > 0) {
                    var cardObj = $(getSvgCard(cards[id]).getUI());
                    cardObj.css("position", "fixed");
                    desk.append(cardObj);
                    var props = getGameStackProperties(id, cardObj, desk);
                    cardObj.css({
                        "top": props.y,
                        "left": props.x,
                        "transform": "rotate(" + props.r + "deg)",
                        "transform-origin": "50% 50%"
                    });
                }
                id = getNextAttendeeId(id);
            }
        }
    } catch (e) {
        log("Fehler in updateGameStack(): '" + e + "'");
    }
}


function getTallymarks(value) {
    return value > 0 ? "&#" + (96 + value) + ";" : "";
}

function updateRadioList(radioUrl) {
    var adminRadioBox = $("#cfgRadioList");
    adminRadioBox.removeAttr('selected');
    for (var id = 0; id < radioList.length; id++) {
        if (radioUrl === radioList[id].url) {
            adminRadioBox.val(id);
            break;
        }
    }
}

function updateAdminWindow() {
    var isAdmin = (myName === admin);
    var isRunning = (gamePhase != "waitForAttendees");
    var isMinAttendees = (attendees.length > 1);
    $("#cfgStartGameBtn").prop("disabled", !(isAdmin && !isRunning && isMinAttendees));
    $("#cfgStopGameBtn").prop("disabled", !(isAdmin && isRunning));
    $("#cfgShufflePlayersBtn").prop("disabled", !(isAdmin && !isRunning && isMinAttendees));
    $("#cfgRadioList").prop("disabled", !(isAdmin));
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
    var dealerStack = attendeesCardStacks[getPlayerIdByName(dealer)];
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
        shufflingCard.css({position: "fixed", top: pos.top, left: pos.left, transform: "rotate(0deg) rotateY(0deg)"});
        pos.stack.append(shufflingCard);
        shufflingCard.show();
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

// Deal all 5 cards one-by-one (heart blind)
function animateDeal5Cards(readyFunction) {
    var cards = [];
    var props = [];
    var dealerId = getPlayerIdByName(dealer);
    var id = dealerId;
    var numPlayers = attendees.length;
    var c = 0;
    var childs;
    var card = shufflingCard;
    var pos = getShuffleCardsPosition(card);
    for (var y = 0; y < 5; y++) {
        for (var i = 0; i < numPlayers; i++) {
            id = getNextAttendeeId(id);
            childs = attendeesCardStacks[id].children();
            if (childs.length > 0) {
                card = $(childs[y]);
                props[c] = {x: card.css("left"), y: card.css("top"), r: getRotationDegrees(card)};
                card.css({top: pos.top, left: pos.left});
                card.hide();
                cards[c++] = card;
            }
        }
    }
    var delay = 400;
    var finish = function () {
        setTimeout(readyFunction, 1500)
    };
    log("Animate Deal 5 cards now");
    for (var i = 0; i < cards.length; i++) {
        animateDealSingleCard(cards[i], pos.top, pos.left, props[i], i * delay, (i === cards.length - 2) ? finish : undefined);
    }
}

function animateDeal3Cards(readyFunction) {
    animateDealCards(3, readyFunction);
}

function animateDeal2Cards(readyFunction) {
    animateDealCards(2, function () {
        setTimeout(readyFunction, 1500)
    });
}

function animateDealCards(count, readyFunction) {
    var cards = [];
    var props = [];
    var dealerId = getPlayerIdByName(dealer);
    var id = dealerId;
    var numPlayers = attendees.length;
    var childs;
    var card = shufflingCard;
    var pos = getShuffleCardsPosition(card);
    var isTrumpByNextCard = count === 2 && trump !== undefined && trump !== null && trump.value > 0;
    for (var p = 0; p < numPlayers; p++) {
        id = getNextAttendeeId(id);
        childs = attendeesCardStacks[id].children();
        cards[p] = [];
        props[p] = [];
        for (var c = 0; c < count; c++) {
            card = $(childs[childs.length - count + c]);
            props[p][c] = {x: card.css("left"), y: card.css("top"), r: getRotationDegrees(card)};
            card.css({top: pos.top, left: pos.left});
            card.hide();
            cards[p][c] = card;
        }
    }
    var delay = 800;
    var delaySum = 0;
    for (var p = 0; p < cards.length; p++) {
        for (var c = 0; c < cards[p].length; c++) {
            var isFirstCardOfPlayer = c === 0;
            var isLastCard = (p === (cards.length - 2) && (c === cards[p].length - 1)); // listen to the last player before dealer
            var srcPos = pos;
            delaySum += p * (isFirstCardOfPlayer ? delay : 0);
            if (isTrumpByNextCard && p === 0 && c === 0) {
                var trumpCard = $($("#gameStack").children()[0]);
                srcPos = trumpCard.offset();
                trumpCard.remove();
            }
            animateDealSingleCard(cards[p][c], srcPos.top, srcPos.left, props[p][c], delaySum, isLastCard ? readyFunction : undefined);
        }
    }
}

function animateDealSingleCard(card, top, left, props, delay, readyFunction) {
    var distance = Math.abs(calculateDistanceBetweenPoints(parseFloat(left), parseFloat(top), parseFloat(props.x), parseFloat(props.y)));
    var animTime = 2.5 * distance;
    animateSingleCard(card, top, left, 0, props, delay, animTime, readyFunction);
}

function animateSingleCard(card, top, left, rot, props, delay, animTime, readyFunction) {
    card.prop("rot", rot);
    card.css({top: top, left: left, transform: "rotate(" + rot + "deg)"});
    var animProps = {
        duration: animTime,
        step: function (now, tween) {
            if (tween.prop === "rot") {
                card.css("transform", "rotate(" + now + "deg)");
            }
        }
    };
    if (typeof readyFunction === "function") {
        animProps.complete = readyFunction;
    }
    setTimeout(function () {
        card.show();
        card.animate({top: props.y, left: props.x, rot: props.r}, animProps);
    }, delay);
}

function animateRotateY(target, srcDeg, dstDeg, persp, duration, readyFunction) {
    target.prop("rY", srcDeg);
    target.css({transform: "perspective(" + persp + "px) rotateY(" + srcDeg + "deg)"});
    var animProps = {
        duration: duration,
        step: function (now, tween) {
            if (tween.prop === "rY") {
                target.css("transform", "perspective(" + persp + "px) rotateY(" + now + "deg)");
            }
        }
    };
    if (typeof readyFunction === "function") {
        animProps.complete = readyFunction;
    }
    setTimeout(function () {
        target.show();
        target.animate({rY: dstDeg}, animProps);
    });

}

function calculateDistanceBetweenPoints(x1, y1, x2, y2) {
    return Math.sqrt((y2 - y1) * (y2 - y1) + (x2 - x1) * (x2 - x1));
}

function getRotationDegrees(obj) {
    var angle = 0;
    var matrix = obj.css("-webkit-transform") ||
            obj.css("-moz-transform") ||
            obj.css("-ms-transform") ||
            obj.css("-o-transform") ||
            obj.css("transform");
    if (matrix !== undefined && matrix !== 'none') {
        var values = matrix.split('(')[1].split(')')[0].split(',');
        var a = values[0];
        var b = values[1];
        angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
    }
    return angle;
}

function getCardAnimProps(card) {
    return {x: card.css("left"), y: card.css("top"), r: getRotationDegrees(card)};
}

function animateTrumpSelected(readyFunction) {
    updateRoundInfo();
    var scale = 16;
    var animTime = 750;
    var panel = $("#attendeesPanel");
    var symbol = $("#trumpSymbolContainer");
    var top = symbol.css("top");
    var left = symbol.css("left");
    symbol.css("left", (panel.width() - symbol.width()) >> 1);
    symbol.css("top", ((panel.height() - symbol.height()) >> 1) * 0.75);
    symbol.prop("sf", scale); // name "scale" and "size" won't work on all browsers
    var animProps = {
        duration: animTime,
        easing: "linear",
        step: function (now, tween) {
            if (tween.prop === "sf") {
                symbol.css("transform", "scale(" + now + ")");
            }
        }
    };
    if (typeof readyFunction === "function") {
        animProps.complete = readyFunction;
    }

    symbol.animate({top: top, left: left, sf: 1}, animProps);
}

function animateNextCardTrump(card, discoverTime, readyFunction) {
    $("body").prepend(shufflingCard);
    shufflingCard.css("position", "fixed");
    var srcPos = getShuffleCardsPosition(shufflingCard);
    var gameStack = $("#gameStack");
    var gameStackOffset = gameDesk.offset();
    var props = {
        y: gameStackOffset.top + ((gameDesk.height() - shufflingCard.height()) * 0.5),
        x: gameStackOffset.left + ((gameDesk.width() - shufflingCard.width()) * 0.5),
        r: 0
    };
    var discover = function () {
        setTimeout(function () {
            $(sound.tension).animate({volume: 0}, 2000);
            sound.dealBuy[0].play();
            var turnTime = 150;
            var persp = 300;
            var cardObj = $(getSvgCard(card).getUI().clone());
            cardObj.css("position", "fixed");
            cardObj.css("top", props.y);
            cardObj.css("left", props.x);
            cardObj.css("transform", "rotate(0deg) perspective(" + persp + "px) rotateY(-90deg)");
            gameStack.append(cardObj);
            shufflingCard.css("transform", "perspective(" + persp + "px)");
            animateRotateY(shufflingCard, 0, 90, persp, turnTime, function () {
                animateRotateY(cardObj, -90, 0, persp, turnTime, function () {
                    shufflingCard.remove();
                    setTimeout(readyFunction, 600);
                });
            });
        }, discoverTime);
    };
    sound.tension.volume = 0;
    sound.tension.play();
    $(sound.tension).animate({volume: 1}, 3000);
    gameStack.append(shufflingCard);
    animateSingleCard(shufflingCard, srcPos.top, srcPos.left, 0, props, 0, 2000, discover);
}

function animateDropCards(cardIDs, readyFunction) {
    var myId = getMyAttendeeId();
    var id = getAttendeeIdByName(mover);
    var childs = attendeesCardStacks[id].children();
    var gameDesk = $("#gameStack");
    var gdOffset = gameDesk.offset();
    var dstPos = {
        y: gdOffset.top + 0.5 * (gameDesk.height() - $(childs[0]).height()),
        x: gdOffset.left + 0.5 * (gameDesk.width() - $(childs[0]).width()),
        r: 0
    };
    for (var i = 0; i < cardIDs.length; i++) {
        var cardId = cardIDs[i];
        var oldCard = $(childs[cardId]);
        var srcProps = getCardAnimProps(oldCard);
        if (myId === id) {
            var newCard = $(getSvgCard(coveredCard).getUI().clone());
            newCard.css({top: srcProps.y, left: srcProps.x, transform: "rotate(" + srcProps.r + "deg)", position: "fixed"});
            oldCard.replaceWith(newCard);
            oldCard = newCard;
        }
        var isLastCard = i === (cardIDs.length - 1);
        var animTime = 800; //3 * calculateDistanceBetweenPoints(parseFloat(srcProps.x), parseFloat(srcProps.y), dstPos.x, dstPos.y);
        sound.dropcards.play();
        animateSingleCard(oldCard, srcProps.y, srcProps.x, srcProps.r, dstPos, 0, animTime, isLastCard ? readyFunction : undefined);
    }
}

function animateDealBuyCards(cardIDs, stack, readyFunction) {
    var srcPos = getShuffleCardsPosition(shufflingCard);
    var moverID = getAttendeeIdByName(mover);
    var newCards = stack.cards;
    var dstProps = [];
    attendeeStacks[moverID] = newCards;
    updateAttendeeStack(attendeesCardStacks[moverID], attendeeStacks[moverID]);
    var childs = attendeesCardStacks[moverID].children();
    for (var i = 0; i < cardIDs.length; i++) {
        var cardID = cardIDs[i];
        var card = $(childs[cardID]);
        dstProps[i] = getCardAnimProps(card);
        card.css({
            "top": srcPos.top,
            "left": srcPos.left,
            "transform": "rotate(0deg)"
        });
        card.hide();
    }
    for (var i = 0; i < cardIDs.length; i++) {
        var cardID = cardIDs[i];
        var isLastCard = i === (cardIDs.length - 1);
        var card = $(childs[cardID]);
        sound.dealBuy[cardIDs.length - 1].play();
        animateDealSingleCard(card, srcPos.top, srcPos.left, dstProps[i], i * 750, isLastCard ? readyFunction : undefined);
    }
}

function animatePlayCard(moverID, cardID, card, readyFunction) {
    var oldCard = $(attendeesCardStacks[moverID].children()[cardID]);
    var dstProps = getGameStackProperties(moverID, oldCard);
    dstProps.r += cardFlips[moverID] * 360;
    var srcProps = getCardAnimProps(oldCard);
    var newCard = $(getSvgCard(card).getUI().clone());
    newCard.css({
        "top": srcProps.y,
        "left": srcProps.x,
        "transform": "rotate(" + srcProps + "deg)",
        "position": "fixed"
    });
    if (moverID === getMyAttendeeId()) {
        oldCard.replaceWith(newCard);
    } else {
        oldCard.remove();
        $("#gameStack").append(newCard);
    }

    var aniTime = 800; // 4 * calculateDistanceBetweenPoints(parseFloat(srcProps.x), parseFloat(srcProps.y), parseFloat(dstProps.x), parseFloat(dstProps.y));
    animateSingleCard(newCard, srcProps.y, srcProps.x, srcProps.r, dstProps, 0, aniTime, readyFunction);
}

function animateStackResult(stackWinnerId, readyFunction) {
    var winnerStack = attendeesCardStacks[stackWinnerId];
    var off = winnerStack.offset();
    var childs = $("#gameStack").children();
    var cards = [];
    for (var i = 0; i < childs.length; i++) {
        cards[i] = $(childs[i]);
    }
    var dstProps = {
        y: off.top + (winnerStack.height() - cards[0].height()) * 0.5,
        x: off.left + (winnerStack.width() - cards[0].width()) * 0.5,
        r: 0
    };
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var srcPos = card.offset();
        var srcRot = getRotationDegrees(card);
        card.remove();
        card = $(getSvgCard(coveredCard).getUI().clone());
        card.css({
            "top": srcPos.top,
            "left": srcPos.left,
            "transform": "rotate(" + srcRot + "deg)",
            "position": "fixed"
        });
        var animTime = 1000; // 3 * calculateDistanceBetweenPoints(parseFloat(srcPos.top), parseFloat(srcPos.left), parseFloat(dstProps.x), parseFloat(dstProps.y));
        winnerStack.prepend(card);
        animateSingleCard(card, srcPos.top, srcPos.left, srcRot, dstProps, 0, animTime, (i === cards.length - 1) ? readyFunction : undefined);
    }
}

function animateRoundResult(readyFunction) {
    var animTime = 500;
    var sized = 1.5;
    updateScoreboard();
    scoreboard.css("transform-origin", "100% 0%");
    var loopback = function () {
        sound.points.play();
        animateScale(scoreboard, sized, 1.0, animTime, readyFunction);
    }
    animateScale(scoreboard, 1.0, sized, animTime, loopback);
}

function animateGameResult(readyFunction) {
    var animTime = 500;
    var sized = 1.5;
    var panel = $("#playerListPanel");
    panel.css("transform-origin", "50% 0%");
    var loopback = function () {
        sound.cash.play();
        animateScale(panel, sized, 1.0, animTime, readyFunction);
    }
    animateScale(panel, 1.0, sized, animTime, loopback);
}

function animateScale(element, srcScale, dstScale, animTime, readyFunction) {
    element.prop("scaleVal", srcScale);
    element.css("transform", "scale(" + srcScale + ")");
    var animProps = {
        duration: animTime,
        step: function (now, tween) {
            if (tween.prop === "scaleVal") {
                element.css("transform", "scale(" + now + ")");
            }
        },
    };

    if (typeof readyFunction === "function") {
        animProps.complete = readyFunction;
    }
    scoreboard.animate({scaleVal: dstScale}, animProps);
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


function getPreviousAttendeeId(currentId) {
    var id = currentId - 1;
    return id >= 0 ? id : (attendees.length - 1);
}

function getStackId(card, stack) {
    for (var i = 0; i < stack.length; i++) {
        if (stack[i].color === card.color
                && stack[i].value === card.value) {
            return i;
        }
    }
    return -1;
}

/* ---------------------------------------------------------------------------*/


function onOpenHelp() {
    helpWindow.slideDown(500);
}

function onCloseHelp() {
    helpWindow.slideUp(500);
}

function onOpenAdminWindow() {
    adminWindow.slideDown(500);
}

function onCloseAdminWindow() {
    adminWindow.slideUp(500);
}

function processCardHover(uiCard, isHover) {
    if (mover === myName && (gamePhase === "buy" || gamePhase === "waitForPlayerMove")) {
        uiCard.setHover(isHover);
    }
}

function processCardClick(uiCard) {
    if (mover === myName && (gamePhase === "buy" || gamePhase === "waitForPlayerMove")) {
        var myId = getMyAttendeeId();
        var cardId = getStackId(uiCard, attendeeStacks[myId]);
        if (cardId >= 0) {
            var card = getSvgCard(attendeeStacks[myId][cardId]);
            switch (gamePhase) {
                case "buy":
                    if (card.selected) {
                        selectedCards = selectedCards.filter(function (value, index, arr) {
                            return value !== cardId;
                        });
                        card.setSelected(false);
                    } else if (selectedCards.length < 3) {
                        selectedCards.push(cardId);
                        card.setSelected(true);
                    }
                    break;
                case "waitForPlayerMove":
                    var isConfirmMove = $("#confirmMove").prop("checked");
                    if (isConfirmMove && card.selected) {
                        selectedCards = [];
                        card.setSelected(false);
                    } else {
                        if (selectedCards.length > 0) {
                            getSvgCard(attendeeStacks[myId][selectedCards[0]]).setSelected(false);
                        }
                        selectedCards[0] = cardId;
                        card.setSelected(true);
                    }
                    $("#playCardBtn").prop("disabled", !(isConfirmMove && selectedCards.length === 1))
                    if ($("#playCardBtn").prop("disabled") === true) {
                        onPlayerMove();
                    }
                    break;
            }
        }
    }
}

function confirmMoveChanged() {
    $("#playCardBtn").prop("disabled", !($("#confirmMove").prop("checked") && selectedCards.length === 1));
}

function toggleConfirmMove() {
    var checkBox = $("#confirmMove");
    checkBox.prop("checked", (checkBox.prop("checked")));
    confirmMoveChanged();
}

function playCard() {
    onPlayerMove();
}

function skipRound() {
    var msg = {"action": "skip"};
    webSocket.send(JSON.stringify(msg));
}

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

function startDealing() {
    var msg = {"action": "dealCards"};
    webSocket.send(JSON.stringify(msg));
}

function onHeartBlindSelection(isBlind) {
    setGameDialogVisible($("#heartBlindDialog"), false);
    var msg = {"action": "heartBlind", "value": isBlind};
    webSocket.send(JSON.stringify(msg));
}

function onTrumpSelection(trump) {
    setGameDialogVisible($("#trumpDialog"), false);
    var msg = {"action": "setTrump", "value": trump};
    webSocket.send(JSON.stringify(msg));
}

function onBuy() {
    resetUICards();
    setGameDialogVisible($("#buyDialog"), false);
    var msg = {"action": "buy", "cardIDs": selectedCards};
    selectedCards = [];
    webSocket.send(JSON.stringify(msg));
}

function onSkip() {
    resetUICards();
    setGameDialogVisible($("#buyDialog"), false);
    var msg = {"action": "skip"};
    selectedCards = [];
    webSocket.send(JSON.stringify(msg));
}

function onPlayerMove() {
    if (selectedCards.length === 1) {
        if (allowedMoves.includes(selectedCards[0])) {
            resetUICards();
            var msg = {"action": "move", cardID: selectedCards[0]};
            selectedCards = [];
            webSocket.send(JSON.stringify(msg));
        } else {
            sound.wrong.currentTime = 0;
            sound.wrong.play();
            getSvgCard(attendeeStacks[getMyAttendeeId()][selectedCards[0]]).blink();
        }
    }
}

function onConfirmGameOver() {
    var msg = {"action": "confirmGameOver"};
    webSocket.send(JSON.stringify(msg));
}