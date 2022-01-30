package zwanzigab.messages;

import cardgame.Card;
import cardgame.Player;
import cardgame.messages.AttendeeList;
import cardgame.messages.AttendeeStacks;
import cardgame.messages.GameStack;
import cardgame.messages.PlayerList;
import cardgame.messages.WebradioUrl;
import java.util.List;
import java.util.Map;

public class GameStateMessage {

    public final String action = "gameState";

    public String phase;
    public PlayerList playerList;
    public AttendeeList attendeeList;
    public String mover;
    public GameStack gameStack;
    public int stackStarterId;
    public String dealer;
    public AttendeeStacks attendeeStacks;
    public boolean webradioPlaying;
    public WebradioUrl radioUrl;
    public Trump trump;
    public boolean canSkip;
    public Integer[] allowedMoves;
    public int roundCounter;
    public String gameWinner;

    public GameStateMessage(String phase, List<Player> players, List<Player> attendees, Player mover, Player activeAdmin, Player dealer, Player gameWinner,
            GameStack gameStack, int stackStarterId, Map<Integer, List<Card>> stackMap, Trump trump, boolean canSkip,
            Integer[] allowedMoves, int roundCounter, boolean webradioPlaying, WebradioUrl radioUrl) {
        this.phase = phase;
        this.playerList = new PlayerList(players, activeAdmin);
        this.attendeeList = new AttendeeList(attendees, mover);
        this.mover = mover != null ? mover.getName() : "";
        this.dealer = dealer != null ? dealer.getName() : "";
        this.gameStack = gameStack;
        this.stackStarterId = stackStarterId;
        this.attendeeStacks = new AttendeeStacks(stackMap);
        this.webradioPlaying = webradioPlaying;
        this.radioUrl = radioUrl;
        this.trump = trump;
        this.canSkip = canSkip;
        this.allowedMoves = allowedMoves;
        this.roundCounter = roundCounter;
        this.gameWinner = gameWinner != null ? gameWinner.getName() : null;
    }
}
