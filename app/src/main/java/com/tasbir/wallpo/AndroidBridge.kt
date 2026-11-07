package com.tasbir.wallpo

import android.app.WallpaperManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.content.FileProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.TimeUnit

class AndroidBridge(
    private val context: Context,
    private val scope: CoroutineScope
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun showToast(msg: String) {
        mainHandler.post {
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun isNativeAndroid(): Boolean {
        return true
    }

    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(durationMs)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun setWallpaper(imageSource: String, target: String) {
        showToast("Setting wallpaper...")
        scope.launch(Dispatchers.IO) {
            try {
                val bitmap = loadBitmapFromSource(imageSource)
                if (bitmap == null) {
                    showToast("Failed to load image for wallpaper.")
                    return@launch
                }

                val wallpaperManager = WallpaperManager.getInstance(context)
                val flags = when (target.lowercase()) {
                    "lock" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            WallpaperManager.FLAG_LOCK
                        } else {
                            WallpaperManager.FLAG_SYSTEM
                        }
                    }
                    "home" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            WallpaperManager.FLAG_SYSTEM
                        } else {
                            WallpaperManager.FLAG_SYSTEM
                        }
                    }
                    else -> { // "both"
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK
                        } else {
                            WallpaperManager.FLAG_SYSTEM
                        }
                    }
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    wallpaperManager.setBitmap(bitmap, null, true, flags)
                } else {
                    wallpaperManager.setBitmap(bitmap)
                }

                val targetName = when (target.lowercase()) {
                    "lock" -> "Lock Screen"
                    "home" -> "Home Screen"
                    else -> "Home & Lock Screen"
                }
                showToast("✨ Wallpaper applied to $targetName successfully!")
                vibrate(60)
            } catch (e: Exception) {
                e.printStackTrace()
                showToast("Error setting wallpaper: ${e.localizedMessage ?: "Unknown error"}")
            }
        }
    }

    @JavascriptInterface
    fun downloadWallpaper(imageSource: String, fileName: String) {
        showToast("Downloading wallpaper...")
        scope.launch(Dispatchers.IO) {
            try {
                val bitmap = loadBitmapFromSource(imageSource)
                if (bitmap == null) {
                    showToast("Failed to download image.")
                    return@launch
                }

                val cleanFileName = if (fileName.endsWith(".jpg") || fileName.endsWith(".png")) {
                    fileName
                } else {
                    "WALLPO_${System.currentTimeMillis()}.png"
                }

                val savedUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val contentValues = ContentValues().apply {
                        put(MediaStore.MediaColumns.DISPLAY_NAME, cleanFileName)
                        put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
                        put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/WallpoXtremePro")
                        put(MediaStore.MediaColumns.IS_PENDING, 1)
                    }

                    val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
                    if (uri != null) {
                        context.contentResolver.openOutputStream(uri)?.use { outStream ->
                            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outStream)
                        }
                        contentValues.clear()
                        contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                        context.contentResolver.update(uri, contentValues, null, null)
                    }
                    uri
                } else {
                    val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                    val appDir = File(picturesDir, "WallpoXtremePro").apply { if (!exists()) mkdirs() }
                    val file = File(appDir, cleanFileName)
                    FileOutputStream(file).use { outStream ->
                        bitmap.compress(Bitmap.CompressFormat.PNG, 100, outStream)
                    }
                    Uri.fromFile(file)
                }

                if (savedUri != null) {
                    showToast("Saved to Gallery: WallpoXtremePro")
                    vibrate(40)
                } else {
                    showToast("Failed to save wallpaper to Gallery.")
                }
            } catch (e: Exception) {
                e.printStackTrace()
                showToast("Download error: ${e.localizedMessage ?: "Unknown"}")
            }
        }
    }

    @JavascriptInterface
    fun shareWallpaper(imageSource: String, prompt: String) {
        scope.launch(Dispatchers.IO) {
            try {
                val bitmap = loadBitmapFromSource(imageSource) ?: return@launch
                val cacheDir = File(context.cacheDir, "wallpapers").apply { if (!exists()) mkdirs() }
                val tempFile = File(cacheDir, "share_wallpo_${System.currentTimeMillis()}.png")
                FileOutputStream(tempFile).use { outStream ->
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, outStream)
                }

                val contentUri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    tempFile
                )

                val shareText = "Generated with WALLPO XTREME PRO\n\"$prompt\"\nImagine It. Generate It. Make It Your Wallpaper.\nCreated By MD. TASBIR - UL ISLAM"
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, contentUri)
                    putExtra(Intent.EXTRA_TEXT, shareText)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                val chooser = Intent.createChooser(shareIntent, "Share Wallpaper via").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(chooser)
            } catch (e: Exception) {
                e.printStackTrace()
                showToast("Failed to share: ${e.localizedMessage}")
            }
        }
    }

    private fun loadBitmapFromSource(source: String): Bitmap? {
        return try {
            if (source.startsWith("data:image")) {
                val commaIndex = source.indexOf(",")
                val base64Data = if (commaIndex != -1) source.substring(commaIndex + 1) else source
                val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
            } else if (source.startsWith("http://") || source.startsWith("https://")) {
                val request = Request.Builder().url(source).build()
                val response = httpClient.newCall(request).execute()
                if (response.isSuccessful) {
                    val stream: InputStream? = response.body?.byteStream()
                    BitmapFactory.decodeStream(stream)
                } else null
            } else {
                null
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
