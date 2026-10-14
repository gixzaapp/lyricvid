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
      let box = max(90, 120 * scale * CGFloat(sticker.scale))
      let root = CALayer()
      if sticker.kind == "beats" {
        let wide = box * 1.7
        let tall = box * 0.72
        root.frame = CGRect(x: center.x - wide / 2, y: center.y - tall / 2, width: wide, height: tall)
        addBeatsLayer(to: root, title: sticker.title)
      } else if sticker.kind == "player" {
        let wide = box * 2.2
        let tall = box * 0.7
        root.frame = CGRect(x: center.x - wide / 2, y: center.y - tall / 2, width: wide, height: tall)
        addPlayerLayer(to: root, sticker: sticker, duration: duration)
      } else {
        root.frame = CGRect(x: center.x - box / 2, y: center.y - box / 2, width: box, height: box)
        switch sticker.kind {
        case "cassette":
          addCassetteLayer(to: root, title: sticker.title, box: box)
        case "music":
          addMusicLayer(to: root, title: sticker.title, box: box)
        default:
          addVinylLayer(to: root, title: sticker.title, box: box)
        }
      }
      parent.addSublayer(root)
    }
  }

  private func addVinylLayer(to root: CALayer, title: String, box: CGFloat) {
    let disc = CALayer()
    disc.frame = CGRect(x: box * 0.08, y: 0, width: box * 0.84, height: box * 0.84)
    disc.cornerRadius = disc.bounds.width / 2
    disc.backgroundColor = UIColor(white: 0.07, alpha: 1).cgColor
    disc.borderWidth = 4
    disc.borderColor = UIColor(white: 0.17, alpha: 1).cgColor
    let label = CATextLayer()
    label.contentsScale = 2
    label.alignmentMode = .center
    label.isWrapped = true
    label.string = title
    label.fontSize = max(8, box * 0.07)
    label.foregroundColor = UIColor(red: 1, green: 0.96, blue: 0.91, alpha: 1).cgColor
    label.backgroundColor = UIColor(red: 0.77, green: 0.29, blue: 0.29, alpha: 1).cgColor
    label.cornerRadius = box * 0.16
    label.masksToBounds = true
    label.frame = CGRect(x: box * 0.26, y: box * 0.26, width: box * 0.32, height: box * 0.32)
    disc.addSublayer(label)
    let spin = CABasicAnimation(keyPath: "transform.rotation.z")
    spin.fromValue = 0
    spin.toValue = Double.pi * 2
    spin.duration = 4.8
    spin.repeatCount = .infinity
    disc.add(spin, forKey: "spin")
    root.addSublayer(disc)
  }

  private func addCassetteLayer(to root: CALayer, title: String, box: CGFloat) {
    let body = CALayer()
    body.frame = CGRect(x: box * 0.04, y: box * 0.18, width: box * 0.92, height: box * 0.64)
    body.cornerRadius = 10
    body.backgroundColor = UIColor(red: 0.11, green: 0.14, blue: 0.22, alpha: 1).cgColor
    body.borderWidth = 1
    body.borderColor = UIColor(red: 0.44, green: 0.48, blue: 0.6, alpha: 1).cgColor
    let titleLayer = CATextLayer()
    titleLayer.contentsScale = 2
    titleLayer.alignmentMode = .center
    titleLayer.string = title
    titleLayer.fontSize = max(8, box * 0.08)
    titleLayer.foregroundColor = UIColor(red: 0.96, green: 0.91, blue: 0.78, alpha: 1).cgColor
    titleLayer.frame = CGRect(x: 6, y: 6, width: body.bounds.width - 12, height: 16)
    body.addSublayer(titleLayer)
    for x in [body.bounds.width * 0.25, body.bounds.width * 0.75] {
      let reel = CALayer()
      reel.bounds = CGRect(x: 0, y: 0, width: box * 0.16, height: box * 0.16)
      reel.position = CGPoint(x: x, y: body.bounds.height * 0.62)
      reel.cornerRadius = reel.bounds.width / 2
      reel.backgroundColor = UIColor(red: 0.23, green: 0.16, blue: 0.09, alpha: 1).cgColor
      reel.borderWidth = 2
      reel.borderColor = UIColor(red: 0.79, green: 0.64, blue: 0.42, alpha: 1).cgColor
      let spin = CABasicAnimation(keyPath: "transform.rotation.z")
      spin.fromValue = 0
      spin.toValue = Double.pi * 2
      spin.duration = 2.2
      spin.repeatCount = .infinity
      reel.add(spin, forKey: "spin")
      body.addSublayer(reel)
    }
    root.addSublayer(body)
  }

  private func clock(_ seconds: Double) -> String {
    let total = max(0, Int(seconds.rounded(.down)))
    return String(format: "%d:%02d", total / 60, total % 60)
  }

  private func addPlayerLayer(to root: CALayer, sticker: ExportSticker, duration: Double) {
    let glass = CALayer()
    glass.frame = root.bounds
    glass.cornerRadius = 22
    glass.backgroundColor = UIColor(white: 1, alpha: 0.72).cgColor
    glass.borderWidth = 1
    glass.borderColor = UIColor(white: 1, alpha: 0.8).cgColor
    glass.masksToBounds = true
    let art = CALayer()
    art.frame = CGRect(x: 12, y: (root.bounds.height - 40) / 2, width: 40, height: 40)
    art.cornerRadius = 10
    art.backgroundColor = UIColor(red: 0.78, green: 0.71, blue: 0.60, alpha: 1).cgColor
    let note = CATextLayer()
    note.contentsScale = 2
    note.alignmentMode = .center
    note.string = "♪"
    note.fontSize = 16
    note.foregroundColor = UIColor(red: 0.23, green: 0.16, blue: 0.11, alpha: 1).cgColor
    note.frame = art.bounds
    art.addSublayer(note)
    glass.addSublayer(art)
    let textLeft: CGFloat = 62
    let textWidth = max(8, root.bounds.width - textLeft - 12)
    let titleLayer = CATextLayer()
    titleLayer.contentsScale = 2
    titleLayer.alignmentMode = .left
    titleLayer.truncationMode = .end
    titleLayer.string = sticker.title
    titleLayer.fontSize = 12
    titleLayer.foregroundColor = UIColor(white: 0.1, alpha: 1).cgColor
    titleLayer.frame = CGRect(x: textLeft, y: 12, width: textWidth, height: 16)
    glass.addSublayer(titleLayer)
    let artistLayer = CATextLayer()
    artistLayer.contentsScale = 2
    artistLayer.alignmentMode = .left
    artistLayer.truncationMode = .end
    artistLayer.string = sticker.artist.isEmpty ? "Artist" : sticker.artist
    artistLayer.fontSize = 10
    artistLayer.foregroundColor = UIColor(white: 0.42, alpha: 1).cgColor
    artistLayer.frame = CGRect(x: textLeft, y: 28, width: textWidth, height: 13)
    glass.addSublayer(artistLayer)
    let track = CALayer()
    track.frame = CGRect(x: textLeft, y: root.bounds.height - 26, width: textWidth, height: 3)
    track.cornerRadius = 1.5
    track.backgroundColor = UIColor(white: 0.32, alpha: 0.22).cgColor
    glass.addSublayer(track)
    let fill = CALayer()
    fill.anchorPoint = CGPoint(x: 0, y: 0.5)
    fill.bounds = CGRect(x: 0, y: 0, width: textWidth, height: 3)
    fill.position = CGPoint(x: track.frame.minX, y: track.frame.midY)
    fill.cornerRadius = 1.5
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
    let startTime = CATextLayer()
    startTime.contentsScale = 2
    startTime.alignmentMode = .left
    startTime.string = "0:00"
    startTime.fontSize = 9
    startTime.foregroundColor = UIColor(white: 0.48, alpha: 1).cgColor
    startTime.frame = CGRect(x: textLeft, y: root.bounds.height - 18, width: 40, height: 12)
    glass.addSublayer(startTime)
    let remain = max(duration > 0 ? duration : sticker.duration, 0)
    let endTime = CATextLayer()
    endTime.contentsScale = 2
    endTime.alignmentMode = .right
    endTime.string = "-\(clock(remain))"
    endTime.fontSize = 9
    endTime.foregroundColor = UIColor(white: 0.48, alpha: 1).cgColor
    endTime.frame = CGRect(x: root.bounds.width - 52, y: root.bounds.height - 18, width: 40, height: 12)
    glass.addSublayer(endTime)
    root.addSublayer(glass)
  }

  private func addBeatsLayer(to root: CALayer, title: String) {
    let body = CALayer()
    body.frame = CGRect(x: 0, y: 0, width: root.bounds.width, height: root.bounds.height * 0.72)
    body.cornerRadius = 16
    body.backgroundColor = UIColor(white: 0.02, alpha: 1).cgColor
    body.masksToBounds = true
    let bars = 32
    let pad: CGFloat = 8
    let gap: CGFloat = 1.6
    let usable = max(1, body.bounds.width - pad * 2)
    let barW = max(2, (usable - gap * CGFloat(bars - 1)) / CGFloat(bars))
    let maxH = max(8, body.bounds.height - 14)
    for index in 0..<bars {
      let bar = CALayer()
      bar.anchorPoint = CGPoint(x: 0.5, y: 1)
      bar.bounds = CGRect(x: 0, y: 0, width: barW, height: maxH)
      bar.position = CGPoint(x: pad + CGFloat(index) * (barW + gap) + barW / 2, y: body.bounds.height - 7)
      bar.cornerRadius = barW / 2
      bar.backgroundColor = UIColor(hue: CGFloat(index) / CGFloat(max(1, bars - 1)) * 0.78, saturation: 1, brightness: 1, alpha: 1).cgColor
      let pulse = CAKeyframeAnimation(keyPath: "transform.scale.y")
      let base = [0.22, 0.7, 0.34, 0.96, 0.4, 0.82, 0.28, 0.64]
      pulse.values = (0..<8).map { step in
        base[(index * 3 + step * 5) % base.count]
      }
      pulse.keyTimes = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.85, 1]
      pulse.duration = 1.05 + Double(index % 6) * 0.11
      pulse.repeatCount = .infinity
      pulse.calculationMode = .linear
      bar.add(pulse, forKey: "pulse")
      body.addSublayer(bar)
    }
    root.addSublayer(body)
    let titleLayer = CATextLayer()
    titleLayer.contentsScale = 2
    titleLayer.alignmentMode = .center
    titleLayer.string = title
    titleLayer.fontSize = max(9, root.bounds.width * 0.055)
    titleLayer.foregroundColor = UIColor.white.cgColor
    titleLayer.frame = CGRect(x: 4, y: body.frame.maxY + 2, width: root.bounds.width - 8, height: 16)
    root.addSublayer(titleLayer)
  }

  private func addMusicLayer(to root: CALayer, title: String, box: CGFloat) {
    let ring = CALayer()
    ring.frame = CGRect(x: box * 0.04, y: 0, width: box * 0.92, height: box * 0.72)
    let spikes = 72
    let cx = ring.bounds.midX
    let cy = ring.bounds.midY
    let inner = min(ring.bounds.width, ring.bounds.height) * 0.22
    let maxH = min(ring.bounds.width, ring.bounds.height) * 0.2
    for index in 0..<spikes {
      let angle = CGFloat(index) / CGFloat(spikes) * .pi * 2
      let holder = CALayer()
      holder.bounds = CGRect(x: 0, y: 0, width: 2, height: maxH)
      holder.position = CGPoint(x: cx + cos(angle) * inner, y: cy + sin(angle) * inner)
      holder.transform = CATransform3DMakeRotation(angle - .pi / 2, 0, 0, 1)
      let spike = CALayer()
      spike.anchorPoint = CGPoint(x: 0.5, y: 0)
      spike.bounds = CGRect(x: 0, y: 0, width: 1.6, height: maxH)
      spike.position = CGPoint(x: holder.bounds.midX, y: 0)
      spike.backgroundColor = UIColor(white: 0.96, alpha: 1).cgColor
      spike.cornerRadius = 0.8
      let pulse = CAKeyframeAnimation(keyPath: "transform.scale.y")
      let base: [CGFloat] = [0.18, 0.72, 0.3, 0.95, 0.42, 0.8, 0.22, 0.66]
      pulse.values = (0..<8).map { step in
        base[(index * 3 + step * 5) % base.count]
      }
      pulse.keyTimes = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.85, 1]
      pulse.duration = 1.05 + Double(index % 7) * 0.09
      pulse.repeatCount = .infinity
      pulse.calculationMode = .linear
      spike.add(pulse, forKey: "pulse")
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
    titleLayer.frame = CGRect(x: 4, y: box * 0.74, width: box - 8, height: box * 0.24)
    root.addSublayer(titleLayer)
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
