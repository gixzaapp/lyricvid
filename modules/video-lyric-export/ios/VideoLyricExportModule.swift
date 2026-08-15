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
    let textScale = max(width / previewWidth, 0.5)
    let fontSize = options.fontSize * textScale
    let maxWidth = width * 0.88
    let boxHeight = CGFloat(fontSize) * 3.2
    let center = CGPoint(x: width * options.x / 100, y: height * (1 - options.y / 100))

    for cue in options.cues {
      let layer = CATextLayer()
      layer.contentsScale = 2
      layer.alignmentMode = alignment(options.align)
      layer.isWrapped = true
      layer.string = attributed(cue, options: options, fontSize: fontSize)
      layer.frame = CGRect(
        x: center.x - maxWidth / 2,
        y: center.y - boxHeight / 2,
        width: maxWidth,
        height: boxHeight
      )
      if let background = options.backgroundColor, let color = cssColor(background) {
        layer.backgroundColor = color.cgColor
        layer.cornerRadius = 8
      }
      layer.opacity = 0
      let visible = max(cue.end - cue.start, 0.08)
      let animation = CAKeyframeAnimation(keyPath: "opacity")
      animation.values = [0, 1, 1, 0]
      animation.keyTimes = [0, 0.02, 0.98, 1]
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

  private func attributed(_ cue: LyricCue, options: ExportOptions, fontSize: Double) -> NSAttributedString {
    let text = cue.text as NSString
    let result = NSMutableAttributedString(string: cue.text)
    var traits: UIFontDescriptor.SymbolicTraits = []
    if options.bold { traits.insert(.traitBold) }
    if options.italic { traits.insert(.traitItalic) }
    let named = iosFontName(options.fontFamily)
    let base = named.flatMap { UIFont(name: $0, size: fontSize) } ?? UIFont.systemFont(ofSize: fontSize)
    let font = base.fontDescriptor.withSymbolicTraits(traits).map { UIFont(descriptor: $0, size: fontSize) } ?? base
    let color = cssColor(options.color) ?? .white
    let range = NSRange(location: 0, length: text.length)
    result.addAttributes([
      .font: font,
      .foregroundColor: color,
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

  private func iosFontName(_ id: String) -> String? {
    switch id {
    case "serif": return "Georgia"
    case "rounded": return "Avenir Next"
    case "narrow": return "AvenirNextCondensed-DemiBold"
    case "mono": return "Menlo"
    case "script": return "Noteworthy-Bold"
    case "poster": return "HelveticaNeue-CondensedBold"
    case "light": return "HelveticaNeue-Light"
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
    guard hex.count == 6, let int = Int(hex, radix: 16) else { return nil }
    return UIColor(
      red: CGFloat((int >> 16) & 0xFF) / 255,
      green: CGFloat((int >> 8) & 0xFF) / 255,
      blue: CGFloat(int & 0xFF) / 255,
      alpha: 1
    )
  }
}
