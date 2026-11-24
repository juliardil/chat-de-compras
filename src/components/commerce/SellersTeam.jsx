import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  KeyRound,
  Mail,
  MessageCircle,
  Plus,
  ShoppingBag,
  Star,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import SafeImage from '../ui/SafeImage';
import { DataNotice } from '../ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import {
  createSeller,
  fetchCommerceTeam,
  resetSellerPassword,
  setSellerActive,
  updateSeller,
} from '../../data/commerceSellers';
import { formatCurrency, uploadProfilePhoto, validateProfilePhoto } from '../../data/appData';
import { useModuleData } from '../../data/useModuleData';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyForm = () => ({
  fullName: '',
  email: '',
  password: '',
  avatarUrl: null,
  avatarFile: null,
});

function SellerAvatar({ member, onEdit }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Cambiar foto de ${member.fullName || 'vendedor'}`}
      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#00EED0]/60 bg-gradient-to-br from-[#00EED0]/30 to-[#4B227A]/30"
    >
      {member.avatarUrl ? (
        <SafeImage
          src={member.avatarUrl}
          alt={`Foto de ${member.fullName}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-lg font-bold text-[#4B227A]">
          {member.initials || 'V'}
        </span>
      )}
      <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#006E7A] shadow">
        <Camera className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-[#0197AF]/10 px-2 py-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#006E7A]">{label}</p>
      <p className="truncate text-xs font-bold text-gray-800">{value}</p>
    </div>
  );
}

// Los modales se montan en el body: dentro de la tarjeta de nichos cualquier
// `overflow`/`transform` recortaría el formulario. El mismo patrón que el modal
// de «Datos de Envío» del chat mantiene todos los campos visibles en móvil.
function Modal({ title, subtitle, onClose, children }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            {subtitle ? <p className="mt-1 text-xs leading-relaxed text-gray-600">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-full p-2 text-gray-600 hover:bg-[#0197AF]/10 hover:text-[#006E7A]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export default function SellersTeam() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, loading, error, notice, reload } = useModuleData(
    () => fetchCommerceTeam(),
    [user?.id]
  );
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  const sellers = items.filter((member) => member.role === 'seller');

  const openCreate = () => {
    setForm(emptyForm());
    setMessage(null);
    setModal({ type: 'create' });
  };

  const openEdit = (member) => {
    setForm({
      fullName: member.fullName,
      email: member.email,
      password: '',
      avatarUrl: member.avatarUrl,
      avatarFile: null,
    });
    setMessage(null);
    setModal({ type: 'edit', member });
  };

  const openPassword = (member) => {
    setForm({ ...emptyForm(), fullName: member.fullName, email: member.email });
    setMessage(null);
    setModal({ type: 'password', member });
  };

  const closeModal = () => {
    setModal(null);
    setForm(emptyForm());
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validation = validateProfilePhoto(file);
    if (validation) {
      setMessage({ tone: 'error', text: validation });
      return;
    }

    setMessage(null);
    setForm((current) => ({
      ...current,
      avatarFile: file,
      avatarUrl: URL.createObjectURL(file),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!modal || busy) return;

    const fullName = String(form.fullName || '').trim();
    const email = String(form.email || '').trim().toLowerCase();
    const password = String(form.password || '');

    if (modal.type !== 'password' && fullName.length < 2) {
      setMessage({ tone: 'error', text: 'Indica el nombre completo del vendedor.' });
      return;
    }
    if (modal.type === 'create' && !EMAIL_PATTERN.test(email)) {
      setMessage({ tone: 'error', text: 'Indica un correo válido.' });
      return;
    }
    if (modal.type !== 'edit' && password.length < 8) {
      setMessage({ tone: 'error', text: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      let avatarUrl = form.avatarUrl || null;
      if (form.avatarFile) {
        // El dueño sube las fotos de su equipo en una carpeta propia; el RLS
        // de storage solo permite escribir archivos subidos por su sesión.
        const upload = await uploadProfilePhoto({
          userId: user?.id,
          role: 'seller',
          folder: `seller-uploads/${user?.id || 'owner'}`,
          file: form.avatarFile,
        });
        if (upload.error || !upload.url) {
          setMessage({
            tone: 'error',
            text: upload.error || 'No se pudo subir la foto del vendedor.',
          });
          return;
        }
        avatarUrl = upload.url;
      }

      let result;
      if (modal.type === 'create') {
        result = await createSeller({ fullName, email, password, avatarUrl });
      } else if (modal.type === 'edit') {
        result = await updateSeller(modal.member.id, { fullName, avatarUrl });
      } else {
        result = await resetSellerPassword(modal.member.id, password);
      }

      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error || 'No se pudo guardar el vendedor.' });
        return;
      }

      setMessage({
        tone: 'info',
        text:
          modal.type === 'create'
            ? 'Vendedor creado. Ya puede iniciar sesión con el correo indicado.'
            : modal.type === 'edit'
              ? 'Foto y nombre del vendedor actualizados.'
              : 'Contraseña restablecida. El vendedor debe volver a iniciar sesión.',
      });
      reload();
      closeModal();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (member) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await setSellerActive(member.id, !member.isActive);
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error || 'No se pudo cambiar el estado.' });
    } else {
      setMessage({
        tone: 'info',
        text: member.isActive
          ? `${member.fullName} ahora está inactivo.`
          : `${member.fullName} vuelve a estar activo.`,
      });
      reload();
    }
    setBusy(false);
  };

  return (
    <section className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/30">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4B227A]/15 text-[#4B227A]">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">👥 Equipo y Vendedores</h3>
            <p className="text-xs text-gray-600">Administra quién atiende y vende en tu tienda</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="shrink-0 px-3 py-2 text-xs"
          aria-label="Agregar vendedor"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar vendedor
        </Button>
      </div>

      {message ? (
        <DataNotice tone={message.tone} className="mb-3">
          {message.text}
        </DataNotice>
      ) : null}
      {loading ? <p className="mb-3 text-xs text-gray-600">Cargando tu equipo…</p> : null}
      {!loading && (error || notice) ? (
        <DataNotice tone={error ? 'error' : 'info'} className="mb-3">
          {error || notice}
        </DataNotice>
      ) : null}

      {!loading && sellers.length === 0 && !error ? (
        <DataNotice tone="info">
          Todavía no agregas vendedores. Crea una cuenta para que otro compañero atienda los chats y
          cierre ventas con tu identidad de tienda.
        </DataNotice>
      ) : null}

      <div className="flex flex-col gap-4">
        {sellers.map((member) => (
          <article
            key={member.id}
            className="rounded-2xl border border-[#4B227A]/15 bg-white/70 p-5"
          >
            <div className="flex items-center gap-4">
              <SellerAvatar member={member} onEdit={() => openEdit(member)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate text-sm font-bold text-gray-800">{member.fullName}</h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      member.isActive
                        ? 'bg-[#00EED0]/25 text-[#006E7A]'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {member.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="truncate text-[11px] text-gray-600">{member.email}</p>
                <p className="mt-1 text-sm font-bold text-[#006E7A]">
                  {member.salesClosed} {member.salesClosed === 1 ? 'venta' : 'ventas'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4">
              <Metric label="Ofertas" value={String(member.offersSent)} />
              <Metric label="Monto" value={formatCurrency(member.salesAmount)} />
              <Metric
                label="Calificación"
                value={member.rating === null ? '—' : `${Number(member.rating).toFixed(1)} ★`}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => navigate('/chat-list')}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#0197AF]/30 bg-white px-2 py-2 text-[11px] font-bold text-[#006E7A] hover:bg-[#0197AF]/5"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Ver chats
              </button>
              <button
                type="button"
                onClick={() => navigate('/sales-history')}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#0197AF]/30 bg-white px-2 py-2 text-[11px] font-bold text-[#006E7A] hover:bg-[#0197AF]/5"
              >
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                Ver ventas
              </button>
              <button
                type="button"
                onClick={() => openPassword(member)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#4B227A]/25 bg-white px-2 py-2 text-[11px] font-bold text-[#4B227A] hover:bg-[#4B227A]/5"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Cambiar clave
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleActive(member)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#4B227A]/25 bg-white px-2 py-2 text-[11px] font-bold text-[#4B227A] hover:bg-[#4B227A]/5 disabled:opacity-60"
              >
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                {member.isActive ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </article>
        ))}
      </div>

      {modal ? (
        <Modal
          title={
            modal.type === 'create'
              ? '+ Agregar vendedor'
              : modal.type === 'edit'
                ? 'Editar vendedor'
                : 'Cambiar contraseña'
          }
          subtitle={
            modal.type === 'create'
              ? 'Crea una cuenta de acceso con foto opcional.'
              : modal.type === 'edit'
                ? 'Actualiza su foto circular y su nombre visible en el chat.'
                : `Nueva contraseña para ${modal.member?.fullName || 'el vendedor'}.`
          }
          onClose={closeModal}
        >
          <form onSubmit={submit} className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhoto}
              className="hidden"
              aria-label="Foto del vendedor"
            />

            {modal.type !== 'password' ? (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#00EED0]/60 bg-gradient-to-br from-[#00EED0]/30 to-[#4B227A]/30"
                  aria-label="Subir foto del vendedor"
                >
                  {form.avatarUrl ? (
                    <SafeImage
                      src={form.avatarUrl}
                      alt="Vista previa de la foto"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserPlus className="m-auto h-6 w-6 text-[#4B227A]" aria-hidden="true" />
                  )}
                </button>
                <div>
                  <p className="text-xs font-bold text-gray-800">Foto (opcional)</p>
                  <p className="text-[11px] text-gray-600">
                    Si no subes foto se mostrarán sus iniciales.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 text-xs font-bold text-[#006E7A] underline"
                  >
                    Elegir imagen
                  </button>
                </div>
              </div>
            ) : null}

            {modal.type !== 'password' ? (
              <Input
                label="Nombre completo"
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fullName: event.target.value }))
                }
                placeholder="Ej. Ana Torres"
                disabled={busy}
              />
            ) : null}

            {modal.type === 'create' ? (
              <Input
                label="Correo"
                type="email"
                icon={Mail}
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="vendedor@ejemplo.com"
                disabled={busy}
              />
            ) : null}

            {modal.type !== 'edit' ? (
              <Input
                label={modal.type === 'create' ? 'Contraseña inicial' : 'Nueva contraseña'}
                type="password"
                icon={KeyRound}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Mínimo 8 caracteres"
                disabled={busy}
                autoComplete="new-password"
              />
            ) : null}

            {message ? (
              <DataNotice tone={message.tone}>{message.text}</DataNotice>
            ) : null}

            <div className="mt-2 flex gap-3">
              <Button type="button" variant="secondary" onClick={closeModal} className="flex-1 py-3 text-sm">
                Cancelar
              </Button>
              <Button type="submit" disabled={busy} className="flex-1 py-3 text-sm">
                {busy
                  ? 'Guardando…'
                  : modal.type === 'create'
                    ? 'Crear vendedor'
                    : modal.type === 'edit'
                      ? 'Guardar cambios'
                      : 'Restablecer clave'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
