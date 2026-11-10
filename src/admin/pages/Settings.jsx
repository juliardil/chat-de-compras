import { BarChart3, CreditCard, Globe2, LockKeyhole, Mail, Megaphone, ServerCog, ShieldCheck as ShieldCheckIcon, SlidersHorizontal } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import { useAdminAuth } from '../auth/useAdminAuth';
import { documentsBucket, deliveryEvidenceBucket } from '../../lib/insforge';

const GENERAL_SETTINGS = [
  { key: 'platform_name', label: 'Nombre de la plataforma', value: 'Chat de Compras', status: 'Definido' },
  { key: 'support_email', label: 'Correo de soporte', value: 'Por definir', status: 'Pendiente' },
  { key: 'default_currency', label: 'Moneda', value: 'Por definir', status: 'Pendiente' },
  { key: 'timezone', label: 'Zona horaria', value: 'Por definir', status: 'Pendiente' },
  { key: 'default_language', label: 'Idioma', value: 'Español', status: 'Definido' },
  { key: 'maintenance_mode', label: 'Modo mantenimiento', value: 'Desactivado', status: 'Propuesto' },
];

const FEATURE_FLAGS = [
  { key: 'payments_enabled', label: 'Pagos', value: false, note: 'No existe pasarela conectada' },
  { key: 'realtime_enabled', label: 'Tiempo real', value: false, note: 'Se activa con InsForge Realtime' },
  { key: 'support_module_enabled', label: 'Soporte', value: false, note: 'Interfaz de Fase 4 en demo; backend real pendiente de migraciones' },
  { key: 'campaigns_enabled', label: 'Campañas', value: false, note: 'Envíos simulados; requiere proveedor de correo' },
];

function Badge({ tone, children }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
    info: 'bg-sky-50 text-sky-700 ring-sky-200',
  };
  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[tone] || styles.neutral}`}>
      {children}
    </span>
  );
}

export default function Settings() {
  const { mode } = useAdminAuth();

  const integrations = [
    {
      key: 'insforge',
      label: 'InsForge',
      detail: mode === 'insforge' ? 'Variables de entorno configuradas' : 'Sin configurar',
      tone: mode === 'insforge' ? 'success' : 'warning',
      value: mode === 'insforge' ? 'Configurado' : 'Modo demo',
      Icon: ServerCog,
    },
    {
      key: 'storage',
      label: 'Almacenamiento de documentos',
      detail:
        mode === 'insforge'
          ? `Bucket privado esperado: ${documentsBucket} · requiere creación y verificación en el proyecto`
          : 'La demostración guarda solo metadatos; no existen archivos ni bucket',
      tone: mode === 'insforge' ? 'warning' : 'neutral',
      value: mode === 'insforge' ? 'Por verificar' : 'Sin archivos',
      Icon: Globe2,
    },
    {
      key: 'evidence',
      label: 'Evidencias de entrega',
      detail:
        mode === 'insforge'
          ? `Bucket privado esperado: ${deliveryEvidenceBucket} · requiere creación y verificación en el proyecto`
          : 'La demostración guarda solo metadatos de ejemplo; no existen archivos ni bucket',
      tone: mode === 'insforge' ? 'warning' : 'neutral',
      value: mode === 'insforge' ? 'Por verificar' : 'Sin archivos',
      Icon: LockKeyhole,
    },
    {
      key: 'chatAccess',
      label: 'Acceso al contenido de chats',
      detail:
        mode === 'insforge'
          ? 'Autorización aprobada, vigente y auditada por lectura (requiere migración de Fase 4)'
          : 'Flujo simulado en el navegador; cada lectura se audita localmente',
      tone: mode === 'insforge' ? 'warning' : 'neutral',
      value: mode === 'insforge' ? 'Por verificar' : 'Demostración',
      Icon: ShieldCheckIcon,
    },
    {
      key: 'messaging',
      label: 'Envío de comunicaciones',
      detail: 'No hay proveedor de correo ni dominio verificado: los envíos son simulados',
      tone: 'warning',
      value: 'Simulado',
      Icon: Megaphone,
    },
    {
      key: 'email',
      label: 'Correo',
      detail: 'InsForge Messaging con dominio verificado (pendiente de configuración)',
      tone: 'neutral',
      value: 'Pendiente',
      Icon: Mail,
    },
    {
      key: 'analytics',
      label: 'Analítica',
      detail: 'Agregados y exportaciones auditadas; sin datos personales por defecto',
      tone: 'success',
      value: 'Operativa',
      Icon: BarChart3,
    },
    {
      key: 'payments',
      label: 'Pagos',
      detail: 'Libro interno operativo; no hay pasarela, cobros ni liquidaciones reales',
      tone: 'warning',
      value: 'Sin pasarela',
      Icon: CreditCard,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configuración"
        description="Parámetros operativos y estado de integraciones. En esta fase la pantalla es de solo lectura: editar requiere permisos sensibles y reautenticación."
        actions={<Badge tone="info">Solo lectura</Badge>}
      />

      <Alert tone="info" title="Por qué no se puede editar todavía">
        La escritura de configuración sigue pendiente de una fase posterior con <code className="font-mono text-xs">settings.update</code>,
        validación en servidor, diff antes de aplicar y auditoría del cambio. La Fase 5 implementó
        analítica y el libro interno de pagos, pero no la edición de configuración. No se muestran
        controles que no funcionen.
      </Alert>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <SlidersHorizontal className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Datos generales</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {GENERAL_SETTINGS.map((setting) => (
              <li key={setting.key} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{setting.label}</p>
                  <p className="font-mono text-[11px] text-slate-400">{setting.key}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-700">{setting.value}</p>
                  <div className="mt-1">
                    <Badge tone={setting.status === 'Definido' ? 'success' : setting.status === 'Pendiente' ? 'warning' : 'neutral'}>
                      {setting.status}
                    </Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <LockKeyhole className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Feature flags</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {FEATURE_FLAGS.map((flag) => (
              <li key={flag.key} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{flag.label}</p>
                  <p className="text-xs text-slate-500">{flag.note}</p>
                  <p className="font-mono text-[11px] text-slate-400">{flag.key}</p>
                </div>
                <Badge tone={flag.value ? 'success' : 'neutral'}>{flag.value ? 'Activo' : 'Apagado'}</Badge>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-500">
            Los flags se guardarán en <code className="font-mono text-[11px]">feature_flags</code> y solo
            podrán cambiarse desde el servidor con permiso y auditoría.
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Integraciones</h2>
          <p className="mt-0.5 text-xs text-slate-500">Estado real de las conexiones previstas</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {integrations.map((integration) => {
            const Icon = integration.Icon;
            return (
              <li key={integration.key} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-slate-50 p-2 text-slate-500 ring-1 ring-slate-200">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{integration.label}</p>
                    <p className="text-xs leading-5 text-slate-500">{integration.detail}</p>
                  </div>
                </div>
                <Badge tone={integration.tone}>{integration.value}</Badge>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs leading-6 text-slate-500 shadow-sm">
        <p className="font-semibold text-slate-700">Configuraciones que no se incluyen a propósito</p>
        <p className="mt-1">
          No se exponen reglas de seguridad, duración de tokens, políticas de RLS ni parámetros que
          comprometan la integridad del sistema. Esas reglas viven en código y migraciones, no en un
          formulario.
        </p>
      </div>
    </div>
  );
}
