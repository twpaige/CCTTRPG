# SR Stage 2 — Windows build, installation and phone test

This is a fixed-sample Android listening proof. G2 is **BLOCKED** until the owner's phone passes the checks in `TEST_RESULTS.md`. G1 remains open independently. No Stage 3 functionality is included.

## What is being tested

The Android project is `SR/mobile/`. It packages the existing desktop sample and stylesheet, a shared JavaScript action-plan builder, and a small HTML interface. JavaScript defines question → recall → answer order. Android's platform TextToSpeech and a foreground service execute the prepared actions, including recall timers, while the WebView is inactive. No prerecorded audio, cloud speech dependency, or native flashcard database is used.

**Packaging decision:** the build plan suggested a local Capacitor plugin. This proof uses a plain Android WebView with one local JavaScript bridge instead, eliminating the Capacitor/Node dependency for APK builds. It preserves the proposed JavaScript plan/native executor boundary. The actual phone's Web Speech availability is still unverified; the included capability probe records it. The native route is prepared because API presence alone would not establish reliable locked-screen JavaScript progression. This is a packaging simplification, not evidence that Android feasibility has passed.

The existing desktop proof continues using browser `speechSynthesis`, including Google UK English Male when available. Its application files are unchanged.

## 1. Install Android Studio on your Windows computer

These steps apply to **your own computer**. They do not assume it has the agent's development tools or checkout paths.

1. Download Android Studio from [the official installation page](https://developer.android.com/studio/install) and run the Windows installer. Complete its setup wizard. Read and accept any SDK license terms yourself.
2. Open **More Actions → SDK Manager** from the welcome screen, or **Tools → SDK Manager** inside Studio. Note the displayed **Android SDK Location**; it is often `%LOCALAPPDATA%\Android\Sdk`, but use the actual path shown.
3. In **SDK Platforms**, install **Android 15 / API 35 → Android SDK Platform 35**. In **SDK Tools**, enable **Show Package Details** and install **Android SDK Build-Tools 35.0.0**, **Android SDK Platform-Tools**, and **Android SDK Command-line Tools (latest)**. An emulator, system image, NDK and CMake are unnecessary for this physical-phone proof.
4. Obtain/update your `twpaige/CCTTRPG` checkout on `main`, preserving any unrelated local edits. Open **the `SR/mobile` directory** as the Android Studio project; do not create a new Empty Activity project.
5. Let Gradle sync finish. If Studio offers an Android Gradle Plugin upgrade, keep the checked-in version for this test. The project pins **AGP 8.9.2**, **Gradle 8.11.1**, **SDK/target 35**, and Java source level **17**. The minimum phone OS is Android 8 / API 26. See [AGP 8.9 requirements](https://developer.android.com/build/releases/agp-8-9-0-release-notes).
6. Under **Settings → Build, Execution, Deployment → Build Tools → Gradle**, choose a **JDK 17 or 21** for Gradle (Studio's bundled runtime is suitable if it is one of those versions). If a newer Studio bundles a later JDK, use Studio's Download JDK selector to obtain JDK 17. A separate system-wide Java installation is not required. The checked-in wrapper downloads Gradle; do not install Gradle globally.

The first sync/build needs Internet to fetch the build tools and plugins. The installed app's native listening test does not. Studio creates local SDK settings and build outputs; these are ignored by Git. Node is only needed to rerun the JavaScript tests, not to package the APK.

## 2. Connect your phone

1. On the phone, open **Settings → About phone** and tap **Build number** seven times (some manufacturers put this under Software information). Enter your phone's unlock PIN if requested.
2. Open **Developer options** and enable **USB debugging**. Connect a **data-capable** USB cable to the computer. Unlock the phone and approve that computer's debugging authorization.
3. Select the phone in Android Studio's device selector. If it is missing, try a data cable/USB port and install the manufacturer's Windows USB driver if required. The [official physical-device guide](https://developer.android.com/studio/run/device) covers OEM drivers.
4. To inspect recognition in PowerShell, replace the SDK path below with the one from SDK Manager:

   ```powershell
   $srSdk = 'C:\path\to\Android\Sdk'
   & "$srSdk\platform-tools\adb.exe" devices
   ```

   Expect your serial number followed by `device`. `unauthorized` means unlock the phone and approve the debugging prompt. `offline` means reconnect/restart the device connection. If multiple devices appear, select the intended phone in Studio or add `-s YOUR_SERIAL` before each adb command. Do not install onto an unidentified device.

## 3. Build, install and open

The simplest route is Android Studio: select the **app** configuration and your phone, then click **Run** (green triangle). Studio builds, installs and opens **SR Speech Proof**. No Play Store account/publication is needed.

For a repeatable PowerShell build, open a terminal in your checkout's `SR/mobile` directory:

```powershell
# Use your actual JDK 17/21 path from Studio's Gradle settings.
$env:JAVA_HOME = 'C:\path\to\jdk-17'
.\gradlew.bat --no-daemon assembleDebug
```

Studio normally creates `local.properties` with the SDK location. If building before opening Studio, set `$env:ANDROID_HOME = $srSdk` in this terminal using the SDK Manager path above. These environment assignments affect this terminal and its child processes only.

A successful build produces:

```text
SR/mobile/app/build/outputs/apk/debug/app-debug.apk
```

The agent successfully built and signature-checked this APK locally. It is an ignored build output, not a GitHub download; building on your computer as above produces your own installable copy and debug signing key.

To install that APK manually, while still in `SR/mobile`:

```powershell
& "$srSdk\platform-tools\adb.exe" install -r '.\app\build\outputs\apk\debug\app-debug.apk'
& "$srSdk\platform-tools\adb.exe" shell am start -n com.crownandcall.srproof/.MainActivity
```

Wait for `BUILD SUCCESSFUL` and installation `Success`; neither message certifies sound or locked-screen behavior. On Android 13+, allow notifications when requested, then **press Start again**. This proof requires notifications so its background controls are visible. The notification may show the fixed sample card name on the lock screen.

## 4. Prepare an offline voice and try one pass

1. Update **Android System WebView/Chrome** through the phone's normal update mechanism if needed. This interface requires modern JavaScript modules and `crypto.randomUUID` (Chromium 92+); the installed WebView version appears in the app. A blank page is a failure to investigate, not permission to assume it works.
2. Open Android's **Text-to-speech output** settings (search Settings for that phrase). Select your installed preferred TTS engine, open its voice-data settings, and download/install an **English** voice. Menu names vary by phone/engine. Test the system's sample speech.
3. Open SR Speech Proof, press **Refresh voices**, and select an offline English voice or leave Automatic selected. Automatic prefers an installed UK English voice, then another English voice; it does not promise Google's desktop voice. If no suitable voice exists, install voice data and retry.
4. Expand **WebView capability probe** before starting native playback. Record `speechSynthesis` present/absent and voice count. If present with an English voice, press **Test one Web Speech question**, listen, and record the result. It times out after 15 seconds. API absence is an observed result, not a native-route failure. The probe is disabled during native playback.
5. Set recall **4 seconds**, rate **0.9**, passes **1**. Press **Start**. Listen through all three sample cards (1, 2 and 6 steps: 9 questions and 9 answers). No additional taps should be needed between steps/cards.
6. Exercise controls using the checklist below. **Pause** cancels speech; **Resume** repeats that utterance from the start. During recall, Resume waits the remaining interval. **Skip** skips the entire current card, without recording completion; paused Skip stays paused. **Restart** restarts the captured plan from its first card, with the same settings. To change settings, Stop then Start. After normal session completion, Start begins a new session.
7. While playing, open the notification shade: **Pause/Resume**, **Skip**, and **Stop** are available there. Restart is in the app. Lock-screen notification visibility/expansion depends on the phone's notification privacy settings.

An “offline-capable” label is not proof of offline speech. Airplane-mode testing is required. Calls, competing audio focus, and audio-output disconnection are intended to pause playback; reconnect/end the interruption, then press Resume. There is deliberately no automatic restart after an interruption or process death.

## 5. Physical-device acceptance checklist

Record date, phone model, Android version, WebView version, TTS engine/version, selected voice, earbud/headset model, settings, app commit, and observations. The **Device evidence** panel contains current status and the latest 200 completed-card entries. Copy its text into your test notes after failures and long runs. Completion entries reflect native callbacks; they do not prove sound reached your ears.

| ID | Test and expected result |
|---|---|
| A1 | Record WebView API inventory/probe result and compare with Android Chrome's desktop proof if available. Do not conflate Chrome and WebView. |
| A2 | Refresh voice inventory; start selected/automatic offline English voice. Confirm audible voice, orderly initialization and actionable missing-voice/error messages where reproducible. |
| A3 | Complete one pass hands-free: question ends → full recall interval → answer ends → next step/card. No overlap, omissions or extra taps. |
| A4 | Pause/Resume during question and answer; utterance repeats. With 10-second recall, pause about 3 seconds in, wait 5 seconds, Resume; about 7 seconds remain. |
| A5 | Stop during question, answer and recall; wait 15 seconds each. No further speech. Notification/service must end. Start a fresh session afterward. |
| A6 | Skip during speech/recall and while paused on a multi-step card; remaining steps are skipped. Restart during each phase; starts at first question and old callbacks do not advance it. |
| A7 | Twenty rapid Stop/Start and Pause/Resume/Skip/Restart cycles, using enabled controls. No simultaneous sessions, delayed old answers, stuck controls or lingering notification. |
| A8 | Pair Bluetooth earbuds/headset, select them as media output, start playback and lock. All dynamic speech reaches the headset and progression continues. No app Bluetooth permission is required: Android handles normal media routing. |
| A9 | With voice data installed, enable airplane mode, re-enable Bluetooth if needed, and start a fresh session. Speech and progression work offline. Restore normal connectivity afterward. |
| A10 | Receive a call or start another app's audio that takes focus. SR pauses rather than talking over it. Afterward it stays paused until explicit Resume. |
| A11 | Disconnect Bluetooth during speech and recall. SR pauses; reconnecting alone does not resume. Verify no unwanted speaker narration, then Resume through the headset. Record OEM-specific routing behavior. |
| A12 | Start, go Home, open another app, lock, then reopen SR. Same native session continues; returning to the WebView does not restart/duplicate speech. |
| A13 | Set passes to 30; perform **two uninterrupted 30-minute locked sessions**, at least one offline, using Bluetooth. Unplug USB before timing so a debugger/charging cable does not mask power behavior. Listen for stalls and wrong ordering; do not unlock or tap between questions. If 30 passes finish too early, use 100. Record start/end times and completion evidence after unlocking. |
| A14 | Use notification Pause/Resume/Skip/Stop with screen locked. Stop ends narration and removes the foreground notification. Test again after a background run. |
| A15 | After some completed cards, force-stop SR via Android App info, then relaunch. No automatic speech; prior completion evidence persists; interrupted/skipped card is not falsely completed. Start explicitly for a new session. Reinstall an update without uninstalling and verify diagnostic history persists. |

The current assignment requires at least one continuous 20–30-minute locked run; the build plan's stricter G2 gate asks for two 30-minute runs, so A13 retains that gate. A call/disconnect test is separate from the uninterrupted runs. Start with normal battery settings. If a device kills/stalls the service, record the exact behavior before considering an owner-approved device-specific battery exception. Do not claim all Android phones work based on one device.

Optional cleanup evidence after Stop (substitute your actual SDK path; these commands only inspect state):

```powershell
& "$srSdk\platform-tools\adb.exe" shell dumpsys activity services com.crownandcall.srproof
& "$srSdk\platform-tools\adb.exe" shell dumpsys power | Select-String 'SR:Playback'
```

Expect no running `PlaybackService` and no held `SR:Playback` wake lock after Stop. A stopped app process may remain cached; that is not a running playback service. Record output if it disagrees. If native initialization fails, Stop, correct engine/voice settings, then Start; Resume is only enabled once TTS is ready.

## 6. Rebuild and reinstall updates

Stop playback, update the checkout without overwriting personal edits, then Run in Studio again or repeat `assembleDebug` and `adb install -r`. The Gradle asset-copy task automatically packages the shared JavaScript/CSS; there is no manual sync step. Keep the same application ID and debug signing key. A different computer's debug key can cause `INSTALL_FAILED_UPDATE_INCOMPATIBLE`; preserve the original key or explicitly decide to remove the old proof installation, which deletes its diagnostic history. Do not routinely uninstall to update.

This proof stores only its last plan/status and a bounded completion journal, not a personal library or IndexedDB. Process death does not attempt automatic session recovery. A speech callback watchdog stops with an error after 120 seconds; recall is limited to 120 seconds. A 150-second wake lock is renewed at action boundaries and released on Pause, error, Stop and completion. Force-stop/OEM termination can still interrupt playback; physical evidence determines feasibility.

## 7. Repeat automated checks

From the repository root, with Node 22+ and a JDK 17+:

```powershell
node SR/tests/run.mjs
node SR/mobile/tests/plan.test.mjs
& .\SR\mobile\tests\run-native.ps1 -Jdk 'C:\path\to\jdk-17'
```

Expected: 33 desktop, 6 shared-plan and 16 native-executor tests. If PowerShell policy prevents running the local script, inspect it and use its two `javac`/`java` commands directly under your normal policy; no global policy change is required. These are silent unit tests, not phone tests.

Relevant platform references: [TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech), [utterance callbacks](https://developer.android.com/reference/android/speech/tts/UtteranceProgressListener), [media-playback foreground service](https://developer.android.com/develop/background-work/services/fgs/service-types#media), [audio focus](https://developer.android.com/media/optimize/audio-focus), and [local WebView content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content).

After installation, send the device/voice details and A1–A15 observations, especially any failures and both locked-session results. G2 remains blocked pending those observations. No Stage 3 work is authorized.
