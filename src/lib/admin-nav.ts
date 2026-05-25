// Shared admin nav so the desktop sidebar and the mobile drawer stay in sync.

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/calendar", label: "Calendário" },
  { href: "/admin/classes", label: "Modelos" },
  { href: "/admin/students", label: "Alunos" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
  { href: "/admin/messages", label: "Mensagens" },
  { href: "/admin/merch", label: "Loja" },
  { href: "/admin/claims", label: "Pedidos" },
] as const;
