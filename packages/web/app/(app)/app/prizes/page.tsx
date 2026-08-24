import type { Metadata } from "next";
import { PrizesPanel } from "@/components/app/prizes-panel";

export const metadata: Metadata = { title: "Your prizes", description: "Privately reveal and claim Sortis prizes." };
export default function PrizesPage() { return <PrizesPanel />; }
