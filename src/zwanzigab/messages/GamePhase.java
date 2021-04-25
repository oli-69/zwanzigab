package zwanzigab.messages;

import cardgame.Player;
import zwanzigab.ZwanzigAbGame.GAMEPHASE;

public class GamePhase {

    public final String action = "gamePhase";
    public String phase;
    public String actor;
    public boolean canSkip;
    public Integer[] allowedMoves;
    public int roundCounter;
    public String gameWinner;

    public GamePhase(GAMEPHASE phase, Player actor, boolean canSkip, Integer[] allowedMoves, int roundCounter, Player gameWinner) {
        this.phase = phase.name();
        this.actor = actor != null ? actor.getName() : "";
        this.canSkip = canSkip;
        this.allowedMoves = allowedMoves;
        this.roundCounter = roundCounter;
        this.gameWinner = gameWinner != null ? gameWinner.getName() : null;
    }
}
