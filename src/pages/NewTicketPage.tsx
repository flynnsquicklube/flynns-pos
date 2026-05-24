import { OrderWizardPage } from "./order-wizard/OrderWizardPage";

interface NewTicketPageProps {
  onCreated: (ticketId: string) => void;
}

export function NewTicketPage({ onCreated }: NewTicketPageProps) {
  return <OrderWizardPage onCreated={onCreated} />;
}
