import ExpoModulesCore
import Foundation

public final class YtZeroDiscoveryModule: Module {
  private var discovery: InstanceBrowser?

  public func definition() -> ModuleDefinition {
    Name("YtZeroDiscovery")
    Events("onResolved", "onRemoved", "onError")

    AsyncFunction("start") {
      self.discovery?.stop()
      let browser = InstanceBrowser { [weak self] event, body in self?.sendEvent(event, body) }
      self.discovery = browser
      browser.start()
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.discovery?.stop()
      self.discovery = nil
    }.runOnQueue(.main)

    OnDestroy {
      let browser = self.discovery
      DispatchQueue.main.async { browser?.stop() }
    }
  }
}

// NetService resolves DNS-SD on the system run loop; no subnet scans or custom
// multicast sockets, and no special multicast entitlement is required.
private final class InstanceBrowser: NSObject, NetServiceBrowserDelegate, NetServiceDelegate {
  private let browser = NetServiceBrowser()
  private var services: [String: NetService] = [:]
  private let emit: (String, [String: Any]) -> Void
  private var active = false

  init(emit: @escaping (String, [String: Any]) -> Void) { self.emit = emit }

  func start() {
    active = true
    browser.delegate = self
    browser.searchForServices(ofType: "_ytzero._tcp.", inDomain: "local.")
  }

  func stop() {
    active = false
    browser.delegate = nil
    browser.stop()
    for service in services.values { service.delegate = nil; service.stop() }
    services.removeAll()
  }

  private func id(_ service: NetService) -> String { "\(service.name).\(service.type)\(service.domain)" }

  func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
    guard active, services.count < 32 else { return }
    let key = id(service)
    guard services[key] == nil else { return }
    services[key] = service
    service.delegate = self
    service.resolve(withTimeout: 8)
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) {
    let key = id(service)
    services.removeValue(forKey: key)?.stop()
    if active { emit("onRemoved", ["id": key]) }
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) {
    if active { emit("onError", [:]) }
    stop()
  }

  func netServiceDidResolveAddress(_ sender: NetService) {
    guard active, services[id(sender)] === sender, sender.port > 0 else { return }
    var txt: [String: String] = [:]
    if let data = sender.txtRecordData() {
      for (key, value) in NetService.dictionary(fromTXTRecord: data) {
        if ["version", "scheme", "url"].contains(key), value.count <= 255 {
          txt[key] = String(data: value, encoding: .utf8)
        }
      }
    }
    let addresses = (sender.addresses ?? []).compactMap { data -> String? in
      data.withUnsafeBytes { bytes in
        guard let address = bytes.baseAddress?.assumingMemoryBound(to: sockaddr.self) else { return nil }
        var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        guard getnameinfo(address, socklen_t(data.count), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 else { return nil }
        return String(cString: host)
      }
    }
    emit("onResolved", ["id": id(sender), "name": sender.name, "host": sender.hostName ?? "", "port": sender.port, "addresses": addresses, "txt": txt])
  }

  func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
    services.removeValue(forKey: id(sender))?.stop()
  }
}
