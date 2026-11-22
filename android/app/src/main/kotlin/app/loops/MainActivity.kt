package app.loops

import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.window.OnBackInvokedDispatcher
import android.webkit.JsPromptResult
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import androidx.webkit.WebViewAssetLoader
import kotlin.math.roundToInt

/**
 * The whole app for now: one WebView with the page in it, its player on the
 * core's native audio (session 27, [PageBridge]): the page sends the commands
 * and draws what the core reports, and plays no audio of its own. A WebView
 * too old for the bridge plays the page as a browser does.
 */
class MainActivity : Activity() {

    private var web: WebView? = null
    private var page: PageBridge? = null
    private var app: AppBridge? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // A debuggable (test) build can be inspected from a computer over
        // USB, which is what the emulator smoke test does. A release cannot.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#160830"))
        // From Android 15 the window runs under the system bars: the page is
        // kept inside them (and above the keyboard), and the bars show the
        // theme's dark behind them.
        root.setOnApplyWindowInsetsListener { v, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val i = insets.getInsets(
                    WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime()
                )
                v.setPadding(i.left, i.top, i.right, i.bottom)
                WindowInsets.CONSUMED
            } else {
                @Suppress("DEPRECATION")
                v.setPadding(
                    insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                    insets.systemWindowInsetRight, insets.systemWindowInsetBottom,
                )
                @Suppress("DEPRECATION")
                insets.consumeSystemWindowInsets()
            }
        }
        setContentView(root)
        if (Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) {
                if (Playback.busy) moveTaskToBack(true) else finish()
            }
        }
        attachPage(root)
    }

    private fun attachPage(root: ViewGroup) {
        val loader = WebViewAssetLoader.Builder()
            .setDomain(BundledSite.HOST)
            .addPathHandler("/", BundledSite(this))
            .build()

        val view = AppWebView(this)
        view.settings.apply {
            javaScriptEnabled = true
            // The page keeps the loops, the library and the preferences in
            // local storage.
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            // The app has no permissions, so no network: the page is its own
            // files and nothing else.
            blockNetworkLoads = true
            @Suppress("DEPRECATION")
            safeBrowsingEnabled = false
            // Android's font size reaches the page as its root size ([sayFontScale]),
            // as a browser's text setting does: WebView's own zoom would scale the
            // pixel caps that keep a view's words in it, too.
            textZoom = 100
        }
        view.setBackgroundColor(Color.parseColor("#160830"))
        // With the screen off and the app in the background the page goes on (its export, the next loop's
        // choice): the renderer keeps its priority when the window is not shown (session 28).
        view.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        val bridge = AppBridge(this, view) { paintBars(root, view, it) }
        app = bridge
        // The restore file's picker (an <input type=file>): Android's own.
        view.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                v: WebView, callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams,
            ): Boolean = bridge.chooseFile(callback, params.acceptTypes)

            // The page's boxes to type in (a name, a code, a backup) with the page's
            // words alone: WebView's own box is titled with the bundled page's address.
            override fun onJsPrompt(
                v: WebView, url: String?, message: String?, defaultValue: String?, result: JsPromptResult,
            ): Boolean {
                if (isFinishing) {
                    result.cancel()
                    return true
                }
                val box = EditText(this@MainActivity).apply {
                    maxLines = 4
                    setSelectAllOnFocus(true)
                    setText(defaultValue.orEmpty())
                }
                // In line with the dialog's title and keys, not edge to edge.
                val margin = (DIALOG_MARGIN_DP * resources.displayMetrics.density).roundToInt()
                val holder = FrameLayout(this@MainActivity).apply {
                    setPadding(margin, 0, margin, 0)
                    addView(box)
                }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle(message)
                    .setView(holder)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm(box.text.toString()) }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }
        }
        view.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == BundledSite.HOST) return false
                // A link out of the app opens in whatever the listener uses.
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                } catch (_: ActivityNotFoundException) {
                }
                return true
            }

            // A page going (a reload, a link): the player it drove goes with
            // it, as a closed tab's does.
            override fun onPageStarted(v: WebView, url: String?, favicon: Bitmap?) {
                page?.pageGone()
                app?.pageGone()
            }

            override fun onPageFinished(v: WebView, url: String?) {
                sayFontScale(v)
            }

            // WebView's renderer was killed (memory): the page is rebuilt.
            override fun onRenderProcessGone(v: WebView, detail: RenderProcessGoneDetail): Boolean {
                (v.parent as? ViewGroup)?.removeView(v)
                page?.close()
                page = null
                app?.close()
                app = null
                v.destroy()
                web = null
                recreate()
                return true
            }
        }
        root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web = view
        // The page's player on the native core: put in before the page loads.
        if (PageBridge.supported()) {
            page = PageBridge(view).also { it.attach() }
            bridge.attach()
        }
        view.loadUrl(BundledSite.START)
    }

    // The font size changed under the app (the activity stays: the manifest's configChanges).
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        web?.let { sayFontScale(it) }
    }

    /** Android's font size as the page's root size; the page fits itself to it again. */
    private fun sayFontScale(v: WebView) {
        val percent = (resources.configuration.fontScale * 100).roundToInt()
        v.evaluateJavascript(
            "document.documentElement.style.fontSize='$percent%';dispatchEvent(new Event('resize'));",
            null,
        )
    }

    /** The system's bars in the page's theme, their icons dark on a light one. */
    private fun paintBars(root: View, view: View, hex: String) {
        if (!HEX_COLOR.matches(hex)) return
        val color = Color.parseColor(hex)
        val light = Color.luminance(color) > LIGHT_LUMINANCE
        root.setBackgroundColor(color)
        view.setBackgroundColor(color)
        // Before Android 15 the bars have colors of their own.
        @Suppress("DEPRECATION")
        window.statusBarColor = color
        @Suppress("DEPRECATION")
        window.navigationBarColor = color
        if (Build.VERSION.SDK_INT >= 30) {
            val both = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (light) both else 0, both)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                if (light) View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR else 0
        }
    }

    override fun onResume() {
        super.onResume()
        app?.resumed = true
    }

    override fun onPause() {
        app?.resumed = false
        super.onPause()
    }

    // The picker's answers (a new file to save into, the restore file) and the notification permission's.
    @Suppress("OVERRIDE_DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        app?.onResult(requestCode, resultCode, data)
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        app?.onPermissions(requestCode)
    }

    // Back with the music playing or a file being saved leaves the app, as Home does, and the page goes on;
    // it would otherwise close the page, and the music with it. Android 13 and later send the back gesture to
    // a callback (and from Android 16 to nothing else); before that it is the back key.
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && Build.VERSION.SDK_INT < 33 && Playback.busy) {
            moveTaskToBack(true)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        page?.close()
        page = null
        app?.close()
        app = null
        web?.let { (it.parent as? ViewGroup)?.removeView(it); it.destroy() }
        web = null
        super.onDestroy()
    }

    private companion object {
        val HEX_COLOR = Regex("#[0-9a-fA-F]{6}")

        // Black reads better than white from here up.
        const val LIGHT_LUMINANCE = 0.18f
        const val DIALOG_MARGIN_DP = 24
    }
}
