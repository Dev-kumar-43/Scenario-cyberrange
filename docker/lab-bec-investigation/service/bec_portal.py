#!/usr/bin/env python3
"""
Apex Financial Corporate Portal & Mail Rule Auditor
Runs on port 8080.
Provides:
  1. Corporate Intranet UI with Mail Routing & Inbox Rule Management.
  2. REST API for deleting the persistence rule.
  3. Interactive verification endpoint /api/verify for milestone checks & flag award.
  4. Automatic background trigger for seed_mailbox.py to populate Mailpit.
"""

import os
import sys
import json
import time
import threading
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get('PORT', 8080))
RULES_FILE = os.environ.get('RULES_FILE', '/opt/lab/rules.json')
FLAG = "FLAG{bec_header_forensics_and_rule_neutralized_2026}"

def load_rules():
    if not os.path.exists(RULES_FILE):
        return []
    try:
        with open(RULES_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"[bec_portal] Error reading rules: {e}")
        return []

def save_rules(rules):
    try:
        with open(RULES_FILE, 'w') as f:
            json.dump(rules, f, indent=2)
        return True
    except Exception as e:
        print(f"[bec_portal] Error saving rules: {e}")
        return False

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Apex Financial Holdings — Corporate Portal & Mail Security</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #0284c7;
      --accent-hover: #0369a1;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --success: #10b981;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text-main); min-height: 100vh; padding: 24px; }
    .topbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--card-border); padding-bottom: 16px; margin-bottom: 24px; }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-badge { background: linear-gradient(135deg, #0284c7, #6366f1); color: white; font-weight: 800; font-size: 16px; padding: 8px 12px; border-radius: 8px; }
    .user-pill { background: #1e293b; border: 1px solid var(--card-border); padding: 6px 14px; border-radius: 20px; font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
    .container { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
    .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 24px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .card-title { font-size: 18px; font-weight: 700; color: #fff; }
    .card-desc { font-size: 14px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px; }
    .alert-box { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-left: 4px solid var(--danger); border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; line-height: 1.5; }
    .table-container { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    th { background: #0f172a; padding: 12px 16px; color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--card-border); }
    td { padding: 14px 16px; border-bottom: 1px solid rgba(51, 65, 85, 0.5); vertical-align: middle; }
    .badge-warn { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .badge-safe { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .btn-delete { background: var(--danger); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; }
    .btn-delete:hover { background: var(--danger-hover); }
    .btn-verify { background: var(--accent); color: white; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; }
    .btn-verify:hover { background: var(--accent-hover); }
    .flag-banner { display: none; background: rgba(16, 185, 129, 0.12); border: 1px solid var(--success); border-radius: 8px; padding: 16px; margin-top: 16px; font-family: monospace; font-size: 15px; color: #34d399; }
    .empty-state { text-align: center; padding: 36px; color: var(--text-muted); font-size: 14px; }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="logo">
      <div class="logo-badge">APEX</div>
      <div>
        <h1 style="font-size: 17px; font-weight: 700;">Apex Financial Holdings</h1>
        <p style="font-size: 12px; color: var(--text-muted);">Executive Intranet & Mail Infrastructure Management</p>
      </div>
    </div>
    <div class="user-pill">
      <span class="status-dot"></span>
      <span>Authenticated as: <strong>Linda Chen (VP Finance / Controller)</strong></span>
    </div>
  </div>

  <div class="container">
    <div class="alert-box">
      <strong>⚠️ SOC SECURITY AUDIT NOTICE:</strong>
      A high-severity phishing / Business Email Compromise incident is actively being investigated. Review all automated forwarding rules and delegate permissions for unauthorized persistence.
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">Mail Routing & Inbox Forwarding Rules</h2>
          <p class="card-desc">Rules configured to automatically redirect or filter inbound messages before reaching user folders.</p>
        </div>
        <button class="btn-verify" onclick="checkVerification()">Verify System State</button>
      </div>

      <div class="table-container">
        <table id="rulesTable">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Trigger Condition</th>
              <th>Destination Action</th>
              <th>Created By IP</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="rulesBody">
            <!-- Populated via JavaScript -->
          </tbody>
        </table>
        <div id="emptyMessage" class="empty-state" style="display: none;">
          ✅ No active forwarding rules detected. All unauthorized persistence vectors neutralized.
        </div>
      </div>

      <div id="flagBanner" class="flag-banner">
        <strong>🎯 INVESTIGATION VERIFIED:</strong><br>
        <span id="flagContent"></span>
      </div>
    </div>
  </div>

  <script>
    async function loadRules() {
      try {
        const res = await fetch('/api/rules');
        const rules = await res.json();
        const tbody = document.getElementById('rulesBody');
        const emptyMsg = document.getElementById('emptyMessage');
        const table = document.getElementById('rulesTable');

        tbody.innerHTML = '';
        if (rules.length === 0) {
          table.style.display = 'none';
          emptyMsg.style.display = 'block';
          return;
        }

        table.style.display = 'table';
        emptyMsg.style.display = 'none';

        rules.forEach(r => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <strong>${r.name}</strong><br>
              <span class="badge-warn">${r.id}</span>
            </td>
            <td><code>${r.condition}</code></td>
            <td style="color: #f87171;"><code>${r.target}</code></td>
            <td><code>${r.created_by_ip || 'External'}</code></td>
            <td>
              <button class="btn-delete" onclick="deleteRule('${r.id}')">Delete Rule</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      } catch (err) {
        console.error('Failed to load rules:', err);
      }
    }

    async function deleteRule(id) {
      if (!confirm(`Are you sure you want to permanently delete rule "${id}"?`)) return;
      try {
        const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' });
        if (res.ok) {
          alert('Rule deleted successfully! Checking verification...');
          loadRules();
          checkVerification();
        } else {
          alert('Failed to delete rule.');
        }
      } catch (err) {
        alert('Network error communicating with portal.');
      }
    }

    async function checkVerification() {
      try {
        const res = await fetch('/api/verify');
        const data = await res.json();
        const banner = document.getElementById('flagBanner');
        const flagText = document.getElementById('flagContent');

        if (data.verified) {
          banner.style.display = 'block';
          flagText.innerText = data.flag;
        } else {
          banner.style.display = 'none';
          alert('Verification status: Malicious forwarding rule is still active! Delete the rule to neutralize persistence.');
        }
      } catch (err) {
        console.error('Verification error:', err);
      }
    }

    loadRules();
  </script>
</body>
</html>
"""

class PortalHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress noisy HTTP logs
        return

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/' or path == '/index.html':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(HTML_TEMPLATE.encode('utf-8'))
            return

        if path == '/api/rules':
            rules = load_rules()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(rules).encode('utf-8'))
            return

        if path == '/api/verify':
            rules = load_rules()
            has_malicious = any(r.get('malicious', False) or 'wire-ops-secure' in str(r.get('target', '')) for r in rules)
            verified = not has_malicious

            resp_data = {
                "verified": verified,
                "milestones": {
                    "origin_ip": "198.51.100.44",
                    "spoofed_domain": "exec-corp-payroll.com",
                    "forged_reply_to": "wire-ops-secure@executive-finance-verify.com",
                    "rule_neutralized": verified
                },
                "flag": FLAG if verified else None,
                "message": "Persistence rule neutralized! Incident triage complete." if verified else "Malicious forwarding rule is still active in webmail."
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(resp_data).encode('utf-8'))
            return

        # 404 for unknown endpoints
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Not Found"}).encode('utf-8'))

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/rules/'):
            rule_id = path.split('/')[-1]
            rules = load_rules()
            new_rules = [r for r in rules if r.get('id') != rule_id]
            if len(new_rules) != len(rules):
                save_rules(new_rules)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"status": "deleted", "id": rule_id}).encode('utf-8'))
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Rule not found"}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def run_seeder_background():
    """Trigger seed_mailbox.py 3 seconds after portal start to allow Mailpit to bind port 1025."""
    time.sleep(3)
    seeder_script = '/opt/lab/seed_mailbox.py'
    if os.path.exists(seeder_script):
        try:
            print("[bec_portal] Triggering background mailbox seed...")
            subprocess.run([sys.executable, seeder_script], check=False)
        except Exception as e:
            print(f"[bec_portal] Seeder execution error: {e}")

def main():
    threading.Thread(target=run_seeder_background, daemon=True).start()
    server = HTTPServer(('0.0.0.0', PORT), PortalHandler)
    print(f"[bec_portal] Server listening on http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
