package zwanzigab;

import cardgame.CardGame;
import cardgame.Player;
import cardgame.messages.AttendeeList;
import cardgame.messages.PlayerList;
import cardgame.messages.PlayerOnline;
import com.google.gson.Gson;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.List;

/**
 *
 */
public class GameChangeListener implements PropertyChangeListener {

    private final ZwanzigAbGame game;
    private final Gson gson;

    /**
     * This class is a listener to class Game. It listens to change events and
     * synchronizes the clients by sending appropriate messages. This part of
     * code was placed here just to take some code out from the game class.
     * (even this isn't a good design).
     *
     * @param game the ZwanzigAbGame.
     */
    public GameChangeListener(ZwanzigAbGame game) {
        this.game = game;
        gson = new Gson();
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        switch (evt.getPropertyName()) {
            case CardGame.PROP_WEBRADIO_PLAYING:
                game.sendToPlayers("{\"action\":\"playWebradio\", \"play\": " + ((Boolean) evt.getNewValue()) + "}");
                break;
            case CardGame.PROP_WEBRADIO_URL:
                game.sendToPlayers(gson.toJson(game.getRadioUrl()));
                break;
            case CardGame.PROP_ATTENDEESLIST:
                game.sendToPlayers(gson.toJson(new AttendeeList((List<Player>) evt.getNewValue(), game.getMover())));
                break;
            case CardGame.PROP_PLAYERLIST:
                game.sendToPlayers(gson.toJson(new PlayerList((List<Player>) evt.getNewValue(), game.getActiveAdmin())));
                break;
            case CardGame.PROP_PLAYER_ONLINE:
                Player player = (Player) evt.getNewValue();
                if (player.isOnline()) {
                    player.getSocket().sendString(game.getGameState(player));
                }
                game.sendToPlayers(gson.toJson(new PlayerOnline(player, game.getActiveAdmin())));
                break;
            case CardGame.PROP_GAMEPHASE:
                game.sendGamePhaseToPlayers();
                break;
        }
    }
}
