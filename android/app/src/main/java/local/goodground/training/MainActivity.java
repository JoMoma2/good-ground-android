package local.goodground.training;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Only bundled, trusted content is ever loaded into the bridge-enabled WebView. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String BASE = "https://" + HOST + "/assets/web/";
    private static final int IMPORT = 41, EXPORT = 42;
    private static final Set<String> ASSETS = new HashSet<>(Arrays.asList("index.html", "app.js", "core.js", "data.js", "data.json", "styles.css", "mark.svg", "marker.js", "guide.js", "tailoring.js", "history.js", "lesson-controls.js", "native-boot.js"));
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private WebView web;
    private FrameLayout root;
    private LocalStore store;
    private String bootstrap = "", html = "", exportJson, theme = "light";
    private boolean pickerOpen, destroyed, smoke;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        smoke = BuildConfig.DEBUG && getIntent().getBooleanExtra("good_ground_smoke", false);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(247,245,237));
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);
        try { store = new LocalStore(new File(getNoBackupFilesDir(), "GoodGround")); }
        catch (Exception ignored) { /* Boot exposes the failure; do not silently switch stores. */ }
        createWebView();
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::onBackPressed);
    }

    @SuppressWarnings({"SetJavaScriptEnabled", "deprecation"})
    private void createWebView() {
        try {
            JSONObject boot;
            if (store != null) boot = store.boot();
            else boot = new JSONObject().put("native",true).put("platform","android").put("state",JSONObject.NULL)
                .put("error","The local save folder is unavailable. Export any unsaved records before closing.");
            boot.put("smoke",smoke); boot.put("appVersion",BuildConfig.VERSION_NAME);
            bootstrap = "window.GOOD_GROUND_BOOT=" + boot + ";";
            try (InputStream in = getAssets().open("web/index.html")) {
                html = LocalStore.readText(in).replace("<script defer src=\"data.js\">", "<script src=\"native-boot.js\"></script><script defer src=\"data.js\">");
            }
            web = new WebView(this);
            WebSettings settings = web.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(true);
            settings.setDomStorageEnabled(false);
            settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
            settings.setAllowFileAccessFromFileURLs(false); settings.setAllowUniversalAccessFromFileURLs(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            settings.setSupportMultipleWindows(false); settings.setJavaScriptCanOpenWindowsAutomatically(false);
            settings.setSafeBrowsingEnabled(true);
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
            web.setBackgroundColor(Color.rgb(247,245,237));
            web.addJavascriptInterface(new Bridge(), "GroundAndroid");
            web.setWebViewClient(new WebViewClient() {
                @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    String path = uri.getPath();
                    if (!request.isForMainFrame() && "https".equals(uri.getScheme()) && "formspree.io".equals(uri.getHost())
                        && (uri.getPort() == -1 || uri.getPort() == 443) && path != null && path.matches("/f/[a-z0-9]{6,64}")
                        && (request.getMethod().equals("POST") || request.getMethod().equals("OPTIONS"))) return null;
                    if (!trusted(uri) || path == null || !path.startsWith("/assets/web/") || !request.getMethod().equals("GET")) return blocked();
                    String name = path.substring("/assets/web/".length());
                    if (!ASSETS.contains(name)) return blocked();
                    try {
                        InputStream input;
                        if (name.equals("native-boot.js")) input = textStream(bootstrap);
                        else if (name.equals("index.html")) input = textStream(html);
                        else input = getAssets().open("web/" + name);
                        String mime = name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".json") ? "application/json" : "text/html";
                        return new WebResourceResponse(mime,"UTF-8",input);
                    } catch (Exception e) { return blocked(); }
                }
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (!request.isForMainFrame()) return true;
                    Uri uri = request.getUrl();
                    if (trusted(uri) && ("/assets/web/".equals(uri.getPath()) || "/assets/web/index.html".equals(uri.getPath()))) return false;
                    if (request.hasGesture() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
                        catch (ActivityNotFoundException e) { error("No browser is available to open this reference."); }
                    }
                    return true;
                }
                @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    root.removeView(view); view.destroy(); createWebView(); return true;
                }
            });
            root.addView(web,new FrameLayout.LayoutParams(-1,-1));
            web.loadDataWithBaseURL(BASE,html,"text/html","UTF-8",BASE+"index.html");
            applyTheme(theme);
        } catch (Exception e) {
            new AlertDialog.Builder(this).setTitle("Good Ground could not open")
                .setMessage("Good Ground could not load its lessons. Keep your app data and update the app when a repaired version is available.")
                .setPositiveButton("Close",(dialog,which)->finish()).show();
        }
    }
    private static boolean trusted(Uri uri) { return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443); }
    private static InputStream textStream(String text) { return new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)); }
    private static WebResourceResponse blocked() { return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",null,textStream("Unavailable")); }
    private void reply(JSONObject message) {
        runOnUiThread(()->{if(!destroyed && web != null) web.evaluateJavascript("window.GoodGround?.nativeMessage("+message+");",null);});
    }
    private void error(String text) { try { reply(new JSONObject().put("type","error").put("message",text)); } catch(Exception ignored) {} }

    public final class Bridge {
        @JavascriptInterface public void postMessage(String json) {
            if (json == null || json.length() > 2 * LocalStore.LIMIT + 65536) return;
            try {
                JSONObject message = new JSONObject(json);
                String action = message.getString("action");
                if (action.equals("save")) {
                    JSONObject state = message.getJSONObject("state");
                    files.execute(()->{
                        try {
                            if (store == null) throw new IllegalStateException();
                            reply(new JSONObject().put("type","saved").put("revision",store.save(state)));
                        } catch(Exception e) {
                            try {reply(new JSONObject().put("type","saveError").put("message","This change could not be saved. Keep the app open, retry, or export a backup."));} catch(Exception ignored){}
                        }
                    });
                } else if (action.equals("export")) {
                    String backup = message.getString("json");
                    if(backup.getBytes(StandardCharsets.UTF_8).length > LocalStore.LIMIT) {error("The backup exceeds 5 MB.");return;}
                    runOnUiThread(()->exportBackup(backup));
                } else if (action.equals("import")) runOnUiThread(()->importBackup());
                else if (action.equals("recoverPrevious")) files.execute(()->{
                    try {reply(new JSONObject().put("type","import").put("json",store.previousBackup()));}
                    catch(Exception e){error("No readable previous local save is available. Choose an exported backup instead.");}
                });
                else if(action.equals("theme")) {String choice=message.optString("theme","light");runOnUiThread(()->applyTheme(choice));}
                else if(action.equals("smokeResult") && smoke) files.execute(()->{
                    try {
                        JSONObject result=message.getJSONObject("result");
                        result.put("nativeStore",StoreChecks.run(getCacheDir()));
                        LocalStore.atomicWrite(new android.util.AtomicFile(new File(getFilesDir(),"smoke-result.json")),result.toString().getBytes(StandardCharsets.UTF_8));
                    } catch(Exception ignored){}
                });
            } catch(Exception e) { error("The phone could not complete that request. Please try again."); }
        }
    }
    private void exportBackup(String json) {
        if(pickerOpen) return;
        exportJson=json;pickerOpen=true;
        String stamp=new SimpleDateFormat("yyyy-MM-dd-HHmmss",Locale.US).format(new Date());
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json")
            .putExtra(Intent.EXTRA_TITLE,"Good-Ground-backup-"+stamp+".json");
        try {startActivityForResult(intent,EXPORT);}
        catch(ActivityNotFoundException e){pickerOpen=false;exportJson=null;error("No document picker is available. Your records are still in the app.");}
    }
    private void importBackup() {
        if(pickerOpen) return;
        pickerOpen=true;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
        try {startActivityForResult(intent,IMPORT);}
        catch(ActivityNotFoundException e){pickerOpen=false;error("No document picker is available on this phone.");}
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=IMPORT && requestCode!=EXPORT) return;
        pickerOpen=false;
        String backup=exportJson;exportJson=null;
        if(resultCode!=RESULT_OK || data==null || data.getData()==null)return;
        Uri uri=data.getData();
        files.execute(()->{
            try {
                if(requestCode==EXPORT) {
                    if(backup==null)throw new IllegalStateException();
                    try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")) {
                        if(out==null)throw new IllegalStateException();
                        out.write(backup.getBytes(StandardCharsets.UTF_8));
                    }
                } else {
                    try(InputStream in=getContentResolver().openInputStream(uri)) {
                        reply(new JSONObject().put("type","import").put("json",LocalStore.readText(in)));
                    }
                }
            }catch(Exception e){error(requestCode==IMPORT?"Choose a readable Good Ground JSON backup smaller than 5 MB.":"The backup could not be written. Choose another location and try again.");}
        });
    }
    @SuppressWarnings("deprecation") private void applyTheme(String choice) {
        theme=choice;
        boolean dark=choice.equals("dark") || (choice.equals("system") && (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES);
        int color=dark?Color.rgb(24,35,31):Color.rgb(247,245,237);
        root.setBackgroundColor(color);getWindow().setStatusBarColor(color);getWindow().setNavigationBarColor(color);
        int flags=getWindow().getDecorView().getSystemUiVisibility();
        int light=View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(dark?(flags & ~light):(flags | light));
    }
    @Override public void onConfigurationChanged(Configuration config) {super.onConfigurationChanged(config);applyTheme(theme);}
    @Override public void onBackPressed() {
        if(web==null){super.onBackPressed();return;}
        web.evaluateJavascript("window.GoodGround?.handleBack?.() || false",handled->{if(!"true".equals(handled))finish();});
    }
    @Override protected void onResume(){super.onResume();setVolumeControlStream(AudioManager.STREAM_MUSIC);}
    @Override protected void onPause(){if(web!=null)web.evaluateJavascript("window.GoodGround?.flush();",null);super.onPause();}
    @Override protected void onDestroy(){destroyed=true;files.shutdown();if(web!=null){root.removeView(web);web.removeJavascriptInterface("GroundAndroid");web.destroy();}super.onDestroy();}
}
