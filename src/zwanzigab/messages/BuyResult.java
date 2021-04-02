package zwanzigab.messages;

import cardgame.Card;
import cardgame.messages.CardStack;
import cardgame.messages.PlayerStack;
import java.util.List;

public class BuyResult {

    public final String action = "buyResult";

    public int[] cardIDs;
    public CardStack stack;
    public boolean skip = false;

    public BuyResult() { // creates a skip message
        this.skip = true;
    }
    
    public BuyResult(int[] cardIDs, List<Card> stack) {
        this.cardIDs = cardIDs;
        this.stack = stack != null ? new PlayerStack(stack) : null;
        this.skip = false;
    }
}
