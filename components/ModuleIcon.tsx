import { Boxes, Compass, CreditCard, Database, Film, Layers, MapPin, MessagesSquare, Network, Puzzle, ServerCog, Workflow } from "lucide-react";
import type { ModuleIcon as IconName } from "@/lib/curriculum";

const ICONS = {
  start: Compass,
  network: Network,
  data: Layers,
  storage: Database,
  traffic: Workflow,
  realtime: MessagesSquare,
  search: MapPin,
  media: Film,
  transactions: CreditCard,
  oop: Puzzle,
  lld: Boxes,
  advanced: ServerCog,
} satisfies Record<IconName, unknown>;

export default function ModuleIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Icon = ICONS[name];
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
