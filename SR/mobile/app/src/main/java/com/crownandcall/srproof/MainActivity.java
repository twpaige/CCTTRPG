package com.crownandcall.srproof;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import android.speech.tts.*;
import android.webkit.*;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://sr.invalid/";
    private static final Set<String> ASSETS = new HashSet<>(Arrays.asList("index.html", "mobile.js", "shared/sample.js", "shared/speech.css", "shared/playback-plan.js"));
    private WebView web;
    private TextToSpeech inventory;
    private volatile String voices = "[]", voiceMessage = "Loading Android TTS voices…", bridgeError = "";
    private boolean visible;
    private long inventoryGeneration;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
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
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "SRNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
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
        if (!visible || PlaybackService.instance != null) { bridgeError = "Stop the current service before starting a new session."; return; }
        try {
            new Plan(json); // Validate before writing or launching the service.
            AtomicFile file = new AtomicFile(new File(getFilesDir(), "session.json"));
            FileOutputStream out = file.startWrite();
            try { out.write(json.getBytes(StandardCharsets.UTF_8)); file.finishWrite(out); }
            catch (IOException error) { file.failWrite(out); throw error; }
            bridgeError = "";
            startForegroundService(new Intent(this, PlaybackService.class).setAction("START"));
        } catch (Exception error) { bridgeError = "Start failed: " + error.getMessage(); }
    }
    private final class Bridge {
        @JavascriptInterface public String status() {
            try {
                boolean running = PlaybackService.instance != null;
                JSONObject result = running ? new JSONObject(PlaybackService.snapshot) : new JSONObject().put("status", "stopped");
                android.content.SharedPreferences prefs = getSharedPreferences(PlaybackService.PREFS, MODE_PRIVATE);
                return result.put("serviceRunning", running).put("voices", new JSONArray(voices)).put("voiceMessage", voiceMessage)
                    .put("bridgeError", bridgeError).put("android", Build.VERSION.RELEASE)
                    .put("webview", WebView.getCurrentWebViewPackage() == null ? "unknown" : WebView.getCurrentWebViewPackage().versionName)
                    .put("lastStatus", new JSONObject(prefs.getString("lastStatus", "{}")))
                    .put("completions", new JSONArray(prefs.getString("completions", "[]"))).toString();
            } catch (JSONException error) { return "{\"status\":\"error\",\"bridgeError\":\"Invalid diagnostic state\"}"; }
        }
        @JavascriptInterface public void start(String json) {
            if (json == null || json.length() > 900000) return;
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
            });
        }
        @JavascriptInterface public void refresh() { runOnUiThread(() -> { if (visible) refreshVoices(); }); }
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 1) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) bridgeError = "Notification permission granted. Press Start to begin.";
            else bridgeError = "Notification permission is needed for this proof's locked-screen controls. Enable it in app settings, then Start.";
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
