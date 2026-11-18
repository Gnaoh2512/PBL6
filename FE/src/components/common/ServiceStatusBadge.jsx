import {
  SERVICE_STATUS_BADGE,
  SERVICE_STATUS_HINT,
  SERVICE_STATUS_ICON,
  SERVICE_STATUS_LABEL,
  normalizeServiceStatus,
} from "../../utils/labels";

/** Status chip for a service request — always Vietnamese. */
export default function ServiceStatusBadge({ status }) {
  const key = normalizeServiceStatus(status);
  return (
    <span className={SERVICE_STATUS_BADGE[key]} title={SERVICE_STATUS_HINT[key]}>
      <i className={`bi ${SERVICE_STATUS_ICON[key]}`}></i> {SERVICE_STATUS_LABEL[key]}
    </span>
  );
}

export const renderServiceStatusBadge = (status) => <ServiceStatusBadge status={status} />;
