package expo.modules.videolyricexport

import android.util.Base64
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec

object ShazamDeveloperToken {
  fun resolve(jsToken: String?): String {
    val fromJs = jsToken?.trim().orEmpty()
    if (fromJs.isNotEmpty()) {
      return fromJs
    }
    val baked = BuildConfig.SHAZAM_DEVELOPER_TOKEN.trim()
    if (baked.isNotEmpty()) {
      return baked
    }
    val teamId = BuildConfig.SHAZAM_TEAM_ID.trim()
    val keyId = BuildConfig.SHAZAM_KEY_ID.trim()
    val privateKey = BuildConfig.SHAZAM_PRIVATE_KEY.trim()
    if (teamId.isEmpty() || keyId.isEmpty() || privateKey.isEmpty()) {
      return ""
    }
    return sign(teamId, keyId, privateKey)
  }

  fun isConfigured(jsToken: String?): Boolean {
    return resolve(jsToken).isNotEmpty()
  }

  private fun sign(teamId: String, keyId: String, pem: String): String {
    val now = System.currentTimeMillis() / 1000L
    val header = base64Url("""{"alg":"ES256","kid":"$keyId"}""".toByteArray())
    val payload = base64Url("""{"iss":"$teamId","iat":$now,"exp":${now + 86400 * 180}}""".toByteArray())
    val signingInput = "$header.$payload"
    val signature = Signature.getInstance("SHA256withECDSA")
    signature.initSign(ecPrivateKey(pem))
    signature.update(signingInput.toByteArray(Charsets.US_ASCII))
    return "$signingInput.${base64Url(derToJose(signature.sign()))}"
  }

  private fun ecPrivateKey(pem: String) = KeyFactory.getInstance("EC").generatePrivate(
    PKCS8EncodedKeySpec(
      Base64.decode(
        pem.replace("-----BEGIN PRIVATE KEY-----", "")
          .replace("-----END PRIVATE KEY-----", "")
          .replace("\\n", "")
          .replace("\n", "")
          .replace("\r", "")
          .replace(" ", ""),
        Base64.DEFAULT,
      ),
    ),
  )

  private fun derToJose(der: ByteArray): ByteArray {
    var index = 0
    require(der[index++] == 0x30.toByte()) { "Invalid ECDSA signature." }
    val seqLen = der[index].toInt() and 0xFF
    if (seqLen and 0x80 != 0) {
      index += 1 + (seqLen and 0x7F)
    } else {
      index += 1
    }
    require(der[index++] == 0x02.toByte()) { "Invalid ECDSA signature." }
    val rLen = der[index++].toInt() and 0xFF
    val r = der.copyOfRange(index, index + rLen)
    index += rLen
    require(der[index++] == 0x02.toByte()) { "Invalid ECDSA signature." }
    val sLen = der[index++].toInt() and 0xFF
    val s = der.copyOfRange(index, index + sLen)
    return pad32(r) + pad32(s)
  }

  private fun pad32(value: ByteArray): ByteArray {
    val stripped = value.dropWhile { it == 0.toByte() }.toByteArray()
    if (stripped.size > 32) {
      return stripped.copyOfRange(stripped.size - 32, stripped.size)
    }
    return ByteArray(32 - stripped.size) + stripped
  }

  private fun base64Url(data: ByteArray): String {
    return Base64.encodeToString(data, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
  }
}
