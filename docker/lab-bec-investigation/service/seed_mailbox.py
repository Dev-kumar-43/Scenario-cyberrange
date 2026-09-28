#!/usr/bin/env python3
"""
Mailpit SMTP Pre-Seeder for CyberRange BEC Scenario
Injects urgent_wire.eml into Mailpit (port 1025) at startup so the student's inbox
is pre-loaded with full headers, MIME parts, and attachments immediately.
"""

import os
import sys
import time
import smtplib

EML_PATH = os.environ.get('EML_PATH', '/root/Desktop/Case_Files/urgent_wire.eml')
SMTP_HOST = os.environ.get('SMTP_HOST', '127.0.0.1')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '1025'))
MAX_RETRIES = 20

def seed():
    if not os.path.exists(EML_PATH):
        print(f"[seed_mailbox] Warning: EML file not found at {EML_PATH}")
        return False

    with open(EML_PATH, 'rb') as f:
        raw_eml = f.read()

    print(f"[seed_mailbox] Waiting for Mailpit SMTP on {SMTP_HOST}:{SMTP_PORT}...")
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=3) as server:
                server.sendmail(
                    'cfo-ceo-office@exec-corp-payroll.com',
                    ['finance-desk@apex-financial.corp'],
                    raw_eml
                )
            print("[seed_mailbox] Successfully injected urgent_wire.eml into Mailpit inbox!")
            return True
        except Exception as e:
            if attempt == MAX_RETRIES:
                print(f"[seed_mailbox] Failed to connect to SMTP after {MAX_RETRIES} attempts: {e}")
                return False
            time.sleep(1)

if __name__ == '__main__':
    seed()
