package zwanzigab;

import cardgame.Card;
import cardgame.CardGame;
import static cardgame.CardGame.PROP_ATTENDEESLIST;
import cardgame.GameStackProperties;
import cardgame.Player;
import cardgame.SocketMessage;
import cardgame.messages.AttendeeList;
import cardgame.messages.AttendeeStacks;
import cardgame.messages.PlayerList;
import cardgame.messages.WebradioUrl;
import com.google.gson.JsonArray;
import java.awt.Image;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.swing.ImageIcon;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import zwanzigab.messages.BuyResult;
import zwanzigab.messages.GamePhase;
import zwanzigab.messages.GameResult;
import zwanzigab.messages.GameStateMessage;
import zwanzigab.messages.MoveResult;
import zwanzigab.messages.RoundResult;
import zwanzigab.messages.SortedStack;
import zwanzigab.messages.StackResult;
import zwanzigab.messages.StartRound;
import zwanzigab.messages.Trump;

/**
 * This class implements the game rules and evaluates the player's decisions.
 */
public class ZwanzigAbGame extends CardGame {

    private static final Logger LOGGER = LogManager.getLogger(ZwanzigAbGame.class);
    private static final String GAME_NAME = "Zwanzig Ab Server";
    private static Image GAME_ICON;

    private final CardDealService cardDealService;
    private final Round round;
    private final CardComparator cardComparator;
    private final GameStackProperties gameStackProperties;

    private GAMEPHASE gamePhase = GAMEPHASE.waitForAttendees;
    private Player gameStartDealer = null;
    private Player gameWinner;

    /**
     * Enumeration of the game phases.
     */
    public static enum GAMEPHASE {
        /**
         * The game didn's start yet. Player's can choose to attend the next
         * round, or not.
         */
        waitForAttendees,
        /**
         * The card dealer is shuffling. The player next to the dealer ends this
         * phase by choosing/denying hart blind.
         */
        shuffle,
        /**
         * The card dealer dispenses the first three cards.
         */
        deal3cards,
        /**
         * The card dealer dispenses the last two cards after the player defined
         * the trump color.
         */
        deal2cards,
        /**
         * The player wants "herz-blind" for trump. Deal all 5 cards at once.
         */
        deal5cards,
        /**
         * The players buy new cards or decide to suspend.
         */
        buy,
        /**
         * Game is waiting for next player move.
         */
        waitForPlayerMove,
        /**
         * Game is over. One or more players have reached zero points (game
         * tokens).
         */
        gameOver
    };

    /**
     * Default Constructor. Creates an instance of this class.
     */
    public ZwanzigAbGame() {
        this("", new ArrayList<>(), new ArrayList<>());
    }

    /**
     * Constructor. Creates an instance of this class from given Value.
     *
     * @param conferenceName the room name for the jitsi conference
     * @param webradioList list of known webradios
     */
    public ZwanzigAbGame(String conferenceName, List<WebradioUrl> webradioList, List<String> adminNames) {
        this(Collections.synchronizedList(new ArrayList<>()), conferenceName, new CardDealServiceImpl(), webradioList, adminNames);
    }

    /**
     * Package protected constructor. Required for unit testing.
     */
    ZwanzigAbGame(List<Card> gameStack, String conferenceName, CardDealService cardDealService, List<WebradioUrl> webradioList, List<String> adminNames) {
        super(CARDS_32, conferenceName, webradioList, adminNames);
        this.cardDealService = cardDealService;
        this.cardComparator = new CardComparator(CardComparator.TYPE.DESCENDING);
        this.gameStackProperties = new GameStackProperties(gameStack, 0, 10, 10, 7);
        round = new Round(this, gameStack);
        super.addPropertyChangeListener(new GameChangeListener(this));
    }

    @Override
    public void addPlayerToRoom(Player player) {
        super.addPlayerToRoom(player);
        if (gameStartDealer == null) {
            gameStartDealer = player;
        }
        if (gamePhase == GAMEPHASE.waitForAttendees) {
            addAttendee(player);
        }
    }

    @Override
    public void removePlayerFromRoom(Player player) {
        if (gamePhase != GAMEPHASE.waitForAttendees) {
            LOGGER.warn("Spieler kann jetzt nicht abgemeldet werden. Spiel laeuft!");
            return;
        }
        super.removePlayerFromRoom(player);
    }

    @Override
    public void addAttendee(Player attendee) {
        if (gamePhase == GAMEPHASE.waitForAttendees) {
            if (!attendees.contains(attendee)) {
                if (players.contains(attendee)) {
                    attendees.add(attendee);
                    Collections.sort(attendees, playerIdComparator);
                    firePropertyChange(PROP_ATTENDEESLIST, null, attendees);
                    LOGGER.debug("Player '" + attendee + "' added to attendees list");
                } else {
                    LOGGER.warn("Can't add attendee '" + attendee + "': isn't part of the game!");
                }
            } else {
                LOGGER.warn("Can't add attendee '" + attendee + "': already in attendees list");
            }
        }
    }

    @Override
    public void removeAttendee(Player attendee) {
        if (attendees.contains(attendee)) {
            attendees.remove(attendee);
            if (attendee.equals(mover)) {
                mover = guessNextGameStarter();
            }
            if (gamePhase == GAMEPHASE.waitForAttendees) {
            }
            firePropertyChange(PROP_ATTENDEESLIST, null, attendees);
            LOGGER.debug("Player '" + attendee + "' removed from attendees list");
        } else {
            LOGGER.warn("Can't remove attendee '" + attendee + "': not in attendees list");
        }
    }

    @Override
    public void shufflePlayers() {
        if (gamePhase == GAMEPHASE.waitForAttendees) {
            super.shufflePlayers();
        } else {
            LOGGER.warn("Das Umsetzen der Spieler ist im Spiel nicht erlaubt.");
        }
    }

    @Override
    public String getName() {
        return GAME_NAME;
    }

    @Override
    public Image getIcon() {
        if (GAME_ICON == null) {
            GAME_ICON = new ImageIcon(ZwanzigAbGame.class.getResource("favicon-32x32.png")).getImage();
        }
        return GAME_ICON;
    }

    @Override
    public void startGame() {
        if (gamePhase == GAMEPHASE.waitForAttendees) {
            gameWinner = null;
            List<Player> offlineAttendees = new ArrayList<>();
            attendees.forEach((attendee) -> {
                attendee.reset();
                if (!attendee.isOnline()) {
                    offlineAttendees.add(attendee);
                }
            });
            offlineAttendees.forEach(attendee -> removeAttendee(attendee));
            if (offlineAttendees.isEmpty()) { // ensure the event is fired at least once.
                firePropertyChange(PROP_ATTENDEESLIST, null, attendees);
            }
            if (attendees.size() > 1) {
                gameStackProperties.setSize(attendees.size());
                round.roundCounter = 0;
                initRound(guessNextGameStarter());
                mover = round.trumper;
                gameCounter++;
                setGamePhase(GAMEPHASE.shuffle);
            }
        } else {
            LOGGER.warn("Das Spiel ist bereits gestartet!");
        }
    }

    @Override
    public void stopGame() {
        if (gamePhase != GAMEPHASE.waitForAttendees) {
            mover = guessNextGameStarter();
            players.forEach((attendee) -> attendee.reset());
            AttendeeList attendeeList = new AttendeeList(attendees, mover);
            players.forEach(attendee -> attendee.getSocket().sendString(gson.toJson(attendeeList)));
            setGamePhase(GAMEPHASE.waitForAttendees);
            chat("Spiel #" + gameCounter + " wurde abgebrochen");
        }
    }

    /**
     * Getter for property game phase.
     *
     * @return the current game phase.
     */
    public GAMEPHASE getGamePhase() {
        return gamePhase;
    }

    /**
     * Getter for property game state.
     *
     * @param player the player for which it is asked for.
     * @return the game state for this player in JSON format
     */
    private GameStateMessage getGameStateMessage(Player player) {
        return new GameStateMessage(gamePhase.name(), players, attendees, mover, activeAdmin, round.dealer, gameWinner,
                gameStackProperties.getGameStack(), getAttendeeID(round.stackStarter), getAttendeeStackMap(player),
                round.trump, canSkip(player), getAllowedMoves(player), round.roundCounter,
                isWebradioPlaying(), getRadioUrl());
    }

    protected void sendGamePhaseToPlayers() {
        getPlayerList().forEach(p -> {
            p.getSocket().sendString(gson.toJson(new GamePhase(gamePhase, mover, canSkip(p), getAllowedMoves(p), getRound().roundCounter, gameWinner)));
        });
    }

    @Override
    public String getGameState(Player player) {
        return gson.toJson(getGameStateMessage(player));
    }

    @Override
    protected void processMessage(Player player, SocketMessage message) {
        switch (message.action) {
            case "addToAttendees":
                addAttendee(player);
                break;
            case "removeFromAttendees":
                removeAttendee(player);
                break;
            case "startGame":
                processStartGame(player);
                break;
            case "heartBlind":
                processHeartBlind(player, message);
                break;
            case "setTrump":
                processSetTrump(player, message);
                break;
            case "buy":
                processBuy(player, message);
                break;
            case "skip":
                processSkip(player, message);
                break;
            case "move":
                processMove(player, message);
                break;
            case "confirmGameOver":
                processConfirmGameOver(player, message);
                break;
            case "chat":
                chat(message.jsonObject.get("text").getAsString(), player);
                break;
            case "command":
                processPlayerCommand(player, message);
                break;
            default:
                LOGGER.warn("Unknown message from player '" + player.getName() + "': '" + message.jsonString);
        }
    }

    private void processConfirmGameOver(Player player, SocketMessage message) {
        if (player.equals(mover)) {
            if (gamePhase == GAMEPHASE.gameOver) {
                setGamePhase(GAMEPHASE.waitForAttendees);
            } else {
                LOGGER.warn(String.format("Aktion nicht erlaubt (%s != %s)", gamePhase, GAMEPHASE.gameOver));
            }
        } else {
            LOGGER.warn("Spieler '" + player.getName() + "' " + " ist nicht dran!");
        }
    }

    private void processMove(Player player, SocketMessage message) {
        if (player.equals(mover)) {
            if (gamePhase == GAMEPHASE.waitForPlayerMove) {
                int cardID = message.jsonObject.get("cardID").getAsInt();
                if (isValidMove(player, cardID)) {
                    Card card = player.getStack().remove(cardID);
                    round.add(card, player, getAttendeeID(player));
                    players.forEach((attendee) -> {
                        boolean isMover = attendee.equals(player);
                        attendee.getSocket().sendString(gson.toJson(
                                new MoveResult(isMover ? cardID : getRandomCardID(attendee.getStack().size()), card,
                                        isMover ? attendee.getStack() : null,
                                        gameStackProperties.getGameStack(), getAttendeeID(round.stackStarter))));
                    });
                    stepMove();
                } else {
                    LOGGER.warn(String.format("Zug nicht erlaubt (Karte #%d)", (cardID + 1)));
                }
            } else {
                LOGGER.warn(String.format("Aktion nicht erlaubt (%s != %s)", gamePhase, GAMEPHASE.waitForPlayerMove));
            }
        } else {
            LOGGER.warn("Spieler '" + player.getName() + "' " + " ist nicht dran!");
        }
    }

    private void processSkip(Player player, SocketMessage message) {
        if (player.equals(mover)) {
            if (gamePhase == GAMEPHASE.buy) {
                if (canSkip(player)) {
                    round.skippers.add(player);
                    player.increaseSkipCount();
                    player.getStack().clear();
                    BuyResult buyResult = new BuyResult(); // -> this is the skip message
                    players.forEach((attendee) -> attendee.getSocket().sendString(gson.toJson(buyResult)));
                    stepBuySkip();
                } else {
                    LOGGER.warn("Spieler " + player.getName() + " darf nicht aussetzen!");
                }
            } else {
                LOGGER.warn(String.format("Aktion nicht erlaubt (%s != %s)", gamePhase, GAMEPHASE.buy));
            }
        } else {
            LOGGER.warn("Spieler '" + player.getName() + "' " + " ist nicht dran!");
        }
    }

    private void processBuy(Player player, SocketMessage message) {
        if (player.equals(mover)) {
            if (gamePhase == GAMEPHASE.buy) {
                if (canBuy(player)) {
                    JsonArray cardIDs = message.jsonObject.getAsJsonArray("cardIDs");
                    if (isValidBuy(cardIDs)) {
                        player.resetSkipCount();
                        List<Card> stack = player.getStack();
                        int[] cardIDsInt = new int[cardIDs.size()];
                        for (int i = 0; i < cardIDs.size(); i++) {
                            int id = cardIDs.get(i).getAsInt();
                            cardIDsInt[i] = id;
                            stack.set(id, getFromStack());
                        }
                        Arrays.sort(cardIDsInt);
                        // covered cards will be randomised
                        players.forEach((attendee) -> {
                            boolean isMover = attendee.equals(player);
                            attendee.getSocket().sendString(gson.toJson(
                                    new BuyResult(
                                            isMover ? cardIDsInt : getRandomCardIDs(cardIDsInt.length, player.getStack().size()),
                                            isMover ? attendee.getStack() : getCoveredStack(player.getStack()))));
                        });
                        if (cardIDsInt.length > 0) {
                            player.getStack().sort(getCardComparator());
                            player.getSocket().sendString(gson.toJson(new SortedStack(player.getStack())));
                        }
                        stepBuySkip();
                    } else {
                        LOGGER.warn("Ungueltige Tauschaktion (ungueltige Anzahl oder Doubletten)");
                    }
                } else {
                    LOGGER.warn("Spieler " + player.getName() + " darf nicht tauschen!");
                }
            } else {
                LOGGER.warn(String.format("Aktion nicht erlaubt (%s != %s)", gamePhase, GAMEPHASE.buy));
            }
        } else {
            LOGGER.warn("Spieler '" + player.getName() + "' " + " ist nicht dran!");
        }
    }

    private void processSetTrump(Player player, SocketMessage message) {
        if (player.equals(mover)) {
            if (gamePhase == GAMEPHASE.deal3cards) {
                int color = message.jsonObject.get("value").getAsInt();
                if (color >= 0 && color <= Card.KREUZ) {
                    cardDealService.dealCardsPacked(2, this);
                    if (color > 0) {
                        round.trump = new Trump(color);
                    } else {
                        round.trump = new Trump(player.getStack().get(3), 1000 + getRandomVariation(3500, 200)); // next card
                    }
                    LOGGER.info("Trumpf: " + Card.colorToString(round.trump.color));
                    sendToPlayers(gson.toJson(round.trump));
                    players.forEach((attendee)
                            -> attendee.getSocket().sendString(gson.toJson(new AttendeeStacks(getAttendeeStackMap(attendee)))));
                    setGamePhase(GAMEPHASE.deal2cards);
                    sortPlayerStacks();
                    startBuySkip();
                } else {
                    LOGGER.warn(String.format("Farbe nicht bekannt: %d", color));
                }
            } else {
                LOGGER.warn(String.format("Aktion nicht erlaubt (%s != %s)", gamePhase, GAMEPHASE.deal3cards));
            }
        } else {
            LOGGER.warn("Spieler '" + player.getName() + "' " + " ist nicht dran!");
        }
    }

    private void processHeartBlind(Player player, SocketMessage message) {
        if (player.equals(mover)) {
            if (gamePhase == GAMEPHASE.shuffle) {
                boolean blind = message.jsonObject.get("value").getAsBoolean();
                LOGGER.info("Herz-Blind: " + blind);
                if (blind) {
                    round.trump = new Trump(Card.HERZ, true);
                    LOGGER.info("Trumpf: " + Card.colorToString(round.trump.color) + " blind");
                    sendToPlayers(gson.toJson(round.trump));
                    cardDealService.dealCardsSingle(5, this); // deal all five cards
                    players.forEach((attendee)
                            -> attendee.getSocket().sendString(gson.toJson(new AttendeeStacks(getAttendeeStackMap(attendee)))));
                    setGamePhase(GAMEPHASE.deal5cards);
                    sortPlayerStacks();
                    startBuySkip();
                } else {
                    // deal the first three cards
                    cardDealService.dealCardsPacked(3, this);
                    players.forEach((attendee)
                            -> attendee.getSocket().sendString(gson.toJson(new AttendeeStacks(getAttendeeStackMap(attendee)))));
                    setGamePhase(GAMEPHASE.deal3cards);
                }
            } else {
                LOGGER.warn(String.format("Aktion nicht erlaubt (%s != %s)", gamePhase, GAMEPHASE.shuffle));
            }
        } else {
            LOGGER.warn("Spieler '" + player.getName() + "' " + " ist nicht dran!");
        }
    }

    private void processStartGame(Player player) {
        if (gamePhase == GAMEPHASE.waitForAttendees) {
            if (attendees.contains(player)) {
//                if (player.equals(mover) || mover == null) {
                startGame();
                LOGGER.debug("Player '" + player + "' started the game");
//                }
            } else {
                LOGGER.warn("'" + player + "' is not an attendee!");
            }
        }
    }

    private void processPlayerCommand(Player player, SocketMessage message) {
        if (player.equals(activeAdmin)) {
            String command = message.jsonObject.get("command").getAsString();
            switch (command) {
                case "start":
                    if (gamePhase == GAMEPHASE.waitForAttendees) {
                        startGame();
                    } else {
                        LOGGER.warn(String.format("Aktion nicht erlaubt (%s != %s)", gamePhase, GAMEPHASE.waitForAttendees));
                    }
                    break;
                case "stop":
                     if (gamePhase != GAMEPHASE.waitForAttendees) {
                         stopGame();
                     } else {
                        LOGGER.warn(String.format("Aktion nicht erlaubt (%s == %s)", gamePhase, GAMEPHASE.waitForAttendees));
                    }
                    break;
                case "shufflePlayers":
                     if (gamePhase == GAMEPHASE.waitForAttendees) {
                         shufflePlayers();
                     } else {
                        LOGGER.warn(String.format("Aktion nicht erlaubt (%s != %s)", gamePhase, GAMEPHASE.waitForAttendees));
                    }
                    break;
                case "changeWebradio":
                    int id = message.jsonObject.get("id").getAsInt();
                    try {
                        setRadioUrl(getRadioList().get(id));
                    } catch (Exception e) {
                        LOGGER.warn("Unable to select radio id " + id, e);
                    }
                    break;
                default:
                    LOGGER.warn("Spieler '" + player.getName() + "' " + " unbekanntes Kommando: " + command);
                    break;
            }
        } else {
            LOGGER.warn("Spieler '" + player.getName() + "' " + " ist nicht Admin!");
        }
    }

    private void setGamePhase(GAMEPHASE phase) {
        LOGGER.info("GamePhase: '" + phase + "'");
        this.gamePhase = phase;
        firePropertyChange(PROP_GAMEPHASE, null, phase);
    }

    private void initRound(Player dealer) {
        round.reset(dealer);
        shuffleStack();
        attendees.forEach(attendee -> attendee.clearStack());
    }

    private void sortPlayerStacks() {
        Comparator<? super Card> comp = getCardComparator();
        attendees.forEach((attendee) -> {
            attendee.getStack().sort(comp);
            attendee.getSocket().sendString(gson.toJson(new SortedStack(attendee.getStack())));
        });
    }

    private boolean isValidMove(Player player, int cardID) {
        List<Card> playerStack = player.getStack();
        if (cardID < 0 || cardID >= playerStack.size()) {
            return false;
        }
        Card card = playerStack.get(cardID);
        if (card == null) {
            return false;
        }
        if (round.stackColor > 0) { // color already defined?
            int cardColor = card.getColor();
            if (cardColor != round.stackColor) {
                if (player.countColor(round.stackColor) > 0) {
                    return false; // didn't match the color
                }
                if (cardColor != round.trump.color && player.countColor(round.trump.color) > 0) {
                    return false; // didn't use available trump card
                }
            }
        }
        return true;
    }

    private void stepMove() {
        // end of stack? (all players did move?)
        if (round.isLastStackMove()) {
            Player stackWinner = round.cardPlayerMap.get(getMaxCardOfStack(round.stack));
            stackWinner.increaseRoundTokens();
            round.clearStack();
            gameStackProperties.shakeAll(true);
            players.forEach((attendee)
                    -> attendee.getSocket().sendString(
                            gson.toJson(
                                    new StackResult(getAttendeeID(stackWinner),
                                            new AttendeeList(attendees, mover),
                                            gameStackProperties.getGameStack()))));
            round.stackCounter++;

            // end of current round?
            if (round.stackCounter == 5) {
                gameStackProperties.shakeAll();
                attendees.forEach(player -> {
                    if (!round.skippers.contains(player)) {
                        int score = player.getRoundTokens();
                        if (score == 0) {
                            score = -5;
                        }
                        if (round.trump.isHeartBlind()) {
                            score *= 4;
                        } else if (round.trump.color == Card.HERZ) {
                            score *= 2;
                        }
                        if (score < 0 && player.equals(round.trumper)) {
                            score *= 2;
                        }
                        player.addGameTokens(-score);
                        player.resetRoundTokens();
                    }
                });
                players.forEach((attendee) -> attendee.getSocket().sendString(gson.toJson(new RoundResult(new AttendeeList(attendees, mover)))));

                // end of game?
                if (attendees.stream().anyMatch((player) -> (player.getGameTokens() <= 0))) {
                    gameWinner = findWinner();
                    for (Player player : attendees) {
                        if (player.getGameTokens() > 0 && !player.equals(gameWinner)) {
                            gameWinner.addTotalTokens(player.getGameTokens());
                            player.addTotalTokens(-player.getGameTokens());
                        }
                    }
                    sendToPlayers(gson.toJson(new GameResult(new PlayerList(players))));
                    setGamePhase(GAMEPHASE.gameOver);
                    gameStartDealer = getNextTo(gameStartDealer);
                } else {
                    // start next round
                    initRound(round.trumper);
                    mover = round.trumper;
                    setGamePhase(GAMEPHASE.shuffle);
                }
            } else {
                // continue round, start next stack   
                mover = stackWinner;
                LOGGER.debug("New mover: " + mover);
                setGamePhase(GAMEPHASE.waitForPlayerMove);
            }
        } else {
            // continue stack, shift mover to the next (non-skipping) player
            mover = getNextTo(mover);
            while (round.skippers.contains(mover)) {
                mover = getNextTo(mover);
            }
            LOGGER.debug("New mover: " + mover);
            setGamePhase(GAMEPHASE.waitForPlayerMove);
        }
    }

    private Player findWinner() {
        int score = 1;
        Player winner = null;
        for (Player player : attendees) {
            if (player.getGameTokens() < score) {
                winner = player;
                score = player.getGameTokens();
            }
        }
        return winner;
    }

    // one to three cards and no doublette
    private boolean isValidBuy(JsonArray cardIDs) {
        Set<Integer> ids = new HashSet<>();
        if (cardIDs.size() >= 0 && cardIDs.size() <= 3) {
            for (int i = 0; i < cardIDs.size(); i++) {
                int id = cardIDs.get(i).getAsInt();
                if (ids.contains(id)) {
                    return false;
                }
                ids.add(id);
            }
            return true;
        }
        return false;
    }

    private void startBuySkip() {
        round.remainingBuyers.clear();
        Player player = mover;
        for (int i = 0; i < attendees.size(); i++) {
            round.remainingBuyers.add(player);
            player = getNextTo(player);
        }
        stepBuySkip();
    }

    private void stepBuySkip() {
        Player player = round.remainingBuyers.poll();
        while (player != null) {
            if (canBuyOrSkip(player)) {
                mover = player;
                setGamePhase(GAMEPHASE.buy);
                return;
            } else {
                LOGGER.debug("Spieler " + player.getName() + " darf weder tauschen noch aussetzen");
                player.resetSkipCount();
                player = round.remainingBuyers.poll();
            }
        }
        // buy-phase has ended
        mover = round.trumper;
        sendToPlayers(gson.toJson(new StartRound(mover)));
        setGamePhase(GAMEPHASE.waitForPlayerMove);
    }

    public Integer[] getAllowedMoves(Player player) {
        List<Integer> allowedMoves = new ArrayList<>();
        if (gamePhase == GAMEPHASE.waitForPlayerMove && player.equals(mover)) {
            for (int i = 0; i < player.getStack().size(); i++) {
                if (isValidMove(player, i)) {
                    allowedMoves.add(i);
                }
            }
        }
        return allowedMoves.toArray(new Integer[allowedMoves.size()]);
    }

    public boolean canSkip(Player player) {
        if (gamePhase != GAMEPHASE.buy || !player.equals(mover)) {
            return false;
        }
        return (!round.trump.isClub()) // wenn Trumpf nicht Kreuz ist
                && round.roundCounter > 1 // wenn das Spiel nicht in der ersten Runde ist
                && player.getGameTokens() > 5 // wenn der Spieler mehr als 5 Punkte hat
                && player.getSkipCount() < (attendees.size() - 2) // wenn er nicht schon zu oft hintereinander ausgesetzt hat
                && round.skippers.size() < (attendees.size() - 2) // wenn nicht schon zu viele andere Spieler ausgestiegen sind
                && !round.trumper.equals(player) // wenn der Spieler nicht trumpfangebend ist
                ;
    }

    private boolean canBuy(Player player) {
        return player.getGameTokens() > 3;
    }

    private boolean canBuyOrSkip(Player player) {
        return canBuy(player) || canSkip(player);
    }

    /* Round and Game has finished. Now look for the Player which must start the next Game. */
    private Player guessNextGameStarter() {
        Player nextMover = (gameStartDealer != null && attendees.contains(gameStartDealer)) ? gameStartDealer : getNextTo(gameStartDealer);
        if (nextMover == null || !nextMover.isOnline()) {
            // look for the next attendee
            if (!attendees.isEmpty()) {
                for (int i = 0; i < attendees.size(); i++) {
                    nextMover = getNextTo(nextMover);
                    if (nextMover.isOnline()) {
                        LOGGER.debug("guessNextGameStarter from attendees: " + nextMover);
                        return nextMover;
                    }
                }
            }
            // look in the player list
            for (int i = 0; i < players.size(); i++) {
                nextMover = players.get(i);
                if (nextMover.isOnline()) {
                    LOGGER.debug("guessNextGameStarter from players: " + nextMover);
                    return nextMover;
                }
            }
            LOGGER.debug("guessNextGameStarter (last exit): " + nextMover);
            nextMover = players.get(0); // last exit
        }
        LOGGER.debug("guessNextGameStarter: " + nextMover);
        return nextMover;
    }

    public Card getMaxCardOfStack(List<Card> stack) {
        if (stack == null || stack.isEmpty()) {
            return null;
        }
        Card result = null;

        int starterId = getAttendeeID(round.stackStarter);
        int firstCardColor = ((Card) stack.get(starterId)).getColor();
        int trumpColor = round.trump.color;
        boolean needTrumpf = false;
        int stackId = starterId;
        for (int i = 0; i < attendees.size(); i++) {
            Card card = stack.get(stackId);
            if (!needTrumpf && card.getColor() == trumpColor) { // Erste Trumpfkarte
                result = card;
                needTrumpf = true;
            } else if (needTrumpf) { // Es wurde bereits Trumpf gespielt
                if (card.getColor() == trumpColor && card.getValue() > result.getValue()) {
                    result = card;
                }
            } else if (result == null || (card.getValue() > result.getValue() && card.getColor() == firstCardColor)) {// Kein Trumpf im Spiel
                result = card;
            }
            ++stackId;
            if (stackId >= attendees.size()) {
                stackId = 0;
            }
        }
        return result;
    }

    private Map<Integer, List<Card>> getAttendeeStackMap(Player player) {
        Map<Integer, List<Card>> attendeeStackMap = new HashMap<>();
        for (int i = 0; i < attendees.size(); i++) {
            Player attendee = attendees.get(i);
            List<Card> stack = new ArrayList<>();
            boolean isPlayer = attendee.equals(player);
            attendee.getStack().forEach(card -> {
                stack.add(isPlayer ? card : Card.COVERED);
            });
            attendeeStackMap.put(i, stack);
        }
        return attendeeStackMap;
    }

    private List<Card> getCoveredStack(List<Card> attendeeStack) {
        List<Card> stack = new ArrayList<>();
        attendeeStack.forEach(card -> stack.add(Card.COVERED));
        return stack;
    }

    private int getAttendeeID(Player player) {
        return attendees.indexOf(player);
    }

    private int getRandomVariation(long time, float factor) {
        double f = 1 + (Math.random() - 0.5) / 100.0 * factor;
        return (int) Math.round(time * f);
    }

    private int getRandomCardID(int size) {
        return (int) Math.max(0, Math.round(Math.random() * (size - 1)));
    }

    private int[] getRandomCardIDs(int count, int size) {
        if (count > size) {
            throw new IllegalArgumentException(String.format("RandomCardIDs: count(%d) > size(%d)!", count, size));
        }
        List<Integer> cardIDs = new ArrayList<>();
        int[] cardIDsInt = new int[count];
        int c = 0;
        while (cardIDs.size() < count) {
            int id = getRandomCardID(size);
            if (!cardIDs.contains(id)) {
                cardIDs.add(id);
                cardIDsInt[c++] = id;
            }
        }
        return cardIDsInt;
    }

    Comparator<? super Card> getCardComparator() {
        cardComparator.setTrump(round.trump != null ? round.trump.color : 0);
        return cardComparator;
    }

    Round getRound() { // for unit testing
        return round;
    }

    interface CardDealService {

        void dealCardsPacked(int count, ZwanzigAbGame game);

        void dealCardsSingle(int count, ZwanzigAbGame game);
    }

    static class CardDealServiceImpl implements CardDealService {

        @Override
        public void dealCardsPacked(int count, ZwanzigAbGame game) {
            game.attendees.forEach((attendee) -> {
                for (int i = 0; i < count; i++) {
                    attendee.getStack().add(game.getFromStack());
                }
            });
        }

        @Override
        public void dealCardsSingle(int count, ZwanzigAbGame game) {
            for (int i = 0; i < count; i++) {
                game.attendees.forEach((attendee) -> {
                    attendee.getStack().add(game.getFromStack());
                });
            }
        }
    }
}
