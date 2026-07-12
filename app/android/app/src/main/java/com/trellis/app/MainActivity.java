package com.trellis.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private int statusBarPx = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Read the real status bar height from Android window insets
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            statusBarPx = bars.top;
            injectStatusBarHeight();
            return insets;
        });

        // Disable rubber-band overscroll so the UI never stretches beyond its bounds
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-apply after the WebView page has loaded (local assets load nearly instantly)
        injectStatusBarHeight();
    }

    private void injectStatusBarHeight() {
        if (statusBarPx == 0 || getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        float density = getResources().getDisplayMetrics().density;
        float cssPx = statusBarPx / density;
        String js = String.format(Locale.US,
            "document.documentElement.style.setProperty('--status-bar-height','%.1fpx');",
            cssPx
        );
        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
