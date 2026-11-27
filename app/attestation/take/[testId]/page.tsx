import { TestRunner } from "@/components/attestation/test-runner";

export const dynamic = "force-dynamic";

export default function TakeTestPage({ params }: { params: { testId: string } }) {
  return <TestRunner testId={params.testId} />;
}
