package com.crownandcall.srproof;
import java.nio.file.*;
import org.json.*;

public final class QuickListenTest implements PlaybackEngine.Host {
    PlaybackEngine engine = new PlaybackEngine(this);
    long token, time, wait;
    Runnable pending;
    int credits;
    public long now() { return time; }
    public void speak(String text, long token) { this.token = token; }
    public void delay(long ms, Runnable done) { wait = ms; pending = done; }
    public void cancel() { pending = null; }
    public void changed() {}
    public void completed(String id) { credits++; }
    public void ended() {}
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    public static void main(String[] args) throws Exception {
        JSONArray plans = new JSONArray(Files.readString(Path.of(args[0])));
        for (int i = 0; i < plans.length(); i++) {
            JSONObject json = plans.getJSONObject(i);
            Plan plan = new Plan(json.toString());
            QuickListenTest host = new QuickListenTest(); host.engine.start(plan.units);
            for (int j = 0; j < plan.units.size(); j++) {
                long expected = json.getJSONArray("units").getJSONObject(j).getLong("recallMs");
                host.engine.done(host.token); check(host.wait == expected && host.credits == j);
                long elapsed = Math.min(700, expected); host.time += elapsed;
                host.engine.pause("user"); host.time += 5000; host.engine.resume();
                check(host.wait == expected - elapsed);
                host.time += host.wait; host.pending.run(); host.engine.done(host.token);
            }
            check(host.engine.status.equals("finished") && host.credits == plan.units.size());
        }
        System.out.println("PASS four JS-prepared REVIEW/AUDIT plans: exact native waits, remaining recall and unchanged completion boundaries");
    }
}
