package com.crownandcall.srproof;
import java.util.*;

/** Platform-contract doubles only; no test class is packaged in the application. */
public final class EarconCallbackTest {
    static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    public static final class Bundle {
        final Map<String, String> values = new HashMap<>();
        public void putString(String key, String value) { values.put(key, value); }
        public String getString(String key) { return values.get(key); }
    }
    public static final class TextToSpeech {
        public static final int ERROR = -1, QUEUE_FLUSH = 0;
        public static final class Engine { public static final String KEY_PARAM_UTTERANCE_ID = "utteranceId"; }
        final Host host;
        String callbackId, explicitId, playing;
        boolean reject;
        int stops;
        TextToSpeech(Host host) { this.host = host; }
        public int playEarcon(String name, int queueMode, Bundle params, String id) {
            check(playing == null && host.speech == null, "No overlapping speech/chime");
            explicitId = id;
            // AOSP TextToSpeechService.AudioSpeechItem.getUtteranceId() contract:
            callbackId = params == null ? null : params.getString(Engine.KEY_PARAM_UTTERANCE_ID);
            check(queueMode == QUEUE_FLUSH, "Preserve queue mode");
            if (reject) return ERROR;
            playing = name; host.history.add(name); return 0;
        }
        void finishAudio() {
            check(playing != null, "A tone must be playing");
            playing = null;
            String id = callbackId;
            // Missing ID suppresses dispatchOnSuccess even though the audio ended.
            if (id != null) host.control.add(() -> host.engine.done(Long.parseLong(id)));
        }
        public void stop() { stops++; playing = null; host.speech = null; }
    }
    static final class Actions {
        long now, due;
        Runnable watchdog;
        public void postDelayed(Runnable task, long delay) { watchdog = task; due = now + delay; }
        public void removeCallbacksAndMessages(Object unused) { watchdog = null; }
        void tick(long ms) { now += ms; if (watchdog != null && now >= due) { Runnable task = watchdog; watchdog = null; task.run(); } }
    }
    static class Host implements PlaybackEngine.Host {
        final PlaybackEngine engine = new PlaybackEngine(this);
        final Actions actions = new Actions();
        final TextToSpeech tts = new TextToSpeech(this);
        final Queue<Runnable> control = new ArrayDeque<>();
        final List<String> history = new ArrayList<>();
        String speech; long speechToken; int credits;
        public long now() { return actions.now; }
        public boolean supportsChimes() { return true; }
        public void speak(String text, long token) {
            check(tts.playing == null && speech == null, "Speech must wait for tone completion");
            speech = text; speechToken = token; history.add(text);
        }
        public void delay(long ms, Runnable completion) { actions.postDelayed(completion, ms); }
        public void cancel() { throw new AssertionError("Use production cancellation"); }
        public void changed() {}
        public void completed(String unit) { credits++; }
        public void ended() {}
        void deliver() { while (!control.isEmpty()) control.remove().run(); }
        void endSpeech() { check(speech != null, "Speech expected"); engine.done(speechToken); }
        void answer() { endSpeech(); endSpeech(); }
        void start() { engine.start(PLAN); }
    }
    static PlaybackEngine.Unit unit(String id, String card) {
        return new PlaybackEngine.Unit(id, id, List.of(new PlaybackEngine.Action("speak", "Q" + id, 0, "Question"),
            new PlaybackEngine.Action("speak", "A" + id, 0, "Answer")), card);
    }
    static final List<PlaybackEngine.Unit> PLAN = List.of(unit("0", "a"), unit("1", "a"), unit("2", "b"));
    static Host transition() { Host host = new TestedChimeHost(); host.start(); host.answer(); return host; }
    static int count;
    static void test(String name, Runnable body) { body.run(); count++; System.out.println("PASS " + name); }
    public static void main(String[] args) {
        test("Actual service request supplies callback ID in Bundle and explicit argument; consecutive steps advance", () -> {
            Host h = transition();
            check(h.tts.explicitId.equals(h.tts.callbackId), "Earcon callback ID is missing from the parameter Bundle");
            h.tts.finishAudio(); h.deliver();
            check("Q1".equals(h.speech) && h.credits == 1 && h.actions.watchdog == null, "Completed chime advances once and clears watchdog");
        });
        test("Flashcard boundary completes with only the card cue and no extra credit", () -> {
            Host h = transition(); h.tts.finishAudio(); h.deliver(); h.answer();
            check("sr-card".equals(h.tts.playing), "Cross-card cue");
            h.tts.finishAudio(); h.deliver(); check("Q2".equals(h.speech) && h.credits == 2, "Next card starts");
            h.answer(); check(h.engine.status.equals("finished") && h.credits == 3, "Normal final answer credit");
        });
        test("Bluetooth-style delayed delivery waits for callback rather than guessed duration", () -> {
            Host h = transition(); h.actions.tick(1170); h.tts.finishAudio(); h.actions.tick(3000);
            check(h.speech == null && h.engine.action().type().equals("chime"), "No speech before delayed callback");
            h.deliver(); check("Q1".equals(h.speech), "Delayed callback advances");
            h.actions.tick(20000); check(h.engine.status.equals("playing"), "Old watchdog cancelled");
        });
        test("Pause cancels audible chime; Resume waits for fresh completion and ignores queued old callback", () -> {
            Host h = transition(); String old = h.tts.callbackId;
            h.engine.pause("user"); check(h.tts.playing == null && h.actions.watchdog == null, "Pause releases current audio/timer");
            h.engine.resume(); h.control.add(() -> h.engine.done(Long.parseLong(old))); h.deliver();
            check(h.speech == null && "sr-step".equals(h.tts.playing), "Old callback cannot advance retry");
            h.tts.finishAudio(); h.deliver(); check("Q1".equals(h.speech) && h.credits == 1, "Resume does not repeat credit");
        });
        test("Stop between audio completion and callback leaves no speech, timer or advancement", () -> {
            Host h = transition(); h.tts.finishAudio(); h.engine.stop(); h.deliver(); h.actions.tick(20000);
            check(h.speech == null && h.tts.playing == null && h.actions.watchdog == null && h.engine.status.equals("stopped") && h.credits == 1, "Stop suppresses queued callback");
        });
        test("Missing completion still fails at 15 seconds, cancels audio and retries without credit", () -> {
            Host h = transition(); h.actions.tick(14999); check(h.engine.status.equals("playing"), "Not an estimated-duration completion");
            h.actions.tick(1); check(h.engine.status.equals("error") && h.engine.message.contains("Transition sound timed out"), "Unchanged watchdog");
            check(h.tts.playing == null && h.speech == null && h.credits == 1, "Failure releases audio without guessing credit");
            h.engine.resume(); h.tts.finishAudio(); h.deliver(); check("Q1".equals(h.speech) && h.credits == 1, "Explicit retry recovers");
        });
        test("Native navigation cancels old chime and its delayed callback at a card boundary", () -> {
            Host h = transition(); h.tts.finishAudio(); h.engine.skip(); h.deliver();
            check("sr-card".equals(h.tts.playing) && h.speech == null, "Stale step cue does not cancel card cue");
            h.tts.finishAudio(); h.deliver(); check("Q2".equals(h.speech) && h.credits == 1, "Skipped answer earns no credit");
        });
        test("Enqueue error cancels watchdog and audio rather than waiting for timeout", () -> {
            Host h = new TestedChimeHost(); h.start(); h.tts.reject = true; h.answer();
            check(h.engine.status.equals("error") && h.actions.watchdog == null && h.tts.playing == null && h.credits == 1, "Immediate fail closed");
        });
        test("Duplicate completion cannot skip the next question or award extra credit", () -> {
            Host h = transition(); String id = h.tts.callbackId; h.tts.finishAudio();
            h.control.add(() -> h.engine.done(Long.parseLong(id))); h.deliver();
            check("Q1".equals(h.speech) && h.credits == 1, "Only one advancement");
        });
        System.out.println(count + "/" + count + " earcon framework-contract scenarios passed; no physical-device claim.");
    }
}
