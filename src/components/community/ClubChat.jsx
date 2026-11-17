import React, { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import Button from '../ui/Button';
import { DataNotice, EmptyModule, LoadingModule } from '../ui/ModuleState';
import { useModuleData } from '../../data/useModuleData';
import { fetchClubMessages, sendClubMessage } from '../../data/clubAdvanced';
import { formatClockTime, formatRelativeDate } from '../../data/appData';

function Messages({ messages, className = 'max-h-56' }) {
  return (
    <div className={`space-y-2 overflow-y-auto pr-1 ${className}`} aria-live="polite">
      {messages.map((message) => (
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
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
            <p className={`mt-1 text-[9px] ${message.is_mine ? 'text-white/70' : 'text-gray-400'}`}>
              {formatRelativeDate(message.created_at)} · {formatClockTime(message.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SendForm({ body, onBodyChange, busy, onSubmit }) {
  return (
    <form className="mt-3 flex gap-2" onSubmit={onSubmit}>
      <input
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder="Escribe un mensaje para tu club…"
        maxLength={1000}
        aria-label="Mensaje del club"
        className="min-w-0 flex-1 rounded-xl border border-[#4B227A]/20 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#0197AF] focus:ring-2 focus:ring-[#0197AF]/20"
      />
      <Button type="submit" disabled={busy || !body.trim()} className="px-3 py-2">
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Enviar mensaje</span>
      </Button>
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
export default function ClubChat({ full = false }) {
  const { items, loading, error, notice, reload } = useModuleData(fetchClubMessages, []);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const messages = [...items].reverse();

  const handleSend = async (event) => {
    event.preventDefault();
    if (busy || !body.trim()) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await sendClubMessage(body.trim());
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setBody('');
      reload();
    } catch (err) {
      setActionError(err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setBusy(false);
    }
  };

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
          <SendForm body={body} onBodyChange={setBody} busy={busy} onSubmit={handleSend} />
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
          <SendForm body={body} onBodyChange={setBody} busy={busy} onSubmit={handleSend} />
        </div>
      ) : null}
    </div>
  );
}
