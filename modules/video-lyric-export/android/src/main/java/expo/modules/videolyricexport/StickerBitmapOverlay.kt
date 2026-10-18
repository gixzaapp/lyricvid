package expo.modules.videolyricexport

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import androidx.media3.common.OverlaySettings
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.StaticOverlaySettings
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

@UnstableApi
class StickerBitmapOverlay(
  private val sticker: ExportSticker,
  private var overlayScale: Float,
) : BitmapOverlay() {
  private var liveA: Bitmap? = null
  private var liveB: Bitmap? = null
  private var liveToggle = false

  override fun getBitmap(presentationTimeUs: Long): Bitmap {
    val seconds = presentationTimeUs / 1_000_000.0
    val scale = overlayScale * sticker.scale.toFloat().coerceIn(0.5f, 2f)
    val (baseW, baseH) = when (sticker.kind) {
      "beats" -> 220f to 86f
      "player" -> 268f to 92f
      "cassette" -> 128f to 68f
      else -> 120f to 148f
    }
    val width = max(2, (baseW * scale).toInt())
    val height = max(2, (baseH * scale).toInt())
    val out = nextLive(width, height)
    val canvas = Canvas(out)
    when (sticker.kind) {
      "cassette" -> drawCassette(canvas, out.width, out.height, scale, seconds)
      "music" -> drawMusic(canvas, out.width, out.height, scale, seconds)
      "beats" -> drawBeats(canvas, out.width, out.height, scale, seconds)
      "player" -> drawPlayer(canvas, out.width, out.height, scale, seconds)
      else -> drawVinyl(canvas, out.width, out.height, scale, seconds)
    }
    return out
  }

  override fun getOverlaySettings(presentationTimeUs: Long): OverlaySettings {
    return StaticOverlaySettings.Builder()
      .setBackgroundFrameAnchor(percentToAnchorX(sticker.x), percentToAnchorY(sticker.y))
      .setOverlayFrameAnchor(0f, 0f)
      .setScale(1f, 1f)
      .build()
  }

  private fun drawVinyl(canvas: Canvas, width: Int, height: Int, scale: Float, seconds: Double) {
    val cx = width / 2f
    val cy = width / 2f
    val radius = width * 0.42f
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = Color.parseColor("#121212")
    canvas.drawCircle(cx, cy, radius, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 5f * scale
    paint.color = Color.parseColor("#2C2C2C")
    canvas.drawCircle(cx, cy, radius, paint)
    paint.strokeWidth = 1.2f * scale
    paint.color = Color.argb(40, 255, 255, 255)
    canvas.drawCircle(cx, cy, radius * 0.78f, paint)
    canvas.drawCircle(cx, cy, radius * 0.6f, paint)
    canvas.save()
    canvas.rotate((seconds * 72.0).toFloat() % 360f, cx, cy)
    paint.style = Paint.Style.FILL
    paint.color = Color.parseColor("#C44B4B")
    canvas.drawCircle(cx, cy, radius * 0.34f, paint)
    drawCenteredTitle(canvas, sticker.title, cx, cy, radius * 0.56f, (7f * scale).coerceAtLeast(8f), Color.parseColor("#FFF4E8"))
    paint.color = Color.parseColor("#0B0B12")
    canvas.drawCircle(cx, cy, 5f * scale, paint)
    canvas.restore()
  }

  private fun drawCassette(canvas: Canvas, width: Int, height: Int, scale: Float, seconds: Double) {
    val pad = 8f * scale
    val body = RectF(0.5f * scale, 0.5f * scale, width - 0.5f * scale, height - 0.5f * scale)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = Color.parseColor("#1C2438")
    canvas.drawRoundRect(body, 10f * scale, 10f * scale, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 1f * scale
    paint.color = Color.parseColor("#6F7A99")
    canvas.drawRoundRect(body, 10f * scale, 10f * scale, paint)
    paint.style = Paint.Style.FILL
    drawLineText(
      canvas,
      sticker.title,
      pad,
      pad - 2f * scale,
      width - pad * 2,
      (9f * scale).coerceAtLeast(8f),
      Color.parseColor("#F4E8C8"),
      Layout.Alignment.ALIGN_CENTER,
    )
    val windowH = 34f * scale
    val window = RectF(
      pad,
      height - pad - windowH,
      width - pad,
      height - pad,
    )
    paint.color = Color.parseColor("#0A1020")
    canvas.drawRoundRect(window, 6f * scale, 6f * scale, paint)
    val reelY = window.centerY()
    val reelR = 11f * scale
    val angle = (seconds * 160.0).toFloat()
    drawReel(canvas, window.left + 16f * scale, reelY, reelR, angle, scale)
    drawReel(canvas, window.right - 16f * scale, reelY, reelR, angle, scale)
    paint.color = Color.parseColor("#6B4423")
    canvas.drawRoundRect(
      RectF(window.centerX() - 14f * scale, reelY - 2f * scale, window.centerX() + 14f * scale, reelY + 2f * scale),
      2f * scale,
      2f * scale,
      paint,
    )
  }

  private fun drawReel(canvas: Canvas, cx: Float, cy: Float, radius: Float, angle: Float, scale: Float) {
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = Color.parseColor("#3A2A18")
    canvas.drawCircle(cx, cy, radius, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 2f * scale
    paint.color = Color.parseColor("#C9A46A")
    canvas.drawCircle(cx, cy, radius, paint)
    paint.color = Color.parseColor("#E8D2A0")
    paint.strokeWidth = 2f * scale
    canvas.save()
    canvas.rotate(angle, cx, cy)
    canvas.drawLine(cx - radius * 0.55f, cy, cx + radius * 0.55f, cy, paint)
    canvas.drawLine(cx, cy - radius * 0.55f, cx, cy + radius * 0.55f, paint)
    canvas.restore()
  }

  private fun drawBeats(canvas: Canvas, width: Int, height: Int, scale: Float, seconds: Double) {
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val pad = 2f * scale
    val body = RectF(pad, pad, width - pad, height - 20f * scale)
    paint.color = Color.parseColor("#050505")
    canvas.drawRoundRect(body, 16f * scale, 16f * scale, paint)
    val bars = 32
    val inner = RectF(
      body.left + 8f * scale,
      body.top + 8f * scale,
      body.right - 8f * scale,
      body.bottom - 8f * scale,
    )
    val gap = 1.5f * scale
    val barW = ((inner.width() - gap * (bars - 1)) / bars).coerceAtLeast(1.5f * scale)
    paint.style = Paint.Style.FILL
    for (index in 0 until bars) {
      val t = index / (bars - 1).toFloat()
      val hsv = floatArrayOf(t * 280f, 1f, 1f)
      paint.color = Color.HSVToColor(hsv)
      val wave = (
        0.34 * (0.5 + 0.5 * sin(seconds * 8.4 + index * 0.42)) +
          0.36 * (0.5 + 0.5 * sin(seconds * 13.1 + index * 0.88)) +
          0.30 * (0.5 + 0.5 * sin(seconds * 5.6 + index * 0.21))
        )
      val barH = (inner.height() * (0.18 + 0.82 * wave)).toFloat().coerceAtLeast(5f * scale)
      val left = inner.left + index * (barW + gap)
      val top = inner.bottom - barH
      canvas.drawRoundRect(RectF(left, top, left + barW, inner.bottom), barW / 2f, barW / 2f, paint)
    }
    drawCenteredTitle(
      canvas,
      sticker.title,
      width / 2f,
      height - 10f * scale,
      width - 8f * scale,
      (9f * scale).coerceAtLeast(10f),
      Color.WHITE,
    )
  }

  private fun drawPlayer(canvas: Canvas, width: Int, height: Int, scale: Float, seconds: Double) {
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val body = RectF(2f * scale, 2f * scale, width - 2f * scale, height - 2f * scale)
    paint.color = Color.argb(196, 255, 255, 255)
    canvas.drawRoundRect(body, 22f * scale, 22f * scale, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 1.2f * scale
    paint.color = Color.argb(90, 255, 255, 255)
    canvas.drawRoundRect(body, 22f * scale, 22f * scale, paint)
    paint.style = Paint.Style.FILL
    val art = RectF(
      body.left + 12f * scale,
      body.centerY() - 20f * scale,
      body.left + 52f * scale,
      body.centerY() + 20f * scale,
    )
    paint.color = Color.parseColor("#C8B49A")
    canvas.drawRoundRect(art, 10f * scale, 10f * scale, paint)
    paint.color = Color.parseColor("#3A2A1C")
    canvas.drawCircle(art.centerX() - 4f * scale, art.centerY() + 4f * scale, 5f * scale, paint)
    paint.strokeWidth = 2.4f * scale
    paint.style = Paint.Style.STROKE
    canvas.drawLine(art.centerX() + 3f * scale, art.centerY() - 10f * scale, art.centerX() + 3f * scale, art.centerY() + 6f * scale, paint)
    canvas.drawLine(art.centerX() + 3f * scale, art.centerY() - 10f * scale, art.centerX() + 12f * scale, art.centerY() - 7f * scale, paint)
    paint.style = Paint.Style.FILL
    val textLeft = art.right + 10f * scale
    val textWidth = body.right - textLeft - 12f * scale
    drawLineText(canvas, sticker.title, textLeft, body.top + 16f * scale, textWidth, (12f * scale).coerceAtLeast(13f), Color.parseColor("#1A1A1A"))
    val artist = sticker.artist.ifBlank { "Artist" }
    drawLineText(canvas, artist, textLeft, body.top + 32f * scale, textWidth, (10f * scale).coerceAtLeast(11f), Color.parseColor("#6B6B6B"))
    val track = RectF(textLeft, body.bottom - 28f * scale, body.right - 12f * scale, body.bottom - 25f * scale)
    paint.color = Color.argb(56, 80, 80, 80)
    canvas.drawRoundRect(track, 2f * scale, 2f * scale, paint)
    val total = if (sticker.duration > 0.05) sticker.duration else 1.0
    val progress = (seconds / total).coerceIn(0.0, 1.0).toFloat()
    paint.color = Color.parseColor("#2B2B2B")
    canvas.drawRoundRect(
      RectF(track.left, track.top, track.left + max(4f * scale, track.width() * progress), track.bottom),
      2f * scale,
      2f * scale,
      paint,
    )
    val remaining = max(0.0, total - seconds)
    drawLineText(canvas, formatClock(seconds), textLeft, body.bottom - 18f * scale, textWidth * 0.45f, (9f * scale).coerceAtLeast(10f), Color.parseColor("#7A7A7A"))
    drawLineText(
      canvas,
      "-${formatClock(remaining)}",
      track.right - textWidth * 0.35f,
      body.bottom - 18f * scale,
      textWidth * 0.35f,
      (9f * scale).coerceAtLeast(10f),
      Color.parseColor("#7A7A7A"),
      Layout.Alignment.ALIGN_OPPOSITE,
    )
  }

  private fun formatClock(seconds: Double): String {
    val total = max(0, seconds.toInt())
    return "%d:%02d".format(total / 60, total % 60)
  }

  private fun musicPulse(index: Int, seconds: Double): Float {
    val low = 0.18f + ((index * 11) % 28) / 100f
    val high = 0.55f + ((index * 7) % 45) / 100f
    val down = (130.0 + ((index * 2) % 5) * 28) / 1000.0
    val up = (160.0 + (index % 6) * 35) / 1000.0
    val t = seconds % (down + up)
    return if (t < down) {
      lerp(high, low, easeInOutQuad(t / down).toFloat())
    } else {
      lerp(low, high, easeInOutQuad((t - down) / up).toFloat())
    }
  }

  private fun lerp(from: Float, to: Float, amount: Float) = from + (to - from) * amount

  private fun easeInOutQuad(x: Double): Double {
    val t = x.coerceIn(0.0, 1.0)
    return if (t < 0.5) 2.0 * t * t else 1.0 - (2.0 * t - 2.0).let { it * it } / 2.0
  }

  private fun drawMusic(canvas: Canvas, width: Int, height: Int, scale: Float, seconds: Double) {
    val cx = width / 2f
    val cy = width / 2f
    val inner = 28f * scale
    val spikes = 72
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = Color.parseColor("#F4F4F4")
    paint.strokeWidth = 1.5f * scale
    paint.strokeCap = Paint.Cap.ROUND
    paint.style = Paint.Style.STROKE
    for (index in 0 until spikes) {
      val pulse = musicPulse((index * 3) % 18, seconds)
      val minH = (3 + index % 4) * scale
      val maxH = (16 + index % 13) * scale
      val length = inner + minH + pulse * (maxH - minH)
      val angle = index * (Math.PI * 2.0 / spikes) - Math.PI / 2.0
      canvas.drawLine(
        (cx + cos(angle) * inner).toFloat(),
        (cy + sin(angle) * inner).toFloat(),
        (cx + cos(angle) * length).toFloat(),
        (cy + sin(angle) * length).toFloat(),
        paint,
      )
    }
    drawCenteredTitle(
      canvas,
      sticker.title,
      cx,
      height - 16f * scale,
      width - 8f * scale,
      (11f * scale).coerceAtLeast(12f),
      Color.WHITE,
    )
  }

  private fun drawLineText(
    canvas: Canvas,
    text: String,
    x: Float,
    y: Float,
    maxWidth: Float,
    fontPx: Float,
    color: Int,
    align: Layout.Alignment = Layout.Alignment.ALIGN_NORMAL,
  ) {
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = fontPx
      this.color = color
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      textAlign = when (align) {
        Layout.Alignment.ALIGN_OPPOSITE -> Paint.Align.RIGHT
        Layout.Alignment.ALIGN_CENTER -> Paint.Align.CENTER
        else -> Paint.Align.LEFT
      }
    }
    val clipped = TextUtils.ellipsize(text, paint, maxWidth, TextUtils.TruncateAt.END).toString()
    val drawX = when (align) {
      Layout.Alignment.ALIGN_OPPOSITE -> x + maxWidth
      Layout.Alignment.ALIGN_CENTER -> x + maxWidth / 2f
      else -> x
    }
    canvas.drawText(clipped, drawX, y + fontPx, paint)
  }

  private fun drawCenteredTitle(
    canvas: Canvas,
    title: String,
    cx: Float,
    cy: Float,
    maxWidth: Float,
    fontPx: Float,
    color: Int,
  ) {
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = fontPx
      this.color = color
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setShadowLayer(3f, 0f, 1f, Color.BLACK)
    }
    val width = max(1, maxWidth.toInt())
    val layout = StaticLayout.Builder.obtain(title, 0, min(title.length, 28), paint, width)
      .setAlignment(Layout.Alignment.ALIGN_CENTER)
      .setIncludePad(false)
      .build()
    canvas.save()
    canvas.translate(cx - width / 2f, cy - layout.height / 2f)
    layout.draw(canvas)
    canvas.restore()
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

  private fun percentToAnchorX(percent: Double) = ((percent / 50.0) - 1.0).toFloat().coerceIn(-1f, 1f)

  private fun percentToAnchorY(percent: Double) = (1.0 - (percent / 50.0)).toFloat().coerceIn(-1f, 1f)
}
