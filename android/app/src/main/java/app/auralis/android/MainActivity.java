package app.auralis.android;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * AURALIS for Android: a secure WebView onto an AURALIS server.
 *
 * On first launch (or when the server can't be reached) a local setup page asks
 * for the server address. Only that server's origin loads inside the app; every
 * other link opens in the browser. The setup page talks to this activity through
 * the {@code auralis-setup://} URL scheme, honoured only while the setup page itself
 * is showing, so remote pages get no bridge at all.
 */
public class MainActivity extends Activity {

    private static final String SETUP_URL = "file:///android_asset/setup/index.html";
    private static final String SETUP_SCHEME = "auralis-setup";
    private static final String RELEASES_API = "https://api.github.com/repos/Edel1244/Auralis/releases?per_page=30";
    private static final String TAG_PREFIX = "android-v";
    private static final int FILE_CHOOSER = 1;

    private WebView web;
    private SharedPreferences prefs;
    private ValueCallback<Uri[]> fileCallback;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("auralis", MODE_PRIVATE);

        web = new WebView(this);
        web.setBackgroundColor(0xFF080B10);
        setContentView(web);
        applySystemBarInsets();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false); // file:///android_asset (the setup page) still works
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " AURALIS-Android/" + versionName());

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> download(url, userAgent, contentDisposition, mimeType));

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else openServer();

        main.postDelayed(this::checkForUpdates, 5000);
    }

    // ───────── navigation ─────────

    /** Edge-to-edge (Android 15+) draws under the system bars; pad the WebView so content stays visible. */
    private void applySystemBarInsets() {
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
    }

    private String serverOrigin() {
        return normalizeServer(prefs.getString("server", null));
    }

    private void openServer() {
        String origin = serverOrigin();
        if (origin == null) {
            showSetup("");
            return;
        }
        io.execute(() -> {
            String problem = probe(origin);
            main.post(() -> {
                if (problem == null) web.loadUrl(origin + "/home");
                else showSetup(problem);
            });
        });
    }

    private void showSetup(String reason) {
        String saved = prefs.getString("server", "");
        String q = "?server=" + Uri.encode(saved == null ? "" : saved)
                + "&reason=" + Uri.encode(reason)
                + "&version=" + Uri.encode(versionName())
                + "&lang=" + Uri.encode(Locale.getDefault().getLanguage());
        web.loadUrl(SETUP_URL + q);
    }

    private boolean onSetupPage() {
        String url = web.getUrl();
        return url != null && url.startsWith(SETUP_URL);
    }

    private boolean isInternal(Uri uri) {
        String origin = serverOrigin();
        return origin != null && origin.equals(originOf(uri));
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!"http".equals(scheme) && !"https".equals(scheme) && !"mailto".equals(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    /** Handles auralis-setup://connect?url=… from the setup page. */
    private void handleSetup(Uri uri) {
        if (!"connect".equals(uri.getHost())) return;
        String origin = normalizeServer(uri.getQueryParameter("url"));
        if (origin == null) {
            setupResult("invalid");
            return;
        }
        io.execute(() -> {
            String problem = probe(origin);
            main.post(() -> {
                if (problem != null) {
                    setupResult(problem);
                    return;
                }
                prefs.edit().putString("server", origin).apply();
                web.clearHistory();
                web.loadUrl(origin + "/home");
            });
        });
    }

    private void setupResult(String reason) {
        if (onSetupPage()) web.evaluateJavascript("window.auralisSetupResult && window.auralisSetupResult(" + JSONObject.quote(reason) + ")", null);
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (SETUP_SCHEME.equals(uri.getScheme())) {
                if (onSetupPage()) handleSetup(uri);
                return true;
            }
            if ("file".equals(uri.getScheme())) return !uri.toString().startsWith(SETUP_URL);
            if (isInternal(uri)) return false;
            openExternal(uri);
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame() && !request.getUrl().toString().startsWith("file:")) showSetup("unreachable");
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            CookieManager.getInstance().flush();
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try {
                Intent intent = params.createIntent();
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                startActivityForResult(intent, FILE_CHOOSER);
                return true;
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                result = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < result.length; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    private void download(String url, String userAgent, String contentDisposition, String mimeType) {
        Uri uri = Uri.parse(url);
        if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) {
            Toast.makeText(this, getLocaleIsTurkish() ? "Bu dosya uygulama içinden indirilemiyor." : "This file can't be downloaded inside the app.", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request req = new DownloadManager.Request(uri)
                    .setMimeType(mimeType)
                    .addRequestHeader("User-Agent", userAgent)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            if (isInternal(uri)) req.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
            Toast.makeText(this, name, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            openExternal(uri);
        }
    }

    // ───────── lifecycle ─────────

    @Override
    public void onBackPressed() {
        if (web.canGoBack() && !onSetupPage()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onStop() {
        super.onStop();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        io.shutdownNow();
        web.destroy();
        super.onDestroy();
    }

    // ───────── helpers ─────────

    /** Normalizes user input to an http(s) origin, or returns null. */
    static String normalizeServer(String input) {
        if (input == null) return null;
        String raw = input.trim();
        if (raw.isEmpty()) return null;
        if (!raw.matches("(?i)^https?://.*")) {
            boolean local = raw.matches("(?i)^(localhost|127\\.|10\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.).*");
            raw = (local ? "http://" : "https://") + raw;
        }
        return originOf(Uri.parse(raw));
    }

    static String originOf(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (host == null || host.isEmpty() || !("http".equals(scheme) || "https".equals(scheme))) return null;
        int port = uri.getPort();
        boolean defaultPort = port == -1 || ("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443);
        String h = host.contains(":") ? "[" + host + "]" : host;
        return scheme + "://" + h.toLowerCase(Locale.ROOT) + (defaultPort ? "" : ":" + port);
    }

    /** Returns null when an AURALIS server answers at origin, else a reason code for the setup page. */
    private static String probe(String origin) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(origin + "/api/v1/health").openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            int code = c.getResponseCode();
            if (code != 200) return "HTTP " + code;
            JSONObject body = new JSONObject(readAll(c.getInputStream()));
            return body.has("status") ? null : "not-auralis";
        } catch (java.net.SocketTimeoutException e) {
            return "timeout";
        } catch (org.json.JSONException e) {
            return "not-auralis";
        } catch (Exception e) {
            return "unreachable";
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0 && out.size() < 1_000_000) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "0";
        }
    }

    private boolean getLocaleIsTurkish() {
        return "tr".equals(Locale.getDefault().getLanguage());
    }

    /** Compares "1.2.3" style versions. Returns 1, 0 or -1. */
    static int compareVersions(String a, String b) {
        String[] pa = a.split("[.-]");
        String[] pb = b.split("[.-]");
        for (int i = 0; i < Math.max(pa.length, pb.length); i++) {
            int x = i < pa.length ? parseIntSafe(pa[i]) : 0;
            int y = i < pb.length ? parseIntSafe(pb[i]) : 0;
            if (x != y) return x > y ? 1 : -1;
        }
        return 0;
    }

    private static int parseIntSafe(String s) {
        try {
            return Integer.parseInt(s.replaceAll("\\D", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // ───────── update check (GitHub Releases, tags "android-vX.Y.Z") ─────────

    private void checkForUpdates() {
        String current = versionName();
        io.execute(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(RELEASES_API).openConnection();
                c.setRequestProperty("Accept", "application/vnd.github+json");
                c.setRequestProperty("User-Agent", "AURALIS-Android/" + current);
                c.setConnectTimeout(10000);
                c.setReadTimeout(10000);
                if (c.getResponseCode() != 200) return;
                JSONArray releases = new JSONArray(readAll(c.getInputStream()));
                for (int i = 0; i < releases.length(); i++) {
                    JSONObject r = releases.getJSONObject(i);
                    String tag = r.optString("tag_name", "");
                    if (r.optBoolean("draft") || r.optBoolean("prerelease") || !tag.startsWith(TAG_PREFIX)) continue;
                    String latest = tag.substring(TAG_PREFIX.length());
                    String page = r.optString("html_url", "");
                    if (compareVersions(latest, current) > 0 && !latest.equals(prefs.getString("skipped", "")) && page.startsWith("https://github.com/")) {
                        main.post(() -> offerUpdate(latest, current, page));
                    }
                    return;
                }
            } catch (Exception ignored) {
                // Offline or rate-limited: try again next launch.
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    private void offerUpdate(String latest, String current, String page) {
        if (isFinishing()) return;
        boolean tr = getLocaleIsTurkish();
        new AlertDialog.Builder(this)
                .setTitle(tr ? "Güncelleme var" : "Update available")
                .setMessage(tr
                        ? "AURALIS " + latest + " çıktı (sende " + current + " var). İndirme sayfası tarayıcıda açılacak; yeni APK'yı kurman yeterli, verilerin korunur."
                        : "AURALIS " + latest + " is out (you have " + current + "). The download page opens in your browser; install the new APK and your data is kept.")
                .setPositiveButton(tr ? "İndir" : "Download", (d, w) -> openExternal(Uri.parse(page)))
                .setNegativeButton(tr ? "Sonra" : "Later", null)
                .setNeutralButton(tr ? "Bu sürümü atla" : "Skip this version", (d, w) -> prefs.edit().putString("skipped", latest).apply())
                .show();
    }
}
