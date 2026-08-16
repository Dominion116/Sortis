"use client";

import { useState, type SVGProps } from "react";
import { faqItems } from "@/config/faq";

export default function FAQSection() {
  const [activeItem, setActiveItem] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setActiveItem(activeItem === index ? null : index);
  };

  return (
    <section id="faq" className="mx-auto mb-12 max-w-3xl p-6">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold">FAQ</h2>
        <p className="text-muted-foreground">
          Questions a skeptical saver would ask.
        </p>
      </div>
      <div className="space-y-4">
        {faqItems.map((item, index) => (
          <div key={index} className="overflow-hidden rounded-lg border">
            <button
              type="button"
              className={`flex w-full cursor-pointer items-center justify-between p-4 text-left ${
                activeItem === index ? "bg-muted" : ""
              }`}
              onClick={() => toggleItem(index)}
              aria-expanded={activeItem === index}
            >
              <span>{item.question}</span>
              <ArrowDownLeftIcon
                className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ease-in-out ${
                  activeItem === index ? "rotate-45" : ""
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                activeItem === index ? "max-h-96" : "max-h-0"
              }`}
            >
              <div className="border-t border-zinc-200 p-4 text-sm dark:border-zinc-800">
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArrowDownLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 7 7 17" />
      <path d="M17 17H7V7" />
    </svg>
  );
}
