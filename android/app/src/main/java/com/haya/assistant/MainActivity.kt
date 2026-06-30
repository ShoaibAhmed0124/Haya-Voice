package com.haya.assistant

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebResourceRequest
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    // Connected to the live Haya Voice Cloud Run URL
    private val PWA_URL = "https://haya-version-0-47625155867.asia-southeast1.run.app"
    
    private val RUNTIME_PERMISSIONS_REQUEST_CODE = 200
    private val OVERLAY_PERMISSION_REQUEST_CODE = 201
    private val SCREEN_CAPTURE_REQUEST_CODE = 202

    private val requiredPermissions = ArrayList<String>().apply {
        add(Manifest.permission.RECORD_AUDIO)
        add(Manifest.permission.CAMERA)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }.toTypedArray()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        Companion.instance = this

        webView = findViewById(R.id.webview)
        setupWebView()

        // Step 1: Request standard runtime permissions (Mic, Camera, Notifications), then load PWA immediately!
        // We DO NOT automatically request Screen Capture or Overlay permission on startup.
        if (!hasRuntimePermissions()) {
            ActivityCompat.requestPermissions(this, requiredPermissions, RUNTIME_PERMISSIONS_REQUEST_CODE)
        } else {
            loadPwa()
        }
    }

    private fun hasRuntimePermissions(): Boolean {
        return requiredPermissions.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == RUNTIME_PERMISSIONS_REQUEST_CODE) {
            // Proceed to load PWA on startup regardless of permissions (graceful degradation)
            loadPwa()
        }
    }

    // Natively trigger overlay permission check and media projection only when requested by JavaScript
    private fun checkOverlayPermissionAndRequestCapture() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Enable Draw Overlays permission for Haya Assistant", Toast.LENGTH_LONG).show()
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST_CODE)
        } else {
            requestScreenCapture()
        }
    }

    private fun requestScreenCapture() {
        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(projectionManager.createScreenCaptureIntent(), SCREEN_CAPTURE_REQUEST_CODE)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            OVERLAY_PERMISSION_REQUEST_CODE -> {
                // Done checking overlay, proceed to screen capture request
                requestScreenCapture()
            }
            SCREEN_CAPTURE_REQUEST_CODE -> {
                if (resultCode == Activity.RESULT_OK && data != null) {
                    // Start capture service with the projection intent data and resultCode
                    val serviceIntent = Intent(this, CaptureService::class.java).apply {
                        putExtra("resultCode", resultCode)
                        putExtra("data", data)
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(serviceIntent)
                    } else {
                        startService(serviceIntent)
                    }
                    Toast.makeText(this, "Screen capture service started", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "Screen capture permission denied", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.allowFileAccess = true

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url != null) {
                    return handleUrlOrIntent(url)
                }
                return false
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString()
                if (url != null) {
                    return handleUrlOrIntent(url)
                }
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // Grant camera/mic access automatically inside web environment
                runOnUiThread {
                    request.grant(request.resources)
                }
            }
        }

        // Native JS Bridge Interface
        webView.addJavascriptInterface(object {
            @android.webkit.JavascriptInterface
            fun postMessage(payload: String) {
                Toast.makeText(this@MainActivity, "Haya Signal: $payload", Toast.LENGTH_SHORT).show()
            }

            @android.webkit.JavascriptInterface
            fun startScreenCapture() {
                runOnUiThread {
                    checkOverlayPermissionAndRequestCapture()
                }
            }

            @android.webkit.JavascriptInterface
            fun stopScreenCapture() {
                runOnUiThread {
                    val serviceIntent = Intent(this@MainActivity, CaptureService::class.java)
                    stopService(serviceIntent)
                    Toast.makeText(this@MainActivity, "Screen capture service stopped", Toast.LENGTH_SHORT).show()
                }
            }
        }, "Android")
    }

    private fun handleUrlOrIntent(url: String): Boolean {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return false // Standard browser navigation
        }

        try {
            val intent = if (url.startsWith("intent:")) {
                Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
            } else {
                Intent(Intent.ACTION_VIEW, Uri.parse(url))
            }
            
            intent.addCategory(Intent.CATEGORY_BROWSABLE)
            intent.setComponent(null)
            intent.selector = null

            if (packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY) != null) {
                startActivity(intent)
                return true
            } else {
                // Try fallback URL from intent if present
                val fallbackUrl = intent.getStringExtra("browser_fallback_url")
                if (fallbackUrl != null) {
                    webView.loadUrl(fallbackUrl)
                    return true
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return false
    }

    private fun loadPwa() {
        webView.loadUrl(PWA_URL)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (Companion.instance == this) {
            Companion.instance = null
        }
    }

    companion object {
        private var instance: MainActivity? = null

        fun sendScreenFrameToWebView(base64: String) {
            instance?.runOnUiThread {
                instance?.webView?.evaluateJavascript(
                    "if (window.onAndroidScreenFrameCaptured) { window.onAndroidScreenFrameCaptured('$base64'); }",
                    null
                )
            }
        }
    }
}
