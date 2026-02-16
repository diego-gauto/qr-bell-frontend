'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ROUTES } from '@/lib/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { login } from '../../services/authService';
import { AuthShell } from '../AuthShell/AuthShell';
import styles from './LoginForm.module.css';

const loginSchema = z.object({
  email: z.string().email('Ingresa un email valido'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres')
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setSubmitError(null);

    try {
      const response = await login(values);
      setSession({
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      router.replace(ROUTES.dashboard);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesion';
      setSubmitError(message);
    }
  };

  return (
    <AuthShell title="Iniciar sesion" subtitle="Accede para recibir llamadas del timbre QR">
      <form className={styles['form']} onSubmit={handleSubmit(onSubmit)}>
        <label className={styles['field']}>
          <span className={styles['label']}>Email</span>
          <input className={styles['input']} type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <span className={styles['error']}>{errors.email.message}</span> : null}
        </label>

        <label className={styles['field']}>
          <span className={styles['label']}>Contrasena</span>
          <input
            className={styles['input']}
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password ? <span className={styles['error']}>{errors.password.message}</span> : null}
        </label>

        {submitError ? <p className={styles['error']}>{submitError}</p> : null}

        <button className={styles['submitButton']} type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando...' : 'Entrar'}
        </button>
      </form>

      <p className={styles['footerText']}>
        No tienes cuenta? <Link href={ROUTES.register}>Crear cuenta</Link>
      </p>
    </AuthShell>
  );
}
