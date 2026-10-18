package online.gamecon.gamecon

import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugins.webviewflutter.WebViewFlutterAndroidExternalApi

/**
 * Скрипт плеєра в усіх фреймах сторінки (і в iframe балансера): Android WebView вміє вбудовувати
 * скрипт на старті кожного документа (WebViewCompat.addDocumentStartJavaScript). Так наш плеєр ховає
 * рідний інтерфейс балансера й керує його відео, а сам плеєр лишається в iframe на сторінці сайту.
 */
class FrameScriptPlugin : FlutterPlugin {
    private var channel: MethodChannel? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel = MethodChannel(binding.binaryMessenger, "gamecon/webview").also {
            it.setMethodCallHandler { call, result ->
                if (call.method != "addFrameScript") return@setMethodCallHandler result.notImplemented()
                val id = call.argument<Number>("id")?.toLong()
                val script = call.argument<String>("script")
                val webView = if (id == null) null else WebViewFlutterAndroidExternalApi.getWebView(binding, id)
                if (webView == null || script == null || !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                    return@setMethodCallHandler result.success(false)
                }
                WebViewCompat.addDocumentStartJavaScript(webView, script, setOf("*"))
                result.success(true)
            }
        }
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel?.setMethodCallHandler(null)
        channel = null
    }
}
