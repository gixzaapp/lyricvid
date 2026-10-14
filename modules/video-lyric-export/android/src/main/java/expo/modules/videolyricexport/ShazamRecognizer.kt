package expo.modules.videolyricexport

import com.shazam.shazamkit.AudioSampleRateInHz
import com.shazam.shazamkit.DeveloperToken
import com.shazam.shazamkit.DeveloperTokenProvider
import com.shazam.shazamkit.MatchResult
import com.shazam.shazamkit.ShazamKit
import com.shazam.shazamkit.ShazamKitResult
import kotlinx.coroutines.runBlocking
import java.io.File

object ShazamRecognizer {
  fun recognizeFile(clip: File, jsToken: String?): Map<String, String>? {
    val token = ShazamDeveloperToken.resolve(jsToken)
    if (token.isEmpty()) {
      throw IllegalStateException("detect.noToken")
    }
    val pcm = ShazamPcmDecoder.decodeMono16(clip)
    val sampleRate = when (pcm.sampleRate) {
      44_100 -> AudioSampleRateInHz.SAMPLE_RATE_44100
      32_000 -> AudioSampleRateInHz.SAMPLE_RATE_32000
      16_000 -> AudioSampleRateInHz.SAMPLE_RATE_16000
      else -> AudioSampleRateInHz.SAMPLE_RATE_48000
    }
    return runBlocking {
      val catalog = ShazamKit.createShazamCatalog(object : DeveloperTokenProvider {
        override fun provideDeveloperToken(): DeveloperToken {
          return DeveloperToken(token)
        }
      })
      val queryBytes = clipToCatalogWindow(pcm.bytes, pcm.sampleRate, catalog.maximumQuerySignatureDurationInMs)
      val generator = when (val created = ShazamKit.createSignatureGenerator(sampleRate)) {
        is ShazamKitResult.Success -> created.data
        is ShazamKitResult.Failure -> throw IllegalStateException(created.reason.message ?: "detect.requestFailed")
      }
      generator.append(queryBytes, queryBytes.size, System.currentTimeMillis())
      val signature = generator.generateSignature()
      val session = when (val created = ShazamKit.createSession(catalog)) {
        is ShazamKitResult.Success -> created.data
        is ShazamKitResult.Failure -> throw IllegalStateException(created.reason.message ?: "detect.requestFailed")
      }
      when (val result = session.match(signature)) {
        is MatchResult.Match -> {
          val item = result.matchedMediaItems.firstOrNull() ?: return@runBlocking null
          val title = item.title?.trim().orEmpty()
          val artist = item.artist?.trim().orEmpty()
          if (title.isEmpty() || artist.isEmpty()) {
            null
          } else {
            mapOf(
              "title" to title,
              "artist" to artist,
              "album" to item.subtitle?.trim().orEmpty(),
            )
          }
        }
        is MatchResult.NoMatch -> null
        is MatchResult.Error -> throw IllegalStateException(result.exception.message ?: "detect.requestFailed")
      }
    }
  }

  private fun clipToCatalogWindow(pcm: ByteArray, sampleRate: Int, maxDurationMs: Long): ByteArray {
    val bytesPerSecond = sampleRate * 2
    val maxMs = if (maxDurationMs > 0) maxDurationMs else 12_000L
    val maxBytes = ((maxMs - 250L).coerceAtLeast(3_000L) * bytesPerSecond / 1000L).toInt()
      .coerceAtMost(pcm.size)
      .and(1.inv())
    if (maxBytes < bytesPerSecond * 3) {
      throw IllegalStateException("detect.unrecognized")
    }
    return if (pcm.size <= maxBytes) pcm else pcm.copyOf(maxBytes)
  }
}
