"use client";

import { useEffect } from "react";

import { pushEvent } from "@/lib/analytics/datalayer";

/** `view_service`: uma vez por visualização de página de serviço. */
export function TrackServiceView({ serviceId, serviceName }: { serviceId: string; serviceName: string }) {
  useEffect(() => {
    pushEvent("view_service", { service_id: serviceId, service_name: serviceName });
  }, [serviceId, serviceName]);
  return null;
}
