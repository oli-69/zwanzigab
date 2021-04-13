package zwanzigab.messages;

import cardgame.Card;

public class Trump {

    public final String action = "trump";
    public int color;
    public boolean blind;
    public int value;
    public int dt;

    public Trump(int color) {
        this(color, false);
    }

    public Trump(int color, boolean blind) {
        this.color = color;
        this.value = 0;
        this.blind = blind;
    }

    public Trump(cardgame.Card gameCard, int time) {
        this.color = gameCard.getColor();
        this.value = gameCard.getValue();
        this.dt = time;
        this.blind = false;
    }

    public boolean isHeartBlind() {
        return color == Card.HERZ && blind;
    }
    
    public boolean isClub() {
        return color == Card.KREUZ;
    }
}
