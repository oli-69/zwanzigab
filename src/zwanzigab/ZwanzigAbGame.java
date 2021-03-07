package zwanzigab;

import cardgame.CardGame;
import static cardgame.CardGame.CARDS_32;
import com.google.gson.Gson;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import zwanzigab.messages.ChatMessage;
import zwanzigab.messages.GameStateMessage;

/**
 * This class implements the game rules and evaluates the player's decisions.
 */
public class ZwanzigAbGame extends CardGame {

    private static final Logger LOGGER = LogManager.getLogger(ZwanzigAbGame.class);

    /**
     * Enumeration of the game phases.
     */
    public static enum GAMEPHASE {
        /**
         * The game didn's start yet. Player's can choose to attend the next
         * round, or not.
         */
        waitForAttendees
    };

    /**
     * Enumeration of the available player moves.
     */
    public static enum MOVE {
    };

    public static final String PROP_GAMEPHASE = "gameState";
    public static final String PROP_ATTENDEESLIST = "attendeesList";
    public static final String PROP_PLAYERLIST = "playerList";
    public static final String PROP_PLAYER_ONLINE = "playerOnline";
    public static final String PROP_WEBRADIO_PLAYING = "webradioPlaying";

    private final PlayerIdComparator playerIdComparator;
    private final List<ZwanzigAbPlayer> players; // List of all players in the room
    private final List<ZwanzigAbPlayer> attendees; // sub-list of players, which are actually in the game (alive).
    private final PropertyChangeListener playerListener;
    private final Gson gson;
    private final List<Integer> finishSoundIds;
    private final String videoRoomName;
    private final CardDealService cardDealService;

    private GAMEPHASE gamePhase = GAMEPHASE.waitForAttendees;
    private ZwanzigAbPlayer gameLooser = null;
    private ZwanzigAbPlayer mover = null; // this is like the cursor or pointer of the player which has to move. 
    private boolean webradioPlaying = true;
    private int finishSoundIdCursor = 0;
    private int finishSoundId = 0;

    /**
     * Constructor. Creates a new instance from given value.
     *
     * @param confName the jitsy video conference name.
     */
    public ZwanzigAbGame(String confName) {
        this(confName, new CardDealServiceImpl());
    }

    /**
     * Package protected constructor. Required for unit testing.
     *
     * @param conferenceName the room name for the jitsi conference.
     * @param cardDealService the card dealer service.
     */
    ZwanzigAbGame(String conferenceName, CardDealService cardDealService) {
        super(CARDS_32);
        players = Collections.synchronizedList(new ArrayList<>());
        playerIdComparator = new PlayerIdComparator(players);
        attendees = Collections.synchronizedList(new ArrayList<>());
        playerListener = this::playerPropertyChanged;
        gson = new Gson();
        finishSoundIds = new ArrayList<>();
        initFinishSoundIds();
        videoRoomName = conferenceName;
        this.cardDealService = cardDealService;
        super.addPropertyChangeListener(new GameChangeListener(this));
    }

    /**
     * Getter for property game state.
     *
     * @param player the player for which it is asked for. Will vary e.g. if the
     * player is allowed to knock etc.
     * @return the game state for this player.
     */
    public GameStateMessage getGameState(ZwanzigAbPlayer player) {
        return new GameStateMessage();
    }

    /**
     * Getter for property Attendees count.
     *
     * @return the number of attendees in the game.
     */
    public int getAttendeesCount() {
        return attendees.size();
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
     * Setter for property WebRadioPlaying.
     *
     * @param play true to turn on the webradio, false to turn off.
     */
    public void setWebRadioPlaying(boolean play) {
        boolean oldValue = webradioPlaying;
        webradioPlaying = play;
        firePropertyChange(PROP_WEBRADIO_PLAYING, oldValue, play);
    }

    /**
     * Getter for property WebradioPlaying.
     *
     * @return true if the webradio is currently playing, false otherwise.
     */
    public boolean isWebradioPlaying() {
        return webradioPlaying;
    }

    /**
     * Sends a ping to all clients. Required to prevent the websocket timeout in
     * case of no action.
     */
    public void sendPing() {
        sendToPlayers("{\"action\":\"ping\"}");
    }

    /**
     * Sends a message to all players.
     *
     * @param message the message in JSON format.
     */
    public void sendToPlayers(String message) {
        players.forEach(p -> {
            p.getSocket().sendString(message);
        });
    }

    /**
     * Sends a chat message to all clients.
     *
     * @param text the text to be send to the chat.
     */
    public void chat(String text) {
        chat(text, null);
    }

    /**
     * Sends a chat message to all clients.
     *
     * @param text the text to be send to the chat.
     * @param sender the sending player.
     */
    public void chat(String text, ZwanzigAbPlayer sender) {
        if (text != null && !text.trim().isEmpty()) {
            ChatMessage chatMessage = new ChatMessage(text, sender);
            sendToPlayers(gson.toJson(chatMessage));
        }
    }

    /**
     * Getter for property videoRoomName.
     *
     * @return the name for the room in Jitsi meet.
     */
    public String getVideoRoomName() {
        return videoRoomName;
    }

    /**
     * Lookup for a player by name.
     *
     * @param name the player's name.
     * @return the player specified by name, null if there isn't one.
     */
    public ZwanzigAbPlayer getPlayer(String name) {
        return players.stream().filter(player -> player.getName().equalsIgnoreCase(name)).findAny().orElse(null);
    }

    /**
     * The Login function. A player logged in and therefore "entered the room".
     *
     * @param player the player causing the event.
     */
    public void addPlayerToRoom(ZwanzigAbPlayer player) {
        if (mover == null) {
            mover = player;
        }
        player.addPropertyChangeListener(playerListener);
        players.add(player);
        firePropertyChange(PROP_PLAYERLIST, null, players);
        String msg = player.getName() + " ist gekommen";
        chat(msg);
        LOGGER.info(msg);
        if (gamePhase == GAMEPHASE.waitForAttendees) {
            addAttendee(player);
        }
    }

    /**
     * The logout function. A player logged out and therefore "left the round".
     * Currently disabled in the clients.
     *
     * @param player the player causing the event.
     */
    public void removePlayerFromRoom(ZwanzigAbPlayer player) {
        if (gamePhase != GAMEPHASE.waitForAttendees) {
            LOGGER.warn("Spieler kann jetzt nicht abgemeldet werden. Spiel laeuft!");
            return;
        }
        if (isAttendee(player)) {
            removeAttendee(player);
        }
        if (player.equals(gameLooser)) {
            gameLooser = null;
        }
        player.removePropertyChangeListener(playerListener);
        players.remove(player);
        firePropertyChange(PROP_PLAYERLIST, null, players);
        String msg = "Spieler " + player.getName() + " ist gegangen";
        chat(msg);
        LOGGER.info(msg);
    }

    /**
     * Lookup for property isAttendee.
     *
     * @param player the player for which it is asked for.
     * @return true if the player is currently attendee of the game, false
     * otherwise.
     */
    public boolean isAttendee(ZwanzigAbPlayer player) {
        return attendees.contains(player);
    }

    /**
     * Adds a player to the list of attendees.
     *
     * @param attendee player to add to the attendees.
     */
    public void addAttendee(ZwanzigAbPlayer attendee) {
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

    /**
     * Removes a player from the list of attendees.
     *
     * @param attendee the player to remove from the attendees.
     */
    public void removeAttendee(ZwanzigAbPlayer attendee) {
        if (attendees.contains(attendee)) {
            attendees.remove(attendee);
            if (attendee.equals(mover)) {
                mover = guessNextGameStarter();
            }
            firePropertyChange(PROP_ATTENDEESLIST, null, attendees);
            LOGGER.debug("Player '" + attendee + "' removed from attendees list");
        } else {
            LOGGER.warn("Can't remove attendee '" + attendee + "': not in attendees list");
        }
    }

    public void startGame() {
        throw new UnsupportedOperationException("Not supported yet."); //To change body of generated methods, choose Tools | Templates.
    }

    private void playerPropertyChanged(PropertyChangeEvent evt) {
        switch (evt.getPropertyName()) {
            case ZwanzigAbPlayer.PROP_LOGOUT:
                ZwanzigAbPlayer player = (ZwanzigAbPlayer) evt.getSource();
                removePlayerFromRoom(player);
                break;
            case ZwanzigAbPlayer.PROP_ONLINE:
                firePropertyChange(PROP_PLAYER_ONLINE, null, evt.getSource());
                break;
            case ZwanzigAbPlayer.PROP_SOCKETMESSAGE:
                processMessage((ZwanzigAbPlayer) evt.getSource(), (SocketMessage) evt.getNewValue());
                break;
        }
    }

    /*
    /* Messages from the players 
     */
    private void processMessage(ZwanzigAbPlayer player, SocketMessage message) {
        switch (message.action) {
            case "addToAttendees":
                addAttendee(player);
                break;
            case "removeFromAttendees":
                removeAttendee(player);
                break;
            default:
                LOGGER.warn("Unknown message from player '" + player.getName() + "': '" + message.jsonString);
        }
    }

    /* Round and Game has finished. Now look for the Player which must start the next Game. */
    private ZwanzigAbPlayer guessNextGameStarter() {
        ZwanzigAbPlayer nextMover = (gameLooser != null && attendees.contains(gameLooser)) ? gameLooser : getNextTo(gameLooser);
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

    int getFinishSoundCount() {
        return 13;
    }

    private void initFinishSoundIds() {
        int soundCount = getFinishSoundCount();
        List<Integer> soundIDs = new ArrayList<>();
        for (int i = 0; i < soundCount; i++) {
            soundIDs.add(i);
        }
        while (soundIDs.size() > 0) {
            int randomId = (int) Math.round(Math.random() * (soundIDs.size() - 1));
            finishSoundIds.add(soundIDs.get(randomId));
            soundIDs.remove(randomId);
        }
        if (finishSoundIds.size() == soundCount) {
            LOGGER.info("Finish Sound IDs initialized successfully");
        } else {
            LOGGER.error("Finish Sound IDs initialization failed");
        }
    }

    int getNextFinishSoundId() {
        finishSoundIdCursor++;
        if (finishSoundIdCursor >= finishSoundIds.size()) {
            finishSoundIdCursor = 0;
        }
        return finishSoundIds.get(finishSoundIdCursor);
    }

    private void shiftMover() {
        mover = getNextTo(mover);
        LOGGER.debug("New mover: " + mover);
    }

    private ZwanzigAbPlayer getNextTo(ZwanzigAbPlayer player) {
        if (attendees.isEmpty()) {
            return null;
        }
        int index = attendees.indexOf(player) + 1;
        return attendees.get(index < attendees.size() ? index : 0);
    }

    static class PlayerIdComparator implements Comparator<ZwanzigAbPlayer> {

        final List<ZwanzigAbPlayer> playerList;

        public PlayerIdComparator(List<ZwanzigAbPlayer> playerList) {
            this.playerList = playerList;
        }

        @Override
        public int compare(ZwanzigAbPlayer p1, ZwanzigAbPlayer p2) {
            return playerList.indexOf(p1) < playerList.indexOf(p2) ? -1 : 1;
        }
    }

    interface CardDealService {

        void dealCards(ZwanzigAbGame game);
    }

    private static class CardDealServiceImpl implements CardDealService {

        @Override
        public void dealCards(ZwanzigAbGame game) {
//            game.shuffleStack();
//            for (int i = 0; i < 3; i++) {
//                game.attendees.forEach((attendee) -> {
//                    attendee.getStack().add(game.getFromStack());
//                    if (attendee.equals(game.mover)) {
//                        game.dealerStack.add(game.getFromStack());
//                    }
//                });
//            }
        }
    }
}
