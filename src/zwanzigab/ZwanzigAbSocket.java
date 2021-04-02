package zwanzigab;

import cardgame.Player;
import cardgame.PlayerSocket;
import org.eclipse.jetty.websocket.api.annotations.WebSocket;

/**
 * This class implements the player's web socket.
 */
@WebSocket
class ZwanzigAbSocket extends PlayerSocket {

    public ZwanzigAbSocket(ZwanzigAbGame game, String configPath) {
        super(game, configPath);
    }

    ZwanzigAbSocket(ZwanzigAbGame game) {
        super(game, System.getProperty("user.dir"));
    }

    @Override
    protected Player createPlayer(String name) {
        return new ZwanzigAbPlayer(name, this);
    }

}
