package expo.modules.videolyricexport

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

data class PcmAudio(
  val bytes: ByteArray,
  val sampleRate: Int,
)

object ShazamPcmDecoder {
  fun decodeMono16(source: File): PcmAudio {
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      extractor.setDataSource(source.absolutePath)
      val audioIndex = (0 until extractor.trackCount).firstOrNull { index ->
        extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: throw IllegalStateException("The selected media has no audio track.")
      val format = extractor.getTrackFormat(audioIndex)
      val mime = format.getString(MediaFormat.KEY_MIME)
        ?: throw IllegalStateException("The selected media has no audio track.")
      extractor.selectTrack(audioIndex)
      codec = MediaCodec.createDecoderByType(mime)
      codec.configure(format, null, null, 0)
      codec.start()

      val pcm = ByteArrayOutputStream()
      val info = MediaCodec.BufferInfo()
      var sawInputEOS = false
      var sawOutputEOS = false
      var outputRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT).coerceAtLeast(1)

      while (!sawOutputEOS) {
        if (!sawInputEOS) {
          val inputIndex = codec.dequeueInputBuffer(10_000)
          if (inputIndex >= 0) {
            val input = codec.getInputBuffer(inputIndex) ?: throw IllegalStateException("Could not decode audio.")
            val size = extractor.readSampleData(input, 0)
            if (size < 0) {
              codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              sawInputEOS = true
            } else {
              codec.queueInputBuffer(inputIndex, 0, size, extractor.sampleTime.coerceAtLeast(0L), 0)
              extractor.advance()
            }
          }
        }

        val outputIndex = codec.dequeueOutputBuffer(info, 10_000)
        if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          val outFormat = codec.outputFormat
          if (outFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
            outputRate = outFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          }
          if (outFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
            channels = outFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT).coerceAtLeast(1)
          }
        } else if (outputIndex >= 0) {
          val output = codec.getOutputBuffer(outputIndex)
          if (output != null && info.size > 0) {
            output.position(info.offset)
            output.limit(info.offset + info.size)
            val chunk = ByteArray(info.size)
            output.get(chunk)
            pcm.write(downmixToMono(chunk, channels))
          }
          codec.releaseOutputBuffer(outputIndex, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
            sawOutputEOS = true
          }
        }
      }

      val bytes = pcm.toByteArray()
      if (bytes.isEmpty()) {
        throw IllegalStateException("The extracted audio clip was empty.")
      }
      return PcmAudio(resampleIfNeeded(bytes, outputRate), if (isSupportedRate(outputRate)) outputRate else 48_000)
    } finally {
      try {
        codec?.stop()
      } catch (_: Exception) {
      }
      codec?.release()
      extractor.release()
    }
  }

  private fun downmixToMono(pcm: ByteArray, channels: Int): ByteArray {
    if (channels <= 1) {
      return pcm
    }
    val samples = pcm.size / 2
    val frames = samples / channels
    val mono = ByteArray(frames * 2)
    val source = ByteBuffer.wrap(pcm).order(ByteOrder.LITTLE_ENDIAN)
    val dest = ByteBuffer.wrap(mono).order(ByteOrder.LITTLE_ENDIAN)
    repeat(frames) {
      var sum = 0
      repeat(channels) {
        sum += source.short.toInt()
      }
      dest.putShort((sum / channels).coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort())
    }
    return mono
  }

  private fun isSupportedRate(sampleRate: Int): Boolean {
    return sampleRate == 48_000 || sampleRate == 44_100 || sampleRate == 32_000 || sampleRate == 16_000
  }

  private fun resampleIfNeeded(pcm: ByteArray, sampleRate: Int): ByteArray {
    if (isSupportedRate(sampleRate)) {
      return pcm
    }
    val inFrames = pcm.size / 2
    val outFrames = (inFrames.toLong() * 48_000L / sampleRate).toInt().coerceAtLeast(1)
    val source = ByteBuffer.wrap(pcm).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
    val dest = ByteArray(outFrames * 2)
    val out = ByteBuffer.wrap(dest).order(ByteOrder.LITTLE_ENDIAN)
    for (index in 0 until outFrames) {
      val position = index.toDouble() * sampleRate / 48_000.0
      val left = position.toInt().coerceIn(0, inFrames - 1)
      val right = (left + 1).coerceAtMost(inFrames - 1)
      val mix = position - left
      val sample = source.get(left) * (1.0 - mix) + source.get(right) * mix
      out.putShort(sample.toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort())
    }
    return dest
  }
}
