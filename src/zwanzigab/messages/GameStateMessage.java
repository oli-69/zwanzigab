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
    public String dealer;
    public AttendeeStacks attendeeStacks;
    public boolean webradioPlaying;
    public WebradioUrl radioUrl;
    public Trump trump;
    public boolean canSkip;

    public GameStateMessage(String phase, List<Player> players, List<Player> attendees, Player mover, Player dealer,
            GameStack gameStack, Map<Integer, List<Card>> stackMap, Trump trump, boolean canSkip,
            boolean webradioPlaying, WebradioUrl radioUrl) {
        this.phase = phase;
        this.playerList = new PlayerList(players);
        this.attendeeList = new AttendeeList(attendees, mover);
        this.mover = mover != null ? mover.getName() : "";
        this.dealer = dealer != null ? dealer.getName() : "";
        this.gameStack = gameStack;
        this.attendeeStacks = new AttendeeStacks(stackMap);
        this.webradioPlaying = webradioPlaying;
        this.radioUrl = radioUrl;
        this.trump = trump;
        this.canSkip = canSkip;
    }
}
