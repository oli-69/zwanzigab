package zwanzigab.messages;

import cardgame.Card;
import cardgame.messages.CardStack;
import cardgame.messages.PlayerStack;
import java.util.List;

public class SortedStack {

    public final String action = "sortedStack";

    public CardStack stack;

    public SortedStack(List<Card> stack) {
        this.stack = new PlayerStack(stack);
    }
}
