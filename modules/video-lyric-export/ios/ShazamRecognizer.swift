import AVFoundation
import Foundation
import ShazamKit

final class ShazamFileMatcher: NSObject, SHSessionDelegate {
  private let session = SHSession()
  private var continuation: CheckedContinuation<[String: String]?, Error>?
  private var settled = false

  override init() {
    super.init()
    session.delegate = self
  }

  func recognize(clipUrl: URL) async throws -> [String: String]? {
    let asset = AVURLAsset(url: clipUrl)
    let signature: SHSignature
    if #available(iOS 16.0, *) {
      signature = try await SHSignatureGenerator.signature(from: asset)
    } else {
      throw NSError(
        domain: "VideoLyricExport",
        code: 16,
        userInfo: [NSLocalizedDescriptionKey: "Song detection needs iOS 16 or later."]
      )
    }

    return try await withCheckedThrowingContinuation { continuation in
      self.continuation = continuation
      self.session.match(signature)
      DispatchQueue.global().asyncAfter(deadline: .now() + 20) { [weak self] in
        self?.finish(.success(nil))
      }
    }
  }

  func session(_ session: SHSession, didFind match: SHMatch) {
    guard let item = match.mediaItems.first else {
      finish(.success(nil))
      return
    }
    let title = item.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let artist = item.artist?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if title.isEmpty || artist.isEmpty {
      finish(.success(nil))
      return
    }
    finish(.success([
      "title": title,
      "artist": artist,
      "album": item.subtitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
    ]))
  }

  func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: Error?) {
    if let error {
      finish(.failure(error))
      return
    }
    finish(.success(nil))
  }

  private func finish(_ result: Result<[String: String]?, Error>) {
    guard !settled else { return }
    settled = true
    continuation?.resume(with: result)
    continuation = nil
  }
}
