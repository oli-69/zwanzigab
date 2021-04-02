package zwanzigab;

import cardgame.Card;
import cardgame.messages.LoginSuccess;
import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.List;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.core.config.Configurator;
import org.apache.logging.log4j.core.config.DefaultConfiguration;
import org.eclipse.jetty.websocket.api.Session;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;
import static org.mockito.Mockito.when;
import zwanzigab.ZwanzigAbGame.GAMEPHASE;
import zwanzigab.messages.GamePhase;

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
        game = new ZwanzigAbGame("", new CardDealServiceImpl(), new ArrayList<>());
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
    public void testMove() {
        int trump = 1;
        startWith3Players();
        game.getRound().roundCounter = 2; // increase the round, since in the first round skipping isn't allowed
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [0]}");
        socket3.onText("{\"action\": \"skip\"}");
        socket1.onText("{\"action\": \"buy\", \"cardIDs\": [0]}");
        assertEquals(GAMEPHASE.waitForPlayerMove, game.getGamePhase()); // still buy phase
        assertEquals(player2, game.getMover()); // mover has not stepped
        socket2.onText("{\"action\": \"move\", \"cardID\": 0}");
    }

    @Test
    public void testSkip_fail_trumpIsClub() {
        int trump = 4;
        startWith3Players();
        game.getRound().roundCounter = 2; // increase the round, since in the first round skipping isn't allowed
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [0]}");
        socket3.onText("{\"action\": \"skip\"}");
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player3, game.getMover()); // mover has not stepped
    }

    @Test
    public void testSkip_fail_playerTooManySkips() {
        int trump = 1;
        startWith3Players();
        game.getRound().roundCounter = 2; // increase the round, since in the first round skipping isn't allowed
        player3.increaseSkipCount();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [0]}");
        socket3.onText("{\"action\": \"skip\"}");
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player3, game.getMover()); // mover has not stepped
    }

    @Test
    public void testSkip_fail_firstRound() {
        int trump = 1;
        startWith3Players();
        player3.increaseSkipCount();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [0]}");
        socket3.onText("{\"action\": \"skip\"}");
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player3, game.getMover()); // mover has not stepped
    }

    @Test
    public void testSkip_fail_tooManySkippers() {
        int trump = 1;
        startWith5Players();
        game.getRound().roundCounter = 2; // increase the round, since in the first round skipping isn't allowed
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [0]}");
        socket3.onText("{\"action\": \"skip\"}");
        socket4.onText("{\"action\": \"skip\"}");
        socket5.onText("{\"action\": \"skip\"}");
        socket1.onText("{\"action\": \"skip\"}");
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player1, game.getMover()); // mover has not stepped
    }

    @Test
    public void testSkip_fail_playerIsTrumper() {
        int trump = 1;
        startWith3Players();
        game.getRound().roundCounter = 2; // increase the round, since in the first round skipping isn't allowed
        player3.addGameTokens(-15);
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"skip\"}");
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player2, game.getMover()); // mover has not stepped
    }

    @Test
    public void testSkip_fail_tooLessPoints() {
        int trump = 1;
        startWith3Players();
        game.getRound().roundCounter = 2; // increase the round, since in the first round skipping isn't allowed
        player3.addGameTokens(-15);
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [0]}");
        socket3.onText("{\"action\": \"skip\"}");
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player3, game.getMover()); // mover has not stepped
    }

    @Test
    public void testSkip_dealer() {
        int trump = 1;
        startWith3Players();
        game.getRound().roundCounter = 2; // increase the round, since in the first round skipping isn't allowed
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [1]}");
        socket3.onText("{\"action\": \"buy\", \"cardIDs\": [1]}");
        socket1.onText("{\"action\": \"skip\"}");
        assertEquals(GAMEPHASE.waitForPlayerMove, game.getGamePhase());
        assertEquals(player2, game.getMover());
    }

    @Test
    public void testSkip() {
        int trump = 1;
        startWith3Players();
        game.getRound().roundCounter = 2; // increase the round, since in the first round skipping isn't allowed
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [0]}");
        socket3.onText("{\"action\": \"skip\"}");
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player1, game.getMover()); // mover has stepped
    }

    @Test
    public void testBuy_fail_doublettes() {
        int trump = 1;
        startWith3Players();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [1,1]}");
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player2, game.getMover()); // still player 2 on the move
    }

    @Test
    public void testBuy_fail_tooManyCards() {
        int trump = 1;
        startWith3Players();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [1,2,3,4]}"); // too many cards
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player2, game.getMover()); // still player 2 on the move
    }

    @Test
    public void testBuy_tooLessPoints() {
        int trump = 1;
        startWith3Players();
        player2.addGameTokens(-17);
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        assertEquals(GAMEPHASE.buy, game.getGamePhase());
        assertEquals(player3, game.getMover()); // player 2 wasn't allowed to buy 
    }

    @Test
    public void testBuy_none() {
        int trump = 1;
        startWith3Players();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": []}"); // too many cards
        assertEquals(GAMEPHASE.buy, game.getGamePhase()); // still buy phase
        assertEquals(player3, game.getMover()); // mover has stepped
    }

    @Test
    public void testBuy() {
        int trump = 1;
        startWith3Players();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        String card1 = player2.getStack().get(1).toString();
        String card2 = player2.getStack().get(2).toString();
        String card3 = player2.getStack().get(3).toString();
        socket2.onText("{\"action\": \"buy\", \"cardIDs\": [1,2,3]}");
        assertNotEquals(card1, player2.getStack().get(1).toString());
        assertNotEquals(card2, player2.getStack().get(2).toString());
        assertNotEquals(card3, player2.getStack().get(3).toString());
        assertEquals(player3, game.getMover()); // mover has stepped
    }

    @Test
    public void testSetTrump_nextCard() {
        int trump = 0; // 0 means get the next card
        startWith3Players();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        assertEquals("gamePhase", gson.fromJson(socket1.lastMessage(), GamePhase.class).action);
        assertEquals("buy", gson.fromJson(socket1.lastMessage(), GamePhase.class).phase);
    }

    @Test
    public void testSetTrump_color() {
        int trump = 2;
        startWith3Players();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        assertEquals("gamePhase", gson.fromJson(socket1.lastMessage(), GamePhase.class).action);
        assertEquals("buy", gson.fromJson(socket1.lastMessage(), GamePhase.class).phase);
        assertEquals(trump, game.getRound().trump.color);
    }

    @Test
    public void testSetTrump_fail() {
        int trump = 5; // illegal value
        startWith3Players();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        socket2.onText("{\"action\": \"setTrump\", \"value\": \"" + trump + "\"}");
        assertEquals(GAMEPHASE.deal3cards, game.getGamePhase()); // gamephase remains
    }

    @Test
    public void testHeartBlind_deny() {
        startWith3Players();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"false\"}");
        assertEquals("gamePhase", gson.fromJson(socket1.lastMessage(), GamePhase.class).action);
        assertEquals("deal3cards", gson.fromJson(socket1.lastMessage(), GamePhase.class).phase);
    }

    @Test
    public void testHeartBlind() {
        startWith3Players();
        socket2.onText("{\"action\": \"heartBlind\", \"value\": \"true\"}");
        assertEquals("gamePhase", gson.fromJson(socket1.lastMessage(), GamePhase.class).action);
        assertEquals("buy", gson.fromJson(socket1.lastMessage(), GamePhase.class).phase);
        assertEquals(Card.HERZ, game.getRound().trump.color);
        assertTrue(game.getRound().trump.blind);
    }

    @Test
    public void testStartGame() {
        login(player1);
        login(player2);
        socket1.onText("{\"action\": \"startGame\"}");
        assertEquals("gamePhase", gson.fromJson(socket1.lastMessage(), GamePhase.class).action);
        assertEquals("shuffle", gson.fromJson(socket1.lastMessage(), GamePhase.class).phase);
    }

    private void login(ZwanzigAbPlayer player) {
        game.addPlayerToRoom(player);
        player.getSocket().sendString(gson.toJson(new LoginSuccess("roomName")));
        player.getSocket().sendString(game.getGameState(player));
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

    private class CardDealServiceImpl extends ZwanzigAbGame.CardDealServiceImpl {
    }
}
