package expo.modules.videolyricexport

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
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
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

@UnstableApi
class LyricBitmapOverlay(
  private val context: Context,
  private val options: ExportOptions,
  private var videoWidth: Int,
  private var overlayScale: Float,
  private var fontPx: Float,
) : BitmapOverlay() {
  private val emptyBitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
  private val bitmaps = mutableMapOf<String, Bitmap>()
  private val typefaces = mutableMapOf<String, Typeface>()
  private var liveA: Bitmap? = null
  private var liveB: Bitmap? = null
  private var liveToggle = false

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
    liveA?.recycle()
    liveB?.recycle()
    liveA = null
    liveB = null
  }

  override fun getBitmap(presentationTimeUs: Long): Bitmap {
    val seconds = presentationTimeUs / 1_000_000.0
    if (options.animation == "wheel") {
      return drawWheel(seconds)
    }
    if (isDepthAnimation(options.animation)) {
      return drawDepth(seconds)
    }
    val cue = options.cues.lastOrNull { seconds >= it.start && seconds < it.end && it.text.isNotBlank() }
      ?: return emptyBitmap
    val karaoke = options.animation == "none"
    val key =
      if (karaoke) "${cue.text}\u0000${cue.highlightStart}\u0000${cue.highlightEnd}" else cue.text
    val base = bitmaps.getOrPut(key) { drawLine(cue) }
    return if (options.animation == "sparkle" || options.animation == "glow") {
      composeLive(base, seconds)
    } else {
      base
    }
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
      .setRotationDegrees(motion.rotation)
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

  private data class OverlayMotion(
    val alpha: Float,
    val scale: Float,
    val risePercent: Double,
    val slidePercent: Double,
    val rotation: Float,
  )
  private data class MotionSpec(
    val fadeIn: Double,
    val fadeOut: Double,
    val risePercent: Double,
    val slidePercent: Double,
    val scaleFrom: Float,
    val rotateFrom: Float = 0f,
    val easeBack: Boolean = false,
  )

  private fun motionSpec(): MotionSpec {
    var spec = when (options.animation) {
      "none" -> MotionSpec(0.0, 0.0, 0.0, 0.0, 1f)
      "fade" -> MotionSpec(0.28, 0.2, 0.0, 0.0, 1f)
      "drop" -> MotionSpec(0.28, 0.2, -1.4, 0.0, 0.94f)
      "pop" -> MotionSpec(0.22, 0.16, 0.0, 0.0, 0.72f)
      "slide" -> MotionSpec(0.3, 0.2, 0.0, -2.4, 1f)
      "zoom" -> MotionSpec(0.32, 0.22, 0.0, 0.0, 0.55f)
      "sparkle" -> MotionSpec(0.28, 0.2, 0.0, 0.0, 1f)
      "fly" -> MotionSpec(0.42, 0.26, 3.4, -7.2, 0.86f, -14f)
      "glow" -> MotionSpec(0.3, 0.2, 0.0, 0.0, 0.96f)
      "bounce" -> MotionSpec(0.4, 0.18, 2.8, 0.0, 0.8f, 0f, true)
      "float" -> MotionSpec(0.3, 0.2, 1.1, 0.0, 0.97f)
      "wheel", "flip", "coverflow", "prism" -> MotionSpec(0.0, 0.0, 0.0, 0.0, 1f)
      else -> MotionSpec(0.28, 0.2, 1.4, 0.0, 0.94f)
    }
    if ((options.animation == "slide" || options.animation == "fly") && options.align == "right") {
      spec = spec.copy(slidePercent = kotlin.math.abs(spec.slidePercent), rotateFrom = kotlin.math.abs(spec.rotateFrom))
    }
    return spec
  }

  private fun overlayMotion(seconds: Double): OverlayMotion {
    val spec = motionSpec()
    val span = lineSpan(seconds) ?: return OverlayMotion(0f, spec.scaleFrom, spec.risePercent, spec.slidePercent, spec.rotateFrom)
    val duration = (span.end - span.start).coerceAtLeast(0.12)
    val rate = options.animationSpeed.let { if (it <= 0) 1.0 else it.coerceIn(0.4, 2.5) }
    val fadeIn = if (spec.fadeIn <= 0) 0.0 else (spec.fadeIn / rate).coerceAtMost((duration * 0.4).coerceAtLeast(0.08))
    val rawEnter = if (fadeIn <= 0) 1f else ((seconds - span.start) / fadeIn).toFloat().coerceIn(0f, 1f)
    val enter = if (spec.easeBack) easeOutBack(rawEnter) else easeOutCubic(rawEnter)
    var exit = 1f
    if (span.fadeOut && spec.fadeOut > 0) {
      val fadeOut = (spec.fadeOut / rate).coerceAtMost((duration * 0.28).coerceAtLeast(0.08))
      exit = ((span.end - seconds) / fadeOut).toFloat().coerceIn(0f, 1f)
    }
    val leave = 1f - exit
    val hold = ((seconds - span.start - fadeIn).coerceAtLeast(0.0) * rate).toFloat()
    var rise = spec.risePercent * (1.0 - enter.toDouble())
    var slide = spec.slidePercent * (1.0 - enter.toDouble())
    var scale = spec.scaleFrom + (1f - spec.scaleFrom) * enter
    var rotation = spec.rotateFrom * (1f - enter)
    when (options.animation) {
      "float" -> rise += sin(hold * 2.4f).toDouble() * 0.55 * enter
      "glow" -> scale *= 1f + (0.5f + 0.5f * sin(hold * 3.6f).toFloat()) * 0.05f * enter
    }
    if (leave > 0f) {
      rise += spec.risePercent * 0.4 * leave
      slide += spec.slidePercent * 0.45 * leave
      rotation += spec.rotateFrom * 0.45f * leave
      scale = scale * exit + spec.scaleFrom * leave
    }
    return OverlayMotion(
      alpha = (enter * exit).coerceIn(0f, 1f),
      scale = scale,
      risePercent = rise,
      slidePercent = slide,
      rotation = rotation,
    )
  }

  private fun composeLive(base: Bitmap, seconds: Double): Bitmap {
    val pad = (18f * overlayScale).toInt().coerceAtLeast(12)
    val width = base.width + pad * 2
    val height = base.height + pad * 2
    val out = nextLive(width, height)
    val canvas = Canvas(out)
    val textColor = parseCssColor(options.color, Color.WHITE)
    val rate = options.animationSpeed.let { if (it <= 0) 1.0 else it.coerceIn(0.4, 2.5) }
    if (options.animation == "glow") {
      val pulse = (0.5 + 0.5 * sin(seconds * 3.6 * rate)).toFloat()
      val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        colorFilter = PorterDuffColorFilter(textColor, PorterDuff.Mode.SRC_ATOP)
        alpha = (70 + 110 * pulse).toInt().coerceIn(0, 255)
      }
      val matrix = Matrix()
      matrix.setScale(1.08f + pulse * 0.04f, 1.14f + pulse * 0.05f, width / 2f, height / 2f)
      canvas.save()
      canvas.concat(matrix)
      canvas.drawBitmap(base, pad.toFloat(), pad.toFloat(), glowPaint)
      canvas.restore()
    }
    canvas.drawBitmap(base, pad.toFloat(), pad.toFloat(), null)
    if (options.animation == "sparkle") {
      drawSparkles(canvas, width, height, seconds, textColor, rate)
    }
    return out
  }

  private fun nextLive(width: Int, height: Int): Bitmap {
    liveToggle = !liveToggle
    val current = if (liveToggle) liveA else liveB
    if (current != null && current.width == width && current.height == height) {
      current.eraseColor(Color.TRANSPARENT)
      return current
    }
    current?.recycle()
    val created = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    if (liveToggle) liveA = created else liveB = created
    return created
  }

  private fun drawSparkles(canvas: Canvas, width: Int, height: Int, seconds: Double, color: Int, rate: Double) {
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val slots = 11
    for (index in 0 until slots) {
      val along = (index % 6) / 5f
      val top = index < 6
      val x = (0.06f + along * 0.88f) * width + sin(index * 12.9898).toFloat() * 0.03f * width
      val y = (if (top) 0.14f else 0.86f) * height + sin(index * 78.233).toFloat() * 0.06f * height
      val phase = ((seconds * 2.6 * rate + index * 0.37) % 1.0 + 1.0) % 1.0
      val twinkle = sin(phase * PI).toFloat().let { it * it }
      if (twinkle < 0.08f) continue
      val radius = (2.6f + (index % 3) * 1.2f) * overlayScale * (0.4f + 0.6f * twinkle)
      paint.color = Color.argb(
        (twinkle * 230).toInt().coerceIn(0, 255),
        min(255, Color.red(color) + 36),
        min(255, Color.green(color) + 24),
        min(255, Color.blue(color) + 8),
      )
      drawStar(canvas, x, y, radius, paint)
    }
  }

  private fun drawStar(canvas: Canvas, cx: Float, cy: Float, radius: Float, paint: Paint) {
    canvas.save()
    canvas.translate(cx, cy)
    canvas.drawCircle(0f, 0f, radius * 0.32f, paint)
    canvas.drawRect(-radius * 0.16f, -radius, radius * 0.16f, radius, paint)
    canvas.drawRect(-radius, -radius * 0.16f, radius, radius * 0.16f, paint)
    canvas.restore()
  }

  private data class WheelLine(val id: String, val text: String, val start: Double, val end: Double)

  private fun wheelLines(): List<WheelLine> {
    val cues = options.cues
    val lines = mutableListOf<WheelLine>()
    var index = 0
    while (index < cues.size) {
      if (cues[index].text.isBlank()) {
        index += 1
        continue
      }
      val id = cueId(cues[index])
      var last = index
      while (last < cues.lastIndex && cueId(cues[last + 1]) == id) {
        last += 1
      }
      lines.add(WheelLine(id, cues[index].text, cues[index].start, cues[last].end))
      index = last + 1
    }
    return lines
  }

  private fun drawWheel(seconds: Double): Bitmap {
    val lines = wheelLines()
    if (lines.isEmpty()) {
      return emptyBitmap
    }
    val index = lines.indexOfLast { seconds >= it.start }
    if (index < 0) {
      return emptyBitmap
    }
    val current = lines[index]
    val span = (current.end - current.start).coerceAtLeast(0.12)
    val progress = ((seconds - current.start) / span).coerceIn(0.0, 1.0)
    val slide = if (progress <= 0.62) 0.0 else (progress - 0.62) / 0.38
    val position = index + slide
    val rowH = (fontPx * 1.35f).coerceAtLeast(28f)
    val width = max(2, (videoWidth * 0.88f).toInt())
    val height = max(2, (rowH * 5 + 16f * overlayScale).toInt())
    val out = nextLive(width, height)
    val canvas = Canvas(out)
    val bg = options.backgroundColor?.let { parseCssColor(it, Color.TRANSPARENT) } ?: Color.argb(108, 10, 10, 16)
    if (Color.alpha(bg) > 0) {
      val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = bg }
      canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), 16f * overlayScale, 16f * overlayScale, fill)
    }
    val band = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(36, 255, 255, 255) }
    val bandTop = height / 2f - rowH / 2f
    canvas.drawRect(0f, bandTop, width.toFloat(), bandTop + rowH, band)
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
      textSize = fontPx
      color = parseCssColor(options.color, Color.WHITE)
      typeface = typefaceFor(current.text)
      if (options.outline) {
        setShadowLayer(3f * overlayScale, 0f, 1f * overlayScale, Color.BLACK)
      }
    }
    val alignment = when (options.align) {
      "left" -> Layout.Alignment.ALIGN_NORMAL
      "right" -> Layout.Alignment.ALIGN_OPPOSITE
      else -> Layout.Alignment.ALIGN_CENTER
    }
    val first = max(0, kotlin.math.floor(position - 2).toInt())
    val last = min(lines.lastIndex, kotlin.math.ceil(position + 2).toInt())
    for (lineIndex in first..last) {
      val slot = (lineIndex - position).toFloat()
      val distance = kotlin.math.abs(slot)
      paint.alpha = ((1f - distance * 0.38f).coerceIn(0.18f, 1f) * 255).toInt()
      val layout = layoutFor(lines[lineIndex].text, paint, (width - 20 * overlayScale).toInt().coerceAtLeast(1), alignment)
      canvas.save()
      val scale = (1f - distance * 0.12f).coerceIn(0.72f, 1f)
      val cy = height / 2f + slot * rowH
      canvas.translate(10f * overlayScale, cy - layout.height / 2f)
      canvas.scale(scale, scale, (width / 2f) - 10f * overlayScale, layout.height / 2f)
      layout.draw(canvas)
      canvas.restore()
    }
    return out
  }

  private data class DepthSlot(
    val opacity: Float,
    val scale: Float,
    val tx: Float,
    val ty: Float,
    val rx: Float,
    val ry: Float,
    val hide: Boolean,
  )

  private fun isDepthAnimation(id: String): Boolean {
    return id == "flip" || id == "coverflow" || id == "prism"
  }

  private fun depthVisible(mode: String): Int {
    return if (mode == "flip" || mode == "prism") 1 else 2
  }

  private fun depthSlot(mode: String, slot: Float, rowH: Float, rowW: Float): DepthSlot {
    val distance = abs(slot)
    return when (mode) {
      "flip" -> {
        val ry = slot * 90f
        DepthSlot((1f - distance * 0.55f).coerceIn(0f, 1f), 1f, 0f, 0f, 0f, ry, abs(cos(ry * PI / 180.0)) < 0.12)
      }
      "coverflow" -> DepthSlot(
        (1f - distance * 0.32f).coerceIn(0.18f, 1f),
        (1f - distance * 0.16f).coerceIn(0.64f, 1f),
        slot * rowW * 0.38f,
        abs(slot) * rowH * 0.08f,
        0f,
        -slot * 50f,
        distance > 2.15f,
      )
      "prism" -> {
        val ry = slot * 120f
        val facing = cos(ry * PI / 180.0)
        val hide = facing < 0.18 || distance > 0.95f
        DepthSlot(
          if (hide) 0f else (1f - distance * 0.22f).coerceIn(0.28f, 1f),
          1f,
          sin(ry * PI / 180.0).toFloat() * rowW * 0.18f,
          0f,
          8f,
          ry,
          hide,
        )
      }
      else -> DepthSlot(0f, 1f, 0f, 0f, 0f, 0f, true)
    }
  }

  private fun drawDepth(seconds: Double): Bitmap {
    val lines = wheelLines()
    if (lines.isEmpty()) {
      return emptyBitmap
    }
    val index = lines.indexOfLast { seconds >= it.start }
    if (index < 0) {
      return emptyBitmap
    }
    val current = lines[index]
    val span = (current.end - current.start).coerceAtLeast(0.12)
    val progress = ((seconds - current.start) / span).coerceIn(0.0, 1.0)
    val slide = if (progress <= 0.62) 0.0 else (progress - 0.62) / 0.38
    val position = index + slide
    val mode = options.animation
    val visible = depthVisible(mode)
    val rowH = (fontPx * 1.35f).coerceAtLeast(28f)
    val widthFactor = if (mode == "coverflow") 0.96f else 0.88f
    val width = max(2, (videoWidth * widthFactor).toInt())
    val height = max(2, (rowH * (visible * 2 + 1) + 16f * overlayScale).toInt())
    val out = nextLive(width, height)
    val canvas = Canvas(out)
    val bg = options.backgroundColor?.let { parseCssColor(it, Color.TRANSPARENT) } ?: Color.argb(108, 10, 10, 16)
    if (Color.alpha(bg) > 0) {
      val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = bg }
      canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), 16f * overlayScale, 16f * overlayScale, fill)
    }
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
      textSize = fontPx
      color = parseCssColor(options.color, Color.WHITE)
      typeface = typefaceFor(current.text)
      if (options.outline) {
        setShadowLayer(3f * overlayScale, 0f, 1f * overlayScale, Color.BLACK)
      }
    }
    val alignment = when (options.align) {
      "left" -> Layout.Alignment.ALIGN_NORMAL
      "right" -> Layout.Alignment.ALIGN_OPPOSITE
      else -> Layout.Alignment.ALIGN_CENTER
    }
    val first = max(0, kotlin.math.floor(position - visible).toInt())
    val last = min(lines.lastIndex, kotlin.math.ceil(position + visible).toInt())
    val textWidth = (width - 20 * overlayScale).toInt().coerceAtLeast(1)
    for (lineIndex in first..last) {
      val slot = (lineIndex - position).toFloat()
      val look = depthSlot(mode, slot, rowH, width.toFloat())
      if (look.hide || look.opacity <= 0.02f) continue
      paint.alpha = (look.opacity * 255).toInt().coerceIn(0, 255)
      val layout = layoutFor(lines[lineIndex].text, paint, textWidth, alignment)
      canvas.save()
      val cy = height / 2f + look.ty
      val squashX = abs(cos(look.ry * PI / 180.0)).toFloat().coerceAtLeast(0.12f)
      val squashY = abs(cos(look.rx * PI / 180.0)).toFloat().coerceAtLeast(0.18f)
      canvas.translate(10f * overlayScale + look.tx, cy - layout.height / 2f)
      canvas.scale(look.scale * squashX, look.scale * squashY, textWidth / 2f, layout.height / 2f)
      layout.draw(canvas)
      canvas.restore()
    }
    return out
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

  private fun easeOutBack(t: Float): Float {
    val x = t.coerceIn(0f, 1f)
    val overshoot = 1.70158f
    val inv = x - 1f
    return 1f + (overshoot + 1f) * inv * inv * inv + overshoot * inv * inv
  }

  private fun typefaceFor(text: String): Typeface {
    val style = typefaceStyle(options)
    if (needsSystemFont(text)) {
      return Typeface.create("sans-serif", style)
    }
    bundledTypeface(options.fontFamily)?.let { loaded ->
      return Typeface.create(loaded, style)
    }
    return Typeface.create(androidFontFamily(options.fontFamily), style)
  }

  private fun bundledTypeface(id: String): Typeface? {
    val file = when (id) {
      "dancing" -> "DancingScript.ttf"
      "elegant" -> "GreatVibes-Regular.ttf"
      "pacifico" -> "Pacifico-Regular.ttf"
      "parisienne" -> "Parisienne-Regular.ttf"
      "signature" -> "Allura-Regular.ttf"
      else -> null
    } ?: return null
    return try {
      typefaces.getOrPut(file) { Typeface.createFromAsset(context.assets, "fonts/$file") }
    } catch (_: Exception) {
      typefaces.remove(file)
      null
    }
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
      "script", "dancing", "elegant", "pacifico", "parisienne", "signature" -> "cursive"
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
