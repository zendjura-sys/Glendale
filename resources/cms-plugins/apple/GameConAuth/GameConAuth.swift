import AuthenticationServices
import CryptoKit
import Foundation

/// «Увійти через GameCon» для iOS 15+ і macOS 12+: ASWebAuthenticationSession, PKCE (S256), без секрету.
/// Адреса повернення — своя схема, напр. com.example.game://oauth (зареєструйте її в застосунку GameCon).
@MainActor
public final class GameConAuth: NSObject, ASWebAuthenticationPresentationContextProviding {
    public struct Profile: Decodable {
        public let sub: String
        public let preferred_username: String
        public let name: String?
        public let email: String?
        public let picture: String?
    }

    private let clientId: String
    private let redirect: URL
    private let base: URL
    private var session: ASWebAuthenticationSession?

    public init(clientId: String, redirect: URL, base: URL = URL(string: "https://gamecon.online")!) {
        self.clientId = clientId
        self.redirect = redirect
        self.base = base
    }

    public func signIn(scope: String = "profile email") async throws -> Profile {
        let verifier = Self.random(48)
        let state = Self.random(24)
        var url = URLComponents(url: base.appendingPathComponent("oauth/authorize"), resolvingAgainstBaseURL: false)!
        url.queryItems = [
            .init(name: "response_type", value: "code"),
            .init(name: "client_id", value: clientId),
            .init(name: "redirect_uri", value: redirect.absoluteString),
            .init(name: "scope", value: scope),
            .init(name: "state", value: state),
            .init(name: "code_challenge", value: Self.b64(Data(SHA256.hash(data: Data(verifier.utf8))))),
            .init(name: "code_challenge_method", value: "S256"),
        ]
        let callback: URL = try await withCheckedThrowingContinuation { cont in
            let s = ASWebAuthenticationSession(url: url.url!, callbackURLScheme: redirect.scheme) { url, error in
                if let url { cont.resume(returning: url) } else { cont.resume(throwing: error ?? URLError(.cancelled)) }
            }
            s.presentationContextProvider = self
            s.prefersEphemeralWebBrowserSession = false
            session = s
            s.start()
        }
        let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        guard items.first(where: { $0.name == "state" })?.value == state,
              let code = items.first(where: { $0.name == "code" })?.value else { throw URLError(.userAuthenticationRequired) }

        var tokenRequest = URLRequest(url: base.appendingPathComponent("oauth/token"))
        tokenRequest.httpMethod = "POST"
        tokenRequest.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var form = URLComponents()
        form.queryItems = [
            .init(name: "grant_type", value: "authorization_code"), .init(name: "code", value: code),
            .init(name: "redirect_uri", value: redirect.absoluteString), .init(name: "client_id", value: clientId),
            .init(name: "code_verifier", value: verifier),
        ]
        tokenRequest.httpBody = form.percentEncodedQuery?.data(using: .utf8)
        let (tokenData, _) = try await URLSession.shared.data(for: tokenRequest)
        struct Token: Decodable { let access_token: String }
        let token = try JSONDecoder().decode(Token.self, from: tokenData)

        var me = URLRequest(url: base.appendingPathComponent("api/developer/v1/userinfo"))
        me.setValue("Bearer \(token.access_token)", forHTTPHeaderField: "Authorization")
        let (profile, _) = try await URLSession.shared.data(for: me)
        return try JSONDecoder().decode(Profile.self, from: profile)
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        #if os(macOS)
        return NSApplication.shared.keyWindow ?? ASPresentationAnchor()
        #else
        return UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
        #endif
    }

    private static func random(_ bytes: Int) -> String {
        var data = Data(count: bytes)
        _ = data.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, bytes, $0.baseAddress!) }
        return b64(data)
    }

    private static func b64(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
