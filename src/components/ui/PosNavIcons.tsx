// Custom SVG navigation icon components for the POS system.
// All use currentColor so they work on dark sidebar and light page backgrounds.
// Consistent 24x24 viewBox, 2px stroke weight, rounded caps.

interface IconProps {
  size?: number;
  className?: string;
}

export function IconDashboard({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <rect x="13.5" y="3" width="7.5" height="4.5" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <rect x="13.5" y="10.5" width="7.5" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

export function IconStartTicket({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="16.5" cy="16.5" r="4.5" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.9" />
      <path d="M16.5 14.5v4M14.5 16.5h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconWorkOrders({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="3" width="5" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.9" />
      <rect x="9.5" y="3" width="5" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.9" />
      <rect x="17" y="3" width="5" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

export function IconCheckInWall({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="2" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <rect x="13" y="2" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <rect x="2" y="13" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <rect x="13" y="13" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

export function IconActiveBays({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M2 6l3-4h14l3 4" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <circle cx="7.5" cy="17.5" r="2" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="16.5" cy="17.5" r="2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M9.5 17.5h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M5 11h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function IconOrderManager({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="2" width="18" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M7 7h10M7 11h10M7 15h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconPaymentManager({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.9" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.9" />
      <rect x="5" y="14" width="5" height="2.5" rx="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export function IconBlankOrder({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 7h8M8 11h8M8 15h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" opacity="0.5" />
      <circle cx="17" cy="17" r="4.5" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.9" />
      <path d="M17 15v4M15 17h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconInventory({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="7" width="20" height="15" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M2 12h20M2 17h20" stroke="currentColor" strokeWidth="1.9" strokeOpacity="0.5" />
      <path d="M8 7V4.5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2V7" stroke="currentColor" strokeWidth="1.9" />
      <rect x="9" y="14" width="6" height="2" rx="1" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function IconCustomers({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="16" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M2 20c0-4 3-7 7-7s7 3 7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M16 14c2 0 6 1.5 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconVehicles({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="10" width="20" height="9" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M2 10l3-5h14l3 5" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <circle cx="7" cy="19" r="2" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17" cy="19" r="2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M9 7h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function IconEmployees({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.9" />
      <path d="M2 21v-1a7 7 0 0 1 14 0v1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="19" cy="11" r="4" stroke="currentColor" strokeWidth="1.9" />
      <path d="M19 9.5v1.5l1 1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconReports({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 20V14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 20V9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 20V12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M19 20V5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M2 20h20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconSettings({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconOilChange({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M8 2v4l-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l-2-2V2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10h12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="16" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

export function IconTimeClock({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 7v5l3.5 3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
