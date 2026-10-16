package com.crownandcall.srproof;
import java.util.*;

/** Exercises the production executor with the earcon capability enabled. */
public final class ChimePlaybackTest {
    static void check(boolean value) { if (!value) throw new AssertionError(); }
    static PlaybackEngine.Unit unit(String id, String card) {
        return new PlaybackEngine.Unit(id, id, List.of(new PlaybackEngine.Action("speak", "Q" + id, 0, "Question"),
            new PlaybackEngine.Action("speak", "A" + id, 0, "Answer")), card);
    }
    static final List<PlaybackEngine.Unit> PLAN = List.of(unit("0", "a"), unit("2", "a"), unit("5", "c"));
    static final class Fake implements PlaybackEngine.Host {
        PlaybackEngine engine = new PlaybackEngine(this);
        String active; long token; int credits, starts;
        List<String> history = new ArrayList<>();
        public long now() { return 0; }
        public void speak(String text, long token) { check(active == null); active = text; this.token = token; history.add(text); }
        public boolean supportsChimes() { return true; }
        public void chime(String kind, long token) { speak("chime:" + kind, token); }
        public void delay(long ms, Runnable done) { throw new AssertionError(); }
        public void cancel() { active = null; }
        public void changed() {}
        public void completed(String id) { credits++; }
        public void started(String id) { starts++; }
        public void ended() {}
        void end() { check(active != null); engine.done(token); }
        void start() { engine.start(PLAN); }
    }
    static int count;
    static void test(String name, Runnable body) { body.run(); count++; System.out.println("PASS " + name); }
    public static void main(String[] args) {
        test("Answer completion -> step earcon -> question; earcon cannot award credit or start a step", () -> {
            Fake f = new Fake(); f.start(); check(f.active.equals("Q0")); f.end(); f.end();
            check(f.active.equals("chime:step") && f.credits == 1 && f.starts == 1 && !f.engine.stepStarted());
            long stale = f.token; f.end(); f.engine.done(stale);
            check(f.active.equals("Q2") && f.credits == 1 && f.starts == 2);
        });
        test("Card cue replaces step cue and finite completion adds none", () -> {
            Fake f = new Fake(); f.start(); f.end(); f.end(); f.end(); f.end(); f.end();
            check(f.active.equals("chime:card")); f.end(); f.end(); f.end();
            check(f.engine.status.equals("finished") && f.credits == 3 && f.history.stream().filter(s -> s.startsWith("chime")).count() == 2);
        });
        test("Native forward/back navigation respects filtered card identities with no credit", () -> {
            Fake f = new Fake(); f.start(); f.engine.navigate(1, false); check(f.active.equals("chime:step")); f.end();
            f.engine.navigate(-1, false); check(f.active.equals("chime:step")); f.end();
            f.engine.skip(); check(f.active.equals("chime:card")); f.end(); f.engine.navigate(-1, true);
            check(f.active.equals("chime:card") && f.credits == 0);
        });
        test("Pause/Resume speech has no cue; paused navigation defers cue", () -> {
            Fake f = new Fake(); f.start(); f.engine.pause("user"); f.engine.resume(); check(f.active.equals("Q0"));
            f.engine.pause("user"); f.engine.skip(); check(f.active == null); f.engine.resume();
            check(f.active.equals("chime:card") && f.credits == 0);
        });
        test("Pause, stale completion, failure/retry and Stop during earcon never credit a target", () -> {
            Fake f = new Fake(); f.start(); f.end(); f.end(); long stale = f.token;
            f.engine.pause("focus"); f.engine.done(stale); check(f.active == null);
            f.engine.resume(); check(f.active.equals("chime:step")); f.engine.failed(f.token, "audio error");
            f.engine.resume(); check(f.active.equals("chime:step")); stale = f.token; f.engine.stop(); f.engine.done(stale);
            check(f.active == null && f.credits == 1); f.start(); check(f.active.equals("Q0"));
        });
        test("Rapid navigation cancels pending cue and compares actual spoken source", () -> {
            Fake f = new Fake(); f.start(); f.engine.navigate(1, false); f.engine.skip(); check(f.active.equals("chime:card"));
            f.engine.navigate(-1, true); check(f.active.equals("Q0") && f.credits == 0);
        });
        test("Mastery revision removes KNOWN material, retains correct next-card cue", () -> {
            Fake f = new Fake(); f.start(); f.engine.pause("edit"); f.engine.revise(List.of(unit("5", "c")), 0);
            f.engine.resume(); check(f.active.equals("chime:card") && f.credits == 0);
        });
        test("Playlist start/completion/replay announcements preserved; replay boundary emits one cue", () -> {
            Fake f = new Fake(); f.engine.start(PLAN, false, true, List.of("Starting playlist."), true);
            check(f.active.equals("Starting playlist.")); f.end(); check(f.active.equals("Q0"));
            f.engine.skip(); f.end(); f.end(); f.end(); check(f.active.equals("Playlist complete."));
            f.end(); check(f.active.equals("Replaying playlist.")); f.end(); check(f.active.equals("chime:card"));
            f.end(); check(f.active.equals("Q0") && f.credits == 1);
        });
        System.out.println(count + "/" + count + " native transition scenarios passed.");
    }
}
