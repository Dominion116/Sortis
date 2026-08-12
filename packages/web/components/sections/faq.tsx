import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MOCK } from "@/lib/mock-data";

export function Faq() {
  return (
    <section id="faq" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-[46ch]">
          <span className="text-xs uppercase tracking-[0.08em] text-mute">
            Frequently asked
          </span>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Questions a skeptical saver would ask.
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-12 max-w-3xl">
          {MOCK.faq.map((item, i) => (
            <AccordionItem key={item.q} value={`item-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
