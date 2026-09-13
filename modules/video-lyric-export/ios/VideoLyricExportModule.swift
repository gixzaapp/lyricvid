import AVFoundation
import ExpoModulesCore
import UIKit

struct LyricCue: Record {
  @Field var start: Double = 0
  @Field var end: Double = 0
  @Field var text: String = ""
  @Field var highlightStart: Int = 0
  @Field var highlightEnd: Int = 0
}

struct ExportOptions: Record {
  @Field var videoUri: String = ""
  @Field var audioUri: String?
  @Field var replaceAudio: Bool = false
  @Field var outputPath: String = ""
  @Field var fontSize: Double = 28
  @Field var fontFamily: String = "sans"
  @Field var previewWidth: Double = 360
  @Field var color: String = "#FFFFFF"
  @Field var accentColor: String = "#8B7CFF"
  @Field var backgroundColor: String?
  @Field var bold: Bool = true
  @Field var italic: Bool = false
  @Field var outline: Bool = true
  @Field var align: String = "center"
  @Field var x: Double = 50
  @Field var y: Double = 78
  @Field var cues: [LyricCue] = []
}

public class VideoLyricExportModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoLyricExport")
    Events("onExportProgress")

    AsyncFunction("extractAudioClip") { (sourceUri: String, startSeconds: Double, durationSeconds: Double, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let uri = try self.extractAudioClip(sourceUri, startSeconds: startSeconds, durationSeconds: durationSeconds)
          promise.resolve(uri)
        } catch {
          promise.reject("EXTRACT_FAILED", error.localizedDescription)
        }
      }
    }

    AsyncFunction("exportVideo") { (options: ExportOptions, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let uri = try self.export(options)
          promise.resolve(uri)
        } catch {
          promise.reject("EXPORT_FAILED", error.localizedDescription)
        }
      }
    }
  }

  private func export(_ options: ExportOptions) throws -> String {
    let videoURL = url(from: options.videoUri)
    let asset = AVURLAsset(url: videoURL)
    let composition = AVMutableComposition()

    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      throw NSError(domain: "VideoLyricExport", code: 1, userInfo: [NSLocalizedDescriptionKey: "The selected video has no video track."])
    }

    let duration = asset.duration
    let compositionVideo = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
    try compositionVideo?.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: videoTrack, at: .zero)
    compositionVideo?.preferredTransform = videoTrack.preferredTransform

    if options.replaceAudio, let audioUri = options.audioUri, !audioUri.isEmpty {
      let audioAsset = AVURLAsset(url: url(from: audioUri))
      if let audioTrack = audioAsset.tracks(withMediaType: .audio).first {
        let compositionAudio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
        let audioDuration = CMTimeMinimum(audioAsset.duration, duration)
        try compositionAudio?.insertTimeRange(CMTimeRange(start: .zero, duration: audioDuration), of: audioTrack, at: .zero)
      }
    } else if let audioTrack = asset.tracks(withMediaType: .audio).first {
      let compositionAudio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
      try compositionAudio?.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: audioTrack, at: .zero)
    }

    let natural = videoTrack.naturalSize
    let transform = videoTrack.preferredTransform
    let rendered = natural.applying(transform)
    let width = abs(rendered.width)
    let height = abs(rendered.height)
    let renderSize = CGSize(width: width, height: height)

    let parent = CALayer()
    let videoLayer = CALayer()
    parent.frame = CGRect(origin: .zero, size: renderSize)
    videoLayer.frame = parent.frame
    parent.addSublayer(videoLayer)

    let previewWidth = options.previewWidth > 1 ? options.previewWidth : 360
    let textScale = max(width / previewWidth, 0.75)
    let fontSize = options.fontSize * textScale
    let maxWidth = width * 0.92
    let center = CGPoint(x: width * options.x / 100, y: height * (1 - options.y / 100))

    for cue in options.cues {
      let styled = attributed(cue, options: options, fontSize: fontSize, maxWidth: maxWidth)
      let bounds = styled.boundingRect(
        with: CGSize(width: maxWidth, height: .greatestFiniteMagnitude),
        options: [.usesLineFragmentOrigin, .usesFontLeading],
        context: nil
      )
      let boxWidth = min(maxWidth, max(ceil(bounds.width) + 20, 8))
      let boxHeight = max(ceil(bounds.height) + 12, CGFloat(fontSize) + 12)
      let layer = CATextLayer()
      layer.contentsScale = 2
      layer.alignmentMode = alignment(options.align)
      layer.isWrapped = true
      layer.string = styled
      layer.frame = CGRect(
        x: center.x - boxWidth / 2,
        y: center.y - boxHeight / 2,
        width: boxWidth,
        height: boxHeight
      )
      if let background = options.backgroundColor, let color = cssColor(background) {
        layer.backgroundColor = color.cgColor
        layer.cornerRadius = 8
      }
      layer.opacity = 0
      let visible = max(cue.end - cue.start, 0.08)
      let animation = CAKeyframeAnimation(keyPath: "opacity")
      animation.values = [1, 1, 0]
      animation.keyTimes = [0, 0.999, 1]
      animation.beginTime = AVCoreAnimationBeginTimeAtZero + cue.start
      animation.duration = visible
      animation.fillMode = .forwards
      animation.isRemovedOnCompletion = false
      layer.add(animation, forKey: "show")
      parent.addSublayer(layer)
    }

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compositionVideo!)
    layerInstruction.setTransform(videoTrack.preferredTransform, at: .zero)
    instruction.layerInstructions = [layerInstruction]

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = renderSize
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
    videoComposition.instructions = [instruction]
    videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
      postProcessingAsVideoLayer: videoLayer,
      in: parent
    )

    let outputURL = url(from: options.outputPath)
    try? FileManager.default.removeItem(at: outputURL)
    try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)

    guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      throw NSError(domain: "VideoLyricExport", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not start the video exporter."])
    }
    session.outputURL = outputURL
    session.outputFileType = .mp4
    session.videoComposition = videoComposition
    session.shouldOptimizeForNetworkUse = true

    let finished = DispatchSemaphore(value: 0)
    var exportError: Error?
    self.sendEvent("onExportProgress", ["progress": 0.05])
    session.exportAsynchronously {
      if session.status != .completed {
        exportError = session.error ?? NSError(
          domain: "VideoLyricExport",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "Video export did not finish."]
        )
      }
      finished.signal()
    }
    while finished.wait(timeout: .now() + 0.25) == .timedOut {
      self.sendEvent("onExportProgress", ["progress": Double(session.progress)])
    }
    if exportError == nil {
      self.sendEvent("onExportProgress", ["progress": 1.0])
    }
    if let exportError {
      throw exportError
    }

    let values = try outputURL.resourceValues(forKeys: [.fileSizeKey])
    if (values.fileSize ?? 0) <= 0 {
      throw NSError(domain: "VideoLyricExport", code: 4, userInfo: [NSLocalizedDescriptionKey: "The exported video was empty."])
    }
    return outputURL.absoluteString
  }

  private func attributed(_ cue: LyricCue, options: ExportOptions, fontSize: Double, maxWidth _: CGFloat) -> NSAttributedString {
    let text = cue.text as NSString
    let result = NSMutableAttributedString(string: cue.text)
    var traits: UIFontDescriptor.SymbolicTraits = []
    if options.bold { traits.insert(.traitBold) }
    if options.italic { traits.insert(.traitItalic) }
    let named = needsSystemFont(cue.text) ? nil : iosFontName(options.fontFamily)
    let base = named.flatMap { UIFont(name: $0, size: fontSize) } ?? UIFont.systemFont(ofSize: fontSize)
    let font = base.fontDescriptor.withSymbolicTraits(traits).map { UIFont(descriptor: $0, size: fontSize) } ?? base
    let color = (cssColor(options.color) ?? .white).withAlphaComponent(0.72)
    let range = NSRange(location: 0, length: text.length)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = nsAlign(options.align)
    paragraph.lineBreakMode = .byWordWrapping
    result.addAttributes([
      .font: font,
      .foregroundColor: color,
      .paragraphStyle: paragraph,
    ], range: range)
    if options.outline {
      result.addAttributes([
        .strokeColor: UIColor.black,
        .strokeWidth: -2,
      ], range: range)
    }
    let highlightStart = min(max(cue.highlightStart, 0), text.length)
    let highlightEnd = min(max(cue.highlightEnd, highlightStart), text.length)
    if highlightEnd > highlightStart {
      result.addAttribute(
        .foregroundColor,
        value: cssColor(options.accentColor) ?? UIColor(red: 0.545, green: 0.486, blue: 1, alpha: 1),
        range: NSRange(location: highlightStart, length: highlightEnd - highlightStart)
      )
    }
    return result
  }

  private func needsSystemFont(_ text: String) -> Bool {
    return text.unicodeScalars.contains { scalar in
      let code = scalar.value
      return (0x0590...0x05FF).contains(code) ||
        (0x0600...0x06FF).contains(code) ||
        (0x0750...0x077F).contains(code) ||
        (0x08A0...0x08FF).contains(code) ||
        (0x0900...0x0DFF).contains(code) ||
        (0x0E00...0x0E7F).contains(code) ||
        (0x0F00...0x0FFF).contains(code) ||
        (0x1000...0x109F).contains(code) ||
        (0x1100...0x11FF).contains(code) ||
        (0x1200...0x137F).contains(code) ||
        (0x1780...0x17FF).contains(code) ||
        (0x3040...0x30FF).contains(code) ||
        (0x3100...0x312F).contains(code) ||
        (0x3400...0x9FFF).contains(code) ||
        (0xA960...0xA97F).contains(code) ||
        (0xAC00...0xD7AF).contains(code) ||
        (0xF900...0xFAFF).contains(code)
    }
  }

  private func iosFontName(_ id: String) -> String? {
    switch id {
    case "serif": return "Georgia"
    case "condensed", "narrow", "poster": return "AvenirNextCondensed-DemiBold"
    case "typewriter": return "AmericanTypewriter-Semibold"
    case "mono": return "Menlo-Bold"
    case "script": return "Noteworthy-Bold"
    case "marker": return "MarkerFelt-Wide"
    case "smallcaps": return "Copperplate-Bold"
    default: return nil
    }
  }

  private func alignment(_ value: String) -> CATextLayerAlignmentMode {
    switch value {
    case "left": return .left
    case "right": return .right
    default: return .center
    }
  }

  private func nsAlign(_ value: String) -> NSTextAlignment {
    switch value {
    case "left": return .left
    case "right": return .right
    default: return .center
    }
  }

  private func extractAudioClip(_ sourceUri: String, startSeconds: Double, durationSeconds: Double) throws -> String {
    let asset = AVURLAsset(url: url(from: sourceUri))
    guard asset.tracks(withMediaType: .audio).first != nil else {
      throw NSError(domain: "VideoLyricExport", code: 2, userInfo: [NSLocalizedDescriptionKey: "The selected media has no audio track."])
    }

    let assetDuration = CMTimeGetSeconds(asset.duration)
    let start = max(0, min(startSeconds, max(0, assetDuration - 1)))
    let length = min(max(durationSeconds, 1), max(1, assetDuration - start))
    let timeRange = CMTimeRange(
      start: CMTime(seconds: start, preferredTimescale: 600),
      duration: CMTime(seconds: length, preferredTimescale: 600)
    )

    guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
      throw NSError(domain: "VideoLyricExport", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not start audio extraction."])
    }

    let output = FileManager.default.temporaryDirectory.appendingPathComponent("lyricvid-detect-\(UUID().uuidString).m4a")
    if FileManager.default.fileExists(atPath: output.path) {
      try FileManager.default.removeItem(at: output)
    }
    session.outputURL = output
    session.outputFileType = .m4a
    session.timeRange = timeRange

    let lock = DispatchSemaphore(value: 0)
    session.exportAsynchronously { lock.signal() }
    lock.wait()

    if session.status != .completed {
      throw session.error ?? NSError(domain: "VideoLyricExport", code: 4, userInfo: [NSLocalizedDescriptionKey: "Audio extraction failed."])
    }
    return output.absoluteString
  }

  private func url(from value: String) -> URL {
    if value.hasPrefix("file:"), let parsed = URL(string: value) {
      return parsed
    }
    if value.contains("://"), let parsed = URL(string: value) {
      return parsed
    }
    return URL(fileURLWithPath: value)
  }

  private func cssColor(_ value: String) -> UIColor? {
    let raw = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if raw.hasPrefix("rgba") || raw.hasPrefix("rgb") {
      let inner = raw.split(whereSeparator: { $0 == "(" || $0 == ")" }).dropFirst().first ?? ""
      let parts = inner.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
      guard parts.count >= 3,
            let r = Double(parts[0]),
            let g = Double(parts[1]),
            let b = Double(parts[2]) else { return nil }
      let a = parts.count > 3 ? Double(parts[3]) ?? 1 : 1
      return UIColor(red: r / 255, green: g / 255, blue: b / 255, alpha: a)
    }
    var hex = raw.replacingOccurrences(of: "#", with: "")
    if hex.count == 3 {
      hex = hex.map { "\($0)\($0)" }.joined()
    }
    if hex.count == 8, let int = Int(hex, radix: 16) {
      return UIColor(
        red: CGFloat((int >> 24) & 0xFF) / 255,
        green: CGFloat((int >> 16) & 0xFF) / 255,
        blue: CGFloat((int >> 8) & 0xFF) / 255,
        alpha: CGFloat(int & 0xFF) / 255
      )
    }
    guard hex.count == 6, let int = Int(hex, radix: 16) else { return nil }
    return UIColor(
      red: CGFloat((int >> 16) & 0xFF) / 255,
      green: CGFloat((int >> 8) & 0xFF) / 255,
      blue: CGFloat(int & 0xFF) / 255,
      alpha: 1
    )
  }
}
