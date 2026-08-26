package com.metu.gpacalc;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> uploadMessage;
    private static final int FILE_CHOOSER_REQUEST_CODE = 12345;
    private static final int EXPORT_FILE_REQUEST_CODE = 12346;
    private File pendingExportFile;

    private static final int PERMISSION_REQUEST_STORAGE = 100;

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
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        // Request storage permission for Android 9 and below (for saving images)
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE},
                        PERMISSION_REQUEST_STORAGE);
            }
        }

        webView.addJavascriptInterface(new AndroidBridge(), "Android");

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                uploadMessage = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                return true;
            }
        });

        webView.loadUrl("file:///android_asset/index.html");

        hideSystemUI();

        webView.setOnSystemUiVisibilityChangeListener(visibility -> {
            if ((visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
                hideSystemUI();
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (uploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                Uri uri = data.getData();
                if (uri != null) results = new Uri[]{uri};
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
        } else if (requestCode == EXPORT_FILE_REQUEST_CODE && resultCode == RESULT_OK && data != null) {
            Uri uri = data.getData();
            if (uri != null && pendingExportFile != null && pendingExportFile.exists()) {
                try (InputStream is = new FileInputStream(pendingExportFile);
                     OutputStream os = getContentResolver().openOutputStream(uri)) {
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = is.read(buffer)) != -1) {
                        os.write(buffer, 0, len);
                    }
                    runOnUiThread(() -> Toast.makeText(this, "✓ Exported successfully", Toast.LENGTH_LONG).show());
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(this, "Export error: " + e.getMessage(), Toast.LENGTH_LONG).show());
                }
                pendingExportFile.delete();
                pendingExportFile = null;
            }
        }
    }

    private class AndroidBridge {

        // ─── FILE EXPORT (JSON / CSV / …) ────────────────────────────
        @JavascriptInterface
        public void exportFile(String contents, String suggestedFileName) {
            runOnUiThread(() -> {
                try {
                    File tempFile = new File(getCacheDir(), suggestedFileName);
                    try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                        fos.write(contents.getBytes());
                    }
                    pendingExportFile = tempFile;
                    String mime = suggestedFileName != null && suggestedFileName.toLowerCase().endsWith(".csv")
                            ? "text/csv"
                            : "application/json";
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mime);
                    intent.putExtra(Intent.EXTRA_TITLE, suggestedFileName);
                    startActivityForResult(intent, EXPORT_FILE_REQUEST_CODE);
                    Toast.makeText(MainActivity.this, "Choose where to save", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Export prep error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }
        @JavascriptInterface
        public void shareText(String text, String subject) {
            runOnUiThread(() -> {
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("text/plain");
                shareIntent.putExtra(Intent.EXTRA_TEXT, text);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, subject);
                startActivity(Intent.createChooser(shareIntent, "Share via"));
            });
        }

        // ─── IMAGE SAVE (download) ───────────────────────────────────
        @JavascriptInterface
        public void saveImage(String dataUrl, String filename) {
            runOnUiThread(() -> {
                Bitmap bmp = dataUrlToBitmap(dataUrl);
                if (bmp == null) {
                    Toast.makeText(MainActivity.this, "Failed to decode image", Toast.LENGTH_SHORT).show();
                    return;
                }

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        // Android 10+ : MediaStore
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/GPA Calculator");
                        Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                                bmp.compress(Bitmap.CompressFormat.PNG, 100, os);
                            }
                            Toast.makeText(MainActivity.this, "Saved to Pictures/GPA Calculator", Toast.LENGTH_LONG).show();
                        } else {
                            Toast.makeText(MainActivity.this, "Failed to save image", Toast.LENGTH_SHORT).show();
                        }
                    } else {
                        // Android 9 and below: write to external storage
                        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "GPA Calculator");
                        if (!dir.exists() && !dir.mkdirs()) {
                            Toast.makeText(MainActivity.this, "Cannot create directory", Toast.LENGTH_SHORT).show();
                            return;
                        }
                        File file = new File(dir, filename);
                        try (FileOutputStream fos = new FileOutputStream(file)) {
                            bmp.compress(Bitmap.CompressFormat.PNG, 100, fos);
                        }
                        // Notify gallery
                        Intent mediaScanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                        mediaScanIntent.setData(Uri.fromFile(file));
                        sendBroadcast(mediaScanIntent);
                        Toast.makeText(MainActivity.this, "Saved to Pictures/GPA Calculator", Toast.LENGTH_LONG).show();
                    }
                } catch (Exception e) {
                    Log.e("SaveImage", "Error saving image", e);
                    Toast.makeText(MainActivity.this, "Save error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        // ─── IMAGE SHARE ────────────────────────────────────────────
        @JavascriptInterface
        public void shareImage(String dataUrl, String filename) {
            runOnUiThread(() -> {
                Bitmap bmp = dataUrlToBitmap(dataUrl);
                if (bmp == null) {
                    Toast.makeText(MainActivity.this, "Failed to decode image", Toast.LENGTH_SHORT).show();
                    return;
                }

                try {
                    // Write to cache directory
                    File cacheDir = new File(getCacheDir(), "shared_images");
                    if (!cacheDir.exists() && !cacheDir.mkdirs()) {
                        Toast.makeText(MainActivity.this, "Cannot create cache", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    File imageFile = new File(cacheDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                        bmp.compress(Bitmap.CompressFormat.PNG, 100, fos);
                    }

                    // Get content URI via FileProvider
                    Uri contentUri = FileProvider.getUriForFile(MainActivity.this,
                            getPackageName() + ".fileprovider", imageFile);

                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    shareIntent.setType("image/png");
                    shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    shareIntent.putExtra(Intent.EXTRA_SUBJECT, "GPA Transcript");
                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(shareIntent, "Share GPA Transcript"));
                } catch (Exception e) {
                    Log.e("ShareImage", "Error sharing image", e);
                    Toast.makeText(MainActivity.this, "Share error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        private Bitmap dataUrlToBitmap(String dataUrl) {
            try {
                // dataUrl format: "data:image/png;base64,xxxxx"
                String base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
                byte[] decodedBytes = Base64.decode(base64, Base64.DEFAULT);
                return BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
            } catch (Exception e) {
                Log.e("DataUrl", "Failed to decode", e);
                return null;
            }
        }
    }

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
                runOnUiThread(this::finish);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_STORAGE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Storage permission granted", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Storage permission denied – cannot save images on Android 9", Toast.LENGTH_LONG).show();
            }
        }
    }
}