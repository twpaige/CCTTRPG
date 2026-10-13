package com.crownandcall.srproof;

import org.json.*;
import java.util.*;

/** Strict bridge boundary; the native side accepts actions, not flashcard/review rules. */
final class Plan {
    final String sessionId, voiceName;
    final float rate;
    final List<PlaybackEngine.Unit> units = new ArrayList<>();
    Plan(String json) throws JSONException {
        if (json.length() > 900000) throw new JSONException("Plan too large for this proof.");
        JSONObject root = new JSONObject(json);
        if (root.getInt("version") != 1) throw new JSONException("Unsupported plan version");
        sessionId = root.getString("sessionId"); voiceName = root.getString("voiceName");
        rate = (float) root.getDouble("rate");
        if (sessionId.isEmpty() || sessionId.length() > 100 || !Float.isFinite(rate) || rate < .5 || rate > 2) throw new JSONException("Invalid session settings");
        JSONArray list = root.getJSONArray("units");
        if (list.length() == 0 || list.length() > 300) throw new JSONException("Use 1–100 sample passes");
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < list.length(); i++) {
            JSONObject unit = list.getJSONObject(i); String id = unit.getString("id");
            if (!ids.add(id)) throw new JSONException("Duplicate unit ID");
            List<PlaybackEngine.Action> actions = new ArrayList<>();
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
}
