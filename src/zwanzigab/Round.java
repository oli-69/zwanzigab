package zwanzigab;

import cardgame.Card;
import cardgame.Player;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import zwanzigab.messages.Trump;

/**
 * State object representing a game round. A game round is the part of the game
 * which ends with all players hav all five cards played.
 */
public class Round {

    Trump trump;
    int roundCounter; // will be '1' at game start
    int stackCounter; // 1 to 5 (card stacks per round)
    Player dealer;
    Player trumper;

    final Queue<Player> remainingBuyers = new LinkedList<>();
    final Set<Player> skippers = new HashSet<>();
    final List<Card> stack;
    final Map<Card, Player> cardPlayerMap = new HashMap<>();

    private final ZwanzigAbGame game;

    public Round(ZwanzigAbGame game, List<Card> gameStack) {
        this.game = game;
        this.stack = gameStack;;
    }

    public void reset(Player dealer) {
        this.dealer = dealer;
        this.trumper = game.getNextTo(dealer);
        skippers.clear();
        stack.clear();
        cardPlayerMap.clear();
        trump = null;
        stackCounter = 0;
        ++roundCounter;
    }

    public boolean isLastStackMove() {
        return stack.size() == (game.getAttendeesCount() - skippers.size());
    }

    public void add(Card card, Player player) {
        stack.add(card);
        cardPlayerMap.put(card, player);
    }
}
