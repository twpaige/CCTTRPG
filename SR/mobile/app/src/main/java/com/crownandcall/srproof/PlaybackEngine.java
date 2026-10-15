package com.crownandcall.srproof;

import java.util.List;

/** Android-free executor. All calls and callbacks are serialized by the service's main Handler. */
public final class PlaybackEngine {
    public record Action(String type, String text, long milliseconds, String label) {}
    public record Unit(String id, String name, List<Action> actions, String cardId) {
        public Unit(String id, String name, List<Action> actions) { this(id, name, actions, id); }
    }
    public interface Host {
        long now();
        void speak(String text, long token);
        void delay(long milliseconds, Runnable completion);
        void cancel();
        void changed();
        void completed(String unitId);
        void ended();
        default boolean canBegin() { return true; }
        default void started(String unitId) { }
    }
    private final Host host;
    private List<Unit> units = java.util.Collections.emptyList();
    public String status = "idle", message = "";
    public int unitIndex, actionIndex;
    private long token, deadline, remaining;
    private boolean began, repeat;
    private boolean announcePasses;
    private final java.util.ArrayDeque<String> announcements = new java.util.ArrayDeque<>();
    public boolean announcing() { return !announcements.isEmpty(); }

    public PlaybackEngine(Host host) { this.host = host; }
    public Action action() {
        if (!status.equals("playing") && !status.equals("paused")) return null;
        if (announcing()) return new Action("speak", announcements.peek(), 0, "Status");
        return unitIndex < units.size() ? units.get(unitIndex).actions().get(actionIndex) : null;
    }
    public String unitName() { try { return unitIndex < units.size() ? units.get(unitIndex).name() : ""; } catch (RuntimeException error) { return "Unavailable"; } }
    public int unitCount() { return units.size(); }
    public boolean stepStarted() { return began && unitIndex < units.size(); }
    public void start(List<Unit> plan) {
        start(plan, false);
    }
    public void start(List<Unit> plan, boolean paused) {
        start(plan, paused, false);
    }
    public void start(List<Unit> plan, boolean paused, boolean repeat) {
        start(plan, paused, repeat, java.util.Collections.emptyList(), false);
    }
    public void start(List<Unit> plan, boolean paused, boolean repeat, List<String> intro, boolean announcePasses) {
        invalidate(); units = plan; unitIndex = actionIndex = 0;
        announcements.clear(); announcements.addAll(intro); this.announcePasses = announcePasses;
        began = false; this.repeat = repeat;
        status = paused ? "paused" : "playing"; message = "";
        if (paused) { remaining = plan.isEmpty() ? 0 : plan.get(0).actions().get(0).milliseconds(); host.changed(); }
        else execute(false);
    }
    private void invalidate() { token++; host.cancel(); }
    private void execute(boolean remainingWait) {
        try { executeReady(remainingWait); } catch (RuntimeException error) { fail(error.getMessage()); }
    }
    private void executeReady(boolean remainingWait) {
        if (!status.equals("playing")) return;
        if (announcing()) { long current = ++token; host.changed(); host.speak(announcements.peek(), current); return; }
        if (unitIndex >= units.size() && repeat && !units.isEmpty()) {
            unitIndex = 0;
            if (announcePasses) { announcements.add("Playlist complete."); announcements.add("Replaying playlist."); execute(false); return; }
        }
        if (unitIndex >= units.size()) { status = "finished"; invalidate(); host.changed(); host.ended(); return; }
        if (!began) {
            if (!host.canBegin()) { status = "paused"; message = "Open SR to save completed steps, then Resume. A mastery change requires a fresh Start."; host.changed(); return; }
            host.started(units.get(unitIndex).id()); began = true;
        }
        Action action = action();
        long current = ++token;
        if (action.type().equals("wait")) {
            if (!remainingWait) remaining = action.milliseconds();
            deadline = host.now() + remaining;
            host.changed();
            host.delay(remaining, () -> done(current));
        } else {
            host.changed();
            host.speak(action.text(), current);
        }
    }
    public void done(long completedToken) {
        if (completedToken != token || !status.equals("playing")) return;
        // Invalidate first, so duplicate onDone cannot complete a unit twice.
        invalidate();
        if (announcing()) { announcements.remove(); execute(false); return; }
        if (actionIndex + 1 == units.get(unitIndex).actions().size()) {
            try { host.completed(units.get(unitIndex).id()); }
            catch (RuntimeException error) { fail("Could not retain completion: " + error.getMessage()); return; }
            actionIndex = 0; unitIndex++; began = false;
        } else actionIndex++;
        execute(false);
    }
    public void failed(long failedToken, String reason) { if (token == failedToken && status.equals("playing")) fail(reason); }
    public void fail(String reason) { invalidate(); status = "error"; message = reason; host.changed(); }
    public void pause(String reason) {
        if (!status.equals("playing")) return;
        if (action() != null && action().type().equals("wait")) remaining = Math.max(0, deadline - host.now());
        invalidate(); status = "paused"; message = reason; host.changed();
    }
    public void resume() {
        if (!status.equals("paused") && !status.equals("error")) return;
        boolean wasPaused = status.equals("paused");
        status = "playing"; message = ""; execute(began && wasPaused && action() != null && action().type().equals("wait"));
    }
    public void skip() {
        navigate(1, true);
    }
    public void navigate(int direction, boolean cardNavigation) {
        if (!status.equals("playing") && !status.equals("paused") && !status.equals("error")) return;
        if (units.isEmpty()) return;
        boolean paused = status.equals("paused") || status.equals("error");
        int target = unitIndex;
        if (cardNavigation) {
            String card = units.get(unitIndex).cardId();
            if (direction > 0) { do { target++; } while (target < units.size() && units.get(target).cardId().equals(card)); }
            else {
                while (target > 0 && units.get(target - 1).cardId().equals(card)) target--;
                if (target == 0) return;
                target--; String previous = units.get(target).cardId();
                while (target > 0 && units.get(target - 1).cardId().equals(previous)) target--;
            }
        } else target += direction;
        if (target < 0) return;
        invalidate(); announcements.clear(); unitIndex = target;
        actionIndex = 0; began = false; message = "";
        if (unitIndex >= units.size() && repeat) { unitIndex = 0; if (announcePasses) announcements.add("Replaying playlist."); }
        if (unitIndex >= units.size()) { status = "finished"; host.changed(); host.ended(); }
        else if (paused) { status = "paused"; host.changed(); }
        else execute(false);
    }
    public void stop() { invalidate(); announcements.clear(); status = "stopped"; message = ""; host.changed(); host.ended(); }
    public void revise(List<Unit> next, int afterId) {
        if (!status.equals("paused")) throw new IllegalStateException("Pause before updating a session.");
        invalidate(); announcements.clear(); units = next;
        int low = 0, high = units.size();
        while (low < high) { int middle = low + (high - low) / 2; if (Integer.parseInt(units.get(middle).id()) <= afterId) low = middle + 1; else high = middle; }
        unitIndex = low;
        if (unitIndex == units.size()) unitIndex = 0;
        actionIndex = 0; began = false; remaining = 0; message = "Session updated. Ready to resume."; host.changed();
    }
}
