package zwanzigab;

import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.List;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.core.config.Configurator;
import org.apache.logging.log4j.core.config.DefaultConfiguration;
import org.eclipse.jetty.websocket.api.Session;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import zwanzigab.messages.LoginSuccess;

/**
 * Tests for class ZwanzigAbGame
 */
public class ZwanzigAbGameTest {

    static {
        Configurator.initialize(new DefaultConfiguration());
        Configurator.setRootLevel(Level.DEBUG);
    }

    private static final Logger LOGGER = LogManager.getLogger(ZwanzigAbGameTest.class);

    private ZwanzigAbGame game;
    private ZwanzigAbPlayer player1;
    private ZwanzigAbPlayer player2;
    private ZwanzigAbPlayer player3;
    private ZwanzigAbPlayer player4;
    private ZwanzigAbPlayer player5;
    private Session session1;
    private Session session2;
    private Session session3;
    private Session session4;
    private Session session5;
    private TestSocket socket1;
    private TestSocket socket2;
    private TestSocket socket3;
    private TestSocket socket4;
    private TestSocket socket5;
    private final String name1 = "Player 1";
    private final String name2 = "Player 2";
    private final String name3 = "Player 3";
    private final String name4 = "Player 4";
    private final String name5 = "Player 5";
    private final Gson gson = new Gson();

    @Before
    public void setUp() {
        game = new ZwanzigAbGame("", new CardDealServiceImpl());
        session1 = Mockito.mock(Session.class);
        session2 = Mockito.mock(Session.class);
        session3 = Mockito.mock(Session.class);
        session4 = Mockito.mock(Session.class);
        session5 = Mockito.mock(Session.class);
        socket1 = new TestSocket(game, name1, session1);
        socket2 = new TestSocket(game, name2, session2);
        socket3 = new TestSocket(game, name3, session3);
        socket4 = new TestSocket(game, name4, session4);
        socket5 = new TestSocket(game, name5, session5);
        player1 = new ZwanzigAbPlayer(name1, socket1);
        player2 = new ZwanzigAbPlayer(name2, socket2);
        player3 = new ZwanzigAbPlayer(name3, socket3);
        player4 = new ZwanzigAbPlayer(name4, socket4);
        player5 = new ZwanzigAbPlayer(name5, socket5);
        when(session1.isOpen()).thenReturn(Boolean.TRUE);
        when(session2.isOpen()).thenReturn(Boolean.TRUE);
        when(session3.isOpen()).thenReturn(Boolean.TRUE);
        when(session4.isOpen()).thenReturn(Boolean.TRUE);
        when(session5.isOpen()).thenReturn(Boolean.TRUE);
    }

    @Test
    public void testSomeMethod() {
    }

    private void login(ZwanzigAbPlayer player) {
        game.addPlayerToRoom(player);
        player.getSocket().sendString(gson.toJson(new LoginSuccess("roomName")));
        player.getSocket().sendString(gson.toJson(game.getGameState(player)));
    }

    private void startWith2Players() {
        login(player1);
        login(player2);
        game.startGame();
    }

    private void startWith3Players() {
        login(player1);
        login(player2);
        login(player3);
        game.startGame();
    }

    private void startWith5Players() {
        login(player1);
        login(player2);
        login(player3);
        login(player4);
        login(player5);
        game.startGame();
    }

    private static class TestSocket extends ZwanzigAbSocket {

        String name;
        List<String> messageBuff = new ArrayList();
        boolean connected = true;
        Session session;

        public TestSocket(ZwanzigAbGame game, String name, Session session) {
            super(game);
            this.name = name;
            this.session = session;
        }

        @Override
        public void sendString(String buff) {
            LOGGER.debug(name + " received: " + buff);
            messageBuff.add(buff);
        }

        @Override
        public boolean isConnected() {
            return connected;
        }

        public void onText(String message) {
            try {
                super.onText(session, message);
            } catch (Exception e) {
                LOGGER.error(e);
            }
        }

        public String lastMessage() {
            return !messageBuff.isEmpty() ? messageBuff.get(messageBuff.size() - 1) : "";
        }

        public boolean isLastMessage(String message) {
            return !messageBuff.isEmpty() && messageBuff.get(messageBuff.size() - 1).equals(message);
        }

        public boolean receivedMessage(String message) {
            return messageBuff.stream().anyMatch((msg) -> (message.equals(msg)));
        }
    }

    private class CardDealServiceImpl implements ZwanzigAbGame.CardDealService {

        @Override
        public void dealCards(ZwanzigAbGame game) {
        }
    }
}
