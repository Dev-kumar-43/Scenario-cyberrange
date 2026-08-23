import type { Metadata } from 'next';
import './globals.css';
import styles from './layout.module.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cyber Range Platform',
  description: 'Interactive Cybersecurity Lab Environment',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className={styles.container}>
          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>◬</span> 
              <span className="text-gradient">CyberRange</span>
            </div>
            <nav className={styles.nav}>
              <Link href="/" className={`${styles.navLink} ${styles.active}`}>
                Dashboard
              </Link>
              <Link href="/sessions" className={styles.navLink}>
                Active Sessions
              </Link>
              <Link href="#" className={styles.navLink}>
                My Progress
              </Link>
              <Link href="#" className={styles.navLink}>
                Settings
              </Link>
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className={styles.mainContent}>
            <header className={styles.topbar}>
              <div className={styles.userProfile}>
                <div className={styles.avatar}>A</div>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Admin User</span>
              </div>
            </header>
            
            <div className={styles.contentArea}>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
