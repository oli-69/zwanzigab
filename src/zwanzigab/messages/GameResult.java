package zwanzigab.messages;

import cardgame.messages.PlayerList;

public class GameResult {

    public final String action = "gameResult";

    public PlayerList players;

    public GameResult(PlayerList players) {
        this.players = players;
    }
}
