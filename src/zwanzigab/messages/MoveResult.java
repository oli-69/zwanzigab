package zwanzigab.messages;

import cardgame.messages.Card;
import cardgame.messages.CardStack;
import cardgame.messages.PlayerStack;
import java.util.List;

public class MoveResult {

    public final String action = "moveResult";

    public int cardID;
    public Card card;
    public CardStack stack;

    public MoveResult(int cardID, cardgame.Card card, List<cardgame.Card> stack) {
        this.cardID = cardID;
        this.card = new Card(card);
        this.stack = stack != null ? new PlayerStack(stack) : null;
    }
}
