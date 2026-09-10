import Foundation

enum ImageLoader {
    static func data(from urlString: String?) async -> Data? {
        guard let urlString, let url = URL(string: urlString) else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            return data
        } catch {
            return nil
        }
    }
}
