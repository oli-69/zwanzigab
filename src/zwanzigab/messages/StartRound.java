package zwanzigab.messages;

import cardgame.Player;

public class StartRound {

    public final String action = "startRound";

    public String mover;

    public StartRound(Player mover) {
        this.mover = mover.getName();
    }
}
