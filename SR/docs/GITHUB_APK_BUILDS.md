# SR Android APKs from GitHub

After the one-time signing setup, GitHub builds the app and you install updates directly from your phone's browser. No Android Studio, USB cable, Play Store, paid service, or local build is needed for routine updates. This is Stage 2.5 only; the app and its application ID remain unchanged.

**Current signing status: owner setup required.** The workflow will test/build without secrets, then stop at its signing check. It never invents a replacement key. No signed GitHub release or successful phone update is claimed until those steps actually occur.

## Start here: preserve your existing signing key

You confirmed that your installed APK came from this chat's Stage 2 build. The original key was located on that build computer at:

```text
C:\Users\tpaig\.android\debug.keystore
```

The original APK's public signing certificate SHA-256 is:

```text
ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb
```

**Recommended strategy: retain this exact private key as the personal app's permanent signing identity.** “Debug” describes how it was originally created; the same key can sign a non-debuggable release APK. Copying it into a password-protected keystore changes its container/password, not the certificate. This should allow in-place updates without uninstalling or deleting app data; the phone test below must confirm it. Android requires a compatible signing identity for updates. [Android signing documentation](https://developer.android.com/studio/publish/app-signing)

Do not replace/regenerate the original file. Do not choose a new key merely because its label says Debug. A different key would normally require **uninstalling the current app, losing its local data**, before installing a replacement. This project does not implement key rotation or migration. No uninstall is authorized by these instructions.

## 1. Make and verify a secure backup (owner task)

Use a trusted computer with the original key. Keep signing material outside the repository. Never paste private keys/passwords into chat, issue comments, commits, release attachments, or workflow logs.

You need Java's `keytool` once. The portable JDK used for the Stage 2 build is already available on that build computer at:

```text
C:\Users\tpaig\Documents\Codex\2026-10-12\files-pasted-by-the-user-dex\work\CCTTRPG\SR\mobile\.tools\jdk\jdk-17.0.20.1+1\bin\keytool.exe
```

On another trusted computer, install a JDK 17 if needed; Android Studio is unnecessary. First securely transfer the original key to it. Merely cloning GitHub will not provide the private key.

1. Prepare a private folder on an encrypted drive/USB device, for example `E:\SR-Signing`. Substitute your actual folder; do not use a public/shared folder. Keep a second encrypted backup in a separate secure location.
2. Open PowerShell. Set the paths below to real locations, then import the original key into a new protected container. **If `SR-signing.p12` already exists, stop rather than overwrite it.**

   ```powershell
   $srKeytool = 'C:\path\to\jdk-17\bin\keytool.exe'
   $srOriginal = 'C:\Users\tpaig\.android\debug.keystore'
   $srSafe = 'E:\SR-Signing'
   if (Test-Path "$srSafe\SR-signing.p12") { throw 'Backup already exists; do not overwrite it.' }
   & $srKeytool -importkeystore -srckeystore $srOriginal -srcalias androiddebugkey -destkeystore "$srSafe\SR-signing.p12" -deststoretype PKCS12 -destalias sr-personal
   ```

   Enter a strong, unique **destination** password when prompted and save it in your password manager. The original Gradle debug keystore's standard source password is `android`; if that fails, stop and investigate rather than recreating it. Use the same new password for the PKCS12 store and imported key. Password prompts avoid placing your private password in shell history. Wait for a successful import.
3. Verify the protected copy:

   ```powershell
   & $srKeytool -list -v -keystore "$srSafe\SR-signing.p12" -alias sr-personal
   ```

   Enter the new password. Compare **SHA256** to the fingerprint above (ignore colons and letter case). Confirm the entry is a **PrivateKeyEntry**, not just a certificate. Record the expiry date. If it differs, **stop**: do not configure GitHub with that key. Preserve this key before its expiry; planned key rotation would be separate work.
4. Make the second encrypted copy. Test opening that backup with the same `keytool -list` command. Save the alias `sr-personal`, application ID `com.crownandcall.srproof`, fingerprint, and password in your password manager. The password and backups must remain accessible even if this computer or GitHub account is lost.

The known default password did not make the original private key public, but the protected copy should use your own password. Keep the original secure too. GitHub Secrets are for automation, **not your only backup**: GitHub cannot display a stored secret back to you later.

## 2. One-time GitHub configuration

Open [repository Actions settings](https://github.com/twpaige/CCTTRPG/settings/actions), enable GitHub Actions if disabled, and allow the official `actions/*` actions. The workflow grants only its publishing job `contents: write`; no personal access token is needed. If an organization policy blocks releases, resolve it as owner. This workflow runs only from `main`, never on pull requests or forks. Treat changes to its workflow/release scripts as changes that can access your signing key.

Open **Settings → Secrets and variables → Actions → Secrets → New repository secret** in [the repository](https://github.com/twpaige/CCTTRPG/settings/secrets/actions). Add:

| Secret name | Value |
|---|---|
| `SR_KEYSTORE_BASE64` | Base64 of your verified, protected `SR-signing.p12` (next command) |
| `SR_STORE_PASSWORD` | Your new PKCS12 password |
| `SR_KEY_PASSWORD` | The same password |
| `SR_KEY_ALIAS` | `sr-personal` |

To copy the keystore directly to the clipboard without displaying it or creating a Base64 file:

```powershell
Set-Clipboard -Value ([Convert]::ToBase64String([IO.File]::ReadAllBytes("$srSafe\SR-signing.p12")))
```

Use a trusted clipboard with history/cloud sync disabled for this operation. Paste directly into **SR_KEYSTORE_BASE64**, save the secret, then clear the clipboard with `Set-Clipboard -Value ''`. Base64 is encoding, not encryption. Do not put this value in a repository variable.

Now select the **Variables** tab → **New repository variable**:

| Variable name | Public value |
|---|---|
| `SR_SIGNING_CERT_SHA256` | `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb` |

The fingerprint is public; the key/passwords are secret. The workflow rejects a signed APK that does not match this fingerprint. Later releases must also match the previous published release's identity, even if this variable changes. Do not enable debug tracing or print secret environment variables while troubleshooting.

For this public repository, standard GitHub-hosted Actions runners require no paid service. If repository visibility/account usage changes, keep paid overage disabled and review GitHub's usage limits rather than enabling a paid runner. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## 3. Build from any computer (or your phone)

1. Open [Actions → SR Android APK](https://github.com/twpaige/CCTTRPG/actions/workflows/sr-android.yml).
2. Choose **Run workflow**, select **main**, then press the green **Run workflow** button. If the mobile layout hides it, request Desktop site in your browser.
3. Open the new run. `build` runs the 33 desktop tests, 6 shared-plan tests, 16 native executor tests and 6 release-safety tests, then compiles/lints the release APK. `publish` requires your signing configuration, signs and verifies it, and creates a GitHub Release.
4. Wait for both jobs to finish successfully. A passing `build` with failed `publish` is **not** an available signed release. The `unsigned-internal-*` Actions artifact is an intermediate file, not an installable download; it expires after one day.

Pushes to main automatically build when `SR/mobile` code/build/test files, shared `SR/js`, the packaged sample/CSS, Stage 1 tests, or this workflow change. Documentation-only and unrelated CCTTRPG changes do not trigger builds. The existing Gradle wrapper, AGP 8.9.2, JDK 17 and SDK/Build-Tools 35 are retained. The hosted runner supplies SDK command-line tools; the workflow installs the pinned components. No signing key is generated on the runner.

Each new run receives version code `100000 + run_number × 100 + run_attempt`, above the original version 1. Attempts 1–99 are supported. New runs increase the code; failed runs can leave gaps. The publication guard rejects versions older than/equal to the latest published SR version. If an old rerun is rejected, use **Run workflow** to create a new run. Do not delete/recreate this workflow to reset its counter. Do not delete release history or change signing identity to bypass the guard. Concurrent publication is serialized. A failed publication can leave a draft; start a new workflow run after fixing the problem, then remove an obsolete draft only after confirming it was never published.

## 4. Download and install on your Samsung phone

Open [GitHub Releases](https://github.com/twpaige/CCTTRPG/releases). Choose the latest **SR Android** release, expand **Assets**, and download **SR.apk**, not Source code or the checksum file.

Convenient latest-release link, once the first release exists:

**[Download latest SR.apk](https://github.com/twpaige/CCTTRPG/releases/latest/download/SR.apk)**

Each build also has an immutable version link: `https://github.com/twpaige/CCTTRPG/releases/download/sr-android-VERSION_CODE/SR.apk`, shown in its Actions summary. If this repository later publishes a different product as “Latest,” use the newest **SR Android** entry in Releases instead of the shortcut.

1. Tap the completed download in your browser/Downloads.
2. Android may ask you to allow **Install unknown apps** for the browser or file manager opening the APK. Grant that source permission only if you intend to install this APK. Samsung menu names depend on One UI version; return it to disallowed afterward if desired.
3. Android should offer **Update** for the existing SR Speech Proof app. Tap Update, then Open. **Do not uninstall first or clear app storage.** Your app data should remain.
4. If Samsung Auto Blocker, device policy, Play Protect, or another verification screen blocks installation, stop and record the exact message. This workflow does not bypass device protections. We can resolve the specific phone setting/approval with you; Google Play publication is not required by this project.

The APK is a release build with the same app ID and signing certificate. GitHub verifies its cryptographic signature, application ID, generated version code and expected public certificate. Before publishing, it downloads the uploaded APK and compares every byte to the local signed APK. Release assets include `build-info.json` and `SR.apk.sha256` for independent checks. None contains private credentials.

## 5. Verify updates preserve data (owner test — still BLOCKED)

Before the first update, complete a sample card in the installed Stage 2 app and record/screenshot its **Device evidence** completion entries. Stop playback. Install the signed GitHub APK over it, open the app and confirm the same entries remain and speech works. Record phone/Android version, old/new APK version codes, date, and observations. The app does not yet have a flashcard database; its diagnostic history is the available persistence check.

Then trigger another new workflow run, install the next higher version without uninstalling, and verify the same history again. This checks both local-debug → GitHub-release transition and subsequent GitHub → GitHub updates. A changed version/signature report or a downloaded APK alone cannot prove phone data retention. Stage 2's separate locked/Bluetooth/offline acceptance tests remain open until observed.

## Troubleshooting and recovery

- **Signing configuration missing:** add all four Secrets and the one public Variable after verifying your backups. Start a new workflow run. Never substitute an ephemeral debug key.
- **Wrong password/alias or certificate mismatch:** check the protected backup with `keytool -list`. Confirm alias/password and the fingerprint before updating Secrets. Do not change the expected fingerprint just to make a failure disappear.
- **“App not installed,” package/signature conflict, or downgrade:** compare the new release's `build-info.json` with the original fingerprint and installed version. Confirm this is the same app, with a higher version code. Keep the installed app/data; do not uninstall as a troubleshooting shortcut. A newer existing APK needs a newer build; a genuinely different key requires a deliberate migration/reset decision.
- **No release/latest link returns 404:** publishing has not succeeded, the repository is private and needs sign-in, or the newest repository release is unrelated. Inspect the run and the SR release entry. A missing-secret failure is expected before one-time setup.
- **Release API returns 403:** check Actions policies and permission to create releases. Use the built-in workflow token; do not put a personal token in source code.
- **Old run refused:** use Run workflow on main. Version codes must keep increasing. Do not lower the guard or install an older APK over newer data.
- **Key lost on one computer:** restore the verified encrypted backup and password, verify its certificate, then replace the GitHub Secrets. The signing identity remains the same.
- **Key/password lost everywhere:** an APK/public certificate cannot reconstruct the private key. GitHub does not reveal stored Secrets. Existing configured Actions may still sign, but that is not a backup strategy; do not rotate/reset the Secrets. If all usable copies/credentials are gone, seamless future updates cannot be promised. A new locally generated, backed-up key would require a separately approved transition, usually uninstalling and losing current local data. No Google Play signing-key recovery service is involved here.

The current task stops at owner-controlled backup/secret configuration. After you finish it, report that setup is complete (without sending passwords/keys), run the workflow, and provide the build/phone-update outcome. No Stage 3 work is included.
