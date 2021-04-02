package zwanzigab.messages;

import cardgame.Player;
import cardgame.messages.AttendeeList;
import cardgame.messages.CardStack;
import cardgame.messages.PlayerList;
import cardgame.messages.WebradioUrl;
import java.util.List;

public class GameStateMessage {

    public final String action = "gameState";

    public String phase;
    public PlayerList playerList;
    public AttendeeList attendeeList;
    public String mover;
    public String dealer;
    public CardStack playerStack;
    public boolean webradioPlaying;
    public WebradioUrl radioUrl;
    public Trump trump;

    public GameStateMessage(String phase, List<Player> players, List<Player> attendees, Player mover, Player dealer,
            List<cardgame.Card> playerStack, Trump trump,
            boolean webradioPlaying, WebradioUrl radioUrl) {
        this.phase = phase;
        this.playerList = new PlayerList(players);
        this.attendeeList = new AttendeeList(attendees, mover);
        this.mover = mover != null ? mover.getName() : "";
        this.playerStack = new CardStack(playerStack);
        this.webradioPlaying = webradioPlaying;
        this.radioUrl = radioUrl;
        this.trump = trump;
    }
}
