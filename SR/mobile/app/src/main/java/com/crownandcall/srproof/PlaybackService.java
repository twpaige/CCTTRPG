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
    static final String CHANNEL = "sr_playback", PREFS = "stage2_evidence";
    private final Handler control = new Handler(Looper.getMainLooper());
    private final Handler actions = new Handler(Looper.getMainLooper());
    private PlaybackEngine engine;
    private TextToSpeech tts;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private PowerManager.WakeLock wake;
    private Plan plan;
    private boolean ready, destroyed, pendingPause, hasFocus;
    private String selectedVoice = "", interruption = "";
    private long initialization;
    private int restartCount;
    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent intent) { interrupt("Audio output disconnected. Reconnect, then Resume."); }
    };
    @Override public void onCreate() {
        super.onCreate(); instance = this;
        engine = new PlaybackEngine(this);
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attributes)
            .setWillPauseWhenDucked(true).setOnAudioFocusChangeListener(change -> {
                if (change < 0) interrupt("Audio focus lost (call or another app). Resume when ready.");
            }, control).build();
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
                plan = new Plan(new String(readPlan(), StandardCharsets.UTF_8));
                engine.start(plan.units, true);
                long init = ++initialization;
                control.postDelayed(() -> { if (!ready && !destroyed && init == initialization) engine.fail("TTS initialization timed out. Stop and try again."); }, 15000);
                tts = new TextToSpeech(this, status -> control.post(() -> initializeTts(status, init)));
            } catch (Exception error) { engine.fail("Cannot start: " + error.getMessage()); shutdown(); }
        } else command(command);
        return START_NOT_STICKY;
    }
    private byte[] readPlan() throws java.io.IOException {
        try (java.io.FileInputStream in = openFileInput("session.json"); java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = in.read(buffer)) != -1) { out.write(buffer, 0, count); if (out.size() > 900000) throw new java.io.IOException("Plan too large"); }
            return out.toByteArray();
        }
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
            @Override public void onError(String id, int error) { control.post(() -> { if (!destroyed) engine.failed(Long.parseLong(id), "TTS error " + error + ". Resume retries; Stop ends the service."); }); }
        });
        ready = true;
        if (!pendingPause) resumePlayback();
        else { engine.message = interruption; changed(); }
    }
    void command(String command) {
        if (destroyed) return;
        switch (command == null ? "STOP" : command) {
            case "PAUSE": interrupt("Paused. Resume repeats interrupted speech; recall keeps remaining time."); break;
            case "RESUME": if (ready) resumePlayback(); break;
            case "SKIP": if (ready) engine.skip(); break;
            case "RESTART":
                if (ready && plan != null) { restartCount++; engine.start(plan.units, true); pendingPause = false; resumePlayback(); } break;
            case "STOP": engine.stop(); break;
        }
    }
    private void resumePlayback() {
        if (!ready || engine.status.equals("playing")) return;
        if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { engine.fail("Audio focus denied. End the call/other playback and Resume."); return; }
        hasFocus = true; pendingPause = false; engine.resume();
    }
    private void interrupt(String reason) {
        pendingPause = true; interruption = reason;
        engine.pause(reason);
        if (!ready) { engine.message = reason; changed(); }
    }
    @Override public long now() { return SystemClock.elapsedRealtime(); }
    @Override public void speak(String text, long token) {
        if (text.length() > TextToSpeech.getMaxSpeechInputLength()) { engine.failed(token, "Text exceeds this TTS engine's input limit."); return; }
        actions.postDelayed(() -> engine.failed(token, "No speech completion after 120 seconds. Resume retries."), 120000);
        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, Long.toString(token));
        if (result == TextToSpeech.ERROR) engine.failed(token, "TTS rejected the utterance. Resume retries.");
    }
    @Override public void delay(long ms, Runnable done) { actions.postDelayed(done, ms); }
    @Override public void cancel() { actions.removeCallbacksAndMessages(null); if (tts != null) tts.stop(); }
    @Override public void completed(String id) {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            JSONArray prior = new JSONArray(prefs.getString("completions", "[]")), next = new JSONArray();
            for (int i = Math.max(0, prior.length() - 199); i < prior.length(); i++) next.put(prior.get(i));
            next.put(new JSONObject().put("sessionId", plan.sessionId + ":" + restartCount).put("unitId", id).put("completedAt", System.currentTimeMillis()));
            if (!prefs.edit().putString("completions", next.toString()).commit()) throw new IllegalStateException("Disk write failed");
        } catch (JSONException error) { throw new IllegalStateException(error); }
    }
    @Override public void changed() {
        if (engine.status.equals("playing")) {
            // Re-arm only at action boundaries; bounded even if a platform callback never arrives.
            if (wake.isHeld()) wake.release();
            wake.acquire(150000);
        } else releaseResources();
        try {
            PlaybackEngine.Action action = engine.action();
            snapshot = new JSONObject().put("status", ready ? engine.status : engine.status.equals("paused") ? "initializing" : engine.status)
                .put("ready", ready)
                .put("message", engine.message).put("unit", engine.unitIndex + 1).put("total", engine.unitCount())
                .put("card", engine.unitName()).put("action", action == null ? "" : action.label())
                .put("text", action == null ? "" : action.text()).put("voice", selectedVoice)
                .put("updatedAt", System.currentTimeMillis()).toString();
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("lastStatus", snapshot).apply();
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(1, notification(engine.status + " · " + engine.unitName()));
        } catch (JSONException error) { android.util.Log.e("SR", "Status encoding failed", error); }
    }
    private void releaseResources() {
        if (wake != null && wake.isHeld()) wake.release();
        if (audio != null && hasFocus) { hasFocus = false; audio.abandonAudioFocusRequest(focus); }
    }
    private Notification notification(String text) {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        boolean playing = engine != null && engine.status.equals("playing");
        return new Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("SR Speech Proof").setContentText(text).setContentIntent(open).setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_PUBLIC).setOngoing(true)
            .addAction(new Notification.Action.Builder(null, playing ? "Pause" : "Resume", pending(playing ? "PAUSE" : "RESUME", 1)).build())
            .addAction(new Notification.Action.Builder(null, "Skip", pending("SKIP", 2)).build())
            .addAction(new Notification.Action.Builder(null, "Stop", pending("STOP", 3)).build()).build();
    }
    private PendingIntent pending(String action, int id) { return PendingIntent.getService(this, id, new Intent(this, PlaybackService.class).setAction(action), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT); }
    @Override public void ended() { shutdown(); }
    private void shutdown() {
        cancel(); releaseResources(); ready = false;
        if (tts != null) { tts.shutdown(); tts = null; }
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    @Override public void onDestroy() {
        destroyed = true; initialization++; control.removeCallbacksAndMessages(null);
        cancel(); releaseResources(); if (tts != null) tts.shutdown();
        unregisterReceiver(noisy); stopForeground(STOP_FOREGROUND_REMOVE); instance = null;
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
