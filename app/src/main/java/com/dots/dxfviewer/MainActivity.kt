package com.dots.dxfviewer

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

@OptIn(ExperimentalMaterial3Api::class)
class MainActivity : ComponentActivity() {

    private var webViewRef: WebView? = null
    private var webViewReady = false
    private var pendingUri: Uri? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        pendingUri = intent?.data

        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    val openDoc = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.OpenDocument()
                    ) { uri -> uri?.let { loadDxfUri(it) } }

                    Column(Modifier.fillMaxSize()) {
                        TopAppBar(
                            title = { Text("DXF Viewer") },
                            actions = {
                                TextButton(onClick = { openDoc.launch(arrayOf("*/*")) }) {
                                    Text("Open")
                                }
                            }
                        )

                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { ctx ->
                                WebView(ctx).apply {
                                    settings.apply {
                                        javaScriptEnabled = true
                                        domStorageEnabled = true
                                        cacheMode = WebSettings.LOAD_NO_CACHE
                                        allowFileAccess = true
                                    }
                                    webViewClient = object : WebViewClient() {
                                        override fun onPageFinished(view: WebView, url: String) {
                                            webViewReady = true
                                            pendingUri?.let { uri ->
                                                pendingUri = null
                                                loadDxfUri(uri)
                                            }
                                        }
                                    }
                                    webViewRef = this
                                    loadUrl("file:///android_asset/dxfviewer/index.html")
                                }
                            }
                        )
                    }
                }
            }
        }
    }

    private fun loadDxfUri(uri: Uri) {
        if (!webViewReady) { pendingUri = uri; return }
        try {
            val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return
            val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            webViewRef?.evaluateJavascript("window.loadDxfBase64('$b64')", null)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
