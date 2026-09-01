type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-app-border bg-neutral-surface p-6 text-center">
      <p className="font-medium text-app-text">{title}</p>
      <p className="mt-1 text-sm text-app-text-muted">{description}</p>
    </div>
  );
}
