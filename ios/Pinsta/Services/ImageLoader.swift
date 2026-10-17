import Foundation

enum ImageLoader {
    /// `timeout`: seconds without a byte before giving up (URLSession's default is 60).
    static func data(from urlString: String?, timeout: TimeInterval = 60) async -> Data? {
        guard let urlString, let url = URL(string: urlString) else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: timeout))
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            return data
        } catch {
            return nil
        }
    }
}
