package com.crownandcall.srproof;
import java.util.*;
public final class ListeningInterfaceTest implements PlaybackEngine.Host {
    final PlaybackEngine engine = new PlaybackEngine(this);
    final List<String> speech = new ArrayList<>(), completions = new ArrayList<>();
    long token, clock; Runnable wait; int ended;
    public long now() { return clock; }
    public void speak(String text, long token) { speech.add(text); this.token = token; }
    public void delay(long milliseconds, Runnable done) { wait = done; }
    public void cancel() { wait = null; }
    public void changed() {}
    public void completed(String id) { completions.add(id); }
    public void ended() { ended++; }
    void next() { if (wait != null) { Runnable done = wait; wait = null; done.run(); } else engine.done(token); }
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static int passed;
    static void pass(String name) { passed++; System.out.println("PASS listening " + name); }
    static PlaybackEngine.Unit unit(int id, String card) {
        return new PlaybackEngine.Unit(String.valueOf(id), "PRIVATE NAME", List.of(
            new PlaybackEngine.Action("speak", "Q" + id, 0, "Question"),
            new PlaybackEngine.Action("wait", "", 900000, "Recall"),
            new PlaybackEngine.Action("speak", "A" + id, 0, "Answer")), card);
    }
    static final List<PlaybackEngine.Unit> units = List.of(unit(0, "a"), unit(1, "a"), unit(2, "b"), unit(3, "b"));
    public static void main(String[] args) {
        ListeningInterfaceTest h = new ListeningInterfaceTest();
        h.engine.start(List.of(), false, false, List.of("Preparing playlist."), false);
        check(h.speech.equals(List.of("Preparing playlist.")) && h.completions.isEmpty());
        h.next(); check(h.ended == 1 && h.completions.isEmpty());
        pass("Preparation announcement uses speech callbacks but no unit or completion receipt");
        h = new ListeningInterfaceTest(); h.engine.start(List.of(), false, false, List.of("No reviews available."), false); h.next();
        check(h.completions.isEmpty() && h.ended == 1); pass("Empty REVIEW announcement finishes without scheduling");
        h = new ListeningInterfaceTest(); h.engine.start(units, false, true, List.of("Starting playlist."), true);
        check(h.engine.announcing() && !h.engine.stepStarted()); h.next();
        for (int i = 0; i < 12; i++) h.next();
        check(h.speech.get(h.speech.size() - 1).equals("Playlist complete.") && h.completions.size() == 4);
        h.next(); check(h.speech.get(h.speech.size() - 1).equals("Replaying playlist.") && h.completions.size() == 4);
        h.next(); check(h.speech.get(h.speech.size() - 1).equals("Q0") && h.completions.size() == 4);
        pass("Starting, authored Q/A, complete, replaying, first question occur in exact order");
        h = new ListeningInterfaceTest(); h.engine.start(units, false, true, List.of("Starting playlist."), true);
        long stale = h.token; h.engine.pause("Pause"); h.engine.done(stale); check(h.engine.announcing());
        h.engine.resume(); h.next(); check(h.speech.equals(List.of("Starting playlist.", "Starting playlist.", "Q0")));
        h.engine.done(stale); check(h.completions.isEmpty());
        pass("Interrupted status resumes only its phrase; stale callback cannot advance content");
        h = new ListeningInterfaceTest(); h.engine.start(units, false, true, List.of("Starting playlist."), true);
        stale = h.token; h.engine.stop(); h.engine.done(stale); h.engine.resume();
        check(h.speech.size() == 1 && h.completions.isEmpty() && h.ended == 1); pass("Stop during announcement prevents later speech and credit");
        h = new ListeningInterfaceTest(); h.engine.start(units, false, true);
        h.engine.navigate(-1, false); check(h.engine.unitIndex == 0);
        h.engine.navigate(1, false); check(h.engine.unitIndex == 1);
        h.engine.navigate(1, false); check(h.engine.unitIndex == 2);
        h.engine.navigate(-1, false); check(h.engine.unitIndex == 1 && h.completions.isEmpty());
        pass("Previous/Next Step follow the eligible prepared sequence across card boundaries");
        h.engine.navigate(1, true); check(h.engine.unitIndex == 2);
        h.engine.navigate(1, false); h.engine.navigate(-1, true); check(h.engine.unitIndex == 0);
        h.engine.navigate(-1, true); check(h.engine.unitIndex == 0);
        pass("Previous FC returns to previous card first step; first-card boundary is a no-op");
        h.engine.pause("Pause"); h.engine.navigate(1, true); check(h.engine.unitIndex == 2 && h.engine.status.equals("paused"));
        h.engine.resume(); check(h.speech.get(h.speech.size() - 1).equals("Q2"));
        pass("Paused navigation stays paused and resumes at destination question");
        h = new ListeningInterfaceTest(); h.engine.start(units, false, true, List.of(), true);
        h.engine.navigate(1, true); h.engine.navigate(1, true);
        check(h.speech.get(h.speech.size() - 1).equals("Replaying playlist.") && !h.speech.contains("Playlist complete.") && h.completions.isEmpty());
        h.next(); check(h.speech.get(h.speech.size() - 1).equals("Q0"));
        pass("Skipping end wraps with replay announcement but never claims a completed pass");
        h = new ListeningInterfaceTest(); h.engine.start(units, false, true, List.of("Starting playlist."), true);
        h.engine.failed(h.token, "TTS error"); h.engine.resume(); h.next();
        check(h.speech.equals(List.of("Starting playlist.", "Starting playlist.", "Q0")));
        pass("Announcement error retries only failed phrase without restarting playlist announcements");
        h = new ListeningInterfaceTest(); h.engine.start(units, false, true, List.of("Starting playlist."), true);
        FocusRecovery focus = new FocusRecovery();
        check(focus.change(-3, true, false) == FocusRecovery.Action.PAUSE); h.engine.pause("Brief interruption");
        check(focus.change(1, false, true) == FocusRecovery.Action.RESUME); h.engine.resume(); h.next();
        check(h.speech.equals(List.of("Starting playlist.", "Starting playlist.", "Q0")) && h.completions.isEmpty());
        check(focus.change(-2, true, false) == FocusRecovery.Action.PAUSE); h.engine.pause("Call");
        check(focus.change(1, false, true) == FocusRecovery.Action.NONE && h.engine.status.equals("paused"));
        pass("Announcements share duckable focus recovery while calls remain manually paused");
        System.out.println(passed + "/" + passed + " listening-interface native tests passed; simulated audio.");
    }
}
