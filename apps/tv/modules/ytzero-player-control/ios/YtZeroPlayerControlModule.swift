import AVFoundation
import AVKit
import UIKit
import ExpoModulesCore

#if os(tvOS)
private var shortsNavigationKey: UInt8 = 0
#endif

/// expo-video's synchronous play/pause methods run on the JS thread. AVKit on
/// tvOS 26 can synchronously lay out its transport bar in response, causing
/// _AssertAutoLayoutOnAllowedThreadsOnly. Keep these mutations on the main queue
/// while retaining expo-video's player, source loading and system controls.
public final class YtZeroPlayerControlModule: Module {
  private var contrastObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("YtZeroPlayerControl")
    Events("queueSelection", "contrastChanged")
    OnCreate {
      self.contrastObserver = NotificationCenter.default.addObserver(
        forName: UIAccessibility.darkerSystemColorsStatusDidChangeNotification, object: nil, queue: .main
      ) { [weak self] _ in
        self?.sendEvent("contrastChanged", ["enabled": UIAccessibility.isDarkerSystemColorsEnabled])
      }
    }
    OnDestroy {
      if let observer = self.contrastObserver { NotificationCenter.default.removeObserver(observer) }
      self.contrastObserver = nil
    }
    AsyncFunction("getIncreasedContrast") { UIAccessibility.isDarkerSystemColorsEnabled }.runOnQueue(.main)
    View(YtZeroFocusScopeView.self) {}
    View(YtZeroGradientMaskView.self) {}
    View(YtZeroScrollEdgesView.self) {
      Prop("enabled") { (view: YtZeroScrollEdgesView, enabled: Bool) in view.effectsEnabled = enabled }
    }
    // React Native's requestTVFocus depends on a particular React root class
    // and cannot reach views inside a native Modal. UIKit owns both focus trees.
    AsyncFunction("focusView") { (tag: Int) -> Bool in
      #if os(tvOS)
      guard let view = self.appContext?.findView(withTag: tag, ofType: UIView.self), view.window != nil else { return false }
      var ancestor = view.superview
      while let current = ancestor {
        if let scope = current as? YtZeroFocusScopeView { return scope.focus(view) }
        ancestor = current.superview
      }
      return false
      #else
      return false
      #endif
    }.runOnQueue(.main)
    // expo-video's exitFullscreen uses an iOS selector unavailable on tvOS.
    // Complete UIKit dismissal before React can present the next queued video.
    AsyncFunction("dismiss") { (player: SharedRef<AVPlayer>, promise: Promise) in
      #if os(tvOS)
      // During a React player swap, JS may already own the new player while
      // the presented controller still displays the previous one. Menu/error
      // dismissal must work on both sides of that commit.
      guard let controller = self.controller(for: player.ref) ?? self.controller(for: nil), controller.presentingViewController != nil else {
        promise.resolve(false)
        return
      }
      controller.dismiss(animated: !UIAccessibility.isReduceMotionEnabled) {
        promise.resolve(true)
      }
      #else
      promise.resolve(false)
      #endif
    }.runOnQueue(.main)
    AsyncFunction("setQueue") { (player: SharedRef<AVPlayer>, currentId: String, nextId: String, previousId: String, items: [[String: String]], labels: [String: String]) -> Bool in
      #if os(tvOS)
      guard let controller = self.controller(for: player.ref) else { return false }
      let choose: (String) -> Void = { [weak self] id in
        self?.sendEvent("queueSelection", ["videoId": id, "currentId": currentId])
      }
      var controls: [UIMenuElement] = [UIAction(title: labels["details"] ?? "", image: UIImage(systemName: "info.circle")) { [weak self] _ in
        self?.sendEvent("queueSelection", ["videoId": "", "currentId": currentId, "action": "details"])
      }]
      if !previousId.isEmpty {
        controls.append(UIAction(title: labels["previous"] ?? "", image: UIImage(systemName: "backward.end.fill")) { _ in choose(previousId) })
      }
      if !nextId.isEmpty {
        controls.append(UIAction(title: labels["next"] ?? "", image: UIImage(systemName: "forward.end.fill")) { _ in choose(nextId) })
      }
      let entries: [UIMenuElement] = items.prefix(100).compactMap { item in
        guard let id = item["id"], let title = item["title"] else { return nil }
        return UIAction(title: title, image: id == currentId ? UIImage(systemName: "play.fill") : nil,
                        attributes: id == currentId ? .disabled : [], state: id == currentId ? .on : .off) { _ in choose(id) }
      }
      if !entries.isEmpty {
        controls.append(UIMenu(title: labels["queue"] ?? "", image: UIImage(systemName: "list.bullet"), children: entries))
      }
      controller.transportBarCustomMenuItems = controls
      return true
      #else
      return false
      #endif
    }.runOnQueue(.main)
    AsyncFunction("setShortsNavigation") { (player: SharedRef<AVPlayer>, currentId: String, nextId: String, previousId: String) -> Bool in
      #if os(tvOS)
      guard let controller = self.controller(for: player.ref) else { return false }
      let existing = objc_getAssociatedObject(controller, &shortsNavigationKey) as? ShortsRemoteNavigation
      // Keep the recognizers while adjacency loads between Shorts. Detaching
      // here lets a fast second swipe open AVKit's transport controls instead.
      if nextId.isEmpty && previousId.isEmpty && existing == nil { return true }
      let navigation = existing ?? ShortsRemoteNavigation(controller: controller)
      navigation.update(currentId: currentId, nextId: nextId, previousId: previousId) { [weak self] id in
        self?.sendEvent("queueSelection", ["videoId": id, "currentId": currentId])
      }
      objc_setAssociatedObject(controller, &shortsNavigationKey, navigation, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
      return true
      #else
      return false
      #endif
    }.runOnQueue(.main)
    AsyncFunction("clearQueue") { (player: SharedRef<AVPlayer>) in
      #if os(tvOS)
      if let controller = self.controller(for: player.ref) {
        controller.transportBarCustomMenuItems = []
        (objc_getAssociatedObject(controller, &shortsNavigationKey) as? ShortsRemoteNavigation)?.detach()
        objc_setAssociatedObject(controller, &shortsNavigationKey, nil, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
      }
      #endif
    }.runOnQueue(.main)
    AsyncFunction("enableShortsNavigation") { (player: SharedRef<AVPlayer>, enabled: Bool) in
      #if os(tvOS)
      if let controller = self.controller(for: player.ref) {
        (objc_getAssociatedObject(controller, &shortsNavigationKey) as? ShortsRemoteNavigation)?.setEnabled(enabled)
      }
      #endif
    }.runOnQueue(.main)
    AsyncFunction("isAttached") { (player: SharedRef<AVPlayer>) -> Bool in
      #if os(tvOS)
      return self.controller(for: player.ref) != nil
      #else
      return true
      #endif
    }.runOnQueue(.main)
    AsyncFunction("unload") { (player: SharedRef<AVPlayer>) in
      player.ref.pause()
      player.ref.currentItem?.cancelPendingSeeks()
      player.ref.currentItem?.asset.cancelLoading()
      player.ref.replaceCurrentItem(with: nil)
    }.runOnQueue(.main)
    AsyncFunction("diagnostics") { (player: SharedRef<AVPlayer>) -> [String: Any] in
      YtZeroPlaybackDiagnostics.snapshot(player.ref)
    }.runOnQueue(.main)
    AsyncFunction("setMetadata") { (player: SharedRef<AVPlayer>, title: String, subtitle: String) -> Bool in
      guard let item = player.ref.currentItem else { return false }
      // expo-video's source.metadata feeds its opt-in NowPlayingManager, not
      // AVPlayerItem.externalMetadata used by the tvOS AVKit controller.
      let values: [(AVMetadataIdentifier, String)] = [(.commonIdentifierTitle, title), (.iTunesMetadataTrackSubTitle, subtitle)]
      let identifiers = values.map { $0.0 }
      let metadata = values.filter { !$0.1.isEmpty }.map { identifier, value -> AVMetadataItem in
        let entry = AVMutableMetadataItem()
        entry.identifier = identifier
        entry.value = value as NSString
        entry.extendedLanguageTag = "und"
        return entry.copy() as! AVMetadataItem
      }
      item.externalMetadata = item.externalMetadata.filter { entry in entry.identifier.map { !identifiers.contains($0) } ?? true } + metadata
      return true
    }.runOnQueue(.main)
    AsyncFunction("play") { (player: SharedRef<AVPlayer>) in
      player.ref.play()
    }.runOnQueue(.main)
    AsyncFunction("pause") { (player: SharedRef<AVPlayer>) in
      player.ref.pause()
    }.runOnQueue(.main)
    AsyncFunction("seek") { (player: SharedRef<AVPlayer>, seconds: Double) in
      guard seconds.isFinite, seconds >= 0 else { return }
      player.ref.seek(to: CMTime(seconds: seconds, preferredTimescale: 600))
    }.runOnQueue(.main)
  }
  #if os(tvOS)
  private func controller(for player: AVPlayer?) -> AVPlayerViewController? {
    func find(_ root: UIViewController) -> AVPlayerViewController? {
      if let presented = root.presentedViewController, let match = find(presented) { return match }
      if let controller = root as? AVPlayerViewController, player == nil || controller.player === player { return controller }
      for child in root.children { if let match = find(child) { return match } }
      return nil
    }
    for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
      for window in scene.windows {
        if let root = window.rootViewController, let match = find(root) { return match }
      }
    }
    return nil
  }
  #endif
}

#if os(tvOS)
/// AVKit owns fullscreen input, so React Native TV events cannot handle swipes
/// here. Intercept only vertical gestures with the transport controls hidden.
/// Forward all other AVKit delegate methods to expo-video, including dismissal.
private final class ShortsRemoteNavigation: NSObject, UIGestureRecognizerDelegate, AVPlayerViewControllerDelegate {
  private weak var controller: AVPlayerViewController?
  private weak var originalDelegate: AVPlayerViewControllerDelegate?
  private var recognizers: [UIGestureRecognizer] = []
  private var currentId = ""
  private var nextId = ""
  private var previousId = ""
  private var transportVisible = false
  private var selectionPending = false
  private var enabled = true
  private var choose: ((String) -> Void)?

  init(controller: AVPlayerViewController) {
    self.controller = controller
    originalDelegate = controller.delegate
    super.init()
    for direction: UISwipeGestureRecognizer.Direction in [.up, .down] {
      let swipe = UISwipeGestureRecognizer(target: self, action: #selector(swiped(_:)))
      swipe.direction = direction
      install(swipe, on: controller.view)
    }
    // Direction buttons also support remotes without a touch surface.
    for press: UIPress.PressType in [.upArrow, .downArrow] {
      let tap = UITapGestureRecognizer(target: self, action: #selector(pressed(_:)))
      tap.allowedPressTypes = [NSNumber(value: press.rawValue)]
      tap.allowedTouchTypes = []
      install(tap, on: controller.view)
    }
    controller.delegate = self
  }

  func update(currentId: String, nextId: String, previousId: String, choose: @escaping (String) -> Void) {
    if self.currentId != currentId { selectionPending = false }
    self.currentId = currentId
    self.nextId = nextId
    self.previousId = previousId
    self.choose = choose
  }

  func setEnabled(_ enabled: Bool) {
    self.enabled = enabled
    // JS acknowledges success or recovery, even if the current ID is unchanged.
    if enabled { selectionPending = false }
  }

  private func install(_ recognizer: UIGestureRecognizer, on view: UIView) {
    recognizer.delegate = self
    view.addGestureRecognizer(recognizer)
    recognizers.append(recognizer)
  }

  func detach() {
    recognizers.forEach { $0.view?.removeGestureRecognizer($0) }
    recognizers.removeAll()
    if controller?.delegate === self { controller?.delegate = originalDelegate }
    choose = nil
  }

  private func destination(for recognizer: UIGestureRecognizer) -> String {
    if let swipe = recognizer as? UISwipeGestureRecognizer { return swipe.direction == .down ? nextId : previousId }
    return recognizer.allowedPressTypes.contains(NSNumber(value: UIPress.PressType.downArrow.rawValue)) ? nextId : previousId
  }

  func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard let controller, controller.presentingViewController != nil,
          !controller.isBeingDismissed, controller.presentedViewController == nil else { return false }
    // Consume repeated gestures during replacement so AVKit does not reveal
    // controls halfway through a swipe burst. Menu and Play/Pause are untouched.
    return !transportVisible && (selectionPending || !enabled || !destination(for: gestureRecognizer).isEmpty)
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool {
    // AVKit can reveal its transport bar on the same swipe. Give the Shorts
    // action first refusal; when controls are visible it immediately fails.
    return !recognizers.contains(other)
  }

  @objc private func swiped(_ recognizer: UISwipeGestureRecognizer) { select(recognizer) }
  @objc private func pressed(_ recognizer: UITapGestureRecognizer) { select(recognizer) }

  private func select(_ recognizer: UIGestureRecognizer) {
    guard recognizer.state == .ended, enabled, !selectionPending else { return }
    let id = destination(for: recognizer)
    guard !id.isEmpty, id != currentId else { return }
    selectionPending = true
    choose?(id)
  }

  func playerViewController(_ playerViewController: AVPlayerViewController, willTransitionToVisibilityOfTransportBar visible: Bool, with coordinator: AVPlayerViewControllerAnimationCoordinator) {
    transportVisible = visible
    originalDelegate?.playerViewController?(playerViewController, willTransitionToVisibilityOfTransportBar: visible, with: coordinator)
  }

  override func responds(to selector: Selector!) -> Bool {
    super.responds(to: selector) || originalDelegate?.responds(to: selector) == true
  }

  override func forwardingTarget(for selector: Selector!) -> Any? {
    if originalDelegate?.responds(to: selector) == true { return originalDelegate }
    return super.forwardingTarget(for: selector)
  }
}
#endif

/// A modal has no React root view. Give UIKit a common focus environment that
/// contains both the old and new item, with an explicit preferred destination.
/// Requesting an update on the new item alone is ignored by UIKit because that
/// item does not yet contain focus.
public final class YtZeroFocusScopeView: ExpoView {
  #if os(tvOS)
  private weak var requestedView: UIView?

  public override var preferredFocusEnvironments: [UIFocusEnvironment] {
    if let view = requestedView, view.window != nil { return [view] }
    return super.preferredFocusEnvironments
  }

  func focus(_ view: UIView) -> Bool {
    requestedView = view
    setNeedsFocusUpdate()
    updateFocusIfNeeded()
    requestedView = nil
    return view.isFocused
  }
  #endif
}

/// Fade a blurred copy of the artwork into its lower half. This masks ordinary
/// image content, never a UIVisualEffectView or the foreground controls.
public final class YtZeroGradientMaskView: ExpoView {
  private let maskedContent = UIView()
  private let gradient = CAGradientLayer()

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    gradient.colors = [UIColor.clear.cgColor, UIColor.clear.cgColor, UIColor.black.cgColor, UIColor.black.cgColor]
    gradient.locations = [0, 0.42, 0.76, 1]
    // Fabric clears the Expo view's layer.mask while updating borders. Keep
    // the mask on a UIKit-owned content view so React layouts cannot erase it.
    maskedContent.layer.mask = gradient
    addSubview(maskedContent)
    isUserInteractionEnabled = false
  }

  public override func mountChildComponentView(_ childComponentView: UIView, index: Int) {
    maskedContent.insertSubview(childComponentView, at: index)
  }

  public override func unmountChildComponentView(_ childComponentView: UIView, index: Int) {
    childComponentView.removeFromSuperview()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    maskedContent.frame = bounds
    gradient.frame = bounds
    CATransaction.commit()
  }
}


/// Deliberately excludes URLs, headers, userInfo, titles and server messages.
/// AVPlayerItemErrorLog contains playback tickets in its URI fields.
enum YtZeroPlaybackDiagnostics {
  static func domain(_ value: String) -> String {
    let known = [NSURLErrorDomain, NSOSStatusErrorDomain, AVFoundationErrorDomain,
                 "CoreMediaErrorDomain", "CoreMediaErrorDomainError", "NSCocoaErrorDomain"]
    return known.contains(value) ? value : "other"
  }

  static func snapshot(_ player: AVPlayer) -> [String: Any] {
    var result: [String: Any] = [
      "playerStatus": player.status.rawValue,
      "timeControlStatus": player.timeControlStatus.rawValue
    ]
    guard let item = player.currentItem else { return result }
    result["itemStatus"] = item.status.rawValue
    result["bufferEmpty"] = item.isPlaybackBufferEmpty
    result["likelyToKeepUp"] = item.isPlaybackLikelyToKeepUp
    result["hasTitle"] = item.externalMetadata.contains { $0.identifier == .commonIdentifierTitle }
    var errors: [[String: Any]] = []
    var error = (item.error ?? player.error) as NSError?
    for _ in 0..<4 {
      guard let current = error else { break }
      errors.append(["domain": domain(current.domain), "code": current.code])
      error = current.userInfo[NSUnderlyingErrorKey] as? NSError
    }
    result["errors"] = errors
    result["requestErrors"] = (item.errorLog()?.events.suffix(4) ?? []).map {
      ["domain": domain($0.errorDomain), "code": $0.errorStatusCode] as [String: Any]
    }
    if let access = item.accessLog()?.events.last {
      result["stalls"] = access.numberOfStalls
      result["droppedFrames"] = access.numberOfDroppedVideoFrames
    }
    return result
  }
}
