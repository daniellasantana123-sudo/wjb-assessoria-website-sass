import type { PlanIncludedService } from "@/config/plans";

export function PlanIncludedServices({ services }: { services: PlanIncludedService[] }) {
  return (
    <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {services.map((service) => (
        <div key={service.title}>
          <dt className="text-foreground font-medium">{service.title}</dt>
          <dd className="text-muted-foreground mt-1 text-sm">{service.description}</dd>
        </div>
      ))}
    </dl>
  );
}
