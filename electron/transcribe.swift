import Foundation
import AppKit
import Speech

guard CommandLine.arguments.count >= 3 else {
  fputs("usage: transcribe <audio> <locale>\n", stderr)
  exit(2)
}

let resultFilePath = CommandLine.arguments.count >= 4 ? CommandLine.arguments[3] : nil
let cancellationFilePath = CommandLine.arguments.count >= 5 ? CommandLine.arguments[4] : nil
let outputLock = NSLock()

final class TranscriptionState {
  private let lock = NSLock()
  private(set) var finished = false
  private(set) var exitCode: Int32 = 1

  @discardableResult
  func finish(exitCode: Int32) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard !finished else { return false }
    finished = true
    self.exitCode = exitCode
    return true
  }
}

func printJSON(_ value: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: value),
        let string = String(data: data, encoding: .utf8) else { return }
  outputLock.lock()
  defer { outputLock.unlock() }
  print(string)
  fflush(stdout)
  guard let resultFilePath else { return }
  let url = URL(fileURLWithPath: resultFilePath)
  if !FileManager.default.fileExists(atPath: resultFilePath) {
    FileManager.default.createFile(atPath: resultFilePath, contents: nil)
  }
  guard let handle = try? FileHandle(forWritingTo: url) else { return }
  defer { try? handle.close() }
  _ = try? handle.seekToEnd()
  try? handle.write(contentsOf: Data("\(string)\n".utf8))
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
let locale = Locale(identifier: CommandLine.arguments[2])
let state = TranscriptionState()
var recognitionTask: SFSpeechRecognitionTask?
let application = NSApplication.shared
application.setActivationPolicy(.accessory)
application.finishLaunching()
application.activate(ignoringOtherApps: true)
printJSON([
  "type": "progress",
  "value": 10,
  "authorizationStatus": SFSpeechRecognizer.authorizationStatus().rawValue,
])

func complete(_ event: [String: Any], exitCode: Int32) {
  guard state.finish(exitCode: exitCode) else { return }
  recognitionTask?.cancel()
  printJSON(event)
  exit(exitCode)
}

var authorizationRequested = false
var transcriptionStarted = false

func startRecognition() {
  guard !transcriptionStarted else { return }
  transcriptionStarted = true

  guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
    complete(["type": "error", "message": "Speech recognition is unavailable for the selected language"], exitCode: 1)
    return
  }

  guard recognizer.supportsOnDeviceRecognition else {
    complete(["type": "error", "message": "On-device speech recognition is unavailable for the selected language"], exitCode: 1)
    return
  }

  let request = SFSpeechURLRecognitionRequest(url: url)
  request.shouldReportPartialResults = true
  request.requiresOnDeviceRecognition = true
  if #available(macOS 13, *) { request.addsPunctuation = true }

  recognitionTask = recognizer.recognitionTask(with: request) { result, error in
    if let result {
      if result.isFinal {
        let segments = result.bestTranscription.segments.map { segment in
          [
            "startMs": Int(segment.timestamp * 1000),
            "endMs": Int((segment.timestamp + segment.duration) * 1000),
            "text": segment.substring,
          ] as [String: Any]
        }
        complete(["type": "result", "segments": segments], exitCode: 0)
      } else {
        printJSON(["type": "progress", "value": 50])
      }
      return
    }

    if let error { complete(["type": "error", "message": error.localizedDescription], exitCode: 1) }
  }
}

func requestOrStartRecognition() {
  switch SFSpeechRecognizer.authorizationStatus() {
  case .authorized:
    startRecognition()
  case .denied, .restricted:
    complete(["type": "error", "message": "Speech recognition permission was not granted"], exitCode: 1)
  case .notDetermined:
    guard !authorizationRequested else { return }
    authorizationRequested = true
    SFSpeechRecognizer.requestAuthorization { _ in
      DispatchQueue.main.async { requestOrStartRecognition() }
    }
  @unknown default:
    complete(["type": "error", "message": "Speech recognition authorization is unavailable"], exitCode: 1)
  }
}

let deadline = Date().addingTimeInterval(1800)
_ = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
  if !transcriptionStarted { requestOrStartRecognition() }
  if let cancellationFilePath,
     FileManager.default.fileExists(atPath: cancellationFilePath) {
    complete(["type": "cancelled", "message": "Speech recognition cancelled"], exitCode: 2)
    return
  }
  if Date() >= deadline {
    complete(["type": "error", "message": "Speech recognition timed out"], exitCode: 1)
  }
}
DispatchQueue.main.async { requestOrStartRecognition() }
application.run()
