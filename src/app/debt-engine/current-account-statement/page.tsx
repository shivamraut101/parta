import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default function CurrentAccountStatementPage() {
  redirect("/debt-engine/ledger?scope=CA");
}
