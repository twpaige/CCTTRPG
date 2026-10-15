package com.crownandcall.srproof;

import android.app.*;
import android.content.*;
import android.media.*;
import android.os.*;
import android.speech.tts.*;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class PlaybackService extends Service implements PlaybackEngine.Host {
    static volatile PlaybackService instance;
    static volatile String snapshot = "{\"status\":\"idle\"}";
    static final CompletionQueue completions = new CompletionQueue();
    static volatile Plan preparedPlan;
    static volatile boolean launching;
    static volatile long stopGeneration;
    static volatile SessionStore prepared;
    static SessionStore draft, update;
    static java.io.File runtimeDirectory;
    static int updateAt;
    static void initializeStorage(java.io.File base) throws java.io.IOException {
        if (runtimeDirectory != null) return;
        java.io.File directory = new java.io.File(base, "prepared-runtime");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new java.io.IOException("Temporary storage unavailable.");
        java.io.File[] old = directory.listFiles();
        if (old != null) for (java.io.File file : old) if (!file.delete()) throw new java.io.IOException("Cannot clean abandoned temporary session.");
        completions.enableOverflow(new java.io.File(directory, "completions.tmp")); runtimeDirectory = directory;
    }
    static void discardPrepared() throws java.io.IOException {
        if (draft != null) { draft.close(); draft = null; }
        if (update != null) { update.close(); update = null; }
        if (prepared != null) { prepared.close(); prepared = null; }
    }
    static String session(String operation, String argument) {
        try {
            PlaybackService service = instance;
            boolean statusSession = service != null && service.plan != null ? service.plan.statusOnly : preparedPlan != null && preparedPlan.statusOnly;
            switch (operation) {
                case "pause": if (service != null) service.command("PAUSE"); return "";
                case "cancelEdit":
                    if (service == null || !service.plan.sessionId.equals(argument) || !service.engine.status.equals("paused")) throw new IllegalStateException("Session changed.");
                    service.refreshRequired = false; service.changed(); return "";
                case "begin":
                    if (((service != null || launching) && !statusSession) || completions.size() != 0) throw new IllegalStateException("Stop and save pending progress first.");
                    discardPrepared(); draft = new SessionStore(runtimeDirectory, new JSONObject(argument)); return "";
                case "part": if (draft == null) throw new IllegalStateException("No preparation in progress."); draft.part(argument); return "";
                case "step": if (draft == null) throw new IllegalStateException("No preparation in progress."); draft.finishUnit(); return "";
                case "finish": if (draft == null) throw new IllegalStateException("No preparation in progress."); draft.seal(); prepared = draft; draft = null; return "";
                case "abort": if (service != null && !statusSession) throw new IllegalStateException("Stop playback first."); discardPrepared(); return "";
                case "manifest": if (prepared == null) throw new IllegalStateException("Prepare a session first."); return prepared.manifest(Integer.parseInt(argument)).toString();
                case "edit":
                    JSONObject edit = new JSONObject(argument);
                    if (service == null || service.plan.store == null || !service.engine.status.equals("paused") || !service.plan.sessionId.equals(edit.getString("sessionId"))) throw new IllegalStateException("Session changed before mastery save.");
                    service.advanceAfter = Integer.parseInt(service.plan.units.get(service.engine.unitIndex).id());
                    if (edit.optBoolean("skipCard")) {
                        String card = service.plan.units.get(service.engine.unitIndex).cardId();
                        for (int i = service.engine.unitIndex + 1; i < prepared.size() && prepared.get(i).cardId().equals(card); i++) service.advanceAfter = Integer.parseInt(prepared.get(i).id());
                    }
                    service.focusRecovery.cancel(); service.refreshRequired = true; service.changed(); return "";
                case "updateBegin":
                    if (service == null || !service.refreshRequired || !service.engine.status.equals("paused")) throw new IllegalStateException("Session is not paused for a mastery update.");
                    if (update != null) update.close(); update = new SessionStore(runtimeDirectory, prepared.header, prepared.finished); updateAt = 0; return "";
                case "updateStep":
                    if (update == null || service == null || !service.refreshRequired) throw new IllegalStateException("Session update was interrupted.");
                    update.copyUpdated(prepared, updateAt++, new JSONObject(argument)); return "";
                case "updateFinish":
                    if (update == null || service == null || !service.refreshRequired || updateAt != prepared.size()) throw new IllegalStateException("Incomplete session update.");
                    if (update.size() == 0) { service.command("STOP"); return ""; }
                    update.seal();
                    int after = service.advanceAfter;
                    SessionStore previous = prepared; prepared = update; update = null;
                    service.plan = new Plan(prepared); service.engine.revise(prepared, after);
                    previous.close(); service.refreshRequired = false; service.changed(); return "";
                default: throw new IllegalArgumentException("Unknown session operation.");
            }
        } catch (Exception error) { return "ERROR: " + error.getMessage(); }
    }
    static final String CHANNEL = "sr_playback", PREFS = "stage2_evidence";
    private final Handler control = new Handler(Looper.getMainLooper());
    private final Handler actions = new Handler(Looper.getMainLooper());
    private PlaybackEngine engine;
    private TextToSpeech tts;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private final FocusRecovery focusRecovery = new FocusRecovery();
    private PowerManager.WakeLock wake;
    private Plan plan;
    private boolean ready, destroyed, pendingPause, hasFocus;
    private String selectedVoice = "", interruption = "";
    private long initialization;
    private int restartCount;
    private long occurrence, stepStartedAt;
    private String occurrenceId;
    private JSONObject pendingMastery;
    private boolean refreshRequired;
    private int advanceAfter;
    private long controlGeneration;
    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent intent) { interrupt("Audio output disconnected. Reconnect, then Resume."); }
    };
    @Override public void onCreate() {
        super.onCreate(); instance = this;
        engine = new PlaybackEngine(this);
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attributes)
            .setWillPauseWhenDucked(true).setOnAudioFocusChangeListener(this::focusChanged, control).build();
        wake = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SR:Playback");
        wake.setReferenceCounted(false);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel(CHANNEL, "SR playback", NotificationManager.IMPORTANCE_LOW));
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), RECEIVER_EXPORTED);
        else registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String command = intent == null ? "STOP" : intent.getAction();
        if ("START".equals(command)) {
            if (plan != null) return START_NOT_STICKY; // Ignore repeated Start.
            startForeground(1, notification("Initializing speech…"));
            try {
                plan = preparedPlan; preparedPlan = null; launching = false;
                if (plan == null) throw new IllegalStateException("No prepared session. Open SR and press Start.");
                engine.start(plan.units, true, plan.store != null || plan.mode.equals("AUDIT"),
                    plan.store != null ? Collections.singletonList("Starting playlist.") : plan.intro, plan.store != null);
                long init = ++initialization;
                control.postDelayed(() -> { if (!ready && !destroyed && init == initialization) engine.fail("TTS initialization timed out. Stop and try again."); }, 15000);
                tts = new TextToSpeech(this, status -> control.post(() -> initializeTts(status, init)));
            } catch (Exception error) { launching = false; engine.fail("Cannot start: " + error.getMessage()); shutdown(); }
        } else if (plan == null) shutdown();
        else command(command);
        return START_NOT_STICKY;
    }
    private void initializeTts(int result, long init) {
        if (destroyed || init != initialization || !engine.status.equals("paused")) return;
        if (result != TextToSpeech.SUCCESS) { engine.fail("Android TTS initialization failed. Check the installed engine."); return; }
        Set<Voice> available = tts.getVoices();
        List<Voice> english = new ArrayList<>();
        if (available != null) for (Voice v : available) {
            if (v.getLocale().getLanguage().equals("en") && !v.isNetworkConnectionRequired()
                && (v.getFeatures() == null || !v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))) english.add(v);
        }
        english.sort(Comparator.comparing(Voice::getName));
        Voice choice = null;
        for (Voice v : english) if (v.getName().equals(plan.voiceName)) choice = v;
        if (choice == null && !plan.voiceName.isEmpty()) { engine.fail("Selected offline voice is unavailable. Stop, refresh voices, then Start."); return; }
        if (choice == null) for (Voice v : english) if (v.getLocale().getCountry().equals("GB")) { choice = v; break; }
        if (choice == null && !english.isEmpty()) choice = english.get(0);
        if (choice == null || tts.setVoice(choice) != TextToSpeech.SUCCESS) { engine.fail("No installed offline English voice. Install English voice data in Android TTS settings, then Stop/Start."); return; }
        selectedVoice = choice.getName();
        if (tts.setSpeechRate(plan.rate) != TextToSpeech.SUCCESS || tts.setPitch(1f) != TextToSpeech.SUCCESS) { engine.fail("TTS settings were rejected."); return; }
        tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { control.post(() -> { if (!destroyed) engine.done(Long.parseLong(id)); }); }
            @Override public void onError(String id) { onError(id, -1); }
            @Override public void onStop(String id, boolean interrupted) { control.post(() -> { if (!destroyed) engine.failed(Long.parseLong(id), "Speech interrupted. Resume retries the unfinished segment."); }); }
            @Override public void onError(String id, int error) { control.post(() -> { if (!destroyed) engine.failed(Long.parseLong(id), "TTS error " + error + ". Resume retries; Stop ends the service."); }); }
        });
        ready = true;
        if (!pendingPause) resumePlayback();
        else { engine.message = interruption; changed(); }
    }
    void command(String command) {
        if (destroyed) return;
        if (!"RESUME".equals(command)) controlGeneration++;
        focusRecovery.cancel();
        if (engine.status.equals("paused")) releaseResources();
        try { switch (command == null ? "STOP" : command) {
            case "PAUSE": interrupt("Paused. Resume repeats interrupted speech; recall keeps remaining time."); break;
            case "RESUME": if (ready && !refreshRequired) resumePlayback(); break;
            case "SKIP": if (ready && !refreshRequired) { pendingMastery = null; engine.skip(); } break;
            case "NEXT_STEP": if (ready && !refreshRequired) { pendingMastery = null; engine.navigate(1, false); } break;
            case "PREVIOUS_STEP": if (ready && !refreshRequired) { pendingMastery = null; engine.navigate(-1, false); } break;
            case "PREVIOUS_FC": if (ready && !refreshRequired) { pendingMastery = null; engine.navigate(-1, true); } break;
            case "RESTART":
                if (ready && plan != null && !plan.authored) { restartCount++; engine.start(plan.units, true); pendingPause = false; resumePlayback(); } break;
            case "STOP":
                stopGeneration++; preparedPlan = null; launching = false; pendingMastery = null; engine.stop();
                try { discardPrepared(); } catch (java.io.IOException error) { engine.fail("Session cleanup failed: " + error.getMessage()); }
                break;
        } } catch (RuntimeException error) { engine.fail("Playback control failed: " + error.getMessage()); }
    }
    private void resumePlayback() {
        focusRecovery.cancel();
        if (!ready || engine.status.equals("playing")) return;
        if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { engine.fail("Audio focus denied. End the call/other playback and Resume."); return; }
        hasFocus = true; pendingPause = false; engine.resume();
    }
    private void interrupt(String reason) {
        controlGeneration++;
        focusRecovery.cancel();
        pendingPause = true; interruption = reason;
        engine.pause(reason);
        if (!engine.status.equals("playing")) releaseResources();
        engine.message = reason; changed();
    }
    private void focusChanged(int change) {
        if (destroyed || !ready) return;
        FocusRecovery.Action action = focusRecovery.change(change, engine.status.equals("playing"), engine.status.equals("paused"));
        if (action == FocusRecovery.Action.PAUSE) {
            if (focusRecovery.waiting()) engine.pause("Brief audio interruption. Playback resumes when audio focus returns.");
            else interrupt("Audio focus lost (call or another app). Resume when ready.");
        } else if (action == FocusRecovery.Action.RESUME && !refreshRequired) {
            pendingPause = false; engine.resume();
        }
    }
    @Override public long now() { return SystemClock.elapsedRealtime(); }
    @Override public void speak(String text, long token) {
        if (text.trim().isEmpty()) { actions.post(() -> engine.done(token)); return; }
        if (text.length() > TextToSpeech.getMaxSpeechInputLength()) { engine.failed(token, "Text exceeds this TTS engine's input limit."); return; }
        actions.postDelayed(() -> engine.failed(token, "No speech completion after 120 seconds. Resume retries."), 120000);
        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, Long.toString(token));
        if (result == TextToSpeech.ERROR) engine.failed(token, "TTS rejected the utterance. Resume retries.");
    }
    @Override public void delay(long ms, Runnable done) {
        long deadline = now() + ms;
        Runnable tick = new Runnable() { public void run() {
            long left = Math.max(0, deadline - now());
            if (left == 0) { done.run(); return; }
            if (wake.isHeld()) wake.release(); wake.acquire(150000);
            actions.postDelayed(this, Math.min(left, 30000));
        }};
        actions.postDelayed(tick, Math.min(ms, 30000));
    }
    @Override public void cancel() { actions.removeCallbacksAndMessages(null); if (tts != null) tts.stop(); }
    @Override public boolean canBegin() {
        return !refreshRequired && (!plan.authored || completions.canFit(completionSize()));
    }
    private int completionSize() { return plan.descriptor(engine.unitIndex).toString().getBytes(StandardCharsets.UTF_8).length + JSONObject.quote(plan.libraryGeneration).getBytes(StandardCharsets.UTF_8).length + 2048; }
    @Override public void started(String id) { occurrenceId = Long.toString(++occurrence); stepStartedAt = System.currentTimeMillis(); pendingMastery = null; }
    String queueMastery(String json) {
        try {
            JSONObject choice = new JSONObject(json);
            if (plan == null || !plan.authored || !engine.status.equals("paused") || !engine.stepStarted() || refreshRequired || occurrenceId == null
                || !choice.getString("sessionId").equals(plan.sessionId) || !choice.getString("occurrenceId").equals(occurrenceId)
                || completions.size() != 0) throw new IllegalStateException("Step changed or progress remains unsaved; reopen and retry.");
            JSONObject descriptor = plan.descriptor(engine.unitIndex), action = choice.getJSONObject("action");
            if (!action.getString("type").equals("step") || !action.getString("cardId").equals(descriptor.getString("cardId"))
                || !action.getString("stepId").equals(descriptor.getString("stepId"))) throw new IllegalStateException("Wrong step");
            double level = action.getDouble("level"); if (level < 0 || level > 10 || level != Math.floor(level)) throw new IllegalStateException("Invalid mastery");
            if (!completions.canFit(json.getBytes(StandardCharsets.UTF_8).length + completionSize())) throw new IllegalStateException("Pending change is too large. Stop and apply mastery while stopped instead.");
            pendingMastery = choice; changed(); return "";
        } catch (Exception error) { return error.getMessage(); }
    }
    @Override public void completed(String id) {
        try {
            if (plan.authored) {
                JSONObject unit = plan.descriptor(engine.unitIndex);
                if (plan.store != null && !plan.store.needsCredit(id, unit, stepStartedAt)) return;
                String creditId = plan.store == null ? occurrenceId : "step:" + id;
                JSONObject row = new JSONObject().put("queueId", plan.sessionId + ":" + creditId)
                    .put("sessionId", plan.sessionId).put("occurrenceId", creditId).put("mode", plan.mode)
                    .put("libraryGeneration", plan.libraryGeneration).put("cardId", unit.getString("cardId"))
                    .put("stepId", unit.getString("stepId")).put("cardRevision", unit.getLong("cardRevision"))
                    .put("progressRevision", unit.getLong("progressRevision")).put("mastery", unit.getInt("mastery"))
                    .put("nextDueAt", unit.get("nextDueAt")).put("startedAt", stepStartedAt).put("completedAt", System.currentTimeMillis());
                if (pendingMastery != null) row.put("pending", pendingMastery);
                completions.add(row.getString("queueId"), row.toString());
                if (plan.store != null) plan.store.retained(id);
                if (pendingMastery != null) refreshRequired = true;
                pendingMastery = null;
                return;
            }
            android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            JSONArray prior = new JSONArray(prefs.getString("completions", "[]")), next = new JSONArray();
            for (int i = Math.max(0, prior.length() - 199); i < prior.length(); i++) next.put(prior.get(i));
            next.put(new JSONObject().put("sessionId", plan.sessionId + ":" + restartCount).put("unitId", id).put("completedAt", System.currentTimeMillis()));
            if (!prefs.edit().putString("completions", next.toString()).commit()) throw new IllegalStateException("Disk write failed");
        } catch (JSONException error) { throw new IllegalStateException(error); }
    }
    @Override public void changed() {
        if (!engine.status.equals("paused")) focusRecovery.cancel();
        if (engine.status.equals("playing")) {
            // Re-arm only at action boundaries; bounded even if a platform callback never arrives.
            if (wake.isHeld()) wake.release();
            wake.acquire(150000);
        } else releaseResources();
        try {
            PlaybackEngine.Action action = engine.action();
            snapshot = new JSONObject().put("status", ready ? engine.status : engine.status.equals("paused") ? "initializing" : engine.status)
                .put("ready", ready)
                .put("controlGeneration", controlGeneration)
                .put("statusOnly", plan != null && plan.statusOnly).put("announcing", engine.announcing())
                .put("autoResumePending", focusRecovery.waiting())
                .put("message", engine.message).put("unit", engine.unitIndex + 1).put("total", engine.unitCount())
                .put("card", engine.unitName()).put("action", action == null ? "" : action.label())
                .put("text", action == null ? "" : action.text()).put("voice", selectedVoice)
                .put("sessionId", plan == null ? "" : plan.sessionId).put("occurrenceId", occurrenceId == null || !engine.stepStarted() ? "" : occurrenceId)
                .put("mode", plan == null ? "" : plan.mode).put("refreshRequired", refreshRequired)
                .put("pendingMastery", pendingMastery == null ? JSONObject.NULL : pendingMastery.getJSONObject("action").getInt("level"))
                .put("step", !engine.announcing() && (engine.status.equals("playing") || engine.status.equals("paused")) && plan != null && plan.authored && engine.unitIndex < plan.units.size() ? plan.descriptor(engine.unitIndex) : JSONObject.NULL)
                .put("updatedAt", System.currentTimeMillis()).toString();
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("lastStatus", snapshot).apply();
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(1, notification(engine.status + (engine.announcing() ? " · Status" : " · Step " + (engine.unitIndex + 1))));
        } catch (JSONException error) { android.util.Log.e("SR", "Status encoding failed", error); }
    }
    private void releaseResources() {
        if (wake != null && wake.isHeld()) wake.release();
        // Retain the focus request only during a duckable interruption so GAIN can arrive.
        if (audio != null && hasFocus && !focusRecovery.waiting()) { hasFocus = false; audio.abandonAudioFocusRequest(focus); }
    }
    private Notification notification(String text) {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        boolean playing = engine != null && (engine.status.equals("playing") || focusRecovery.waiting());
        return new Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("SR Listening").setContentText(text).setContentIntent(open).setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE).setOngoing(true)
            .addAction(new Notification.Action.Builder(null, playing ? "Pause" : "Resume", pending(playing ? "PAUSE" : "RESUME", 1)).build())
            .addAction(new Notification.Action.Builder(null, "Skip", pending("SKIP", 2)).build())
            .addAction(new Notification.Action.Builder(null, "Stop", pending("STOP", 3)).build()).build();
    }
    private PendingIntent pending(String action, int id) { return PendingIntent.getService(this, id, new Intent(this, PlaybackService.class).setAction(action), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT); }
    @Override public void ended() { shutdown(); }
    private void shutdown() {
        focusRecovery.cancel();
        launching = false;
        cancel(); releaseResources(); ready = false;
        if (tts != null) { tts.shutdown(); tts = null; }
        if (plan == null || !plan.statusOnly) try { discardPrepared(); } catch (java.io.IOException error) { android.util.Log.e("SR", "Session cleanup failed", error); }
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    @Override public void onDestroy() {
        focusRecovery.cancel();
        destroyed = true; initialization++; control.removeCallbacksAndMessages(null);
        cancel(); releaseResources(); if (tts != null) tts.shutdown();
        unregisterReceiver(noisy); stopForeground(STOP_FOREGROUND_REMOVE); instance = null;
        if (plan == null || !plan.statusOnly) try { discardPrepared(); } catch (java.io.IOException error) { android.util.Log.e("SR", "Session cleanup failed", error); }
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
