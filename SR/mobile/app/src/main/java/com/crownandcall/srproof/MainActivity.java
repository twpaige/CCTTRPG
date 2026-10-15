package com.crownandcall.srproof;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import android.speech.tts.*;
import android.webkit.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://sr.invalid/";
    private static final Set<String> ASSETS = new HashSet<>(Arrays.asList("index.html", "mobile.js", "shared/sample.js", "shared/speech.css", "shared/playback-plan.js",
        "data/index.html", "data/panel.js", "data/files.js", "poc/speech.css", "js/db.js", "js/repository.js", "js/validation.js", "js/backup.js", "js/scheduler.js", "js/mastery.js", "js/native-study.js"));
    private static final int OPEN_BACKUP = 30, SAVE_BACKUP = 31, MAX_BACKUP = 32 * 1024 * 1024;
    private String pendingBackup;
    private android.net.Uri incomingBackup;
    private boolean filePending;
    private WebView web;
    private TextToSpeech inventory;
    private volatile String voices = "[]", voiceMessage = "Loading Android TTS voices…", bridgeError = "";
    private boolean visible;
    private long inventoryGeneration;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try { PlaybackService.initializeStorage(getFilesDir()); } catch (IOException error) { bridgeError = error.getMessage(); }
        web = new WebView(this);
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            }
            return insets;
        });
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "SRNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return !request.isForMainFrame() || !(url.equals(ORIGIN + "index.html") || url.equals(ORIGIN + "data/index.html"));
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                String path = url.startsWith(ORIGIN) ? url.substring(ORIGIN.length()) : "";
                try {
                    if (!ASSETS.contains(path)) return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
                    String type = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : "text/html";
                    return new WebResourceResponse(type, "UTF-8", getAssets().open(path));
                } catch (IOException error) { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0])); }
            }
        });
        web.loadUrl(ORIGIN + "index.html");
        refreshVoices();
    }
    private void refreshVoices() {
        long generation = ++inventoryGeneration;
        if (inventory != null) inventory.shutdown();
        voices = "[]";
        voiceMessage = "Loading Android TTS voices…";
        inventory = new TextToSpeech(this, result -> new Handler(Looper.getMainLooper()).post(() -> {
            if (isDestroyed() || generation != inventoryGeneration || inventory == null) return;
            if (result != TextToSpeech.SUCCESS) {
                voiceMessage = "TTS initialization failed. Check Android TTS settings.";
                inventory.shutdown(); inventory = null; return;
            }
            JSONArray list = new JSONArray();
            Set<Voice> available = inventory.getVoices();
            if (available != null) for (Voice voice : available) {
                if (!voice.getLocale().getLanguage().equals("en") || voice.isNetworkConnectionRequired()
                    || (voice.getFeatures() != null && voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))) continue;
                try { list.put(new JSONObject().put("name", voice.getName()).put("language", voice.getLocale().toLanguageTag())); }
                catch (JSONException error) { bridgeError = error.getMessage(); }
            }
            voices = list.toString();
            voiceMessage = list.length() == 0 ? "No installed offline English voice. Install voice data in Android TTS settings, then Refresh." : "Offline-capable English voices found. Airplane-mode listening is still required.";
            inventory.shutdown(); inventory = null;
        }));
    }
    private void startPlan(String json) {
        if (!visible || filePending || PlaybackService.prepared != null || PlaybackService.instance != null || PlaybackService.launching || PlaybackService.completions.size() != 0) { bridgeError = "Stop playback and save queued progress before starting a new session."; return; }
        try {
            PlaybackService.preparedPlan = new Plan(json);
            PlaybackService.launching = true;
            bridgeError = "";
            startForegroundService(new Intent(this, PlaybackService.class).setAction("START"));
        } catch (Exception error) { PlaybackService.launching = false; PlaybackService.preparedPlan = null; bridgeError = "Start failed: " + error.getMessage(); }
    }
    private final class Bridge {
        @JavascriptInterface public String status() {
            try {
                boolean running = PlaybackService.instance != null;
                SessionStore prepared = PlaybackService.prepared;
                JSONObject result = running ? new JSONObject(PlaybackService.snapshot) : new JSONObject().put("status", "stopped");
                android.content.SharedPreferences prefs = getSharedPreferences(PlaybackService.PREFS, MODE_PRIVATE);
                return result.put("prepared", prepared != null).put("preparedCount", prepared == null ? 0 : prepared.size()).put("serviceRunning", running || PlaybackService.launching).put("queuedCount", PlaybackService.completions.size()).put("queueLimit", CompletionQueue.LIMIT).put("voices", new JSONArray(voices)).put("voiceMessage", voiceMessage)
                    .put("bridgeError", bridgeError).put("android", Build.VERSION.RELEASE)
                    .put("webview", WebView.getCurrentWebViewPackage() == null ? "unknown" : WebView.getCurrentWebViewPackage().versionName)
                    .put("lastStatus", new JSONObject(prefs.getString("lastStatus", "{}")))
                    .put("completions", new JSONArray(prefs.getString("completions", "[]"))).toString();
            } catch (JSONException error) { return "{\"status\":\"error\",\"bridgeError\":\"Invalid diagnostic state\"}"; }
        }
        @JavascriptInterface public void start(String json) {
            if (json == null || json.getBytes(StandardCharsets.UTF_8).length > Plan.MAX_BYTES) { bridgeError = "Selected session exceeds 16 MiB; choose a smaller series. Nothing truncated."; return; }
            runOnUiThread(() -> {
                if (!visible) return;
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
                } else startPlan(json);
            });
        }
        @JavascriptInterface public void command(String action) {
            runOnUiThread(() -> {
                if (!visible) return;
                if (PlaybackService.instance != null) PlaybackService.instance.command(action);
                else if ("STOP".equals(action)) { String error = PlaybackService.session("abort", ""); if (!error.isEmpty()) bridgeError = error; }
            });
        }
        @JavascriptInterface public String session(String operation, String argument) {
            java.util.concurrent.FutureTask<String> task = new java.util.concurrent.FutureTask<>(() -> {
                if (!visible && !operation.equals("abort")) return "ERROR: Return to SR to prepare or change the session.";
                if (filePending) return "ERROR: Finish file transfer first.";
                if (operation.equals("play")) {
                    if (PlaybackService.instance != null || PlaybackService.launching || PlaybackService.prepared == null || PlaybackService.completions.size() != 0) return "ERROR: Prepare and save pending progress before PLAY.";
                    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) { requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1); return "ERROR: Enable notifications, then press PLAY."; }
                    try { PlaybackService.preparedPlan = new Plan(PlaybackService.prepared); PlaybackService.launching = true; bridgeError = ""; startForegroundService(new Intent(MainActivity.this, PlaybackService.class).setAction("START")); return ""; }
                    catch (Exception error) { PlaybackService.launching = false; return "ERROR: " + error.getMessage(); }
                }
                return PlaybackService.session(operation, argument);
            });
            runOnUiThread(task);
            try { return task.get(30, java.util.concurrent.TimeUnit.SECONDS); }
            catch (Exception error) { task.cancel(false); return "ERROR: Session operation did not finish. Stop and prepare again."; }
        }
        @JavascriptInterface public void refresh() { runOnUiThread(() -> { if (visible) refreshVoices(); }); }
        @JavascriptInterface public String completions() { return "[" + String.join(",", PlaybackService.completions.batch()) + "]"; }
        @JavascriptInterface public boolean acknowledge(String id) { return PlaybackService.completions.acknowledge(id); }
        @JavascriptInterface public String queueMastery(String json) {
            java.util.concurrent.FutureTask<String> task = new java.util.concurrent.FutureTask<>(() -> {
                if (!visible || PlaybackService.instance == null) return "No active session.";
                return PlaybackService.instance.queueMastery(json);
            });
            runOnUiThread(task);
            try { return task.get(5, java.util.concurrent.TimeUnit.SECONDS); }
            catch (Exception error) { task.cancel(false); return "Mastery request did not complete. Keep playback paused and retry."; }
        }
        @JavascriptInterface public void openBackup() { runOnUiThread(() -> chooseBackup(null)); }
        @JavascriptInterface public void saveBackup(String json) { runOnUiThread(() -> chooseBackup(json)); }
    }
    private void fileResult(JSONObject result) {
        if (!isDestroyed()) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('sr-file-result',{detail:" + result.toString() + "}));", null);
    }
    private void fileError(String message) {
        try { fileResult(new JSONObject().put("error", message)); } catch (JSONException ignored) { }
    }
    private void chooseBackup(String json) {
        if (!visible || filePending) return;
        if (PlaybackService.instance != null || PlaybackService.launching || PlaybackService.prepared != null || PlaybackService.completions.size() != 0) { fileError("Stop playback and return to Listening to save queued progress before transferring backups."); return; }
        if (json != null && json.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP) { fileError("Backup exceeds 32 MiB."); return; }
        Intent intent = new Intent(json == null ? Intent.ACTION_OPEN_DOCUMENT : Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE).setType("application/json");
        if (json != null) {
            // Hint only: OPEN_DOCUMENT grants no write access to its parent.
            if (incomingBackup != null) intent.putExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI, incomingBackup);
            android.content.SharedPreferences names = getSharedPreferences("backup_names", MODE_PRIVATE);
            Date now = new Date(); String base = BackupDocument.name(now, 0);
            int suffix = base.equals(names.getString("last", "")) ? names.getInt("suffix", 0) + 1 : 0;
            names.edit().putString("last", base).putInt("suffix", suffix).apply();
            intent.putExtra(Intent.EXTRA_TITLE, BackupDocument.name(now, suffix));
        }
        pendingBackup = json; filePending = true;
        try { startActivityForResult(intent, json == null ? OPEN_BACKUP : SAVE_BACKUP); }
        catch (ActivityNotFoundException error) { pendingBackup = null; filePending = false; fileError("No document picker is available."); }
    }
    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != OPEN_BACKUP && code != SAVE_BACKUP) return;
        String output = pendingBackup; pendingBackup = null;
        if (result != RESULT_OK || data == null || data.getData() == null) {
            filePending = false;
            try { fileResult(new JSONObject().put("cancelled", true)); } catch (JSONException ignored) { }
            return;
        }
        android.net.Uri uri = data.getData();
        new Thread(() -> {
            try {
                JSONObject response = new JSONObject();
                if (code == SAVE_BACKUP) {
                    if (output == null) throw new IOException("Backup interrupted. Export again; local library was not changed.");
                    BackupDocument.save(output.getBytes(StandardCharsets.UTF_8),
                        () -> getContentResolver().openInputStream(uri),
                        () -> getContentResolver().openOutputStream(uri, "wt"));
                    String filename;
                    try (android.database.Cursor cursor = getContentResolver().query(uri, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                        if (cursor == null || !cursor.moveToFirst() || cursor.isNull(0)) throw new IOException("Backup written but its filename could not be verified.");
                        filename = cursor.getString(0);
                    }
                    response.put("saved", true).put("verified", true).put("filename", filename);
                } else {
                    try (InputStream stream = getContentResolver().openInputStream(uri); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                        if (stream == null) throw new IOException("Cannot open input file.");
                        byte[] buffer = new byte[8192]; int count;
                        while ((count = stream.read(buffer)) != -1) {
                            if (bytes.size() + count > MAX_BACKUP) throw new IOException("Backup exceeds 32 MiB; nothing was changed.");
                            bytes.write(buffer, 0, count);
                        }
                        response.put("json", bytes.toString(StandardCharsets.UTF_8.name()));
                        incomingBackup = uri;
                    }
                }
                runOnUiThread(() -> { filePending = false; fileResult(response); });
            } catch (Exception error) { runOnUiThread(() -> { filePending = false; fileError("File transfer failed: " + error.getMessage()); }); }
        }, "SR-backup-file").start();
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 1) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) bridgeError = "Notification permission granted. Press PLAY to begin.";
            else bridgeError = "Notification permission is needed for this proof's locked-screen controls. Enable it in app settings, then PLAY.";
        }
    }
    @Override protected void onResume() { super.onResume(); visible = true; if (web != null) web.onResume(); }
    @Override protected void onPause() { visible = false; if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() {
        inventoryGeneration++;
        if (inventory != null) inventory.shutdown();
        if (web != null) { web.removeJavascriptInterface("SRNative"); web.destroy(); }
        super.onDestroy();
    }
}
