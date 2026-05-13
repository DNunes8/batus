"use client";

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.030-.967-.272-.099-.470-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.480-1.761-1.653-2.059-.173-.297-.018-.458.130-.606.134-.133.297-.347.446-.520.149-.173.198-.297.297-.495.099-.198.050-.371-.025-.520-.074-.149-.669-1.612-.916-2.207-.241-.579-.486-.500-.669-.510-.173-.008-.371-.010-.570-.010-.198 0-.520.074-.792.371-.272.297-1.040 1.016-1.040 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.200 5.077 4.487.710.306 1.263.489 1.694.626.712.226 1.360.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.570-.347m-5.421 7.403h-.004a9.870 9.870 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.860 9.860 0 01-1.510-5.260c.001-5.450 4.436-9.884 9.888-9.884 2.640 0 5.122 1.030 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.450-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.050 0C5.495 0 .160 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function WhatsAppShareButton({
  className: classNameProp,
  className_name,
  dayLabel,
  timeLabel,
  url,
}: {
  className?: string;
  className_name: string;
  dayLabel: string;
  timeLabel: string;
  url: string;
}) {
  const text = [
    className_name,
    `${dayLabel} · ${timeLabel}`,
    "Batus Boxing & Training · Braga",
    "",
    `Marca: ${url}`,
  ].join("\n");

  // wa.me universal link: opens the WhatsApp app on mobile, WhatsApp Web on
  // desktop. text is URL-encoded; WhatsApp pre-fills the message in the
  // user's chosen contact.
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Partilhar no WhatsApp"
      className={`inline-flex h-10 items-center gap-2 rounded-md border border-border/60 bg-background px-3 text-xs uppercase tracking-widest text-foreground transition-colors hover:bg-muted ${classNameProp ?? ""}`}
    >
      <WhatsAppGlyph className="size-4 text-[#25D366]" />
      <span className="hidden sm:inline">WhatsApp</span>
      <span className="sm:hidden">Partilhar</span>
    </a>
  );
}
