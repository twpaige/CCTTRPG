package com.crownandcall.srproof;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.json.*;

public final class PreparedSessionTest {
    static int passed;
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static void pass(String name) { passed++; System.out.println("PASS prepared " + name); }
    static void rejects(Runnable action) { try { action.run(); } catch (RuntimeException expected) { return; } throw new AssertionError("Expected failure"); }
    static void append(SessionStore store, JSONObject row) throws Exception {
        String json = row.toString();
        for (int i = 0; i < json.length();) {
            int end = Math.min(json.length(), i + 65536);
            if (end < json.length() && Character.isHighSurrogate(json.charAt(end - 1))) end--;
            store.part(json.substring(i, end)); i = end;
        }
        store.finishUnit();
    }
    static final class Host implements PlaybackEngine.Host {
        PlaybackEngine engine; SessionStore store; CompletionQueue queue;
        long token, time = 2000000000000L; Runnable delay; int starts, ends;
        public long now() { return time; }
        public void speak(String text, long token) { this.token = token; }
        public void delay(long ms, Runnable done) { delay = done; }
        public void cancel() { delay = null; }
        public void changed() {}
        public void ended() { ends++; }
        public void started(String id) { starts++; }
        public void completed(String id) {
            try { if (store.needsCredit(id, store.descriptor(engine.unitIndex), time)) { queue.add(id, id); store.retained(id); } }
            catch (JSONException error) { throw new IllegalStateException(error); }
        }
        void next() { if (delay != null) { Runnable done = delay; delay = null; done.run(); } else engine.done(token); }
    }
    public static void main(String[] args) throws Exception {
        File directory = Files.createTempDirectory("sr-prepared-").toFile();
        JSONObject input = new JSONObject(Files.readString(Path.of(args[0])));
        JSONArray rows = input.getJSONArray("units"); JSONObject header = new JSONObject(input.toString()); header.remove("units");
        header.put("cutoff", JSONObject.NULL);
        try {
            SessionStore store = new SessionStore(directory, header);
            SessionStore incomplete = store; rejects(() -> incomplete.get(0));
            try { store.seal(); throw new AssertionError(); } catch (IOException expected) { }
            store.close(); check(directory.list().length == 0);
            pass("Incomplete preparation cannot play and abort removes its files");
            store = new SessionStore(directory, header);
            for (int i = 0; i < rows.length(); i++) append(store, rows.getJSONObject(i));
            store.seal(); check(store.size() == 5000);
            for (int i = 0; i < store.size(); i++) {
                PlaybackEngine.Unit unit = store.get(i); JSONObject original = rows.getJSONObject(i);
                check(unit.id().equals(original.getString("id")) && unit.cardId().equals(original.getString("cardId")));
                StringBuilder q = new StringBuilder(), a = new StringBuilder();
                for (PlaybackEngine.Action action : unit.actions()) {
                    if (action.label().equals("Question")) q.append(action.text());
                    if (action.label().equals("Answer")) a.append(action.text());
                    if (action.type().equals("wait")) check(action.milliseconds() == original.getLong("recallMs"));
                }
                check(q.toString().equals(original.getString("question")) && a.toString().equals(original.getString("answer")));
                check(store.cachedSteps() <= 16);
            }
            check(store.get(0).id().equals("0"));
            pass("1000 cards / 5000 steps read across bounded batches and rewind with exact speech and recall");
            SessionStore larger = new SessionStore(directory, header);
            JSONObject row = new JSONObject(rows.getJSONObject(0).toString()).put("answer", "Long Unicode 🧠 日本語 ".repeat(120));
            for (int i = 0; i < 12000; i++) append(larger, new JSONObject(row.toString()).put("id", String.valueOf(i)));
            larger.seal(); check(larger.dataFile.length() > Plan.MAX_BYTES && larger.size() == 12000);
            for (int i = 0; i < larger.size(); i++) check(larger.get(i).id().equals(String.valueOf(i)) && larger.cachedSteps() <= 16);
            larger.close();
            pass("12000-step plan exceeds old 16 MiB ceiling with no truncation or whole-session speech expansion");
            JSONObject due = new JSONObject(store.descriptor(0).toString()).put("nextDueAt", 100);
            check(store.needsCredit("0", due, 100)); store.retained("0"); check(!store.needsCredit("0", due, 200));
            check(!store.needsCredit("1", due, 99)); check(!store.needsCredit("1", due, 200));
            check(store.needsCredit("2", due, 100)); check(store.needsCredit("2", due, 100)); store.retained("2");
            pass("First success consumes one opportunity; early stays early; failed retention can retry");
            SessionStore revised = new SessionStore(directory, header, store.finished);
            for (int i = 0; i < store.size(); i++) revised.copyUpdated(store, i, new JSONObject(store.descriptor(i).toString()).put("id", String.valueOf(i)).put("keep", i % 3 != 0));
            revised.seal(); check(revised.size() == 3333 && revised.get(0).id().equals("1"));
            check(!revised.needsCredit("1", due, 300));
            check(revised.raw(32).getString("answer").equals(store.raw(Integer.parseInt(revised.get(32).id())).getString("answer")));
            pass("Paused revision prunes across batches, preserves stable IDs/text/order and completion flags");
            revised.close(); store.close();
            SessionStore small = new SessionStore(directory, header);
            for (int i = 0; i < 3; i++) append(small, new JSONObject(row.toString()).put("id", String.valueOf(i)).put("cardId", "card" + i).put("question", "Q").put("answer", "A").put("nextDueAt", 0));
            small.seal();
            try (CompletionQueue queue = new CompletionQueue()) {
                Host host = new Host(); host.store = small; host.queue = queue; host.engine = new PlaybackEngine(host);
                host.engine.start(small, false, true); host.engine.skip(); // first step skipped, later pass must still count
                for (int i = 0; i < 30; i++) host.next();
                check(queue.size() == 3 && host.ends == 0 && host.starts > 6);
                host.engine.navigate(-1, false); for (int i = 0; i < 9; i++) host.next(); check(queue.size() == 3);
                pass("Continuous REVIEW credits a skipped step on a later pass once, with no WebView");
                long stale = host.token; host.engine.pause("manual"); host.engine.done(stale); check(queue.size() == 3);
                host.engine.revise(small, 1); check(host.engine.unitIndex == 2 && host.engine.status.equals("paused"));
                host.engine.resume(); host.engine.stop(); host.engine.done(host.token); check(queue.size() == 3);
                small.close(); check(queue.size() == 3);
                pass("Manual revision advances past interrupted step; Pause/Stop reject stale callbacks and retain completions");
            }
            JSONObject auditHeader = new JSONObject(header.toString()).put("mode", "AUDIT");
            try (SessionStore audit = new SessionStore(directory, auditHeader); CompletionQueue queue = new CompletionQueue()) {
                append(audit, new JSONObject(row.toString()).put("id", "0").put("mastery", 10).put("nextDueAt", JSONObject.NULL).put("question", "Q").put("answer", "A")); audit.seal();
                Host host = new Host(); host.store = audit; host.queue = queue; host.engine = new PlaybackEngine(host); host.engine.start(audit, false, true);
                for (int i = 0; i < 12; i++) host.next();
                check(queue.size() == 0 && host.starts > 3 && host.ends == 0); host.engine.stop();
            }
            pass("AUDIT repeats with no scheduling records");
            File overflow = new File(directory, "overflow");
            try (CompletionQueue queue = new CompletionQueue()) {
                queue.enableOverflow(overflow);
                for (int i = 0; i < 12000; i++) queue.add(String.valueOf(i), String.valueOf(i));
                check(queue.size() == 12000 && overflow.length() > 0 && !queue.acknowledge("1"));
                for (int i = 0; i < 12000; i++) { check(queue.batch().get(0).equals(String.valueOf(i))); check(queue.acknowledge(String.valueOf(i))); if (i == 1000) queue.add("12000", "12000"); }
                check(queue.size() == 1 && queue.acknowledge("12000") && overflow.length() == 0);
                pass("12001 completion records spill and reconcile in order without eviction; file clears after final acknowledgement");
                for (int i = 0; i < 512; i++) queue.add(String.valueOf(i), String.valueOf(i));
                queue.close(); rejects(() -> queue.add("513", "513")); check(queue.size() == 512);
                pass("Overflow write failure reports an error and preserves retained completions");
            }
            overflow.delete();
            check(directory.list().length == 0);
            pass("Stop/close releases all playback resources; fresh process starts without a session");
            System.out.println(passed + "/" + passed + " prepared native tests passed; no physical-device claim.");
        } finally { for (File file : Objects.requireNonNull(directory.listFiles())) file.delete(); directory.delete(); }
    }
}
