import { redirect } from "next/navigation";

/** Compatibility route. The pool screen lives at /pool. */
export default function AppPage() {
  redirect("/pool");
}
