package com.dots.dxfviewer

import android.annotation.SuppressLint
import android.content.ContentResolver
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {
	@SuppressLint("SetJavaScriptEnabled")
	override fun onCreate(savedInstanceState: Bundle?) {
		super.onCreate(savedInstanceState)
		setContent {
			MaterialTheme {
				Surface(Modifier.fillMaxSize()) {
					val context = LocalContext.current
					var webView by remember { mutableStateOf<WebView?>(null) }
					val openDoc = rememberLauncherForActivityResult(
						contract = ActivityResultContracts.OpenDocument()
					) { uri: Uri? ->
						uri?.let {
							val dxfText = readAllText(contentResolver, it)
							val base64 = Base64.encodeToString(dxfText.toByteArray(), Base64.NO_WRAP)
							webView?.evaluateJavascript("window.loadDxfBase64('" + base64 + "')", null)
						}
					}

					Column(Modifier.fillMaxSize()) {
						TopAppBar(
							title = { Text("DXF Viewer") },
							actions = {
								TextButton(onClick = {
									openDoc.launch(arrayOf("*/*"))
								}) { Text("Open DXF") }
							}
						)
						AndroidView(
							modifier = Modifier.fillMaxSize(),
							factory = { ctx ->
								WebView(ctx).apply {
									settings.javaScriptEnabled = true
									settings.cacheMode = WebSettings.LOAD_NO_CACHE
									settings.domStorageEnabled = true
									loadUrl("file:///android_asset/dxfviewer/index.html")
									webView = this
								}
							}
						)
					}
				}
			}
		}
	}

	private fun readAllText(contentResolver: ContentResolver, uri: Uri): String {
		contentResolver.openInputStream(uri)?.use { input ->
			return input.bufferedReader().readText()
		}
		return ""
	}
}
