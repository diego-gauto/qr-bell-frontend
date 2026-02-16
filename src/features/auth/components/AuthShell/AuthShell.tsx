import styles from './AuthShell.module.css';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps): React.JSX.Element {
  return (
    <main className={styles['page']}>
      <section className={styles['card']}>
        <header className={styles['header']}>
          <h1 className={styles['title']}>{title}</h1>
          <p className={styles['subtitle']}>{subtitle}</p>
        </header>
        {children}
      </section>
    </main>
  );
}
