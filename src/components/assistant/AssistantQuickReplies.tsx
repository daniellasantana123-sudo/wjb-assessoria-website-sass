export interface AssistantQuickReply {
  label: string;
  onClick: () => void;
}

export interface AssistantQuickRepliesProps {
  options: AssistantQuickReply[];
}

/** Grade de respostas rápidas (menu principal / CTAs de cada serviço). */
export function AssistantQuickReplies({ options }: AssistantQuickRepliesProps) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={option.onClick}
          className="border-border hover:border-primary hover:bg-muted focus-visible:ring-primary rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
