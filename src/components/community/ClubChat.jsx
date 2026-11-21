import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, MessageCircle, Send, X } from 'lucide-react';
import Button from '../ui/Button';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import {
  fetchClubMessages,
  sendClubMessage,
  uploadClubImage,
  validateClubImage,
} from '../../data/clubAdvanced';
import { formatClockTime, formatRelativeDate } from '../../data/appData';

const messageTimestamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const canPreview = () =>
  typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

function Messages({ messages, className = 'max-h-56' }) {
  return (
    <div className={`space-y-2 overflow-y-auto pr-1 ${className}`} aria-live="polite">
      {messages.map((message) => {
        const showBody = message.body && !(message.image_url && message.body === 'Imagen compartida');
        return (
          <div key={message.id} className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                message.is_mine
                  ? 'bg-[#4B227A] text-white'
                  : 'border border-slate-200 bg-white text-gray-800'
              }`}
            >
              {!message.is_mine ? (
                <p className="mb-0.5 text-[10px] font-bold text-[#006E7A]">{message.author_name}</p>
              ) : null}
              {message.image_url ? (
                <img
                  src={message.image_url}
                  alt="Imagen compartida en el club"
                  className="mb-1.5 max-h-56 w-full rounded-xl border border-[#0197AF]/15 object-cover"
                />
              ) : null}
              {showBody ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
              <p className={`mt-1 text-[9px] ${message.is_mine ? 'text-white/70' : 'text-gray-400'}`}>
                {messageTimestamp(message.created_at)} · {formatRelativeDate(message.created_at)} ·{' '}
                {formatClockTime(message.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SendForm({
  body,
  onBodyChange,
  imageFile,
  imagePreview,
  onImageChange,
  onClearImage,
  fileInputRef,
  busy,
  onSubmit,
}) {
  return (
    <form className="mt-3" onSubmit={onSubmit}>
      <input
        ref={fileInputRef}
        id="club-chat-image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onImageChange}
        aria-label="Adjuntar imagen del club"
        className="sr-only"
      />
      <label
        htmlFor="club-chat-image"
        className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#4B227A]/25 bg-white/80 px-3 py-2.5 text-xs font-bold text-[#4B227A] transition hover:border-[#0197AF]/50 hover:bg-[#0197AF]/5"
      >
        <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
        {imageFile ? 'Cambiar imagen' : 'Adjuntar imagen'}
      </label>
      <span className="mt-1 block text-[10px] text-gray-400">
        JPG, PNG o WEBP · máximo 5 MB
      </span>
      {imageFile ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-[#4B227A]/10 bg-white/80">
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Vista previa de la imagen a enviar"
              className="max-h-32 w-full object-cover"
            />
          ) : null}
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span
              className="min-w-0 truncate text-[10px] font-semibold text-gray-600"
              title={imageFile.name}
            >
              {imageFile.name}
            </span>
            <button
              type="button"
              onClick={onClearImage}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#4B227A]/20 bg-white px-2 py-1 text-[10px] font-bold text-[#4B227A] transition hover:bg-[#4B227A]/5"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Quitar
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-2 flex gap-2">
        <input
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          placeholder="Escribe un mensaje para tu club…"
          maxLength={1000}
          aria-label="Mensaje del club"
          className="min-w-0 flex-1 rounded-xl border border-[#4B227A]/20 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20"
        />
        <Button type="submit" disabled={busy || (!body.trim() && !imageFile)} className="px-3 py-2">
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Enviar mensaje</span>
        </Button>
      </div>
    </form>
  );
}

function ChannelNotices({ loading, error, notice, actionError, messages }) {
  return (
    <>
      {!loading && (error || notice) ? (
        <DataNotice tone={error ? 'error' : 'info'} className="mb-2">
          {error || notice}
        </DataNotice>
      ) : null}

      {!loading && actionError ? (
        <DataNotice tone="error" className="mb-2">
          {actionError}
        </DataNotice>
      ) : null}

      {!loading && messages.length === 0 && !error ? (
        <EmptyModule
          icon={MessageCircle}
          title="Aún no hay mensajes"
          description="Es el primer mensaje del canal privado de tu club."
        />
      ) : null}
    </>
  );
}

// Canal de chat interno: solo miembros del club pueden leer y escribir
// (la pertenencia se valida en las RPC app_group_messages / app_group_send_message).
// `full` lo adapta a la pantalla dedicada: cabecera fija, mensajes flexibles y
// barra de envío siempre visible en la parte inferior.
export default function ClubChat({ full = false, groupId = null }) {
  const { items, loading, error, notice, reload } = useModuleData(fetchClubMessages, []);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const messages = [...items].reverse();

  useEffect(
    () => () => {
      if (imagePreview && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(imagePreview);
      }
    },
    [imagePreview]
  );

  const clearImage = () => {
    if (imagePreview && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(imagePreview);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    const validation = validateClubImage(file);
    if (validation) {
      setActionError(validation);
      clearImage();
      return;
    }

    clearImage();
    setImageFile(file);
    setImagePreview(file && canPreview() ? URL.createObjectURL(file) : null);
    setActionError(null);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (busy || (!body.trim() && !imageFile)) return;

    setBusy(true);
    setActionError(null);
    try {
      let imageUrl = null;
      if (imageFile) {
        const upload = await uploadClubImage({ groupId, file: imageFile, kind: 'chat' });
        if (upload.error) {
          setActionError(upload.error);
          return;
        }
        imageUrl = upload.url;
      }

      const result = await sendClubMessage(body.trim(), imageUrl);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setBody('');
      clearImage();
      reload();
    } catch (err) {
      setActionError(err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setBusy(false);
    }
  };

  const sendForm = (
    <SendForm
      body={body}
      onBodyChange={setBody}
      imageFile={imageFile}
      imagePreview={imagePreview}
      onImageChange={handleImageChange}
      onClearImage={clearImage}
      fileInputRef={fileInputRef}
      busy={busy}
      onSubmit={handleSend}
    />
  );

  if (full) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#0197AF]/25 bg-white/80 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#0197AF]/15 px-3 py-2.5">
          <MessageCircle className="h-4 w-4 text-[#0197AF]" aria-hidden="true" />
          <p className="text-xs font-bold text-gray-700">Chat interno del club</p>
          <span className="ml-auto rounded-full bg-[#0197AF]/10 px-2 py-0.5 text-[10px] font-bold text-[#006E7A]">
            Solo miembros
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3">
          <ChannelNotices
            loading={loading}
            error={error}
            notice={notice}
            actionError={actionError}
            messages={messages}
          />
          {loading ? <LoadingModule label="Cargando mensajes…" /> : null}
          {messages.length > 0 ? (
            <Messages messages={messages} className="min-h-0 flex-1" />
          ) : null}
          {sendForm}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#0197AF]/20 bg-white/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-[#0197AF]/5"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-gray-700">
          <MessageCircle className="h-4 w-4 text-[#0197AF]" aria-hidden="true" />
          Chat interno del club
          <span className="rounded-full bg-[#0197AF]/10 px-2 py-0.5 text-[10px] font-bold text-[#006E7A]">
            Solo miembros
          </span>
        </span>
        <span className="text-[11px] font-semibold text-[#006E7A]">
          {open ? 'Ocultar' : 'Abrir'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-[#0197AF]/15 p-3">
          {loading ? <LoadingModule label="Cargando mensajes…" /> : null}
          <ChannelNotices
            loading={loading}
            error={error}
            notice={notice}
            actionError={actionError}
            messages={messages}
          />
          {messages.length > 0 ? <Messages messages={messages} /> : null}
          {sendForm}
        </div>
      ) : null}
    </div>
  );
}
