import AVFoundation
import CoreVideo
import ExpoModulesCore
import UIKit

struct LyricCue: Record {
  @Field var start: Double = 0
  @Field var end: Double = 0
  @Field var text: String = ""
  @Field var lineId: String = ""
  @Field var highlightStart: Int = 0
  @Field var highlightEnd: Int = 0
}

struct ExportSticker: Record {
  @Field var kind: String = "vinyl"
  @Field var x: Double = 20
  @Field var y: Double = 18
  @Field var scale: Double = 1
  @Field var title: String = "Song"
  @Field var artist: String = "Artist"
  @Field var duration: Double = 0
}

struct ExportOptions: Record {
  @Field var videoUri: String = ""
  @Field var audioUri: String?
  @Field var replaceAudio: Bool = false
  @Field var outputPath: String = ""
  @Field var duration: Double = 0
  @Field var stillImage: Bool = false
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
  @Field var animation: String = "rise"
  @Field var animationSpeed: Double = 1
  @Field var cues: [LyricCue] = []
  @Field var stickers: [ExportSticker] = []
}

public class VideoLyricExportModule: Module {
  private var shazamMatcher: ShazamFileMatcher?

  public func definition() -> ModuleDefinition {
    Name("VideoLyricExport")
    Events("onExportProgress")

    Constants([
      "songRecognitionAvailable": true
    ])

    Function("isSongRecognitionAvailable") {
      return true
    }

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

    AsyncFunction("recognizeSong") { (sourceUri: String, startSeconds: Double, durationSeconds: Double, developerToken: String?, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        var clipUrl: URL?
        do {
          let clipSeconds = min(12, max(6, durationSeconds))
          let uri = try self.extractAudioClip(sourceUri, startSeconds: startSeconds, durationSeconds: clipSeconds)
          clipUrl = self.url(from: uri)
          let matcher = ShazamFileMatcher()
          self.shazamMatcher = matcher
          let match = try self.awaitShazam(matcher, clipUrl: clipUrl!)
          promise.resolve(match)
        } catch {
          promise.reject("SHAZAM_FAILED", error.localizedDescription)
        }
        if let clipUrl, clipUrl.lastPathComponent.contains("lyricvid-detect-") {
          try? FileManager.default.removeItem(at: clipUrl)
        }
        self.shazamMatcher = nil
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
    if options.stillImage {
      let stillUri = try writeStillVideo(options)
      var videoOptions = options
      videoOptions.videoUri = stillUri
      videoOptions.stillImage = false
      return try export(videoOptions)
    }

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

    if options.animation == "wheel" {
      addWheelLayers(options: options, parent: parent, center: center, width: width, fontSize: fontSize, duration: CMTimeGetSeconds(duration))
    } else if options.animation == "chat" {
      addChatLayers(options: options, parent: parent, center: center, width: width, fontSize: fontSize, duration: CMTimeGetSeconds(duration))
    } else if isDepthAnimation(options.animation) {
      addDepthLayers(options: options, parent: parent, center: center, width: width, fontSize: fontSize, duration: CMTimeGetSeconds(duration))
    } else {
    for cue in options.cues {
      let styled = attributed(cue, options: options, fontSize: fontSize, maxWidth: maxWidth)
      let bounds = styled.boundingRect(
        with: CGSize(width: maxWidth, height: .greatestFiniteMagnitude),
        options: [.usesLineFragmentOrigin, .usesFontLeading],
        context: nil
      )
      let neonPad: CGFloat = options.animation == "neon" ? 36 : 0
      let boxWidth = min(maxWidth, max(ceil(bounds.width) + 20 + neonPad * 2, 8))
      let boxHeight = max(ceil(bounds.height) + 12 + neonPad, CGFloat(fontSize) + 12 + neonPad)
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
      if options.animation == "neon" {
        let neonColor = cssColor(options.color) ?? .white
        let glowText = neonSignString(cue, options: options, fontSize: fontSize, color: neonColor)
        let far = CATextLayer()
        far.contentsScale = 2
        far.alignmentMode = layer.alignmentMode
        far.isWrapped = true
        far.string = glowText
        far.frame = layer.frame
        far.shadowColor = neonColor.cgColor
        far.shadowRadius = 28
        far.shadowOffset = .zero
        far.shadowOpacity = 1
        far.opacity = 0
        far.add(animation, forKey: "show")
        let mid = CATextLayer()
        mid.contentsScale = 2
        mid.alignmentMode = layer.alignmentMode
        mid.isWrapped = true
        mid.string = glowText
        mid.frame = layer.frame
        mid.shadowColor = neonColor.cgColor
        mid.shadowRadius = 10
        mid.shadowOffset = .zero
        mid.shadowOpacity = 1
        mid.opacity = 0
        mid.add(animation, forKey: "show")
        let pulse = CAKeyframeAnimation(keyPath: "opacity")
        pulse.values = [0.55, 1, 0.7, 0.95, 0]
        pulse.keyTimes = [0, 0.32, 0.68, 0.999, 1]
        pulse.beginTime = animation.beginTime
        pulse.duration = visible
        pulse.fillMode = .forwards
        pulse.isRemovedOnCompletion = false
        far.add(pulse, forKey: "pulse")
        mid.add(pulse, forKey: "pulse")
        parent.addSublayer(far)
        parent.addSublayer(mid)
        layer.string = neonSignString(cue, options: options, fontSize: fontSize, color: .white)
        layer.shadowColor = neonColor.cgColor
        layer.shadowRadius = 6
        layer.shadowOffset = .zero
        layer.shadowOpacity = 1
      }
      parent.addSublayer(layer)
    }
    }

    addStickerLayers(options.stickers, parent: parent, size: renderSize, scale: textScale, duration: options.duration > 0 ? options.duration : CMTimeGetSeconds(duration))

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
    let fontId = options.animation == "neon" ? "pacifico" : options.fontFamily
    let named = needsSystemFont(cue.text) ? nil : iosFontName(fontId)
    let base = named.flatMap { UIFont(name: $0, size: fontSize) } ?? UIFont.systemFont(ofSize: fontSize)
    let font = options.animation == "neon"
      ? base
      : (base.fontDescriptor.withSymbolicTraits(traits).map { UIFont(descriptor: $0, size: fontSize) } ?? base)
    let color = options.animation == "neon"
      ? UIColor.white
      : (cssColor(options.color) ?? .white).withAlphaComponent(0.72)
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
    case "dancing": return "DancingScript"
    case "elegant": return "GreatVibes-Regular"
    case "pacifico": return "Pacifico-Regular"
    case "parisienne": return "Parisienne-Regular"
    case "signature": return "Allura-Regular"
    case "marker": return "MarkerFelt-Wide"
    case "smallcaps": return "Copperplate-Bold"
    default: return nil
    }
  }

  private func neonSignString(_ cue: LyricCue, options: ExportOptions, fontSize: Double, color: UIColor) -> NSAttributedString {
    let result = NSMutableAttributedString(string: cue.text)
    let named = needsSystemFont(cue.text) ? nil : iosFontName("pacifico")
    let font = named.flatMap { UIFont(name: $0, size: fontSize) } ?? UIFont.systemFont(ofSize: fontSize)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = nsAlign(options.align)
    paragraph.lineBreakMode = .byWordWrapping
    result.addAttributes([
      .font: font,
      .foregroundColor: color,
      .paragraphStyle: paragraph,
    ], range: NSRange(location: 0, length: (cue.text as NSString).length))
    return result
  }

  private func addWheelLayers(
    options: ExportOptions,
    parent: CALayer,
    center: CGPoint,
    width: CGFloat,
    fontSize: Double,
    duration: Double
  ) {
    let lines = wheelLines(options.cues)
    guard !lines.isEmpty else { return }
    let rowH = max(28, CGFloat(fontSize) * 1.35)
    let boxW = min(width * 0.88, 520)
    let boxH = rowH * 5 + 16
    let root = CALayer()
    root.frame = CGRect(x: center.x - boxW / 2, y: center.y - boxH / 2, width: boxW, height: boxH)
    root.cornerRadius = 16
    root.masksToBounds = true
    if let background = options.backgroundColor, let color = cssColor(background) {
      root.backgroundColor = color.cgColor
    } else {
      root.backgroundColor = UIColor(white: 0.05, alpha: 0.42).cgColor
    }
    let band = CALayer()
    band.frame = CGRect(x: 0, y: (boxH - rowH) / 2, width: boxW, height: rowH)
    band.backgroundColor = UIColor(white: 1, alpha: 0.12).cgColor
    root.addSublayer(band)

    for (index, line) in lines.enumerated() {
      let layer = CATextLayer()
      layer.contentsScale = 2
      layer.alignmentMode = alignment(options.align)
      layer.isWrapped = false
      layer.string = line.text
      layer.fontSize = fontSize
      layer.foregroundColor = (cssColor(options.color) ?? .white).cgColor
      layer.frame = CGRect(x: 10, y: (boxH - rowH) / 2, width: boxW - 20, height: rowH)
      layer.opacity = 0
      let times = wheelTimes(index: index, lines: lines, duration: duration)
      let move = CAKeyframeAnimation(keyPath: "position.y")
      move.values = times.map { $0.offset * rowH + boxH / 2 }
      move.keyTimes = times.map { NSNumber(value: $0.time / max(duration, 0.01)) }
      move.beginTime = AVCoreAnimationBeginTimeAtZero
      move.duration = max(duration, 0.01)
      move.fillMode = .forwards
      move.isRemovedOnCompletion = false
      let fade = CAKeyframeAnimation(keyPath: "opacity")
      fade.values = times.map { max(0.18, 1 - abs($0.offset) * 0.38) }
      fade.keyTimes = move.keyTimes
      fade.beginTime = AVCoreAnimationBeginTimeAtZero
      fade.duration = max(duration, 0.01)
      fade.fillMode = .forwards
      fade.isRemovedOnCompletion = false
      layer.add(move, forKey: "roll")
      layer.add(fade, forKey: "fade")
      root.addSublayer(layer)
    }
    parent.addSublayer(root)
  }

  private func addChatLayers(
    options: ExportOptions,
    parent: CALayer,
    center: CGPoint,
    width: CGFloat,
    fontSize: Double,
    duration: Double
  ) {
    let lines = wheelLines(options.cues)
    guard !lines.isEmpty else { return }
    let boxW = min(width * 0.88, 520)
    let gap: CGFloat = 8
    let padX: CGFloat = 14
    let padY: CGFloat = 9
    let maxInner = max(24, boxW * 0.78 - padX * 2)
    func bubbleSize(_ text: String) -> CGSize {
      let font = UIFont.systemFont(ofSize: fontSize, weight: .semibold)
      let bounds = (text as NSString).boundingRect(
        with: CGSize(width: maxInner, height: .greatestFiniteMagnitude),
        options: [.usesLineFragmentOrigin, .usesFontLeading],
        attributes: [.font: font],
        context: nil
      )
      return CGSize(width: min(boxW * 0.78, ceil(bounds.width) + padX * 2), height: max(ceil(bounds.height) + padY * 2, CGFloat(fontSize) + padY * 2))
    }
    let sizes = lines.map { bubbleSize($0.text) }
    let visibleCount = 4
    let boxH = sizes.suffix(visibleCount).reduce(CGFloat(0)) { $0 + $1.height } + gap * CGFloat(visibleCount - 1) + 8
    let root = CALayer()
    root.frame = CGRect(x: center.x - boxW / 2, y: center.y - boxH / 2, width: boxW, height: boxH)
    root.masksToBounds = false
    let outgoingColor = options.backgroundColor.flatMap { cssColor($0) } ?? UIColor(red: 10 / 255, green: 132 / 255, blue: 1, alpha: 1)
    let incomingColor = UIColor(red: 232 / 255, green: 232 / 255, blue: 237 / 255, alpha: 1)
    let outgoingText = cssColor(options.color) ?? .white
    let incomingText = UIColor(red: 28 / 255, green: 28 / 255, blue: 30 / 255, alpha: 1)

    for (index, line) in lines.enumerated() {
      let outgoing = index % 2 == 1
      let size = sizes[index]
      let bubble = CALayer()
      bubble.backgroundColor = (outgoing ? outgoingColor : incomingColor).cgColor
      bubble.cornerRadius = 18
      bubble.masksToBounds = true
      bubble.opacity = 0
      let text = CATextLayer()
      text.contentsScale = 2
      text.isWrapped = true
      text.alignmentMode = .left
      text.string = line.text
      text.fontSize = fontSize
      text.foregroundColor = (outgoing ? outgoingText : incomingText).cgColor
      text.frame = CGRect(x: padX, y: padY, width: size.width - padX * 2, height: size.height - padY * 2)
      bubble.addSublayer(text)
      bubble.frame = CGRect(x: outgoing ? boxW - size.width - 4 : 4, y: boxH - size.height, width: size.width, height: size.height)

      var times: [NSNumber] = [0]
      var opacities: [NSNumber] = [0]
      var ys: [NSNumber] = [NSNumber(value: Double(boxH + size.height))]
      for (other, otherLine) in lines.enumerated() {
        let first = max(0, other - (visibleCount - 1))
        let visible = index >= first && index <= other
        var y = boxH
        if visible {
          for shown in first...other {
            y -= sizes[shown].height
            if shown == index { break }
            y -= gap
          }
        } else {
          y = boxH + size.height
        }
        times.append(NSNumber(value: otherLine.start / max(duration, 0.01)))
        opacities.append(NSNumber(value: visible ? 1 : 0))
        ys.append(NSNumber(value: Double(y + size.height / 2)))
      }
      times.append(1)
      opacities.append(opacities.last ?? 0)
      ys.append(ys.last ?? NSNumber(value: Double(boxH)))

      let fade = CAKeyframeAnimation(keyPath: "opacity")
      fade.values = opacities
      fade.keyTimes = times
      fade.beginTime = AVCoreAnimationBeginTimeAtZero
      fade.duration = max(duration, 0.01)
      fade.fillMode = .forwards
      fade.isRemovedOnCompletion = false
      let move = CAKeyframeAnimation(keyPath: "position.y")
      move.values = ys
      move.keyTimes = times
      move.beginTime = AVCoreAnimationBeginTimeAtZero
      move.duration = max(duration, 0.01)
      move.fillMode = .forwards
      move.isRemovedOnCompletion = false
      bubble.add(fade, forKey: "fade")
      bubble.add(move, forKey: "stack")
      root.addSublayer(bubble)
    }
    parent.addSublayer(root)
  }

  private func isDepthAnimation(_ id: String) -> Bool {
    ["flip", "coverflow", "prism"].contains(id)
  }

  private struct DepthSlot {
    let opacity: CGFloat
    let scale: CGFloat
    let tx: CGFloat
    let ty: CGFloat
    let rx: Double
    let ry: Double
    let hide: Bool
  }

  private func depthVisible(_ mode: String) -> Int {
    mode == "flip" || mode == "prism" ? 1 : 2
  }

  private func depthSlot(_ mode: String, slot: Double, rowH: CGFloat, rowW: CGFloat) -> DepthSlot {
    let distance = abs(slot)
    switch mode {
    case "flip":
      let ry = slot * 90
      return DepthSlot(
        opacity: CGFloat(max(0, min(1, 1 - distance * 0.55))),
        scale: 1,
        tx: 0,
        ty: 0,
        rx: 0,
        ry: ry,
        hide: abs(cos(ry * .pi / 180)) < 0.12
      )
    case "coverflow":
      return DepthSlot(
        opacity: CGFloat(max(0.18, min(1, 1 - distance * 0.32))),
        scale: CGFloat(max(0.64, min(1, 1 - distance * 0.16))),
        tx: CGFloat(slot) * rowW * 0.38,
        ty: CGFloat(abs(slot)) * rowH * 0.08,
        rx: 0,
        ry: -slot * 50,
        hide: distance > 2.15
      )
    case "prism":
      let ry = slot * 120
      let facing = cos(ry * .pi / 180)
      let hide = facing < 0.18 || distance > 0.95
      return DepthSlot(
        opacity: hide ? 0 : CGFloat(max(0.28, min(1, 1 - distance * 0.22))),
        scale: 1,
        tx: CGFloat(sin(ry * .pi / 180)) * rowW * 0.18,
        ty: 0,
        rx: 8,
        ry: ry,
        hide: hide
      )
    default:
      return DepthSlot(opacity: 0, scale: 1, tx: 0, ty: 0, rx: 0, ry: 0, hide: true)
    }
  }

  private func depthTransform(_ slot: DepthSlot) -> CATransform3D {
    var transform = CATransform3DIdentity
    transform.m34 = -1.0 / 800.0
    transform = CATransform3DTranslate(transform, slot.tx, slot.ty, 0)
    transform = CATransform3DRotate(transform, CGFloat(slot.ry * .pi / 180), 0, 1, 0)
    transform = CATransform3DRotate(transform, CGFloat(slot.rx * .pi / 180), 1, 0, 0)
    return CATransform3DScale(transform, slot.scale, slot.scale, 1)
  }

  private func depthTimes(index: Int, lines: [WheelLine], duration: Double) -> [(time: Double, offset: Double)] {
    var points: [(time: Double, offset: Double)] = [(0, Double(index + 2))]
    for (other, line) in lines.enumerated() {
      let span = max(line.end - line.start, 0.12)
      let hold = line.start + span * 0.62
      points.append((line.start, Double(index - other)))
      points.append((hold, Double(index - other)))
      points.append((hold + span * 0.19, Double(index - other) - 0.5))
      points.append((min(duration, line.end), Double(index - other) - 1))
    }
    return points.sorted { $0.time < $1.time }
  }

  private func addDepthLayers(
    options: ExportOptions,
    parent: CALayer,
    center: CGPoint,
    width: CGFloat,
    fontSize: Double,
    duration: Double
  ) {
    let lines = wheelLines(options.cues)
    guard !lines.isEmpty else { return }
    let mode = options.animation
    let visible = depthVisible(mode)
    let rowH = max(28, CGFloat(fontSize) * 1.35)
    let boxW = mode == "coverflow" ? min(width * 0.96, 640) : min(width * 0.88, 520)
    let boxH = rowH * CGFloat(visible * 2 + 1) + 16
    let root = CALayer()
    root.frame = CGRect(x: center.x - boxW / 2, y: center.y - boxH / 2, width: boxW, height: boxH)
    root.cornerRadius = 16
    root.masksToBounds = !(mode == "flip" || mode == "coverflow" || mode == "prism")
    if let background = options.backgroundColor, let color = cssColor(background) {
      root.backgroundColor = color.cgColor
    } else {
      root.backgroundColor = UIColor(white: 0.05, alpha: 0.42).cgColor
    }
    for (index, line) in lines.enumerated() {
      let layer = CATextLayer()
      layer.contentsScale = 2
      layer.alignmentMode = alignment(options.align)
      layer.isWrapped = false
      layer.string = line.text
      layer.fontSize = fontSize
      layer.foregroundColor = (cssColor(options.color) ?? .white).cgColor
      layer.frame = CGRect(x: 10, y: (boxH - rowH) / 2, width: boxW - 20, height: rowH)
      layer.opacity = 0
      layer.isDoubleSided = !(mode == "flip" || mode == "prism")
      let times = depthTimes(index: index, lines: lines, duration: duration)
      let keyTimes = times.map { NSNumber(value: $0.time / max(duration, 0.01)) }
      let slots = times.map { depthSlot(mode, slot: $0.offset, rowH: rowH, rowW: boxW) }
      let move = CAKeyframeAnimation(keyPath: "transform")
      move.values = slots.map { NSValue(caTransform3D: depthTransform($0)) }
      move.keyTimes = keyTimes
      move.beginTime = AVCoreAnimationBeginTimeAtZero
      move.duration = max(duration, 0.01)
      move.fillMode = .forwards
      move.isRemovedOnCompletion = false
      let fade = CAKeyframeAnimation(keyPath: "opacity")
      fade.values = slots.map { $0.hide ? 0 : $0.opacity }
      fade.keyTimes = keyTimes
      fade.beginTime = AVCoreAnimationBeginTimeAtZero
      fade.duration = max(duration, 0.01)
      fade.fillMode = .forwards
      fade.isRemovedOnCompletion = false
      layer.add(move, forKey: "depth")
      layer.add(fade, forKey: "fade")
      root.addSublayer(layer)
    }
    parent.addSublayer(root)
  }

  private struct WheelLine {
    let id: String
    let text: String
    let start: Double
    let end: Double
  }

  private func wheelLines(_ cues: [LyricCue]) -> [WheelLine] {
    var lines: [WheelLine] = []
    var index = 0
    while index < cues.count {
      let cue = cues[index]
      if cue.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        index += 1
        continue
      }
      let id = cue.lineId.isEmpty ? "\(index)-\(cue.text)" : cue.lineId
      var last = index
      while last + 1 < cues.count {
        let nextId = cues[last + 1].lineId.isEmpty ? "\(last + 1)-\(cues[last + 1].text)" : cues[last + 1].lineId
        if nextId != id { break }
        last += 1
      }
      lines.append(WheelLine(id: id, text: cue.text, start: cue.start, end: cues[last].end))
      index = last + 1
    }
    return lines
  }

  private func wheelTimes(index: Int, lines: [WheelLine], duration: Double) -> [(time: Double, offset: Double)] {
    var points: [(time: Double, offset: Double)] = [(0, Double(index + 2))]
    for (other, line) in lines.enumerated() {
      points.append((line.start, Double(index - other)))
    }
    if let last = lines.last {
      points.append((min(duration, last.end), Double(index - (lines.count - 1) - 1)))
    }
    return points.sorted { $0.time < $1.time }
  }

  private func addStickerLayers(_ stickers: [ExportSticker], parent: CALayer, size: CGSize, scale: CGFloat, duration: Double) {
    for sticker in stickers {
      let center = CGPoint(x: size.width * sticker.x / 100, y: size.height * (1 - sticker.y / 100))
      let factor = max(0.5, scale * CGFloat(sticker.scale))
      let root = CALayer()
      switch sticker.kind {
      case "beats":
        let wide = 168 * factor
        let tall = 86 * factor
        root.frame = CGRect(x: center.x - wide / 2, y: center.y - tall / 2, width: wide, height: tall)
        addBeatsLayer(to: root, title: sticker.title, videoDuration: duration)
      case "player":
        let wide = 228 * factor
        let tall = 72 * factor
        root.frame = CGRect(x: center.x - wide / 2, y: center.y - tall / 2, width: wide, height: tall)
        addPlayerLayer(to: root, sticker: sticker, duration: duration)
      case "cassette":
        let wide = 128 * factor
        let tall = 68 * factor
        root.frame = CGRect(x: center.x - wide / 2, y: center.y - tall / 2, width: wide, height: tall)
        addCassetteLayer(to: root, title: sticker.title, videoDuration: duration)
      case "music":
        let box = max(90, 120 * factor)
        root.frame = CGRect(x: center.x - box / 2, y: center.y - box / 2, width: box, height: box)
        addMusicLayer(to: root, title: sticker.title, box: box, videoDuration: duration)
      default:
        let box = 112 * factor
        root.frame = CGRect(x: center.x - box / 2, y: center.y - box / 2, width: box, height: box)
        addVinylLayer(to: root, title: sticker.title, box: box, videoDuration: duration)
      }
      parent.addSublayer(root)
    }
  }

  private func loopForExport(_ animation: CAAnimation, cycle: Double, videoDuration: Double) {
    let cycleTime = max(cycle, 0.05)
    animation.beginTime = AVCoreAnimationBeginTimeAtZero
    animation.duration = cycleTime
    animation.repeatCount = Float(ceil(max(videoDuration, cycleTime) / cycleTime) + 1)
    animation.isRemovedOnCompletion = false
    animation.fillMode = .forwards
  }

  private func fromTop(_ top: CGFloat, height: CGFloat, in container: CGRect) -> CGFloat {
    container.height - top - height
  }

  private func ovalLayer(in bounds: CGRect, fill: UIColor, stroke: UIColor? = nil, lineWidth: CGFloat = 0) -> CAShapeLayer {
    let layer = CAShapeLayer()
    layer.frame = bounds
    layer.path = UIBezierPath(ovalIn: CGRect(origin: .zero, size: bounds.size)).cgPath
    layer.fillColor = fill.cgColor
    if let stroke, lineWidth > 0 {
      layer.strokeColor = stroke.cgColor
      layer.lineWidth = lineWidth
    }
    layer.allowsEdgeAntialiasing = true
    return layer
  }

  private func stickerText(
    _ string: String,
    fontSize: CGFloat,
    color: UIColor,
    alignment: CATextLayerAlignmentMode = .center,
    wrap: Bool = false
  ) -> CATextLayer {
    let layer = CATextLayer()
    layer.contentsScale = 3
    layer.alignmentMode = alignment
    layer.isWrapped = wrap
    layer.truncationMode = wrap ? .none : .end
    layer.string = string
    layer.font = UIFont.systemFont(ofSize: fontSize, weight: .heavy)
    layer.fontSize = fontSize
    layer.foregroundColor = color.cgColor
    return layer
  }

  private func addVinylLayer(to root: CALayer, title: String, box: CGFloat, videoDuration: Double) {
    let s = box / 112
    let discSize = box
    let disc = CALayer()
    disc.bounds = CGRect(x: 0, y: 0, width: discSize, height: discSize)
    disc.position = CGPoint(x: root.bounds.midX, y: root.bounds.midY)
    disc.allowsEdgeAntialiasing = true
    let plate = ovalLayer(
      in: disc.bounds,
      fill: UIColor(red: 0.07, green: 0.07, blue: 0.07, alpha: 1),
      stroke: UIColor(red: 0.17, green: 0.17, blue: 0.17, alpha: 1),
      lineWidth: 5 * s
    )
    disc.addSublayer(plate)
    for inset in [12 * s, 22 * s] {
      let groove = ovalLayer(
        in: disc.bounds.insetBy(dx: inset, dy: inset),
        fill: .clear,
        stroke: UIColor(white: 1, alpha: 0.10),
        lineWidth: max(1, s)
      )
      disc.addSublayer(groove)
    }
    let badgeSize = 46 * s
    let badge = ovalLayer(
      in: CGRect(
        x: (discSize - badgeSize) / 2,
        y: (discSize - badgeSize) / 2,
        width: badgeSize,
        height: badgeSize
      ),
      fill: UIColor(red: 0.77, green: 0.29, blue: 0.29, alpha: 1)
    )
    let badgeMask = CAShapeLayer()
    badgeMask.frame = badge.bounds
    badgeMask.path = UIBezierPath(ovalIn: CGRect(origin: .zero, size: badge.bounds.size)).cgPath
    badge.mask = badgeMask
    let titleLayer = stickerText(title, fontSize: max(7 * s, 8), color: UIColor(red: 1, green: 0.96, blue: 0.91, alpha: 1), wrap: true)
    let titleInset = 5 * s
    titleLayer.frame = badge.bounds.insetBy(dx: titleInset, dy: titleInset + 4 * s)
    badge.addSublayer(titleLayer)
    let spindleSize = 8 * s
    let spindle = ovalLayer(
      in: CGRect(
        x: (badgeSize - spindleSize) / 2,
        y: (badgeSize - spindleSize) / 2,
        width: spindleSize,
        height: spindleSize
      ),
      fill: UIColor(red: 0.04, green: 0.04, blue: 0.07, alpha: 1)
    )
    badge.addSublayer(spindle)
    disc.addSublayer(badge)
    let spin = CABasicAnimation(keyPath: "transform.rotation.z")
    spin.fromValue = 0
    spin.toValue = Double.pi * 2
    spin.timingFunction = CAMediaTimingFunction(name: .linear)
    loopForExport(spin, cycle: 4.8, videoDuration: videoDuration)
    disc.add(spin, forKey: "spin")
    root.addSublayer(disc)
  }

  private func addCassetteLayer(to root: CALayer, title: String, videoDuration: Double) {
    let s = max(root.bounds.width / 128, 0.5)
    let body = CALayer()
    body.frame = root.bounds
    body.cornerRadius = 10 * s
    body.backgroundColor = UIColor(red: 0.11, green: 0.14, blue: 0.22, alpha: 1).cgColor
    body.borderWidth = 1 * s
    body.borderColor = UIColor(red: 0.44, green: 0.48, blue: 0.6, alpha: 1).cgColor
    let pad = 8 * s
    let titleH = 12 * s
    let windowH = 34 * s
    let titleLayer = stickerText(
      title,
      fontSize: 9 * s,
      color: UIColor(red: 0.96, green: 0.91, blue: 0.78, alpha: 1)
    )
    titleLayer.frame = CGRect(
      x: pad,
      y: fromTop(pad, height: titleH, in: body.bounds),
      width: body.bounds.width - pad * 2,
      height: titleH
    )
    body.addSublayer(titleLayer)
    let window = CALayer()
    window.frame = CGRect(x: pad, y: pad, width: body.bounds.width - pad * 2, height: windowH)
    window.cornerRadius = 6 * s
    window.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.13, alpha: 1).cgColor
    window.masksToBounds = true
    body.addSublayer(window)
    let reelSize: CGFloat = 22 * s
    let spokeColor = UIColor(red: 0.91, green: 0.82, blue: 0.63, alpha: 1)
    for x in [window.bounds.width * 0.22, window.bounds.width * 0.78] {
      let reel = CALayer()
      reel.bounds = CGRect(x: 0, y: 0, width: reelSize, height: reelSize)
      reel.position = CGPoint(x: x, y: window.bounds.midY)
      reel.allowsEdgeAntialiasing = true
      let plate = ovalLayer(
        in: reel.bounds,
        fill: UIColor(red: 0.23, green: 0.16, blue: 0.09, alpha: 1),
        stroke: UIColor(red: 0.79, green: 0.64, blue: 0.42, alpha: 1),
        lineWidth: 2 * s
      )
      reel.addSublayer(plate)
      let spokeH = CALayer()
      spokeH.bounds = CGRect(x: 0, y: 0, width: reelSize * 0.55, height: max(2 * s, 1.5))
      spokeH.position = CGPoint(x: reel.bounds.midX, y: reel.bounds.midY)
      spokeH.backgroundColor = spokeColor.cgColor
      let spokeV = CALayer()
      spokeV.bounds = CGRect(x: 0, y: 0, width: max(2 * s, 1.5), height: reelSize * 0.55)
      spokeV.position = spokeH.position
      spokeV.backgroundColor = spokeColor.cgColor
      reel.addSublayer(spokeH)
      reel.addSublayer(spokeV)
      let spin = CABasicAnimation(keyPath: "transform.rotation.z")
      spin.fromValue = 0
      spin.toValue = Double.pi * 2
      spin.timingFunction = CAMediaTimingFunction(name: .linear)
      loopForExport(spin, cycle: 2.2, videoDuration: videoDuration)
      reel.add(spin, forKey: "spin")
      window.addSublayer(reel)
    }
    let tape = CALayer()
    tape.frame = CGRect(x: window.bounds.midX - 14 * s, y: window.bounds.midY - 2 * s, width: 28 * s, height: 4 * s)
    tape.cornerRadius = 2 * s
    tape.backgroundColor = UIColor(red: 0.42, green: 0.27, blue: 0.14, alpha: 1).cgColor
    window.addSublayer(tape)
    root.addSublayer(body)
  }

  private func clock(_ seconds: Double) -> String {
    let total = max(0, Int(seconds.rounded(.down)))
    return String(format: "%d:%02d", total / 60, total % 60)
  }

  private func addPlayerLayer(to root: CALayer, sticker: ExportSticker, duration: Double) {
    let s = max(root.bounds.width / 228, 0.5)
    let glass = CALayer()
    glass.frame = root.bounds
    glass.cornerRadius = 22 * s
    glass.backgroundColor = UIColor(white: 1, alpha: 0.92).cgColor
    glass.borderWidth = 1 * s
    glass.borderColor = UIColor(white: 0.15, alpha: 0.22).cgColor
    glass.masksToBounds = true
    let padX = 12 * s
    let padY = 10 * s
    let artSize = 40 * s
    let art = CALayer()
    art.frame = CGRect(x: padX, y: (root.bounds.height - artSize) / 2, width: artSize, height: artSize)
    art.cornerRadius = 10 * s
    art.backgroundColor = UIColor(red: 0.78, green: 0.71, blue: 0.60, alpha: 1).cgColor
    let note = stickerText("♪", fontSize: 16 * s, color: UIColor(red: 0.23, green: 0.16, blue: 0.11, alpha: 1))
    note.frame = art.bounds
    art.addSublayer(note)
    glass.addSublayer(art)
    let textLeft = padX + artSize + 10 * s
    let textWidth = max(8, root.bounds.width - textLeft - padX)
    let titleH = 16 * s
    let artistH = 13 * s
    let titleLayer = stickerText(
      sticker.title,
      fontSize: 12 * s,
      color: UIColor(white: 0.08, alpha: 1),
      alignment: .left
    )
    titleLayer.frame = CGRect(x: textLeft, y: fromTop(padY, height: titleH, in: root.bounds), width: textWidth, height: titleH)
    glass.addSublayer(titleLayer)
    let artistLayer = stickerText(
      sticker.artist.isEmpty ? "Artist" : sticker.artist,
      fontSize: 10 * s,
      color: UIColor(white: 0.38, alpha: 1),
      alignment: .left
    )
    artistLayer.font = UIFont.systemFont(ofSize: 10 * s, weight: .semibold)
    artistLayer.frame = CGRect(x: textLeft, y: fromTop(padY + titleH, height: artistH, in: root.bounds), width: textWidth, height: artistH)
    glass.addSublayer(artistLayer)
    let timeH = 12 * s
    let trackH = 3 * s
    let times = stickerText("0:00", fontSize: 9 * s, color: UIColor(white: 0.42, alpha: 1), alignment: .left)
    times.font = UIFont.monospacedDigitSystemFont(ofSize: 9 * s, weight: .semibold)
    times.frame = CGRect(x: textLeft, y: padY, width: textWidth * 0.45, height: timeH)
    glass.addSublayer(times)
    let remain = max(duration > 0 ? duration : sticker.duration, 0)
    let endTime = stickerText("-\(clock(remain))", fontSize: 9 * s, color: UIColor(white: 0.42, alpha: 1), alignment: .right)
    endTime.font = UIFont.monospacedDigitSystemFont(ofSize: 9 * s, weight: .semibold)
    endTime.frame = CGRect(x: textLeft + textWidth * 0.55, y: padY, width: textWidth * 0.45, height: timeH)
    glass.addSublayer(endTime)
    let track = CALayer()
    track.frame = CGRect(x: textLeft, y: padY + timeH + 2 * s, width: textWidth, height: trackH)
    track.cornerRadius = trackH / 2
    track.backgroundColor = UIColor(white: 0.32, alpha: 0.22).cgColor
    glass.addSublayer(track)
    let fill = CALayer()
    fill.anchorPoint = CGPoint(x: 0, y: 0.5)
    fill.bounds = CGRect(x: 0, y: 0, width: textWidth, height: trackH)
    fill.position = CGPoint(x: track.frame.minX, y: track.frame.midY)
    fill.cornerRadius = trackH / 2
    fill.backgroundColor = UIColor(white: 0.17, alpha: 1).cgColor
    let grow = CABasicAnimation(keyPath: "transform.scale.x")
    grow.fromValue = 0.02
    grow.toValue = 1
    grow.duration = max(duration > 0 ? duration : sticker.duration, 0.25)
    grow.beginTime = AVCoreAnimationBeginTimeAtZero
    grow.fillMode = .forwards
    grow.isRemovedOnCompletion = false
    fill.add(grow, forKey: "progress")
    glass.addSublayer(fill)
    root.addSublayer(glass)
  }

  private func addBeatsLayer(to root: CALayer, title: String, videoDuration: Double) {
    let s = max(root.bounds.width / 168, 0.5)
    let titleH = 16 * s
    let titleLayer = stickerText(title, fontSize: max(11 * s, 10), color: .white)
    titleLayer.frame = CGRect(x: 4 * s, y: 0, width: root.bounds.width - 8 * s, height: titleH)
    let body = CALayer()
    body.frame = CGRect(x: 0, y: titleH + 4 * s, width: root.bounds.width, height: max(8, root.bounds.height - titleH - 4 * s))
    body.cornerRadius = 16 * s
    body.backgroundColor = UIColor(white: 0.02, alpha: 1).cgColor
    body.masksToBounds = true
    let bars = 32
    let pad: CGFloat = 8 * s
    let gap: CGFloat = 1.6 * s
    let usable = max(1, body.bounds.width - pad * 2)
    let barW = max(2 * s, (usable - gap * CGFloat(bars - 1)) / CGFloat(bars))
    let maxH = max(8 * s, body.bounds.height - 14 * s)
    for index in 0..<bars {
      let bar = CALayer()
      bar.anchorPoint = CGPoint(x: 0.5, y: 0)
      bar.bounds = CGRect(x: 0, y: 0, width: barW, height: maxH)
      bar.position = CGPoint(x: pad + CGFloat(index) * (barW + gap) + barW / 2, y: 7 * s)
      bar.cornerRadius = barW / 2
      bar.backgroundColor = UIColor(hue: CGFloat(index) / CGFloat(max(1, bars - 1)) * 0.78, saturation: 1, brightness: 1, alpha: 1).cgColor
      let pulse = CAKeyframeAnimation(keyPath: "transform.scale.y")
      let base = [0.22, 0.7, 0.34, 0.96, 0.4, 0.82, 0.28, 0.64]
      pulse.values = (0..<8).map { step in
        base[(index * 3 + step * 5) % base.count]
      }
      pulse.keyTimes = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.85, 1]
      pulse.calculationMode = .linear
      loopForExport(pulse, cycle: 1.05 + Double(index % 6) * 0.11, videoDuration: videoDuration)
      bar.add(pulse, forKey: "pulse")
      body.addSublayer(bar)
    }
    root.addSublayer(body)
    root.addSublayer(titleLayer)
  }

  private func addMusicLayer(to root: CALayer, title: String, box: CGFloat, videoDuration: Double) {
    let ringSize = box * (120.0 / 128.0)
    let ring = CALayer()
    ring.frame = CGRect(x: (box - ringSize) / 2, y: 0, width: ringSize, height: ringSize)
    let spikes = 72
    let s = ringSize / 120
    let cx = ring.bounds.midX
    let cy = ring.bounds.midY
    let inner = 28 * s
    for index in 0..<spikes {
      let pulseIndex = (index * 3) % 18
      let minH = (3 + CGFloat(index % 4)) * s
      let maxH = (16 + CGFloat(index % 13)) * s
      let holder = CALayer()
      holder.bounds = CGRect(x: 0, y: 0, width: 1.5 * s, height: ringSize)
      holder.position = CGPoint(x: cx, y: cy)
      holder.transform = CATransform3DMakeRotation(CGFloat(index) / CGFloat(spikes) * .pi * 2, 0, 0, 1)
      let spike = CALayer()
      spike.anchorPoint = CGPoint(x: 0.5, y: 1)
      spike.bounds = CGRect(x: 0, y: 0, width: 1.5 * s, height: maxH)
      spike.position = CGPoint(x: holder.bounds.midX, y: ringSize / 2 - inner)
      spike.backgroundColor = UIColor(white: 0.96, alpha: 1).cgColor
      spike.cornerRadius = 0.75 * s
      let timing = musicPulseTiming(pulseIndex)
      let period = timing.down + timing.up
      let steps = 16
      var values: [CGFloat] = []
      var keyTimes: [NSNumber] = []
      for step in 0...steps {
        let time = Double(step) / Double(steps) * period
        let pulse = musicPulseValue(timing, time: time)
        values.append((minH + CGFloat(pulse) * (maxH - minH)) / maxH)
        keyTimes.append(NSNumber(value: Double(step) / Double(steps)))
      }
      let pulseAnim = CAKeyframeAnimation(keyPath: "transform.scale.y")
      pulseAnim.values = values
      pulseAnim.keyTimes = keyTimes
      pulseAnim.calculationMode = .linear
      loopForExport(pulseAnim, cycle: period, videoDuration: videoDuration)
      spike.add(pulseAnim, forKey: "pulse")
      holder.addSublayer(spike)
      ring.addSublayer(holder)
    }
    root.addSublayer(ring)
    let titleLayer = CATextLayer()
    titleLayer.contentsScale = 2
    titleLayer.alignmentMode = .center
    titleLayer.isWrapped = true
    titleLayer.string = title
    titleLayer.fontSize = max(9, box * 0.09)
    titleLayer.foregroundColor = UIColor.white.cgColor
    titleLayer.frame = CGRect(x: 4, y: ring.frame.maxY + 4, width: box - 8, height: max(16, box - ring.frame.maxY - 4))
    root.addSublayer(titleLayer)
  }

  private struct MusicPulseTiming {
    let low: Double
    let high: Double
    let down: Double
    let up: Double
  }

  private func musicPulseTiming(_ index: Int) -> MusicPulseTiming {
    MusicPulseTiming(
      low: 0.18 + Double((index * 11) % 28) / 100,
      high: 0.55 + Double((index * 7) % 45) / 100,
      down: (130.0 + Double((index * 2) % 5) * 28) / 1000,
      up: (160.0 + Double(index % 6) * 35) / 1000
    )
  }

  private func musicPulseValue(_ timing: MusicPulseTiming, time: Double) -> Double {
    let period = timing.down + timing.up
    let t = time.truncatingRemainder(dividingBy: period)
    if t < timing.down {
      return lerp(timing.high, timing.low, easeInOutQuad(t / timing.down))
    }
    return lerp(timing.low, timing.high, easeInOutQuad((t - timing.down) / timing.up))
  }

  private func lerp(_ from: Double, _ to: Double, _ amount: Double) -> Double {
    from + (to - from) * amount
  }

  private func easeInOutQuad(_ x: Double) -> Double {
    let t = min(1, max(0, x))
    return t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2.0) / 2
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

  private func awaitShazam(_ matcher: ShazamFileMatcher, clipUrl: URL) throws -> [String: String]? {
    let lock = DispatchSemaphore(value: 0)
    var match: [String: String]?
    var failure: Error?
    Task {
      do {
        match = try await matcher.recognize(clipUrl: clipUrl)
      } catch {
        failure = error
      }
      lock.signal()
    }
    if lock.wait(timeout: .now() + 30) == .timedOut {
      throw NSError(domain: "VideoLyricExport", code: 17, userInfo: [NSLocalizedDescriptionKey: "detect.requestFailed"])
    }
    if let failure {
      throw failure
    }
    return match
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

  private func writeStillVideo(_ options: ExportOptions) throws -> String {
    let source = url(from: options.videoUri)
    guard let image = UIImage(contentsOfFile: source.path)?.cgImage else {
      throw NSError(domain: "VideoLyricExport", code: 5, userInfo: [NSLocalizedDescriptionKey: "Could not read the selected photo."])
    }

    let duration = options.duration > 0 ? options.duration : 30
    let longSide = max(image.width, image.height)
    let scale = longSide > 1920 ? 1920.0 / Double(longSide) : 1
    var width = max(2, Int(Double(image.width) * scale))
    var height = max(2, Int(Double(image.height) * scale))
    if width % 2 != 0 { width -= 1 }
    if height % 2 != 0 { height -= 1 }

    let output = FileManager.default.temporaryDirectory.appendingPathComponent("lyricvid-still-\(Int(Date().timeIntervalSince1970)).mp4")
    try? FileManager.default.removeItem(at: output)

    let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
    ])
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
    ])
    guard writer.canAdd(input) else {
      throw NSError(domain: "VideoLyricExport", code: 6, userInfo: [NSLocalizedDescriptionKey: "Could not start a video from this photo."])
    }
    writer.add(input)
    guard writer.startWriting() else {
      throw writer.error ?? NSError(domain: "VideoLyricExport", code: 7, userInfo: [NSLocalizedDescriptionKey: "Could not start a video from this photo."])
    }
    writer.startSession(atSourceTime: .zero)

    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32ARGB, nil, &pixelBuffer)
    guard let pixelBuffer else {
      throw NSError(domain: "VideoLyricExport", code: 8, userInfo: [NSLocalizedDescriptionKey: "Could not draw the selected photo."])
    }
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    if let context = CGContext(
      data: CVPixelBufferGetBaseAddress(pixelBuffer),
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    ) {
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    CVPixelBufferUnlockBaseAddress(pixelBuffer, [])

    let fps: Int32 = 30
    let frameCount = max(Int(duration * Double(fps)), 1)
    let frameDuration = CMTime(value: 1, timescale: fps)
    for index in 0..<frameCount {
      while !input.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.005)
      }
      let time = CMTimeMultiply(frameDuration, multiplier: Int32(index))
      if !adaptor.append(pixelBuffer, withPresentationTime: time) {
        throw writer.error ?? NSError(domain: "VideoLyricExport", code: 9, userInfo: [NSLocalizedDescriptionKey: "Could not write the photo video."])
      }
    }
    input.markAsFinished()
    let finished = DispatchSemaphore(value: 0)
    writer.finishWriting { finished.signal() }
    finished.wait()
    if writer.status != .completed {
      throw writer.error ?? NSError(domain: "VideoLyricExport", code: 10, userInfo: [NSLocalizedDescriptionKey: "Could not finish the photo video."])
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
