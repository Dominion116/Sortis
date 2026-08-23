import type { Metadata } from "next";
import { DrawsPanel } from "@/components/app/draws-panel";
export const metadata: Metadata = { title: "Live draws", description: "Follow Sortis rounds and encrypted sweep progress." };
export default function DrawsPage() { return <DrawsPanel />; }
