package expo.modules.videolyricexport

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.text.Layout
import android.text.Spannable
import android.text.SpannableString
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.ForegroundColorSpan
import androidx.media3.common.OverlaySettings
import androidx.media3.common.util.Size
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.StaticOverlaySettings
import kotlin.math.ceil
import kotlin.math.max

@UnstableApi
class LyricBitmapOverlay(
  private val options: ExportOptions,
  private var videoWidth: Int,
  private var overlayScale: Float,
  private var fontPx: Float,
) : BitmapOverlay() {
  private val emptyBitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
  private val bitmaps = mutableMapOf<String, Bitmap>()

  private data class LineSpan(val start: Double, val end: Double, val fadeOut: Boolean)

  override fun configure(videoSize: Size) {
    super.configure(videoSize)
    if (videoSize.width <= 0) {
      return
    }
    val previewWidth = options.previewWidth.takeIf { it > 1.0 }?.toFloat() ?: 360f
    videoWidth = videoSize.width
    overlayScale = (videoSize.width / previewWidth).coerceAtLeast(0.75f)
    fontPx = (options.fontSize * overlayScale).toFloat().coerceAtLeast(1f)
    bitmaps.values.forEach { it.recycle() }
    bitmaps.clear()
  }

  override fun getBitmap(presentationTimeUs: Long): Bitmap {
    val seconds = presentationTimeUs / 1_000_000.0
    val cue = options.cues.lastOrNull { seconds >= it.start && seconds < it.end && it.text.isNotBlank() }
      ?: return emptyBitmap
    val karaoke = options.animation == "none"
    val key =
      if (karaoke) "${cue.text}\u0000${cue.highlightStart}\u0000${cue.highlightEnd}" else cue.text
    return bitmaps.getOrPut(key) { drawLine(cue) }
  }

  override fun getOverlaySettings(presentationTimeUs: Long): OverlaySettings {
    val motion = overlayMotion(presentationTimeUs / 1_000_000.0)
    return StaticOverlaySettings.Builder()
      .setBackgroundFrameAnchor(
        percentToAnchorX(options.x + motion.slidePercent),
        percentToAnchorY(options.y + motion.risePercent),
      )
      .setOverlayFrameAnchor(0f, 0f)
      .setScale(motion.scale, motion.scale)
      .setAlphaScale(motion.alpha)
      .build()
  }

  private fun drawLine(cue: LyricCue): Bitmap {
    val text = cue.text
    val textColor = parseCssColor(options.color, Color.WHITE)
    val spanned = styledLine(cue)
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
      textSize = fontPx
      color = textColor
      typeface = typefaceFor(text)
      if (options.outline) {
        setShadowLayer(4f * overlayScale, 0f, 1.5f * overlayScale, Color.BLACK)
      }
    }
    val maxWidth = max(1, (videoWidth * 0.92f).toInt())
    val alignment = when (options.align) {
      "left" -> Layout.Alignment.ALIGN_NORMAL
      "right" -> Layout.Alignment.ALIGN_OPPOSITE
      else -> Layout.Alignment.ALIGN_CENTER
    }
    val measured = layoutFor(spanned, paint, maxWidth, alignment)
    var usedWidth = 1
    for (index in 0 until measured.lineCount) {
      usedWidth = max(usedWidth, ceil(measured.getLineWidth(index)).toInt())
    }
    val layoutWidth = if (measured.lineCount <= 1) usedWidth.coerceAtMost(maxWidth) else maxWidth
    val layout = if (layoutWidth == maxWidth) measured else layoutFor(spanned, paint, layoutWidth, alignment)
    val padX = (10f * overlayScale).toInt().coerceAtLeast(8)
    val padY = (6f * overlayScale).toInt().coerceAtLeast(6)
    val width = (layoutWidth + padX * 2).coerceAtLeast(2)
    val height = (layout.height + padY * 2).coerceAtLeast(2)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    options.backgroundColor?.let { background ->
      val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = parseCssColor(background, Color.TRANSPARENT) }
      if (Color.alpha(fill.color) > 0) {
        canvas.drawRoundRect(
          RectF(0f, 0f, width.toFloat(), height.toFloat()),
          10f * overlayScale,
          10f * overlayScale,
          fill,
        )
      }
    }
    canvas.save()
    canvas.translate(padX.toFloat(), padY.toFloat())
    if (options.outline) {
      val outlinePaint = TextPaint(paint).apply {
        style = Paint.Style.STROKE
        strokeWidth = 3.2f * overlayScale
        strokeJoin = Paint.Join.ROUND
        color = Color.BLACK
      }
      layoutFor(text, outlinePaint, layoutWidth, alignment).draw(canvas)
      paint.clearShadowLayer()
    }
    paint.style = Paint.Style.FILL
    paint.strokeWidth = 0f
    layout.draw(canvas)
    canvas.restore()
    return bitmap
  }

  private fun styledLine(cue: LyricCue): SpannableString {
    val spanned = SpannableString(cue.text)
    if (spanned.isEmpty()) {
      return spanned
    }
    val textColor = parseCssColor(options.color, Color.WHITE)
    if (options.animation != "none") {
      spanned.setSpan(ForegroundColorSpan(textColor), 0, spanned.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
      return spanned
    }
    val dimmed = Color.argb(
      (Color.alpha(textColor) * 0.72f).toInt().coerceIn(0, 255),
      Color.red(textColor),
      Color.green(textColor),
      Color.blue(textColor),
    )
    spanned.setSpan(ForegroundColorSpan(dimmed), 0, spanned.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
    val start = cue.highlightStart.coerceIn(0, spanned.length)
    val end = cue.highlightEnd.coerceIn(start, spanned.length)
    if (end > start) {
      val accent = parseCssColor(options.accentColor, Color.parseColor("#8B7CFF"))
      spanned.setSpan(ForegroundColorSpan(accent), start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
    return spanned
  }

  private fun layoutFor(
    text: CharSequence,
    paint: TextPaint,
    width: Int,
    alignment: Layout.Alignment,
  ): StaticLayout {
    return StaticLayout.Builder.obtain(text, 0, text.length, paint, width.coerceAtLeast(1))
      .setAlignment(alignment)
      .setIncludePad(true)
      .setLineSpacing(0f, 1.15f)
      .build()
  }

  private data class OverlayMotion(val alpha: Float, val scale: Float, val risePercent: Double, val slidePercent: Double)
  private data class MotionSpec(
    val fadeIn: Double,
    val fadeOut: Double,
    val risePercent: Double,
    val slidePercent: Double,
    val scaleFrom: Float,
  )

  private fun motionSpec(): MotionSpec {
    var spec = when (options.animation) {
      "none" -> MotionSpec(0.0, 0.0, 0.0, 0.0, 1f)
      "fade" -> MotionSpec(0.28, 0.2, 0.0, 0.0, 1f)
      "drop" -> MotionSpec(0.28, 0.2, -1.4, 0.0, 0.94f)
      "pop" -> MotionSpec(0.22, 0.16, 0.0, 0.0, 0.72f)
      "slide" -> MotionSpec(0.3, 0.2, 0.0, -2.4, 1f)
      "zoom" -> MotionSpec(0.32, 0.22, 0.0, 0.0, 0.55f)
      else -> MotionSpec(0.28, 0.2, 1.4, 0.0, 0.94f)
    }
    if (options.animation == "slide" && options.align == "right") {
      spec = spec.copy(slidePercent = kotlin.math.abs(spec.slidePercent))
    }
    return spec
  }

  private fun overlayMotion(seconds: Double): OverlayMotion {
    val spec = motionSpec()
    val span = lineSpan(seconds) ?: return OverlayMotion(0f, spec.scaleFrom, spec.risePercent, spec.slidePercent)
    val duration = (span.end - span.start).coerceAtLeast(0.12)
    val rate = options.animationSpeed.let { if (it <= 0) 1.0 else it.coerceIn(0.4, 2.5) }
    val enter = if (spec.fadeIn <= 0) {
      1f
    } else {
      val fadeIn = (spec.fadeIn / rate).coerceAtMost((duration * 0.4).coerceAtLeast(0.08))
      easeOutCubic(((seconds - span.start) / fadeIn).toFloat().coerceIn(0f, 1f))
    }
    var exit = 1f
    if (span.fadeOut && spec.fadeOut > 0) {
      val fadeOut = (spec.fadeOut / rate).coerceAtMost((duration * 0.28).coerceAtLeast(0.08))
      exit = ((span.end - seconds) / fadeOut).toFloat().coerceIn(0f, 1f)
    }
    val amount = (enter * exit).coerceIn(0f, 1f)
    return OverlayMotion(
      alpha = amount,
      scale = spec.scaleFrom + (1f - spec.scaleFrom) * enter,
      risePercent = spec.risePercent * (1.0 - enter.toDouble()),
      slidePercent = spec.slidePercent * (1.0 - enter.toDouble()),
    )
  }

  private fun lineSpan(seconds: Double): LineSpan? {
    val cues = options.cues
    val index = cues.indexOfLast { seconds >= it.start && seconds < it.end && it.text.isNotBlank() }
    if (index < 0) {
      return null
    }
    val id = cueId(cues[index])
    var first = index
    while (first > 0 && cueId(cues[first - 1]) == id) {
      first--
    }
    var last = index
    while (last < cues.lastIndex && cueId(cues[last + 1]) == id) {
      last++
    }
    val start = cues[first].start
    val end = cues[last].end
    val hasGapAfter = last == cues.lastIndex || cues[last + 1].start > end + 0.04
    return LineSpan(start, end, hasGapAfter)
  }

  private fun cueId(cue: LyricCue): String {
    return cue.lineId.ifBlank { "\u0000${cue.text}" }
  }

  private fun easeOutCubic(t: Float): Float {
    val x = t.coerceIn(0f, 1f)
    val inv = 1f - x
    return 1f - inv * inv * inv
  }

  private fun typefaceFor(text: String): Typeface {
    val family = if (needsSystemFont(text)) "sans-serif" else androidFontFamily(options.fontFamily)
    return Typeface.create(family, typefaceStyle(options))
  }

  private fun needsSystemFont(text: String): Boolean {
    return text.any { ch ->
      val code = ch.code
      code in 0x0590..0x05FF ||
        code in 0x0600..0x06FF ||
        code in 0x0750..0x077F ||
        code in 0x08A0..0x08FF ||
        code in 0x0900..0x0DFF ||
        code in 0x0E00..0x0E7F ||
        code in 0x0F00..0x0FFF ||
        code in 0x1000..0x109F ||
        code in 0x1100..0x11FF ||
        code in 0x1200..0x137F ||
        code in 0x1780..0x17FF ||
        code in 0x3040..0x30FF ||
        code in 0x3100..0x312F ||
        code in 0x3400..0x9FFF ||
        code in 0xA960..0xA97F ||
        code in 0xAC00..0xD7AF ||
        code in 0xF900..0xFAFF
    }
  }

  private fun typefaceStyle(options: ExportOptions): Int {
    return when {
      options.bold && options.italic -> Typeface.BOLD_ITALIC
      options.bold -> Typeface.BOLD
      options.italic -> Typeface.ITALIC
      else -> Typeface.NORMAL
    }
  }

  private fun androidFontFamily(id: String): String {
    return when (id) {
      "serif" -> "serif"
      "condensed", "narrow", "poster" -> "sans-serif-condensed"
      "typewriter" -> "serif-monospace"
      "mono" -> "monospace"
      "script" -> "cursive"
      "marker" -> "casual"
      "smallcaps" -> "sans-serif-smallcaps"
      else -> "sans-serif"
    }
  }

  private fun percentToAnchorX(percent: Double) = ((percent / 50.0) - 1.0).toFloat().coerceIn(-1f, 1f)

  private fun percentToAnchorY(percent: Double) = (1.0 - (percent / 50.0)).toFloat().coerceIn(-1f, 1f)

  private fun parseCssColor(value: String, fallback: Int): Int {
    val raw = value.trim()
    if (raw.isEmpty()) {
      return fallback
    }
    return try {
      if (raw.startsWith("rgba") || raw.startsWith("rgb")) {
        val parts = raw.substringAfter("(").substringBefore(")").split(",").map { it.trim() }
        val r = parts.getOrNull(0)?.toFloatOrNull()?.toInt()?.coerceIn(0, 255) ?: return fallback
        val g = parts.getOrNull(1)?.toFloatOrNull()?.toInt()?.coerceIn(0, 255) ?: return fallback
        val b = parts.getOrNull(2)?.toFloatOrNull()?.toInt()?.coerceIn(0, 255) ?: return fallback
        val a = parts.getOrNull(3)?.toFloatOrNull()?.let { (it * 255).toInt().coerceIn(0, 255) } ?: 255
        return Color.argb(a, r, g, b)
      }
      val hex = raw.removePrefix("#")
      when (hex.length) {
        3 -> Color.rgb(
          hex[0].digitToInt(16) * 17,
          hex[1].digitToInt(16) * 17,
          hex[2].digitToInt(16) * 17,
        )
        6 -> Color.parseColor("#$hex")
        8 -> Color.argb(
          hex.substring(6, 8).toInt(16),
          hex.substring(0, 2).toInt(16),
          hex.substring(2, 4).toInt(16),
          hex.substring(4, 6).toInt(16),
        )
        else -> Color.parseColor(raw)
      }
    } catch (_: Exception) {
      fallback
    }
  }
}
