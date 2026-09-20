import { Container } from "@/components/layout/container";

export default function LoadingGuias() {
  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <div className="bg-muted h-8 w-40 animate-pulse rounded-md" />
      <div className="bg-muted h-24 w-full animate-pulse rounded-md" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-16 w-full animate-pulse rounded-md" />
        ))}
      </div>
    </Container>
  );
}
