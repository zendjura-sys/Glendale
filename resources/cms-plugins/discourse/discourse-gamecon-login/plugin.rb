# frozen_string_literal: true

# name: discourse-gamecon-login
# about: Вхід і реєстрація через акаунт GameCon (OAuth 2.1 + PKCE)
# version: 1.0.0
# authors: GameCon
# url: https://gamecon.online/developers/plugins/discourse
# required_version: 3.0.0

enabled_site_setting :gamecon_login_enabled

require "omniauth-oauth2"

class ::OmniAuth::Strategies::GameCon < ::OmniAuth::Strategies::OAuth2
  option :name, "gamecon"
  option :pkce, true
  option :client_options, site: "https://gamecon.online", authorize_url: "/oauth/authorize", token_url: "/oauth/token", auth_scheme: :request_body
  option :authorize_params, scope: "profile email"

  uid { raw_info["sub"].to_s }

  info do
    {
      name: raw_info["name"],
      nickname: raw_info["preferred_username"],
      email: raw_info["email"],
      image: raw_info["picture"],
      urls: { "GameCon" => raw_info["profile"] },
    }
  end

  extra { { raw_info: raw_info } }

  def raw_info
    @raw_info ||= access_token.get("/api/developer/v1/userinfo").parsed
  end

  # GameCon вимагає точний redirect_uri — без query-рядка з кодом.
  def callback_url
    full_host + callback_path
  end
end

class ::GameConAuthenticator < ::Auth::ManagedAuthenticator
  def name
    "gamecon"
  end

  def enabled?
    SiteSetting.gamecon_login_enabled && SiteSetting.gamecon_client_id.present?
  end

  def register_middleware(omniauth)
    omniauth.provider :gamecon,
                      setup: lambda { |env|
                        strategy = env["omniauth.strategy"]
                        base = SiteSetting.gamecon_base_url.presence || "https://gamecon.online"
                        strategy.options[:client_id] = SiteSetting.gamecon_client_id
                        strategy.options[:client_secret] = SiteSetting.gamecon_client_secret
                        strategy.options[:client_options][:site] = base
                      }
  end

  # Пошту від GameCon довіряємо, лише якщо GameCon її підтвердив.
  def primary_email_verified?(auth_token)
    auth_token.dig(:extra, :raw_info, "email_verified") == true
  end

  def can_revoke?
    true
  end

  def can_connect_existing_user?
    true
  end
end

auth_provider authenticator: ::GameConAuthenticator.new,
              icon: "gamepad",
              full_screen_login: true,
              title: "Увійти через GameCon",
              pretty_name: "GameCon"

register_css <<~CSS
  .btn-social.gamecon { background: #4f46e5; color: #fff; }
  .btn-social.gamecon .d-icon { color: #fff; }
CSS
