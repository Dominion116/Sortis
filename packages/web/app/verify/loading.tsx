import { RouteLoading } from "@/components/motion/page-transition";

/** Immediate skeleton while a verification round streams its event trail. */
export default function VerifyLoading() {
  return <RouteLoading variant="marketing" />;
}
