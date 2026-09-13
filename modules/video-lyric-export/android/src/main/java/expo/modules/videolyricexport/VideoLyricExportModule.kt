package expo.modules.videolyricexport

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.audio.ToInt16PcmAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.OverlayEffect
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

class LyricCue : Record {
  @Field var start: Double = 0.0
  @Field var end: Double = 0.0
  @Field var text: String = ""
  @Field var highlightStart: Int = 0
  @Field var highlightEnd: Int = 0
}

class ExportOptions : Record {
  @Field var videoUri: String = ""
  @Field var audioUri: String? = null
  @Field var replaceAudio: Boolean = false
  @Field var outputPath: String = ""
  @Field var duration: Double = 0.0
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
  @Field var cues: List<LyricCue> = emptyList()
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
        copyToLocalFile(context, options.videoUri, "lyricvid-source.mp4")
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
        highestAudioSampleRate(localVideo),
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

      val videoSize = videoDisplaySize(localVideo)
      val previewWidth = options.previewWidth.takeIf { it > 1.0 } ?: 360.0
      overlayScale = (videoSize.first / previewWidth).toFloat().coerceAtLeast(0.75f)
      overlayFontPx = (options.fontSize * overlayScale).toInt().coerceAtLeast(1)

      val lyricOverlay = LyricBitmapOverlay(
        options,
        videoSize.first,
        overlayScale,
        overlayFontPx.toFloat(),
      )

      val sonic = SonicAudioProcessor().apply {
        setOutputSampleRateHz(44100)
      }
      val effects = Effects(
        listOf(ToInt16PcmAudioProcessor(), sonic),
        listOf(OverlayEffect(listOf(lyricOverlay))),
      )

      val videoFileUs = videoDurationUs(localVideo)
      val requestedUs = if (options.duration > 0) (options.duration * 1_000_000.0).toLong() else 0L
      val durationUs = when {
        videoFileUs > 0L && requestedUs > 0L -> minOf(videoFileUs, requestedUs)
        videoFileUs > 0L -> videoFileUs
        else -> requestedUs
      }

      val videoItem = EditedMediaItem.Builder(clippedMedia(Uri.fromFile(localVideo), durationUs))
        .setRemoveAudio(options.replaceAudio && !options.audioUri.isNullOrBlank())
        .setEffects(effects)
        .build()

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
    val local = copyToLocalFile(context, sourceUri, "lyricvid-detect-src-${System.currentTimeMillis()}")
    val output = File(context.cacheDir, "lyricvid-detect-${System.currentTimeMillis()}.m4a")
    if (output.exists()) {
      output.delete()
    }

    val extractor = MediaExtractor()
    val muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    try {
      extractor.setDataSource(local.absolutePath)
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

      extractor.selectTrack(audioIndex)
      val startUs = (startSeconds.coerceAtLeast(0.0) * 1_000_000.0).toLong()
      val endUs = startUs + (durationSeconds.coerceAtLeast(1.0) * 1_000_000.0).toLong()
      extractor.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)

      val destTrack = muxer.addTrack(format)
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
          info.presentationTimeUs = time - startUs
          info.flags = extractor.sampleFlags
          muxer.writeSampleData(destTrack, buffer, info)
          wrote = true
        }
        extractor.advance()
      }
      if (!wrote) {
        throw IllegalStateException("Could not copy audio from that point in the clip.")
      }
    } finally {
      try {
        muxer.stop()
      } catch (_: Exception) {
      }
      muxer.release()
      extractor.release()
    }
    if (output.length() <= 0L) {
      throw IllegalStateException("The extracted audio clip was empty.")
    }
    return toFileUri(output.absolutePath)
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
