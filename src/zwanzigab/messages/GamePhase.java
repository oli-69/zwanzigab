package zwanzigab.messages;

import cardgame.Player;
import zwanzigab.ZwanzigAbGame.GAMEPHASE;

public class GamePhase {

    public final String action = "gamePhase";
    public String phase;
    public String actor;

    public GamePhase(GAMEPHASE phase, Player actor) {
        this.phase = phase.name();
        this.actor = actor != null ? actor.getName() : "";
    }
}
