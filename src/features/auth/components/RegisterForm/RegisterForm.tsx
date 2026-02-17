'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ROUTES } from '@/lib/constants/routes';
import { getSafeNextPath } from '@/lib/security/safeRedirect';
import { useAuthStore } from '@/store/authStore';
import { register as registerUser } from '../../services/authService';
import { AuthShell } from '../AuthShell/AuthShell';
import styles from './RegisterForm.module.css';

const registerSchema = z.object({
  name: z.string().min(2, 'Ingresa tu nombre'),
  email: z.string().email('Ingresa un email valido'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres')
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (values: RegisterFormValues): Promise<void> => {
    setSubmitError(null);

    try {
      const response = await registerUser(values);
      setSession({
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      const nextPath = getSafeNextPath(searchParams.get('next'));
      router.replace(nextPath ?? ROUTES.dashboard);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el usuario';
      setSubmitError(message);
    }
  };

  return (
    <AuthShell title="Crear cuenta" subtitle="Configura QR Bell para tu hogar">
      <form className={styles['form']} onSubmit={handleSubmit(onSubmit)}>
        <label className={styles['field']}>
          <span className={styles['label']}>Nombre</span>
          <input className={styles['input']} type="text" autoComplete="name" {...register('name')} />
          {errors.name ? <span className={styles['error']}>{errors.name.message}</span> : null}
        </label>

        <label className={styles['field']}>
          <span className={styles['label']}>Email</span>
          <input className={styles['input']} type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <span className={styles['error']}>{errors.email.message}</span> : null}
        </label>

        <label className={styles['field']}>
          <span className={styles['label']}>Contrasena</span>
          <input className={styles['input']} type="password" autoComplete="new-password" {...register('password')} />
          {errors.password ? <span className={styles['error']}>{errors.password.message}</span> : null}
        </label>

        {submitError ? <p className={styles['error']}>{submitError}</p> : null}

        <button className={styles['submitButton']} type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className={styles['footerText']}>
        Ya tienes cuenta? <Link href={ROUTES.login}>Iniciar sesion</Link>
      </p>
    </AuthShell>
  );
}
