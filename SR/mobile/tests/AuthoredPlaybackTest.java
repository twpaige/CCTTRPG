package com.crownandcall.srproof;
import java.util.*;
import java.nio.file.*;
import org.json.*;
public final class AuthoredPlaybackTest {
    static int passed;
    static void check(boolean value) { if (!value) throw new AssertionError(); }
    interface Case { void run() throws Exception; }
    static void test(String name, Case body) throws Exception { body.run(); passed++; System.out.println("PASS " + name); }
    static void rejects(Case body) throws Exception { boolean failed = false; try { body.run(); } catch (JSONException | IllegalStateException error) { failed = true; } check(failed); }
    static PlaybackEngine.Action speech(String text) { return new PlaybackEngine.Action("speak", text, 0, "Answer"); }
    static List<PlaybackEngine.Unit> units() { return List.of(new PlaybackEngine.Unit("s1", "one", List.of(speech("Q"), new PlaybackEngine.Action("wait", "", 3600000, "Recall"), speech("A1"), speech("A2")), "card"), new PlaybackEngine.Unit("s2", "two", List.of(speech("B")), "card"), new PlaybackEngine.Unit("s3", "three", List.of(speech("C")), "other")); }
    static final class Host implements PlaybackEngine.Host {
        final PlaybackEngine engine = new PlaybackEngine(this);
        final CompletionQueue queue = new CompletionQueue();
        long now, token, wait, occurrence; String active; Runnable timer;
        List<String> starts = new ArrayList<>();
        public long now() { return now; }
        public void speak(String text, long token) { this.active = text; this.token = token; }
        public void delay(long ms, Runnable next) { wait = ms; timer = next; }
        public void cancel() { active = null; timer = null; }
        public void changed() { }
        public void ended() { }
        public boolean canBegin() { return queue.hasRoom(); }
        public void started(String id) { starts.add(id); occurrence++; }
        public void completed(String id) { queue.add(Long.toString(occurrence), id); }
        void end() { check(active != null); engine.done(token); }
        void tick(long ms) { now += ms; if (timer != null && ms >= wait) { Runnable next = timer; timer = null; next.run(); } }
    }
    public static void main(String[] args) throws Exception {
        String json = Files.readString(Path.of(args[0]));
        test("Production JS authored plan parses natively with stable card/step identity", () -> { Plan p = new Plan(json); check(p.authored && p.mode.equals("REVIEW") && p.units.size() == 5); check(p.units.get(0).cardId().equals("card-0")); });
        test("Long Unicode answer segments concatenate exactly; recall exceeds two minutes", () -> { Plan p = new Plan(json); StringBuilder text = new StringBuilder(); for (var action : p.units.get(0).actions()) { if (action.label().equals("Answer")) { text.append(action.text()); check(action.text().codePointCount(0, action.text().length()) <= 400); } } check(text.toString().equals(new JSONObject(json).getJSONArray("units").getJSONObject(0).getString("answer"))); check(p.units.get(0).actions().stream().anyMatch(a -> a.milliseconds() == 3600000)); });
        test("Parser rejects corrupt version, mode, duplicate IDs, recall and revision", () -> {
            for (String key : List.of("version", "mode")) { JSONObject root = new JSONObject(json); root.put(key, key.equals("version") ? 99 : "FOCUSED"); rejects(() -> new Plan(root.toString())); }
            for (String key : List.of("recallMs", "cardRevision", "mastery")) { JSONObject root = new JSONObject(json); root.getJSONArray("units").getJSONObject(0).put(key, -1); rejects(() -> new Plan(root.toString())); }
            JSONObject root = new JSONObject(json); root.getJSONArray("units").getJSONObject(1).put("id", "0"); rejects(() -> new Plan(root.toString()));
        });
        test("Step credit follows the final answer segment only; stale duplicate callback ignored", () -> { Host h = new Host(); h.engine.start(units()); h.end(); h.tick(3600000); h.end(); check(h.queue.size() == 0); long token = h.token; h.end(); h.engine.done(token); check(h.queue.size() == 1 && h.active.equals("B")); });
        test("Stop in a partial answer never credits it; previous complete steps survive Stop", () -> { Host h = new Host(); h.engine.start(units()); h.end(); h.tick(3600000); h.end(); h.engine.stop(); check(h.queue.size() == 0); h.engine.start(units()); h.end(); h.tick(3600000); h.end(); h.end(); h.engine.stop(); check(h.queue.size() == 1); });
        test("Skip skips remaining steps of current card and retains earlier credit", () -> { Host h = new Host(); h.engine.start(units()); h.end(); h.tick(3600000); h.end(); h.end(); h.engine.skip(); check(h.active.equals("C") && h.queue.size() == 1); });
        test("Paused Skip stays paused and skips a whole card", () -> { Host h = new Host(); h.engine.start(units()); h.engine.pause("user"); h.engine.skip(); check(h.engine.status.equals("paused") && h.active == null); h.engine.resume(); check(h.active.equals("C")); });
        test("One-hour recall pause/resume retains only remaining time", () -> { Host h = new Host(); h.engine.start(units()); h.end(); h.now += 10000; h.engine.pause("user"); h.now += 50000; h.engine.resume(); check(h.wait == 3590000); });
        test("Paused preparation and paused Skip have no active completion occurrence", () -> { Host h = new Host(); h.engine.start(units(), true); check(!h.engine.stepStarted()); h.engine.resume(); check(h.engine.stepStarted()); h.engine.pause("user"); check(h.engine.stepStarted()); h.engine.skip(); check(!h.engine.stepStarted()); h.engine.resume(); check(h.engine.stepStarted()); });
        test("AUDIT cycles natively with unique occurrences and no JS dispatch", () -> { Host h = new Host(); h.engine.start(List.of(units().get(2)), false, true); for (int i = 0; i < 4; i++) h.end(); check(h.queue.size() == 4 && h.starts.size() == 5); h.engine.stop(); check(h.active == null); });
        test("512 completions pause before the next step; no eviction; drain then Resume", () -> { Host h = new Host(); h.engine.start(List.of(units().get(2)), false, true); for (int i = 0; i < CompletionQueue.LIMIT; i++) h.end(); check(h.queue.size() == 512 && h.active == null && h.engine.status.equals("paused")); check(h.starts.size() == 512); check(h.queue.acknowledge("1")); h.engine.resume(); check(h.active.equals("C") && h.starts.size() == 513); });
        test("Queue batch/head acknowledgement and duplicate add preserve unsaved records", () -> { CompletionQueue q = new CompletionQueue(); for (int i = 0; i < 40; i++) q.add("id" + i, "row" + i); check(q.batch().size() == 32 && !q.acknowledge("id1")); q.add("id0", "replacement"); check(q.batch().get(0).equals("row0") && q.size() == 40); check(q.acknowledge("id0") && q.size() == 39); });
        test("Byte bound rejects overflow without deleting prior records", () -> { CompletionQueue q = new CompletionQueue(); q.add("a", "small"); rejects(() -> q.add("b", "x".repeat(CompletionQueue.MAX_BYTES))); check(q.size() == 1 && q.batch().get(0).equals("small")); });
        test("Fresh process state is empty and idle, with no automatic speech", () -> { Host h = new Host(); check(h.queue.size() == 0 && h.active == null && h.engine.status.equals("idle")); });
        test("Error/retry and interrupted segment retain one step occurrence", () -> { Host h = new Host(); h.engine.start(units()); long token = h.token; h.engine.failed(token, "test"); h.engine.resume(); check(h.starts.size() == 1 && h.active.equals("Q")); h.engine.pause("user"); h.engine.resume(); check(h.starts.size() == 1); });
        test("Repository 1000-card synthetic stress plan parses without sample unit/action limits", () -> { Plan plan = new Plan(Files.readString(Path.of(args[1]))); check(plan.units.size() == Integer.parseInt(args[2]) && plan.units.size() > 300); });
        test("Duckable loss/gain resumes interrupted answer exactly once, without early credit", () -> {
            Host h = new Host(); FocusRecovery f = new FocusRecovery(); h.engine.start(units()); h.end(); h.tick(3600000); h.end();
            long old = h.token; check(f.change(-3, true, false) == FocusRecovery.Action.PAUSE); h.engine.pause("duck");
            h.engine.done(old); check(h.queue.size() == 0); check(f.change(1, false, true) == FocusRecovery.Action.RESUME); h.engine.resume();
            check(h.active.equals("A2")); check(f.change(1, true, false) == FocusRecovery.Action.NONE); h.end(); check(h.queue.size() == 1);
        });
        test("Duckable recall interruption preserves remaining time", () -> { Host h = new Host(); FocusRecovery f = new FocusRecovery(); h.engine.start(units()); h.end(); h.now += 12000; f.change(-3, true, false); h.engine.pause("duck"); h.now += 9000; check(f.change(1, false, true) == FocusRecovery.Action.RESUME); h.engine.resume(); check(h.wait == 3588000); });
        test("Permanent loss and ambiguous transient call/media loss require manual Resume", () -> { for (int loss : new int[]{-1, -2}) { FocusRecovery f = new FocusRecovery(); f.change(-3, true, false); check(f.change(loss, false, true) == FocusRecovery.Action.PAUSE); check(!f.waiting() && f.change(1, false, true) == FocusRecovery.Action.NONE); } });
        test("User Pause during interruption cancels pending automatic recovery", () -> { FocusRecovery f = new FocusRecovery(); f.change(-3, true, false); f.cancel(); check(f.change(1, false, true) == FocusRecovery.Action.NONE); });
        test("Stop during interruption rejects delayed focus and speech callbacks", () -> { Host h = new Host(); FocusRecovery f = new FocusRecovery(); h.engine.start(units()); long token = h.token; f.change(-3, true, false); h.engine.pause("duck"); f.cancel(); h.engine.stop(); check(f.change(1, false, false) == FocusRecovery.Action.NONE); h.engine.done(token); check(h.active == null && h.queue.size() == 0); });
        test("Bluetooth disconnect cancels recovery and already-paused notifications cannot arm it", () -> { FocusRecovery f = new FocusRecovery(); f.change(-3, true, false); f.cancel(); check(f.change(-3, false, true) == FocusRecovery.Action.NONE); check(f.change(1, false, true) == FocusRecovery.Action.NONE); });
        test("Duplicate duck loss retains one recovery; unrelated delayed gain cannot start idle audio", () -> { FocusRecovery f = new FocusRecovery(); f.change(-3, true, false); f.change(-3, false, true); check(f.change(1, false, true) == FocusRecovery.Action.RESUME); check(f.change(1, false, false) == FocusRecovery.Action.NONE); });
        test("Backup names use local minute and collision suffix", () -> { Calendar c = Calendar.getInstance(); c.set(2026, Calendar.OCTOBER, 14, 14, 35, 0); check(BackupDocument.name(c.getTime(), 0).equals("SR-Backup-2026-10-14-1435.json")); check(BackupDocument.name(c.getTime(), 2).equals("SR-Backup-2026-10-14-1435-2.json")); });
        test("Backup writes and reopens exact UTF-8 bytes", () -> { byte[] expected = "JSON 日本語 🧠".getBytes(java.nio.charset.StandardCharsets.UTF_8); java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream(); BackupDocument.save(expected, () -> new java.io.ByteArrayInputStream(out.toByteArray()), () -> out); check(Arrays.equals(expected, out.toByteArray())); });
        test("Nonempty destination never gets overwritten", () -> { boolean[] opened = {false}; try { BackupDocument.save(new byte[]{1}, () -> new java.io.ByteArrayInputStream(new byte[]{2}), () -> { opened[0] = true; return new java.io.ByteArrayOutputStream(); }); throw new AssertionError(); } catch (java.io.IOException expected) { check(!opened[0]); } });
        test("Backup write failure is reported without verification success", () -> { try { BackupDocument.save(new byte[]{1}, () -> new java.io.ByteArrayInputStream(new byte[0]), () -> { throw new java.io.IOException("offline provider"); }); throw new AssertionError(); } catch (java.io.IOException expected) { } });
        test("Truncated, changed, extra and unavailable read-back all fail closed", () -> { for (byte[] actual : new byte[][]{ {}, {2}, {1, 2}, null }) { int[] reads = {0}; try { BackupDocument.save(new byte[]{1}, () -> { if (reads[0]++ == 0) return new java.io.ByteArrayInputStream(new byte[0]); return actual == null ? null : new java.io.ByteArrayInputStream(actual); }, () -> new java.io.ByteArrayOutputStream()); throw new AssertionError(); } catch (java.io.IOException expected) { } } });
        System.out.println(passed + "/" + passed + " authored native tests passed; no physical-device claim.");
    }
}
