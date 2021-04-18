package zwanzigab;

import cardgame.Player;
import cardgame.PlayerSocket;

/**
 * This class represents a game player.
 */
public class ZwanzigAbPlayer extends Player {

    /**
     * Constructor. Creates a new player from given value.
     *
     * @param name name of the player.
     */
    public ZwanzigAbPlayer(String name) {
        super(name);
        gameTokens = 20;
    }

    /**
     * Constructor. Creates a new player from given values.
     *
     * @param name the name of the player.
     * @param socket the websockt of the player.
     */
    public ZwanzigAbPlayer(String name, PlayerSocket socket) {
        super(name, socket);
        gameTokens = 20;
    }

    /**
     * Resets the state. Usually called to begin of each round.
     */
    @Override
    public void reset() {
        resetRoundTokens();
        clearStack();
        resetSkipCount();
        gameTokens = 20;
    }

}
