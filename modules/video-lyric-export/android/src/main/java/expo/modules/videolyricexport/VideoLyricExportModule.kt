package expo.modules.videolyricexport

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.media.ExifInterface
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.audio.ToInt16PcmAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class LyricCue : Record {
  @Field var start: Double = 0.0
  @Field var end: Double = 0.0
  @Field var text: String = ""
  @Field var lineId: String = ""
  @Field var highlightStart: Int = 0
  @Field var highlightEnd: Int = 0
}

class ExportSticker : Record {
  @Field var kind: String = "vinyl"
  @Field var x: Double = 20.0
  @Field var y: Double = 18.0
  @Field var scale: Double = 1.0
  @Field var title: String = "Song"
  @Field var artist: String = "Artist"
  @Field var duration: Double = 0.0
}

class ExportOptions : Record {
  @Field var videoUri: String = ""
  @Field var audioUri: String? = null
  @Field var replaceAudio: Boolean = false
  @Field var outputPath: String = ""
  @Field var duration: Double = 0.0
  @Field var stillImage: Boolean = false
  @Field var fontSize: Double = 28.0
  @Field var fontFamily: String = "sans"
  @Field var previewWidth: Double = 360.0
  @Field var color: String = "#FFFFFF"
  @Field var accentColor: String = "#8B7CFF"
  @Field var backgroundColor: String? = null
  @Field var bold: Boolean = true
  @Field var italic: Boolean = false
  @Field var outline: Boolean = true
  @Field var align: String = "center"
  @Field var x: Double = 50.0
  @Field var y: Double = 78.0
  @Field var animation: String = "rise"
  @Field var animationSpeed: Double = 1.0
  @Field var cues: List<LyricCue> = emptyList()
  @Field var stickers: List<ExportSticker> = emptyList()
}

@UnstableApi
class VideoLyricExportModule : Module() {
  private var transformer: Transformer? = null
  private var overlayFontPx = 28
  private var overlayScale = 1f
  private val mainHandler = Handler(Looper.getMainLooper())
  private val progressHolder = ProgressHolder()
  private val progressTick = object : Runnable {
    override fun run() {
      val current = transformer ?: return
      try {
        val state = current.getProgress(progressHolder)
        if (state == Transformer.PROGRESS_STATE_AVAILABLE) {
          sendEvent("onExportProgress", mapOf("progress" to progressHolder.progress / 100.0))
        }
        mainHandler.postDelayed(this, 250)
      } catch (_: Exception) {
        stopProgressUpdates()
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("VideoLyricExport")
    Events("onExportProgress")

    AsyncFunction("extractAudioClip") { sourceUri: String, startSeconds: Double, durationSeconds: Double, promise: Promise ->
      val context = appContext.reactContext?.applicationContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "App is not ready to extract audio.", null)
        return@AsyncFunction
      }
      Thread {
        try {
          promise.resolve(extractAudioClip(context, sourceUri, startSeconds, durationSeconds))
        } catch (error: Exception) {
          promise.reject("EXTRACT_FAILED", error.message ?: "Could not extract an audio clip.", error)
        }
      }.start()
    }

    AsyncFunction("exportVideo") { options: ExportOptions, promise: Promise ->
      val context = appContext.reactContext?.applicationContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "App is not ready to export.", null)
        return@AsyncFunction
      }

      val outputPath = filePath(options.outputPath)
      val outputFile = File(outputPath)
      outputFile.parentFile?.mkdirs()
      if (outputFile.exists()) {
        outputFile.delete()
      }

      val localVideo = try {
        val sourceName = if (options.stillImage) {
          "lyricvid-source.${imageExtension(options.videoUri)}"
        } else {
          "lyricvid-source.mp4"
        }
        copyToLocalFile(context, options.videoUri, sourceName)
      } catch (error: Exception) {
        promise.reject("SOURCE_COPY_FAILED", error.message ?: "Could not open the selected video.", error)
        return@AsyncFunction
      }

      val localAudio = if (options.replaceAudio && !options.audioUri.isNullOrBlank()) {
        try {
          copyToLocalFile(context, options.audioUri!!, "lyricvid-source-audio")
        } catch (error: Exception) {
          promise.reject("SOURCE_COPY_FAILED", error.message ?: "Could not open the selected audio.", error)
          return@AsyncFunction
        }
      } else {
        null
      }

      val audioSampleRate = maxOf(
        if (options.stillImage) 0 else highestAudioSampleRate(localVideo),
        localAudio?.let(::highestAudioSampleRate) ?: 0,
      )
      if (audioSampleRate > 48000) {
        promise.reject(
          "HIRES_AUDIO",
          "HIRES_AUDIO:$audioSampleRate",
          null,
        )
        return@AsyncFunction
      }

      val stillSource = if (options.stillImage) {
        try {
          prepareStillImage(context, localVideo)
        } catch (error: Exception) {
          promise.reject("SOURCE_COPY_FAILED", error.message ?: "Could not read the selected photo.", error)
          return@AsyncFunction
        }
      } else {
        null
      }
      val exportVideo = stillSource?.first ?: localVideo
      val videoSize = stillSource?.second ?: videoDisplaySize(localVideo)
      val previewWidth = options.previewWidth.takeIf { it > 1.0 } ?: 360.0
      overlayScale = (videoSize.first / previewWidth).toFloat().coerceAtLeast(0.75f)
      overlayFontPx = (options.fontSize * overlayScale).toInt().coerceAtLeast(1)

      val lyricOverlay = LyricBitmapOverlay(
        context,
        options,
        videoSize.first,
        overlayScale,
        overlayFontPx.toFloat(),
      )
      val overlays = buildList {
        add(lyricOverlay)
        options.stickers.forEach { sticker ->
          add(StickerBitmapOverlay(sticker, overlayScale))
        }
      }

      val sonic = SonicAudioProcessor().apply {
        setOutputSampleRateHz(44100)
      }
      val videoEffects = if (options.stillImage) {
        listOf(
          Presentation.createForWidthAndHeight(
            videoSize.first,
            videoSize.second,
            Presentation.LAYOUT_STRETCH_TO_FIT,
          ),
          OverlayEffect(overlays),
        )
      } else {
        listOf(OverlayEffect(overlays))
      }
      val effects = Effects(
        listOf(ToInt16PcmAudioProcessor(), sonic),
        videoEffects,
      )

      val videoFileUs = if (options.stillImage) 0L else videoDurationUs(localVideo)
      val requestedUs = if (options.duration > 0) (options.duration * 1_000_000.0).toLong() else 0L
      val durationUs = when {
        options.stillImage && requestedUs > 0L -> requestedUs
        options.stillImage -> 30_000_000L
        videoFileUs > 0L && requestedUs > 0L -> minOf(videoFileUs, requestedUs)
        videoFileUs > 0L -> videoFileUs
        else -> requestedUs
      }

      val videoMedia = if (options.stillImage) {
        stillImageMedia(Uri.fromFile(exportVideo), durationUs)
      } else {
        clippedMedia(Uri.fromFile(exportVideo), durationUs)
      }
      val videoItemBuilder = EditedMediaItem.Builder(videoMedia)
        .setRemoveAudio(options.stillImage || (options.replaceAudio && !options.audioUri.isNullOrBlank()))
        .setEffects(effects)
      if (options.stillImage) {
        videoItemBuilder.setFrameRate(30)
        videoItemBuilder.setDurationUs(durationUs)
      }
      val videoItem = videoItemBuilder.build()

      val composition = if (localAudio != null) {
        val audioItem = EditedMediaItem.Builder(clippedMedia(Uri.fromFile(localAudio), durationUs))
          .setEffects(Effects(listOf(ToInt16PcmAudioProcessor(), SonicAudioProcessor().apply { setOutputSampleRateHz(44100) }), emptyList()))
          .build()
        Composition.Builder(
          EditedMediaItemSequence.Builder(videoItem).build(),
          EditedMediaItemSequence.Builder(audioItem).build(),
        ).setTransmuxAudio(false).build()
      } else {
        Composition.Builder(EditedMediaItemSequence.Builder(videoItem).build())
          .setTransmuxAudio(false)
          .build()
      }

      mainHandler.post {
        try {
          transformer?.cancel()
          val next = Transformer.Builder(context)
            .setLooper(Looper.getMainLooper())
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .addListener(object : Transformer.Listener {
              override fun onCompleted(completed: Composition, result: ExportResult) {
                stopProgressUpdates()
                sendEvent("onExportProgress", mapOf("progress" to 1.0))
                if (outputFile.exists() && outputFile.length() > 0L) {
                  promise.resolve(toFileUri(outputPath))
                } else {
                  promise.reject("EMPTY_OUTPUT", "The exported video was empty.", null)
                }
              }

              override fun onError(
                failed: Composition,
                result: ExportResult,
                exception: ExportException,
              ) {
                stopProgressUpdates()
                promise.reject("EXPORT_FAILED", exportErrorMessage(exception), exception)
              }
            })
            .build()
          transformer = next
          sendEvent("onExportProgress", mapOf("progress" to 0.05))
          startProgressUpdates()
          next.start(composition, outputPath)
        } catch (error: Exception) {
          stopProgressUpdates()
          promise.reject("EXPORT_FAILED", error.message ?: "Could not start video export.", error)
        }
      }
    }
  }

  private fun extractAudioClip(
    context: Context,
    sourceUri: String,
    startSeconds: Double,
    durationSeconds: Double,
  ): String {
    val local = copyToLocalFile(
      context,
      sourceUri,
      "lyricvid-detect-src-${System.currentTimeMillis()}.${fileExtension(sourceUri, "m4a")}",
    )
    val output = File(context.cacheDir, "lyricvid-detect-${System.currentTimeMillis()}.m4a")
    if (output.exists()) {
      output.delete()
    }

    val startUs = (startSeconds.coerceAtLeast(0.0) * 1_000_000.0).toLong()
    val endUs = startUs + (durationSeconds.coerceAtLeast(1.0) * 1_000_000.0).toLong()
    val copied = try {
      passthroughAacClip(local, output, startUs, endUs)
    } catch (error: Exception) {
      if (output.exists()) {
        output.delete()
      }
      if (error.message?.contains("no audio track") == true) {
        throw error
      }
      false
    }
    if (!copied) {
      if (output.exists()) {
        output.delete()
      }
      transcodeAudioClip(context, local, output, startSeconds, durationSeconds)
    }
    if (output.length() <= 0L) {
      throw IllegalStateException("The extracted audio clip was empty.")
    }
    return toFileUri(output.absolutePath)
  }

  private fun passthroughAacClip(source: File, output: File, startUs: Long, endUs: Long): Boolean {
    val extractor = MediaExtractor()
    var muxer: MediaMuxer? = null
    try {
      extractor.setDataSource(source.absolutePath)
      var audioIndex = -1
      var format: MediaFormat? = null
      for (index in 0 until extractor.trackCount) {
        val trackFormat = extractor.getTrackFormat(index)
        val mime = trackFormat.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("audio/")) {
          audioIndex = index
          format = trackFormat
          break
        }
      }
      if (audioIndex < 0 || format == null) {
        throw IllegalStateException("The selected media has no audio track.")
      }
      if (format.getString(MediaFormat.KEY_MIME) != MediaFormat.MIMETYPE_AUDIO_AAC) {
        return false
      }

      extractor.selectTrack(audioIndex)
      extractor.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      val destTrack = muxer.addTrack(aacMuxFormat(format))
      muxer.start()
      val buffer = ByteBuffer.allocate(256 * 1024)
      val info = MediaCodec.BufferInfo()
      var wrote = false
      while (true) {
        val size = extractor.readSampleData(buffer, 0)
        if (size < 0) {
          break
        }
        val time = extractor.sampleTime
        if (time > endUs) {
          break
        }
        if (time >= startUs) {
          info.offset = 0
          info.size = size
          info.presentationTimeUs = (time - startUs).coerceAtLeast(0L)
          info.flags = extractor.sampleFlags
          muxer.writeSampleData(destTrack, buffer, info)
          wrote = true
        }
        extractor.advance()
      }
      if (!wrote) {
        throw IllegalStateException("Could not copy audio from that point in the clip.")
      }
      return true
    } finally {
      try {
        muxer?.stop()
      } catch (_: Exception) {
      }
      muxer?.release()
      extractor.release()
    }
  }

  private fun aacMuxFormat(source: MediaFormat): MediaFormat {
    val format = MediaFormat.createAudioFormat(
      MediaFormat.MIMETYPE_AUDIO_AAC,
      source.getInteger(MediaFormat.KEY_SAMPLE_RATE),
      source.getInteger(MediaFormat.KEY_CHANNEL_COUNT),
    )
    source.getByteBuffer("csd-0")?.let { format.setByteBuffer("csd-0", it) }
    if (source.containsKey(MediaFormat.KEY_BIT_RATE)) {
      format.setInteger(MediaFormat.KEY_BIT_RATE, source.getInteger(MediaFormat.KEY_BIT_RATE))
    }
    return format
  }

  private fun transcodeAudioClip(
    context: Context,
    source: File,
    output: File,
    startSeconds: Double,
    durationSeconds: Double,
  ) {
    val startMs = (startSeconds.coerceAtLeast(0.0) * 1000.0).toLong()
    val endMs = startMs + (durationSeconds.coerceAtLeast(1.0) * 1000.0).toLong()
    val item = MediaItem.Builder()
      .setUri(Uri.fromFile(source))
      .setClippingConfiguration(
        MediaItem.ClippingConfiguration.Builder()
          .setStartPositionMs(startMs)
          .setEndPositionMs(endMs)
          .build(),
      )
      .build()
    val sonic = SonicAudioProcessor().apply { setOutputSampleRateHz(44100) }
    val editedBuilder = EditedMediaItem.Builder(item)
      .setEffects(Effects(listOf(ToInt16PcmAudioProcessor(), sonic), emptyList()))
    if (hasVideoTrack(source)) {
      editedBuilder.setRemoveVideo(true)
    }
    val edited = editedBuilder.build()
    val composition = Composition.Builder(EditedMediaItemSequence.Builder(edited).build())
      .setTransmuxAudio(false)
      .build()

    val latch = CountDownLatch(1)
    var failure: Exception? = null
    val clipTransformer = Transformer.Builder(context)
      .setLooper(Looper.getMainLooper())
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(completed: Composition, result: ExportResult) {
          latch.countDown()
        }

        override fun onError(failed: Composition, result: ExportResult, exception: ExportException) {
          failure = IllegalStateException(exportErrorMessage(exception), exception)
          latch.countDown()
        }
      })
      .build()

    mainHandler.post {
      try {
        clipTransformer.start(composition, output.absolutePath)
      } catch (error: Exception) {
        failure = error
        latch.countDown()
      }
    }
    if (!latch.await(90, TimeUnit.SECONDS)) {
      mainHandler.post { clipTransformer.cancel() }
      throw IllegalStateException("Audio clip extraction timed out.")
    }
    failure?.let { throw it }
  }

  private fun hasVideoTrack(source: File): Boolean {
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(source.absolutePath)
      (0 until extractor.trackCount).any { index ->
        extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true
      }
    } catch (_: Exception) {
      false
    } finally {
      extractor.release()
    }
  }

  private fun fileExtension(uri: String, fallback: String): String {
    val clean = uri.substringBefore('?').substringAfterLast('.', "").lowercase()
    return if (clean.length in 2..5 && clean.all { it.isLetterOrDigit() }) clean else fallback
  }

  private fun copyToLocalFile(context: Context, uriString: String, name: String): File {
    val dest = File(context.cacheDir, name)
    if (dest.exists()) {
      dest.delete()
    }
    val uri = Uri.parse(uriString)
    val input = when {
      uri.scheme == "file" || uri.scheme.isNullOrEmpty() -> FileInputStream(File(filePath(uriString)))
      else -> context.contentResolver.openInputStream(uri)
        ?: throw IllegalStateException("Cannot open the selected media.")
    }
    input.use { source ->
      FileOutputStream(dest).use { target ->
        source.copyTo(target)
      }
    }
    if (dest.length() <= 0L) {
      throw IllegalStateException("The selected media could not be copied.")
    }
    return dest
  }

  private fun exportErrorMessage(exception: ExportException): String {
    val parts = mutableListOf<String>()
    var current: Throwable? = exception
    while (current != null) {
      current.message?.takeIf { it.isNotBlank() && parts.lastOrNull() != it }?.let(parts::add)
      current = current.cause
    }
    return parts.joinToString(" → ").ifBlank { "Video export failed." }
  }

  private fun startProgressUpdates() {
    mainHandler.removeCallbacks(progressTick)
    mainHandler.post(progressTick)
  }

  private fun stopProgressUpdates() {
    mainHandler.removeCallbacks(progressTick)
  }

  private fun imageExtension(uri: String): String {
    val clean = uri.substringBefore('?').substringAfterLast('.').lowercase()
    return if (clean in setOf("jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "bmp")) clean else "jpg"
  }

  private fun stillImageMedia(uri: Uri, durationUs: Long): MediaItem {
    val durationMs = (durationUs / 1000L).coerceAtLeast(1000L)
    return MediaItem.Builder()
      .setUri(uri)
      .setImageDurationMs(durationMs)
      .build()
  }

  private fun prepareStillImage(context: Context, file: File): Pair<File, Pair<Int, Int>> {
    val decoded = decodeDisplayBitmap(file)
    val size = fitEven(decoded.width, decoded.height)
    val frame =
      if (decoded.width == size.first && decoded.height == size.second) {
        decoded
      } else {
        Bitmap.createScaledBitmap(decoded, size.first, size.second, true)
      }
    val prepared = File(context.cacheDir, "lyricvid-still-prepared.jpg")
    if (prepared.exists()) {
      prepared.delete()
    }
    FileOutputStream(prepared).use { output ->
      if (!frame.compress(Bitmap.CompressFormat.JPEG, 92, output)) {
        throw IllegalStateException("Could not prepare the selected photo.")
      }
    }
    if (frame !== decoded && !frame.isRecycled) {
      frame.recycle()
    }
    if (!decoded.isRecycled) {
      decoded.recycle()
    }
    return prepared to size
  }

  private fun decodeDisplayBitmap(file: File): Bitmap {
    if (Build.VERSION.SDK_INT >= 28) {
      return ImageDecoder.decodeBitmap(ImageDecoder.createSource(file)) { decoder, info, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        decoder.isMutableRequired = true
        val longSide = maxOf(info.size.width, info.size.height)
        if (longSide > 1920) {
          val scale = 1920f / longSide
          decoder.setTargetSize(
            evenSize((info.size.width * scale).toInt()),
            evenSize((info.size.height * scale).toInt()),
          )
        }
      }
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)
    val options = BitmapFactory.Options().apply {
      inPreferredConfig = Bitmap.Config.ARGB_8888
      inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, 1920)
    }
    val raw = BitmapFactory.decodeFile(file.absolutePath, options)
      ?: throw IllegalStateException("Could not read the selected photo.")
    return applyExifOrientation(file, raw)
  }

  private fun applyExifOrientation(file: File, bitmap: Bitmap): Bitmap {
    val orientation = try {
      ExifInterface(file.absolutePath).getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL,
      )
    } catch (_: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.postRotate(90f)
        matrix.preScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.postRotate(270f)
        matrix.preScale(-1f, 1f)
      }
      else -> return bitmap
    }
    val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    if (rotated !== bitmap) {
      bitmap.recycle()
    }
    return rotated
  }

  private fun sampleSize(width: Int, height: Int, maxSide: Int): Int {
    val longSide = maxOf(width, height)
    if (longSide <= 0 || longSide <= maxSide) {
      return 1
    }
    var sample = 1
    while (longSide / (sample * 2) >= maxSide) {
      sample *= 2
    }
    return sample
  }

  private fun evenSize(value: Int) = value.coerceAtLeast(2).let { it - it % 2 }

  private fun fitEven(width: Int, height: Int): Pair<Int, Int> {
    val scale = minOf(1080f / width.toFloat(), 1920f / height.toFloat(), 1f)
    return evenSize((width * scale).toInt()) to evenSize((height * scale).toInt())
  }

  private fun clippedMedia(uri: Uri, endUs: Long): MediaItem {
    val builder = MediaItem.Builder().setUri(uri)
    if (endUs > 0L) {
      builder.setClippingConfiguration(
        MediaItem.ClippingConfiguration.Builder()
          .setStartPositionUs(0)
          .setEndPositionUs(endUs)
          .build(),
      )
    }
    return builder.build()
  }

  private fun videoDurationUs(file: File): Long {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(file.absolutePath)
      val millis = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      millis * 1000L
    } catch (_: Exception) {
      0L
    } finally {
      retriever.release()
    }
  }

  private fun videoDisplaySize(file: File): Pair<Int, Int> {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(file.absolutePath)
      val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 1080
      val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 1920
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      if (rotation == 90 || rotation == 270) {
        height to width
      } else {
        width to height
      }
    } catch (_: Exception) {
      1080 to 1920
    } finally {
      retriever.release()
    }
  }

  private fun highestAudioSampleRate(file: File): Int {
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(file.absolutePath)
      var maxRate = 0
      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        if (!mime.startsWith("audio/")) continue
        if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
          maxRate = maxOf(maxRate, format.getInteger(MediaFormat.KEY_SAMPLE_RATE))
        }
      }
      maxRate
    } catch (_: Exception) {
      0
    } finally {
      extractor.release()
    }
  }

  private fun filePath(uri: String) = uri.removePrefix("file://")

  private fun toFileUri(path: String) = if (path.startsWith("file:")) path else "file://$path"
}
