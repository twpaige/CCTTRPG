package com.crownandcall.srproof;

import org.json.*;
import java.util.*;

/** Strict bridge boundary; the native side accepts actions, not flashcard/review rules. */
final class Plan {
    static final int MAX_BYTES = 16 * 1024 * 1024;
    final String sessionId, voiceName;
    final boolean authored;
    final String mode, libraryGeneration;
    final Map<String, JSONObject> descriptors = new HashMap<>();
    SessionStore store;
    final float rate;
    List<PlaybackEngine.Unit> units = new ArrayList<>();
    Plan(String json) throws JSONException { this(json, false); }
    Plan(String json, boolean streamed) throws JSONException {
        if (!streamed && json.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_BYTES) throw new JSONException("Session exceeds 16 MiB; select a smaller series. Nothing truncated.");
        JSONObject root = new JSONObject(json);
        int version = root.getInt("version");
        if (version != 1 && version != 2) throw new JSONException("Unsupported plan version");
        authored = version == 2;
        mode = authored ? root.getString("mode") : "SAMPLE";
        libraryGeneration = authored ? required(root, "libraryGeneration") : "";
        if (authored && !mode.equals("REVIEW") && !mode.equals("AUDIT")) throw new JSONException("Invalid mode");
        sessionId = root.getString("sessionId"); voiceName = root.getString("voiceName");
        rate = (float) root.getDouble("rate");
        if (sessionId.isEmpty() || sessionId.length() > 100 || !Float.isFinite(rate) || rate < .5 || rate > 2) throw new JSONException("Invalid session settings");
        JSONArray list = root.getJSONArray("units");
        if (list.length() == 0 || (!authored && list.length() > 300)) throw new JSONException("Empty or oversized sample session");
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < list.length(); i++) {
            JSONObject unit = list.getJSONObject(i); String id = unit.getString("id");
            if (!ids.add(id)) throw new JSONException("Duplicate unit ID");
            List<PlaybackEngine.Action> actions = new ArrayList<>();
            if (authored) {
                required(unit, "cardId"); required(unit, "stepId");
                number(unit, "cardRevision", 1); number(unit, "progressRevision", 1);
                long mastery = number(unit, "mastery", 0);
                if (mastery > 10 || (mode.equals("AUDIT") != (mastery == 10))) throw new JSONException("Invalid mastery for mode");
                if (mastery == 10) { if (!unit.isNull("nextDueAt")) throw new JSONException("KNOWN due must be null"); }
                else number(unit, "nextDueAt", 0);
                long recall = number(unit, "recallMs", 0);
                actions = new StepActions(required(unit, "question"), required(unit, "answer"), recall);
                JSONObject descriptor = new JSONObject();
                for (String key : new String[]{"cardId", "stepId", "cardRevision", "progressRevision", "mastery", "nextDueAt", "stepNumber"}) descriptor.put(key, unit.get(key));
                descriptors.put(id, descriptor);
                units.add(new PlaybackEngine.Unit(id, unit.getString("name"), actions, unit.getString("cardId")));
                continue;
            }
            JSONArray source = unit.getJSONArray("actions");
            if (source.length() == 0 || source.length() > 100) throw new JSONException("Invalid action count");
            for (int j = 0; j < source.length(); j++) {
                JSONObject action = source.getJSONObject(j);
                String type = action.getString("type"), text = action.optString("text", "");
                long milliseconds = action.optLong("milliseconds", 0);
                if (!type.equals("speak") && !type.equals("wait")) throw new JSONException("Unknown action");
                if (type.equals("speak") && (text.trim().isEmpty() || text.length() > 2000)) throw new JSONException("Invalid speech text");
                if (milliseconds < 0 || milliseconds > 120000) throw new JSONException("Invalid recall time");
                actions.add(new PlaybackEngine.Action(type, text, milliseconds, action.getString("label")));
            }
            units.add(new PlaybackEngine.Unit(id, unit.getString("name"), actions));
        }
    }
    Plan(SessionStore store) throws JSONException {
        this.store = store; this.units = store;
        JSONObject root = store.header;
        sessionId = required(root, "sessionId"); voiceName = root.getString("voiceName");
        mode = required(root, "mode"); libraryGeneration = required(root, "libraryGeneration");
        rate = (float)root.getDouble("rate"); authored = true;
    }
    JSONObject descriptor(int position) { return store == null ? descriptors.get(units.get(position).id()) : store.descriptor(position); }
    private static String required(JSONObject row, String key) throws JSONException {
        String value = row.getString(key); if (value.trim().isEmpty()) throw new JSONException("Missing " + key); return value;
    }
    private static long number(JSONObject row, String key, long minimum) throws JSONException {
        double value = row.getDouble(key);
        if (!Double.isFinite(value) || value != Math.floor(value) || value < minimum || value > 9007199254740991L) throw new JSONException("Invalid " + key);
        return (long) value;
    }
    // Only the requested segment becomes a String/Action. No whole-session speech expansion.
    static final class StepActions extends AbstractList<PlaybackEngine.Action> {
        final String question, answer; final long recall;
        final int[] q, a;
        StepActions(String question, String answer, long recall) { this.question = question; this.answer = answer; this.recall = recall; q = boundaries(question); a = boundaries(answer); }
        static int[] boundaries(String text) {
            List<Integer> ends = new ArrayList<>(); ends.add(0);
            for (int start = 0; start < text.length();) {
                int end = start; for (int n = 0; n < 400 && end < text.length(); n++) end += Character.charCount(text.codePointAt(end));
                if (end < text.length()) for (int i = end; i > start + (end - start) / 2; i--) if (Character.isWhitespace(text.charAt(i - 1))) { end = i; break; }
                ends.add(end); start = end;
            }
            int[] values = new int[ends.size()]; for (int i = 0; i < values.length; i++) values[i] = ends.get(i); return values;
        }
        public int size() { return q.length + a.length - 1; }
        public PlaybackEngine.Action get(int index) {
            int questions = q.length - 1;
            if (index == questions) return new PlaybackEngine.Action("wait", "", recall, "Recall");
            boolean first = index < questions; int n = first ? index : index - questions - 1;
            String text = first ? question : answer; int[] ends = first ? q : a;
            return new PlaybackEngine.Action("speak", text.substring(ends[n], ends[n+1]), 0, first ? "Question" : "Answer");
        }
    }
    // Exact substrings, never trim or rewrite authored text; small TTS requests at any supported rate.
    static void segment(String text, String label, List<PlaybackEngine.Action> actions) {
        for (int start = 0; start < text.length();) {
            int end = start;
            for (int count = 0; count < 400 && end < text.length(); count++) end += Character.charCount(text.codePointAt(end));
            if (end < text.length()) for (int i = end; i > start + (end - start) / 2; i--) {
                if (Character.isWhitespace(text.charAt(i - 1))) { end = i; break; }
            }
            actions.add(new PlaybackEngine.Action("speak", text.substring(start, end), 0, label)); start = end;
        }
    }
}
