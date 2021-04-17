package zwanzigab.messages;

import cardgame.messages.Card;
import cardgame.messages.CardStack;
import cardgame.messages.PlayerStack;
import java.util.List;

public class MoveResult {

    public final String action = "moveResult";

    public int cardID;
    public Card card;
    public CardStack playerStack;
    public CardStack gameStack;

    public MoveResult(int cardID, cardgame.Card card, List<cardgame.Card> playerStack, List<cardgame.Card> gameStack) {
        this.cardID = cardID;
        this.card = new Card(card);
        this.playerStack = playerStack != null ? new PlayerStack(playerStack) : null;
        this.gameStack = new PlayerStack(gameStack);
    }
}
