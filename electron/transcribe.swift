import Foundation
import Speech

guard CommandLine.arguments.count >= 3 else { fputs("usage: transcribe <audio> <locale>\n", stderr); exit(2) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let locale = Locale(identifier: CommandLine.arguments[2])
let semaphore = DispatchSemaphore(value: 0)
var exitCode: Int32 = 1
SFSpeechRecognizer.requestAuthorization { status in
  guard status == .authorized, let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
    print("{\"type\":\"error\",\"message\":\"Speech recognition permission denied or locale unavailable\"}")
    semaphore.signal(); return
  }
  let request = SFSpeechURLRecognitionRequest(url: url)
  request.shouldReportPartialResults = true
  request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
  recognizer.recognitionTask(with: request) { result, error in
    if let result = result {
      if result.isFinal {
        let segments = result.bestTranscription.segments.map { segment in
          ["startMs": Int(segment.timestamp * 1000), "endMs": Int((segment.timestamp + segment.duration) * 1000), "text": segment.substring] as [String : Any]
        }
        let data = try! JSONSerialization.data(withJSONObject: ["type":"result", "segments":segments])
        print(String(data: data, encoding: .utf8)!); exitCode = 0; semaphore.signal()
      } else { print("{\"type\":\"progress\",\"value\":50}") }
    } else if let error = error {
      let data = try! JSONSerialization.data(withJSONObject: ["type":"error", "message":error.localizedDescription])
      print(String(data: data, encoding: .utf8)!); semaphore.signal()
    }
  }
}
_ = semaphore.wait(timeout: .now() + 1800)
exit(exitCode)
