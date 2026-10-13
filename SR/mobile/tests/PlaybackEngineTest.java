package com.crownandcall.srproof;

import java.util.*;

/** No Android runtime or testing framework required. Tests the production native executor. */
public final class PlaybackEngineTest {
    static int passed;
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static PlaybackEngine.Action speak(String text) { return new PlaybackEngine.Action("speak", text, 0, text); }
    static PlaybackEngine.Action waitFor(long ms) { return new PlaybackEngine.Action("wait", "", ms, "recall"); }
    static List<PlaybackEngine.Unit> plan() {
        return List.of(new PlaybackEngine.Unit("a", "First", List.of(speak("Q1"), waitFor(1000), speak("A1"))),
            new PlaybackEngine.Unit("b", "Second", List.of(speak("Q2"), waitFor(1000), speak("A2"), speak("Q3"), waitFor(1000), speak("A3"))));
    }
    static final class Fake implements PlaybackEngine.Host {
        PlaybackEngine engine = new PlaybackEngine(this);
        long now, token, due;
        String active;
        Runnable timer;
        int overlaps, endCount;
        boolean failJournal;
        List<String> spoken = new ArrayList<>(), completed = new ArrayList<>();
        public long now() { return now; }
        public void speak(String text, long id) { if (active != null) overlaps++; active = text; token = id; spoken.add(text); }
        public void delay(long ms, Runnable next) { check(timer == null); due = now + ms; timer = next; }
        public void cancel() { active = null; timer = null; }
        public void changed() { }
        public void completed(String unit) { if (failJournal) throw new IllegalStateException("disk full"); completed.add(unit); }
        public void ended() { endCount++; }
        void endSpeech() { check(active != null); active = null; engine.done(token); }
        void tick(long ms) { now += ms; if (timer != null && now >= due) { Runnable task = timer; timer = null; task.run(); } }
    }
    static void test(String name, Runnable body) { body.run(); passed++; System.out.println("PASS " + name); }
    public static void main(String[] args) {
        test("All actions, waits, units execute without JavaScript callbacks", () -> {
            Fake f = new Fake(); f.engine.start(plan());
            f.tick(5000); check(f.active.equals("Q1")); f.endSpeech(); check(f.active == null);
            f.tick(999); check(f.active == null); f.tick(1); check(f.active.equals("A1")); f.endSpeech();
            check(f.active.equals("Q2")); f.endSpeech(); f.tick(1000); f.endSpeech();
            check(f.active.equals("Q3")); f.endSpeech(); f.tick(1000); f.endSpeech();
            check(f.engine.status.equals("finished") && f.endCount == 1 && f.overlaps == 0);
            check(f.spoken.equals(List.of("Q1", "A1", "Q2", "A2", "Q3", "A3")) && f.completed.equals(List.of("a", "b")));
        });
        test("Pause cancels speech and Resume repeats only the interrupted utterance", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.engine.pause("user"); f.engine.pause("again");
            check(f.active == null); f.engine.resume(); f.engine.resume(); check(f.spoken.equals(List.of("Q1", "Q1")) && f.overlaps == 0);
        });
        test("Recall Pause retains remaining interval", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.endSpeech(); f.tick(350); f.engine.pause("user");
            f.tick(10000); f.engine.resume(); f.tick(649); check(f.active == null); f.tick(1); check(f.active.equals("A1"));
        });
        test("Stop during speech clears work and ignores late completion", () -> {
            Fake f = new Fake(); f.engine.start(plan()); long stale = f.token; f.engine.stop(); f.engine.done(stale);
            check(f.active == null && f.timer == null && f.completed.isEmpty() && f.engine.status.equals("stopped"));
        });
        test("Stop during recall invalidates an already queued callback", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.endSpeech(); Runnable late = f.timer; f.engine.stop(); late.run();
            check(f.active == null && f.spoken.size() == 1 && f.completed.isEmpty());
        });
        test("Stop during answer gives no partial unit credit", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.endSpeech(); f.tick(1000); f.engine.stop(); check(f.completed.isEmpty());
        });
        test("Skip skips the entire card and cancels recall", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.endSpeech(); f.engine.skip(); f.tick(1000);
            check(f.active.equals("Q2") && f.completed.isEmpty()); f.engine.skip(); check(f.engine.status.equals("finished"));
        });
        test("Paused Skip stays paused and next card resumes at its question", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.engine.pause("user"); f.engine.skip();
            check(f.active == null && f.engine.status.equals("paused")); f.engine.resume(); check(f.active.equals("Q2"));
        });
        test("Restart during recall rejects stale wait", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.endSpeech(); Runnable late = f.timer;
            f.engine.start(plan()); late.run(); check(f.active.equals("Q1") && f.engine.actionIndex == 0);
        });
        test("20 rapid stop/start cycles never overlap and stale errors cannot cancel latest run", () -> {
            Fake f = new Fake(); f.engine.start(plan()); long old = f.token;
            for (int i = 0; i < 20; i++) { f.engine.stop(); f.engine.start(plan()); }
            f.engine.failed(old, "old callback"); check(f.engine.status.equals("playing") && f.overlaps == 0 && f.active.equals("Q1"));
        });
        test("Duplicate speech completion advances once", () -> {
            Fake f = new Fake(); f.engine.start(plan()); long id = f.token; f.endSpeech(); f.engine.done(id);
            check(f.engine.actionIndex == 1 && f.active == null);
        });
        test("Speech failure waits for explicit Resume retry", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.engine.failed(f.token, "TTS failed");
            check(f.engine.status.equals("error") && f.active == null); f.engine.resume(); check(f.active.equals("Q1"));
        });
        test("Focus loss/disconnect pauses, without automatic resume", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.engine.pause("audio focus lost"); f.tick(60000);
            check(f.engine.status.equals("paused") && f.active == null && f.engine.message.contains("focus"));
        });
        test("Initialization can prepare a paused plan without emitting speech", () -> {
            Fake f = new Fake(); f.engine.start(plan(), true); check(f.active == null); f.engine.resume(); check(f.active.equals("Q1"));
        });
        test("Journal failure cannot silently advance or finish the unit", () -> {
            Fake f = new Fake(); f.engine.start(plan()); f.endSpeech(); f.tick(1000); f.failJournal = true; f.endSpeech();
            check(f.engine.status.equals("error") && f.engine.unitIndex == 0 && f.completed.isEmpty());
        });
        test("Long recall and zero recall both preserve sequential actions", () -> {
            Fake f = new Fake(); f.engine.start(List.of(new PlaybackEngine.Unit("x", "Test", List.of(waitFor(120000), speak("A"), waitFor(0)))));
            f.tick(119999); check(f.active == null); f.tick(1); check(f.active.equals("A")); f.endSpeech(); f.tick(0);
            check(f.engine.status.equals("finished"));
        });
        System.out.println(passed + "/" + passed + " native executor tests passed (no physical Android certification).");
    }
}
