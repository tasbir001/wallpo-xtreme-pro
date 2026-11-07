# Proguard rules for WALLPO XTREME PRO
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.tasbir.wallpo.AndroidBridge { *; }
