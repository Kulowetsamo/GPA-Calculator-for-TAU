package com.metu.gpacalc;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        // ── Register the JS bridge ──
        webView.addJavascriptInterface(new AndroidBridge(), "Android");

        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/index.html");

        hideSystemUI();

        webView.setOnSystemUiVisibilityChangeListener(visibility -> {
            if ((visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
                hideSystemUI();
            }
        });
    }

    // ── Javascript Interface ──────────────────────────────────────────────────

    private class AndroidBridge {

        /**
         * Called from JS: Android.saveImage(dataUrl, filename)
         * Saves the PNG to the device's Pictures/GPA Calculator folder.
         */
        @JavascriptInterface
        public void saveImage(String dataUrl, String filename) {
            try {
                Bitmap bmp = dataUrlToBitmap(dataUrl);
                if (bmp == null) { toast("Save failed: could not decode image"); return; }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+ — use MediaStore (no WRITE_EXTERNAL_STORAGE needed)
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                    cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    cv.put(MediaStore.Images.Media.RELATIVE_PATH,
                            Environment.DIRECTORY_PICTURES + "/GPA Calculator");
                    Uri uri = getContentResolver()
                            .insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) { toast("Save failed"); return; }
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        bmp.compress(Bitmap.CompressFormat.PNG, 100, os);
                    }
                } else {
                    // Android 9 and below — write to file directly
                    File dir = new File(Environment.getExternalStoragePublicDirectory(
                            Environment.DIRECTORY_PICTURES), "GPA Calculator");
                    if (!dir.exists()) dir.mkdirs();
                    File file = new File(dir, filename);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        bmp.compress(Bitmap.CompressFormat.PNG, 100, fos);
                    }
                    // Notify gallery
                    Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                    scan.setData(Uri.fromFile(file));
                    sendBroadcast(scan);
                }
                toast("Saved to Pictures ✓");
            } catch (Exception e) {
                toast("Save failed: " + e.getMessage());
            }
        }

        /**
         * Called from JS: Android.shareImage(dataUrl, filename)
         * Opens the native share sheet with the PNG attached.
         */
        @JavascriptInterface
        public void shareImage(String dataUrl, String filename) {
            try {
                Bitmap bmp = dataUrlToBitmap(dataUrl);
                if (bmp == null) { toast("Share failed: could not decode image"); return; }

                // Write to cache dir — FileProvider can serve it to other apps
                File cacheDir = new File(getCacheDir(), "shared_images");
                if (!cacheDir.exists()) cacheDir.mkdirs();
                File file = new File(cacheDir, filename);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    bmp.compress(Bitmap.CompressFormat.PNG, 100, fos);
                }

                Uri uri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        file);

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("image/png");
                shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, "GPA Transcript");
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                runOnUiThread(() ->
                        startActivity(Intent.createChooser(shareIntent, "Share GPA Transcript")));
            } catch (Exception e) {
                toast("Share failed: " + e.getMessage());
            }
        }

        private Bitmap dataUrlToBitmap(String dataUrl) {
            try {
                // Strip the "data:image/png;base64," prefix
                String base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            } catch (Exception e) {
                return null;
            }
        }

        private void toast(String msg) {
            runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }
    }

    // ── Boilerplate ───────────────────────────────────────────────────────────

    private void hideSystemUI() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("window.handleBackButton()", result -> {
            if (!"true".equals(result)) {
                // evaluateJavascript callback runs on a background thread;
                // finish() must be called on the UI thread.
                runOnUiThread(() -> finish());
            }
        });
    }
}