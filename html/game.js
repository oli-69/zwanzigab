var myName;
var gamePhase;
var trump;
var players; // list of all players in the room
var attendees; // list of players currently in game
var mover;
var attendeeStacks = [];
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
    setGameDialogVisible($("#heartBlindDialog"), false);
    setGameDialogVisible($("#trumpDialog"), false);

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
    trump = message.trump;
//    gameStack = message.gameStack.cards;
//    gameStackOffsets = message.gameStack.offset;
//    gameStackRotations = message.gameStack.rotation;
    parseAttendeeStacks(message.attendeeStacks);
    updatePlayerList();
    updateAttendeeList();
    updateAttendeeStacks();
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
    var readyFunction = function () {
        onGamePhase(gamePhase);
        onMessageBuffer();
    };
    switch (gamePhase) {
        case "shuffle":
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
//        case "waitForPlayerMove":
//            updateAttendeeStacks(undefined);
            readyFunction();
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
    setGameDialogVisible($("#heartBlindDialog"), meIsMover && phase === "shuffle");
    setGameDialogVisible($("#trumpDialog"), meIsMover && phase === "deal3cards");
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
    updateControlPanelMessage();
//    updateCardStack($("#gameStack"), gameStack);
    updateAttendeeStacks();
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
        messageInProgress = false;
        onMessageBuffer();
    };
    var childs = attendeesCardStacks[id].children();
    var dstStack = attendeeStacks[id];
    var card;
    var refProps = getCardAnimProps($(childs[Math.round(dstStack.length * 0.5) - 1]));
    var srcProps;
    var dstProps = [];
    for (var i = 0; i < srcStack.length; i++) {
        dstProps[i] = getCardAnimProps($(childs[ getStackId(srcStack[i], dstStack)]));
    }
    var loopBack = function () {
        updateCardStack(attendeesCardStacks[id], attendeeStacks[id]);
        for (var i = 0; i < srcStack.length; i++) {
            card = $(childs[i]);
            card.css({top: refProps.y, left: refProps.x});
            animateSingleCard(card, parseFloat(refProps.y), parseFloat(refProps.x), refProps.r, dstProps[i],
                    0, 1000, (i === dstStack.length - 1) ? readyFunction() : undefined);
        }
    };
    for (var i = 0; i < srcStack.length; i++) {
        card = $(childs[i]);
        srcProps = getCardAnimProps($(childs[i]));
        card.css({top: srcProps.y, left: srcProps.x});
        animateSingleCard(card, parseFloat(srcProps.y), parseFloat(srcProps.x), srcProps.r, refProps,
                0, 1000, (i === dstStack.length - 1) ? loopBack : undefined);
    }
}

function onTrump(message) {
    trump = message;
    var animateTrumpFunction = function () {
        animateTrumpSelected(function () {
            messageInProgress = false;
            onMessageBuffer();
        });
    };
    if (trump !== undefined && trump !== null && trump.value > 0) {
        animateNextCardTrump({color: trump.color, value: trump.value}, trump.dt, animateTrumpFunction);
    } else {
        animateTrumpFunction();
    }
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
        var tokens = (0.1 * player.totalTokens).toFixed(2);
        var container = $("<div class='" + className + "'></div>");
        container.append(player.name);
        container.append("<br>&euro; " + tokens);
        panel.append(container);
    });
}

function updateRoundInfo() {
    var panel = $("#roundInfo");
    if (gamePhase === "waitForAttendees") {
        panel.hide();
    } else {
        panel.show();
        $("#roundCounter").html("1");
        var trumpHtml = "";
        if (trump !== undefined && trump !== null) {
            trumpHtml = "<div class='trumpSymbol" + cardColorToString(trump.color) + "'>" + (trump.blind ? "x2" : "") + "</div>";
        }
        $("#trumpSymbolContainer").html(trumpHtml);
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
            updateCardStack(attendeesCardStacks[i], attendeeStacks[i]);
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
                var rotStepX = 7; // in degrees
                var rotBase = -0.5 * rotStepX * cards.length;
                for (var i = 0; i < cards.length; i++) {
                    var isCovered = cards[i].color < 0 || cards[i].value < 0;
                    var svg = (isCovered) ? getSvgCard(cards[i]).getUI().clone() : getSvgCard(cards[i]).getUI();
                    var cardObj = $(svg);
                    cardObj.css("position", "fixed");
                    desk.append(cardObj);
                    if (isGameStack) {
                        var props = getGameStackProperties(i, cardObj, desk);
                        cardObj.css({top: props.y, left: props.x, transform: "rotate(" + props.r + "deg)"});
                    } else {
                        var shiftX = 0.3 * cardObj.width();
                        var y = ((desk.height() - cardObj.height()) >> 1);
                        var x = ((desk.width() - cardObj.width()) >> 1) - ((cards.length - 1) * 0.5 * shiftX);
                        cardObj.css("top", desk.offset().top + y + "px");
                        cardObj.css("left", desk.offset().left + x + i * shiftX + "px");
                        cardObj.css("transform", "rotate(" + (rotBase + i * rotStepX) + "deg)");
                    }
                    cardObj.css("transform-origin", "50% 50%");
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
    var dealerStack = attendeesCardStacks[getPreviousAttendeeId(getPlayerIdByName(mover))];
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

// Deal all 5 cards one-by-one (heart blind)
function animateDeal5Cards(readyFunction) {
    var cards = [];
    var props = [];
    var dealerId = getPreviousAttendeeId(getPlayerIdByName(mover));
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
    for (var i = 0; i < cards.length; i++) {
        animateDealSingleCard(cards[i], pos.top, pos.left, props[i], i * delay, (i === cards.length - 1) ? finish : undefined);
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
    var dealerId = getPreviousAttendeeId(getPlayerIdByName(mover));
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
            var isLastCard = (p === cards.length - 1 && c === cards[p].length - 1);
            var srcPos = pos;
            delaySum += p * (isFirstCardOfPlayer ? delay : 0);
            if (isTrumpByNextCard && p === 0 && c === 0) {
                var trumpCard = $($("#gameStack").children()[0]);
                srcPos = trumpCard.offset();
                cards[p][c].css({top: srcPos.top, left: srcPos.left});
                trumpCard.remove();
            }
            animateDealSingleCard(cards[p][c], srcPos.top, srcPos.left, props[p][c], delaySum, isLastCard ? readyFunction : undefined);
        }
    }
}

function animateDealSingleCard(card, top, left, props, delay, readyFunction) {
    var distance = Math.abs(calculateDistanceBetweenPoints(left, top, parseFloat(props.x), parseFloat(props.y)));
    var animTime = 4.5 * distance;
    animateSingleCard(card, top, left, 0, props, delay, animTime, readyFunction);
}

function animateSingleCard(card, top, left, rot, props, delay, animTime, readyFunction) {
    card.prop("rot", rot);
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
    if (matrix !== 'none') {
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
            var cardObj = $(getSvgCard(card).getUI().clone());
            cardObj.css("position", "fixed");
            cardObj.css("top", props.y);
            cardObj.css("left", props.x);
            cardObj.css("transform", "rotate(0)");
            shufflingCard.remove();
            gameStack.append(cardObj);
            setTimeout(readyFunction, 300);
        }, discoverTime);
    };
    gameStack.append(shufflingCard);
    animateSingleCard(shufflingCard, srcPos.top, srcPos.left, 0, props, 0, 2000, discover);
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
