import UIKit
import ExpoModulesCore

/// Let UIKit compose scroll edges with the surrounding Liquid Glass. No
/// opaque overlays cover cards or participate in the tvOS focus engine.
public final class YtZeroScrollEdgesView: ExpoView {
  var effectsEnabled = true { didSet { configure() } }
  private weak var configuredScroll: UIScrollView?
  private var configuredEnabled: Bool?

  public override func layoutSubviews() {
    super.layoutSubviews()
    configure()
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    configure()
  }

  private func configure() {
    guard #available(tvOS 26.0, iOS 26.0, *) else { return }
    func findScroll(_ root: UIView) -> UIScrollView? {
      if let scroll = root as? UIScrollView { return scroll }
      for child in root.subviews { if let scroll = findScroll(child) { return scroll } }
      return nil
    }
    guard let scroll = findScroll(self), configuredScroll !== scroll || configuredEnabled != effectsEnabled else { return }
    configuredScroll = scroll
    configuredEnabled = effectsEnabled
    scroll.leftEdgeEffect.style = .soft
    scroll.rightEdgeEffect.style = .soft
    scroll.leftEdgeEffect.isHidden = !effectsEnabled
    scroll.rightEdgeEffect.isHidden = !effectsEnabled
    scroll.topEdgeEffect.isHidden = true
    scroll.bottomEdgeEffect.isHidden = true
  }
}
