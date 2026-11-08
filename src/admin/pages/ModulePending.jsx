import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Construction, Database, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import { PENDING_MODULES } from '../constants/navigation';

const PHASE_DEPENDENCIES = {
  2: [
    'Tablas de perfiles, comercios, categorías, historiales y archivos',
    'Vistas de PII enmascarada y sensible con permisos separados',
    'Buckets privados para documentos y logos con URLs firmadas',
    'Funciones de servidor para aprobar, rechazar y suspender',
  ],
  3: [
    'Tablas de solicitudes, ofertas, pedidos, envíos e incidencias',
    'Máquina de estados validada en servidor y snapshots inmutables',
    'Relación entre oferta, conversación y pedido',
    'Funciones de transición, cancelación y disputas',
  ],
  4: [
    'Tablas de conversaciones, mensajes, reportes, reseñas y soporte',
    'Concesiones temporales de acceso a chats con motivo y auditoría',
    'InsForge Messaging con dominio de correo verificado',
    'Colas de reportes, SLA y asignación de casos',
  ],
  5: [
    'Rollups diarios, vistas materializadas y exportaciones auditadas',
    'Proveedor de pagos y reglas de comisión aprobadas por negocio',
    'Reautenticación para acciones sensibles',
    'Retención, anonimización y backups verificados',
  ],
};

export default function ModulePending({ moduleKey }) {
  const module = PENDING_MODULES[moduleKey];

  if (!module) {
    return (
      <Alert tone="danger" title="Módulo desconocido">
        La ruta solicitada no está registrada en el plan administrativo.
      </Alert>
    );
  }

  const dependencies = PHASE_DEPENDENCIES[module.phase] || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Fase ${module.phase}`}
        title={module.title}
        description={module.description}
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            <Construction className="h-4 w-4" aria-hidden="true" />
            Planificado · Fase {module.phase}
          </span>
        }
      />

      <Alert tone="warning" title="Este módulo todavía no existe">
        No hay pantallas, tablas ni datos reales implementados para {module.title.toLowerCase()}. Se
        muestra el alcance acordado para no aparentar funcionalidad que aún no está construida.
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Qué incluirá</h2>
          </div>
          <ul className="mt-4 space-y-3">
            {module.capabilities.map((capability) => (
              <li key={capability} className="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0197AF]" aria-hidden="true" />
                {capability}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#006E7A]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Dependencias técnicas</h2>
          </div>
          <ul className="mt-4 space-y-3">
            {dependencies.map((dependency) => (
              <li key={dependency} className="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                {dependency}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-800">Permiso de acceso previsto</p>
            <p>
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
                {module.permission}
              </code>{' '}
              · La ruta ya está protegida en el cliente, pero la autorización definitiva se aplicará
              con RLS y funciones de servidor en su fase.
            </p>
          </div>
        </div>
      </section>

      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
