package zwanzigab.messages;

import cardgame.messages.Card;
import cardgame.messages.CardStack;
import cardgame.messages.GameStack;
import cardgame.messages.PlayerStack;
import java.util.List;

public class MoveResult {

    public final String action = "moveResult";

    public int cardID;
    public Card card;
    public CardStack playerStack;
    public GameStack gameStack;
    public int stackStarterId;

    public MoveResult(int cardID, cardgame.Card card, List<cardgame.Card> playerStack, GameStack gameStack, int stackStarterId) {
        this.cardID = cardID;
        this.card = new Card(card);
        this.playerStack = playerStack != null ? new PlayerStack(playerStack) : null;
        this.gameStack = gameStack;
        this.stackStarterId = stackStarterId;
    }
}
