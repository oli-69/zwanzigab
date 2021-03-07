package zwanzigab.messages;

import zwanzigab.ZwanzigAbPlayer;

public class ChatMessage {

    public final String action = "chatMessage";
    public String text;
    public String sender;

    public ChatMessage() {
        this("");
    }

    public ChatMessage(String text) {
        this(text, null);
    }

    public ChatMessage(String text, ZwanzigAbPlayer sender) {
        this.text = text;
        if (sender != null) {
            this.sender = sender.getName();
        }
    }

}
