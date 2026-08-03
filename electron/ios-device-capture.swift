import AppKit
import AVFoundation
import CoreMedia
import Foundation

struct DeviceInfo: Codable { let id: String; let name: String; let connected: Bool; let suspended: Bool; let inUse: Bool; let transportType: Int32; let audioSupport: String }

func screenDevices() -> [AVCaptureDevice] {
  AVCaptureDevice.DiscoverySession(deviceTypes: [.external], mediaType: .muxed, position: .unspecified).devices.filter { device in
    device.hasMediaType(.muxed) && device.formats.contains { format in
      CMFormatDescriptionGetMediaSubType(format.formatDescription) == kCMMuxedStreamType_EmbeddedDeviceScreenRecording
    }
  }
}
func deviceInfo(_ device: AVCaptureDevice) -> DeviceInfo {
  DeviceInfo(id: device.uniqueID, name: device.localizedName, connected: device.isConnected, suspended: device.isSuspended, inUse: device.isInUseByAnotherApplication, transportType: device.transportType, audioSupport: "muxed-device-stream; separate macOS system audio is unavailable")
}
func printJSON<T: Encodable>(_ value: T) { let data = try! JSONEncoder().encode(value); print(String(data: data, encoding: .utf8)!) }

final class MovieDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {
  var exitCode: Int32 = 1
  func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
    if let error { printJSON(["type":"error", "message":error.localizedDescription]); exitCode = 1 }
    else { printJSON(["type":"result", "outputPath":outputFileURL.path]); exitCode = 0 }
    CFRunLoopStop(CFRunLoopGetMain())
  }
}

guard CommandLine.arguments.count >= 2 else { fputs("usage: ios-device-capture discover|preview|record ...\n", stderr); exit(2) }
let command = CommandLine.arguments[1]
if command == "discover" { printJSON(screenDevices().map(deviceInfo)); exit(0) }
guard CommandLine.arguments.count >= 3, let device = AVCaptureDevice(uniqueID: CommandLine.arguments[2]), screenDevices().contains(where: { $0.uniqueID == device.uniqueID }) else { printJSON(["type":"error", "message":"The selected wired iPhone/iPad screen is disconnected or unavailable"]); exit(3) }
guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else { printJSON(["type":"error", "message":"Camera capture permission is required by AVFoundation for wired iPhone/iPad screen input"]); exit(4) }
let session = AVCaptureSession(); session.sessionPreset = .high
do { let input = try AVCaptureDeviceInput(device: device); guard session.canAddInput(input) else { throw NSError(domain:"ToScreenIOSCapture", code:5, userInfo:[NSLocalizedDescriptionKey:"AVFoundation rejected the muxed device input"]) }; session.addInput(input) }
catch { printJSON(["type":"error", "message":error.localizedDescription]); exit(5) }

if command == "preview" {
  let app = NSApplication.shared
  let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 390, height: 700), styleMask: [.titled,.closable,.resizable], backing: .buffered, defer: false)
  window.title = "\(device.localizedName) Screen Preview"; window.contentView?.wantsLayer = true
  let layer = AVCaptureVideoPreviewLayer(session: session); layer.videoGravity = .resizeAspect; layer.frame = window.contentView!.bounds; layer.autoresizingMask = [.layerWidthSizable,.layerHeightSizable]; window.contentView!.layer?.addSublayer(layer)
  NotificationCenter.default.addObserver(forName: AVCaptureDevice.wasDisconnectedNotification, object: device, queue: .main) { _ in app.terminate(nil) }
  session.startRunning(); window.center(); window.makeKeyAndOrderFront(nil); app.run(); session.stopRunning(); exit(0)
}

guard command == "record", CommandLine.arguments.count >= 4 else { fputs("record requires device ID and output path\n", stderr); exit(2) }
let outputURL = URL(fileURLWithPath: CommandLine.arguments[3]); try? FileManager.default.removeItem(at: outputURL)
let movie = AVCaptureMovieFileOutput(); guard session.canAddOutput(movie) else { printJSON(["type":"error", "message":"AVFoundation cannot attach a movie output to this iOS screen stream"]); exit(6) }; session.addOutput(movie)
let delegate = MovieDelegate()
signal(SIGTERM, SIG_IGN); let source = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main); source.setEventHandler { if movie.isRecording { movie.stopRecording() } else { CFRunLoopStop(CFRunLoopGetMain()) } }; source.resume()
NotificationCenter.default.addObserver(forName: AVCaptureDevice.wasDisconnectedNotification, object: device, queue: .main) { _ in if movie.isRecording { movie.stopRecording() } }
session.startRunning(); movie.startRecording(to: outputURL, recordingDelegate: delegate); printJSON(["type":"started", "outputPath":outputURL.path]); fflush(stdout); CFRunLoopRun(); session.stopRunning(); exit(delegate.exitCode)
