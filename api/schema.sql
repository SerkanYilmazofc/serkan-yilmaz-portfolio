-- Serkan Yılmaz portfolio analytics schema (MySQL/MariaDB, utf8mb4)
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS admin_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  totp_secret_enc TEXT NULL,
  totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id CHAR(64) NOT NULL PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  csrf_token CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  last_seen DATETIME NOT NULL,
  absolute_expires_at DATETIME NOT NULL,
  user_agent_hash CHAR(64) NULL,
  ip_hash CHAR(64) NULL,
  CONSTRAINT fk_admin_sessions_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  INDEX idx_admin_sessions_admin (admin_id),
  INDEX idx_admin_sessions_last_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_recovery_codes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recovery_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  INDEX idx_recovery_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  attempted_at DATETIME NOT NULL,
  INDEX idx_auth_ip_time (ip_hash, attempted_at),
  INDEX idx_auth_user_time (username_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  security_ip_hash CHAR(64) NULL,
  metadata_json JSON NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_visitors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visitor_id CHAR(36) NOT NULL UNIQUE,
  first_seen DATETIME NOT NULL,
  last_seen DATETIME NOT NULL,
  first_country VARCHAR(64) NULL,
  first_city VARCHAR(96) NULL,
  is_bot TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_visitors_last_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visitor_id CHAR(36) NOT NULL,
  session_id CHAR(36) NOT NULL UNIQUE,
  started_at DATETIME NOT NULL,
  last_seen DATETIME NOT NULL,
  ended_at DATETIME NULL,
  landing_page VARCHAR(255) NOT NULL,
  exit_page VARCHAR(255) NULL,
  referrer_domain VARCHAR(255) NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'Direct',
  utm_source VARCHAR(120) NULL,
  utm_medium VARCHAR(120) NULL,
  utm_campaign VARCHAR(160) NULL,
  utm_content VARCHAR(160) NULL,
  utm_term VARCHAR(160) NULL,
  country VARCHAR(64) NULL,
  region VARCHAR(96) NULL,
  city VARCHAR(96) NULL,
  device_type VARCHAR(32) NULL,
  browser VARCHAR(64) NULL,
  os VARCHAR(64) NULL,
  screen_width SMALLINT UNSIGNED NULL,
  screen_height SMALLINT UNSIGNED NULL,
  viewport_width SMALLINT UNSIGNED NULL,
  viewport_height SMALLINT UNSIGNED NULL,
  is_bot TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_sessions_visitor (visitor_id),
  INDEX idx_sessions_last_seen (last_seen),
  INDEX idx_sessions_started (started_at),
  INDEX idx_sessions_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_pageviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  visitor_id CHAR(36) NOT NULL,
  path VARCHAR(255) NOT NULL,
  title VARCHAR(255) NULL,
  viewed_at DATETIME NOT NULL,
  INDEX idx_pv_viewed (viewed_at),
  INDEX idx_pv_path (path),
  INDEX idx_pv_session (session_id),
  INDEX idx_pv_visitor (visitor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_meta (
  meta_key VARCHAR(64) NOT NULL PRIMARY KEY,
  meta_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_meta (meta_key, meta_value)
VALUES ('setup_complete', '0')
ON DUPLICATE KEY UPDATE meta_value = meta_value;
