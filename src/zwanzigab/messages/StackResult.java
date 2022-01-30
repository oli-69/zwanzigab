package zwanzigab.messages;

import cardgame.messages.AttendeeList;
import cardgame.messages.GameStack;

public class StackResult {

    public final String action = "stackResult";

    public int stackWinnerId;
    public AttendeeList attendees;
    public GameStack gameStack;

    public StackResult(int stackWinnerId, AttendeeList attendees, GameStack gameStack) {
        this.stackWinnerId = stackWinnerId;
        this.attendees = attendees;
        this.gameStack = gameStack;
    }
}
