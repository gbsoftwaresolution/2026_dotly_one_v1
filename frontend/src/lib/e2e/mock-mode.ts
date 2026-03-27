export function isE2eMockMode(): boolean {
  return (
    process.env.E2E_MOCKS === "1" || process.env.NEXT_PUBLIC_E2E_MOCKS === "1"
  );
}
