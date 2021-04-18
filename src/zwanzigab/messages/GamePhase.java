package zwanzigab.messages;

import cardgame.Player;
import zwanzigab.ZwanzigAbGame.GAMEPHASE;

public class GamePhase {

    public final String action = "gamePhase";
    public String phase;
    public String actor;
    public boolean canSkip;
    public int roundCounter;

    public GamePhase(GAMEPHASE phase, Player actor, boolean canSkip, int roundCounter) {
        this.phase = phase.name();
        this.actor = actor != null ? actor.getName() : "";
        this.canSkip = canSkip;
        this.roundCounter = roundCounter;
    }
}
