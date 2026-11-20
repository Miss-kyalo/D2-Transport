export default function QuotePreviewModal({ quote, onClose }) {
  if (!quote) return null;

  const whatsappUrl = quote.phone_whatsapp
    ? `https://wa.me/${quote.phone_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        quote.whatsapp_message
      )}`
    : null;

  return (
    <div className="rounded-xl border border-emerald-700/60 bg-slate-900 p-4 text-slate-100 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-emerald-400">
          WhatsApp Quote Preview — {quote.job_number}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-white"
        >
          Close
        </button>
      </div>

      <pre className="whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-200 border border-slate-800">
        {quote.whatsapp_message}
      </pre>

      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
        >
          Open in WhatsApp
        </a>
      )}
    </div>
  );
}