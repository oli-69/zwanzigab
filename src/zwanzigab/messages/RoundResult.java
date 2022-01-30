package zwanzigab.messages;

import cardgame.messages.AttendeeList;

public class RoundResult {

    public final String action = "roundResult";

    public AttendeeList attendees;

    public RoundResult(AttendeeList attendees) {
        this.attendees = attendees;
    }
}
